/**
 * SEFELEC — Section « Nos partenaires »
 * ======================================
 * Complète la collection « partners », déjà créée par setup-media.mjs,
 * pour qu'elle pilote entièrement la section du site.
 *
 * Deux ajouts, et la raison de chacun :
 *
 *  1. Un préréglage d'image « logo ». Les préréglages existants
 *     (miniature, carte) recadrent en « cover » : un logo large y serait
 *     rogné, un logo carré étiré. « inside » conserve les proportions
 *     d'origine et se contente de réduire.
 *
 *  2. Un champ « image_alt », pour décrire le logo aux personnes non
 *     voyantes et aux moteurs de recherche.
 *
 * Le script est idempotent : relancé, il ne recrée rien en double.
 *
 * Usage :  node scripts/setup-partenaires.mjs
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
  if (!res.ok) {
    const e = new Error(`${method} ${endpoint} → ${res.status}`);
    e.detail = texte;
    e.status = res.status;
    throw e;
  }
  return texte ? JSON.parse(texte).data : null;
}

/**
 * Préréglage réservé aux logos.
 *
 * « inside » : l'image est réduite pour tenir dans la boîte sans jamais
 * être recadrée ni étirée. Un logo horizontal reste horizontal.
 * « withoutEnlargement » évite d'agrandir un petit logo, ce qui le
 * rendrait flou.
 * Le WebP conserve la transparence, indispensable pour un logo posé sur
 * fond clair.
 */
const PRESET_LOGO = {
  key: 'logo',
  fit: 'inside',
  width: 400,
  height: 200,
  quality: 88,
  withoutEnlargement: true,
  format: 'webp'
};

async function assurerChamp(collection, champ, definition) {
  try {
    await api('POST', `/fields/${collection}`, { field: champ, ...definition });
    return 'créé';
  } catch (e) {
    if (e.status === 400 && /exist/i.test(e.detail || '')) return 'présent';
    throw e;
  }
}

async function main() {
  console.log('\n→ Section « Nos partenaires »\n');

  const auth = await api('POST', '/auth/login', {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD
  });
  token = auth.access_token;

  // --- 1. Préréglage d'image ---
  const reglages = await api('GET', '/settings?fields=storage_asset_presets');
  const presets = reglages.storage_asset_presets || [];

  if (presets.some((p) => p.key === 'logo')) {
    console.log('  = préréglage « logo » déjà présent');
  } else {
    // On repart de la liste existante : un PATCH la remplace en entier,
    // écraser les autres préréglages casserait les images du catalogue.
    await api('PATCH', '/settings', {
      storage_asset_presets: [...presets, PRESET_LOGO]
    });
    console.log('  + préréglage « logo » ajouté (400×200, sans recadrage)');
  }

  // --- 2. Champs ---
  const champs = {
    image_alt: {
      type: 'string',
      meta: {
        interface: 'input',
        note: 'Description du logo. Laissé vide, le site écrit « Logo <nom> — partenaire de SEFELEC ».',
        options: { placeholder: 'Logo Untel — partenaire de SEFELEC' }
      },
      schema: {}
    }
  };
  for (const [champ, definition] of Object.entries(champs)) {
    console.log(`  ${champ} : ${await assurerChamp('partners', champ, definition)}`);
  }

  // --- 3. Notes d'aide sur les champs existants ---
  // Elles évitent les deux erreurs les plus probables : inventer une
  // adresse de site, et publier un partenaire sans logo.
  const notes = {
    name: 'Nom exact du partenaire, tel qu\'il s\'écrit officiellement.',
    logo: 'Logo au format PNG transparent de préférence. Il sera redimensionné sans être déformé.',
    website:
      'Adresse du site OFFICIEL du partenaire, avec https://. Laissez vide si vous n\'en connaissez pas : le logo s\'affichera alors sans lien. N\'inventez jamais une adresse.',
    description: 'Courte phrase facultative, affichée sous le nom.',
    sort: 'Ordre d\'affichage sur le site. Le plus petit nombre apparaît en premier.',
    status: 'Seuls les partenaires « published » apparaissent sur le site.'
  };

  for (const [champ, note] of Object.entries(notes)) {
    try {
      await api('PATCH', `/fields/partners/${champ}`, { meta: { note } });
    } catch {
      // Un champ absent n'est pas bloquant : setup-media.mjs les crée.
    }
  }
  console.log('  notes d\'aide renseignées sur les champs');

  // --- 4. Contrôle ---
  const existants = await api('GET', '/items/partners?fields=id,name,status&limit=-1');
  console.log(`\n✓ Collection prête — ${existants.length} partenaire(s) enregistré(s).`);

  if (!existants.length) {
    console.log('\n  Pour en ajouter :');
    console.log('   1. http://localhost:5500/admin  →  Partenaires  →  Créer');
    console.log('   2. Renseignez le nom, téléversez le logo, et l\'adresse du');
    console.log('      site officiel si vous la connaissez');
    console.log('   3. Passez le statut sur « published »');
    console.log('   4. Lancez publier.cmd');
    console.log('\n  Tant qu\'aucun partenaire n\'est publié, la section reste');
    console.log('  masquée sur le site : aucune zone vide n\'apparaît.');
  }
  console.log('');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  if (e.detail) console.error(e.detail.slice(0, 400));
  process.exit(1);
});
