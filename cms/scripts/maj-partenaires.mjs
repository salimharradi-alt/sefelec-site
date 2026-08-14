/**
 * SEFELEC — Mise à jour des logos et des liens partenaires
 * =========================================================
 * Remplace le logo d'un partenaire par sa version nettoyée et renseigne
 * les adresses officielles fournies par le client.
 *
 * Les fichiers nettoyés proviennent des originaux du client : bandes
 * grises de capture retirées, badge d'interface effacé quand cela était
 * possible sans toucher au logo, sortie en PNG sans nouvelle perte.
 * Aucune image n'est générée ni téléchargée.
 *
 * Le script est idempotent : relancé, il met à jour sans dupliquer.
 *
 * Usage :  node scripts/maj-partenaires.mjs
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
const NETTOYES = path.resolve('..', '..', 'client sefelec', 'nettoyes');
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
 * Réglages par partenaire.
 *
 * « fichier » : version nettoyée à installer, si elle existe.
 * « website » : adresse fournie par le client. Elle n'est écrite que si
 *   elle répond réellement — un lien mort vaut moins que pas de lien.
 */
const MISES_A_JOUR = [
  { name: 'BUTEC', fichier: 'BUTEC.png' },
  { name: 'Cegelec', fichier: 'Cegelec-officiel.png', website: 'https://www.cegelec-cem.fr/' },
  { name: 'Mondelēz International', fichier: 'Mondelez International.png' },
  { name: 'PLASTIMA', fichier: 'PLASTIMA.png', website: 'https://plastimacanalisations.com/' },
  { name: 'Siemens Healthineers', fichier: 'Siemens Healthineers.png' }
];

async function televerser(cheminFichier, titre) {
  const donnees = fs.readFileSync(cheminFichier);
  const form = new FormData();
  form.append('title', titre);
  form.append('file', new Blob([donnees], { type: 'image/png' }), path.basename(cheminFichier));

  const res = await fetch(`${BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  if (!res.ok) throw new Error(`téléversement → ${res.status}\n${(await res.text()).slice(0, 300)}`);
  return (await res.json()).data.id;
}

/** Une adresse n'est retenue que si le site répond. */
async function adresseValide(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log('\n→ Mise à jour des partenaires\n');

  token = (
    await api('POST', '/auth/login', { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
  ).access_token;

  const partenaires = await api('GET', '/items/partners?fields=id,name,logo,website&limit=-1');
  const parNom = new Map(partenaires.map((p) => [p.name, p]));

  for (const maj of MISES_A_JOUR) {
    const actuel = parNom.get(maj.name);
    if (!actuel) {
      console.warn(`  ! ${maj.name} : absent de la base`);
      continue;
    }

    const changements = {};
    const notes = [];

    // --- Logo ---
    const chemin = path.join(NETTOYES, maj.fichier);
    if (fs.existsSync(chemin)) {
      const ancien = actuel.logo;
      changements.logo = await televerser(chemin, maj.name);
      notes.push('logo remplacé');
      // L'ancien fichier n'a plus d'usage : on libère l'espace.
      if (ancien) {
        try { await api('DELETE', `/files/${ancien}`); } catch { /* déjà absent */ }
      }
    } else {
      notes.push('logo inchangé (fichier nettoyé absent)');
    }

    // --- Adresse officielle ---
    if (maj.website) {
      if (await adresseValide(maj.website)) {
        changements.website = maj.website;
        notes.push(`lien → ${maj.website}`);
      } else {
        notes.push(`lien ignoré, sans réponse : ${maj.website}`);
      }
    }

    if (Object.keys(changements).length) {
      await api('PATCH', `/items/partners/${actuel.id}`, changements);
    }
    console.log(`  ${maj.name.padEnd(24)} ${notes.join('  |  ')}`);
  }

  const final = await api('GET', '/items/partners?fields=name,website,sort&sort=sort&limit=-1');
  console.log('\n✓ État final :');
  final.forEach((p) => console.log(`    ${p.sort}. ${p.name.padEnd(24)}${p.website || '—'}`));
  console.log('\nLancez « npm run build ».\n');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
