/**
 * Plateful: Online Food Ordering System
 * Complete Single-Page Application (SPA)
 */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => el.querySelectorAll(s);
const view = $('#view');

const STATUSES = ['PLACED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
const STATUS_LABEL = {
  PLACED: 'Order Placed',
  PREPARING: 'Kitchen Preparing',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled'
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const money = n => '$' + Number(n || 0).toFixed(2);

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};

let user = store.get('user', null);
let cart = store.get('cart', {
  restaurantId: null,
  restaurantName: '',
  restaurantDeliveryFee: 2.49,
  lines: [],
  couponCode: '',
  discount: 0
});

let menuCache = {}; // id -> { restaurant, item }
let currentCategory = 'All';
let currentSearch = '';
let currentSort = 'rating';
let vegOnlyFilter = false;

/* ==========================================================================
   API Client
   ========================================================================== */
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (user && user.token) headers.Authorization = 'Bearer ' + user.token;

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

function toast(msg, bad = false) {
  const t = $('#toast');
  const txt = $('#toastText');
  const icon = $('#toastIcon');
  txt.textContent = msg;
  icon.innerHTML = bad
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
  t.classList.toggle('bad', bad);
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ==========================================================================
   Auth & User Session
   ========================================================================== */
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
  const userDropdown = $('#userDropdown');
  const dropdownUserName = $('#dropdownUserName');
  const dropdownUserRole = $('#dropdownUserRole');
  const headerLocText = $('#headerLocText');

  if (user) {
    authBtnText.textContent = user.name.split(' ')[0];
    dropdownUserName.textContent = user.name;
    dropdownUserRole.textContent = user.role.replace('_', ' ');
    if (user.defaultAddress) {
      headerLocText.textContent = 'Delivering to: ' + user.defaultAddress.split(',')[0];
    }
  } else {
    authBtnText.textContent = 'Sign in';
    headerLocText.textContent = 'Delivering to: Market Lane';
  }

  adminLink.hidden = !(user && user.role === 'ADMIN');
  ownerLink.hidden = !(user && (user.role === 'RESTAURANT_OWNER' || user.role === 'ADMIN'));

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
  if (expired) toast('Session expired. Please log in again.', true);
  else toast('Logged out successfully');
  if (['#/orders', '#/admin', '#/owner'].includes(location.hash)) location.hash = '#/';
  else route();
}

/* Auth Dialog */
const authDialog = $('#authDialog');
let authMode = 'login';

function openAuth(mode = 'login') {
  authMode = mode;
  $('#tabLogin').classList.toggle('active', mode === 'login');
  $('#tabRegister').classList.toggle('active', mode === 'register');
  $('#registerFields').hidden = mode === 'login';
  $('#authSubmit').textContent = mode === 'login' ? 'Log In' : 'Create Account';
  $('#authError').textContent = '';
  if (!authDialog.open) authDialog.showModal();
}

$('#tabLogin').onclick = () => openAuth('login');
$('#tabRegister').onclick = () => openAuth('register');
$('#authCloseBtn').onclick = () => authDialog.close();

// 1-Click Demo Login
$$('[data-demo-role]').forEach(btn => {
  btn.onclick = async () => {
    const role = btn.dataset.demoRole;
    let email = 'sarah@food.com', pass = 'sarah123';
    if (role === 'owner') { email = 'owner@lantern.com'; pass = 'owner123'; }
    if (role === 'admin') { email = 'admin@food.com'; pass = 'admin123'; }

    try {
      btn.disabled = true;
      const u = await api('/auth/login', { method: 'POST', body: { email, password: pass } });
      setUser(u);
      authDialog.close();
      toast('Signed in as ' + u.name);
      route();
    } catch (e) {
      $('#authError').textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  };
});

$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const btn = $('#authSubmit');
  btn.disabled = true;
  $('#authError').textContent = '';

  try {
    const body = {
      email: f.get('email'),
      password: f.get('password')
    };

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
    toast('Welcome, ' + u.name.split(' ')[0] + '!');
    route();
  } catch (err) {
    $('#authError').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

// User Menu Dropdown Toggle
$('#authBtn').onclick = e => {
  e.stopPropagation();
  if (!user) {
    openAuth('login');
  } else {
    const d = $('#userDropdown');
    d.hidden = !d.hidden;
  }
};

document.addEventListener('click', e => {
  if (!e.target.closest('#userMenuWrapper')) {
    $('#userDropdown').hidden = true;
  }
});

$('#menuLogoutBtn').onclick = () => logout();
$('#menuOrdersBtn').onclick = () => {
  $('#userDropdown').hidden = true;
  location.hash = '#/orders';
};

// Profile Modal
const profileDialog = $('#profileDialog');
$('#menuProfileBtn').onclick = () => {
  $('#userDropdown').hidden = true;
  if (!user) return;
  $('#profName').value = user.name || '';
  $('#profPhone').value = user.phone || '';
  $('#profAddress').value = user.defaultAddress || '';
  $('#profileError').textContent = '';
  $('#passwordError').textContent = '';
  profileDialog.showModal();
};
$('#profileCloseBtn').onclick = () => profileDialog.close();

$('#profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const btn = $('#saveProfileBtn');
  btn.disabled = true;
  try {
    const u = await api('/auth/profile', {
      method: 'PUT',
      body: {
        name: f.get('name'),
        phone: f.get('phone'),
        defaultAddress: f.get('defaultAddress')
      }
    });
    setUser(u);
    toast('Profile updated');
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
      body: {
        oldPassword: f.get('oldPassword'),
        newPassword: f.get('newPassword')
      }
    });
    toast('Password changed successfully');
    e.target.reset();
  } catch (err) {
    $('#passwordError').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

/* ==========================================================================
   Shopping Cart & Checkout
   ========================================================================== */
const cartEl = $('#cart');
const scrim = $('#scrim');

function openCart() {
  cartEl.hidden = false;
  scrim.hidden = false;
  renderCart();
}

function closeCart() {
  cartEl.hidden = true;
  scrim.hidden = true;
}

$('#cartBtn').onclick = () => (cartEl.hidden ? openCart() : closeCart());
$('#cartClose').onclick = closeCart;
scrim.onclick = closeCart;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !cartEl.hidden) closeCart();
});

function saveCart() {
  store.set('cart', cart);
  updateCartBadge();
  renderCart();
  // Update in-page item steppers if viewing menu
  renderDishButtons();
}

function updateCartBadge() {
  const count = cart.lines.reduce((s, l) => s + l.qty, 0);
  $('#cartCount').textContent = count;
  $('#cartBtnTotal').textContent = money(cartSubtotal());
}

const cartSubtotal = () => cart.lines.reduce((s, l) => s + l.price * l.qty, 0);

function addToCart(restaurant, item) {
  if (cart.restaurantId && cart.restaurantId !== restaurant.id && cart.lines.length) {
    if (!confirm('Your cart contains dishes from ' + cart.restaurantName + '.\n\nStart a fresh order for ' + restaurant.name + '?')) {
      return;
    }
    cart.lines = [];
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
  toast(item.name + ' added to cart');
}

function changeCartQty(id, delta) {
  const line = cart.lines.find(l => l.menuItemId === id);
  if (!line) return;
  line.qty = Math.min(50, line.qty + delta);
  if (line.qty <= 0) {
    cart.lines = cart.lines.filter(l => l !== line);
  }
  if (!cart.lines.length) {
    cart.restaurantId = null;
    cart.restaurantName = '';
    cart.couponCode = '';
    cart.discount = 0;
  }
  saveCart();
}

function renderCart() {
  updateCartBadge();
  const body = $('#cartBody');
  const count = cart.lines.reduce((s, l) => s + l.qty, 0);
  $('#cartSubtitle').textContent = count === 1 ? '1 item' : count + ' items';

  if (!cart.lines.length) {
    body.innerHTML = `
      <div style="text-align:center; padding: 3rem 1rem;">
        <div style="font-size:3rem; margin-bottom:1rem;">🛒</div>
        <h3 style="margin-bottom:0.5rem; font-weight:800;">Your cart is empty</h3>
        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.5rem;">Pick a restaurant and add some handcrafted dishes to get started.</p>
        <button class="btn btn-primary" onclick="closeCart(); location.hash='#/';">Browse Restaurants</button>
      </div>`;
    return;
  }

  const sub = cartSubtotal();
  const fee = cart.restaurantDeliveryFee || 0;
  const disc = cart.discount || 0;
  const total = Math.max(0, sub + fee - disc);

  body.innerHTML = `
    <div class="cart-restaurant-banner">
      <div style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--primary); letter-spacing:0.04em;">Ordering From</div>
      <div class="cart-restaurant-name">${esc(cart.restaurantName)}</div>
    </div>

    <!-- Items List -->
    <div class="cart-items-wrapper">
      ${cart.lines.map(l => `
        <div class="cart-item">
          <img class="cart-item-thumb" src="${esc(l.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100')}" alt="${esc(l.name)}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'">
          <div class="cart-item-details">
            <div class="cart-item-name">${esc(l.name)}</div>
            <div class="cart-item-price">${money(l.price * l.qty)} <span style="font-size:0.75rem; color:var(--text-soft);">(${money(l.price)} each)</span></div>
          </div>
          <div class="cart-item-stepper">
            <button type="button" data-cart-delta="-1" data-id="${esc(l.menuItemId)}" aria-label="Decrease">&minus;</button>
            <span class="cart-item-qty">${l.qty}</span>
            <button type="button" data-cart-delta="1" data-id="${esc(l.menuItemId)}" aria-label="Increase">&plus;</button>
          </div>
        </div>`).join('')}
    </div>

    <!-- Coupon Box -->
    <div class="promo-box">
      <div class="promo-form">
        <input type="text" id="couponInput" placeholder="Coupon Code" value="${esc(cart.couponCode || '')}">
        <button class="btn btn-primary small" type="button" id="applyCouponBtn">Apply</button>
      </div>
      <div class="promo-chips-list">
        <span class="promo-tag" data-apply-code="WELCOME20">WELCOME20 (20% off)</span>
        <span class="promo-tag" data-apply-code="FREESHIP">FREESHIP (Free delivery)</span>
        <span class="promo-tag" data-apply-code="TASTY10">TASTY10 ($10 off $30)</span>
      </div>
    </div>

    <!-- Delivery & Notes -->
    <div class="checkout-section">
      <label class="checkout-label">Delivery Address *</label>
      <textarea class="checkout-input" id="orderAddress" rows="2" placeholder="Street, apartment, floor, landmark">${esc(user ? (user.defaultAddress || '') : '')}</textarea>

      <label class="checkout-label">Contact Phone</label>
      <input type="tel" class="checkout-input" id="orderPhone" placeholder="Mobile phone for delivery updates" value="${esc(user ? (user.phone || '') : '')}">

      <label class="checkout-label">Special Delivery Instructions</label>
      <input type="text" class="checkout-input" id="orderNotes" placeholder="e.g. Leave at door, don't ring bell">

      <!-- Payment Method -->
      <label class="checkout-label">Payment Method</label>
      <div class="payment-options">
        <div class="payment-card active" data-pay="CARD">💳 Card</div>
        <div class="payment-card" data-pay="UPI">📱 UPI</div>
        <div class="payment-card" data-pay="COD">💵 Cash</div>
      </div>
    </div>

    <!-- Bill Summary -->
    <div class="bill-summary">
      <div class="bill-row"><span>Item Subtotal</span><span>${money(sub)}</span></div>
      <div class="bill-row"><span>Delivery Fee</span><span>${fee === 0 ? '<strong style="color:var(--primary);">FREE</strong>' : money(fee)}</span></div>
      ${disc > 0 ? `<div class="bill-row discount"><span>Promo Discount (${esc(cart.couponCode)})</span><span>-${money(disc)}</span></div>` : ''}
      <div class="bill-row total"><span>Total to Pay</span><span>${money(total)}</span></div>
    </div>

    <p class="error" id="cartError" role="alert"></p>

    <button class="btn btn-primary btn-block" id="placeOrderBtn" type="button" style="padding:0.9rem; font-size:1.05rem;">
      Place Order &bull; ${money(total)}
    </button>
    <button class="btn ghost small btn-block" id="emptyCartBtn" type="button" style="margin-top:0.6rem;">Empty Cart</button>
  `;
}

// Cart Events Delegation
$('#cartBody').addEventListener('click', async e => {
  const stepper = e.target.closest('[data-cart-delta]');
  if (stepper) {
    changeCartQty(stepper.dataset.id, Number(stepper.dataset.cartDelta));
    return;
  }

  const promoTag = e.target.closest('[data-apply-code]');
  if (promoTag) {
    $('#couponInput').value = promoTag.dataset.applyCode;
    await applyCoupon(promoTag.dataset.applyCode);
    return;
  }

  if (e.target.id === 'applyCouponBtn') {
    const code = $('#couponInput').value.trim();
    await applyCoupon(code);
    return;
  }

  const payCard = e.target.closest('[data-pay]');
  if (payCard) {
    $$('.payment-card').forEach(c => c.classList.remove('active'));
    payCard.classList.add('active');
    return;
  }

  if (e.target.id === 'emptyCartBtn') {
    cart = { restaurantId: null, restaurantName: '', restaurantDeliveryFee: 2.49, lines: [], couponCode: '', discount: 0 };
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
      body: {
        code,
        subtotal: cartSubtotal(),
        deliveryFee: cart.restaurantDeliveryFee || 0
      }
    });
    if (res.valid) {
      cart.couponCode = res.code;
      cart.discount = res.discount;
      saveCart();
      toast('Coupon ' + res.code + ' applied: Saved ' + money(res.discount));
    } else {
      toast(res.message, true);
    }
  } catch (err) {
    toast(err.message, true);
  }
}

async function submitOrder() {
  const errBox = $('#cartError');
  errBox.textContent = '';

  if (!user) {
    closeCart();
    openAuth('login');
    toast('Please sign in or create an account to place an order');
    return;
  }

  const address = $('#orderAddress').value.trim();
  if (!address) {
    errBox.textContent = 'Please enter a delivery address.';
    return;
  }

  const phone = $('#orderPhone').value.trim();
  const specialInstructions = $('#orderNotes').value.trim();
  const activePay = $('.payment-card.active');
  const paymentMethod = activePay ? activePay.dataset.pay : 'CARD';

  const btn = $('#placeOrderBtn');
  btn.disabled = true;
  btn.textContent = 'Processing Order...';

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
        items: cart.lines.map(l => ({ menuItemId: l.menuItemId, quantity: l.qty }))
      }
    });

    cart = { restaurantId: null, restaurantName: '', restaurantDeliveryFee: 2.49, lines: [], couponCode: '', discount: 0 };
    saveCart();
    closeCart();
    toast('Order placed successfully! Tracking your delivery...');
    location.hash = '#/orders';
  } catch (err) {
    errBox.textContent = err.message;
    btn.disabled = false;
    btn.textContent = 'Place Order';
  }
}

/* ==========================================================================
   Views: Explore (Home)
   ========================================================================== */
async function showExplore() {
  view.innerHTML = `
    <section class="hero">
      <div class="hero-content">
        <span class="hero-pill">⚡ Freshly Prepared &bull; Delivered in 30 Mins</span>
        <h1 class="hero-title">Handcrafted dishes from premier local kitchens.</h1>
        <p class="hero-desc">Discover artisanal noodle houses, wood-fired pizzas, royal Mughal curries, and organic harvest bowls delivered hot to your doorstep.</p>
        <div class="hero-promos">
          <span class="promo-chip" onclick="applyPromoHero('WELCOME20')">
            <span class="promo-code">WELCOME20</span> &bull; 20% off first order
          </span>
          <span class="promo-chip" onclick="applyPromoHero('FREESHIP')">
            <span class="promo-code">FREESHIP</span> &bull; Free delivery
          </span>
        </div>
      </div>
    </section>

    <!-- Category Filter Bar -->
    <div class="category-bar" id="categoryBar">
      <button class="cat-btn ${currentCategory === 'All' ? 'active' : ''}" data-cat="All">All Kitchens</button>
      <button class="cat-btn ${currentCategory === 'Pizza' ? 'active' : ''}" data-cat="Pizza">🍕 Artisanal Pizza</button>
      <button class="cat-btn ${currentCategory === 'Asian' ? 'active' : ''}" data-cat="Asian">🍜 Asian & Noodles</button>
      <button class="cat-btn ${currentCategory === 'Indian' ? 'active' : ''}" data-cat="Indian">🍛 Indian Curries</button>
      <button class="cat-btn ${currentCategory === 'Burgers' ? 'active' : ''}" data-cat="Burgers">🍔 Smash Burgers</button>
      <button class="cat-btn ${currentCategory === 'Healthy' ? 'active' : ''}" data-cat="Healthy">🥗 Harvest Bowls</button>
    </div>

    <!-- Section Header & Filter Toolbar -->
    <div class="section-toolbar">
      <div>
        <h2 class="section-title" id="exploreSectionTitle">Featured Restaurants (${currentCategory})</h2>
        <span style="font-size:0.85rem; color:var(--text-muted);" id="resultCountText"></span>
      </div>
      <div class="sort-group">
        <label class="sort-label" for="sortSelect">Sort By:</label>
        <select class="sort-select" id="sortSelect">
          <option value="rating" ${currentSort === 'rating' ? 'selected' : ''}>★ Highest Rated</option>
          <option value="deliveryTime" ${currentSort === 'deliveryTime' ? 'selected' : ''}>⚡ Fastest Delivery</option>
          <option value="fee" ${currentSort === 'fee' ? 'selected' : ''}>💸 Lowest Delivery Fee</option>
        </select>
      </div>
    </div>

    <!-- Restaurant Grid -->
    <div class="rest-grid" id="restaurantGrid">
      <p style="color:var(--text-muted); padding:2rem 0;">Loading fresh kitchens...</p>
    </div>
  `;

  // Bind category clicks
  $('#categoryBar').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (btn) {
      currentCategory = btn.dataset.cat;
      $$('.cat-btn').forEach(b => b.classList.toggle('active', b === btn));
      loadRestaurants();
    }
  });

  // Bind sort change
  $('#sortSelect').addEventListener('change', e => {
    currentSort = e.target.value;
    loadRestaurants();
  });

  await loadRestaurants();
}

window.applyPromoHero = function(code) {
  cart.couponCode = code;
  saveCart();
  openCart();
  toast('Promo ' + code + ' applied!');
};

async function loadRestaurants() {
  const grid = $('#restaurantGrid');
  try {
    const query = new URLSearchParams();
    if (currentSearch) query.set('search', currentSearch);
    if (currentCategory && currentCategory !== 'All') query.set('category', currentCategory);
    if (currentSort) query.set('sort', currentSort);

    const list = await api('/restaurants?' + query.toString());
    $('#resultCountText').textContent = list.length + ' kitchens ready to deliver';

    if (!list.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:3rem 1rem;">
          <div style="font-size:2.5rem; margin-bottom:0.75rem;">🔍</div>
          <h3>No restaurants match your search</h3>
          <p style="color:var(--text-muted); font-size:0.9rem;">Try selecting another category or clear your search term.</p>
        </div>`;
      return;
    }

    grid.innerHTML = list.map(r => `
      <article class="rest-card">
        <a href="#/r/${esc(r.id)}" style="display:flex; flex-direction:column; flex:1;">
          <div class="rest-thumb-wrap">
            <img class="rest-thumb" src="${esc(r.imageUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600')}" alt="${esc(r.name)}" loading="lazy">
            <div class="rest-badge-top">
              ${r.featured ? '<span class="badge-featured">Featured</span>' : ''}
            </div>
            <span class="badge-time">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
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
                ${r.deliveryFee === 0 ? 'Free Delivery' : money(r.deliveryFee) + ' Delivery'}
              </span>
              <span class="rest-address">${esc(r.address || '')}</span>
            </div>
          </div>
        </a>
      </article>`).join('');
  } catch (err) {
    grid.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

/* ==========================================================================
   Views: Restaurant Menu
   ========================================================================== */
async function showMenu(id) {
  view.innerHTML = '<p style="color:var(--text-muted); padding:3rem 0; text-align:center;">Loading menu...</p>';

  const [restaurant, items] = await Promise.all([
    api('/restaurants/' + encodeURIComponent(id)),
    api('/restaurants/' + encodeURIComponent(id) + '/menu')
  ]);

  menuCache = {};
  items.forEach(i => { menuCache[i.id] = { restaurant, item: i }; });

  const categories = [...new Set(items.map(i => i.category || 'Mains'))];
  const isAdminOrOwner = user && (user.role === 'ADMIN' || (user.role === 'RESTAURANT_OWNER' && (restaurant.ownerId === user.id || restaurant.ownerEmail === user.email)));

  view.innerHTML = `
    <!-- Restaurant Cover Hero -->
    <div class="menu-hero">
      <img class="menu-hero-img" src="${esc(restaurant.imageUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000')}" alt="${esc(restaurant.name)}">
      <div class="menu-hero-overlay">
        <a class="back-link" href="#/">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>
          Back to Restaurants
        </a>
        <h1 class="menu-rest-name">${esc(restaurant.name)}</h1>
        <div class="menu-rest-meta">
          <span class="meta-item">★ <strong>${Number(restaurant.rating || 4.5).toFixed(1)}</strong></span>
          <span class="meta-item">&bull;</span>
          <span class="meta-item">⚡ ${esc(restaurant.deliveryTime || '25-35 min')}</span>
          <span class="meta-item">&bull;</span>
          <span class="meta-item">${restaurant.deliveryFee === 0 ? '<span style="color:#6ee7b7; font-weight:700;">Free Delivery</span>' : money(restaurant.deliveryFee) + ' delivery fee'}</span>
          <span class="meta-item">&bull;</span>
          <span class="meta-item">${esc(restaurant.address || '')}</span>
        </div>
      </div>
    </div>

    <!-- Sticky Menu Nav Toolbar -->
    <div class="menu-nav-sticky">
      <div class="menu-tabs">
        <button class="menu-tab-btn active" data-jump-cat="all">All Dishes</button>
        ${categories.map(c => `<button class="menu-tab-btn" data-jump-cat="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>

      <!-- Veg Only Filter Switch -->
      <label class="veg-toggle-wrap">
        <input type="checkbox" id="vegFilterToggle" ${vegOnlyFilter ? 'checked' : ''} style="accent-color:var(--primary); width:18px; height:18px;">
        <span>🌱 Veg Only</span>
      </label>
    </div>

    <!-- Dish Sections by Category -->
    <div id="dishSectionsWrapper">
      ${renderDishSections(items, isAdminOrOwner)}
    </div>
  `;

  // Bind Veg Filter toggle
  $('#vegFilterToggle').addEventListener('change', e => {
    vegOnlyFilter = e.target.checked;
    $('#dishSectionsWrapper').innerHTML = renderDishSections(items, isAdminOrOwner);
    renderDishButtons();
  });

  // Bind category tabs scrolling
  $$('[data-jump-cat]').forEach(btn => {
    btn.onclick = () => {
      $$('.menu-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      const target = btn.dataset.jumpCat;
      if (target === 'all') {
        window.scrollTo({ top: 300, behavior: 'smooth' });
      } else {
        const sec = document.getElementById('cat-sec-' + target.replace(/\s+/g, '-'));
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
  });

  renderDishButtons();
}

function renderDishSections(items, isAdminOrOwner) {
  let filtered = items;
  if (vegOnlyFilter) {
    filtered = items.filter(i => i.vegetarian);
  }

  if (!filtered.length) {
    return `<div style="text-align:center; padding:3rem 1rem;">
      <p style="color:var(--text-muted);">No vegetarian dishes found for this restaurant.</p>
    </div>`;
  }

  const groups = {};
  filtered.forEach(i => { (groups[i.category || 'Mains'] ||= []).push(i); });

  return Object.entries(groups).map(([cat, list]) => `
    <section class="dish-category" id="cat-sec-${esc(cat.replace(/\s+/g, '-'))}">
      <h2 class="dish-cat-title">${esc(cat)} <span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">(${list.length})</span></h2>
      <div class="dish-grid">
        ${list.map(i => dishCardHtml(i, isAdminOrOwner)).join('')}
      </div>
    </section>`).join('');
}

function dishCardHtml(i, isAdminOrOwner) {
  return `
    <div class="dish-card" id="dish-card-${esc(i.id)}">
      <div class="dish-info">
        <div class="dish-badges">
          ${i.vegetarian ? '<span class="badge-diet veg">Veg</span>' : ''}
          ${i.spicy ? '<span class="badge-diet spicy">Spicy</span>' : ''}
        </div>
        <h3 class="dish-title">${esc(i.name)}</h3>
        <p class="dish-desc">${esc(i.description || '')}</p>
        <div class="dish-price-row">
          <div>
            <span class="dish-price">${money(i.price)}</span>
            ${i.calories ? `<span class="dish-calories">&bull; ${i.calories} kcal</span>` : ''}
          </div>
        </div>
      </div>
      <div class="dish-img-wrap">
        <img class="dish-img" src="${esc(i.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300')}" alt="${esc(i.name)}" loading="lazy">
        <div class="dish-add-btn-wrap" id="dish-action-${esc(i.id)}">
          <!-- Button or Stepper rendered dynamically -->
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
      el.innerHTML = '<span style="background:var(--danger); color:#fff; font-size:0.75rem; font-weight:800; padding:0.2rem 0.5rem; border-radius:var(--radius-full);">Sold Out</span>';
      return;
    }
    const inCart = cart.lines.find(l => l.menuItemId === id);
    if (inCart) {
      el.innerHTML = `
        <div class="dish-stepper">
          <button type="button" data-dish-delta="-1" data-id="${esc(id)}">&minus;</button>
          <span class="dish-stepper-val">${inCart.qty}</span>
          <button type="button" data-dish-delta="1" data-id="${esc(id)}">&plus;</button>
        </div>`;
    } else {
      el.innerHTML = `<button class="btn btn-primary small" type="button" data-dish-add="${esc(id)}">+ Add</button>`;
    }
  });
}

// Delegation for dish card add and steppers
view.addEventListener('click', e => {
  const addBtn = e.target.closest('[data-dish-add]');
  if (addBtn) {
    const entry = menuCache[addBtn.dataset.dishAdd];
    if (entry) addToCart(entry.restaurant, entry.item);
    return;
  }

  const deltaBtn = e.target.closest('[data-dish-delta]');
  if (deltaBtn) {
    changeCartQty(deltaBtn.dataset.id, Number(deltaBtn.dataset.dishDelta));
  }
});

/* ==========================================================================
   Views: My Orders & Live Order Tracking
   ========================================================================== */
async function showOrders() {
  if (!user) {
    view.innerHTML = `
      <div style="text-align:center; padding:4rem 1rem;">
        <div style="font-size:3.5rem; margin-bottom:1rem;">📦</div>
        <h1 class="hero-title" style="color:var(--text-main); margin-bottom:0.5rem;">Track Your Orders</h1>
        <p style="color:var(--text-muted); font-size:1.05rem; margin-bottom:1.5rem;">Sign in to view your live orders, track delivery status, or reorder your favorites.</p>
        <button class="btn btn-primary" onclick="openAuth('login');">Sign In to Continue</button>
      </div>`;
    return;
  }

  view.innerHTML = '<p style="color:var(--text-muted); padding:3rem 0; text-align:center;">Loading orders...</p>';

  const orders = await api('/orders/my');

  if (!orders.length) {
    view.innerHTML = `
      <div style="text-align:center; padding:4rem 1rem;">
        <div style="font-size:3.5rem; margin-bottom:1rem;">🍽️</div>
        <h1 class="section-title" style="margin-bottom:0.5rem;">No Orders Yet</h1>
        <p style="color:var(--text-muted); margin-bottom:1.5rem;">Explore our handpicked local kitchens and place your first delicious order!</p>
        <button class="btn btn-primary" onclick="location.hash='#/';">Browse Menus</button>
      </div>`;
    return;
  }

  const activeOrders = orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status));
  const pastOrders = orders.filter(o => ['DELIVERED', 'CANCELLED'].includes(o.status));

  // Check if active orders exist to toggle topbar pulsing dot
  $('#activeOrderPulse').hidden = activeOrders.length === 0;

  view.innerHTML = `
    <div style="margin-bottom:2rem;">
      <h1 class="section-title" style="font-size:2.2rem; margin-bottom:0.4rem;">Order History & Tracking</h1>
      <p style="color:var(--text-muted);">Real-time status updates and order records for <strong>${esc(user.name)}</strong></p>
    </div>

    ${activeOrders.length ? `
      <div style="margin-bottom:2.5rem;">
        <h2 style="font-size:1.4rem; font-weight:800; margin-bottom:1.25rem; display:flex; align-items:center; gap:0.6rem;">
          <span class="pulse-dot"></span> Live Orders in Progress (${activeOrders.length})
        </h2>
        ${activeOrders.map(o => renderOrderCard(o, false, true)).join('')}
      </div>` : ''}

    <div>
      <h2 style="font-size:1.4rem; font-weight:800; margin-bottom:1.25rem;">Past Orders (${pastOrders.length})</h2>
      ${pastOrders.length ? pastOrders.map(o => renderOrderCard(o, false, false)).join('') : '<p style="color:var(--text-muted);">No past completed orders yet.</p>'}
    </div>
  `;
}

function renderOrderCard(o, admin = false, isLive = false) {
  const steps = [
    { key: 'PLACED', label: 'Order Placed' },
    { key: 'PREPARING', label: 'Kitchen Preparing' },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
    { key: 'DELIVERED', label: 'Delivered' }
  ];

  const currentIdx = steps.findIndex(s => s.key === o.status);
  const isCancelled = o.status === 'CANCELLED';
  const progressPercent = isCancelled ? 0 : Math.max(0, (currentIdx / (steps.length - 1)) * 100);

  return `
    <article class="order-card" id="order-${esc(o.id)}">
      <div class="order-card-head">
        <div>
          <h3 class="order-rest-name">${esc(o.restaurantName)}</h3>
          <span class="order-date">${new Date(o.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}${admin ? ' &bull; Customer: <strong>' + esc(o.customerName) + '</strong>' : ''}</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span class="status-badge" data-status="${esc(o.status)}">${esc(STATUS_LABEL[o.status] || o.status)}</span>
        </div>
      </div>

      <!-- Live Interactive Stepper -->
      ${!isCancelled ? `
        <div class="order-stepper">
          <div class="order-stepper-progress" style="width:${progressPercent}%;"></div>
          ${steps.map((st, idx) => {
            const completed = idx < currentIdx || o.status === 'DELIVERED';
            const active = idx === currentIdx && o.status !== 'DELIVERED';
            return `
              <div class="step-node ${completed ? 'completed' : ''} ${active ? 'active' : ''}">
                <div class="step-circle">${completed ? '✓' : idx + 1}</div>
                <span class="step-label">${esc(st.label)}</span>
              </div>`;
          }).join('')}
        </div>` : `
        <div style="background:var(--danger-light); color:var(--danger); padding:0.75rem 1rem; border-radius:var(--radius-md); font-size:0.88rem; margin:1rem 0; font-weight:600;">
          Order was cancelled: ${esc(o.cancelReason || 'Cancelled by customer')}
        </div>`}

      <!-- Itemized summary -->
      <ul class="order-items-list">
        ${o.items.map(i => `
          <li class="order-item-row">
            <span><strong>${i.quantity}x</strong> ${esc(i.name)}</span>
            <span style="font-weight:700;">${money(i.price * i.quantity)}</span>
          </li>`).join('')}
      </ul>

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; font-size:0.88rem; color:var(--text-muted);">
        <div>📍 Deliver to: <strong>${esc(o.address)}</strong></div>
        <div style="font-size:1.15rem; font-weight:800; color:var(--text-main);">Total: ${money(o.total)} <span style="font-size:0.75rem; font-weight:600; color:var(--primary); text-transform:uppercase;">(${esc(o.paymentMethod || 'CARD')} - ${esc(o.paymentStatus || 'PAID')})</span></div>
      </div>

      <!-- Actions Toolbar -->
      <div class="order-actions-bar">
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          ${isLive && !admin ? `
            <button class="btn danger small" type="button" data-order-cancel="${esc(o.id)}">Cancel Order</button>
            <button class="btn ghost small" type="button" data-order-simulate="${esc(o.id)}" title="Simulate real-time delivery progression">⚡ Simulate Next Step</button>` : ''}
          <button class="btn ghost small" type="button" data-order-receipt="${esc(o.id)}">View Receipt</button>
          <button class="btn btn-primary small" type="button" data-order-reorder="${esc(o.id)}">↻ Reorder Items</button>
        </div>

        ${admin ? `
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <label style="font-size:0.85rem; font-weight:700;">Update Status:</label>
            <select class="sort-select" data-admin-status-for="${esc(o.id)}">
              ${STATUSES.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
            </select>
          </div>` : ''}
      </div>
    </article>`;
}

// Order View Actions Delegation
view.addEventListener('click', async e => {
  // Cancel Order
  const cancelBtn = e.target.closest('[data-order-cancel]');
  if (cancelBtn) {
    const id = cancelBtn.dataset.orderCancel;
    const reason = prompt('Please enter a cancellation reason:', 'Changed my mind');
    if (!reason) return;
    try {
      await api('/orders/' + encodeURIComponent(id) + '/cancel', {
        method: 'PUT',
        body: { reason }
      });
      toast('Order cancelled');
      route();
    } catch (err) {
      toast(err.message, true);
    }
    return;
  }

  // Simulate Next Step (for testing/demoing live tracking)
  const simBtn = e.target.closest('[data-order-simulate]');
  if (simBtn) {
    const id = simBtn.dataset.orderSimulate;
    try {
      const order = await api('/orders/' + encodeURIComponent(id));
      const nextMap = {
        PLACED: 'PREPARING',
        PREPARING: 'OUT_FOR_DELIVERY',
        OUT_FOR_DELIVERY: 'DELIVERED'
      };
      const nextStatus = nextMap[order.status];
      if (nextStatus) {
        await api('/orders/' + encodeURIComponent(id) + '/status', {
          method: 'PUT',
          body: { status: nextStatus }
        });
        toast('Order advanced to: ' + STATUS_LABEL[nextStatus]);
        route();
      } else {
        toast('Order is already in final status (' + order.status + ')');
      }
    } catch (err) {
      toast(err.message, true);
    }
    return;
  }

  // Reorder items
  const reorderBtn = e.target.closest('[data-order-reorder]');
  if (reorderBtn) {
    const id = reorderBtn.dataset.orderReorder;
    try {
      const order = await api('/orders/' + encodeURIComponent(id));
      cart.restaurantId = order.restaurantId;
      cart.restaurantName = order.restaurantName;
      cart.restaurantDeliveryFee = order.deliveryFee || 0;
      cart.lines = order.items.map(i => ({
        menuItemId: i.menuItemId,
        name: i.name,
        price: i.price,
        imageUrl: i.imageUrl,
        qty: i.quantity
      }));
      saveCart();
      openCart();
      toast('Added ' + order.items.length + ' items to your cart');
    } catch (err) {
      toast(err.message, true);
    }
    return;
  }

  // View Receipt
  const receiptBtn = e.target.closest('[data-order-receipt]');
  if (receiptBtn) {
    const id = receiptBtn.dataset.orderReceipt;
    openReceiptModal(id);
  }
});

async function openReceiptModal(orderId) {
  const dialog = $('#receiptDialog');
  const box = $('#receiptContent');
  box.innerHTML = '<p style="text-align:center;">Loading receipt...</p>';
  dialog.showModal();

  try {
    const o = await api('/orders/' + encodeURIComponent(orderId));
    box.innerHTML = `
      <button class="dialog-close-btn" onclick="document.getElementById('receiptDialog').close();">&times;</button>
      <div style="text-align:center; margin-bottom:1.5rem;">
        <span style="font-size:2rem;">🧾</span>
        <h2 style="font-size:1.6rem; font-weight:800; margin-top:0.3rem;">Order Receipt</h2>
        <p style="color:var(--text-muted); font-size:0.85rem;">Order ID: #${esc(o.id.slice(0, 8).toUpperCase())}</p>
      </div>

      <div style="background:var(--bg-muted); padding:1rem; border-radius:var(--radius-md); font-size:0.88rem; margin-bottom:1.25rem;">
        <div><strong>Kitchen:</strong> ${esc(o.restaurantName)}</div>
        <div><strong>Date:</strong> ${new Date(o.createdAt).toLocaleString()}</div>
        <div><strong>Payment:</strong> ${esc(o.paymentMethod || 'CARD')} (${esc(o.paymentStatus || 'PAID')})</div>
        <div><strong>Delivered to:</strong> ${esc(o.address)}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:0.9rem; margin-bottom:1.25rem;">
        <thead>
          <tr style="border-bottom:2px solid var(--border-light); text-align:left;">
            <th style="padding:0.4rem 0;">Item</th>
            <th style="padding:0.4rem 0; text-align:center;">Qty</th>
            <th style="padding:0.4rem 0; text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${o.items.map(i => `
            <tr style="border-bottom:1px solid var(--border-light);">
              <td style="padding:0.6rem 0;">${esc(i.name)}</td>
              <td style="padding:0.6rem 0; text-align:center;">${i.quantity}</td>
              <td style="padding:0.6rem 0; text-align:right; font-weight:700;">${money(i.price * i.quantity)}</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="font-size:0.9rem; margin-bottom:1.5rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;"><span>Subtotal:</span><span>${money(o.subtotal || o.total)}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;"><span>Delivery Fee:</span><span>${money(o.deliveryFee || 0)}</span></div>
        ${o.discount > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:0.3rem; color:var(--primary); font-weight:700;"><span>Discount:</span><span>-${money(o.discount)}</span></div>` : ''}
        <div style="display:flex; justify-content:space-between; font-size:1.2rem; font-weight:800; border-top:1px dashed #cbd5e1; padding-top:0.6rem;"><span>Total Paid:</span><span>${money(o.total)}</span></div>
      </div>

      <button class="btn btn-primary btn-block" onclick="document.getElementById('receiptDialog').close();">Close</button>
    `;
  } catch (err) {
    box.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

/* ==========================================================================
   Views: Merchant (Owner) Portal
   ========================================================================== */
async function showOwner() {
  if (!user || (user.role !== 'RESTAURANT_OWNER' && user.role !== 'ADMIN')) {
    view.innerHTML = `
      <div style="text-align:center; padding:4rem 1rem;">
        <h1 class="hero-title" style="color:var(--text-main);">Merchant Portal</h1>
        <p style="color:var(--text-muted); margin-bottom:1.5rem;">This portal is reserved for restaurant owners and head chefs.</p>
        <button class="btn btn-primary" onclick="openAuth('login');">Log in as Restaurant Owner</button>
      </div>`;
    return;
  }

  view.innerHTML = '<p style="color:var(--text-muted); padding:3rem 0; text-align:center;">Loading merchant dashboard...</p>';

  const [myRestaurants, myOrders] = await Promise.all([
    api('/restaurants/my'),
    api('/orders')
  ]);

  view.innerHTML = `
    <div class="admin-header">
      <h1 class="section-title" style="font-size:2.2rem; margin-bottom:0.4rem;">Merchant Operations Portal</h1>
      <p style="color:var(--text-muted);">Manage dishes, live orders, kitchen prep, and restaurant profiles for <strong>${esc(user.name)}</strong></p>
    </div>

    <!-- Quick Metrics -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">🏪</div>
        <div>
          <div class="stat-val">${myRestaurants.length}</div>
          <div class="stat-label">Active Kitchens</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📦</div>
        <div>
          <div class="stat-val">${myOrders.length}</div>
          <div class="stat-label">Incoming Orders</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💰</div>
        <div>
          <div class="stat-val">${money(myOrders.reduce((s, o) => s + o.total, 0))}</div>
          <div class="stat-label">Total Revenue</div>
        </div>
      </div>
    </div>

    <!-- Live Orders Section -->
    <section class="admin-section">
      <div class="admin-section-head">
        <h2>Live Kitchen Orders (${myOrders.length})</h2>
      </div>
      ${myOrders.length ? myOrders.map(o => renderOrderCard(o, true, false)).join('') : '<p style="color:var(--text-muted);">No orders placed yet.</p>'}
    </section>

    <!-- Menu & Dish Management -->
    <section class="admin-section">
      <div class="admin-section-head">
        <h2>Menu Catalog & Real-Time Stock</h2>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:1.25rem;">
        <!-- Add New Dish Card -->
        <div class="dialog-card" style="border:2px dashed var(--border-light); background:var(--bg-muted);">
          <h3 style="margin-bottom:0.85rem; font-weight:800;">+ Add New Menu Item</h3>
          <form id="ownerAddDishForm">
            <label>Select Restaurant
              <select name="restaurantId" required>
                ${myRestaurants.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}
              </select>
            </label>
            <label>Dish Name
              <input name="name" placeholder="e.g. Truffle Gnocchi" required>
            </label>
            <label>Description
              <textarea name="description" rows="2" placeholder="Ingredients and flavor notes"></textarea>
            </label>
            <div class="form-row">
              <label>Price ($)
                <input name="price" type="number" step="0.01" min="0.01" placeholder="12.50" required>
              </label>
              <label>Category
                <input name="category" placeholder="e.g. Pasta">
              </label>
            </div>
            <label>Image URL
              <input name="imageUrl" placeholder="https://images.unsplash.com/...">
            </label>
            <div class="form-row" style="margin-bottom:1rem;">
              <label style="display:flex; align-items:center; gap:0.4rem; font-weight:700;">
                <input type="checkbox" name="vegetarian" style="width:18px; height:18px;"> Vegetarian
              </label>
              <label style="display:flex; align-items:center; gap:0.4rem; font-weight:700;">
                <input type="checkbox" name="spicy" style="width:18px; height:18px;"> Spicy
              </label>
            </div>
            <button class="btn btn-primary btn-block" type="submit">Create Dish</button>
          </form>
        </div>
      </div>
    </section>
  `;

  // Bind Order Status Updater
  view.querySelectorAll('[data-admin-status-for]').forEach(sel => {
    sel.onchange = async () => {
      const orderId = sel.dataset.adminStatusFor;
      try {
        await api('/orders/' + encodeURIComponent(orderId) + '/status', {
          method: 'PUT',
          body: { status: sel.value }
        });
        toast('Order status updated to ' + STATUS_LABEL[sel.value]);
        route();
      } catch (err) {
        toast(err.message, true);
      }
    };
  });

  // Bind Dish Creation Form
  const addForm = $('#ownerAddDishForm');
  if (addForm) {
    addForm.onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const restId = f.get('restaurantId');
      try {
        await api('/restaurants/' + encodeURIComponent(restId) + '/menu', {
          method: 'POST',
          body: {
            name: f.get('name'),
            description: f.get('description'),
            price: Number(f.get('price')),
            category: f.get('category') || 'Mains',
            imageUrl: f.get('imageUrl') || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
            vegetarian: f.get('vegetarian') === 'on',
            spicy: f.get('spicy') === 'on'
          }
        });
        toast('New dish created successfully');
        route();
      } catch (err) {
        toast(err.message, true);
      }
    };
  }
}

/* ==========================================================================
   Views: Platform Admin Console
   ========================================================================== */
async function showAdmin() {
  if (!user || user.role !== 'ADMIN') {
    view.innerHTML = `
      <div style="text-align:center; padding:4rem 1rem;">
        <h1 class="hero-title" style="color:var(--text-main);">Admin Console</h1>
        <p style="color:var(--text-muted); margin-bottom:1.5rem;">Access restricted to system administrators.</p>
        <button class="btn btn-primary" onclick="openAuth('login');">Sign In as Admin</button>
      </div>`;
    return;
  }

  view.innerHTML = '<p style="color:var(--text-muted); padding:3rem 0; text-align:center;">Loading admin console...</p>';

  const [stats, orders, restaurants] = await Promise.all([
    api('/admin/stats'),
    api('/orders'),
    api('/restaurants')
  ]);

  view.innerHTML = `
    <div class="admin-header">
      <h1 class="section-title" style="font-size:2.2rem; margin-bottom:0.4rem;">System Administration Console</h1>
      <p style="color:var(--text-muted);">Platform Overview &bull; Live Orders &bull; Restaurant Directory</p>
    </div>

    <!-- Platform Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background:#dcfce7; color:#15803d;">💵</div>
        <div>
          <div class="stat-val">${money(stats.totalRevenue)}</div>
          <div class="stat-label">Total Platform GMV</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#fed7aa; color:#c2410c;">📦</div>
        <div>
          <div class="stat-val">${stats.totalOrders}</div>
          <div class="stat-label">Total Orders Placed</div>
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
          <div class="stat-label">Partner Kitchens</div>
        </div>
      </div>
    </div>

    <!-- All Orders Section -->
    <section class="admin-section">
      <div class="admin-section-head">
        <h2>All Platform Orders (${orders.length})</h2>
      </div>
      ${orders.length ? orders.map(o => renderOrderCard(o, true, false)).join('') : '<p style="color:var(--text-muted);">No orders yet.</p>'}
    </section>

    <!-- Add Partner Kitchen Form -->
    <section class="admin-section">
      <div class="admin-section-head">
        <h2>Register New Partner Kitchen</h2>
      </div>
      <form id="adminAddRestForm" style="max-width:620px;">
        <label>Kitchen Name
          <input name="name" placeholder="e.g. Sakura Ramen Bar" required>
        </label>
        <div class="form-row">
          <label>Cuisine Category
            <select name="category">
              <option value="Asian">Asian & Noodles</option>
              <option value="Pizza">Artisanal Pizza</option>
              <option value="Indian">Indian Curries</option>
              <option value="Burgers">Smash Burgers</option>
              <option value="Healthy">Healthy Bowls</option>
            </select>
          </label>
          <label>Cuisine Subtitle
            <input name="cuisine" placeholder="e.g. Japanese • Tonkotsu Ramen">
          </label>
        </div>
        <label>Street Address
          <input name="address" placeholder="e.g. 55 High Street" required>
        </label>
        <div class="form-row">
          <label>Estimated Delivery Time
            <input name="deliveryTime" value="20-30 min">
          </label>
          <label>Delivery Fee ($)
            <input name="deliveryFee" type="number" step="0.01" value="1.99">
          </label>
        </div>
        <label>Cover Photo URL
          <input name="imageUrl" placeholder="https://images.unsplash.com/...">
        </label>
        <p class="error" id="adminRestError"></p>
        <button class="btn btn-primary" type="submit">Create Kitchen</button>
      </form>
    </section>
  `;

  // Status updates in Admin
  view.querySelectorAll('[data-admin-status-for]').forEach(sel => {
    sel.onchange = async () => {
      const orderId = sel.dataset.adminStatusFor;
      try {
        await api('/orders/' + encodeURIComponent(orderId) + '/status', {
          method: 'PUT',
          body: { status: sel.value }
        });
        toast('Status updated to ' + STATUS_LABEL[sel.value]);
        route();
      } catch (err) {
        toast(err.message, true);
      }
    };
  });

  // Admin Kitchen Registration
  const addRestForm = $('#adminAddRestForm');
  if (addRestForm) {
    addRestForm.onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api('/restaurants', {
          method: 'POST',
          body: {
            name: f.get('name'),
            category: f.get('category'),
            cuisine: f.get('cuisine'),
            address: f.get('address'),
            deliveryTime: f.get('deliveryTime'),
            deliveryFee: Number(f.get('deliveryFee') || 0),
            rating: 4.8,
            imageUrl: f.get('imageUrl') || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600'
          }
        });
        toast('New kitchen added successfully');
        route();
      } catch (err) {
        $('#adminRestError').textContent = err.message;
      }
    };
  }
}

/* ==========================================================================
   Global Search Bar Integration
   ========================================================================== */
const searchInput = $('#globalSearchInput');
const clearSearchBtn = $('#searchClearBtn');

let searchDebounce = null;
searchInput.addEventListener('input', e => {
  const val = e.target.value.trim();
  clearSearchBtn.hidden = !val;
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    currentSearch = val;
    if (location.hash !== '#/' && !location.hash.startsWith('#/r/')) {
      location.hash = '#/';
    } else if (location.hash === '#/') {
      loadRestaurants();
    }
  }, 250);
});

clearSearchBtn.onclick = () => {
  searchInput.value = '';
  clearSearchBtn.hidden = true;
  currentSearch = '';
  loadRestaurants();
};

/* ==========================================================================
   Router
   ========================================================================== */
async function route() {
  const h = location.hash || '#/';
  updateNav();

  try {
    if (h.startsWith('#/r/')) {
      await showMenu(h.slice(4));
    } else if (h === '#/orders') {
      await showOrders();
    } else if (h === '#/owner') {
      await showOwner();
    } else if (h === '#/admin') {
      await showAdmin();
    } else {
      await showExplore();
    }
  } catch (err) {
    view.innerHTML = `
      <div style="text-align:center; padding:3rem 1rem;">
        <p class="error" style="font-size:1.1rem;">${esc(err.message)}</p>
        <button class="btn btn-primary" onclick="location.hash='#/';">Back to Home</button>
      </div>`;
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

// Initialize
updateNav();
updateCartBadge();
route();
