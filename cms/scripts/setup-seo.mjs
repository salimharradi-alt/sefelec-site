/**
 * SEFELEC — Champs SEO et adresses des pages
 * ===========================================
 * Ajoute aux services, produits et catégories les champs nécessaires aux
 * pages dédiées : adresse courte (slug), titre et description pour les
 * moteurs, mots-clés, texte alternatif des images.
 *
 * Tous sont modifiables depuis le tableau de bord : c'est ce qui permet
 * de piloter le référencement sans toucher au code.
 *
 * Le script est idempotent : relancé, il complète sans écraser ce que
 * vous auriez saisi à la main.
 *
 * Usage :  node scripts/setup-seo.mjs
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
 * Fabrique une adresse courte : accents retirés, minuscules, tirets.
 * « Étude & réalisation MT/BT » → « etude-realisation-mt-bt »
 */
export function versSlug(texte) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marques d'accentuation isolées par NFD
    .replace(/['’]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Adresses imposées pour les services.
 *
 * Les noms complets donneraient des adresses interminables — par exemple
 * « conception-et-realisation-d-armoires-electriques ». Or une adresse
 * courte est à la fois plus lisible et meilleure pour le référencement.
 */
const SLUGS_SERVICES = {
  'Conception et réalisation d\'armoires électriques': 'armoires-electriques',
  'Automatisme industriel': 'automatisme-industriel',
  'Étude et réalisation des travaux d\'électricité MT/BT': 'electricite-mt-bt',
  'Installation électrique industrielle': 'installation-electrique',
  'Mise en conformité des installations': 'mise-en-conformite'
};

const CHAMPS_SEO = {
  slug: {
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Adresse de la page. Minuscules et tirets uniquement, sans accent. Modifier cette valeur change l\'adresse publique.',
      width: 'half'
    },
    schema: { is_unique: true }
  },
  seo_title: {
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Titre affiché dans les résultats de recherche. Environ 60 caractères. Laissé vide, il est composé automatiquement.',
      options: { placeholder: 'Armoires électriques sur mesure — SEFELEC Casablanca' }
    },
    schema: {}
  },
  seo_description: {
    type: 'text',
    meta: {
      interface: 'input-multiline',
      note: 'Résumé affiché sous le titre dans les résultats. Environ 155 caractères. Doit être unique pour chaque page.'
    },
    schema: {}
  },
  keywords: {
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Mots-clés séparés par des virgules. Restez naturel : une accumulation est pénalisée.'
    },
    schema: {}
  },
  image_alt: {
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Description de l\'image pour les personnes non voyantes et pour les moteurs de recherche.'
    },
    schema: {}
  }
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
  console.log('\n→ Préparation des champs SEO\n');

  const auth = await api('POST', '/auth/login', {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD
  });
  token = auth.access_token;

  // --- 1. Champs ---
  for (const collection of ['services', 'products', 'categories']) {
    const resultats = [];
    for (const [champ, definition] of Object.entries(CHAMPS_SEO)) {
      // Les catégories possèdent déjà leur adresse courte.
      if (collection === 'categories' && champ === 'slug') continue;
      resultats.push(`${champ}:${await assurerChamp(collection, champ, definition)}`);
    }
    console.log(`  ${collection.padEnd(12)} ${resultats.join('  ')}`);
  }

  // Sections facultatives de la fiche produit. Laissées vides, elles ne
  // s'affichent pas : mieux vaut une fiche courte qu'un texte inventé.
  for (const [champ, note] of Object.entries({
    applications: 'Cas d\'usage de ce produit. Une ligne par point, préfixée de « - ». Vide, la section n\'apparaît pas.',
    avantages: 'Points forts de ce produit. Une ligne par point. Vide, la section n\'apparaît pas.'
  })) {
    console.log(
      `  products     ${champ}:${await assurerChamp('products', champ, {
        type: 'text',
        meta: { interface: 'input-multiline', note },
        schema: {}
      })}`
    );
  }

  // La page catégorie a besoin d'un texte d'introduction propre.
  console.log(
    `  categories   description:${await assurerChamp('categories', 'description', {
      type: 'text',
      meta: {
        interface: 'input-multiline',
        note: 'Texte d\'introduction affiché en haut de la page de la catégorie.'
      },
      schema: {}
    })}`
  );

  // --- 2. Adresses des services ---
  console.log('\n— Adresses des services —');
  const services = await api('GET', '/items/services?fields=id,name,slug&limit=-1');
  for (const s of services) {
    // Les adresses de la liste canonique sont imposées, même si une
    // valeur existe déjà : elles ont été choisies courtes à dessein, et
    // une génération automatique redonnerait des adresses à rallonge.
    const voulu = SLUGS_SERVICES[s.name] || s.slug || versSlug(s.name);

    if (s.slug === voulu) {
      console.log(`  = ${voulu}`);
      continue;
    }
    await api('PATCH', `/items/services/${s.id}`, { slug: voulu });
    console.log(`  ${s.slug ? '~' : '+'} ${voulu}${s.slug ? `   (était ${s.slug})` : ''}`);
  }

  // --- 3. Adresses des produits ---
  console.log('\n— Adresses des produits —');
  const produits = await api('GET', '/items/products?fields=id,name,ref,slug&limit=-1');
  const pris = new Set(produits.map((p) => p.slug).filter(Boolean));

  for (const p of produits) {
    if (p.slug) {
      console.log(`  = ${p.slug}`);
      continue;
    }
    let slug = versSlug(p.name);
    // Deux produits peuvent porter le même nom : la référence les départage.
    if (pris.has(slug)) slug = `${slug}-${versSlug(p.ref)}`;
    pris.add(slug);

    await api('PATCH', `/items/products/${p.id}`, { slug });
    console.log(`  + ${slug}`);
  }

  console.log('\n✓ Modèle prêt. Lancez « npm run build ».\n');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  if (e.detail) console.error(e.detail.slice(0, 400));
  process.exit(1);
});
