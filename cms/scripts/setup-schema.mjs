/**
 * SEFELEC — Création du modèle de données Directus
 * ------------------------------------------------
 * Crée les collections (catégories, produits, services, témoignages,
 * paramètres du site) avec leurs champs, puis configure le tri par
 * glisser-déposer et l'archivage.
 *
 * Usage :  node scripts/setup-schema.mjs
 * Prérequis : Directus démarré sur PUBLIC_URL, .env renseigné.
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------- Chargement de la configuration ----------
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

const BASE = env.PUBLIC_URL || 'http://localhost:8055';

// ---------- Client API minimal ----------
let token = null;

async function api(method, endpoint, body, isMultipart = false) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isMultipart) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers,
    body: isMultipart ? body : body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* réponse non-JSON */
  }

  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || text || res.statusText;
    const err = new Error(`${method} ${endpoint} → ${res.status} : ${msg}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json?.data ?? json;
}

async function login() {
  const data = await api('POST', '/auth/login', {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD
  });
  token = data.access_token;
  console.log('✓ Authentifié en tant que', env.ADMIN_EMAIL);
}

/** Crée une collection si elle n'existe pas déjà (idempotent). */
async function ensureCollection(collection, meta = {}, fields = []) {
  try {
    await api('GET', `/collections/${collection}`);
    console.log(`• ${collection} : existe déjà, ignorée`);
    return false;
  } catch (err) {
    if (err.status !== 403 && err.status !== 404) throw err;
  }

  await api('POST', '/collections', {
    collection,
    meta: { singleton: false, ...meta },
    schema: { name: collection },
    fields: [
      {
        field: 'id',
        type: 'uuid',
        // `special: ['uuid']` demande à Directus de générer l'UUID à l'insertion.
        meta: { hidden: true, readonly: true, interface: 'input', special: ['uuid'] },
        schema: { is_primary_key: true, has_auto_increment: false }
      },
      ...fields
    ]
  });
  console.log(`✓ Collection créée : ${collection}`);
  return true;
}

/** Ajoute un champ s'il n'existe pas (idempotent). */
async function ensureField(collection, field, definition) {
  try {
    await api('GET', `/fields/${collection}/${field}`);
    return false;
  } catch (err) {
    if (err.status !== 403 && err.status !== 404) throw err;
  }
  await api('POST', `/fields/${collection}`, { field, ...definition });
  console.log(`  ↳ champ ${collection}.${field}`);
  return true;
}

// ---------- Fabriques de champs réutilisables ----------
const F = {
  string: (opts = {}) => ({
    type: 'string',
    meta: { interface: 'input', width: 'half', ...opts.meta },
    schema: { is_nullable: opts.required !== true }
  }),
  text: (opts = {}) => ({
    type: 'text',
    meta: { interface: 'input-multiline', width: 'full', ...opts.meta },
    schema: { is_nullable: true }
  }),
  wysiwyg: () => ({
    type: 'text',
    meta: { interface: 'input-rich-text-html', width: 'full' },
    schema: { is_nullable: true }
  }),
  decimal: (opts = {}) => ({
    type: 'decimal',
    meta: { interface: 'input', width: 'half', ...opts.meta },
    schema: { numeric_precision: 12, numeric_scale: 2, is_nullable: true }
  }),
  integer: (opts = {}) => ({
    type: 'integer',
    meta: { interface: 'input', width: 'half', ...opts.meta },
    schema: { is_nullable: true, default_value: opts.default ?? null }
  }),
  boolean: (opts = {}) => ({
    type: 'boolean',
    meta: { interface: 'boolean', width: 'half', ...opts.meta },
    schema: { default_value: opts.default ?? false, is_nullable: false }
  }),
  json: (opts = {}) => ({
    type: 'json',
    meta: { interface: 'input-code', width: 'full', options: { language: 'json' }, ...opts.meta },
    schema: { is_nullable: true }
  }),
  file: (opts = {}) => ({
    type: 'uuid',
    meta: { interface: 'file-image', width: 'half', special: ['file'], ...opts.meta },
    schema: { is_nullable: true, foreign_key_table: 'directus_files', foreign_key_column: 'id' }
  }),
  /** Statut publié / brouillon / archivé — pilote Masquer/Afficher et Archiver */
  status: () => ({
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      width: 'half',
      options: {
        choices: [
          { text: 'Publié', value: 'published' },
          { text: 'Brouillon', value: 'draft' },
          { text: 'Archivé', value: 'archived' }
        ]
      },
      display: 'labels',
      display_options: {
        showAsDot: true,
        choices: [
          { text: 'Publié', value: 'published', foreground: '#FFFFFF', background: '#2ECDA7' },
          { text: 'Brouillon', value: 'draft', foreground: '#FFFFFF', background: '#A2B5CD' },
          { text: 'Archivé', value: 'archived', foreground: '#FFFFFF', background: '#E35169' }
        ]
      }
    },
    schema: { default_value: 'published', is_nullable: false }
  }),
  /** Champ de tri utilisé par le glisser-déposer de Directus */
  sort: () => ({
    type: 'integer',
    meta: { interface: 'input', hidden: true },
    schema: { is_nullable: true }
  }),
  m2o: (relatedCollection, opts = {}) => ({
    type: 'uuid',
    meta: {
      interface: 'select-dropdown-m2o',
      width: 'half',
      options: { template: '{{name}}' },
      ...opts.meta
    },
    schema: {
      is_nullable: true,
      foreign_key_table: relatedCollection,
      foreign_key_column: 'id'
    }
  })
};

/**
 * Enregistre la relation many-to-one auprès de Directus.
 * Créer le champ ne suffit pas : sans cet enregistrement, l'API ne sait pas
 * résoudre `category.name` et l'interface n'affiche pas le sélecteur.
 */
async function ensureRelation(collection, field, relatedCollection) {
  const relations = await api('GET', '/relations');
  if (relations.some((r) => r.collection === collection && r.field === field)) return false;

  await api('POST', '/relations', {
    collection,
    field,
    related_collection: relatedCollection
  });
  console.log(`  ↳ relation ${collection}.${field} → ${relatedCollection}`);
  return true;
}

/** Champs SEO communs à toutes les collections publiables. */
async function addSeoFields(collection) {
  await ensureField(collection, 'seo_title', F.string({ meta: { note: 'Balise <title> — 60 caractères max' } }));
  await ensureField(collection, 'seo_description', F.text({ meta: { note: 'Meta description — 160 caractères max' } }));
  await ensureField(collection, 'seo_keywords', F.string({ meta: { note: 'Mots-clés séparés par des virgules' } }));
}

/** Champs de gestion communs : statut, tri. */
async function addCommonFields(collection) {
  await ensureField(collection, 'status', F.status());
  await ensureField(collection, 'sort', F.sort());
}

// ---------- Définition du modèle ----------
async function buildSchema() {
  // --- Catégories ---
  await ensureCollection('categories', {
    icon: 'category',
    note: 'Familles de produits',
    display_template: '{{name}}',
    sort_field: 'sort',
    archive_field: 'status',
    archive_value: 'archived',
    unarchive_value: 'draft'
  });
  await ensureField('categories', 'name', F.string({ required: true, meta: { required: true } }));
  await ensureField('categories', 'slug', F.string({ meta: { note: 'Identifiant URL, ex : disjoncteurs' } }));
  await ensureField('categories', 'description', F.text());
  await ensureField('categories', 'image', F.file());
  await ensureField('categories', 'icon', F.string({ meta: { note: 'Nom d\'icône Material, ex : bolt' } }));
  await addCommonFields('categories');
  await addSeoFields('categories');

  // --- Marques ---
  await ensureCollection('brands', {
    icon: 'sell',
    note: 'Marques / fabricants',
    display_template: '{{name}}',
    sort_field: 'sort',
    archive_field: 'status',
    archive_value: 'archived',
    unarchive_value: 'draft'
  });
  await ensureField('brands', 'name', F.string({ required: true, meta: { required: true } }));
  await ensureField('brands', 'logo', F.file());
  await ensureField('brands', 'website', F.string());
  await addCommonFields('brands');

  // --- Produits ---
  await ensureCollection('products', {
    icon: 'inventory_2',
    note: 'Catalogue produits',
    display_template: '{{name}}',
    sort_field: 'sort',
    archive_field: 'status',
    archive_value: 'archived',
    unarchive_value: 'draft'
  });
  await ensureField('products', 'name', F.string({ required: true, meta: { required: true, width: 'full' } }));
  await ensureField('products', 'slug', F.string());
  await ensureField('products', 'ref', F.string({ meta: { note: 'Référence commerciale' } }));
  await ensureField('products', 'sku', F.string({ meta: { note: 'Code SKU interne' } }));
  await ensureField('products', 'description', F.text());
  await ensureField('products', 'category', F.m2o('categories'));
  await ensureField('products', 'brand', F.m2o('brands'));
  await ensureRelation('products', 'category', 'categories');
  await ensureRelation('products', 'brand', 'brands');
  await ensureField('products', 'price', F.decimal({ meta: { note: 'Prix unitaire HT (MAD)' } }));
  await ensureField('products', 'promo_price', F.decimal({ meta: { note: 'Prix promotionnel — laisser vide si aucun' } }));
  await ensureField('products', 'tva', F.decimal({ meta: { note: 'Taux de TVA en %, ex : 20' } }));
  await ensureField('products', 'stock', F.integer({ default: 0 }));
  await ensureField('products', 'image', F.file({ meta: { note: 'Image principale' } }));
  await ensureField('products', 'specs', F.json({ meta: { note: 'Fiche technique — objet clé/valeur' } }));
  await ensureField('products', 'is_featured', F.boolean({ meta: { note: 'Produit vedette' } }));
  await ensureField('products', 'is_popular', F.boolean({ meta: { note: 'Produit populaire' } }));
  await ensureField('products', 'is_promo', F.boolean({ meta: { note: 'Mettre en avant comme promotion' } }));
  await addCommonFields('products');
  await addSeoFields('products');

  // --- Services ---
  await ensureCollection('services', {
    icon: 'engineering',
    note: 'Prestations proposées',
    display_template: '{{name}}',
    sort_field: 'sort',
    archive_field: 'status',
    archive_value: 'archived',
    unarchive_value: 'draft'
  });
  await ensureField('services', 'name', F.string({ required: true, meta: { required: true, width: 'full' } }));
  await ensureField('services', 'slug', F.string());
  await ensureField('services', 'description', F.text());
  await ensureField('services', 'icon_svg', F.text({ meta: { note: 'Code SVG de l\'icône affichée sur le site' } }));
  await ensureField('services', 'image', F.file());
  await addCommonFields('services');
  await addSeoFields('services');

  // --- Témoignages ---
  await ensureCollection('testimonials', {
    icon: 'reviews',
    note: 'Avis clients',
    display_template: '{{name}}',
    sort_field: 'sort',
    archive_field: 'status',
    archive_value: 'archived',
    unarchive_value: 'draft'
  });
  await ensureField('testimonials', 'name', F.string({ required: true, meta: { required: true } }));
  await ensureField('testimonials', 'role', F.string({ meta: { note: 'Fonction et société' } }));
  await ensureField('testimonials', 'quote', F.text());
  await ensureField('testimonials', 'rating', F.integer({ default: 5, meta: { note: 'Note sur 5' } }));
  await addCommonFields('testimonials');

  // --- Pages éditoriales ---
  await ensureCollection('pages', {
    icon: 'article',
    note: 'Pages du site (À propos, FAQ, mentions légales…)',
    display_template: '{{title}}',
    sort_field: 'sort',
    archive_field: 'status',
    archive_value: 'archived',
    unarchive_value: 'draft'
  });
  await ensureField('pages', 'title', F.string({ required: true, meta: { required: true, width: 'full' } }));
  await ensureField('pages', 'slug', F.string({ meta: { note: 'Ex : a-propos, mentions-legales' } }));
  await ensureField('pages', 'content', F.wysiwyg());
  await ensureField('pages', 'hero_image', F.file());
  await addCommonFields('pages');
  await addSeoFields('pages');

  // --- Paramètres du site (singleton) ---
  await ensureCollection('site_settings', {
    icon: 'settings',
    note: 'Coordonnées, identité visuelle et réglages généraux',
    singleton: true
  });
  await ensureField('site_settings', 'site_name', F.string());
  await ensureField('site_settings', 'tagline', F.string());
  await ensureField('site_settings', 'logo', F.file());
  await ensureField('site_settings', 'favicon', F.file());
  await ensureField('site_settings', 'phone_1', F.string());
  await ensureField('site_settings', 'phone_2', F.string());
  await ensureField('site_settings', 'whatsapp', F.string({ meta: { note: 'Numéro au format international, ex : 212705638780' } }));
  await ensureField('site_settings', 'email', F.string());
  await ensureField('site_settings', 'address', F.text());
  await ensureField('site_settings', 'opening_hours', F.text());
  await ensureField('site_settings', 'map_embed', F.text({ meta: { note: 'URL d\'intégration Google Maps' } }));
  await ensureField('site_settings', 'facebook', F.string());
  await ensureField('site_settings', 'instagram', F.string());
  await ensureField('site_settings', 'linkedin', F.string());
  await ensureField('site_settings', 'color_primary', F.string({ meta: { interface: 'select-color', note: 'Bleu principal' } }));
  await ensureField('site_settings', 'color_accent', F.string({ meta: { interface: 'select-color', note: 'Rouge accent' } }));
  await ensureField('site_settings', 'currency', F.string({ meta: { note: 'Ex : MAD' } }));
  await ensureField('site_settings', 'shipping_flat', F.decimal({ meta: { note: 'Frais de livraison forfaitaires' } }));
  await ensureField('site_settings', 'shipping_free_threshold', F.decimal({ meta: { note: 'Montant à partir duquel la livraison est offerte' } }));
}

// ---------- Point d'entrée ----------
async function main() {
  console.log('→ Connexion à', BASE);
  await login();
  await buildSchema();
  console.log('\n✓ Modèle de données créé.');
}

main().catch((err) => {
  console.error('\n✗ Échec :', err.message);
  if (err.payload) console.error(JSON.stringify(err.payload, null, 2));
  process.exit(1);
});
