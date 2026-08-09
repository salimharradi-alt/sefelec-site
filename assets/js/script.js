/**
 * SEFELEC — Affichage du site public
 * ===================================
 * Tout le contenu affiché provient de l'API du back-office (voir js/store.js).
 * Aucune donnée n'est codée en dur : produits, catégories, services,
 * témoignages et coordonnées sont ceux saisis dans l'administration.
 */

// ===== Menu mobile =====
const burger = document.getElementById('burger');
const navMobile = document.getElementById('navMobile');

burger.addEventListener('click', () => {
  burger.classList.toggle('open');
  navMobile.classList.toggle('open');
});

navMobile.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    burger.classList.remove('open');
    navMobile.classList.remove('open');
  });
});

// ===== Header ombre au scroll =====
const header = document.getElementById('header');

window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 12);
});

// ===== Back to top =====
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
  backToTop.classList.toggle('visible', window.scrollY > 400);
});

backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== Année courante dans le footer =====
document.getElementById('year').textContent = new Date().getFullYear();

// ===== Toast de confirmation =====
const toast = document.getElementById('toast');
let toastTimer = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

// ===========================================================================
// Catalogue produits
// ===========================================================================
const catalogGrid = document.getElementById('catalogGrid');
const catalogFilters = document.getElementById('catalogFilters');
let activeFilter = 'all';

/** Les filtres sont construits à partir des catégories réellement présentes. */
function renderFilters() {
  const used = [...new Set(catalog.map(p => p.category).filter(Boolean))];
  const buttons = [
    `<button class="filter-btn active" data-filter="all">Tous</button>`,
    ...used.map(slug =>
      `<button class="filter-btn" data-filter="${escapeHtml(slug)}">${escapeHtml(catalogLabels[slug] || slug)}</button>`
    )
  ];
  catalogFilters.innerHTML = buttons.join('');
}

function renderCatalog(filter) {
  const list = filter === 'all' ? catalog : catalog.filter(p => p.category === filter);

  if (!list.length) {
    catalogGrid.innerHTML = `<p class="empty-state">Aucun produit dans cette catégorie pour le moment.</p>`;
    return;
  }

  catalogGrid.innerHTML = list.map(p => `
    <article class="catalog-card" data-id="${p.id}">
      <div class="catalog-photo">
        ${p.image
          // width/height réservent la place avant chargement : évite que la
          // page « saute » (pénalisé par Google — Cumulative Layout Shift).
          ? `<img src="${p.image}" alt="${escapeHtml(p.name)} — SEFELEC" loading="lazy" decoding="async" width="600" height="450">`
          : `<div class="catalog-photo-empty" aria-hidden="true">
               <svg viewBox="0 0 24 24" width="42" height="42" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 15l4.5-4.5 3.5 3.5 3-3L21 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
             </div>`}
      </div>
      ${p.categoryName ? `<span class="catalog-tag">${escapeHtml(p.categoryName)}</span>` : ''}
      <h3>${escapeHtml(p.name)}</h3>
      <span class="catalog-ref">Réf. ${escapeHtml(p.ref)}</span>
      <p>${escapeHtml(p.desc)}</p>
      <span class="catalog-price">
        ${formatPrice(p.price)}
        ${p.hasPromo ? `<s class="catalog-price-old">${formatPrice(p.basePrice)}</s>` : ''}
      </span>
      <div class="catalog-actions">
        <button type="button" class="btn btn-primary catalog-add" data-id="${p.id}">Ajouter au panier</button>
        <button type="button" class="catalog-link" data-id="${p.id}">Voir la fiche technique &rarr;</button>
      </div>
    </article>
  `).join('');
}

catalogFilters.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  catalogFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  renderCatalog(activeFilter);
});

// ===========================================================================
// Modale fiche technique
// ===========================================================================
const productModal = document.getElementById('productModal');
const modalClose = document.getElementById('modalClose');
const modalImg = document.getElementById('modalImg');
const modalRef = document.getElementById('modalRef');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalSpecs = document.getElementById('modalSpecs');
const modalQuoteBtn = document.getElementById('modalQuoteBtn');
const modalAddToCart = document.getElementById('modalAddToCart');

function openProductModal(id) {
  const p = catalog.find(item => item.id === id);
  if (!p) return;

  modalImg.src = p.imageLarge || '';
  modalImg.alt = p.name;
  modalImg.style.display = p.imageLarge ? '' : 'none';
  modalRef.textContent = p.categoryName
    ? `Réf. ${p.ref} — ${p.categoryName}`
    : `Réf. ${p.ref}`;
  modalTitle.textContent = p.name;
  modalDesc.textContent = p.desc;

  const specs = Object.entries(p.specs);
  modalSpecs.innerHTML = specs.length
    ? specs.map(([label, value]) => `
        <tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>
      `).join('')
    : `<tr><td class="empty-state">Aucune caractéristique renseignée.</td></tr>`;

  modalQuoteBtn.onclick = () => {
    const message = document.getElementById('message');
    if (message && !message.value) {
      message.value = `Demande de devis pour : ${p.name} (${p.ref})`;
    }
  };
  modalAddToCart.onclick = () => {
    addToCart(p.id, 1);
    showToast(`${p.name} ajouté au panier`);
  };

  productModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  productModal.classList.remove('open');
  document.body.style.overflow = '';
}

catalogGrid.addEventListener('click', (e) => {
  const linkBtn = e.target.closest('.catalog-link');
  if (linkBtn) { openProductModal(linkBtn.dataset.id); return; }

  const addBtn = e.target.closest('.catalog-add');
  if (addBtn) {
    const p = catalog.find(item => item.id === addBtn.dataset.id);
    addToCart(addBtn.dataset.id, 1);
    if (p) showToast(`${p.name} ajouté au panier`);
  }
});

modalClose.addEventListener('click', closeProductModal);
productModal.addEventListener('click', (e) => {
  if (e.target === productModal) closeProductModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeProductModal();
});

// ===========================================================================
// Services
// ===========================================================================
const servicesGrid = document.getElementById('servicesGrid');

/** Icône de repli lorsque aucun SVG n'est renseigné pour le service. */
const DEFAULT_SERVICE_ICON =
  '<svg viewBox="0 0 24 24" width="28" height="28" fill="none"><path d="M13 2L4 14H11L9 22L20 8H12L13 2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

function renderServices() {
  if (!SERVICES.length) {
    servicesGrid.innerHTML = `<p class="empty-state">Aucun service publié pour le moment.</p>`;
    return;
  }

  servicesGrid.innerHTML = SERVICES.map(s => `
    <article class="service-card">
      <div class="service-icon">${s.icon_svg || DEFAULT_SERVICE_ICON}</div>
      <h3>${escapeHtml(s.name)}</h3>
      <p>${escapeHtml(s.description || '')}</p>
    </article>
  `).join('');
}

// ===========================================================================
// Témoignages
// ===========================================================================
const testimonialsGrid = document.getElementById('testimonialsGrid');

function initials(name) {
  return String(name || '?')
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function renderTestimonials() {
  if (!TESTIMONIALS.length) {
    testimonialsGrid.innerHTML = `<p class="empty-state">Aucun témoignage publié pour le moment.</p>`;
    return;
  }

  testimonialsGrid.innerHTML = TESTIMONIALS.map(t => {
    const rating = Number(t.rating) || 0;
    const stars = Array.from({ length: 5 }, (_, i) =>
      `<svg viewBox="0 0 24 24" width="16" height="16" fill="${i < rating ? '#E53935' : 'none'}" stroke="${i < rating ? '#E53935' : '#C9CED8'}" stroke-width="1.5"><path d="M12 3L14.7 9.2L21.5 9.9L16.4 14.3L17.9 21L12 17.5L6.1 21L7.6 14.3L2.5 9.9L9.3 9.2Z" stroke-linejoin="round"/></svg>`
    ).join('');

    // t.photo est un chemin local généré par le build, ou null
    const avatar = t.photo
      ? `<img class="testimonial-avatar" src="${t.photo}" alt="${escapeHtml(t.name)}">`
      : `<span class="testimonial-avatar">${initials(t.name)}</span>`;

    return `
      <figure class="testimonial-card">
        <div class="testimonial-stars">${stars}</div>
        <blockquote>&ldquo;${escapeHtml(t.quote || '')}&rdquo;</blockquote>
        <figcaption>
          ${avatar}
          <span>
            <strong>${escapeHtml(t.name)}</strong>
            <small>${escapeHtml(t.role || '')}</small>
          </span>
        </figcaption>
      </figure>
    `;
  }).join('');
}

// ===========================================================================
// Coordonnées et identité (paramètres du site)
// ===========================================================================

/** Remplit tous les éléments portant data-setting="champ". */
function renderSettings() {
  document.querySelectorAll('[data-setting]').forEach(el => {
    const value = SETTINGS[el.dataset.setting];
    if (value) el.textContent = value;
  });

  // Liens téléphoniques et WhatsApp
  const tel = (v) => 'tel:+212' + String(v).replace(/\D/g, '').replace(/^0/, '');
  document.querySelectorAll('[data-setting-tel]').forEach(el => {
    const value = SETTINGS[el.dataset.settingTel];
    if (value) el.href = tel(value);
  });
  document.querySelectorAll('[data-setting-wa]').forEach(el => {
    if (SETTINGS.whatsapp) el.href = `https://wa.me/${SETTINGS.whatsapp}`;
  });

  const mail = document.querySelectorAll('[data-setting-mail]');
  mail.forEach(el => {
    if (SETTINGS.email) el.href = `mailto:${SETTINGS.email}`;
  });

  const map = document.getElementById('mapEmbed');
  if (map && SETTINGS.map_embed) map.src = SETTINGS.map_embed;
}

// ===========================================================================
// Formulaire de devis → WhatsApp
// ===========================================================================
const contactForm = document.getElementById('contactForm');

contactForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const number = SETTINGS.whatsapp || '212705638780';
  const data = new FormData(contactForm);
  const lines = [
    'Demande de devis — SEFELEC',
    `Nom : ${data.get('name') || ''}`,
    data.get('company') ? `Entreprise : ${data.get('company')}` : null,
    data.get('email') ? `Email : ${data.get('email')}` : null,
    data.get('phone') ? `Téléphone : ${data.get('phone')}` : null,
    `Projet : ${data.get('message') || ''}`
  ].filter(Boolean);

  const text = encodeURIComponent(lines.join('\n'));
  window.open(`https://wa.me/${number}?text=${text}`, '_blank');
  contactForm.reset();

  if (cartCheckoutPending) {
    clearCart();
    cartCheckoutPending = false;
  }
});

// ===========================================================================
// Démarrage
// ===========================================================================

function showLoadError() {
  const message = `<p class="empty-state">
      Contenu momentanément indisponible. Vérifiez que le back-office est démarré,
      puis rechargez la page.
    </p>`;
  catalogGrid.innerHTML = message;
  servicesGrid.innerHTML = message;
  testimonialsGrid.innerHTML = message;
}

async function init() {
  try {
    await loadAllData();
  } catch (err) {
    console.error('Chargement du contenu impossible :', err);
    showLoadError();
    return;
  }

  renderSettings();
  renderServices();
  renderFilters();
  renderCatalog(activeFilter);
  renderTestimonials();

  // Le panier n'a pu être validé qu'une fois le catalogue connu
  pruneCart();
  renderCart();
}

init();
