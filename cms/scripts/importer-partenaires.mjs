/**
 * SEFELEC — Import des logos de partenaires
 * ==========================================
 * Téléverse les logos fournis par le client dans la médiathèque du
 * tableau de bord, puis crée les fiches partenaires correspondantes.
 *
 * Les fichiers sont utilisés tels quels : aucune image n'est générée ni
 * récupérée sur Internet. Le seul traitement est le redimensionnement
 * appliqué par le préréglage « logo » au moment du build, qui conserve
 * les proportions.
 *
 * Le script est idempotent : un partenaire déjà présent est mis à jour,
 * pas dupliqué.
 *
 * Usage :  node scripts/importer-partenaires.mjs
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

const BASE = `http://127.0.0.1:${env.PORT || 8055}`;
const DOSSIER = path.resolve('..', '..', 'client sefelec');
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
  const texte = await res.text();
  if (!res.ok) throw new Error(`${method} ${endpoint} → ${res.status}\n${texte.slice(0, 300)}`);
  return texte ? JSON.parse(texte).data : null;
}

/**
 * Les cinq partenaires fournis.
 *
 * « website » n'est renseigné que pour les adresses officielles
 * réellement vérifiées (réponse HTTP 200 sur le domaine de l'entreprise).
 * Les autres restent vides : le logo s'affichera sans lien, ce qui vaut
 * mieux qu'une adresse devinée. Elles pourront être ajoutées depuis le
 * tableau de bord le jour où elles seront connues.
 */
const PARTENAIRES = [
  {
    fichier: 'client Sefelec 3.jpeg',
    name: 'BUTEC',
    website: 'https://www.butec.com',
    sort: 1
  },
  {
    fichier: 'client Sefelec 2.jpeg',
    name: 'Cegelec',
    // Marque du groupe VINCI Energies, sans site mondial unique :
    // chaque entité a le sien. Aucune adresse retenue faute de savoir
    // laquelle correspond.
    website: '',
    sort: 2
  },
  {
    fichier: 'client Sefelec.jpeg',
    name: 'Mondelēz International',
    website: 'https://www.mondelezinternational.com',
    sort: 3
  },
  {
    fichier: 'client Sefelec.jpg',
    name: 'PLASTIMA',
    // plastima.com et plastima.ma ne répondent pas : aucune adresse
    // officielle vérifiable au moment de l'import.
    website: '',
    sort: 4
  },
  {
    fichier: 'client Sefelec 1.jpeg',
    name: 'Siemens Healthineers',
    website: 'https://www.siemens-healthineers.com',
    sort: 5
  }
];

async function televerser(cheminFichier, titre) {
  const donnees = fs.readFileSync(cheminFichier);
  const extension = path.extname(cheminFichier).toLowerCase();
  const type = extension === '.png' ? 'image/png' : 'image/jpeg';

  const form = new FormData();
  form.append('title', titre);
  form.append('file', new Blob([donnees], { type }), path.basename(cheminFichier));

  const res = await fetch(`${BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  if (!res.ok) throw new Error(`téléversement → ${res.status}\n${(await res.text()).slice(0, 300)}`);
  return (await res.json()).data.id;
}

async function main() {
  console.log('\n→ Import des logos de partenaires\n');
  console.log(`  Source : ${DOSSIER}\n`);

  token = (
    await api('POST', '/auth/login', { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
  ).access_token;

  const existants = await api('GET', '/items/partners?fields=id,name,logo&limit=-1');
  const parNom = new Map(existants.map((p) => [p.name, p]));

  for (const partenaire of PARTENAIRES) {
    const chemin = path.join(DOSSIER, partenaire.fichier);
    if (!fs.existsSync(chemin)) {
      console.error(`  ✗ fichier introuvable : ${partenaire.fichier}`);
      continue;
    }

    const donnees = {
      name: partenaire.name,
      website: partenaire.website,
      // Renseigné explicitement plutôt que laissé au repli automatique :
      // il porte le nom exact, accents compris.
      image_alt: `Logo ${partenaire.name} — partenaire de SEFELEC`,
      sort: partenaire.sort,
      status: 'published'
    };

    const actuel = parNom.get(partenaire.name);
    if (actuel) {
      if (!actuel.logo) donnees.logo = await televerser(chemin, partenaire.name);
      await api('PATCH', `/items/partners/${actuel.id}`, donnees);
      console.log(`  ~ ${partenaire.name}`);
    } else {
      donnees.logo = await televerser(chemin, partenaire.name);
      await api('POST', '/items/partners', donnees);
      console.log(
        `  + ${partenaire.name.padEnd(24)}${partenaire.website || '(sans lien)'}`
      );
    }
  }

  const final = await api(
    'GET',
    '/items/partners?fields=name,website,sort,status&sort=sort&limit=-1'
  );
  console.log(`\n✓ ${final.length} partenaire(s) publié(s) :`);
  final.forEach((p) =>
    console.log(`    ${p.sort}. ${p.name.padEnd(24)}${p.website || '—'}`)
  );
  console.log('\nLancez « npm run build » pour les faire apparaître sur le site.\n');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
