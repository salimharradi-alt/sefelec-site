/**
 * SEFELEC — Règles de suppression des relations
 * ==============================================
 * Corrige l'erreur « SQLITE_CONSTRAINT: FOREIGN KEY constraint failed »
 * survenant à la suppression d'un élément référencé ailleurs.
 *
 * Toutes les clés étrangères étaient en NO ACTION : la base refusait de
 * supprimer un parent tant qu'un enfant le référençait. Deux stratégies sont
 * appliquées selon le sens de la relation :
 *
 *   CASCADE  — tables de liaison des galeries. Supprimer un produit doit
 *              supprimer ses lignes de liaison. Les images elles-mêmes
 *              restent dans la bibliothèque : seul le lien disparaît.
 *              De même, retirer une image de la bibliothèque la retire
 *              automatiquement de toutes les galeries.
 *
 *   SET NULL — rattachements métier (catégorie, marque). Supprimer une
 *              catégorie ne doit surtout pas supprimer ses produits : ils
 *              deviennent simplement « sans catégorie ».
 *
 * Usage :  node scripts/fix-delete-rules.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const env = Object.fromEntries(
  fs
    .readFileSync(path.resolve('.env'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const BASE = 'http://localhost:5500';
let token = null;

async function api(method, endpoint, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    throw new Error(`${method} ${endpoint} → ${res.status} : ${json?.errors?.[0]?.message || text}`);
  }
  return json?.data ?? json;
}

/** Applique une règle ON DELETE à une relation existante. */
async function setOnDelete(collection, field, rule) {
  await api('PATCH', `/relations/${collection}/${field}`, {
    schema: { on_delete: rule }
  });
  console.log(`  ✓ ${collection}.${field} → ${rule}`);
}

async function main() {
  const auth = await api('POST', '/auth/login', {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD
  });
  token = auth.access_token;
  console.log('✓ Authentifié\n');

  const relations = (await api('GET', '/relations')).filter(
    (r) => !r.collection.startsWith('directus_')
  );

  // --- 1. Tables de liaison des galeries → CASCADE dans les deux sens ---
  console.log('— Galeries : suppression en cascade des liens —');
  const junctions = relations.filter((r) => r.collection.endsWith('_files'));

  for (const rel of junctions) {
    try {
      await setOnDelete(rel.collection, rel.field, 'CASCADE');
    } catch (err) {
      console.log(`  ! ${rel.collection}.${rel.field} : ${err.message.slice(0, 100)}`);
    }
  }

  // --- 2. Rattachements métier → SET NULL ---
  console.log('\n— Rattachements : conservation des éléments enfants —');
  const businessLinks = relations.filter(
    (r) => !r.collection.endsWith('_files') && r.related_collection
  );

  for (const rel of businessLinks) {
    try {
      await setOnDelete(rel.collection, rel.field, 'SET NULL');
    } catch (err) {
      console.log(`  ! ${rel.collection}.${rel.field} : ${err.message.slice(0, 100)}`);
    }
  }

  // --- 3. Contrôle final ---
  console.log('\n— Vérification —');
  const after = (await api('GET', '/relations')).filter(
    (r) => !r.collection.startsWith('directus_')
  );
  const remaining = after.filter((r) => !r.schema?.on_delete || r.schema.on_delete === 'NO ACTION');

  if (remaining.length === 0) {
    console.log(`  ✓ Les ${after.length} relations ont une règle de suppression définie.`);
  } else {
    console.log(`  ! ${remaining.length} relation(s) encore en NO ACTION :`);
    remaining.forEach((r) => console.log(`      ${r.collection}.${r.field}`));
  }
}

main().catch((err) => {
  console.error('\n✗ Échec :', err.message);
  process.exit(1);
});
