// ===== Utilitaire partagé =====
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ===== Panier — état & persistance =====
// SHIPPING_FLAT, SHIPPING_FREE_THRESHOLD et CURRENCY sont définis dans
// js/store.js et alimentés par les paramètres du back-office.
const CART_STORAGE_KEY = 'sefelec_cart_v1';

let cartItems = loadCart();
let cartCheckoutPending = false;

/**
 * Le catalogue étant chargé de façon asynchrone, on ne filtre pas ici sur son
 * contenu : cela viderait le panier au démarrage. Les articles dont le produit
 * n'existe plus sont simplement ignorés à l'affichage (voir getCartLines),
 * puis purgés par pruneCart() une fois les données disponibles.
 */
function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(entry => entry && typeof entry.id === 'string')
      .map(entry => ({ id: entry.id, qty: Math.max(1, Math.min(99, parseInt(entry.qty, 10) || 1)) }));
  } catch (err) {
    return [];
  }
}

/** Retire du panier les produits supprimés ou dépubliés dans l'administration. */
function pruneCart() {
  const before = cartItems.length;
  cartItems = cartItems.filter(item => catalog.some(p => p.id === item.id));
  if (cartItems.length !== before) saveCart();
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
}

function findProduct(id) {
  return catalog.find(p => p.id === id);
}

function addToCart(id, qty = 1) {
  const existing = cartItems.find(item => item.id === id);
  if (existing) {
    existing.qty = Math.min(99, existing.qty + qty);
  } else {
    cartItems.push({ id, qty: Math.min(99, qty) });
  }
  saveCart();
  renderCart();
}

function updateCartQty(id, qty) {
  const item = cartItems.find(i => i.id === id);
  if (!item) return;
  if (qty <= 0) {
    removeFromCart(id);
    return;
  }
  item.qty = Math.min(99, qty);
  saveCart();
  renderCart();
}

function removeFromCart(id) {
  cartItems = cartItems.filter(item => item.id !== id);
  saveCart();
  renderCart();
}

function clearCart() {
  cartItems = [];
  saveCart();
  renderCart();
}

function getCartCount() {
  return cartItems.reduce((sum, item) => sum + item.qty, 0);
}

function getCartLines() {
  return cartItems
    .map(item => {
      const product = findProduct(item.id);
      if (!product) return null;
      return { product, qty: item.qty, subtotal: product.price * item.qty };
    })
    .filter(Boolean);
}

function getCartTotals() {
  const subtotal = getCartLines().reduce((sum, line) => sum + line.subtotal, 0);
  const shipping = subtotal === 0 || subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FLAT;
  return { subtotal, shipping, total: subtotal + shipping };
}

function formatPrice(amount) {
  return `${amount.toLocaleString('fr-FR')} ${CURRENCY}`;
}

// ===== Panier — rendu =====
const cartToggle = document.getElementById('cartToggle');
const cartCountEls = document.querySelectorAll('.cart-count');
const cartDrawer = document.getElementById('cartDrawer');
const cartClose = document.getElementById('cartClose');
const cartContinue = document.getElementById('cartContinue');
const cartCheckout = document.getElementById('cartCheckout');
const cartItemsList = document.getElementById('cartItemsList');
const cartEmpty = document.getElementById('cartEmpty');
const cartFooter = document.getElementById('cartFooter');
const cartSubtotalEl = document.getElementById('cartSubtotal');
const cartShippingEl = document.getElementById('cartShipping');
const cartTotalEl = document.getElementById('cartTotal');

function renderCart() {
  const lines = getCartLines();
  const count = getCartCount();

  cartCountEls.forEach(el => {
    el.textContent = count;
    el.classList.toggle('visible', count > 0);
  });

  if (lines.length === 0) {
    cartItemsList.innerHTML = '';
    cartEmpty.classList.add('visible');
    cartFooter.classList.remove('visible');
    return;
  }

  cartEmpty.classList.remove('visible');
  cartFooter.classList.add('visible');

  cartItemsList.innerHTML = lines.map(({ product, qty, subtotal }) => `
    <div class="cart-item" data-id="${product.id}">
      <div class="cart-item-photo">
        <img src="${product.image}" alt="${escapeHtml(product.name)}">
      </div>
      <div class="cart-item-info">
        <h4>${escapeHtml(product.name)}</h4>
        <span class="cart-item-ref">Réf. ${escapeHtml(product.ref)}</span>
        <span class="cart-item-price">${formatPrice(product.price)} / unité</span>
      </div>
      <div class="cart-item-controls">
        <div class="qty-stepper">
          <button type="button" class="qty-btn" data-action="decrease" aria-label="Diminuer la quantité">&minus;</button>
          <span class="qty-value">${qty}</span>
          <button type="button" class="qty-btn" data-action="increase" aria-label="Augmenter la quantité">&plus;</button>
        </div>
        <span class="cart-item-subtotal">${formatPrice(subtotal)}</span>
        <button type="button" class="cart-item-remove" data-action="remove" aria-label="Retirer l'article">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M4 7H20M9 7V4H15V7M6 7L7 20H17L18 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  const totals = getCartTotals();
  cartSubtotalEl.textContent = formatPrice(totals.subtotal);
  cartShippingEl.textContent = totals.shipping === 0 ? 'Offerte' : formatPrice(totals.shipping);
  cartTotalEl.textContent = formatPrice(totals.total);
}

function openCart() {
  cartDrawer.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartDrawer.classList.remove('open');
  document.body.style.overflow = '';
}

cartToggle.addEventListener('click', openCart);
cartClose.addEventListener('click', closeCart);
cartContinue.addEventListener('click', closeCart);
cartDrawer.addEventListener('click', (e) => {
  if (e.target === cartDrawer) closeCart();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCart();
});

cartItemsList.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.closest('.cart-item').dataset.id;
  const item = cartItems.find(i => i.id === id);
  if (!item) return;

  if (btn.dataset.action === 'increase') updateCartQty(id, item.qty + 1);
  if (btn.dataset.action === 'decrease') updateCartQty(id, item.qty - 1);
  if (btn.dataset.action === 'remove') removeFromCart(id);
});

cartCheckout.addEventListener('click', () => {
  if (cartItems.length === 0) return;

  const lines = getCartLines();
  const totals = getCartTotals();
  const orderLines = lines.map((line, i) =>
    `${i + 1}. ${line.product.name} (${line.product.ref})\n   Qté : ${line.qty} x ${formatPrice(line.product.price)} = ${formatPrice(line.subtotal)}`
  );
  const summary = [
    'Nouvelle commande — SEFELEC',
    '',
    ...orderLines,
    '',
    `Sous-total : ${formatPrice(totals.subtotal)}`,
    `Livraison : ${totals.shipping === 0 ? 'Offerte' : formatPrice(totals.shipping)}`,
    `Total : ${formatPrice(totals.total)}`
  ].join('\n');

  const messageField = document.getElementById('message');
  if (messageField) messageField.value = summary;

  cartCheckoutPending = true;
  closeCart();

  // Vise le formulaire et non le haut de la section : commander est une
  // demande de devis comme une autre, elle doit aboutir au même endroit
  // que les boutons « Demander un devis ».
  document.getElementById('contactForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

renderCart();
