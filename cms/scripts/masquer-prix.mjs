/**
 * SEFELEC — Masquage des champs tarifaires
 * =========================================
 * Retire les champs de prix de l'interface du tableau de bord, sans
 * toucher aux données.
 *
 * Le site fonctionne désormais sur devis : les tarifs dépendent des
 * quantités et des délais. Les colonnes restent en base — supprimer un
 * champ Directus détruirait la colonne SQL et les valeurs avec elle.
 * Elles sont simplement masquées à la saisie.
 *
 * Réversible : passer MASQUER à false et relancer le script réaffiche
 * les champs avec leurs valeurs intactes.
 *
 * Usage :  node scripts/masquer-prix.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

/** Passer à false pour réafficher les champs. */
const MASQUER = true;

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
  if (!res.ok) throw new Error(`${method} ${endpoint} → ${res.status}\n${texte.slice(0, 300)}`);
  return texte ? JSON.parse(texte).data : null;
}

/** Champs à retirer de la saisie, par collection. */
const CIBLES = {
  products: ['price', 'promo_price', 'is_promo'],
  site_settings: ['currency', 'shipping_flat', 'shipping_free_threshold']
};

const NOTE =
  'Champ désactivé : le site fonctionne sur devis et n\'affiche aucun prix. '
  + 'La valeur est conservée en base et sera retrouvée intacte si l\'affichage des prix est rétabli.';

async function main() {
  console.log(`\n→ ${MASQUER ? 'Masquage' : 'Réaffichage'} des champs tarifaires\n`);

  token = (
    await api('POST', '/auth/login', { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
  ).access_token;

  for (const [collection, champs] of Object.entries(CIBLES)) {
    const existants = await api('GET', `/fields/${collection}`);
    const parNom = new Map(existants.map((f) => [f.field, f]));

    for (const champ of champs) {
      const actuel = parNom.get(champ);
      if (!actuel) {
        console.log(`  = ${collection}.${champ} : absent`);
        continue;
      }

      await api('PATCH', `/fields/${collection}/${champ}`, {
        meta: {
          hidden: MASQUER,
          readonly: MASQUER,
          note: MASQUER ? NOTE : null
        }
      });
      console.log(`  ${MASQUER ? '−' : '+'} ${collection}.${champ}`);
    }
  }

  // Contrôle : les valeurs doivent être intactes.
  const produits = await api('GET', '/items/products?fields=id,name,price&limit=-1');
  const avecPrix = produits.filter((p) => p.price != null && Number(p.price) > 0);
  console.log(`\n✓ Données préservées : ${avecPrix.length} produit(s) conservent leur prix en base.`);
  console.log('  Ils ne sont ni affichés sur le site, ni exportés dans content.json.\n');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
