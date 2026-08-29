/**
 * SEFELEC — Génération du contenu statique pour la production
 * ============================================================
 * Exporte tout le contenu de Directus vers des fichiers que l'hébergement
 * mutualisé peut servir directement, sans Node.js ni base de données :
 *
 *   ../assets/data/content.json   tout le contenu du site
 *   ../assets/images/content/*.webp  les images, redimensionnées et compressées
 *
 * Résultat : le site en ligne est 100 % statique. Il ne dépend plus du
 * back-office, qui n'a besoin de tourner que sur votre machine, au moment
 * où vous modifiez le contenu.
 *
 * Le fichier content.json généré est versionné dans Git : il constitue
 * aussi une sauvegarde lisible de tout le contenu du site.
 *
 * Prérequis : Directus démarré (demarrer.cmd)
 * Usage     : npm run build   (depuis la racine du projet)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  pageServices,
  pageService,
  pageProduits,
  pageCategorie,
  pageProduit
} from './lib/generer.mjs';

const SITE_ROOT = path.resolve('..');
const DATA_DIR = path.join(SITE_ROOT, 'assets', 'data');
const IMG_DIR = path.join(SITE_ROOT, 'assets', 'images', 'content');
/**
 * Adresse du back-office à interroger.
 *
 * En local, le serveur unifié du projet. Une fois le tableau de bord en
 * ligne, GitHub Actions passe CMS_URL pour publier sans votre machine :
 * c'est ce qui permet aux modifications du client d'atteindre le site.
 */
const BASE = process.env.CMS_URL || 'http://localhost:5500';

/**
 * Adresse publique du site — utilisée pour générer le sitemap.
 * ⚠️ À adapter si votre domaine est différent. Pensez alors à modifier
 * aussi robots.txt et les balises canonical/Open Graph d'index.html.
 */
const SITE_URL = 'https://www.sefelec.ma';

/** Formats générés pour chaque image, alignés sur les usages du site. */
// « logo » réduit sans recadrer : un logo de partenaire ne doit être ni
// rogné ni étiré, contrairement aux visuels de produits.
const PRESETS = { carte: 'carte', large: 'large', miniature: 'miniature', logo: 'logo' };

// ---------------------------------------------------------------------------

async function api(endpoint) {
  const res = await fetch(`${BASE}${endpoint}`);
  if (!res.ok) {
    throw new Error(
      `${endpoint} → HTTP ${res.status}. Le back-office est-il démarré ? (demarrer.cmd)`
    );
  }
  return (await res.json()).data;
}

/** Télécharge une image dans un format donné et renvoie son chemin local. */
const downloaded = new Map();

async function fetchImage(fileId, preset) {
  if (!fileId) return null;

  const key = `${fileId}-${preset}`;
  if (downloaded.has(key)) return downloaded.get(key);

  const res = await fetch(`${BASE}/assets/${fileId}?key=${preset}`);
  if (!res.ok) {
    console.warn(`  ! image ${fileId} (${preset}) : HTTP ${res.status}, ignorée`);
    downloaded.set(key, null);
    return null;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const filename = `${fileId}-${preset}.webp`;
  fs.writeFileSync(path.join(IMG_DIR, filename), buf);

  // Chemin relatif utilisable tel quel dans le HTML
  const publicPath = `assets/images/content/${filename}`;
  downloaded.set(key, publicPath);
  return publicPath;
}

/** Les champs JSON peuvent revenir sous forme de chaîne selon le moteur SQL. */
function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log('→ Export du contenu depuis le back-office\n');

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(IMG_DIR, { recursive: true });

  // Les anciennes images sont effacées pour éviter d'accumuler
  // des fichiers correspondant à du contenu supprimé.
  for (const f of fs.readdirSync(IMG_DIR)) {
    if (f.endsWith('.webp')) fs.unlinkSync(path.join(IMG_DIR, f));
  }

  const [categories, products, services, testimonials, settings, partners] = await Promise.all([
    api(
      '/items/categories?fields=id,name,slug,description,seo_title,seo_description,keywords' +
        '&sort=sort,name&limit=-1'
    ),
    api(
      '/items/products?fields=id,name,ref,sku,slug,description,stock,image,specs,' +
        'applications,avantages,seo_title,seo_description,keywords,image_alt,' +
        'is_featured,is_popular,is_promo,category.id,category.name,category.slug&sort=sort,name&limit=-1'
    ),
    api(
      '/items/services?fields=id,name,slug,description,details,avantages,applications,equipements,' +
        'featured,icon_svg,image,seo_title,seo_description,keywords&sort=sort,name&limit=-1'
    ),
    api('/items/testimonials?fields=id,name,role,quote,rating,photo&sort=sort&limit=-1'),
    api('/items/site_settings'),
    api('/items/partners?fields=id,name,logo,website,description,image_alt&sort=sort,name&limit=-1')
  ]);

  console.log(
    `Contenu récupéré : ${products.length} produits, ${categories.length} catégories, ` +
      `${services.length} services, ${testimonials.length} témoignages\n`
  );

  // --- Produits (avec leurs images) ---
  console.log('— Images des produits —');
  const exportedProducts = [];
  for (const p of products) {
    exportedProducts.push({
      id: p.id,
      name: p.name || '(sans nom)',
      ref: p.ref || p.sku || '—',
      // Adresse de la fiche produit. Sans elle, pas de page dédiée.
      slug: p.slug || null,
      desc: p.description || '',
      // Les prix ne sont plus exportés. content.json est servi
      // publiquement : y laisser les tarifs reviendrait à les publier,
      // même sans les afficher. Ils restent enregistrés dans Directus,
      // simplement masqués côté tableau de bord.
      applications: p.applications || '',
      avantages: p.avantages || '',
      seo_title: p.seo_title || '',
      seo_description: p.seo_description || '',
      keywords: p.keywords || '',
      image_alt: p.image_alt || '',
      stock: p.stock,
      image: await fetchImage(p.image, PRESETS.carte),
      imageLarge: await fetchImage(p.image, PRESETS.large),
      category: p.category?.slug || null,
      categoryName: p.category?.name || '',
      specs: parseJson(p.specs),
      isFeatured: !!p.is_featured,
      isPopular: !!p.is_popular
    });
    if (p.image) console.log(`  ✓ ${p.name}`);
  }

  // --- Témoignages (photo facultative) ---
  const exportedTestimonials = [];
  for (const t of testimonials) {
    exportedTestimonials.push({
      id: t.id,
      name: t.name,
      role: t.role || '',
      quote: t.quote || '',
      rating: Number(t.rating) || 0,
      photo: await fetchImage(t.photo, PRESETS.miniature)
    });
  }

  // --- Partenaires ---
  // Un partenaire sans logo n'a rien à afficher : il est ignoré plutôt
  // que rendu sous forme de case vide.
  const exportedPartners = [];
  for (const p of partners || []) {
    const logo = await fetchImage(p.logo, PRESETS.logo);
    if (!logo) {
      console.warn(`  ! partenaire « ${p.name} » sans logo, ignoré`);
      continue;
    }

    // Seule une adresse http(s) devient un lien. Une valeur mal saisie
    // produirait un lien mort, ou pire un lien relatif vers le site.
    const site = String(p.website || '').trim();
    const lien = /^https?:\/\//i.test(site) ? site : null;
    if (site && !lien) {
      console.warn(`  ! partenaire « ${p.name} » : adresse ignorée (${site})`);
    }

    exportedPartners.push({
      id: p.id,
      name: p.name,
      logo,
      website: lien,
      description: p.description || '',
      alt: p.image_alt || `Logo ${p.name} — partenaire de SEFELEC`
    });
  }
  if (exportedPartners.length) {
    console.log(`\n— ${exportedPartners.length} partenaire(s) —`);
  }

  // --- Catégories ---
  const labels = {};
  categories.forEach((c) => {
    if (c.slug) labels[c.slug] = c.name;
  });

  // --- Assemblage ---
  const content = {
    generatedAt: new Date().toISOString(),
    // Les réglages tarifaires sont écartés de l'export : devise et frais
    // de livraison n'ont plus d'emploi depuis le passage au devis, et
    // content.json est un fichier public.
    settings: Object.fromEntries(
      Object.entries(settings || {}).filter(
        ([cle]) => !['currency', 'shipping_flat', 'shipping_free_threshold'].includes(cle)
      )
    ),
    categories: labels,
    products: exportedProducts,
    services: (services || []).map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug || null,
      description: s.description || '',
      avantages: s.avantages || '',
      applications: s.applications || '',
      equipements: s.equipements || '',
      seo_title: s.seo_title || '',
      seo_description: s.seo_description || '',
      keywords: s.keywords || '',
      // Contenu du panneau « Lire plus ». Une ligne par élément ;
      // celles commençant par « - » deviennent des puces.
      details: s.details || '',
      // Service principal : carte pleine largeur, en tête de section.
      featured: Boolean(s.featured),
      icon_svg: s.icon_svg || ''
    })),
    testimonials: exportedTestimonials,
    partners: exportedPartners
  };

  const out = path.join(DATA_DIR, 'content.json');
  fs.writeFileSync(out, JSON.stringify(content, null, 2), 'utf8');

  // --- Pages dédiées ---
  // Un dossier par page avec son index.html : l'adresse est propre sans
  // règle de réécriture, et chaque page possède son titre, sa description
  // et ses données structurées.
  console.log('\n— Pages générées —');

  const servicesPublies = content.services.filter((s) => s.slug);
  const categoriesUtiles = (categories || []).filter((c) =>
    exportedProducts.some((p) => p.category === c.slug)
  );

  // Les dossiers sont recréés à chaque génération : une page dont le
  // contenu a été supprimé du back-office ne doit pas survivre en ligne.
  for (const dossier of ['services', 'produits']) {
    fs.rmSync(path.join(SITE_ROOT, dossier), { recursive: true, force: true });
  }

  const urls = [{ loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'weekly' }];

  function ecrirePage(cheminRelatif, html, priorite, frequence = 'monthly') {
    const dossier = path.join(SITE_ROOT, cheminRelatif);
    fs.mkdirSync(dossier, { recursive: true });
    fs.writeFileSync(path.join(dossier, 'index.html'), html, 'utf8');
    urls.push({
      loc: `${SITE_URL}/${cheminRelatif.split(path.sep).join('/')}/`,
      priority: priorite,
      changefreq: frequence
    });
  }

  ecrirePage('services', pageServices(servicesPublies), '0.9', 'monthly');
  for (const service of servicesPublies) {
    // Le service principal est la page la plus importante du site après
    // l'accueil : sa priorité le reflète dans le sitemap.
    ecrirePage(
      path.join('services', service.slug),
      pageService(service, servicesPublies),
      service.featured ? '0.9' : '0.8'
    );
  }
  console.log(`  /services/ + ${servicesPublies.length} pages service`);

  ecrirePage('produits', pageProduits(exportedProducts, categoriesUtiles, servicesPublies), '0.9', 'weekly');
  let nbFiches = 0;
  for (const categorie of categoriesUtiles) {
    const dedans = exportedProducts.filter((p) => p.category === categorie.slug);
    ecrirePage(path.join('produits', categorie.slug), pageCategorie(categorie, dedans, servicesPublies), '0.7');

    for (const produit of dedans) {
      if (!produit.slug) {
        console.warn(`  ! ${produit.name} : pas d'adresse, fiche non générée`);
        continue;
      }
      const similaires = dedans.filter((p) => p.id !== produit.id).slice(0, 3);
      ecrirePage(
        path.join('produits', categorie.slug, produit.slug),
        pageProduit(produit, categorie, similaires, servicesPublies),
        '0.6'
      );
      nbFiches++;
    }
  }
  console.log(`  /produits/ + ${categoriesUtiles.length} catégories + ${nbFiches} fiches produit`);

  // --- Empreinte des feuilles de style et des scripts ---
  //
  // .htaccess demande aux navigateurs de garder ces fichiers 7 jours.
  // Sans cela le site serait lent, mais après une mise à jour un
  // visiteur déjà venu exécutait l'ancien JavaScript avec le nouveau
  // contenu : la section Partenaires restait masquée chez lui alors
  // qu'elle s'affichait chez un nouveau venu. Le cas s'est produit.
  //
  // On ajoute donc à chaque adresse une empreinte de son contenu. Elle
  // ne change que si le fichier change — le cache reste donc pleinement
  // efficace — mais le navigateur voit alors une adresse inédite et va
  // chercher la nouvelle version. Le HTML, lui, est servi sans cache.
  const empreintes = new Map();
  for (const rel of [
    'assets/css/style.css',
    'assets/js/theme.js',
    'assets/js/store.js',
    'assets/js/cart.js',
    'assets/js/script.js'
  ]) {
    const abs = path.join(SITE_ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const hash = crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex').slice(0, 8);
    empreintes.set(rel, hash);
  }

  function estampiller(html) {
    for (const [rel, hash] of empreintes) {
      const nom = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Le chemin peut être relatif (accueil) ou absolu (pages générées) :
      // la barre initiale est capturée puis restituée telle quelle.
      // L'empreinte déjà posée est reprise, ce qui rend l'opération
      // idempotente — un second build ne l'empile pas.
      html = html.replace(
        new RegExp(`(["'])(/?)${nom}(?:\\?v=[^"']*)?\\1`, 'g'),
        (_, guillemet, barre) => `${guillemet}${barre}${rel}?v=${hash}${guillemet}`
      );
    }
    return html;
  }

  for (const page of ['index.html', '404.html']) {
    const abs = path.join(SITE_ROOT, page);
    if (!fs.existsSync(abs)) continue;
    const avant = fs.readFileSync(abs, 'utf8');
    const apres = estampiller(avant);
    if (apres !== avant) fs.writeFileSync(abs, apres, 'utf8');
  }

  // Les pages générées portent la même empreinte.
  for (const dossier of ['services', 'produits']) {
    const racine = path.join(SITE_ROOT, dossier);
    if (!fs.existsSync(racine)) continue;
    const parcourir = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) parcourir(p);
        else if (e.name === 'index.html') {
          fs.writeFileSync(p, estampiller(fs.readFileSync(p, 'utf8')), 'utf8');
        }
      }
    };
    parcourir(racine);
  }
  console.log(`  empreintes posées sur ${empreintes.size} fichier(s) statique(s)`);

  // --- Sitemap ---
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(SITE_ROOT, 'sitemap.xml'), sitemap, 'utf8');

  const images = fs.readdirSync(IMG_DIR).filter((f) => f.endsWith('.webp'));
  const weight = images.reduce((sum, f) => sum + fs.statSync(path.join(IMG_DIR, f)).size, 0);

  console.log('\n✓ Génération terminée');
  console.log(`  assets/data/content.json      ${(fs.statSync(out).size / 1024).toFixed(1)} Ko`);
  console.log(`  assets/images/content/        ${images.length} fichiers, ${(weight / 1024).toFixed(0)} Ko`);
  console.log(`  sitemap.xml                   ${urls.length} adresses`);
  console.log('\nLe site est prêt à être publié : git add . && git commit && git push');
}

main().catch((err) => {
  console.error('\n✗ Échec :', err.message);
  process.exit(1);
});
