/**
 * SEFELEC — Gabarits des pages générées
 * ======================================
 * Fabrique les pages Services et Produits à partir du contenu Directus.
 *
 * Pourquoi générer de vrais fichiers HTML plutôt que d'afficher ces
 * pages en JavaScript : l'hébergement est un Apache statique, sans
 * exécution côté serveur. Une page construite dans le navigateur n'a pas
 * d'adresse propre, pas de titre distinct, et n'est indexée qu'au prix
 * d'un second passage des moteurs. Chaque page a donc ici son fichier,
 * son titre, sa description et ses données structurées.
 *
 * Les chemins sont absolus (« /assets/… ») : les pages vivent à des
 * profondeurs différentes, un chemin relatif casserait selon le niveau.
 */

const SITE = 'https://www.sefelec.ma';

export function echapper(valeur) {
  return String(valeur ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Coupe proprement une description au dernier mot entier. */
export function resumer(texte, maximum = 155) {
  const propre = String(texte || '').replace(/\s+/g, ' ').trim();
  if (propre.length <= maximum) return propre;
  const coupe = propre.slice(0, maximum);
  return coupe.slice(0, coupe.lastIndexOf(' ')) + '…';
}

/**
 * Transforme le format « une ligne par élément » du back-office en HTML.
 * Une ligne préfixée de « - » devient une puce, les autres des
 * paragraphes. Tout est échappé.
 */
export function lignesEnHtml(texte, classeListe = 'page-points') {
  const lignes = String(texte || '').split('\n').map((l) => l.trim()).filter(Boolean);
  let html = '';
  let dansListe = false;

  for (const ligne of lignes) {
    if (ligne.startsWith('-')) {
      if (!dansListe) { html += `<ul class="${classeListe}">`; dansListe = true; }
      html += `<li>${echapper(ligne.replace(/^-\s*/, ''))}</li>`;
    } else {
      if (dansListe) { html += '</ul>'; dansListe = false; }
      html += `<p>${echapper(ligne)}</p>`;
    }
  }
  if (dansListe) html += '</ul>';
  return html;
}

// ---------------------------------------------------------------------
//  Ossature commune
// ---------------------------------------------------------------------

function entete() {
  return `
<header class="site-header" id="header">
  <div class="container header-inner">
    <a href="/" class="logo">
      <img src="/assets/images/logo-icon.png" alt="Logo SEFELEC S.A.R.L." class="logo-img" width="44" height="44">
      <span class="logo-text">SEFELEC<span class="accent"> S.A.R.L.</span></span>
    </a>

    <nav class="nav">
      <a href="/">Accueil</a>
      <a href="/#apropos">À propos</a>
      <a href="/services/">Services</a>
      <a href="/produits/">Produits</a>
      <a href="/#temoignages">Témoignages</a>
      <a href="/#contact">Contact</a>
    </nav>

    <a href="tel:+212665841807" class="header-phone">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M4 4C4 4 8 3 9 7C9.5 9 8 9.5 8 10.5C8 12.5 11.5 16 13.5 16C14.5 16 15 14.5 17 15C21 16 20 20 20 20C20 20 16 21 12 17C8 13 3 8 4 4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
      <span>06 65 84 18 07</span>
    </a>
    <a href="/#contactForm" class="btn btn-primary header-cta">Demander un devis</a>

    <button class="burger" id="burger" aria-label="Ouvrir le menu">
      <span></span><span></span><span></span>
    </button>
  </div>

  <div class="nav-mobile" id="navMobile">
    <a href="/">Accueil</a>
    <a href="/#apropos">À propos</a>
    <a href="/services/">Services</a>
    <a href="/produits/">Produits</a>
    <a href="/#temoignages">Témoignages</a>
    <a href="/#contact">Contact</a>
    <a href="tel:+212665841807" class="btn btn-outline">06 65 84 18 07</a>
    <a href="/#contactForm" class="btn btn-primary">Demander un devis</a>
  </div>
</header>`;
}

function piedDePage(services) {
  const liens = services
    .map((s) => `      <a href="/services/${echapper(s.slug)}/">${echapper(s.name)}</a>`)
    .join('\n');

  return `
<footer class="site-footer">
  <div class="container footer-inner">
    <div class="footer-col">
      <a href="/" class="logo logo-footer">
        <img src="/assets/images/logo-icon.png" alt="Logo SEFELEC S.A.R.L." class="logo-img" width="44" height="44">
        <span class="logo-text">SEFELEC<span class="accent"> S.A.R.L.</span></span>
      </a>
      <p>Électricité industrielle, automatisme et fabrication d'armoires électriques à Casablanca.</p>
    </div>
    <div class="footer-col">
      <h4>Services</h4>
${liens}
    </div>
    <div class="footer-col">
      <h4>Produits</h4>
      <a href="/produits/">Tout le catalogue</a>
      <a href="/#contact">Demander un devis</a>
    </div>
    <div class="footer-col">
      <h4>Contact</h4>
      <span>Hay Sâada, Rue 27 N°14</span>
      <span>Sidi Bernoussi, Casablanca</span>
      <a href="tel:+212665841807">06 65 84 18 07</a>
      <a href="mailto:contact@sefelec.ma">contact@sefelec.ma</a>
    </div>
  </div>
  <div class="container footer-bottom">
    <span>© ${new Date().getFullYear()} SEFELEC S.A.R.L. — Tous droits réservés.</span>
  </div>
</footer>

<script>
  // Menu mobile : seul comportement nécessaire sur ces pages.
  var burger = document.getElementById('burger');
  var navMobile = document.getElementById('navMobile');
  if (burger && navMobile) {
    burger.addEventListener('click', function () {
      burger.classList.toggle('open');
      navMobile.classList.toggle('open');
    });
  }
</script>`;
}

/** Fil d'Ariane visible + données structurées correspondantes. */
function filAriane(elements) {
  const visible = elements
    .map((e, i) => {
      const dernier = i === elements.length - 1;
      return dernier
        ? `<span aria-current="page">${echapper(e.nom)}</span>`
        : `<a href="${echapper(e.url)}">${echapper(e.nom)}</a><span class="fil-sep" aria-hidden="true">›</span>`;
    })
    .join('');

  const donnees = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: elements.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: e.nom,
      item: `${SITE}${e.url}`
    }))
  };

  return {
    html: `<nav class="fil-ariane" aria-label="Fil d'Ariane"><div class="container">${visible}</div></nav>`,
    donnees
  };
}

/**
 * Assemble une page complète.
 * Chaque page reçoit son titre, sa description et son adresse canonique :
 * ce sont eux qui évitent le contenu perçu comme dupliqué.
 */
export function page({
  titre,
  description,
  chemin,
  motsCles = '',
  image = '/assets/images/logo-icon.png',
  ariane = [],
  jsonLd = [],
  contenu,
  services = []
}) {
  const fil = ariane.length ? filAriane(ariane) : null;
  const schemas = fil ? [...jsonLd, fil.donnees] : jsonLd;
  const url = `${SITE}${chemin}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${echapper(titre)}</title>
<meta name="description" content="${echapper(description)}">
${motsCles ? `<meta name="keywords" content="${echapper(motsCles)}">` : ''}
<meta name="author" content="SEFELEC S.A.R.L.">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="SEFELEC S.A.R.L.">
<meta property="og:locale" content="fr_MA">
<meta property="og:title" content="${echapper(titre)}">
<meta property="og:description" content="${echapper(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}${image}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${echapper(titre)}">
<meta name="twitter:description" content="${echapper(description)}">
<meta name="twitter:image" content="${SITE}${image}">

<meta name="theme-color" content="#1E3A8A">
<link rel="icon" href="/assets/images/logo-icon.png" type="image/png">
<link rel="stylesheet" href="/assets/css/style.css">

${schemas.map((s) => `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`).join('\n')}
</head>
<body>
${entete()}
${fil ? fil.html : ''}
<main id="contenu">
${contenu}
</main>
${piedDePage(services)}
</body>
</html>
`;
}

/**
 * Bloc d'appel à l'action, repris au bas de chaque page générée.
 * Réutilise « cta-band », déjà stylé pour la page d'accueil : les pages
 * restent ainsi visuellement identiques au reste du site.
 */
export function appelAAction(titre, texte) {
  return `
<section class="cta-band">
  <div class="container cta-inner">
    <h2>${echapper(titre)}</h2>
    <p>${echapper(texte)}</p>
    <div class="cta-actions">
      <a href="/#contactForm" class="btn btn-white">Demander un devis</a>
      <a href="/#contact" class="btn btn-outline-light">Nous contacter</a>
    </div>
  </div>
</section>`;
}
