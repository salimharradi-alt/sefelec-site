/**
 * SEFELEC — Import du contenu existant dans Directus
 * ---------------------------------------------------
 * Reprend les données actuellement codées en dur dans le site statique
 * (js/products.js, js/testimonials.js, index.html) et les injecte dans
 * les collections Directus, images comprises.
 *
 * Le script est idempotent : relancé, il met à jour au lieu de dupliquer.
 *
 * Usage :  node scripts/seed-content.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const SITE_ROOT = path.resolve('..');

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

const BASE = env.PUBLIC_URL || 'http://localhost:8055';
let token = null;

// ---------- Client API ----------
async function api(method, endpoint, body, isMultipart = false) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isMultipart) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers,
    body: isMultipart ? body : body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || text || res.statusText;
    const err = new Error(`${method} ${endpoint} → ${res.status} : ${msg}`);
    err.status = res.status;
    throw err;
  }
  return json?.data ?? json;
}

async function login() {
  const data = await api('POST', '/auth/login', {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD
  });
  token = data.access_token;
  console.log('✓ Authentifié');
}

// ---------- Lecture des sources du site statique ----------

/** Évalue un fichier JS de données et récupère les variables demandées. */
function loadJsData(relPath, returnExpr) {
  const src = fs.readFileSync(path.join(SITE_ROOT, relPath), 'utf8');
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\n; return ${returnExpr};`)();
}

/** Extrait les services depuis index.html (nom, description, icône SVG). */
function loadServices() {
  const html = fs.readFileSync(path.join(SITE_ROOT, 'index.html'), 'utf8');
  const cardRe =
    /<article class="service-card">\s*<div class="service-icon">([\s\S]*?)<\/div>\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>\s*<\/article>/g;

  const services = [];
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    services.push({
      icon_svg: m[1].trim(),
      name: decodeEntities(m[2].trim()),
      description: decodeEntities(m[3].trim())
    });
  }
  return services;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '’');
}

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// ---------- Upload d'images ----------
const uploadCache = new Map();

async function uploadImage(relPath, title) {
  if (uploadCache.has(relPath)) return uploadCache.get(relPath);

  const abs = path.join(SITE_ROOT, relPath);
  if (!fs.existsSync(abs)) {
    console.warn(`  ! image introuvable : ${relPath}`);
    return null;
  }

  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';

  const form = new FormData();
  form.append('title', title || path.basename(abs));
  form.append('file', new Blob([buf], { type: mime }), path.basename(abs));

  const file = await api('POST', '/files', form, true);
  uploadCache.set(relPath, file.id);
  console.log(`  ↑ image : ${path.basename(abs)}`);
  return file.id;
}

// ---------- Helpers d'insertion idempotente ----------

/** Crée ou met à jour un item identifié par un champ unique. */
async function upsert(collection, matchField, matchValue, payload) {
  const existing = await api(
    'GET',
    `/items/${collection}?filter[${matchField}][_eq]=${encodeURIComponent(matchValue)}&limit=1`
  );

  if (existing && existing.length) {
    await api('PATCH', `/items/${collection}/${existing[0].id}`, payload);
    return existing[0].id;
  }
  const created = await api('POST', `/items/${collection}`, payload);
  return created.id;
}

// ---------- Import ----------

async function seedCategories(catalogLabels) {
  console.log('\n— Catégories —');
  const map = {};
  let sort = 1;

  for (const [slug, name] of Object.entries(catalogLabels)) {
    const id = await upsert('categories', 'slug', slug, {
      name,
      slug,
      status: 'published',
      sort: sort++,
      seo_title: `${name} — SEFELEC S.A.R.L.`
    });
    map[slug] = id;
    console.log(`  ✓ ${name}`);
  }
  return map;
}

async function seedProducts(catalog, categoryMap) {
  console.log('\n— Produits —');
  let sort = 1;

  for (const p of catalog) {
    const imageId = await uploadImage(p.image, p.name);

    await upsert('products', 'ref', p.ref, {
      name: p.name,
      slug: slugify(p.name),
      ref: p.ref,
      sku: p.ref,
      description: p.desc,
      category: categoryMap[p.category] ?? null,
      price: p.price ?? null,
      tva: 20,
      stock: 0,
      image: imageId,
      specs: p.specs ?? {},
      status: 'published',
      sort: sort++,
      seo_title: `${p.name} — SEFELEC`,
      seo_description: p.desc?.slice(0, 160)
    });
    console.log(`  ✓ ${p.name}`);
  }
}

async function seedServices(services) {
  console.log('\n— Services —');
  let sort = 1;

  for (const s of services) {
    await upsert('services', 'slug', slugify(s.name), {
      name: s.name,
      slug: slugify(s.name),
      description: s.description,
      icon_svg: s.icon_svg,
      status: 'published',
      sort: sort++,
      seo_title: `${s.name} — SEFELEC S.A.R.L.`
    });
    console.log(`  ✓ ${s.name}`);
  }
}

async function seedTestimonials(testimonials) {
  console.log('\n— Témoignages —');
  let sort = 1;

  for (const t of testimonials) {
    await upsert('testimonials', 'name', t.name, {
      name: t.name,
      role: t.role,
      quote: t.quote,
      rating: t.rating ?? 5,
      status: 'published',
      sort: sort++
    });
    console.log(`  ✓ ${t.name}`);
  }
}

async function seedSettings() {
  console.log('\n— Paramètres du site —');

  const logoId = await uploadImage('images/logo-icon.png', 'Logo SEFELEC');
  const faviconId = await uploadImage('images/favicon.png', 'Favicon SEFELEC');

  await api('PATCH', '/items/site_settings', {
    site_name: 'SEFELEC S.A.R.L.',
    tagline: "Travaux d'électricité & armoires électriques",
    logo: logoId,
    favicon: faviconId,
    phone_1: '06 65 84 18 07',
    phone_2: '06 61 95 70 77',
    whatsapp: '212705638780',
    email: 'contact@sefelec.ma',
    address: 'Hay Sâada Rue 27 N°14, Sidi Bernoussi, Casablanca, Maroc',
    map_embed:
      'https://www.google.com/maps?q=Hay+Sa%C3%A2da+Rue+27+N%C2%B014+Sidi+Bernoussi+Casablanca+Maroc&output=embed',
    color_primary: '#1E3A8A',
    color_accent: '#E53935',
    currency: 'MAD',
    shipping_flat: 50,
    shipping_free_threshold: 1000
  });
  console.log('  ✓ Coordonnées et identité visuelle');
}

// ---------- Point d'entrée ----------
async function main() {
  await login();

  const { catalog, catalogLabels } = loadJsData(
    'js/products.js',
    '{ catalog, catalogLabels }'
  );
  const { testimonials } = loadJsData('js/testimonials.js', '{ testimonials }');
  const services = loadServices();

  console.log(
    `\nSources détectées : ${catalog.length} produits, ${Object.keys(catalogLabels).length} catégories, ` +
      `${services.length} services, ${testimonials.length} témoignages`
  );

  const categoryMap = await seedCategories(catalogLabels);
  await seedProducts(catalog, categoryMap);
  await seedServices(services);
  await seedTestimonials(testimonials);
  await seedSettings();

  console.log('\n✓ Import terminé.');
}

main().catch((err) => {
  console.error('\n✗ Échec :', err.message);
  process.exit(1);
});
