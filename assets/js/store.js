/**
 * SEFELEC — Magasin de données du site public
 * ============================================
 * Le site lit son contenu depuis `data/content.json`, généré par le
 * back-office (script `npm run build`).
 *
 * C'est ce qui permet au site d'être 100 % statique en production :
 * il fonctionne sur un hébergement mutualisé classique, sans Node.js,
 * sans base de données et sans que le back-office ait besoin de tourner.
 *
 * Pour mettre le contenu à jour : modifiez-le dans le back-office,
 * lancez `npm run build`, puis publiez avec git push.
 */

// Données partagées, remplies par loadAllData()
let catalog = [];
let catalogLabels = {};
let SERVICES = [];
let TESTIMONIALS = [];
let PARTNERS = [];
let SETTINGS = {};

// Valeurs de repli tant que le contenu n'est pas chargé

/** Emplacement du contenu généré, relatif à la page. */
const CONTENT_URL = 'assets/data/content.json';

/**
 * Charge le contenu du site.
 * En cas d'échec, l'erreur est propagée pour que l'affichage puisse
 * en informer le visiteur plutôt que de rester figé.
 */
async function loadAllData() {
  const res = await fetch(CONTENT_URL, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Contenu introuvable (${CONTENT_URL} → HTTP ${res.status})`);
  }

  const content = await res.json();

  catalog = content.products || [];
  catalogLabels = content.categories || {};
  SERVICES = content.services || [];
  TESTIMONIALS = content.testimonials || [];
  PARTNERS = content.partners || [];
  SETTINGS = content.settings || {};

  // Paramètres commerciaux pilotés depuis le back-office

  return { catalog, catalogLabels, SERVICES, TESTIMONIALS, PARTNERS, SETTINGS };
}
