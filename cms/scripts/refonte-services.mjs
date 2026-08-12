/**
 * SEFELEC — Refonte de la section Services
 * =========================================
 * Réordonne les services, met les armoires électriques en tête et ajoute
 * un contenu détaillé à chacun.
 *
 * Pourquoi un script plutôt qu'une modification du HTML : les services
 * viennent de Directus. Toute modification écrite en dur dans le code
 * serait écrasée au prochain « npm run build ». Le contenu reste ainsi
 * modifiable depuis le tableau de bord.
 *
 * Le script est idempotent : relancé, il met à jour au lieu de dupliquer.
 *
 * Usage :  node scripts/refonte-services.mjs
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
    const erreur = new Error(`${method} ${endpoint} → ${res.status}`);
    erreur.detail = texte;
    erreur.status = res.status;
    throw erreur;
  }
  return texte ? JSON.parse(texte).data : null;
}

// ---------------------------------------------------------------------
//  Contenu
// ---------------------------------------------------------------------
// Format de « details » : une ligne par élément.
//   - une ligne commençant par « - » devient une puce
//   - toute autre ligne devient un paragraphe
// Ce format reste lisible et modifiable dans le tableau de bord, sans
// HTML à écrire, et il est échappé à l'affichage.
//
// Aucune norme ni certification n'est citée : l'énoncé du projet parle
// de « respect des normes et exigences du projet », formulation reprise
// telle quelle.

const SERVICES = [
  {
    cle: 'Armoires Électriques',
    name: 'Conception et réalisation d\'armoires électriques',
    description:
      'Conception, câblage et mise en service d\'armoires de commande et de puissance, adaptées à votre process industriel.',
    featured: true,
    sort: 1,
    details: [
      'De l\'étude du schéma jusqu\'à la mise en service, nous réalisons vos armoires électriques sur mesure : assemblage et câblage en atelier, essais avant livraison, puis raccordement et mise en route sur votre site.',
      '- Conception d\'armoires électriques adaptées à votre installation',
      '- Étude des schémas électriques',
      '- Choix et dimensionnement des composants',
      '- Câblage et assemblage en atelier',
      '- Armoires de commande',
      '- Armoires de puissance',
      '- Tableaux électriques industriels',
      '- Tests et vérifications avant livraison',
      '- Mise en service sur site',
      '- Respect des normes et exigences du projet',
      'Chaque armoire est repérée et livrée avec son dossier de schémas, pour faciliter vos interventions ultérieures.'
    ].join('\n')
  },
  {
    cle: 'Automatisme Industriel',
    name: 'Automatisme industriel',
    description:
      'Conception et intégration de solutions automatisées pour vos process de production.',
    featured: false,
    sort: 2,
    details: [
      'Nous automatisons vos équipements de production, de l\'analyse du besoin jusqu\'à la mise au point sur site.',
      '- Analyse du process et rédaction du cahier des charges',
      '- Programmation d\'automates',
      '- Supervision et interfaces opérateur',
      '- Intégration aux équipements déjà en place',
      '- Mise au point et essais de fonctionnement',
      '- Accompagnement de vos équipes à la prise en main'
    ].join('\n')
  },
  {
    cle: 'Électricité MT/BT',
    name: 'Étude et réalisation des travaux d\'électricité MT/BT',
    description:
      'Étude et réalisation de vos installations électriques moyenne et basse tension.',
    featured: false,
    sort: 3,
    details: [
      'Nous prenons en charge vos travaux moyenne et basse tension, de l\'étude technique jusqu\'à la réception de l\'installation.',
      '- Étude technique et dimensionnement',
      '- Postes de transformation MT/BT',
      '- Distribution basse tension',
      '- Chemins de câbles et raccordements',
      '- Mise à la terre et protections',
      '- Essais et réception de l\'installation'
    ].join('\n')
  },
  {
    cle: 'Installation Électrique Industrielle',
    name: 'Installation électrique industrielle',
    description:
      'Réalisation complète de vos installations électriques en environnement industriel.',
    featured: false,
    sort: 4,
    details: [
      'De l\'atelier à la ligne de production, nous réalisons l\'ensemble de votre installation électrique et coordonnons nos interventions avec vos contraintes d\'exploitation.',
      '- Alimentation des machines et des équipements',
      '- Éclairage industriel',
      '- Réseaux de distribution et coffrets divisionnaires',
      '- Câblage courant fort et courant faible',
      '- Repérage et documentation de l\'installation',
      '- Essais avant remise en exploitation'
    ].join('\n')
  },
  {
    cle: 'Mise en Conformité',
    name: 'Mise en conformité des installations',
    description:
      'Diagnostic et mise en conformité de vos installations électriques existantes.',
    featured: false,
    sort: 5,
    details: [
      'Nous établissons un état des lieux de votre installation, identifions les points à reprendre et réalisons les travaux correctifs.',
      '- Diagnostic de l\'installation existante',
      '- Relevé des non-conformités',
      '- Chiffrage des travaux à engager',
      '- Reprise des protections et des mises à la terre',
      '- Remise en état des armoires et des raccordements',
      '- Respect des normes et exigences du projet'
    ].join('\n')
  }
];

/** Retirés de la section Services à la demande du client. */
const A_SUPPRIMER = ['Maintenance Électrique', 'Dépannage Électrique'];

/**
 * « Tableaux Électriques » n'apparaît pas dans la liste demandée, et ses
 * prestations sont reprises dans le détail des armoires. Il est mis en
 * brouillon plutôt que supprimé : la suppression n'a pas été demandée
 * pour ce service, et un brouillon se réactive d'un clic.
 */
const A_MASQUER = ['Tableaux Électriques'];

// ---------------------------------------------------------------------

/** Crée un champ s'il n'existe pas déjà. */
async function assurerChamp(champ, definition) {
  try {
    await api('POST', '/fields/services', { field: champ, ...definition });
    console.log(`  + champ « ${champ} » créé`);
  } catch (e) {
    // Directus renvoie 400 quand le champ existe : ce n'est pas une erreur.
    if (e.status === 400 && /exist/i.test(e.detail || '')) {
      console.log(`  = champ « ${champ} » déjà présent`);
      return;
    }
    throw e;
  }
}

async function main() {
  console.log('\n→ Refonte de la section Services\n');

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.error('✗ ADMIN_EMAIL / ADMIN_PASSWORD absents de cms/.env');
    process.exit(1);
  }

  const auth = await api('POST', '/auth/login', {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD
  });
  token = auth.access_token;
  console.log('  connecté\n');

  // --- 1. Champs nécessaires ---
  console.log('— Modèle de données —');
  await assurerChamp('details', {
    type: 'text',
    meta: {
      interface: 'input-multiline',
      note: 'Une ligne par élément. Une ligne commençant par « - » devient une puce.',
      options: { placeholder: 'Paragraphe d\'introduction\n- Premier point\n- Deuxième point' }
    },
    schema: {}
  });
  await assurerChamp('featured', {
    type: 'boolean',
    meta: {
      interface: 'boolean',
      note: 'Met le service en avant : carte plus large, en tête de section.'
    },
    schema: { default_value: false }
  });

  // --- 2. État actuel ---
  const existants = await api('GET', '/items/services?fields=id,name,status&limit=-1');
  const parNom = new Map(existants.map((s) => [s.name, s]));
  console.log(`\n— ${existants.length} services en base —`);

  // --- 3. Suppressions demandées ---
  for (const nom of A_SUPPRIMER) {
    const s = parNom.get(nom);
    if (!s) {
      console.log(`  = « ${nom} » déjà absent`);
      continue;
    }
    await api('DELETE', `/items/services/${s.id}`);
    console.log(`  − « ${nom} » supprimé`);
  }

  // --- 4. Mises en brouillon ---
  for (const nom of A_MASQUER) {
    const s = parNom.get(nom);
    if (!s) continue;
    await api('PATCH', `/items/services/${s.id}`, { status: 'draft' });
    console.log(`  ~ « ${nom} » passé en brouillon (réactivable)`);
  }

  // --- 5. Contenu et ordre ---
  console.log('\n— Contenu —');
  for (const service of SERVICES) {
    const actuel = parNom.get(service.cle) || parNom.get(service.name);
    const donnees = {
      name: service.name,
      description: service.description,
      details: service.details,
      featured: service.featured,
      sort: service.sort,
      status: 'published'
    };

    if (actuel) {
      await api('PATCH', `/items/services/${actuel.id}`, donnees);
      console.log(`  ${service.sort}. ${service.name}${service.featured ? '  ★ mis en avant' : ''}`);
    } else {
      await api('POST', '/items/services', donnees);
      console.log(`  ${service.sort}. ${service.name}  (créé)`);
    }
  }

  // --- 6. Contrôle ---
  const final = await api(
    'GET',
    '/items/services?fields=name,sort,featured,status&sort=sort&limit=-1&filter[status][_eq]=published'
  );
  console.log(`\n✓ ${final.length} services publiés :`);
  final.forEach((s) => console.log(`    ${s.sort}. ${s.name}${s.featured ? '  ★' : ''}`));

  const restants = final.filter((s) => /maintenance|dépannage|depannage/i.test(s.name));
  if (restants.length) {
    console.error('\n✗ Services censés être retirés encore publiés :', restants.map((s) => s.name));
    process.exit(1);
  }

  console.log('\nLancez « npm run build » pour répercuter sur le site.\n');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  if (e.detail) console.error(e.detail.slice(0, 500));
  process.exit(1);
});
