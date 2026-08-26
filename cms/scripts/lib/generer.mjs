/**
 * SEFELEC — Construction des pages Services et Produits
 * ======================================================
 * Chaque fonction rend le corps d'une page ; « page() » l'habille.
 *
 * Les adresses suivent la hiérarchie demandée :
 *   /services/                          liste
 *   /services/<service>/                détail
 *   /produits/                          catalogue
 *   /produits/<categorie>/              catégorie
 *   /produits/<categorie>/<produit>/    fiche
 *
 * Un dossier par page, avec un index.html : Apache sert alors l'adresse
 * sans extension ni règle de réécriture.
 */

import { page, appelAAction, echapper, resumer, lignesEnHtml } from './pages.mjs';

const SITE = 'https://www.sefelec.ma';

const ICONE_DEFAUT =
  '<svg viewBox="0 0 24 24" width="28" height="28" fill="none"><path d="M13 2L4 14H11L9 22L20 8H12L13 2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

/** Fiche d'identité de l'entreprise, reprise sur chaque page. */
function organisation() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE}/#entreprise`,
    name: 'SEFELEC S.A.R.L.',
    url: `${SITE}/`,
    logo: `${SITE}/assets/images/logo-icon.png`,
    telephone: ['+212665841807', '+212661957077'],
    email: 'contact@sefelec.ma',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Hay Sâada, Rue 27 N°14, Sidi Bernoussi',
      addressLocality: 'Casablanca',
      addressCountry: 'MA'
    }
  };
}

function carteService(s) {
  const principal = Boolean(s.featured);
  return `
      <article class="service-card${principal ? ' service-card-featured' : ''}">
        ${principal ? '<span class="service-flag">Notre spécialité</span>' : ''}
        <div class="service-icon">${s.icon_svg || ICONE_DEFAUT}</div>
        <h3>${echapper(s.name)}</h3>
        <p>${echapper(s.description)}</p>
        <div class="service-actions">
          <a class="service-more" href="/services/${echapper(s.slug)}/">Lire plus</a>
          ${principal ? '<a href="/#contactForm" class="btn btn-primary">Demander un devis</a>' : ''}
        </div>
      </article>`;
}

// ---------------------------------------------------------------------
//  /services/
// ---------------------------------------------------------------------

export function pageServices(services) {
  const principal = services.find((s) => s.featured) || services[0];
  const ordonnes = [...services].sort((a, b) => Number(b.featured) - Number(a.featured));

  const contenu = `
<section class="section page-hero">
  <div class="container">
    <span class="eyebrow">Nos services</span>
    <h1>Services d'électricité industrielle à Casablanca</h1>
    <p class="page-intro">SEFELEC conçoit et réalise vos armoires électriques, vos installations moyenne et
    basse tension et vos solutions d'automatisme. Chaque prestation est détaillée dans sa page : contenu,
    déroulement et secteurs concernés.</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="services-grid">
${ordonnes.map(carteService).join('\n')}
    </div>
  </div>
</section>
${appelAAction('Un besoin précis ?', 'Décrivez-nous votre projet : nous revenons vers vous avec une proposition chiffrée.')}`;

  return page({
    // Environ 60 caractères : au-delà, Google tronque le titre affiché.
    titre: 'Services d\'électricité industrielle — SEFELEC Casablanca',
    description: resumer(
      'Armoires électriques sur mesure, automatisme industriel, travaux MT/BT, installation et mise en conformité. Découvrez les services de SEFELEC S.A.R.L. à Casablanca.'
    ),
    chemin: '/services/',
    motsCles: 'services électricité industrielle, armoires électriques Casablanca, automatisme industriel, travaux MT/BT',
    ariane: [
      { nom: 'Accueil', url: '/' },
      { nom: 'Services', url: '/services/' }
    ],
    jsonLd: [
      organisation(),
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Services SEFELEC',
        url: `${SITE}/services/`,
        about: principal ? principal.name : undefined,
        hasPart: services.map((s) => ({
          '@type': 'Service',
          name: s.name,
          url: `${SITE}/services/${s.slug}/`
        }))
      }
    ],
    contenu,
    services
  });
}

// ---------------------------------------------------------------------
//  /services/<slug>/
// ---------------------------------------------------------------------

export function pageService(service, tousLesServices) {
  const autres = tousLesServices.filter((s) => s.id !== service.id);

  const section = (titre, texte, id) =>
    texte
      ? `
<section class="section" id="${id}">
  <div class="container page-bloc">
    <h2>${echapper(titre)}</h2>
    ${lignesEnHtml(texte)}
  </div>
</section>`
      : '';

  const contenu = `
<section class="section page-hero${service.featured ? ' page-hero-principal' : ''}">
  <div class="container">
    ${service.featured ? '<span class="service-flag">Notre activité principale</span>' : '<span class="eyebrow">Nos services</span>'}
    <h1>${echapper(service.name)}</h1>
    <p class="page-intro">${echapper(service.description)}</p>
    <div class="cta-actions">
      <a href="/#contactForm" class="btn btn-primary">Demander un devis</a>
      <a href="/#contact" class="btn btn-outline">Nous contacter</a>
    </div>
  </div>
</section>

<section class="section" id="prestations">
  <div class="container page-bloc">
    <h2>Le détail de la prestation</h2>
    ${lignesEnHtml(service.details)}
  </div>
</section>
${section('Ce que vous y gagnez', service.avantages, 'avantages')}
${section('Secteurs et applications', service.applications, 'applications')}
${section('Équipements et solutions', service.equipements, 'equipements')}

<section class="section section-alt">
  <div class="container">
    <h2>Nos autres services</h2>
    <div class="services-grid">
${autres.map(carteService).join('\n')}
    </div>
  </div>
</section>
${appelAAction(
    'Parlons de votre projet',
    'Un échange suffit souvent à cadrer le besoin. Décrivez-nous votre installation, nous vous répondons sous 24 h ouvrées.'
  )}`;

  const titre =
    service.seo_title || `${service.name} — SEFELEC Casablanca`;
  const description =
    service.seo_description ||
    resumer(`${service.description} SEFELEC S.A.R.L., Casablanca : étude, réalisation et mise en service.`);

  return page({
    titre,
    description,
    chemin: `/services/${service.slug}/`,
    motsCles: service.keywords || '',
    ariane: [
      { nom: 'Accueil', url: '/' },
      { nom: 'Services', url: '/services/' },
      { nom: service.name, url: `/services/${service.slug}/` }
    ],
    jsonLd: [
      organisation(),
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: service.name,
        description: service.description,
        url: `${SITE}/services/${service.slug}/`,
        serviceType: service.name,
        provider: { '@id': `${SITE}/#entreprise` },
        areaServed: { '@type': 'Country', name: 'Maroc' }
      }
    ],
    contenu,
    services: tousLesServices
  });
}

// ---------------------------------------------------------------------
//  Produits
// ---------------------------------------------------------------------

function carteProduit(p, cheminCategorie) {
  const alt = p.image_alt || `${p.name} — SEFELEC`;
  return `
      <article class="catalog-card">
        <div class="catalog-photo">
          ${p.image
            ? `<img src="/${echapper(p.image)}" alt="${echapper(alt)}" loading="lazy" decoding="async" width="600" height="450">`
            : '<div class="catalog-photo-empty" aria-hidden="true"></div>'}
        </div>
        <span class="catalog-tag">${echapper(p.categoryName)}</span>
        <h3>${echapper(p.name)}</h3>
        <span class="catalog-ref">Réf. ${echapper(p.ref)}</span>
        <p>${echapper(resumer(p.desc, 110))}</p>
        <div class="catalog-actions">
          <a class="btn btn-primary" href="${cheminCategorie}${echapper(p.slug)}/">Voir la fiche</a>
        </div>
      </article>`;
}

export function pageProduits(produits, categories, services) {
  const parCategorie = categories.map((c) => ({
    ...c,
    produits: produits.filter((p) => p.category === c.slug)
  }));

  const contenu = `
<section class="section page-hero">
  <div class="container">
    <span class="eyebrow">Notre catalogue</span>
    <h1>Produits et matériel électrique industriel</h1>
    <p class="page-intro">Appareillage de protection, câbles, coffrets et connectique. Chaque référence
    dispose de sa fiche technique détaillée. Pour un besoin particulier ou une quantité importante,
    demandez un devis.</p>
  </div>
</section>

${parCategorie
    .filter((c) => c.produits.length)
    .map(
      (c) => `
<section class="section" id="${echapper(c.slug)}">
  <div class="container">
    <div class="bloc-titre">
      <h2>${echapper(c.name)}</h2>
      <a class="lien-suite" href="/produits/${echapper(c.slug)}/">Voir la catégorie</a>
    </div>
    <div class="catalog-grid">
${c.produits.map((p) => carteProduit(p, `/produits/${c.slug}/`)).join('\n')}
    </div>
  </div>
</section>`
    )
    .join('\n')}
${appelAAction('Besoin d\'un chiffrage ?', 'Indiquez-nous les références et les quantités : nous établissons votre devis.')}`;

  return page({
    titre: 'Catalogue matériel électrique industriel — SEFELEC',
    description: resumer(
      'Disjoncteurs, câbles, appareillage, coffrets et connectique pour l\'industrie. Catalogue SEFELEC S.A.R.L. à Casablanca, avec fiches techniques et devis sur demande.'
    ),
    chemin: '/produits/',
    motsCles: 'matériel électrique industriel, disjoncteur, câble industriel, coffret électrique, Casablanca',
    ariane: [
      { nom: 'Accueil', url: '/' },
      { nom: 'Produits', url: '/produits/' }
    ],
    jsonLd: [
      organisation(),
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Catalogue produits SEFELEC',
        url: `${SITE}/produits/`
      }
    ],
    contenu,
    services
  });
}

export function pageCategorie(categorie, produits, services) {
  const contenu = `
<section class="section page-hero">
  <div class="container">
    <span class="eyebrow">Catalogue</span>
    <h1>${echapper(categorie.name)}</h1>
    <p class="page-intro">${echapper(
      categorie.description ||
        `Retrouvez nos références de la catégorie ${categorie.name.toLowerCase()}, avec leurs caractéristiques techniques détaillées.`
    )}</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="catalog-grid">
${produits.map((p) => carteProduit(p, `/produits/${categorie.slug}/`)).join('\n')}
    </div>
  </div>
</section>
${appelAAction('Une référence vous manque ?', 'Nous consultons nos fournisseurs et revenons vers vous avec une proposition.')}`;

  return page({
    titre:
      categorie.seo_title || `${categorie.name} — catalogue SEFELEC Casablanca`,
    description:
      categorie.seo_description ||
      resumer(
        `${categorie.name} disponibles chez SEFELEC S.A.R.L. à Casablanca : ${produits
          .slice(0, 3)
          .map((p) => p.name)
          .join(', ')}. Fiches techniques et devis sur demande.`
      ),
    chemin: `/produits/${categorie.slug}/`,
    motsCles: categorie.keywords || '',
    ariane: [
      { nom: 'Accueil', url: '/' },
      { nom: 'Produits', url: '/produits/' },
      { nom: categorie.name, url: `/produits/${categorie.slug}/` }
    ],
    jsonLd: [
      organisation(),
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: categorie.name,
        url: `${SITE}/produits/${categorie.slug}/`,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: produits.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: p.name,
            url: `${SITE}/produits/${categorie.slug}/${p.slug}/`
          }))
        }
      }
    ],
    contenu,
    services
  });
}

export function pageProduit(produit, categorie, similaires, services) {
  const alt = produit.image_alt || `${produit.name} — SEFELEC`;
  const specs = Object.entries(produit.specs || {});

  const bloc = (titre, texte) =>
    texte
      ? `
    <div class="fiche-bloc">
      <h2>${echapper(titre)}</h2>
      ${lignesEnHtml(texte)}
    </div>`
      : '';

  const contenu = `
<section class="section">
  <div class="container fiche-produit">
    <div class="fiche-visuel">
      ${produit.imageLarge || produit.image
        ? `<img src="/${echapper(produit.imageLarge || produit.image)}" alt="${echapper(alt)}" width="800" height="600" decoding="async">`
        : '<div class="catalog-photo-empty" aria-hidden="true"></div>'}
    </div>

    <div class="fiche-infos">
      <span class="catalog-tag">${echapper(produit.categoryName)}</span>
      <h1>${echapper(produit.name)}</h1>
      <span class="catalog-ref">Référence : ${echapper(produit.ref)}</span>
      <p class="fiche-desc">${echapper(produit.desc)}</p>
      <div class="cta-actions">
        <a href="/#contactForm" class="btn btn-primary">Demander un devis</a>
        <a href="/#contact" class="btn btn-outline">Nous contacter</a>
      </div>
    </div>
  </div>
</section>

${specs.length
    ? `
<section class="section section-alt">
  <div class="container page-bloc">
    <h2>Caractéristiques techniques</h2>
    <table class="spec-table">
      <tbody>
${specs.map(([k, v]) => `        <tr><th>${echapper(k)}</th><td>${echapper(v)}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>
</section>`
    : ''}

${produit.applications || produit.avantages
    ? `
<section class="section">
  <div class="container page-bloc">
${bloc('Applications', produit.applications)}
${bloc('Avantages', produit.avantages)}
  </div>
</section>`
    : ''}

${similaires.length
    ? `
<section class="section section-alt">
  <div class="container">
    <div class="bloc-titre">
      <h2>Produits similaires</h2>
      <a class="lien-suite" href="/produits/${echapper(categorie.slug)}/">Toute la catégorie</a>
    </div>
    <div class="catalog-grid">
${similaires.map((p) => carteProduit(p, `/produits/${categorie.slug}/`)).join('\n')}
    </div>
  </div>
</section>`
    : ''}
${appelAAction('Cette référence vous intéresse ?', 'Précisez-nous vos quantités et vos délais : nous établissons votre devis.')}`;

  return page({
    titre: produit.seo_title || `${produit.name} — réf. ${produit.ref} | SEFELEC`,
    description:
      produit.seo_description ||
      resumer(`${produit.desc} Référence ${produit.ref}, disponible chez SEFELEC S.A.R.L. à Casablanca.`),
    chemin: `/produits/${categorie.slug}/${produit.slug}/`,
    motsCles: produit.keywords || '',
    image: produit.image ? `/${produit.image}` : undefined,
    ariane: [
      { nom: 'Accueil', url: '/' },
      { nom: 'Produits', url: '/produits/' },
      { nom: categorie.name, url: `/produits/${categorie.slug}/` },
      { nom: produit.name, url: `/produits/${categorie.slug}/${produit.slug}/` }
    ],
    jsonLd: [
      organisation(),
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: produit.name,
        sku: produit.ref,
        description: produit.desc,
        url: `${SITE}/produits/${categorie.slug}/${produit.slug}/`,
        ...(produit.image ? { image: `${SITE}/${produit.image}` } : {}),
        category: categorie.name,
        brand: { '@type': 'Brand', name: 'SEFELEC' },
        // Les caractéristiques affichées et les données structurées
        // proviennent de la même source : elles ne peuvent pas diverger.
        ...(specs.length
          ? {
              additionalProperty: specs.map(([k, v]) => ({
                '@type': 'PropertyValue',
                name: k,
                value: v
              }))
            }
          : {})
      }
    ],
    contenu,
    services
  });
}
