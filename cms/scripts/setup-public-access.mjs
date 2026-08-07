/**
 * SEFELEC — Ouverture de la lecture publique
 * ===========================================
 * Le site public interroge l'API sans être authentifié. Il faut donc
 * autoriser explicitement la lecture des contenus destinés aux visiteurs.
 *
 * Principes appliqués :
 *   • Lecture seule — aucune permission d'écriture n'est accordée au public
 *   • Seuls les éléments « Publié » sont visibles (brouillons et archives
 *     restent privés)
 *   • Les tables de liaison et la bibliothèque de fichiers sont ouvertes en
 *     lecture, sans quoi les images ne s'afficheraient pas
 *
 * Le script est idempotent : relancé, il met à jour au lieu de dupliquer.
 *
 * Usage :  node scripts/setup-public-access.mjs
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

/** Collections publiques filtrées sur le statut « Publié ». */
const PUBLISHED_COLLECTIONS = [
  'products',
  'categories',
  'services',
  'testimonials',
  'brands',
  'team_members',
  'partners',
  'articles',
  'pages'
];

/** Collections publiques sans filtre (pas de champ statut). */
const OPEN_COLLECTIONS = [
  'site_settings',
  'directus_files',
  // Tables de liaison des galeries — indispensables à l'affichage des images
  'products_files',
  'services_files',
  'categories_files',
  'brands_files',
  'pages_files',
  'team_members_files',
  'partners_files',
  'articles_files'
];

async function main() {
  const auth = await api('POST', '/auth/login', {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD
  });
  token = auth.access_token;
  console.log('✓ Authentifié\n');

  // Identification de la politique publique (rôle non authentifié)
  const policies = await api('GET', '/policies?fields=id,name&limit=-1');
  const publicPolicy = policies.find(
    (p) => p.name === '$t:public_label' || p.name.toLowerCase() === 'public'
  );
  if (!publicPolicy) throw new Error('Politique publique introuvable');
  console.log('Politique publique :', publicPolicy.id, '\n');

  const existing = await api('GET', '/permissions?limit=-1&fields=id,collection,action,policy');

  async function grantRead(collection, filter) {
    const already = existing.find(
      (p) => p.collection === collection && p.action === 'read' && p.policy === publicPolicy.id
    );
    const payload = {
      policy: publicPolicy.id,
      collection,
      action: 'read',
      fields: ['*'],
      permissions: filter ?? {}
    };

    if (already) {
      await api('PATCH', `/permissions/${already.id}`, payload);
      console.log(`  ↻ ${collection}${filter ? ' (publiés uniquement)' : ''}`);
    } else {
      await api('POST', '/permissions', payload);
      console.log(`  ✓ ${collection}${filter ? ' (publiés uniquement)' : ''}`);
    }
  }

  console.log('— Contenus publiés —');
  for (const c of PUBLISHED_COLLECTIONS) {
    try {
      await grantRead(c, { status: { _eq: 'published' } });
    } catch (err) {
      console.log(`  ! ${c} : ${err.message.slice(0, 80)}`);
    }
  }

  console.log('\n— Fichiers et liaisons —');
  for (const c of OPEN_COLLECTIONS) {
    try {
      await grantRead(c, null);
    } catch (err) {
      console.log(`  ! ${c} : ${err.message.slice(0, 80)}`);
    }
  }

  console.log('\n✓ Lecture publique configurée (aucune écriture accordée).');
}

main().catch((err) => {
  console.error('\n✗ Échec :', err.message);
  process.exit(1);
});
