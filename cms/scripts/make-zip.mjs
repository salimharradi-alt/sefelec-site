/**
 * SEFELEC — Création de l'archive à téléverser sur Nindohost
 * ===========================================================
 * Rassemble uniquement les fichiers du site public dans une archive ZIP
 * prête à être envoyée dans public_html via le Gestionnaire de fichiers
 * de cPanel.
 *
 * Sont volontairement exclus : le back-office (cms/), les outils (tools/),
 * la base de données, les scripts et la configuration de développement.
 *
 * Usage : node scripts/make-zip.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SITE_ROOT = path.resolve('..');
const OUT = path.join(SITE_ROOT, 'sefelec-a-televerser.zip');

/**
 * Contenu du site public : ces éléments seuls partent en ligne.
 * robots.txt et sitemap.xml sont indispensables au référencement —
 * sans eux, Google ne peut ni vérifier le site ni recevoir le plan.
 */
const INCLUDE = [
  'index.html',
  '404.html',
  '.htaccess',
  'robots.txt',
  'sitemap.xml',
  // Réception des demandes de devis : sans ce fichier, le formulaire
  // renvoie une erreur au visiteur.
  'envoi-devis.php',
  'assets'
];

// ---------------------------------------------------------------------------
// Écriture d'un ZIP minimal (format standard, sans dépendance externe)
// ---------------------------------------------------------------------------

const files = [];

function collect(relPath) {
  const abs = path.join(SITE_ROOT, relPath);
  if (!fs.existsSync(abs)) {
    console.warn(`  ! introuvable, ignoré : ${relPath}`);
    return;
  }
  const stat = fs.statSync(abs);

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(abs)) {
      collect(path.join(relPath, entry));
    }
  } else {
    files.push({
      name: relPath.split(path.sep).join('/'), // le ZIP exige des «/»
      data: fs.readFileSync(abs)
    });
  }
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function buildZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const raw = entry.data;
    const compressed = zlib.deflateRawSync(raw, { level: 9 });

    // Le ZIP n'accepte la compression que si elle réduit réellement la taille
    const useDeflate = compressed.length < raw.length;
    const body = useDeflate ? compressed : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version requise
    local.writeUInt16LE(0x0800, 6); // noms de fichiers en UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); // heure
    local.writeUInt16LE(0, 12); // date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);

    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, centralBuf, end]);
}

// ---------------------------------------------------------------------------

console.log('→ Préparation de l\'archive à téléverser\n');

// Garde-fou : sans contenu généré, le site s'afficherait vide en ligne.
if (!fs.existsSync(path.join(SITE_ROOT, 'assets', 'data', 'content.json'))) {
  console.error('✗ assets/data/content.json est absent.');
  console.error('  Lancez d\'abord « npm run build » avec le back-office démarré.');
  process.exit(1);
}

INCLUDE.forEach(collect);

const zip = buildZip(files);
fs.writeFileSync(OUT, zip);

console.log(`  ${files.length} fichiers rassemblés`);
console.log(`\n✓ Archive créée : ${path.basename(OUT)} (${(zip.length / 1024).toFixed(0)} Ko)`);
console.log(`  Emplacement : ${OUT}`);
console.log('\nÀ téléverser dans public_html/ via le Gestionnaire de fichiers cPanel,');
console.log('puis à extraire sur place (clic droit → Extract).');
