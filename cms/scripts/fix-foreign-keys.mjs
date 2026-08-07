/**
 * SEFELEC — Correction des clés étrangères (niveau SQL)
 * ======================================================
 * Corrige « SQLITE_CONSTRAINT: FOREIGN KEY constraint failed » à la
 * suppression d'un élément.
 *
 * Pourquoi en SQL direct ?
 * ------------------------
 * L'API de Directus permet en théorie de modifier la règle ON DELETE d'une
 * relation, mais elle plante sur ce schéma (bug interne :
 * `Cannot read properties of undefined (reading 'fields')` dans
 * RelationsService.alterType). On applique donc la correction directement
 * dans la base, ce que SQLite impose de faire en reconstruisant les tables :
 * il n'existe pas d'ALTER TABLE permettant de changer une clé étrangère.
 *
 * Stratégies appliquées
 * ---------------------
 *   CASCADE  : tables de liaison des galeries. Supprimer un produit supprime
 *              ses lignes de liaison ; les images restent dans la
 *              bibliothèque. Supprimer une image la retire de toutes les
 *              galeries.
 *   SET NULL : rattachements métier (catégorie, marque). Supprimer une
 *              catégorie ne supprime pas ses produits : ils deviennent
 *              « sans catégorie ».
 *
 * Sécurité
 * --------
 *   • Directus DOIT être arrêté avant d'exécuter ce script.
 *   • Une sauvegarde horodatée est créée automatiquement.
 *   • Tout est exécuté dans une transaction : la moindre erreur annule tout.
 *   • Un contrôle d'intégrité (foreign_key_check) est lancé avant validation.
 *
 * Usage :  node scripts/fix-foreign-keys.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const DB_PATH = path.resolve('data.db');

// --- Description des corrections à appliquer -------------------------------

/** Tables de liaison des galeries : les deux clés passent en CASCADE. */
const JUNCTIONS = [
  ['products_files', 'products_id', 'products'],
  ['services_files', 'services_id', 'services'],
  ['categories_files', 'categories_id', 'categories'],
  ['brands_files', 'brands_id', 'brands'],
  ['pages_files', 'pages_id', 'pages'],
  ['team_members_files', 'team_members_id', 'team_members'],
  ['partners_files', 'partners_id', 'partners'],
  ['articles_files', 'articles_id', 'articles']
];

// --- Utilitaires de promesse ----------------------------------------------

function open() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => (err ? reject(err) : resolve(db)));
  });
}
const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => db.run(sql, params, (err) => (err ? reject(err) : resolve())));
const all = (db, sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );
const get = (db, sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );

// --- Reconstruction d'une table -------------------------------------------

/**
 * Reconstruit une table de liaison avec ON DELETE CASCADE sur ses deux clés.
 * Procédure standard SQLite : table temporaire → copie → suppression → renommage.
 */
async function rebuildJunction(db, table, parentField, parentTable) {
  const cols = await all(db, `PRAGMA table_info(\`${table}\`)`);
  if (!cols.length) {
    console.log(`  · ${table} : absente, ignorée`);
    return false;
  }

  const tmp = `${table}__new`;
  await run(db, `DROP TABLE IF EXISTS \`${tmp}\``);

  await run(
    db,
    `CREATE TABLE \`${tmp}\` (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       \`${parentField}\` CHAR(36) REFERENCES \`${parentTable}\`(id) ON DELETE CASCADE,
       directus_files_id CHAR(36) REFERENCES directus_files(id) ON DELETE CASCADE,
       sort INTEGER
     )`
  );

  await run(
    db,
    `INSERT INTO \`${tmp}\` (id, \`${parentField}\`, directus_files_id, sort)
     SELECT id, \`${parentField}\`, directus_files_id, sort FROM \`${table}\``
  );

  const before = await get(db, `SELECT COUNT(*) AS n FROM \`${table}\``);
  const after = await get(db, `SELECT COUNT(*) AS n FROM \`${tmp}\``);
  if (before.n !== after.n) {
    throw new Error(`${table} : ${before.n} lignes avant, ${after.n} après — copie incomplète`);
  }

  await run(db, `DROP TABLE \`${table}\``);
  await run(db, `ALTER TABLE \`${tmp}\` RENAME TO \`${table}\``);

  console.log(`  ✓ ${table} → CASCADE (${after.n} ligne${after.n > 1 ? 's' : ''} conservée${after.n > 1 ? 's' : ''})`);
  return true;
}

/**
 * Reconstruit la table products avec ON DELETE SET NULL sur category et brand.
 * Les colonnes sont recopiées dynamiquement pour ne dépendre d'aucun schéma figé.
 */
async function rebuildProducts(db) {
  const cols = await all(db, `PRAGMA table_info(products)`);
  if (!cols.length) {
    console.log('  · products : absente, ignorée');
    return;
  }

  const defs = cols.map((c) => {
    if (c.name === 'id') return '`id` CHAR(36) PRIMARY KEY';
    if (c.name === 'category') return '`category` CHAR(36) REFERENCES categories(id) ON DELETE SET NULL';
    if (c.name === 'brand') return '`brand` CHAR(36) REFERENCES brands(id) ON DELETE SET NULL';

    let def = `\`${c.name}\` ${c.type || 'TEXT'}`;
    if (c.notnull) def += ' NOT NULL';
    if (c.dflt_value !== null && c.dflt_value !== undefined) def += ` DEFAULT ${c.dflt_value}`;
    return def;
  });

  const names = cols.map((c) => `\`${c.name}\``).join(', ');

  await run(db, `DROP TABLE IF EXISTS products__new`);
  await run(db, `CREATE TABLE products__new (${defs.join(', ')})`);
  await run(db, `INSERT INTO products__new (${names}) SELECT ${names} FROM products`);

  const before = await get(db, `SELECT COUNT(*) AS n FROM products`);
  const after = await get(db, `SELECT COUNT(*) AS n FROM products__new`);
  if (before.n !== after.n) {
    throw new Error(`products : ${before.n} lignes avant, ${after.n} après — copie incomplète`);
  }

  await run(db, `DROP TABLE products`);
  await run(db, `ALTER TABLE products__new RENAME TO products`);

  console.log(`  ✓ products → SET NULL sur category et brand (${after.n} produits conservés)`);
}

// --- Exécution -------------------------------------------------------------

async function main() {
  // Refus d'exécution si Directus tourne encore : il garderait le fichier
  // ouvert et pourrait réécrire par-dessus nos modifications.
  try {
    const res = await fetch('http://127.0.0.1:8055/server/health', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      console.error('✗ Directus est en cours d\'exécution. Arrêtez-le avant de lancer ce script.');
      process.exit(1);
    }
  } catch {
    /* injoignable = arrêté, c'est ce qu'on veut */
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backup = `data.db.backup-${stamp}`;
  fs.copyFileSync(DB_PATH, backup);
  console.log(`Sauvegarde : ${backup}\n`);

  const db = await open();

  try {
    // Les contraintes sont désactivées le temps de la reconstruction, sans
    // quoi la copie des données déclencherait des violations temporaires.
    await run(db, 'PRAGMA foreign_keys = OFF');
    await run(db, 'BEGIN IMMEDIATE');

    console.log('— Galeries : CASCADE —');
    for (const [table, field, parent] of JUNCTIONS) {
      await rebuildJunction(db, table, field, parent);
    }

    console.log('\n— Rattachements : SET NULL —');
    await rebuildProducts(db);

    // Contrôle d'intégrité AVANT validation : s'il reste la moindre
    // référence orpheline, on annule tout.
    const violations = await all(db, 'PRAGMA foreign_key_check');
    if (violations.length) {
      throw new Error(`${violations.length} violation(s) de clé étrangère détectée(s)`);
    }

    await run(db, 'COMMIT');
    await run(db, 'PRAGMA foreign_keys = ON');
    console.log('\n✓ Transaction validée, intégrité vérifiée.');
  } catch (err) {
    await run(db, 'ROLLBACK').catch(() => {});
    console.error('\n✗ Échec, annulation complète :', err.message);
    console.error(`  La base est inchangée. Sauvegarde disponible : ${backup}`);
    db.close();
    process.exit(1);
  }

  // --- Vérification finale des règles réellement enregistrées ---
  console.log('\n— Règles enregistrées en base —');
  for (const [table] of JUNCTIONS) {
    const fks = await all(db, `PRAGMA foreign_key_list(\`${table}\`)`);
    const rules = fks.map((f) => `${f.from}→${f.table}:${f.on_delete}`).join('  ');
    console.log(`  ${table.padEnd(20)} ${rules}`);
  }
  const pfks = await all(db, `PRAGMA foreign_key_list(products)`);
  console.log(`  ${'products'.padEnd(20)} ${pfks.map((f) => `${f.from}→${f.table}:${f.on_delete}`).join('  ')}`);

  db.close();
  console.log('\n✓ Terminé. Redémarrez Directus.');
}

main().catch((err) => {
  console.error('\n✗ Erreur inattendue :', err.message);
  process.exit(1);
});
