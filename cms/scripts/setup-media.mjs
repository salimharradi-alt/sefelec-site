/**
 * SEFELEC — Gestion des images : galeries, collections manquantes, optimisation
 * =============================================================================
 * Directus fournit déjà nativement la bibliothèque de médias (téléversement
 * multiple, glisser-déposer, recherche, dossiers, renommage, miniatures).
 * Ce script complète ce qui manque au projet :
 *
 *   1. Champs « galerie » (plusieurs images) sur les collections concernées
 *   2. Photo sur les témoignages
 *   3. Collections Équipe, Partenaires et Blog (avec leurs images)
 *   4. Préréglages d'optimisation (miniatures, compression, WebP)
 *
 * Le script est idempotent : relancé, il ne recrée rien en double.
 *
 * Usage :  node scripts/setup-media.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------- Configuration ----------
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

// On passe par le serveur unifié (port 5500), comme le reste du projet.
const BASE = 'http://localhost:5500';
let token = null;

// ---------- Client API ----------
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
    /* réponse non-JSON */
  }

  if (!res.ok) {
    const err = new Error(
      `${method} ${endpoint} → ${res.status} : ${json?.errors?.[0]?.message || text}`
    );
    err.status = res.status;
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
  console.log('✓ Authentifié\n');
}

async function exists(endpoint) {
  try {
    await api('GET', endpoint);
    return true;
  } catch (err) {
    if (err.status === 403 || err.status === 404) return false;
    throw err;
  }
}

// ---------- Fabriques de champs ----------
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
  integer: (opts = {}) => ({
    type: 'integer',
    meta: { interface: 'input', width: 'half', ...opts.meta },
    schema: { is_nullable: true, default_value: opts.default ?? null }
  }),
  date: (opts = {}) => ({
    type: 'timestamp',
    meta: { interface: 'datetime', width: 'half', ...opts.meta },
    schema: { is_nullable: true }
  }),
  /** Image unique (image principale) */
  image: (opts = {}) => ({
    type: 'uuid',
    meta: {
      interface: 'file-image',
      width: 'half',
      special: ['file'],
      note: 'Image principale — téléversez un fichier ou choisissez-en un dans la bibliothèque',
      ...opts.meta
    },
    schema: {
      is_nullable: true,
      foreign_key_table: 'directus_files',
      foreign_key_column: 'id'
    }
  }),
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
  sort: () => ({
    type: 'integer',
    meta: { interface: 'input', hidden: true },
    schema: { is_nullable: true }
  })
};

async function ensureField(collection, field, definition) {
  if (await exists(`/fields/${collection}/${field}`)) return false;
  await api('POST', `/fields/${collection}`, { field, ...definition });
  console.log(`  ↳ ${collection}.${field}`);
  return true;
}

async function ensureCollection(collection, meta, fields = []) {
  if (await exists(`/collections/${collection}`)) {
    console.log(`• ${collection} : existe déjà`);
    return false;
  }
  await api('POST', '/collections', {
    collection,
    meta: { singleton: false, ...meta },
    schema: { name: collection },
    fields: [
      {
        field: 'id',
        type: 'uuid',
        meta: { hidden: true, readonly: true, interface: 'input', special: ['uuid'] },
        schema: { is_primary_key: true, has_auto_increment: false }
      },
      ...fields
    ]
  });
  console.log(`✓ Collection créée : ${collection}`);
  return true;
}

async function ensureRelation(collection, field, relatedCollection, meta = {}) {
  const relations = await api('GET', '/relations');
  if (relations.some((r) => r.collection === collection && r.field === field)) return false;
  await api('POST', '/relations', {
    collection,
    field,
    related_collection: relatedCollection,
    meta
  });
  return true;
}

// ---------------------------------------------------------------------------
// Galerie multi-images (relation many-to-many vers la bibliothèque)
// ---------------------------------------------------------------------------

/**
 * Crée un champ « galerie » permettant d'associer plusieurs images de la
 * bibliothèque à un élément, avec réordonnancement par glisser-déposer.
 *
 * Directus modélise cela par une table de liaison entre la collection et
 * `directus_files`. Les images restent dans la bibliothèque : elles sont
 * référencées, jamais dupliquées.
 */
async function ensureGallery(collection, field = 'gallery') {
  const junction = `${collection}_files`;

  if (await exists(`/fields/${collection}/${field}`)) {
    console.log(`• ${collection}.${field} : existe déjà`);
    return false;
  }

  // 1) Table de liaison (masquée dans l'interface)
  if (!(await exists(`/collections/${junction}`))) {
    await api('POST', '/collections', {
      collection: junction,
      meta: { hidden: true, icon: 'image', sort_field: 'sort' },
      schema: { name: junction },
      fields: [
        {
          field: 'id',
          type: 'integer',
          meta: { hidden: true, interface: 'input' },
          schema: { is_primary_key: true, has_auto_increment: true }
        }
      ]
    });
  }

  // 2) Clés étrangères de la table de liaison
  if (!(await exists(`/fields/${junction}/${collection}_id`))) {
    await api('POST', `/fields/${junction}`, {
      field: `${collection}_id`,
      type: 'uuid',
      meta: { hidden: true },
      schema: { is_nullable: true }
    });
  }
  if (!(await exists(`/fields/${junction}/directus_files_id`))) {
    await api('POST', `/fields/${junction}`, {
      field: 'directus_files_id',
      type: 'uuid',
      meta: { hidden: true },
      schema: { is_nullable: true }
    });
  }
  if (!(await exists(`/fields/${junction}/sort`))) {
    await api('POST', `/fields/${junction}`, {
      field: 'sort',
      type: 'integer',
      meta: { hidden: true },
      schema: { is_nullable: true }
    });
  }

  // 3) Champ virtuel affiché dans le formulaire de l'élément
  await api('POST', `/fields/${collection}`, {
    field,
    type: 'alias',
    meta: {
      interface: 'files',
      special: ['files'],
      width: 'full',
      note: 'Galerie — téléversez plusieurs images ou piochez dans la bibliothèque'
    }
  });

  // 4) Relations reliant le tout
  await ensureRelation(junction, `${collection}_id`, collection, {
    one_field: field,
    junction_field: 'directus_files_id',
    sort_field: 'sort'
  });
  await ensureRelation(junction, 'directus_files_id', 'directus_files', {
    junction_field: `${collection}_id`
  });

  console.log(`✓ Galerie ajoutée : ${collection}.${field}`);
  return true;
}

// ---------------------------------------------------------------------------
// Préréglages d'optimisation
// ---------------------------------------------------------------------------

/**
 * Définit des formats d'image réutilisables. Directus les génère à la demande
 * puis les met en cache — les originaux ne sont jamais altérés.
 *
 * Exemple d'utilisation côté site :
 *   /assets/<id>?key=carte      → 600x450 WebP compressé
 *   /assets/<id>?key=miniature  → 200x200 WebP
 */
async function setupImagePresets() {
  const presets = [
    {
      key: 'miniature',
      fit: 'cover',
      width: 200,
      height: 200,
      quality: 80,
      withoutEnlargement: true,
      format: 'webp'
    },
    {
      key: 'carte',
      fit: 'cover',
      width: 600,
      height: 450,
      quality: 82,
      withoutEnlargement: true,
      format: 'webp'
    },
    {
      key: 'large',
      fit: 'inside',
      width: 1600,
      height: 1600,
      quality: 85,
      withoutEnlargement: true,
      format: 'webp'
    }
  ];

  await api('PATCH', '/settings', {
    // 'all' autorise aussi les dimensions libres (?width=…&height=…)
    storage_asset_transform: 'all',
    storage_asset_presets: presets
  });

  console.log('✓ Préréglages d\'image : ' + presets.map((p) => p.key).join(', '));
}

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------

async function main() {
  await login();

  // --- 1. Galeries sur les collections existantes ---
  console.log('— Galeries multi-images —');
  for (const c of ['products', 'services', 'categories', 'brands', 'pages']) {
    await ensureGallery(c);
  }

  // --- 2. Photo sur les témoignages ---
  console.log('\n— Témoignages —');
  await ensureField('testimonials', 'photo', F.image({ meta: { note: 'Photo du client (facultatif)' } }));

  // --- 3. Équipe ---
  console.log('\n— Équipe —');
  await ensureCollection('team_members', {
    icon: 'groups',
    note: "Membres de l'équipe",
    display_template: '{{name}}',
    sort_field: 'sort',
    archive_field: 'status',
    archive_value: 'archived',
    unarchive_value: 'draft'
  });
  await ensureField('team_members', 'name', F.string({ required: true, meta: { required: true } }));
  await ensureField('team_members', 'role', F.string({ meta: { note: 'Fonction dans l\'entreprise' } }));
  await ensureField('team_members', 'bio', F.text());
  await ensureField('team_members', 'photo', F.image());
  await ensureField('team_members', 'email', F.string());
  await ensureField('team_members', 'linkedin', F.string());
  await ensureField('team_members', 'status', F.status());
  await ensureField('team_members', 'sort', F.sort());

  // --- 4. Partenaires ---
  console.log('\n— Partenaires —');
  await ensureCollection('partners', {
    icon: 'handshake',
    note: 'Partenaires et références',
    display_template: '{{name}}',
    sort_field: 'sort',
    archive_field: 'status',
    archive_value: 'archived',
    unarchive_value: 'draft'
  });
  await ensureField('partners', 'name', F.string({ required: true, meta: { required: true } }));
  await ensureField('partners', 'logo', F.image());
  await ensureField('partners', 'website', F.string());
  await ensureField('partners', 'description', F.text());
  await ensureField('partners', 'status', F.status());
  await ensureField('partners', 'sort', F.sort());

  // --- 5. Blog ---
  console.log('\n— Blog —');
  await ensureCollection('articles', {
    icon: 'feed',
    note: 'Articles et actualités',
    display_template: '{{title}}',
    sort_field: 'sort',
    archive_field: 'status',
    archive_value: 'archived',
    unarchive_value: 'draft'
  });
  await ensureField('articles', 'title', F.string({ required: true, meta: { required: true, width: 'full' } }));
  await ensureField('articles', 'slug', F.string());
  await ensureField('articles', 'excerpt', F.text({ meta: { note: 'Résumé affiché dans la liste' } }));
  await ensureField('articles', 'content', F.wysiwyg());
  await ensureField('articles', 'cover', F.image({ meta: { note: 'Image de couverture' } }));
  await ensureField('articles', 'published_at', F.date());
  await ensureField('articles', 'author', F.string());
  await ensureField('articles', 'status', F.status());
  await ensureField('articles', 'sort', F.sort());
  await ensureField('articles', 'seo_title', F.string());
  await ensureField('articles', 'seo_description', F.text());

  // --- 6. Galeries sur les nouvelles collections ---
  console.log('\n— Galeries (nouvelles collections) —');
  for (const c of ['team_members', 'partners', 'articles']) {
    await ensureGallery(c);
  }

  // --- 7. Optimisation ---
  console.log('\n— Optimisation des images —');
  await setupImagePresets();

  console.log('\n✓ Terminé.');
}

main().catch((err) => {
  console.error('\n✗ Échec :', err.message);
  process.exit(1);
});
