/**
 * SEFELEC — Archive du tableau de bord à téléverser
 * ==================================================
 * Rassemble ce qui doit partir sur l'hébergement pour faire tourner le
 * back-office : le point d'entrée, la liste des dépendances, la base de
 * données et les images d'origine.
 *
 * node_modules est volontairement exclu : environ 900 Mo et des dizaines
 * de milliers de fichiers, que le FTP mettrait des heures à transférer.
 * cPanel les réinstalle sur place en quelques minutes (« Run NPM Install »).
 *
 * Le fichier .env est exclu lui aussi : il contient les clés de votre
 * machine et impose un port qui casserait l'installation en ligne. Un
 * modèle commenté part à sa place (.env.production.example).
 *
 * Usage : node scripts/make-zip-admin.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CMS_ROOT = path.resolve('.');
const OUT = path.resolve('..', 'sefelec-dashboard-a-televerser.zip');

/** Ce qui part sur l'hébergement. */
const INCLURE = [
  'app.js',
  'package.json',
  'data.db',
  'uploads',
  'scripts',
  '.env.production.example'
];

/** Ce qui ne doit jamais partir, même s'il se trouve dans les dossiers ci-dessus. */
const EXCLURE = [/(^|[\\/])\.env$/, /node_modules/, /\.db\.backup-/, /(^|[\\/])\.git/];

const fichiers = [];

function collecter(rel) {
  const abs = path.join(CMS_ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.warn(`  ! introuvable, ignoré : ${rel}`);
    return;
  }
  if (EXCLURE.some((r) => r.test(rel))) return;

  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    for (const e of fs.readdirSync(abs)) collecter(path.join(rel, e));
  } else {
    fichiers.push({ name: rel.split(path.sep).join('/'), data: fs.readFileSync(abs) });
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

function construireZip(entrees) {
  const morceaux = [];
  const central = [];
  let offset = 0;

  for (const entree of entrees) {
    const nom = Buffer.from(entree.name, 'utf8');
    const brut = entree.data;
    const compresse = zlib.deflateRawSync(brut, { level: 9 });
    const utiliserDeflate = compresse.length < brut.length;
    const corps = utiliserDeflate ? compresse : brut;
    const methode = utiliserDeflate ? 8 : 0;
    const crc = crc32(brut);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(methode, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(corps.length, 18);
    local.writeUInt32LE(brut.length, 22);
    local.writeUInt16LE(nom.length, 26);
    morceaux.push(local, nom, corps);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(methode, 10);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(corps.length, 20);
    cd.writeUInt32LE(brut.length, 24);
    cd.writeUInt16LE(nom.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nom);

    offset += local.length + nom.length + corps.length;
  }

  const centralBuf = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(centralBuf.length, 12);
  fin.writeUInt32LE(offset, 16);

  return Buffer.concat([...morceaux, centralBuf, fin]);
}

console.log('\n→ Archive du tableau de bord\n');

INCLURE.forEach(collecter);

// Garde-fou : un .env réel dans l'archive exposerait vos clés.
const fuite = fichiers.find((f) => /(^|\/)\.env$/.test(f.name));
if (fuite) {
  console.error('✗ Le fichier .env s\'est glissé dans l\'archive. Arrêt.');
  process.exit(1);
}

const zip = construireZip(fichiers);
fs.writeFileSync(OUT, zip);

const base = fichiers.find((f) => f.name === 'data.db');
console.log(`  ${fichiers.length} fichiers rassemblés`);
console.log(`  dont la base de données : ${base ? (base.data.length / 1024 / 1024).toFixed(1) + ' Mo' : 'ABSENTE'}`);
console.log(`\n✓ ${path.basename(OUT)} (${(zip.length / 1024 / 1024).toFixed(1)} Mo)`);
console.log(`  ${OUT}`);
console.log('\nÀ extraire dans le dossier du sous-domaine (hors public_html),');
console.log('puis « Run NPM Install » depuis Setup Node.js App.\n');
