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

const SITE_ROOT = path.resolve('..');
const DATA_DIR = path.join(SITE_ROOT, 'assets', 'data');
const IMG_DIR = path.join(SITE_ROOT, 'assets', 'images', 'content');
const BASE = 'http://localhost:5500';

/**
 * Adresse publique du site — utilisée pour générer le sitemap.
 * ⚠️ À adapter si votre domaine est différent. Pensez alors à modifier
 * aussi robots.txt et les balises canonical/Open Graph d'index.html.
 */
const SITE_URL = 'https://www.sefelec.ma';

/** Formats générés pour chaque image, alignés sur les usages du site. */
const PRESETS = { carte: 'carte', large: 'large', miniature: 'miniature' };

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

  const [categories, products, services, testimonials, settings] = await Promise.all([
    api('/items/categories?fields=id,name,slug&sort=sort,name&limit=-1'),
    api(
      '/items/products?fields=id,name,ref,sku,description,price,promo_price,stock,image,specs,' +
        'is_featured,is_popular,is_promo,category.id,category.name,category.slug&sort=sort,name&limit=-1'
    ),
    api('/items/services?fields=id,name,description,icon_svg,image&sort=sort,name&limit=-1'),
    api('/items/testimonials?fields=id,name,role,quote,rating,photo&sort=sort&limit=-1'),
    api('/items/site_settings')
  ]);

  console.log(
    `Contenu récupéré : ${products.length} produits, ${categories.length} catégories, ` +
      `${services.length} services, ${testimonials.length} témoignages\n`
  );

  // --- Produits (avec leurs images) ---
  console.log('— Images des produits —');
  const exportedProducts = [];
  for (const p of products) {
    const hasPromo = p.promo_price != null && Number(p.promo_price) > 0;
    exportedProducts.push({
      id: p.id,
      name: p.name || '(sans nom)',
      ref: p.ref || p.sku || '—',
      desc: p.description || '',
      price: Number(hasPromo ? p.promo_price : p.price) || 0,
      basePrice: Number(p.price) || 0,
      hasPromo,
      stock: p.stock,
      image: await fetchImage(p.image, PRESETS.carte),
      imageLarge: await fetchImage(p.image, PRESETS.large),
      category: p.category?.slug || null,
      categoryName: p.category?.name || '',
      specs: parseJson(p.specs),
      isFeatured: !!p.is_featured,
      isPopular: !!p.is_popular,
      isPromo: !!p.is_promo
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

  // --- Catégories ---
  const labels = {};
  categories.forEach((c) => {
    if (c.slug) labels[c.slug] = c.name;
  });

  // --- Assemblage ---
  const content = {
    generatedAt: new Date().toISOString(),
    settings: settings || {},
    categories: labels,
    products: exportedProducts,
    services: (services || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      icon_svg: s.icon_svg || ''
    })),
    testimonials: exportedTestimonials
  };

  const out = path.join(DATA_DIR, 'content.json');
  fs.writeFileSync(out, JSON.stringify(content, null, 2), 'utf8');

  // --- Sitemap ---
  // Le site tient en une page ; les sections sont des ancres, que les
  // moteurs découvrent seuls. On déclare donc l'URL principale, avec la
  // date réelle de la dernière génération de contenu.
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
  fs.writeFileSync(path.join(SITE_ROOT, 'sitemap.xml'), sitemap, 'utf8');

  const images = fs.readdirSync(IMG_DIR).filter((f) => f.endsWith('.webp'));
  const weight = images.reduce((sum, f) => sum + fs.statSync(path.join(IMG_DIR, f)).size, 0);

  console.log('\n✓ Génération terminée');
  console.log(`  assets/data/content.json      ${(fs.statSync(out).size / 1024).toFixed(1)} Ko`);
  console.log(`  assets/images/content/        ${images.length} fichiers, ${(weight / 1024).toFixed(0)} Ko`);
  console.log(`  sitemap.xml                   ${SITE_URL}/`);
  console.log('\nLe site est prêt à être publié : git add . && git commit && git push');
}

main().catch((err) => {
  console.error('\n✗ Échec :', err.message);
  process.exit(1);
});
