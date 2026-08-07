/**
 * SEFELEC — Serveur unifié
 * =========================
 * Expose le site public ET le back-office sur un seul port (5500) :
 *
 *   http://localhost:5500/          → site public (fichiers statiques)
 *   http://localhost:5500/admin     → back-office Directus
 *   http://localhost:5500/items/... → API Directus
 *
 * Directus tourne dans un processus distinct, lié à 127.0.0.1 uniquement
 * (donc injoignable depuis l'extérieur). Ce serveur lui relaie les requêtes,
 * exactement comme le ferait nginx en production.
 *
 * Conséquence importante : le site et l'API partagent désormais la même
 * origine, ce qui supprime tout besoin de configuration CORS.
 */

const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 5500;
const SITE_ROOT = __dirname;
const CMS_HOST = process.env.CMS_HOST || '127.0.0.1';
const CMS_PORT = Number(process.env.CMS_PORT) || 8055;

// ---------------------------------------------------------------------------
// Fichiers statiques
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf'
};

/**
 * Liste blanche des ressources publiques.
 *
 * On n'expose QUE ces chemins : le reste du dossier (cms/, tools/, .env,
 * data.db, uploads/…) ne doit jamais être servi au public. Tout ce qui n'est
 * pas dans cette liste est relayé vers Directus.
 */
const STATIC_PREFIXES = ['assets/'];
const STATIC_FILES = new Set(['index.html', 'favicon.ico', 'robots.txt', 'sitemap.xml']);

function resolveStaticFile(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null; // séquence d'échappement invalide
  }

  rel = rel.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';

  const allowed = STATIC_FILES.has(rel) || STATIC_PREFIXES.some((p) => rel.startsWith(p));
  if (!allowed) return null;

  const abs = path.resolve(SITE_ROOT, rel);
  // Garde-fou contre la remontée de répertoire (../)
  if (abs !== SITE_ROOT && !abs.startsWith(SITE_ROOT + path.sep)) return null;

  try {
    return fs.statSync(abs).isFile() ? abs : null;
  } catch {
    return null;
  }
}

function serveStatic(absPath, res) {
  const ext = path.extname(absPath).toLowerCase();
  const body = fs.readFileSync(absPath);

  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': body.length,
    // Le HTML n'est pas mis en cache pour que les modifications soient visibles
    // immédiatement ; les assets le sont brièvement.
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
  });
  res.end(body);
}

// ---------------------------------------------------------------------------
// Relais vers Directus
// ---------------------------------------------------------------------------

function proxyToCms(req, res) {
  const upstream = http.request(
    {
      host: CMS_HOST,
      port: CMS_PORT,
      method: req.method,
      path: req.url,
      // Les en-têtes d'origine sont conservés (dont Host: localhost:5500),
      // pour que Directus génère des URLs cohérentes avec PUBLIC_URL.
      headers: req.headers
    },
    (cmsRes) => {
      res.writeHead(cmsRes.statusCode || 502, cmsRes.headers);
      cmsRes.pipe(res);
    }
  );

  upstream.on('error', () => {
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><meta charset="utf-8">
       <title>Back-office indisponible</title>
       <div style="font-family:system-ui;max-width:520px;margin:80px auto;line-height:1.6">
         <h1 style="color:#1E3A8A">Back-office indisponible</h1>
         <p>Le service d'administration ne répond pas sur le port interne ${CMS_PORT}.</p>
         <p>Lancez <code>demarrer.cmd</code> pour démarrer l'ensemble du projet.</p>
         <p><a href="/" style="color:#E53935;font-weight:700">Retour au site</a></p>
       </div>`
    );
  });

  req.pipe(upstream);
}

// ---------------------------------------------------------------------------
// Serveur
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  // 1) Ressource publique du site → servie directement
  if (req.method === 'GET' || req.method === 'HEAD') {
    const file = resolveStaticFile(pathname);
    if (file) return serveStatic(file, res);
  }

  // 2) Tout le reste (/admin, /auth, /items, /assets, /graphql…) → Directus
  proxyToCms(req, res);
});

// Directus utilise les WebSockets (temps réel, collaboration).
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(CMS_PORT, CMS_HOST, () => {
    const headerLines = Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\r\n');

    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headerLines}\r\n\r\n`);
    if (head && head.length) upstream.write(head);

    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(PORT, () => {
  console.log('');
  console.log('  SEFELEC — serveur unifié');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  Site public   http://localhost:${PORT}/`);
  console.log(`  Back-office   http://localhost:${PORT}/admin`);
  console.log('');
  console.log(`  (Directus relayé depuis ${CMS_HOST}:${CMS_PORT}, interne)`);
  console.log('');
});
