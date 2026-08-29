/**
 * SEFELEC — Rôle « Gestionnaire du catalogue »
 * =============================================
 * Crée un rôle restreint destiné au client final.
 *
 * Pourquoi ne pas lui donner le compte administrateur : celui-ci peut
 * supprimer des collections, modifier la structure de la base, changer
 * les droits et retirer votre propre accès. Une fausse manœuvre y est
 * irréversible.
 *
 * Ce rôle permet de gérer le contenu — produits, catégories, services,
 * partenaires, témoignages, images, coordonnées — et rien d'autre :
 * ni structure, ni utilisateurs, ni droits.
 *
 * Le script ne crée aucun mot de passe. Le compte se crée depuis le
 * tableau de bord, où vous choisissez vous-même l'identifiant et le
 * mot de passe.
 *
 * Usage :  node scripts/creer-role-client.mjs
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
    throw e;
  }
  return texte ? JSON.parse(texte).data : null;
}

const NOM_ROLE = 'Gestionnaire du catalogue';
const NOM_POLITIQUE = 'Gestion du contenu';

/** Collections que le client peut administrer entièrement. */
const CONTENU_COMPLET = [
  'products',
  'categories',
  'services',
  'partners',
  'testimonials'
];

/** Collections en lecture et modification seulement, sans suppression. */
const MODIFIABLE = ['site_settings'];

async function main() {
  console.log('\n→ Création du rôle destiné au client\n');

  token = (
    await api('POST', '/auth/login', { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
  ).access_token;

  // --- 1. Politique ---
  const politiques = await api('GET', '/policies?fields=id,name');
  let politique = politiques.find((p) => p.name === NOM_POLITIQUE);

  if (politique) {
    console.log(`  = politique « ${NOM_POLITIQUE} » déjà présente`);
    // On repart de zéro sur les permissions, pour rester idempotent.
    const anciennes = await api('GET', `/permissions?filter[policy][_eq]=${politique.id}&fields=id&limit=-1`);
    for (const p of anciennes) await api('DELETE', `/permissions/${p.id}`);
  } else {
    politique = await api('POST', '/policies', {
      name: NOM_POLITIQUE,
      icon: 'inventory_2',
      description: 'Gestion du contenu du site : catalogue, services, partenaires, images.',
      app_access: true,   // accès à l'interface du tableau de bord
      admin_access: false // mais aucun droit sur la structure ni les comptes
    });
    console.log(`  + politique « ${NOM_POLITIQUE} » créée`);
  }

  // --- 2. Permissions ---
  const ajouter = async (collection, actions) => {
    for (const action of actions) {
      await api('POST', '/permissions', {
        policy: politique.id,
        collection,
        action,
        fields: ['*'],
        permissions: {},
        validation: {}
      });
    }
  };

  for (const c of CONTENU_COMPLET) {
    await ajouter(c, ['create', 'read', 'update', 'delete']);
  }
  for (const c of MODIFIABLE) {
    // Pas de suppression : effacer les réglages viderait les coordonnées
    // affichées sur tout le site.
    await ajouter(c, ['read', 'update']);
  }
  // Médiathèque : téléverser et remplacer des images, sans purger le dossier.
  await ajouter('directus_files', ['create', 'read', 'update']);
  // Dossiers de la médiathèque, en lecture seule.
  await ajouter('directus_folders', ['read']);

  const total = CONTENU_COMPLET.length * 4 + MODIFIABLE.length * 2 + 3 + 1;
  console.log(`  + ${total} permissions posées`);

  // --- 3. Rôle ---
  const roles = await api('GET', '/roles?fields=id,name');
  let role = roles.find((r) => r.name === NOM_ROLE);
  if (!role) {
    role = await api('POST', '/roles', {
      name: NOM_ROLE,
      icon: 'badge',
      description:
        'Peut gérer le contenu du site. Ne peut ni modifier la structure, ni gérer les comptes.'
    });
    console.log(`  + rôle « ${NOM_ROLE} » créé`);
  } else {
    console.log(`  = rôle « ${NOM_ROLE} » déjà présent`);
  }

  // --- 4. Rattachement du rôle à la politique ---
  const acces = await api('GET', '/access?fields=id,role,policy&limit=-1');
  const dejaLie = acces.some((a) => a.role === role.id && a.policy === politique.id);
  if (!dejaLie) {
    await api('POST', '/access', { role: role.id, policy: politique.id });
    console.log('  + politique rattachée au rôle');
  } else {
    console.log('  = rattachement déjà en place');
  }

  console.log('\n✓ Rôle prêt.\n');
  console.log('  Ce que le client pourra faire :');
  console.log('    produits, catégories, services, partenaires, témoignages');
  console.log('    téléverser et remplacer des images');
  console.log('    modifier les coordonnées du site');
  console.log('\n  Ce qu\'il ne pourra pas faire :');
  console.log('    modifier la structure de la base');
  console.log('    créer ou supprimer des comptes');
  console.log('    changer les droits, ni retirer votre accès');
  console.log('\n  Créez ensuite son compte depuis le tableau de bord :');
  console.log('    Paramètres → Utilisateurs → Créer, rôle « ' + NOM_ROLE + ' »');
  console.log('    Vous y choisissez vous-même son identifiant et son mot de passe.\n');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  if (e.detail) console.error(e.detail.slice(0, 400));
  process.exit(1);
});
