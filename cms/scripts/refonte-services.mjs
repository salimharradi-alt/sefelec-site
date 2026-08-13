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
    seo_title: "Armoires électriques sur mesure à Casablanca — SEFELEC",
    seo_description: "Conception, câblage et mise en service d'armoires de commande et de puissance sur mesure. SEFELEC, Casablanca : étude, atelier, essais, mise en route.",
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
    ].join('\n'),
    avantages: [
      '- Un interlocuteur unique de l\'étude à la mise en service',
      '- Des armoires dimensionnées pour votre installation, sans surcoût inutile',
      '- Un assemblage en atelier qui réduit la durée d\'immobilisation sur site',
      '- Des essais réalisés avant livraison, pas découverts au démarrage',
      '- Un repérage et un dossier de schémas qui accélèrent vos dépannages',
      '- Des évolutions facilitées : réserves prévues dès la conception'
    ].join('\n'),
    applications: [
      '- Industrie agroalimentaire',
      '- Industrie textile et confection',
      '- Bâtiment et second œuvre industriel',
      '- Logistique et entrepôts',
      '- Ateliers de production et lignes automatisées',
      '- Stations de pompage et traitement des eaux'
    ].join('\n'),
    equipements: [
      '- Armoires de commande et de contrôle',
      '- Armoires de puissance et de distribution',
      '- Tableaux généraux basse tension',
      '- Coffrets divisionnaires et coffrets de chantier',
      '- Armoires de démarrage moteur',
      '- Armoires pour automates et supervision'
    ].join('\n')
  },
  {
    cle: 'Automatisme Industriel',
    seo_title: "Automatisme industriel à Casablanca — SEFELEC S.A.R.L.",
    seo_description: "Programmation d'automates, supervision et intégration sur vos lignes de production. SEFELEC vous accompagne de l'analyse à la mise au point.",
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
    ].join('\n'),
    avantages: [
      '- Des cycles de production plus réguliers et reproductibles',
      '- Moins d\'interventions manuelles sur les tâches répétitives',
      '- Un diagnostic facilité par la supervision en cas d\'arrêt',
      '- Une intégration pensée pour vos équipements déjà en place',
      '- Des évolutions possibles sans reprendre toute l\'installation'
    ].join('\n'),
    applications: [
      '- Lignes de production et convoyage',
      '- Machines spéciales',
      '- Stations de pompage et de dosage',
      '- Traitement et distribution des fluides',
      '- Gestion technique de bâtiment industriel'
    ].join('\n'),
    equipements: [
      '- Automates programmables',
      '- Interfaces opérateur et pupitres',
      '- Supervision et suivi de production',
      '- Variateurs de vitesse et démarreurs',
      '- Capteurs, détecteurs et instrumentation'
    ].join('\n')
  },
  {
    cle: 'Électricité MT/BT',
    seo_title: "Travaux d'électricité MT/BT à Casablanca — SEFELEC",
    seo_description: "Postes de transformation, distribution basse tension, mise à la terre et essais de réception. SEFELEC, Casablanca.",
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
    ].join('\n'),
    avantages: [
      '- Un dimensionnement adapté à votre puissance réelle et à vos extensions prévues',
      '- Des protections cohérentes entre elles, du poste jusqu\'aux départs',
      '- Une exécution coordonnée avec vos arrêts de production',
      '- Une installation repérée et documentée pour vos interventions',
      '- Des essais de réception qui valident l\'installation avant exploitation'
    ].join('\n'),
    applications: [
      '- Sites industriels et zones de production',
      '- Bâtiments tertiaires et locaux techniques',
      '- Entrepôts et plateformes logistiques',
      '- Extensions et renforcements de puissance'
    ].join('\n'),
    equipements: [
      '- Postes de transformation MT/BT',
      '- Tableaux généraux basse tension',
      '- Disjoncteurs et appareillage de protection',
      '- Chemins de câbles et canalisations',
      '- Réseaux de terre et liaisons équipotentielles'
    ].join('\n')
  },
  {
    cle: 'Installation Électrique Industrielle',
    seo_title: "Installation électrique industrielle — SEFELEC Casablanca",
    seo_description: "Alimentation des machines, éclairage industriel, réseaux de distribution et câblage repéré. SEFELEC réalise l'ensemble de votre lot électrique industriel.",
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
    ].join('\n'),
    avantages: [
      '- Des interventions planifiées autour de vos contraintes d\'exploitation',
      '- Un câblage repéré, donc des dépannages plus rapides ensuite',
      '- Une séparation nette entre courants forts et courants faibles',
      '- Des réserves prévues pour vos ajouts de machines',
      '- Un seul intervenant pour l\'ensemble du lot électrique'
    ].join('\n'),
    applications: [
      '- Ateliers de production',
      '- Lignes de fabrication et postes de travail',
      '- Zones de stockage et quais de chargement',
      '- Locaux techniques et salles de machines'
    ].join('\n'),
    equipements: [
      '- Coffrets divisionnaires et départs machines',
      '- Éclairage industriel et éclairage de sécurité',
      '- Prises de courant industrielles',
      '- Chemins de câbles, goulottes et conduits',
      '- Réseaux courants faibles'
    ].join('\n')
  },
  {
    cle: 'Mise en Conformité',
    seo_title: "Mise en conformité électrique à Casablanca — SEFELEC",
    seo_description: "Diagnostic, relevé des non-conformités et travaux correctifs sur vos installations électriques existantes. SEFELEC S.A.R.L., Casablanca.",
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
    ].join('\n'),
    avantages: [
      '- Un état des lieux écrit, qui distingue l\'urgent du souhaitable',
      '- Un chiffrage détaillé permettant d\'étaler les travaux',
      '- Des risques électriques réduits pour vos équipes',
      '- Une installation remise en ordre et documentée',
      '- Des travaux organisés sans arrêter votre activité'
    ].join('\n'),
    applications: [
      '- Installations anciennes ou modifiées au fil du temps',
      '- Locaux repris ou changeant d\'usage',
      '- Sites préparant un contrôle réglementaire',
      '- Bâtiments après extension ou ajout de machines'
    ].join('\n'),
    equipements: [
      '- Reprise des tableaux et armoires existants',
      '- Remplacement des protections vétustes',
      '- Mise à la terre et liaisons équipotentielles',
      '- Repérage des circuits et étiquetage',
      '- Remise en état des raccordements'
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

  // Sections de la page dédiée au service. Même format que « details ».
  const sections = {
    avantages: 'Ce que le client y gagne. Une ligne par point, préfixée de « - ».',
    applications: 'Secteurs et cas d\'usage concernés. Une ligne par point.',
    equipements: 'Équipements et solutions proposés. Une ligne par point.'
  };
  for (const [champ, note] of Object.entries(sections)) {
    await assurerChamp(champ, {
      type: 'text',
      meta: { interface: 'input-multiline', note },
      schema: {}
    });
  }

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
      seo_title: service.seo_title,
      seo_description: service.seo_description,
      details: service.details,
      avantages: service.avantages,
      applications: service.applications,
      equipements: service.equipements,
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
