/**
 * Plateful v2.0 — Premium Food Ordering Platform
 * Complete Single-Page Application (SPA)
 *
 * Features:
 * - Full routing with hash-based SPA
 * - Cart with localStorage persistence
 * - AI Food Assistant (menu-filter based)
 * - Plateful Rewards system
 * - Reviews
 * - Favorites
 * - Mobile hamburger nav
 * - Skeleton loaders
 * - Premium animations
 */

'use strict';

/* ============================================================
   DOM Helpers
   ============================================================ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $('#view');

/* ============================================================
   Constants
   ============================================================ */
const STATUSES = ['PLACED', 'ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'SCHEDULED', 'READY_FOR_PICKUP'];

const STATUS_LABEL = {
  PLACED: 'Order Placed',
  ACCEPTED: 'Accepted',
  PREPARING: 'Kitchen Preparing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  SCHEDULED: 'Scheduled'
};

const CURRENCY = '₹';
const TAX_PERCENT = 5;

/* ============================================================
   Utility: XSS-safe HTML escaping
   ============================================================ */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const money = n => CURRENCY + Number(n || 0).toFixed(0);

/* ============================================================
   Local Storage Helper
   ============================================================ */
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};

/* ============================================================
   Application State
   ============================================================ */
let user = store.get('user', null);
let cart = store.get('cart', {
  restaurantId: null,
  restaurantName: '',
  restaurantDeliveryFee: 0,
  lines: [],
  couponCode: '',
  discount: 0,
  rewardPointsToRedeem: 0,
  rewardDiscount: 0
});

let menuCache = {};
let currentCategory = 'All';
let currentSearch = '';
let currentSort = 'rating';
let vegOnlyFilter = false;
let isMobileNavOpen = false;

/* ============================================================
   API Client
   ============================================================ */
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (user && user.token) headers['Authorization'] = 'Bearer ' + user.token;

  const res = await fetch('/api' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }

  if (!res.ok) {
    if (res.status === 401 && user) logout(true);
    throw new Error((data && data.message) || 'Something went wrong (' + res.status + ')');
  }
  return data;
}

/* ============================================================
   Toast Notifications
   ============================================================ */
const toastEl = $('#toast');
let toastTimer;

function toast(msg, type = 'success') {
  // type: 'success' | 'error' | 'info'
  const txt = $('#toastText');
  const icon = $('#toastIcon');
  txt.textContent = msg;
  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
  };
  icon.innerHTML = icons[type] || icons.success;
  toastEl.className = 'toast show';
  if (type === 'error') toastEl.classList.add('bad');
  if (type === 'info') toastEl.classList.add('info');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
}

/* ============================================================
   Mobile Navigation
   ============================================================ */
const hamburgerBtn = $('#hamburgerBtn');
const mobileNav = $('#mobileNav');

hamburgerBtn.addEventListener('click', () => {
  isMobileNavOpen = !isMobileNavOpen;
  hamburgerBtn.classList.toggle('active', isMobileNavOpen);
  hamburgerBtn.setAttribute('aria-expanded', isMobileNavOpen);
  mobileNav.hidden = !isMobileNavOpen;
});

function closeMobileNav() {
  isMobileNavOpen = false;
  hamburgerBtn.classList.remove('active');
  hamburgerBtn.setAttribute('aria-expanded', false);
  mobileNav.hidden = true;
}

$('#mNavAuth').addEventListener('click', () => { closeMobileNav(); openAuth('login'); });
$('#mNavAI').addEventListener('click', () => { closeMobileNav(); openAIDialog(); });

$$('[class="mobile-nav-link"]', mobileNav).forEach(link => {
  if (link.tagName === 'A') {
    link.addEventListener('click', closeMobileNav);
  }
});

/* ============================================================
   Auth & User Session
   ============================================================ */
function setUser(u) {
  user = u;
  if (u) store.set('user', u);
  else store.del('user');
  updateNav();
}

function updateNav() {
  const authBtnText = $('#authBtnText');
  const adminLink = $('#adminLink');
  const ownerLink = $('#ownerLink');
  const mNavOwner = $('#mNavOwner');
  const mNavAdmin = $('#mNavAdmin');
  const mNavAuth = $('#mNavAuth');
  const dropdownUserName = $('#dropdownUserName');
  const dropdownUserRole = $('#dropdownUserRole');
  const dropdownRewards = $('#dropdownRewards');
  const dropdownRewardPts = $('#dropdownRewardPts');
  const headerLocText = $('#headerLocText');

  if (user) {
    authBtnText.textContent = user.name.split(' ')[0];
    dropdownUserName.textContent = user.name;
    dropdownUserRole.textContent = user.role.replace(/_/g, ' ');
    if (user.defaultAddress) {
      const city = user.defaultAddress.split(',').pop()?.trim() || user.defaultAddress.split(',')[0]?.trim() || 'Home';
      headerLocText.textContent = city;
    }
    if (user.rewardPoints > 0) {
      dropdownRewards.hidden = false;
      dropdownRewardPts.textContent = user.rewardPoints.toLocaleString();
    } else {
      dropdownRewards.hidden = true;
    }
    mNavAuth.textContent = user.name.split(' ')[0] + ' ▾';
  } else {
    authBtnText.textContent = 'Sign in';
    headerLocText.textContent = 'Mumbai';
    dropdownRewards.hidden = true;
    mNavAuth.textContent = 'Sign In';
  }

  adminLink.hidden = !(user && user.role === 'ADMIN');
  ownerLink.hidden = !(user && (user.role === 'RESTAURANT_OWNER' || user.role === 'ADMIN'));
  mNavOwner.hidden = ownerLink.hidden;
  mNavAdmin.hidden = adminLink.hidden;

  const h = location.hash || '#/';
  $$('[data-nav]').forEach(a => {
    const key = a.dataset.nav;
    const on = (key === 'home' && (h === '#/' || h.startsWith('#/r/'))) ||
               (key === 'orders' && h === '#/orders') ||
               (key === 'owner' && h === '#/owner') ||
               (key === 'admin' && h === '#/admin');
    a.classList.toggle('active', on);
  });
}

function logout(expired = false) {
  setUser(null);
  $('#userDropdown').hidden = true;
  if (expired) toast('Session expired. Please sign in again.', 'error');
  else toast('Logged out. See you soon! 👋');
  if (['#/orders', '#/admin', '#/owner'].includes(location.hash)) {
    location.hash = '#/';
  } else {
    route();
  }
}

/* Auth Dialog */
const authDialog = $('#authDialog');
let authMode = 'login';

function openAuth(mode = 'login') {
  authMode = mode;
  $('#tabLogin').classList.toggle('active', mode === 'login');
  $('#tabRegister').classList.toggle('active', mode === 'register');
  $('#tabLogin').setAttribute('aria-selected', mode === 'login');
  $('#tabRegister').setAttribute('aria-selected', mode === 'register');
  $('#registerFields').hidden = mode === 'login';
  $('#authSubmit').textContent = mode === 'login' ? 'Log In' : 'Create Account';
  $('#authError').textContent = '';
  if (!authDialog.open) authDialog.showModal();
}

$('#tabLogin').onclick = () => openAuth('login');
$('#tabRegister').onclick = () => openAuth('register');
$('#authCloseBtn').onclick = () => authDialog.close();

// Password visibility toggle
$('#passwordToggle').onclick = () => {
  const input = $('#authPassword');
  input.type = input.type === 'password' ? 'text' : 'password';
};

// 1-Click Demo Login
$$('[data-demo-role]').forEach(btn => {
  btn.onclick = async () => {
    const role = btn.dataset.demoRole;
    let email = 'sarah@plateful.com', pass = 'sarah123';
    if (role === 'owner') { email = 'owner@lantern.com'; pass = 'owner123'; }
    if (role === 'admin') { email = 'admin@plateful.com'; pass = 'admin123'; }
    try {
      btn.disabled = true;
      btn.textContent = '...';
      const u = await api('/auth/login', { method: 'POST', body: { email, password: pass } });
      setUser(u);
      authDialog.close();
      toast('Welcome back, ' + u.name.split(' ')[0] + '! 🎉');
      route();
    } catch (e) {
      $('#authError').textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = role === 'customer' ? 'Customer' : role === 'owner' ? 'Merchant' : 'Admin';
    }
  };
});

$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const btn = $('#authSubmit');
  btn.disabled = true;
  btn.innerHTML = '<span class="inline-spinner"></span>';
  $('#authError').textContent = '';

  try {
    const body = { email: f.get('email'), password: f.get('password') };
    if (authMode === 'register') {
      body.name = f.get('name');
      body.role = f.get('role');
      body.phone = f.get('phone');
      body.address = f.get('address');
    }
    const u = await api('/auth/' + authMode, { method: 'POST', body });
    setUser(u);
    authDialog.close();
    e.target.reset();
    toast(authMode === 'register' ? 'Welcome to Plateful! You got 200 bonus points 🎉' : 'Welcome back, ' + u.name.split(' ')[0] + '!');
    route();
  } catch (err) {
    $('#authError').textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? 'Log In' : 'Create Account';
  }
});

// Auth Button
$('#authBtn').addEventListener('click', e => {
  e.stopPropagation();
  if (!user) {
    openAuth('login');
  } else {
    const d = $('#userDropdown');
    const isOpen = !d.hidden;
    d.hidden = isOpen;
    $('#authBtn').setAttribute('aria-expanded', !isOpen);
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('#userMenuWrapper')) {
    $('#userDropdown').hidden = true;
    $('#authBtn').setAttribute('aria-expanded', false);
  }
});

$('#menuLogoutBtn').onclick = () => { $('#userDropdown').hidden = true; logout(); };
$('#menuOrdersBtn').onclick = () => { $('#userDropdown').hidden = true; location.hash = '#/orders'; };
$('#menuProfileBtn').onclick = () => { $('#userDropdown').hidden = true; openProfileDialog(); };
$('#menuFavoritesBtn').onclick = () => { $('#userDropdown').hidden = true; showFavoritesPage(); };
$('#menuRewardsBtn').onclick = () => { $('#userDropdown').hidden = true; openRewardsDialog(); };

/* Profile Dialog */
const profileDialog = $('#profileDialog');

function openProfileDialog() {
  if (!user) return openAuth('login');
  $('#profName').value = user.name || '';
  $('#profPhone').value = user.phone || '';
  $('#profAddress').value = user.defaultAddress || '';
  $('#profileError').textContent = '';
  $('#passwordError').textContent = '';
  profileDialog.showModal();
}

$('#profileCloseBtn').onclick = () => profileDialog.close();

$('#profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const btn = $('#saveProfileBtn');
  btn.disabled = true;
  try {
    const u = await api('/auth/profile', {
      method: 'PUT',
      body: { name: f.get('name'), phone: f.get('phone'), defaultAddress: f.get('defaultAddress') }
    });
    setUser(u);
    toast('Profile updated successfully');
    profileDialog.close();
  } catch (err) {
    $('#profileError').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

$('#passwordForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const btn = $('#savePasswordBtn');
  btn.disabled = true;
  try {
    await api('/auth/change-password', {
      method: 'PUT',
      body: { oldPassword: f.get('oldPassword'), newPassword: f.get('newPassword') }
    });
    toast('Password changed successfully');
    e.target.reset();
    profileDialog.close();
  } catch (err) {
    $('#passwordError').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

/* ============================================================
   Shopping Cart
   ============================================================ */
const cartDrawer = $('#cartDrawer');
const scrim = $('#scrim');

function openCartDrawer() {
  cartDrawer.hidden = false;
  scrim.hidden = false;
  renderCart();
  cartDrawer.focus && cartDrawer.focus();
}

function closeCartDrawer() {
  cartDrawer.hidden = true;
  scrim.hidden = true;
}

$('#cartBtn').onclick = () => cartDrawer.hidden ? openCartDrawer() : closeCartDrawer();
$('#cartClose').onclick = closeCartDrawer;
scrim.onclick = () => { closeCartDrawer(); closeMobileNav(); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!cartDrawer.hidden) closeCartDrawer();
    if (isMobileNavOpen) closeMobileNav();
  }
});

function saveCart() {
  store.set('cart', cart);
  updateCartBadge();
  if (!cartDrawer.hidden) renderCart();
  renderDishButtons();
}

function updateCartBadge() {
  const count = cart.lines.reduce((s, l) => s + l.qty, 0);
  const badge = $('#cartCount');
  badge.textContent = count;
  badge.classList.add('bump');
  setTimeout(() => badge.classList.remove('bump'), 300);
  $('#cartBtnTotal').textContent = money(cartSubtotal());
}

const cartSubtotal = () => cart.lines.reduce((s, l) => s + l.price * l.qty, 0);

function addToCart(restaurant, item) {
  if (!item.available) { toast('This item is currently unavailable', 'error'); return; }

  if (cart.restaurantId && cart.restaurantId !== restaurant.id && cart.lines.length) {
    if (!confirm(`Your cart has items from ${cart.restaurantName}.\n\nStart a fresh order from ${restaurant.name}?`)) return;
    cart = { restaurantId: null, restaurantName: '', restaurantDeliveryFee: 0, lines: [], couponCode: '', discount: 0, rewardPointsToRedeem: 0, rewardDiscount: 0 };
  }

  cart.restaurantId = restaurant.id;
  cart.restaurantName = restaurant.name;
  cart.restaurantDeliveryFee = restaurant.deliveryFee || 0;

  const existing = cart.lines.find(l => l.menuItemId === item.id);
  if (existing) {
    existing.qty = Math.min(50, existing.qty + 1);
  } else {
    cart.lines.push({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      qty: 1
    });
  }

  saveCart();
  toast(`${item.name} added to order`);
}

function changeCartQty(id, delta) {
  const line = cart.lines.find(l => l.menuItemId === id);
  if (!line) return;
  line.qty = Math.min(50, line.qty + delta);
  if (line.qty <= 0) cart.lines = cart.lines.filter(l => l !== line);
  if (!cart.lines.length) {
    cart.restaurantId = null;
    cart.restaurantName = '';
    cart.couponCode = '';
    cart.discount = 0;
    cart.rewardPointsToRedeem = 0;
    cart.rewardDiscount = 0;
  }
  saveCart();
}

function renderCart() {
  updateCartBadge();
  const body = $('#cartBody');
  const count = cart.lines.reduce((s, l) => s + l.qty, 0);
  $('#cartSubtitle').textContent = count === 1 ? '1 item' : `${count} items`;

  if (!cart.lines.length) {
    body.innerHTML = `
      <div class="empty-state" style="padding:2rem 1rem;">
        <div class="empty-state-icon">🛒</div>
        <h3 class="empty-state-title" style="font-size:1.25rem;">Your cart is empty</h3>
        <p class="empty-state-desc" style="font-size:0.875rem;">Pick a restaurant and add some handcrafted dishes to get started.</p>
        <button class="btn btn-primary" onclick="closeCartDrawer(); location.hash='#/';">Browse Restaurants</button>
      </div>`;
    return;
  }

  const sub = cartSubtotal();
  const fee = cart.restaurantDeliveryFee || 0;
  const disc = cart.discount || 0;
  const rewardDisc = cart.rewardDiscount || 0;
  const taxable = Math.max(0, sub + fee - disc - rewardDisc);
  const tax = Math.round(taxable * TAX_PERCENT / 100 * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;

  const rewardBalance = user ? (user.rewardPoints || 0) : 0;
  const maxRedeemablePoints = Math.min(rewardBalance, Math.floor(sub / 0.5)); // can redeem up to 50% of subtotal

  body.innerHTML = `
    <div class="cart-restaurant-banner">
      <div class="cart-restaurant-label">Ordering From</div>
      <div class="cart-restaurant-name">${esc(cart.restaurantName)}</div>
    </div>

    <div class="cart-items-wrapper">
      ${cart.lines.map(l => `
        <div class="cart-item">
          <img class="cart-item-thumb" src="${esc(l.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100')}" alt="${esc(l.name)}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'" loading="lazy">
          <div class="cart-item-details">
            <div class="cart-item-name">${esc(l.name)}</div>
            <div class="cart-item-price">${money(l.price * l.qty)} <span style="font-size:0.75rem;color:var(--text-soft);">(${money(l.price)} each)</span></div>
          </div>
          <div class="cart-item-stepper">
            <button type="button" data-cart-delta="-1" data-id="${esc(l.menuItemId)}" aria-label="Decrease quantity">&minus;</button>
            <span class="cart-item-qty">${l.qty}</span>
            <button type="button" data-cart-delta="1" data-id="${esc(l.menuItemId)}" aria-label="Increase quantity">&plus;</button>
          </div>
        </div>`).join('')}
    </div>

    <!-- Coupon Box -->
    <div class="promo-box">
      <div class="promo-form">
        <input type="text" id="couponInput" placeholder="PROMO CODE" value="${esc(cart.couponCode || '')}" aria-label="Enter coupon code">
        <button class="btn btn-primary small" type="button" id="applyCouponBtn">Apply</button>
      </div>
      <div class="promo-chips-list">
        <span class="promo-tag" data-apply-code="WELCOME20" title="20% off up to ₹100">WELCOME20</span>
        <span class="promo-tag" data-apply-code="FREESHIP" title="Free delivery">FREESHIP</span>
        <span class="promo-tag" data-apply-code="TASTY10" title="₹100 off on ₹300+">TASTY10</span>
        <span class="promo-tag" data-apply-code="PLATEFUL50" title="₹50 off on ₹200+">PLATEFUL50</span>
      </div>
    </div>

    <!-- Rewards Redemption -->
    ${user && rewardBalance >= 100 ? `
    <div class="rewards-redeem-box">
      <div class="rewards-redeem-title">
        ⭐ You have ${rewardBalance} Plateful Points (worth ${CURRENCY}${Math.floor(rewardBalance * 0.5)})
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
        <input type="number" id="rewardRedeemInput" min="100" max="${maxRedeemablePoints}" step="100" value="${cart.rewardPointsToRedeem || 0}" style="width:90px; padding:0.3rem 0.5rem; border:1px solid #f59e0b; border-radius:var(--radius-sm); font-weight:700; font-size:0.85rem;">
        <button class="btn small" type="button" id="applyRewardBtn" style="background:#f59e0b; color:#fff; border:none;">Redeem Points</button>
        ${cart.rewardPointsToRedeem > 0 ? `<span style="font-size:0.78rem; font-weight:700; color:var(--primary);">−${CURRENCY}${cart.rewardDiscount} saved!</span>` : ''}
      </div>
    </div>` : ''}

    <!-- Delivery Details -->
    <div class="checkout-section">
      <label class="checkout-label">Delivery Address *</label>
      <textarea class="checkout-input" id="orderAddress" rows="2" placeholder="Street, Apartment, Floor, Landmark">${esc(user ? (user.defaultAddress || '') : '')}</textarea>

      <label class="checkout-label">Contact Phone</label>
      <input type="tel" class="checkout-input" id="orderPhone" placeholder="Mobile for delivery updates" value="${esc(user ? (user.phone || '') : '')}">

      <label class="checkout-label">Special Instructions</label>
      <input type="text" class="checkout-input" id="orderNotes" placeholder="e.g. Leave at door, extra spicy">

      <label class="checkout-label">Payment Method</label>
      <div class="payment-options">
        <div class="payment-card active" data-pay="UPI" role="button" tabindex="0">📱 UPI</div>
        <div class="payment-card" data-pay="CARD" role="button" tabindex="0">💳 Card</div>
        <div class="payment-card" data-pay="COD" role="button" tabindex="0">💵 Cash</div>
      </div>
    </div>

    <!-- Bill Summary -->
    <div class="bill-summary">
      <div class="bill-row"><span>Item Subtotal</span><span>${money(sub)}</span></div>
      <div class="bill-row"><span>Delivery Fee</span><span>${fee === 0 ? '<strong style="color:var(--primary);">FREE</strong>' : money(fee)}</span></div>
      ${disc > 0 ? `<div class="bill-row discount"><span>Coupon (${esc(cart.couponCode)})</span><span>−${money(disc)}</span></div>` : ''}
      ${rewardDisc > 0 ? `<div class="bill-row discount"><span>Rewards Discount</span><span>−${money(rewardDisc)}</span></div>` : ''}
      <div class="bill-row"><span>GST (${TAX_PERCENT}%)</span><span>${money(tax)}</span></div>
      <div class="bill-row total"><span>Total to Pay</span><span style="font-size:1.15rem;">${money(total)}</span></div>
    </div>

    ${user ? `<p style="font-size:0.78rem; color:var(--primary); font-weight:600; text-align:center;">
      You'll earn ~<strong>${Math.floor(total / 10)} points</strong> on this order
    </p>` : ''}

    <p class="error" id="cartError" role="alert"></p>

    <button class="btn btn-primary btn-block" id="placeOrderBtn" type="button" style="padding:0.85rem; font-size:1rem; font-weight:800;">
      Place Order • ${money(total)}
    </button>
    <button class="btn ghost small btn-block" id="emptyCartBtn" type="button" style="margin-top:0.5rem;">Clear Cart</button>
  `;
}

/* Cart Events Delegation */
$('#cartBody').addEventListener('click', async e => {
  const stepper = e.target.closest('[data-cart-delta]');
  if (stepper) { changeCartQty(stepper.dataset.id, Number(stepper.dataset.cartDelta)); return; }

  const promoTag = e.target.closest('[data-apply-code]');
  if (promoTag) { $('#couponInput').value = promoTag.dataset.applyCode; await applyCoupon(promoTag.dataset.applyCode); return; }

  if (e.target.id === 'applyCouponBtn') { await applyCoupon($('#couponInput').value.trim()); return; }

  if (e.target.id === 'applyRewardBtn') {
    const pts = parseInt($('#rewardRedeemInput').value || 0);
    if (pts < 100) { toast('Minimum 100 points required', 'error'); return; }
    if ((user.rewardPoints || 0) < pts) { toast('Insufficient points balance', 'error'); return; }
    const disc = Math.round(pts * 0.5 * 100) / 100;
    cart.rewardPointsToRedeem = pts;
    cart.rewardDiscount = disc;
    saveCart();
    toast(`${pts} points applied — ${money(disc)} discount!`);
    return;
  }

  const payCard = e.target.closest('[data-pay]');
  if (payCard) {
    $$('.payment-card').forEach(c => c.classList.remove('active'));
    payCard.classList.add('active');
    return;
  }

  if (e.target.id === 'emptyCartBtn') {
    cart = { restaurantId: null, restaurantName: '', restaurantDeliveryFee: 0, lines: [], couponCode: '', discount: 0, rewardPointsToRedeem: 0, rewardDiscount: 0 };
    saveCart();
    return;
  }

  if (e.target.id === 'placeOrderBtn') {
    await submitOrder();
  }
});

async function applyCoupon(code) {
  if (!code) {
    cart.couponCode = '';
    cart.discount = 0;
    saveCart();
    return;
  }
  try {
    const res = await api('/orders/coupon/validate', {
      method: 'POST',
      body: { code, subtotal: cartSubtotal(), deliveryFee: cart.restaurantDeliveryFee || 0 }
    });
    if (res.valid) {
      cart.couponCode = res.code;
      cart.discount = res.discount;
      saveCart();
      toast(`✅ ${res.message}`);
    } else {
      toast(res.message, 'error');
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function submitOrder() {
  const errBox = $('#cartError');
  errBox.textContent = '';

  if (!user) {
    closeCartDrawer();
    openAuth('login');
    toast('Please sign in to place an order', 'info');
    return;
  }

  const address = $('#orderAddress').value.trim();
  if (!address) { errBox.textContent = 'Please enter a delivery address.'; return; }

  const phone = $('#orderPhone').value.trim();
  const specialInstructions = $('#orderNotes').value.trim();
  const activePay = $('.payment-card.active');
  const paymentMethod = activePay ? activePay.dataset.pay : 'UPI';

  const btn = $('#placeOrderBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="inline-spinner"></span> Processing...';

  try {
    const placed = await api('/orders', {
      method: 'POST',
      body: {
        restaurantId: cart.restaurantId,
        address,
        phone,
        specialInstructions,
        couponCode: cart.couponCode,
        paymentMethod,
        rewardPoints: cart.rewardPointsToRedeem || 0,
        items: cart.lines.map(l => ({ menuItemId: l.menuItemId, quantity: l.qty }))
      }
    });

    // Update local user reward points if redeemed
    if (cart.rewardPointsToRedeem > 0 && user) {
      user.rewardPoints = Math.max(0, (user.rewardPoints || 0) - cart.rewardPointsToRedeem);
      store.set('user', user);
      updateNav();
    }

    cart = { restaurantId: null, restaurantName: '', restaurantDeliveryFee: 0, lines: [], couponCode: '', discount: 0, rewardPointsToRedeem: 0, rewardDiscount: 0 };
    saveCart();
    closeCartDrawer();
    toast(`🎉 Order placed! You'll earn ${placed.rewardPointsEarned || 0} points on delivery.`);
    location.hash = '#/orders';
  } catch (err) {
    errBox.textContent = err.message;
    btn.disabled = false;
    btn.innerHTML = 'Place Order';
  }
}

/* ============================================================
   AI Food Assistant
   ============================================================ */
const aiDialog = $('#aiDialog');

function openAIDialog() {
  if (!aiDialog.open) {
    aiDialog.showModal();
    // Show welcome message
    const msgs = $('#aiMessages');
    if (!msgs.children.length) {
      addAIMessage('bot', null, `Hey there! 👋 I'm your <strong>Plateful AI Food Assistant</strong>. I can help you find the perfect dish based on your preferences, budget, or cravings.<br><br>What would you like to eat today?`);
    }
  }
}

$('#aiAssistBtn').onclick = () => openAIDialog();
$('#aiCloseBtn').onclick = () => aiDialog.close();

$$('.ai-suggest-chip').forEach(chip => {
  chip.onclick = () => {
    $('#aiQueryInput').value = chip.dataset.suggest;
    $('#aiForm').dispatchEvent(new Event('submit'));
  };
});

function addAIMessage(type, results, text) {
  const msgs = $('#aiMessages');
  const msg = document.createElement('div');
  msg.className = `ai-msg ai-msg-${type}`;

  if (type === 'user') {
    msg.textContent = text;
  } else {
    const header = document.createElement('div');
    header.className = 'ai-msg-bot-header';
    header.innerHTML = '✨ Plateful AI';
    msg.appendChild(header);

    if (text) {
      const p = document.createElement('div');
      p.style.cssText = 'font-size:0.875rem; color:var(--text-body); margin-bottom:0.5rem; line-height:1.5;';
      p.innerHTML = text;
      msg.appendChild(p);
    }

    if (results && results.length > 0) {
      const resultsEl = document.createElement('div');
      resultsEl.className = 'ai-dish-results';
      results.forEach(item => {
        const r = document.createElement('div');
        r.className = 'ai-dish-result';
        r.innerHTML = `
          <img class="ai-dish-result-img" src="${esc(item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100')}" alt="${esc(item.name)}" loading="lazy">
          <div class="ai-dish-result-info">
            <div class="ai-dish-result-name">${esc(item.name)}</div>
            <div class="ai-dish-result-rest">${esc(item.restaurantName)}</div>
            ${item.vegetarian ? '<span style="font-size:0.68rem; color:#15803d; font-weight:700;">🌱 Veg</span>' : ''}
            ${item.spicy ? '<span style="font-size:0.68rem; color:#b45309; font-weight:700; margin-left:4px;">🌶️ Spicy</span>' : ''}
          </div>
          <div class="ai-dish-result-price">${CURRENCY}${item.price}</div>`;
        r.dataset.itemId = item.id;
        r.dataset.restId = item.restaurantId;
        r.onclick = () => {
          aiDialog.close();
          location.hash = '#/r/' + item.restaurantId;
        };
        resultsEl.appendChild(r);
      });
      msg.appendChild(resultsEl);
    }
  }

  msgs.appendChild(msg);
  msgs.scrollTop = msgs.scrollHeight;
}

$('#aiForm').addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('#aiQueryInput');
  const query = input.value.trim();
  if (!query) return;

  addAIMessage('user', null, query);
  input.value = '';

  const sendBtn = $('#aiSendBtn');
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="inline-spinner"></span>';

  try {
    const res = await api('/ai/recommend', { method: 'POST', body: { query } });
    addAIMessage('bot', res.results, res.explanation);
  } catch (err) {
    addAIMessage('bot', null, 'Sorry, I had trouble understanding that. Try something like "veg dishes under ₹300" or "spicy noodles".');
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  }
});

/* ============================================================
   Rewards Dialog
   ============================================================ */
const rewardsDialog = $('#rewardsDialog');

async function openRewardsDialog() {
  if (!user) { openAuth('login'); return; }
  rewardsDialog.showModal();
  $('#rewardsPtsNum').textContent = (user.rewardPoints || 0).toLocaleString();
  $('#rewardsValueHint').textContent = `Worth ${CURRENCY}${Math.floor((user.rewardPoints || 0) * 0.5)}`;
  $('#rewardsTxns').innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  try {
    const data = await api('/rewards');
    user.rewardPoints = data.points;
    store.set('user', user);
    updateNav();
    $('#rewardsPtsNum').textContent = data.points.toLocaleString();
    $('#rewardsValueHint').textContent = `Worth ${CURRENCY}${Math.floor(data.points * 0.5)}`;

    if (!data.transactions.length) {
      $('#rewardsTxns').innerHTML = '<p style="color:var(--text-muted); font-size:0.875rem; text-align:center; padding:1rem;">No transactions yet. Place an order to earn points!</p>';
      return;
    }

    $('#rewardsTxns').innerHTML = data.transactions.map(t => `
      <div class="rewards-txn-item">
        <div>
          <div style="font-weight:600; font-size:0.82rem;">${esc(t.description)}</div>
          <div style="font-size:0.72rem; color:var(--text-soft);">${new Date(t.createdAt).toLocaleDateString()}</div>
        </div>
        <span class="${t.type === 'EARN' ? 'txn-earn' : 'txn-redeem'}">
          ${t.type === 'EARN' ? '+' : ''}${t.points} pts
        </span>
      </div>`).join('');
  } catch (err) {
    $('#rewardsTxns').innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

$('#rewardsCloseBtn').onclick = () => rewardsDialog.close();

/* ============================================================
   Reviews
   ============================================================ */
const reviewDialog = $('#reviewDialog');
let currentReviewRating = 0;

function openReviewDialog(orderId, restaurantId) {
  if (!user) { openAuth('login'); return; }
  $('#reviewOrderId').value = orderId;
  $('#reviewRestaurantId').value = restaurantId;
  currentReviewRating = 0;
  $('#reviewRating').value = 0;
  $$('.star-btn').forEach(b => b.classList.remove('active'));
  $('#reviewComment').value = '';
  $('#reviewError').textContent = '';
  reviewDialog.showModal();
}

$('#reviewCloseBtn').onclick = () => reviewDialog.close();

// Star rating interaction
$('#starRatingWrap').addEventListener('click', e => {
  const star = e.target.closest('.star-btn');
  if (star) {
    currentReviewRating = parseInt(star.dataset.star);
    $('#reviewRating').value = currentReviewRating;
    $$('.star-btn').forEach((b, i) => b.classList.toggle('active', i < currentReviewRating));
  }
});

$('#starRatingWrap').addEventListener('mouseover', e => {
  const star = e.target.closest('.star-btn');
  if (star) {
    const hover = parseInt(star.dataset.star);
    $$('.star-btn').forEach((b, i) => b.classList.toggle('active', i < hover));
  }
});

$('#starRatingWrap').addEventListener('mouseout', () => {
  $$('.star-btn').forEach((b, i) => b.classList.toggle('active', i < currentReviewRating));
});

$('#reviewForm').addEventListener('submit', async e => {
  e.preventDefault();
  const rating = parseInt($('#reviewRating').value);
  if (!rating) { $('#reviewError').textContent = 'Please select a star rating.'; return; }

  const btn = $('#submitReviewBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="inline-spinner"></span> Submitting...';

  try {
    await api('/reviews', {
      method: 'POST',
      body: {
        orderId: $('#reviewOrderId').value,
        restaurantId: $('#reviewRestaurantId').value,
        rating,
        comment: $('#reviewComment').value.trim()
      }
    });
    toast('Review submitted! Thank you 🙏');
    reviewDialog.close();
    route();
  } catch (err) {
    $('#reviewError').textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Review';
  }
});

/* ============================================================
   Views: Explore (Home)
   ============================================================ */
async function showExplore() {
  // Show skeleton first
  view.innerHTML = `
    <div class="skeleton-hero skeleton-base" aria-hidden="true"></div>
    <div class="skeleton-grid" aria-hidden="true">
      ${[1,2,3,4,5,6].map(() => '<div class="skeleton-card skeleton-base"></div>').join('')}
    </div>`;

  // Load data in parallel
  const [restaurants, popularItems] = await Promise.all([
    api('/restaurants?sort=' + currentSort + (currentCategory !== 'All' ? '&category=' + currentCategory : '') + (currentSearch ? '&search=' + currentSearch : '')).catch(() => []),
    api('/popular-items?limit=8').catch(() => [])
  ]);

  view.innerHTML = `
    <!-- Hero -->
    <section class="hero">
      <img class="hero-bg-image" src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1400&q=80" alt="Fresh food spread" loading="eager">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <span class="hero-pill">🚀 Delivered in 30 Mins • Free on First Order</span>
        <h1 class="hero-title">Handcrafted dishes from <span>premier kitchens</span> — delivered fresh.</h1>
        <p class="hero-desc">Artisanal noodles, wood-fired pizzas, royal Mughal curries, harvest bowls, and more. Delivered hot and fresh to your door.</p>
        <div class="hero-cta-row">
          <button class="btn btn-primary" style="font-size:1rem; padding:0.75rem 1.75rem;" onclick="location.hash='#/';">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            Explore Menus
          </button>
          <button class="btn" style="background:rgba(255,255,255,0.15); color:#fff; border:1.5px solid rgba(255,255,255,0.3); font-size:1rem; padding:0.75rem 1.5rem;" onclick="openAIDialog();">
            ✨ Ask AI Assistant
          </button>
        </div>
        <div class="hero-promos">
          <span class="promo-chip" onclick="applyPromoHero('WELCOME20')">
            <span class="promo-code">WELCOME20</span> • 20% off first order
          </span>
          <span class="promo-chip" onclick="applyPromoHero('FREESHIP')">
            <span class="promo-code">FREESHIP</span> • Free delivery
          </span>
          <span class="promo-chip" onclick="applyPromoHero('PLATEFUL50')">
            <span class="promo-code">PLATEFUL50</span> • ₹50 off ₹200+
          </span>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat">
          <span class="hero-stat-num">6+</span>
          <span class="hero-stat-label">Kitchens</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-num">50+</span>
          <span class="hero-stat-label">Dishes</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-num">30m</span>
          <span class="hero-stat-label">Avg Delivery</span>
        </div>
      </div>
    </section>

    <!-- Popular Items -->
    ${popularItems.length > 0 ? `
    <section class="popular-section">
      <div class="section-toolbar" style="margin-bottom:1rem;">
        <div>
          <h2 class="section-title">🔥 Most Popular</h2>
          <p class="section-subtitle">Top-ordered dishes across all restaurants</p>
        </div>
      </div>
      <div class="popular-scroll" id="popularScroll">
        ${popularItems.map(item => `
          <div class="popular-dish-card" onclick="location.hash='#/r/${esc(item.restaurantId)}';" title="${esc(item.name)}">
            <img class="popular-dish-img" src="${esc(item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300')}" alt="${esc(item.name)}" loading="lazy">
            <div class="popular-dish-body">
              <div class="popular-dish-name">${esc(item.name)}</div>
              <div class="popular-dish-rest">${esc(item.restaurantName)}</div>
              <div class="popular-dish-price">${CURRENCY}${item.price}</div>
            </div>
          </div>`).join('')}
      </div>
    </section>` : ''}

    <!-- Category Filter -->
    <div class="category-bar" id="categoryBar">
      <button class="cat-btn ${currentCategory === 'All' ? 'active' : ''}" data-cat="All">🍽️ All Kitchens</button>
      <button class="cat-btn ${currentCategory === 'Pizza' ? 'active' : ''}" data-cat="Pizza">🍕 Pizza</button>
      <button class="cat-btn ${currentCategory === 'Asian' ? 'active' : ''}" data-cat="Asian">🍜 Asian Noodles</button>
      <button class="cat-btn ${currentCategory === 'Indian' ? 'active' : ''}" data-cat="Indian">🍛 Indian</button>
      <button class="cat-btn ${currentCategory === 'Burgers' ? 'active' : ''}" data-cat="Burgers">🍔 Burgers</button>
      <button class="cat-btn ${currentCategory === 'Healthy' ? 'active' : ''}" data-cat="Healthy">🥗 Healthy</button>
      <button class="cat-btn ${currentCategory === 'Chinese' ? 'active' : ''}" data-cat="Chinese">🥟 Momos</button>
    </div>

    <!-- Toolbar -->
    <div class="section-toolbar">
      <div>
        <h2 class="section-title" id="exploreSectionTitle">
          ${currentCategory === 'All' ? 'All Restaurants' : currentCategory}
        </h2>
        <p class="section-subtitle" id="resultCountText">${restaurants.length} kitchen${restaurants.length !== 1 ? 's' : ''} ready to deliver</p>
      </div>
      <div class="sort-group">
        <label class="sort-label" for="sortSelect">Sort:</label>
        <select class="sort-select" id="sortSelect">
          <option value="rating" ${currentSort === 'rating' ? 'selected' : ''}>★ Top Rated</option>
          <option value="time" ${currentSort === 'time' ? 'selected' : ''}>⚡ Fastest</option>
          <option value="fee" ${currentSort === 'fee' ? 'selected' : ''}>💸 Low Fee</option>
          <option value="popular" ${currentSort === 'popular' ? 'selected' : ''}>🔥 Popular</option>
        </select>
      </div>
    </div>

    <!-- Restaurant Grid -->
    <div class="rest-grid" id="restaurantGrid">
      ${restaurants.length ? restaurants.map(r => restaurantCardHTML(r)).join('') :
      `<div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">🔍</div>
        <h3 class="empty-state-title">No restaurants found</h3>
        <p class="empty-state-desc">Try a different category or clear your search.</p>
        <button class="btn btn-primary" onclick="currentSearch=''; currentCategory='All'; route();">Show All</button>
      </div>`}
    </div>

    <!-- Footer -->
    ${renderFooter()}
  `;

  // Event bindings
  $('#categoryBar').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (btn) {
      currentCategory = btn.dataset.cat;
      $$('.cat-btn').forEach(b => b.classList.toggle('active', b === btn));
      loadRestaurants();
    }
  });

  $('#sortSelect').addEventListener('change', e => {
    currentSort = e.target.value;
    loadRestaurants();
  });
}

function restaurantCardHTML(r) {
  return `
    <article class="rest-card" onclick="location.hash='#/r/${esc(r.id)}';" style="cursor:pointer;" role="link" tabindex="0" aria-label="${esc(r.name)}">
      <div class="rest-thumb-wrap">
        <img class="rest-thumb" src="${esc(r.imageUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600')}" alt="${esc(r.name)}" loading="lazy">
        <div class="rest-badge-top">
          ${r.featured ? '<span class="badge-featured">Featured</span>' : ''}
        </div>
        ${!r.open ? '<div class="badge-closed">Closed</div>' : ''}
        <span class="badge-time">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${esc(r.deliveryTime || '25-35 min')}
        </span>
      </div>
      <div class="rest-body">
        <div class="rest-title-row">
          <h3 class="rest-name">${esc(r.name)}</h3>
          <span class="rating-badge">★ ${Number(r.rating || 4.5).toFixed(1)}</span>
        </div>
        <p class="rest-cuisine">${esc(r.cuisine || 'Specialty Cuisine')}</p>
        <div class="rest-foot">
          <span class="fee-badge ${r.deliveryFee === 0 ? 'free' : ''}">
            ${r.deliveryFee === 0 ? '✓ Free Delivery' : CURRENCY + r.deliveryFee + ' delivery'}
          </span>
          <span class="rest-min-order">Min. ${CURRENCY}${r.minOrder || 200}</span>
        </div>
      </div>
    </article>`;
}

window.applyPromoHero = function(code) {
  cart.couponCode = code;
  saveCart();
  openCartDrawer();
  toast(`Promo ${code} applied! 🎉`);
};

async function loadRestaurants() {
  const grid = $('#restaurantGrid');
  if (!grid) return;
  grid.innerHTML = `<div style="grid-column:1/-1;" class="loading-spinner"><div class="spinner"></div></div>`;

  try {
    const query = new URLSearchParams();
    if (currentSearch) query.set('search', currentSearch);
    if (currentCategory && currentCategory !== 'All') query.set('category', currentCategory);
    if (currentSort) query.set('sort', currentSort);

    const list = await api('/restaurants?' + query.toString());
    const countEl = $('#resultCountText');
    if (countEl) countEl.textContent = `${list.length} kitchen${list.length !== 1 ? 's' : ''} ready to deliver`;
    const titleEl = $('#exploreSectionTitle');
    if (titleEl) titleEl.textContent = currentCategory === 'All' ? 'All Restaurants' : currentCategory;

    grid.innerHTML = list.length ? list.map(r => restaurantCardHTML(r)).join('') :
      `<div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">🔍</div>
        <h3 class="empty-state-title">No restaurants found</h3>
        <p class="empty-state-desc">Try a different category or clear your search.</p>
        <button class="btn btn-primary" onclick="currentSearch=''; currentCategory='All'; route();">Show All</button>
      </div>`;

    // Re-bind onclick for keyboard users
    grid.querySelectorAll('.rest-card[tabindex="0"]').forEach(card => {
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') card.click();
      });
    });
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1;" class="empty-state"><p class="error">${esc(err.message)}</p></div>`;
  }
}

/* ============================================================
   Views: Restaurant Menu
   ============================================================ */
async function showMenu(id) {
  view.innerHTML = '<div class="loading-spinner" style="padding:5rem;"><div class="spinner"></div></div>';

  const [restaurant, items] = await Promise.all([
    api('/restaurants/' + encodeURIComponent(id)),
    api('/restaurants/' + encodeURIComponent(id) + '/menu')
  ]);

  menuCache = {};
  items.forEach(i => { menuCache[i.id] = { restaurant, item: i }; });

  const categories = [...new Set(items.map(i => i.category || 'Mains'))];
  const isOwner = user && (user.role === 'ADMIN' || (user.role === 'RESTAURANT_OWNER' && (restaurant.ownerId === user.id || restaurant.ownerEmail === user.email)));

  view.innerHTML = `
    <!-- Restaurant Hero Banner -->
    <div class="menu-hero">
      <img class="menu-hero-img" src="${esc(restaurant.imageUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000')}" alt="${esc(restaurant.name)}" loading="eager">
      <div class="menu-hero-overlay">
        <a class="back-link" href="#/">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>
          Back to Restaurants
        </a>
        <h1 class="menu-rest-name">${esc(restaurant.name)}</h1>
        <div class="menu-rest-meta">
          <span class="meta-item">★ <strong>${Number(restaurant.rating || 4.5).toFixed(1)}</strong></span>
          <span class="meta-item">•</span>
          <span class="meta-item">⚡ ${esc(restaurant.deliveryTime || '25-35 min')}</span>
          <span class="meta-item">•</span>
          <span class="meta-item">${restaurant.deliveryFee === 0 ? '<span style="color:#6ee7b7; font-weight:700;">Free Delivery</span>' : CURRENCY + restaurant.deliveryFee + ' delivery'}</span>
          <span class="meta-item">•</span>
          <span class="meta-item">Min. ${CURRENCY}${restaurant.minOrder || 200}</span>
        </div>
      </div>
    </div>

    <!-- Sticky Nav Tabs -->
    <div class="menu-nav-sticky">
      <div class="menu-tabs">
        <button class="menu-tab-btn active" data-jump-cat="all">All Dishes</button>
        ${categories.map(c => `<button class="menu-tab-btn" data-jump-cat="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <label class="veg-toggle-wrap">
        <input type="checkbox" id="vegFilterToggle" ${vegOnlyFilter ? 'checked' : ''} style="accent-color:var(--primary); width:16px; height:16px;">
        <span style="font-size:0.82rem; font-weight:600;">🌱 Veg Only</span>
      </label>
    </div>

    <!-- Dish Sections -->
    <div id="dishSectionsWrapper">
      ${renderDishSections(items, isOwner)}
    </div>

    ${renderFooter()}
  `;

  $('#vegFilterToggle').addEventListener('change', e => {
    vegOnlyFilter = e.target.checked;
    $('#dishSectionsWrapper').innerHTML = renderDishSections(items, isOwner);
    renderDishButtons();
  });

  $$('[data-jump-cat]').forEach(btn => {
    btn.onclick = () => {
      $$('.menu-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      if (btn.dataset.jumpCat === 'all') window.scrollTo({ top: 0, behavior: 'smooth' });
      else {
        const sec = document.getElementById('cat-sec-' + btn.dataset.jumpCat.replace(/\s+/g, '-'));
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
  });

  renderDishButtons();
}

function renderDishSections(items, isOwner) {
  let filtered = vegOnlyFilter ? items.filter(i => i.vegetarian) : items;

  if (!filtered.length) {
    return `<div class="empty-state"><div class="empty-state-icon">🌱</div><h3 class="empty-state-title">No vegetarian dishes</h3><p class="empty-state-desc">This restaurant doesn't have vegetarian options matching your filter.</p></div>`;
  }

  const groups = {};
  filtered.forEach(i => { (groups[i.category || 'Mains'] ||= []).push(i); });

  return Object.entries(groups).map(([cat, list]) => `
    <section class="dish-category" id="cat-sec-${esc(cat.replace(/\s+/g, '-'))}">
      <h2 class="dish-cat-title">${esc(cat)} <span style="font-size:0.82rem; color:var(--text-muted); font-weight:600;">(${list.length})</span></h2>
      <div class="dish-grid">
        ${list.map(i => dishCardHTML(i, isOwner)).join('')}
      </div>
    </section>`).join('');
}

function dishCardHTML(i, isOwner) {
  return `
    <div class="dish-card ${!i.available ? 'unavailable' : ''}" id="dish-card-${esc(i.id)}">
      <div class="dish-info">
        <div class="dish-badges">
          ${i.vegetarian ? '<span class="badge-diet veg">Veg</span>' : '<span class="badge-diet" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;">Non-Veg</span>'}
          ${i.spicy ? '<span class="badge-diet spicy">🌶️ Spicy</span>' : ''}
        </div>
        <h3 class="dish-title">${esc(i.name)}</h3>
        <p class="dish-desc">${esc(i.description || '')}</p>
        <div class="dish-price-row">
          <div>
            <span class="dish-price">${CURRENCY}${i.price}</span>
            ${i.calories ? `<span class="dish-calories"> • ${i.calories} kcal</span>` : ''}
            ${i.prepTime ? `<span class="dish-prep-time" style="display:inline-flex; align-items:center; gap:3px; margin-left:6px; font-size:0.72rem; color:var(--text-soft);">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${i.prepTime} min
            </span>` : ''}
          </div>
          ${isOwner ? `
          <div style="display:flex; gap:0.35rem;">
            <button class="btn ghost small" type="button" data-dish-edit="${esc(i.id)}" title="Edit dish">✏️</button>
            <label class="toggle-switch" title="${i.available ? 'Mark unavailable' : 'Mark available'}">
              <input type="checkbox" ${i.available ? 'checked' : ''} data-dish-toggle="${esc(i.id)}">
              <span class="toggle-slider"></span>
            </label>
          </div>` : ''}
        </div>
      </div>
      <div class="dish-img-wrap">
        <img class="dish-img" src="${esc(i.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300')}" alt="${esc(i.name)}" loading="lazy">
        <div class="dish-add-btn-wrap" id="dish-action-${esc(i.id)}">
          <!-- Rendered by renderDishButtons() -->
        </div>
      </div>
    </div>`;
}

function renderDishButtons() {
  Object.keys(menuCache).forEach(id => {
    const el = document.getElementById('dish-action-' + id);
    if (!el) return;
    const { item } = menuCache[id];
    if (!item.available) {
      el.innerHTML = '<span style="background:var(--danger); color:#fff; font-size:0.72rem; font-weight:800; padding:0.2rem 0.55rem; border-radius:var(--radius-full);">Sold Out</span>';
      return;
    }
    const inCart = cart.lines.find(l => l.menuItemId === id);
    if (inCart) {
      el.innerHTML = `
        <div class="dish-stepper">
          <button type="button" data-dish-delta="-1" data-id="${esc(id)}" aria-label="Decrease">&minus;</button>
          <span class="dish-stepper-val">${inCart.qty}</span>
          <button type="button" data-dish-delta="1" data-id="${esc(id)}" aria-label="Increase">&plus;</button>
        </div>`;
    } else {
      el.innerHTML = `<button class="btn btn-primary small" type="button" data-dish-add="${esc(id)}" style="font-size:0.8rem;">+ Add</button>`;
    }
  });
}

// View event delegation — dish card actions
view.addEventListener('click', async e => {
  const addBtn = e.target.closest('[data-dish-add]');
  if (addBtn) {
    const entry = menuCache[addBtn.dataset.dishAdd];
    if (entry) addToCart(entry.restaurant, entry.item);
    return;
  }

  const deltaBtn = e.target.closest('[data-dish-delta]');
  if (deltaBtn) {
    changeCartQty(deltaBtn.dataset.id, Number(deltaBtn.dataset.dishDelta));
    return;
  }

  const editBtn = e.target.closest('[data-dish-edit]');
  if (editBtn) {
    const id = editBtn.dataset.dishEdit;
    const entry = menuCache[id];
    if (entry) openDishEditModal(entry.item);
    return;
  }
});

view.addEventListener('change', async e => {
  const toggle = e.target.closest('[data-dish-toggle]');
  if (toggle) {
    const id = toggle.dataset.dishToggle;
    try {
      const updated = await api('/menu/' + encodeURIComponent(id) + '/toggle-availability', { method: 'PUT' });
      if (menuCache[id]) menuCache[id].item.available = updated.available;
      renderDishButtons();
      toast(`${updated.name} marked as ${updated.available ? 'available' : 'unavailable'}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

function openDishEditModal(item) {
  // Simple inline edit using prompt; replace with a proper modal for production
  const newName = prompt('Dish Name:', item.name);
  if (!newName) return;
  const newPrice = parseFloat(prompt('Price (₹):', item.price));
  if (isNaN(newPrice) || newPrice <= 0) { toast('Invalid price', 'error'); return; }
  const newDesc = prompt('Description:', item.description || '');

  api('/menu/' + encodeURIComponent(item.id), {
    method: 'PUT',
    body: { name: newName, price: newPrice, description: newDesc }
  }).then(() => {
    toast('Dish updated!');
    route();
  }).catch(err => toast(err.message, 'error'));
}

/* ============================================================
   Views: My Orders & Order Tracking
   ============================================================ */
async function showOrders() {
  if (!user) {
    view.innerHTML = `
      <div class="empty-state" style="padding:5rem 1rem;">
        <div class="empty-state-icon">📦</div>
        <h1 class="empty-state-title">Track Your Orders</h1>
        <p class="empty-state-desc">Sign in to view your live orders, track delivery status, and reorder favourites.</p>
        <button class="btn btn-primary" onclick="openAuth('login')">Sign In to Continue</button>
      </div>`;
    return;
  }

  view.innerHTML = '<div class="loading-spinner" style="padding:5rem;"><div class="spinner"></div></div>';
  const orders = await api('/orders/my');

  const activeOrders = orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status));
  const pastOrders = orders.filter(o => ['DELIVERED', 'CANCELLED'].includes(o.status));

  $('#activeOrderPulse').hidden = activeOrders.length === 0;

  view.innerHTML = `
    <div style="margin-bottom:var(--space-8);">
      <h1 class="section-title" style="font-size:2rem; margin-bottom:0.35rem;">Order History & Tracking</h1>
      <p class="section-subtitle">Live status updates for <strong>${esc(user.name)}</strong></p>
    </div>

    ${activeOrders.length ? `
      <div style="margin-bottom:2.5rem;">
        <h2 style="font-size:1.25rem; font-weight:800; margin-bottom:1.25rem; display:flex; align-items:center; gap:0.6rem;">
          <span class="pulse-dot" aria-hidden="true"></span> Live Orders (${activeOrders.length})
        </h2>
        ${activeOrders.map(o => renderOrderCard(o, false, true)).join('')}
      </div>` : ''}

    <div>
      <h2 style="font-size:1.25rem; font-weight:800; margin-bottom:1.25rem;">Past Orders (${pastOrders.length})</h2>
      ${pastOrders.length ? pastOrders.map(o => renderOrderCard(o, false, false)).join('') :
        `<div class="empty-state" style="padding:3rem 1rem;">
          <div class="empty-state-icon">🍽️</div>
          <p class="empty-state-desc">No completed orders yet. Explore our menus!</p>
          <button class="btn btn-primary" onclick="location.hash='#/';">Browse Menus</button>
        </div>`}
    </div>
  `;
}

function renderOrderCard(o, admin = false, isLive = false) {
  const TRACK_STEPS = [
    { key: 'PLACED', label: 'Placed' },
    { key: 'ACCEPTED', label: 'Accepted' },
    { key: 'PREPARING', label: 'Preparing' },
    { key: 'OUT_FOR_DELIVERY', label: 'On the Way' },
    { key: 'DELIVERED', label: 'Delivered' }
  ];

  const isCancelled = o.status === 'CANCELLED';
  const isScheduled = o.status === 'SCHEDULED';
  const currentIdx = TRACK_STEPS.findIndex(s => s.key === o.status);
  const progress = isCancelled || isScheduled ? 0 : (currentIdx / (TRACK_STEPS.length - 1)) * 100;

  return `
    <article class="order-card" id="order-${esc(o.id)}">
      <div class="order-card-head">
        <div>
          <h3 class="order-rest-name">${esc(o.restaurantName)}</h3>
          <span class="order-date">${new Date(o.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}${admin ? ` • <strong>${esc(o.customerName)}</strong>` : ''}</span>
        </div>
        <span class="status-badge" data-status="${esc(o.status)}">${esc(STATUS_LABEL[o.status] || o.status)}</span>
      </div>

      <!-- Status Tracker -->
      ${!isCancelled && !isScheduled ? `
      <div class="order-stepper">
        <div class="order-stepper-track">
          <div class="order-stepper-fill" style="width:${progress}%;"></div>
        </div>
        ${TRACK_STEPS.map((st, idx) => {
          const done = idx < currentIdx || o.status === 'DELIVERED';
          const active = idx === currentIdx && o.status !== 'DELIVERED';
          return `<div class="step-node ${done ? 'completed' : ''} ${active ? 'active' : ''}">
            <div class="step-circle">${done ? '✓' : idx + 1}</div>
            <span class="step-label">${esc(st.label)}</span>
          </div>`;
        }).join('')}
      </div>` :
      isCancelled ? `
      <div style="background:var(--danger-light); color:var(--danger); padding:0.75rem 1rem; border-radius:var(--radius-md); font-size:0.875rem; margin:var(--space-4) 0; font-weight:600; border:1px solid rgba(239,68,68,0.2);">
        ❌ Order cancelled: ${esc(o.cancelReason || 'Cancelled')}
      </div>` : `
      <div style="background:#f3e8ff; color:#7c3aed; padding:0.75rem 1rem; border-radius:var(--radius-md); font-size:0.875rem; margin:var(--space-4) 0; font-weight:600; border:1px solid #c4b5fd;">
        🕐 Scheduled for: ${o.scheduledFor ? new Date(o.scheduledFor).toLocaleString() : 'Later'}
      </div>`}

      <!-- Items List -->
      <ul class="order-items-list">
        ${o.items.map(i => `
          <li class="order-item-row">
            <span><strong>${i.quantity}×</strong> ${esc(i.name)}</span>
            <span style="font-weight:700;">${CURRENCY}${(i.price * i.quantity).toFixed(0)}</span>
          </li>`).join('')}
      </ul>

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; font-size:0.85rem; color:var(--text-muted); padding-top:var(--space-3); border-top:1px solid var(--border-light);">
        <div>📍 ${esc(o.address)}</div>
        <div style="font-size:1.1rem; font-weight:800; color:var(--text-main);">
          ${CURRENCY}${o.total.toFixed(0)}
          <span style="font-size:0.72rem; font-weight:600; color:var(--primary); margin-left:4px;">${esc(o.paymentMethod || 'UPI')}</span>
        </div>
      </div>

      ${o.rewardPointsEarned > 0 && o.status === 'DELIVERED' ? `
      <div style="font-size:0.78rem; color:var(--primary); font-weight:700; margin-top:var(--space-2);">
        ⭐ Earned ${o.rewardPointsEarned} Plateful Points
      </div>` : ''}

      <!-- Action Toolbar -->
      <div class="order-actions-bar">
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          ${isLive && !admin ? `
            <button class="btn danger small" type="button" data-order-cancel="${esc(o.id)}">Cancel</button>
            <button class="btn ghost small" type="button" data-order-simulate="${esc(o.id)}" title="Simulate delivery step">⚡ Next Step</button>` : ''}
          <button class="btn ghost small" type="button" data-order-receipt="${esc(o.id)}">🧾 Receipt</button>
          <button class="btn btn-primary small" type="button" data-order-reorder="${esc(o.id)}">↻ Reorder</button>
          ${o.status === 'DELIVERED' && !admin ? `<button class="btn ghost small" type="button" data-order-review="${esc(o.id)}" data-rest-id="${esc(o.restaurantId)}">⭐ Rate</button>` : ''}
        </div>

        ${admin ? `
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <label style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">Update:</label>
          <select class="sort-select" style="font-size:0.8rem;" data-admin-status-for="${esc(o.id)}">
            ${STATUSES.filter(s => s !== 'SCHEDULED').map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
          </select>
        </div>` : ''}
      </div>
    </article>`;
}

// Order View Actions
view.addEventListener('click', async e => {
  const cancelBtn = e.target.closest('[data-order-cancel]');
  if (cancelBtn) {
    const id = cancelBtn.dataset.orderCancel;
    const reason = prompt('Reason for cancellation:', 'Changed my mind');
    if (reason === null) return;
    try {
      await api('/orders/' + encodeURIComponent(id) + '/cancel', { method: 'PUT', body: { reason: reason || 'Cancelled by customer' } });
      toast('Order cancelled. Refunds (if any) will be processed shortly.');
      route();
    } catch (err) { toast(err.message, 'error'); }
    return;
  }

  const simBtn = e.target.closest('[data-order-simulate]');
  if (simBtn) {
    const id = simBtn.dataset.orderSimulate;
    try {
      const order = await api('/orders/' + encodeURIComponent(id));
      const nextMap = { PLACED: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' };
      const next = nextMap[order.status];
      if (next) {
        await api('/orders/' + encodeURIComponent(id) + '/status', { method: 'PUT', body: { status: next } });
        toast(`Order advanced to: ${STATUS_LABEL[next]} ✅`);
        route();
      } else {
        toast('Order is already in final status.');
      }
    } catch (err) { toast(err.message, 'error'); }
    return;
  }

  const reorderBtn = e.target.closest('[data-order-reorder]');
  if (reorderBtn) {
    const id = reorderBtn.dataset.orderReorder;
    try {
      const order = await api('/orders/' + encodeURIComponent(id));
      cart.restaurantId = order.restaurantId;
      cart.restaurantName = order.restaurantName;
      cart.restaurantDeliveryFee = order.deliveryFee || 0;
      cart.lines = order.items.map(i => ({ menuItemId: i.menuItemId, name: i.name, price: i.price, imageUrl: i.imageUrl, qty: i.quantity }));
      cart.couponCode = '';
      cart.discount = 0;
      saveCart();
      openCartDrawer();
      toast('Items added to cart! 🛒');
    } catch (err) { toast(err.message, 'error'); }
    return;
  }

  const receiptBtn = e.target.closest('[data-order-receipt]');
  if (receiptBtn) { openReceiptModal(receiptBtn.dataset.orderReceipt); return; }

  const reviewBtn = e.target.closest('[data-order-review]');
  if (reviewBtn) { openReviewDialog(reviewBtn.dataset.orderReview, reviewBtn.dataset.restId); return; }
});

view.addEventListener('change', async e => {
  const sel = e.target.closest('[data-admin-status-for]');
  if (sel) {
    try {
      await api('/orders/' + encodeURIComponent(sel.dataset.adminStatusFor) + '/status', {
        method: 'PUT',
        body: { status: sel.value }
      });
      toast('Status updated to ' + STATUS_LABEL[sel.value]);
      route();
    } catch (err) { toast(err.message, 'error'); }
  }
});

async function openReceiptModal(orderId) {
  const dialog = $('#receiptDialog');
  const box = $('#receiptContent');
  box.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  dialog.showModal();
  try {
    const o = await api('/orders/' + encodeURIComponent(orderId));
    box.innerHTML = `
      <button class="dialog-close-btn" onclick="document.getElementById('receiptDialog').close();">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
      <div style="text-align:center; margin-bottom:1.5rem;">
        <div style="font-size:2.5rem; margin-bottom:0.5rem;">🧾</div>
        <h2 style="font-size:1.5rem; font-weight:900; letter-spacing:-0.02em;">Order Receipt</h2>
        <p style="color:var(--text-muted); font-size:0.82rem;">Order #${esc(o.id.slice(-8).toUpperCase())}</p>
      </div>
      <div style="background:var(--bg-muted); padding:var(--space-4); border-radius:var(--radius-md); font-size:0.875rem; margin-bottom:var(--space-4);">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;"><span style="color:var(--text-muted);">Restaurant</span><strong>${esc(o.restaurantName)}</strong></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;"><span style="color:var(--text-muted);">Date</span><span>${new Date(o.createdAt).toLocaleString()}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;"><span style="color:var(--text-muted);">Payment</span><span>${esc(o.paymentMethod)} — ${esc(o.paymentStatus)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">Deliver to</span><span style="text-align:right; max-width:60%;">${esc(o.address)}</span></div>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:0.88rem; margin-bottom:var(--space-4);">
        <thead>
          <tr style="border-bottom:2px solid var(--border-light);">
            <th style="padding:0.4rem 0; text-align:left;">Item</th>
            <th style="padding:0.4rem 0; text-align:center;">Qty</th>
            <th style="padding:0.4rem 0; text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${o.items.map(i => `
            <tr style="border-bottom:1px solid var(--border-light);">
              <td style="padding:0.5rem 0;">${esc(i.name)}</td>
              <td style="padding:0.5rem 0; text-align:center;">${i.quantity}</td>
              <td style="padding:0.5rem 0; text-align:right; font-weight:700;">${CURRENCY}${(i.price * i.quantity).toFixed(0)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div style="font-size:0.88rem; margin-bottom:var(--space-5);">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;"><span>Subtotal</span><span>${CURRENCY}${(o.subtotal || 0).toFixed(0)}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;"><span>Delivery Fee</span><span>${o.deliveryFee === 0 ? 'FREE' : CURRENCY + (o.deliveryFee || 0).toFixed(0)}</span></div>
        ${o.discount > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:0.3rem; color:var(--primary); font-weight:700;"><span>Discount</span><span>−${CURRENCY}${o.discount.toFixed(0)}</span></div>` : ''}
        ${o.tax > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:0.3rem; color:var(--text-muted);"><span>GST (${TAX_PERCENT}%)</span><span>${CURRENCY}${o.tax.toFixed(0)}</span></div>` : ''}
        <div style="display:flex; justify-content:space-between; font-size:1.2rem; font-weight:900; border-top:2px dashed var(--border-medium); padding-top:0.6rem; margin-top:0.5rem; color:var(--text-main);">
          <span>Total Paid</span><span>${CURRENCY}${o.total.toFixed(0)}</span>
        </div>
      </div>
      ${o.rewardPointsEarned ? `<p style="text-align:center; font-size:0.82rem; color:var(--primary); font-weight:700; margin-bottom:var(--space-4);">⭐ ${o.rewardPointsEarned} Plateful Points earned on this order</p>` : ''}
      <button class="btn btn-primary btn-block" onclick="document.getElementById('receiptDialog').close();">Close Receipt</button>`;
  } catch (err) {
    box.innerHTML = `<p class="error">${esc(err.message)}</p><button class="btn ghost btn-block" onclick="document.getElementById('receiptDialog').close();">Close</button>`;
  }
}

/* ============================================================
   Views: Favorites Page
   ============================================================ */
async function showFavoritesPage() {
  location.hash = '#/favorites';
}

async function renderFavorites() {
  if (!user) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❤️</div><h1 class="empty-state-title">Your Favorites</h1><p class="empty-state-desc">Sign in to save your favorite dishes.</p><button class="btn btn-primary" onclick="openAuth('login')">Sign In</button></div>`;
    return;
  }

  view.innerHTML = '<div class="loading-spinner" style="padding:5rem;"><div class="spinner"></div></div>';

  try {
    const favItems = await api('/favorites');
    view.innerHTML = `
      <h1 class="section-title" style="margin-bottom:0.35rem;">❤️ My Favorites</h1>
      <p class="section-subtitle" style="margin-bottom:var(--space-6);">${favItems.length} saved dish${favItems.length !== 1 ? 'es' : ''}</p>
      ${favItems.length ? `
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:var(--space-4);">
        ${favItems.map(item => {
          const rest = RESTAURANTS_CACHE[item.restaurantId];
          return `
          <div class="dish-card" style="flex-direction:column;">
            <div style="position:relative; width:100%; height:160px; border-radius:var(--radius-md); overflow:hidden; margin-bottom:var(--space-3);">
              <img style="width:100%; height:100%; object-fit:cover;" src="${esc(item.imageUrl)}" alt="${esc(item.name)}" loading="lazy">
            </div>
            <div>
              <h3 class="dish-title">${esc(item.name)}</h3>
              <p class="dish-desc">${esc(item.description)}</p>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:var(--space-3);">
                <span class="dish-price">${CURRENCY}${item.price}</span>
                <button class="btn btn-primary small" onclick="location.hash='#/r/${esc(item.restaurantId)}'">View Menu</button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>` :
      `<div class="empty-state"><div class="empty-state-icon">💔</div><h2 class="empty-state-title">No favorites yet</h2><p class="empty-state-desc">Browse the menu and tap the heart on dishes you love!</p><button class="btn btn-primary" onclick="location.hash='#/'">Explore Menus</button></div>`}
    `;
  } catch (err) {
    view.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

// Cache for restaurant names
const RESTAURANTS_CACHE = {};

/* ============================================================
   Views: Merchant Portal
   ============================================================ */
async function showOwner() {
  if (!user || (user.role !== 'RESTAURANT_OWNER' && user.role !== 'ADMIN')) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏪</div><h1 class="empty-state-title">Merchant Portal</h1><p class="empty-state-desc">This portal is reserved for restaurant owners and chefs.</p><button class="btn btn-primary" onclick="openAuth('login')">Log in as Merchant</button></div>`;
    return;
  }

  view.innerHTML = '<div class="loading-spinner" style="padding:5rem;"><div class="spinner"></div></div>';
  const [myRestaurants, myOrders, stats] = await Promise.all([
    api('/restaurants/my'),
    api('/orders'),
    api('/admin/stats')
  ]);

  const activeOrders = myOrders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status));

  view.innerHTML = `
    <div class="admin-header">
      <h1 class="section-title" style="font-size:2rem; margin-bottom:0.35rem;">Merchant Operations Portal</h1>
      <p class="section-subtitle">Manage dishes, orders, and analytics for <strong>${esc(user.name)}</strong></p>
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background:#dcfce7;">🏪</div>
        <div>
          <div class="stat-val">${myRestaurants.length}</div>
          <div class="stat-label">Active Kitchens</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#fef3c7;">📦</div>
        <div>
          <div class="stat-val">${activeOrders.length}</div>
          <div class="stat-label">Live Orders</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#dbeafe;">💰</div>
        <div>
          <div class="stat-val">${CURRENCY}${stats.totalRevenue.toFixed(0)}</div>
          <div class="stat-label">Total Revenue</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#f3e8ff;">📈</div>
        <div>
          <div class="stat-val">${CURRENCY}${stats.avgOrderValue.toFixed(0)}</div>
          <div class="stat-label">Avg Order Value</div>
        </div>
      </div>
    </div>

    <!-- Bestsellers -->
    ${stats.bestsellers && stats.bestsellers.length ? `
    <div class="admin-section">
      <div class="admin-section-head"><h2>🔥 Bestsellers</h2></div>
      <div style="display:flex; flex-direction:column; gap:var(--space-2);">
        ${stats.bestsellers.map((b, i) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:var(--space-3); background:var(--bg-muted); border-radius:var(--radius-md);">
            <span style="font-weight:700; font-size:0.9rem;">#${i + 1} ${esc(b.name)}</span>
            <span style="font-weight:800; color:var(--primary);">${b.count} orders</span>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- Live Orders -->
    <div class="admin-section">
      <div class="admin-section-head">
        <h2>Live Kitchen Orders (${activeOrders.length})</h2>
        <button class="btn ghost small" onclick="route();">↻ Refresh</button>
      </div>
      ${activeOrders.length ? activeOrders.map(o => renderOrderCard(o, true, false)).join('') : '<p style="color:var(--text-muted);">No active orders right now.</p>'}
    </div>

    <!-- All Orders -->
    <div class="admin-section">
      <div class="admin-section-head">
        <h2>All Orders (${myOrders.length})</h2>
      </div>
      ${myOrders.length ? myOrders.slice(0, 20).map(o => renderOrderCard(o, true, false)).join('') : '<p style="color:var(--text-muted);">No orders yet.</p>'}
    </div>

    <!-- Menu Management -->
    <div class="admin-section">
      <div class="admin-section-head">
        <h2>Menu Management</h2>
      </div>

      <!-- Add New Dish Form -->
      <div style="max-width:560px; background:var(--bg-muted); border-radius:var(--radius-md); padding:var(--space-5); border:1.5px dashed var(--border-medium); margin-bottom:var(--space-5);">
        <h3 style="font-size:1rem; font-weight:800; margin-bottom:var(--space-4);">+ Add New Menu Item</h3>
        <form id="ownerAddDishForm">
          <label class="form-label">Restaurant
            <select name="restaurantId" required>
              ${myRestaurants.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}
            </select>
          </label>
          <label class="form-label">Dish Name
            <input name="name" type="text" placeholder="e.g. Truffle Risotto" required>
          </label>
          <label class="form-label">Description
            <textarea name="description" rows="2" placeholder="Ingredients, flavors, serving style"></textarea>
          </label>
          <div class="form-row">
            <label class="form-label">Price (₹)
              <input name="price" type="number" step="1" min="1" placeholder="299" required>
            </label>
            <label class="form-label">Category
              <input name="category" type="text" placeholder="e.g. Curries">
            </label>
          </div>
          <div class="form-row">
            <label class="form-label">Image URL
              <input name="imageUrl" type="url" placeholder="https://images.unsplash.com/...">
            </label>
            <label class="form-label">Prep Time (min)
              <input name="prepTime" type="number" min="5" placeholder="20">
            </label>
          </div>
          <div style="display:flex; gap:var(--space-4); margin-bottom:var(--space-4);">
            <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.875rem; font-weight:600; cursor:pointer;">
              <input type="checkbox" name="vegetarian" style="width:16px; height:16px; accent-color:var(--primary);">
              🌱 Vegetarian
            </label>
            <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.875rem; font-weight:600; cursor:pointer;">
              <input type="checkbox" name="spicy" style="width:16px; height:16px; accent-color:var(--accent);">
              🌶️ Spicy
            </label>
          </div>
          <p class="error" id="ownerDishError"></p>
          <button class="btn btn-primary btn-block" type="submit">Create Dish</button>
        </form>
      </div>

      <!-- Existing Menu Items -->
      ${myRestaurants.map(rest => {
        const items = Object.values(menuCache).filter(e => e.restaurant.id === rest.id).map(e => e.item);
        return items.length ? `
          <h3 style="font-size:0.95rem; font-weight:800; margin-bottom:var(--space-3);">${esc(rest.name)}</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:var(--space-3); margin-bottom:var(--space-5);">
            ${items.map(item => `
              <div class="dish-manage-card">
                <img class="dish-manage-img" src="${esc(item.imageUrl)}" alt="${esc(item.name)}" loading="lazy">
                <div class="dish-manage-info">
                  <div class="dish-manage-name">${esc(item.name)}</div>
                  <div class="dish-manage-price">${CURRENCY}${item.price}</div>
                  <div style="font-size:0.72rem; color:var(--text-muted);">${esc(item.category)} ${item.vegetarian ? '• 🌱' : ''}</div>
                </div>
                <div class="dish-manage-actions">
                  <label class="toggle-switch" title="${item.available ? 'Mark unavailable' : 'Mark available'}">
                    <input type="checkbox" ${item.available ? 'checked' : ''} data-dish-toggle="${esc(item.id)}">
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>`).join('')}
          </div>` : '';
      }).join('')}
    </div>
  `;

  // Bind status updates
  view.querySelectorAll('[data-admin-status-for]').forEach(sel => {
    sel.onchange = async () => {
      try {
        await api('/orders/' + encodeURIComponent(sel.dataset.adminStatusFor) + '/status', { method: 'PUT', body: { status: sel.value } });
        toast('Status updated: ' + STATUS_LABEL[sel.value]);
        route();
      } catch (err) { toast(err.message, 'error'); }
    };
  });

  // Bind toggle
  view.querySelectorAll('[data-dish-toggle]').forEach(input => {
    input.addEventListener('change', async () => {
      try {
        const updated = await api('/menu/' + encodeURIComponent(input.dataset.dishToggle) + '/toggle-availability', { method: 'PUT' });
        toast(`${updated.name} marked as ${updated.available ? 'available' : 'unavailable'}`);
      } catch (err) { toast(err.message, 'error'); input.checked = !input.checked; }
    });
  });

  // Bind add dish form
  const addForm = $('#ownerAddDishForm');
  if (addForm) {
    addForm.onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const restId = f.get('restaurantId');
      const btn = addForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await api('/restaurants/' + encodeURIComponent(restId) + '/menu', {
          method: 'POST',
          body: {
            name: f.get('name'), description: f.get('description'),
            price: Number(f.get('price')), category: f.get('category') || 'Mains',
            imageUrl: f.get('imageUrl') || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
            vegetarian: !!f.get('vegetarian'), spicy: !!f.get('spicy'),
            prepTime: Number(f.get('prepTime') || 20)
          }
        });
        toast('New dish created! 🎉');
        route();
      } catch (err) {
        $('#ownerDishError').textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    };
  }
}

/* ============================================================
   Views: Admin Console
   ============================================================ */
async function showAdmin() {
  if (!user || user.role !== 'ADMIN') {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚙️</div><h1 class="empty-state-title">Admin Console</h1><p class="empty-state-desc">Restricted to system administrators.</p><button class="btn btn-primary" onclick="openAuth('login')">Sign In as Admin</button></div>`;
    return;
  }

  view.innerHTML = '<div class="loading-spinner" style="padding:5rem;"><div class="spinner"></div></div>';

  const [stats, orders, restaurants, users] = await Promise.all([
    api('/admin/stats'),
    api('/orders'),
    api('/restaurants'),
    api('/admin/users')
  ]);

  view.innerHTML = `
    <div class="admin-header">
      <h1 class="section-title" style="font-size:2rem; margin-bottom:0.35rem;">Platform Admin Console</h1>
      <p class="section-subtitle">Platform Overview • Orders • Restaurants • Users</p>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background:#dcfce7; color:#15803d;">💰</div>
        <div>
          <div class="stat-val">${CURRENCY}${stats.totalRevenue.toFixed(0)}</div>
          <div class="stat-label">Platform GMV</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#fed7aa; color:#c2410c;">📦</div>
        <div>
          <div class="stat-val">${stats.totalOrders}</div>
          <div class="stat-label">Total Orders</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#fef3c7; color:#b45309;">⚡</div>
        <div>
          <div class="stat-val">${stats.activeOrders}</div>
          <div class="stat-label">Active Orders</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#dbeafe; color:#1d4ed8;">🏪</div>
        <div>
          <div class="stat-val">${stats.totalRestaurants}</div>
          <div class="stat-label">Kitchens</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#f3e8ff; color:#7c3aed;">👥</div>
        <div>
          <div class="stat-val">${stats.totalUsers}</div>
          <div class="stat-label">Registered Users</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#fce7f3; color:#be185d;">🍽️</div>
        <div>
          <div class="stat-val">${stats.totalMenuItems}</div>
          <div class="stat-label">Menu Items</div>
        </div>
      </div>
    </div>

    <!-- Bestsellers -->
    ${stats.bestsellers && stats.bestsellers.length ? `
    <div class="admin-section">
      <div class="admin-section-head"><h2>🔥 Platform Bestsellers</h2></div>
      ${stats.bestsellers.map((b, i) => `
        <div style="display:flex; justify-content:space-between; padding:var(--space-3); background:${i === 0 ? 'var(--primary-light)' : 'var(--bg-muted)'}; border-radius:var(--radius-md); margin-bottom:var(--space-2);">
          <span style="font-weight:700;">#${i+1} ${esc(b.name)}</span>
          <span style="font-weight:800; color:var(--primary);">${b.count} orders</span>
        </div>`).join('')}
    </div>` : ''}

    <!-- User Management -->
    <div class="admin-section">
      <div class="admin-section-head"><h2>👥 User Management (${users.length})</h2></div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
          <thead>
            <tr style="background:var(--bg-muted);">
              <th style="padding:0.65rem 0.75rem; text-align:left; font-weight:700;">Name</th>
              <th style="padding:0.65rem 0.75rem; text-align:left; font-weight:700;">Email</th>
              <th style="padding:0.65rem 0.75rem; text-align:left; font-weight:700;">Role</th>
              <th style="padding:0.65rem 0.75rem; text-align:right; font-weight:700;">Points</th>
              <th style="padding:0.65rem 0.75rem; text-align:left; font-weight:700;">Joined</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr style="border-bottom:1px solid var(--border-light);">
                <td style="padding:0.65rem 0.75rem; font-weight:600;">${esc(u.name)}</td>
                <td style="padding:0.65rem 0.75rem; color:var(--text-muted);">${esc(u.email)}</td>
                <td style="padding:0.65rem 0.75rem;"><span class="role-badge">${esc(u.role)}</span></td>
                <td style="padding:0.65rem 0.75rem; text-align:right; font-weight:700; color:var(--primary);">⭐ ${u.rewardPoints}</td>
                <td style="padding:0.65rem 0.75rem; color:var(--text-muted);">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- All Orders -->
    <div class="admin-section">
      <div class="admin-section-head">
        <h2>All Platform Orders (${orders.length})</h2>
      </div>
      ${orders.slice(0, 30).map(o => renderOrderCard(o, true, false)).join('')}
    </div>

    <!-- Add Restaurant Form -->
    <div class="admin-section">
      <div class="admin-section-head"><h2>Register New Partner Kitchen</h2></div>
      <form id="adminAddRestForm" style="max-width:600px;">
        <label class="form-label">Kitchen Name
          <input name="name" type="text" placeholder="e.g. Sakura Ramen Bar" required>
        </label>
        <div class="form-row">
          <label class="form-label">Category
            <select name="category">
              <option value="Asian">Asian & Noodles</option>
              <option value="Pizza">Artisanal Pizza</option>
              <option value="Indian">Indian</option>
              <option value="Burgers">Burgers</option>
              <option value="Healthy">Healthy</option>
              <option value="Chinese">Chinese</option>
            </select>
          </label>
          <label class="form-label">Cuisine Description
            <input name="cuisine" type="text" placeholder="e.g. Japanese • Tonkotsu">
          </label>
        </div>
        <label class="form-label">Address
          <input name="address" type="text" placeholder="e.g. 55 High Street, Bandra" required>
        </label>
        <div class="form-row">
          <label class="form-label">Delivery Time
            <input name="deliveryTime" type="text" value="20-30 min">
          </label>
          <label class="form-label">Delivery Fee (₹)
            <input name="deliveryFee" type="number" step="1" value="30">
          </label>
        </div>
        <label class="form-label">Cover Photo URL
          <input name="imageUrl" type="url" placeholder="https://images.unsplash.com/...">
        </label>
        <p class="error" id="adminRestError"></p>
        <button class="btn btn-primary" type="submit">Register Kitchen</button>
      </form>
    </div>
  `;

  // Bind status updates
  view.querySelectorAll('[data-admin-status-for]').forEach(sel => {
    sel.onchange = async () => {
      try {
        await api('/orders/' + encodeURIComponent(sel.dataset.adminStatusFor) + '/status', { method: 'PUT', body: { status: sel.value } });
        toast('Status updated: ' + STATUS_LABEL[sel.value]);
        route();
      } catch (err) { toast(err.message, 'error'); }
    };
  });

  const addRestForm = $('#adminAddRestForm');
  if (addRestForm) {
    addRestForm.onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const btn = addRestForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await api('/restaurants', {
          method: 'POST',
          body: {
            name: f.get('name'), category: f.get('category'), cuisine: f.get('cuisine'),
            address: f.get('address'), deliveryTime: f.get('deliveryTime'),
            deliveryFee: Number(f.get('deliveryFee') || 0),
            imageUrl: f.get('imageUrl') || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600'
          }
        });
        toast('New kitchen added!');
        route();
      } catch (err) {
        $('#adminRestError').textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    };
  }
}

/* ============================================================
   Footer
   ============================================================ */
function renderFooter() {
  return `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand-col">
          <div class="footer-brand">
            <div style="width:32px; height:32px; background:linear-gradient(135deg, var(--primary), #10b981); border-radius:8px; display:flex; align-items:center; justify-content:center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M18 2v8"/><path d="M22 2v4a2 2 0 0 1-2 2h-4"/><path d="M18 10v12"/><path d="M6 2v20"/><path d="M2 2h8a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H2z"/></svg>
            </div>
            Plateful
          </div>
          <p class="footer-brand-tagline">Premium food delivery from premier kitchens, delivering extraordinary meals to your doorstep.</p>
          <div class="footer-social">
            <a href="#" class="footer-social-btn" aria-label="Twitter">𝕏</a>
            <a href="#" class="footer-social-btn" aria-label="Instagram">📸</a>
            <a href="#" class="footer-social-btn" aria-label="Facebook">f</a>
          </div>
        </div>
        <div>
          <h4 class="footer-col-title">Explore</h4>
          <ul class="footer-links">
            <li><a href="#/">All Restaurants</a></li>
            <li><a href="#/" onclick="currentCategory='Pizza'; route();">Pizza</a></li>
            <li><a href="#/" onclick="currentCategory='Indian'; route();">Indian Curries</a></li>
            <li><a href="#/" onclick="currentCategory='Healthy'; route();">Healthy Bowls</a></li>
          </ul>
        </div>
        <div>
          <h4 class="footer-col-title">Account</h4>
          <ul class="footer-links">
            <li><a href="#/orders">Order History</a></li>
            <li><a href="#" onclick="openRewardsDialog()">Plateful Rewards</a></li>
            <li><a href="#" onclick="openProfileDialog()">My Profile</a></li>
          </ul>
        </div>
        <div>
          <h4 class="footer-col-title">Company</h4>
          <ul class="footer-links">
            <li><a href="#">About Plateful</a></li>
            <li><a href="#">Partner with Us</a></li>
            <li><a href="#">Careers</a></li>
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Service</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p class="footer-bottom-text">© ${new Date().getFullYear()} Plateful. Made with ❤️ for food lovers.</p>
        <div class="footer-bottom-coupons">
          <span class="footer-coupon-chip" onclick="applyPromoHero('WELCOME20')">WELCOME20</span>
          <span class="footer-coupon-chip" onclick="applyPromoHero('FREESHIP')">FREESHIP</span>
          <span class="footer-coupon-chip" onclick="applyPromoHero('PLATEFUL50')">PLATEFUL50</span>
        </div>
      </div>
    </footer>`;
}

/* ============================================================
   Global Search Bar
   ============================================================ */
const searchInput = $('#globalSearchInput');
const clearSearchBtn = $('#searchClearBtn');
let searchDebounce;

searchInput.addEventListener('input', e => {
  const val = e.target.value.trim();
  clearSearchBtn.hidden = !val;
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    currentSearch = val;
    const h = location.hash || '#/';
    if (h !== '#/' && !h.startsWith('#/r/')) {
      location.hash = '#/';
    } else if (h === '#/') {
      loadRestaurants();
    }
  }, 280);
});

clearSearchBtn.onclick = () => {
  searchInput.value = '';
  clearSearchBtn.hidden = true;
  currentSearch = '';
  loadRestaurants();
};

/* ============================================================
   Router
   ============================================================ */
async function route() {
  const h = location.hash || '#/';
  updateNav();
  window.scrollTo(0, 0);

  try {
    if (h.startsWith('#/r/')) {
      await showMenu(h.slice(4));
    } else if (h === '#/orders') {
      await showOrders();
    } else if (h === '#/owner') {
      await showOwner();
    } else if (h === '#/admin') {
      await showAdmin();
    } else if (h === '#/favorites') {
      await renderFavorites();
    } else {
      await showExplore();
    }
  } catch (err) {
    view.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">😵</div>
        <h1 class="empty-state-title">Something went wrong</h1>
        <p class="empty-state-desc error">${esc(err.message)}</p>
        <button class="btn btn-primary" onclick="location.hash='#/';">Back to Home</button>
      </div>`;
    console.error('Route error:', err);
  }
}

window.addEventListener('hashchange', route);

/* ============================================================
   Initialize
   ============================================================ */
updateNav();
updateCartBadge();
route();
