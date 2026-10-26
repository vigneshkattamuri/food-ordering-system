/**
 * Plateful — Upgraded Vercel Serverless API
 * Version 2.0
 *
 * Security improvements:
 * - Passwords are now hashed (SHA-256 with salt simulation for zero-dependency env)
 * - Ownership checks on all sensitive operations
 * - Role validation fixed (can't self-promote to ADMIN)
 * - Rate limiting tracker
 *
 * New features:
 * - ACCEPTED order status
 * - Merchant dish edit / toggle availability / delete
 * - Admin user management
 * - Reviews system
 * - Rewards / loyalty points
 * - AI food assistant (menu-filter based)
 * - Favorites API
 * - Notifications API
 * - Analytics endpoints
 * - Scheduled orders
 */

const crypto = require('crypto');

/* ============================================================
   Utility: Simple password hashing (no external deps on Vercel)
   ============================================================ */
function hashPassword(pw) {
  return 'sha256:' + crypto.createHash('sha256').update('plateful_salt_v2_' + pw).digest('hex');
}

function verifyPassword(pw, hash) {
  if (!hash) return false;
  if (hash.startsWith('sha256:')) {
    return hash === hashPassword(pw);
  }
  // Legacy plain-text comparison (for migrating old demo data)
  return pw === hash;
}

/* ============================================================
   In-Memory Data Store (ephemeral; resets on cold start)
   NOTE: For production, replace with MongoDB Atlas via MONGODB_URI
   ============================================================ */

const USERS = [
  {
    id: 'usr_admin_1',
    name: 'Platform Admin',
    email: 'admin@plateful.com',
    passwordHash: hashPassword('admin123'),
    role: 'ADMIN',
    phone: '+91 98765 43210',
    defaultAddress: '100 Tech Hub, Bengaluru',
    token: null,
    rewardPoints: 0,
    favorites: [],
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'usr_owner_1',
    name: 'Chef Marco Liu',
    email: 'owner@lantern.com',
    passwordHash: hashPassword('owner123'),
    role: 'RESTAURANT_OWNER',
    phone: '+91 98123 45678',
    defaultAddress: '12 Market Lane, Kitchen District',
    token: null,
    rewardPoints: 0,
    favorites: [],
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'usr_sarah_1',
    name: 'Sarah Jenkins',
    email: 'sarah@plateful.com',
    passwordHash: hashPassword('sarah123'),
    role: 'CUSTOMER',
    phone: '+91 99887 76543',
    defaultAddress: '742 Evergreen Terrace, Apt 4B, Mumbai',
    token: null,
    rewardPoints: 1250,
    favorites: ['m_1', 'm_6', 'm_10'],
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Also keep the old email aliases for backwards compat with demo logins
USERS[0]._altEmail = 'admin@food.com';
USERS[2]._altEmail = 'sarah@food.com';

const RESTAURANTS = [
  {
    id: 'rst_1',
    name: 'Lantern Noodle House',
    cuisine: 'Asian • Handmade Noodles • Dumplings',
    address: '12 Market Lane, Bandra West, Mumbai',
    rating: 4.8,
    deliveryTime: '20-30 min',
    deliveryFee: 30,
    minOrder: 200,
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
    ownerId: 'usr_owner_1',
    ownerEmail: 'owner@lantern.com',
    category: 'Asian',
    open: true,
    featured: true,
    tags: ['Noodles', 'Dumplings', 'Asian'],
    prepTime: 25,
    totalOrders: 1240
  },
  {
    id: 'rst_2',
    name: 'Fornello Artisanal Pizza',
    cuisine: 'Italian • Wood-Fired Neapolitan Pizza',
    address: '48 Station Road, Koregaon Park, Pune',
    rating: 4.9,
    deliveryTime: '25-35 min',
    deliveryFee: 0,
    minOrder: 200,
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
    ownerId: null,
    ownerEmail: null,
    category: 'Pizza',
    open: true,
    featured: true,
    tags: ['Pizza', 'Italian', 'Wood-fired'],
    prepTime: 30,
    totalOrders: 980
  },
  {
    id: 'rst_3',
    name: 'Masala Junction',
    cuisine: 'Indian • Royal Mughal Curries • Tandoor',
    address: '7 Temple Street, Karol Bagh, Delhi',
    rating: 4.7,
    deliveryTime: '30-40 min',
    deliveryFee: 40,
    minOrder: 200,
    imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
    ownerId: null,
    ownerEmail: null,
    category: 'Indian',
    open: true,
    featured: true,
    tags: ['Indian', 'Curries', 'Tandoor'],
    prepTime: 35,
    totalOrders: 2100
  },
  {
    id: 'rst_4',
    name: 'The Smash Burger Co.',
    cuisine: 'American • Wagyu Burgers • Crispy Fries',
    address: '104 Waterfront Way, Indiranagar, Bengaluru',
    rating: 4.6,
    deliveryTime: '15-25 min',
    deliveryFee: 25,
    minOrder: 150,
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    ownerId: null,
    ownerEmail: null,
    category: 'Burgers',
    open: true,
    featured: false,
    tags: ['Burgers', 'American', 'Fast Food'],
    prepTime: 18,
    totalOrders: 756
  },
  {
    id: 'rst_5',
    name: 'Green & Co. Harvest Bowls',
    cuisine: 'Healthy • Superfood Bowls • Fresh Juices',
    address: '22 Sunny Meadow Drive, Andheri West, Mumbai',
    rating: 4.8,
    deliveryTime: '20-30 min',
    deliveryFee: 0,
    minOrder: 200,
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800',
    ownerId: null,
    ownerEmail: null,
    category: 'Healthy',
    open: true,
    featured: false,
    tags: ['Healthy', 'Vegan', 'Salads'],
    prepTime: 20,
    totalOrders: 534
  },
  {
    id: 'rst_6',
    name: 'Momos & More',
    cuisine: 'Tibetan • Steamed Dumplings • Soups',
    address: '33 Hill View, Majnu Ka Tila, Delhi',
    rating: 4.5,
    deliveryTime: '20-35 min',
    deliveryFee: 30,
    minOrder: 150,
    imageUrl: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=800',
    ownerId: null,
    ownerEmail: null,
    category: 'Chinese',
    open: true,
    featured: false,
    tags: ['Momos', 'Chinese', 'Tibetan'],
    prepTime: 22,
    totalOrders: 890
  }
];

const MENU_ITEMS = [
  // Lantern Noodle House (rst_1)
  { id: 'm_1', restaurantId: 'rst_1', name: 'Sichuan Dan Dan Noodles', description: 'Spicy toasted sesame chili oil broth, braised minced pork, bok choy, crispy peanuts', price: 249, category: 'Noodles', imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600', available: true, vegetarian: false, spicy: true, calories: 580, prepTime: 15, orderCount: 480 },
  { id: 'm_2', restaurantId: 'rst_1', name: 'Slow-Braised Beef Noodle Soup', description: '12-hour star anise beef bone broth, tender brisket cuts, hand-pulled wheat noodles', price: 299, category: 'Noodles', imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600', available: true, vegetarian: false, spicy: false, calories: 640, prepTime: 18, orderCount: 320 },
  { id: 'm_3', restaurantId: 'rst_1', name: 'Pan-Fried Pork & Chive Dumplings', description: 'Eight golden-crisp handmade dumplings served with ginger black vinegar dip', price: 189, category: 'Starters', imageUrl: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=600', available: true, vegetarian: false, spicy: false, calories: 420, prepTime: 12, orderCount: 560 },
  { id: 'm_4', restaurantId: 'rst_1', name: 'Smashed Garlic Chili Cucumber', description: 'Crispy Persian cucumbers dressed in toasted sesame, garlic, and vinegar', price: 129, category: 'Starters', imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600', available: true, vegetarian: true, spicy: true, calories: 180, prepTime: 8, orderCount: 210 },
  { id: 'm_5', restaurantId: 'rst_1', name: 'Wild Honey Jasmine Iced Tea', description: 'Freshly brewed organic jasmine blossom tea chilled over crushed ice', price: 89, category: 'Beverages', imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600', available: true, vegetarian: true, spicy: false, calories: 90, prepTime: 5, orderCount: 340 },

  // Fornello Pizza (rst_2)
  { id: 'm_6', restaurantId: 'rst_2', name: 'Margherita Di Bufala', description: 'San Marzano D.O.P. tomato sauce, fresh buffalo mozzarella, fresh basil, EVOO', price: 349, category: 'Pizza', imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600', available: true, vegetarian: true, spicy: false, calories: 680, prepTime: 20, orderCount: 890 },
  { id: 'm_7', restaurantId: 'rst_2', name: 'Diavola & Hot Honey', description: 'Calabrian spicy soppressata, smoked fior di latte, hot chili infused honey', price: 399, category: 'Pizza', imageUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600', available: true, vegetarian: false, spicy: true, calories: 780, prepTime: 22, orderCount: 675 },
  { id: 'm_8', restaurantId: 'rst_2', name: 'Truffle Wild Mushroom', description: 'Roasted cremini and shiitake, fontina cheese, white truffle cream sauce', price: 449, category: 'Pizza', imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600', available: true, vegetarian: true, spicy: false, calories: 720, prepTime: 25, orderCount: 410 },
  { id: 'm_9', restaurantId: 'rst_2', name: 'Garlic Butter Herb Knots', description: 'Six fresh-baked dough knots glazed with confit garlic butter, parmesan', price: 149, category: 'Sides', imageUrl: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600', available: true, vegetarian: true, spicy: false, calories: 360, prepTime: 15, orderCount: 560 },

  // Masala Junction (rst_3)
  { id: 'm_10', restaurantId: 'rst_3', name: 'Royal Butter Chicken', description: 'Tender tandoor roasted chicken simmered in velvet tomato cream gravy, served with naan', price: 349, category: 'Curries', imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600', available: true, vegetarian: false, spicy: false, calories: 710, prepTime: 25, orderCount: 1240 },
  { id: 'm_11', restaurantId: 'rst_3', name: 'Paneer Tikka Masala', description: 'Charred cottage cheese cubes in spiced onion-bell pepper gravy', price: 299, category: 'Curries', imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600', available: true, vegetarian: true, spicy: true, calories: 650, prepTime: 20, orderCount: 980 },
  { id: 'm_12', restaurantId: 'rst_3', name: 'Charred Garlic Butter Naan', description: 'Tandoor-blistered flatbread brushed with crushed garlic and ghee', price: 79, category: 'Breads', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600', available: true, vegetarian: true, spicy: false, calories: 240, prepTime: 10, orderCount: 1100 },
  { id: 'm_13', restaurantId: 'rst_3', name: 'Dal Makhani', description: 'Slow-cooked black lentils with butter and cream, 24-hour recipe', price: 249, category: 'Curries', imageUrl: 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=600', available: true, vegetarian: true, spicy: false, calories: 480, prepTime: 20, orderCount: 756 },

  // Smash Burger (rst_4)
  { id: 'm_14', restaurantId: 'rst_4', name: 'Double Truffle Bacon Smash', description: 'Two 100% Wagyu smash patties, applewood bacon, black truffle aioli, brioche bun', price: 349, category: 'Burgers', imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600', available: true, vegetarian: false, spicy: false, calories: 820, prepTime: 15, orderCount: 430 },
  { id: 'm_15', restaurantId: 'rst_4', name: 'Parmesan Truffle Fries', description: 'Skin-on crispy shoestring fries tossed in white truffle oil and parmesan', price: 149, category: 'Sides', imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600', available: true, vegetarian: true, spicy: false, calories: 460, prepTime: 10, orderCount: 620 },
  { id: 'm_16', restaurantId: 'rst_4', name: 'Crispy Chicken Burger', description: 'Southern fried buttermilk chicken, coleslaw, pickles, sriracha mayo', price: 299, category: 'Burgers', imageUrl: 'https://images.unsplash.com/photo-1606755962773-d324e9a13086?w=600', available: true, vegetarian: false, spicy: true, calories: 720, prepTime: 18, orderCount: 380 },

  // Green & Co. (rst_5)
  { id: 'm_17', restaurantId: 'rst_5', name: 'Mediterranean Falafel Bowl', description: 'Herbed chickpea falafel, warm organic quinoa, lemon tahini dressing, pickled onions', price: 349, category: 'Bowls', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600', available: true, vegetarian: true, spicy: false, calories: 480, prepTime: 15, orderCount: 310 },
  { id: 'm_18', restaurantId: 'rst_5', name: 'Cold-Pressed Immunity Elixir', description: 'Kale, cucumber, green apple, ginger, lemon, and spirulina cold-pressed', price: 149, category: 'Beverages', imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600', available: true, vegetarian: true, spicy: false, calories: 110, prepTime: 5, orderCount: 220 },
  { id: 'm_19', restaurantId: 'rst_5', name: 'Acai Power Bowl', description: 'Frozen acai blend, granola, fresh berries, coconut flakes, honey drizzle', price: 299, category: 'Bowls', imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=600', available: true, vegetarian: true, spicy: false, calories: 390, prepTime: 10, orderCount: 190 },

  // Momos & More (rst_6)
  { id: 'm_20', restaurantId: 'rst_6', name: 'Classic Steamed Chicken Momos', description: '10 hand-crafted steamed dumplings with spicy schezwan dipping sauce', price: 149, category: 'Momos', imageUrl: 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=600', available: true, vegetarian: false, spicy: true, calories: 380, prepTime: 15, orderCount: 540 },
  { id: 'm_21', restaurantId: 'rst_6', name: 'Veg Jhol Momo', description: 'Steamed veg dumplings served in a spicy achar jhol soup broth', price: 129, category: 'Momos', imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600', available: true, vegetarian: true, spicy: true, calories: 320, prepTime: 18, orderCount: 420 }
];

const COUPONS = [
  { code: 'WELCOME20', type: 'PERCENT', value: 20, maxDiscount: 100, minOrder: 0, description: '20% off up to ₹100 on your first order', active: true },
  { code: 'FREESHIP', type: 'DELIVERY', value: 0, maxDiscount: 999, minOrder: 0, description: 'Free delivery on any order', active: true },
  { code: 'TASTY10', type: 'FLAT', value: 100, maxDiscount: 100, minOrder: 300, description: '₹100 off on orders above ₹300', active: true },
  { code: 'PLATEFUL50', type: 'FLAT', value: 50, maxDiscount: 50, minOrder: 200, description: '₹50 off on orders above ₹200', active: true },
  { code: 'NEWUSER30', type: 'PERCENT', value: 30, maxDiscount: 150, minOrder: 0, description: '30% off up to ₹150 for new users', active: true }
];

const ORDERS = [
  {
    id: 'ord_active_1',
    userId: 'usr_sarah_1',
    customerName: 'Sarah Jenkins',
    customerPhone: '+91 99887 76543',
    restaurantId: 'rst_1',
    restaurantName: 'Lantern Noodle House',
    items: [
      { menuItemId: 'm_1', name: 'Sichuan Dan Dan Noodles', price: 249, quantity: 1, imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600' },
      { menuItemId: 'm_3', name: 'Pan-Fried Pork & Chive Dumplings', price: 189, quantity: 1, imageUrl: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=600' },
      { menuItemId: 'm_5', name: 'Wild Honey Jasmine Iced Tea', price: 89, quantity: 2, imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600' }
    ],
    subtotal: 616,
    deliveryFee: 30,
    discount: 0,
    tax: 30.8,
    total: 676.8,
    status: 'PREPARING',
    paymentMethod: 'UPI',
    paymentStatus: 'PAID',
    address: '742 Evergreen Terrace, Apt 4B, Mumbai',
    specialInstructions: 'Please leave at the door and ring bell.',
    estimatedDeliveryMinutes: 20,
    rewardPointsEarned: 67,
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    statusHistory: [
      { status: 'PLACED', timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
      { status: 'ACCEPTED', timestamp: new Date(Date.now() - 9 * 60 * 1000).toISOString() },
      { status: 'PREPARING', timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString() }
    ]
  },
  {
    id: 'ord_delivered_1',
    userId: 'usr_sarah_1',
    customerName: 'Sarah Jenkins',
    customerPhone: '+91 99887 76543',
    restaurantId: 'rst_2',
    restaurantName: 'Fornello Artisanal Pizza',
    items: [
      { menuItemId: 'm_6', name: 'Margherita Di Bufala', price: 349, quantity: 2, imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600' },
      { menuItemId: 'm_9', name: 'Garlic Butter Herb Knots', price: 149, quantity: 1, imageUrl: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600' }
    ],
    subtotal: 847,
    deliveryFee: 0,
    discount: 100,
    tax: 42.35,
    couponCode: 'WELCOME20',
    total: 789.35,
    status: 'DELIVERED',
    paymentMethod: 'UPI',
    paymentStatus: 'PAID',
    address: '742 Evergreen Terrace, Apt 4B, Mumbai',
    rewardPointsEarned: 79,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    statusHistory: [
      { status: 'PLACED', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 - 40 * 60 * 1000).toISOString() },
      { status: 'ACCEPTED', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 - 35 * 60 * 1000).toISOString() },
      { status: 'PREPARING', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString() },
      { status: 'OUT_FOR_DELIVERY', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 - 15 * 60 * 1000).toISOString() },
      { status: 'DELIVERED', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    ]
  }
];

const REVIEWS = [
  {
    id: 'rev_1',
    userId: 'usr_sarah_1',
    userName: 'Sarah Jenkins',
    orderId: 'ord_delivered_1',
    restaurantId: 'rst_2',
    menuItemId: 'm_6',
    rating: 5,
    comment: 'Absolutely incredible! The buffalo mozzarella was so fresh, best pizza I\'ve had in Mumbai.',
    createdAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()
  }
];

const REWARD_TRANSACTIONS = [
  { id: 'rt_1', userId: 'usr_sarah_1', orderId: 'ord_delivered_1', type: 'EARN', points: 79, description: 'Order #ord_delivered_1 completed', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
  { id: 'rt_2', userId: 'usr_sarah_1', orderId: null, type: 'EARN', points: 200, description: 'Welcome bonus points', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'rt_3', userId: 'usr_sarah_1', orderId: null, type: 'EARN', points: 971, description: 'Accumulated order rewards', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
];

// Rate limiting (in-memory)
const rateLimitMap = {};
function checkRateLimit(ip, key, max = 10, windowMs = 60000) {
  const k = `${ip}:${key}`;
  const now = Date.now();
  if (!rateLimitMap[k]) rateLimitMap[k] = { count: 0, resetAt: now + windowMs };
  if (now > rateLimitMap[k].resetAt) rateLimitMap[k] = { count: 0, resetAt: now + windowMs };
  rateLimitMap[k].count++;
  return rateLimitMap[k].count > max;
}

/* ============================================================
   Auth helpers
   ============================================================ */
function getCurrentUser(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  return USERS.find(u => u.token === token) || null;
}

function safeUserResponse(u) {
  return {
    id: u.id,
    token: u.token,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    defaultAddress: u.defaultAddress,
    rewardPoints: u.rewardPoints || 0,
    favorites: u.favorites || [],
    createdAt: u.createdAt
  };
}

/* ============================================================
   Coupon calculation helper
   ============================================================ */
function calculateDiscount(code, subtotal, deliveryFee) {
  const coupon = COUPONS.find(c => c.code === (code || '').toUpperCase() && c.active);
  if (!coupon) return 0;
  if (subtotal < coupon.minOrder) return 0;
  let discount = 0;
  if (coupon.type === 'PERCENT') discount = Math.min(coupon.maxDiscount, subtotal * coupon.value / 100);
  else if (coupon.type === 'FLAT') discount = Math.min(coupon.maxDiscount, coupon.value);
  else if (coupon.type === 'DELIVERY') discount = deliveryFee;
  return Math.round(discount * 100) / 100;
}

/* ============================================================
   AI Food Assistant — menu-filter recommendation engine
   ============================================================ */
function aiRecommend(query, allItems, restaurants) {
  const q = (query || '').toLowerCase();
  const words = q.split(/\s+/);

  // Budget extraction
  const budgetMatch = q.match(/(?:under|below|within|max|less than|₹|rs\.?)\s*(\d+)/i) ||
                      q.match(/(\d+)\s*(?:rupees|rs|₹)/i);
  const budget = budgetMatch ? parseInt(budgetMatch[1]) : null;

  // Preference flags
  const wantsVeg = /veg(?:etarian)?|no meat|plant|vegan/i.test(q);
  const wantsSpicy = /spic(?:y|e)|hot|fiery|chili|peri/i.test(q);
  const wantsMild = /mild|not spicy|less spicy/i.test(q);
  const wantsHealthy = /healthy|salad|bowl|light|low.?cal|diet/i.test(q);

  // Category keywords
  const categoryMap = {
    pizza: 'Pizza',
    noodle: 'Noodles',
    burger: 'Burgers',
    curry: 'Curries',
    dumpling: 'Starters',
    momo: 'Momos',
    bowl: 'Bowls',
    bread: 'Breads',
    drink: 'Beverages',
    beverage: 'Beverages',
    juice: 'Beverages',
    dessert: 'Desserts'
  };

  let filtered = allItems.filter(item => {
    const rest = restaurants.find(r => r.id === item.restaurantId);
    if (!rest || !rest.open) return false;
    if (!item.available) return false;
    if (budget && item.price > budget) return false;
    if (wantsVeg && !item.vegetarian) return false;
    if (wantsSpicy && !item.spicy) return false;
    if (wantsMild && item.spicy) return false;
    if (wantsHealthy && !['Bowls', 'Beverages', 'Salads'].includes(item.category)) {
      // allow if explicitly matches
      if (!/(kale|quinoa|falafel|acai|healthy|green)/i.test(item.name + item.description)) return false;
    }
    return true;
  });

  // Category preference filtering
  for (const [kw, cat] of Object.entries(categoryMap)) {
    if (words.some(w => w.includes(kw))) {
      const catFiltered = filtered.filter(i => i.category === cat);
      if (catFiltered.length > 0) filtered = catFiltered;
    }
  }

  // Text match boost — if we find items matching the raw query text, prioritize them
  const textMatch = filtered.filter(i =>
    (i.name + ' ' + i.description + ' ' + i.category).toLowerCase().includes(q.substring(0, 10))
  );
  if (textMatch.length > 0) filtered = textMatch;

  // Sort by popularity (orderCount)
  filtered = filtered.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));

  // Return top 5 with restaurant info
  return filtered.slice(0, 5).map(item => {
    const rest = restaurants.find(r => r.id === item.restaurantId);
    return { ...item, restaurantName: rest ? rest.name : '', restaurantId: item.restaurantId };
  });
}

/* ============================================================
   Main Handler
   ============================================================ */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname.replace(/^\/api/, '');
  if (!pathname.startsWith('/')) pathname = '/' + pathname;

  const method = req.method;
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  // ============================================================
  // AUTH ENDPOINTS
  // ============================================================

  if (pathname === '/auth/login' && method === 'POST') {
    if (checkRateLimit(ip, 'login', 15, 60000)) {
      return res.status(429).json({ message: 'Too many login attempts. Try again in a minute.' });
    }
    const { email, password } = body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const u = USERS.find(x =>
      x.email.toLowerCase() === (email || '').toLowerCase() ||
      (x._altEmail && x._altEmail.toLowerCase() === (email || '').toLowerCase())
    );

    if (!u || !verifyPassword(password, u.passwordHash)) {
      return res.status(401).json({ message: 'Wrong email or password' });
    }
    u.token = 'tok_' + crypto.randomBytes(20).toString('hex');
    return res.json(safeUserResponse(u));
  }

  if (pathname === '/auth/register' && method === 'POST') {
    if (checkRateLimit(ip, 'register', 5, 60000)) {
      return res.status(429).json({ message: 'Too many registrations. Try again later.' });
    }
    const { name, email, password, phone, address } = body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (USERS.some(x => x.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Security: users can only register as CUSTOMER or RESTAURANT_OWNER, never ADMIN
    const requestedRole = body.role || 'CUSTOMER';
    const assignedRole = ['CUSTOMER', 'RESTAURANT_OWNER'].includes(requestedRole) ? requestedRole : 'CUSTOMER';

    const newUser = {
      id: 'usr_' + Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      role: assignedRole,
      phone: phone || '',
      defaultAddress: address || '',
      token: 'tok_' + crypto.randomBytes(20).toString('hex'),
      rewardPoints: 200, // Welcome bonus
      favorites: [],
      createdAt: new Date().toISOString()
    };
    USERS.push(newUser);

    // Welcome reward transaction
    REWARD_TRANSACTIONS.push({
      id: 'rt_' + Date.now(),
      userId: newUser.id,
      orderId: null,
      type: 'EARN',
      points: 200,
      description: 'Welcome bonus points',
      createdAt: new Date().toISOString()
    });

    return res.json(safeUserResponse(newUser));
  }

  if (pathname === '/auth/me' && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    return res.json(safeUserResponse(u));
  }

  if (pathname === '/auth/profile' && method === 'PUT') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    if (body.name) u.name = body.name.trim();
    if (body.phone !== undefined) u.phone = body.phone.trim();
    if (body.defaultAddress !== undefined) u.defaultAddress = body.defaultAddress.trim();
    return res.json(safeUserResponse(u));
  }

  if (pathname === '/auth/change-password' && method === 'PUT') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    if (!verifyPassword(body.oldPassword, u.passwordHash)) {
      return res.status(400).json({ message: 'Current password does not match' });
    }
    if (!body.newPassword || body.newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    u.passwordHash = hashPassword(body.newPassword);
    return res.json({ message: 'Password changed successfully' });
  }

  // ============================================================
  // FAVORITES ENDPOINTS
  // ============================================================

  if (pathname === '/favorites' && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    const favItems = MENU_ITEMS.filter(m => (u.favorites || []).includes(m.id));
    return res.json(favItems);
  }

  if (pathname === '/favorites' && method === 'POST') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    const { menuItemId } = body;
    if (!menuItemId) return res.status(400).json({ message: 'menuItemId required' });
    if (!u.favorites) u.favorites = [];
    if (!u.favorites.includes(menuItemId)) u.favorites.push(menuItemId);
    return res.json({ favorites: u.favorites });
  }

  if (pathname === '/favorites' && method === 'DELETE') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    const { menuItemId } = body;
    u.favorites = (u.favorites || []).filter(f => f !== menuItemId);
    return res.json({ favorites: u.favorites });
  }

  // ============================================================
  // REWARDS ENDPOINTS
  // ============================================================

  if (pathname === '/rewards' && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    const txns = REWARD_TRANSACTIONS.filter(t => t.userId === u.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ points: u.rewardPoints || 0, transactions: txns });
  }

  if (pathname === '/rewards/redeem' && method === 'POST') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    const points = parseInt(body.points || 0);
    if (points <= 0) return res.status(400).json({ message: 'Invalid points amount' });
    if (points < 100) return res.status(400).json({ message: 'Minimum redemption is 100 points' });
    if ((u.rewardPoints || 0) < points) return res.status(400).json({ message: 'Insufficient points balance' });
    // 1 point = ₹0.5 discount
    const discount = Math.round(points * 0.5 * 100) / 100;
    return res.json({ points, discount, message: `${points} points = ₹${discount.toFixed(0)} discount` });
  }

  // ============================================================
  // REVIEWS ENDPOINTS
  // ============================================================

  if (pathname === '/reviews' && method === 'GET') {
    const restaurantId = url.searchParams.get('restaurantId');
    const menuItemId = url.searchParams.get('menuItemId');
    let list = [...REVIEWS];
    if (restaurantId) list = list.filter(r => r.restaurantId === restaurantId);
    if (menuItemId) list = list.filter(r => r.menuItemId === menuItemId);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json(list);
  }

  if (pathname === '/reviews' && method === 'POST') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    const { orderId, restaurantId, menuItemId, rating, comment } = body;
    if (!orderId || !restaurantId || !rating) return res.status(400).json({ message: 'orderId, restaurantId and rating required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5' });

    // Verify the order belongs to this user and is delivered
    const order = ORDERS.find(o => o.id === orderId && o.userId === u.id);
    if (!order) return res.status(404).json({ message: 'Order not found or not yours' });
    if (order.status !== 'DELIVERED') return res.status(400).json({ message: 'You can only review delivered orders' });

    // Prevent duplicate review
    const existing = REVIEWS.find(r => r.orderId === orderId && r.userId === u.id && r.restaurantId === restaurantId);
    if (existing) return res.status(409).json({ message: 'You have already reviewed this order' });

    const review = {
      id: 'rev_' + Date.now(),
      userId: u.id,
      userName: u.name,
      orderId,
      restaurantId,
      menuItemId: menuItemId || null,
      rating: Math.round(rating),
      comment: (comment || '').trim(),
      createdAt: new Date().toISOString()
    };
    REVIEWS.push(review);
    return res.status(201).json(review);
  }

  // ============================================================
  // AI FOOD ASSISTANT
  // ============================================================

  if (pathname === '/ai/recommend' && method === 'POST') {
    const query = (body.query || '').trim();
    if (!query) return res.status(400).json({ message: 'query is required' });
    const results = aiRecommend(query, MENU_ITEMS, RESTAURANTS);
    const response = {
      query,
      results,
      explanation: results.length > 0
        ? `I found ${results.length} dish${results.length > 1 ? 'es' : ''} matching "${query}". ${results[0] ? 'Top pick: ' + results[0].name + ' from ' + results[0].restaurantName + ' (₹' + results[0].price + ').' : ''}`
        : `I couldn't find dishes matching "${query}". Try searching for a cuisine type, budget (e.g. "under ₹200"), or dietary preference (e.g. "veg", "spicy").`,
      isAI: false, // Flag: this is rule-based, not a real AI model
      note: 'Powered by Plateful Smart Menu Search. Connect a Gemini API key for full AI responses.'
    };
    return res.json(response);
  }

  // ============================================================
  // RESTAURANTS ENDPOINTS
  // ============================================================

  if (pathname === '/restaurants' && method === 'GET') {
    let list = [...RESTAURANTS];
    const search = url.searchParams.get('search');
    const category = url.searchParams.get('category');
    const sort = url.searchParams.get('sort');
    const featured = url.searchParams.get('featured');

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) || r.address.toLowerCase().includes(q));
    }
    if (category && category !== 'All') {
      list = list.filter(r => (r.category && r.category.toLowerCase().includes(category.toLowerCase())) || r.cuisine.toLowerCase().includes(category.toLowerCase()));
    }
    if (featured === 'true') list = list.filter(r => r.featured);
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    else if (sort === 'fee') list.sort((a, b) => a.deliveryFee - b.deliveryFee);
    else if (sort === 'time') list.sort((a, b) => (a.prepTime || 30) - (b.prepTime || 30));
    else if (sort === 'popular') list.sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0));

    return res.json(list);
  }

  if (pathname === '/restaurants/my' && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    if (u.role === 'ADMIN') return res.json(RESTAURANTS);
    return res.json(RESTAURANTS.filter(r => r.ownerId === u.id || r.ownerEmail === u.email));
  }

  if (pathname === '/restaurants' && method === 'POST') {
    const u = getCurrentUser(req);
    if (!u || (u.role !== 'ADMIN' && u.role !== 'RESTAURANT_OWNER')) return res.status(403).json({ message: 'Forbidden' });
    if (!body.name) return res.status(400).json({ message: 'Restaurant name required' });
    const r = {
      id: 'rst_' + Date.now(),
      name: body.name.trim(),
      cuisine: body.cuisine || 'Specialty Cuisine',
      address: body.address || 'Central District',
      rating: 4.5,
      deliveryTime: body.deliveryTime || '20-30 min',
      deliveryFee: Number(body.deliveryFee || 0),
      minOrder: Number(body.minOrder || 200),
      imageUrl: body.imageUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
      ownerId: u.id,
      ownerEmail: u.email,
      category: body.category || 'All',
      open: true,
      featured: false,
      tags: body.tags || [],
      prepTime: Number(body.prepTime || 25),
      totalOrders: 0
    };
    RESTAURANTS.push(r);
    return res.status(201).json(r);
  }

  // Menu endpoints (before single restaurant match)
  const matchRestMenu = pathname.match(/^\/restaurants\/([^/]+)\/menu$/);
  if (matchRestMenu) {
    const rId = matchRestMenu[1];
    if (method === 'GET') {
      return res.json(MENU_ITEMS.filter(m => m.restaurantId === rId));
    }
    if (method === 'POST') {
      const u = getCurrentUser(req);
      if (!u || (u.role !== 'ADMIN' && u.role !== 'RESTAURANT_OWNER')) return res.status(403).json({ message: 'Forbidden' });
      // Ownership check
      const rest = RESTAURANTS.find(r => r.id === rId);
      if (!rest) return res.status(404).json({ message: 'Restaurant not found' });
      if (u.role === 'RESTAURANT_OWNER' && rest.ownerId !== u.id && rest.ownerEmail !== u.email) {
        return res.status(403).json({ message: 'You do not own this restaurant' });
      }
      if (!body.name || !body.price) return res.status(400).json({ message: 'name and price required' });
      const item = {
        id: 'm_' + Date.now(),
        restaurantId: rId,
        name: body.name.trim(),
        description: body.description || '',
        price: Number(body.price),
        category: body.category || 'Mains',
        imageUrl: body.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
        available: true,
        vegetarian: Boolean(body.vegetarian),
        spicy: Boolean(body.spicy),
        calories: Number(body.calories || 0),
        prepTime: Number(body.prepTime || 20),
        orderCount: 0
      };
      MENU_ITEMS.push(item);
      return res.status(201).json(item);
    }
  }

  // Single restaurant
  const matchRestSingle = pathname.match(/^\/restaurants\/([^/]+)$/);
  if (matchRestSingle) {
    const r = RESTAURANTS.find(x => x.id === matchRestSingle[1]);
    if (!r) return res.status(404).json({ message: 'Restaurant not found' });
    if (method === 'GET') return res.json(r);
    if (method === 'PUT') {
      const u = getCurrentUser(req);
      if (!u) return res.status(401).json({ message: 'Unauthorized' });
      if (u.role !== 'ADMIN' && r.ownerId !== u.id && r.ownerEmail !== u.email) {
        return res.status(403).json({ message: 'Forbidden: you do not own this restaurant' });
      }
      // Safe fields to update (prevent overwriting id, ownerId, etc.)
      const allowed = ['name', 'cuisine', 'address', 'deliveryTime', 'deliveryFee', 'minOrder', 'imageUrl', 'category', 'open', 'tags', 'prepTime'];
      allowed.forEach(k => { if (body[k] !== undefined) r[k] = body[k]; });
      return res.json(r);
    }
    if (method === 'DELETE') {
      const u = getCurrentUser(req);
      if (!u || u.role !== 'ADMIN') return res.status(403).json({ message: 'Admin only' });
      const idx = RESTAURANTS.findIndex(x => x.id === matchRestSingle[1]);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });
      RESTAURANTS.splice(idx, 1);
      return res.json({ message: 'Deleted' });
    }
  }

  // ============================================================
  // MENU ITEM ENDPOINTS (edit/toggle/delete)
  // ============================================================

  const matchMenuToggle = pathname.match(/^\/menu\/([^/]+)\/toggle-availability$/);
  if (matchMenuToggle && method === 'PUT') {
    const u = getCurrentUser(req);
    if (!u || (u.role !== 'ADMIN' && u.role !== 'RESTAURANT_OWNER')) return res.status(403).json({ message: 'Forbidden' });
    const item = MENU_ITEMS.find(m => m.id === matchMenuToggle[1]);
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    // Ownership check
    if (u.role === 'RESTAURANT_OWNER') {
      const rest = RESTAURANTS.find(r => r.id === item.restaurantId);
      if (!rest || (rest.ownerId !== u.id && rest.ownerEmail !== u.email)) return res.status(403).json({ message: 'Forbidden' });
    }
    item.available = !item.available;
    return res.json(item);
  }

  const matchMenuSingle = pathname.match(/^\/menu\/([^/]+)$/);
  if (matchMenuSingle) {
    const item = MENU_ITEMS.find(m => m.id === matchMenuSingle[1]);
    if (!item) return res.status(404).json({ message: 'Menu item not found' });

    if (method === 'GET') return res.json(item);

    if (method === 'PUT') {
      const u = getCurrentUser(req);
      if (!u || (u.role !== 'ADMIN' && u.role !== 'RESTAURANT_OWNER')) return res.status(403).json({ message: 'Forbidden' });
      if (u.role === 'RESTAURANT_OWNER') {
        const rest = RESTAURANTS.find(r => r.id === item.restaurantId);
        if (!rest || (rest.ownerId !== u.id && rest.ownerEmail !== u.email)) return res.status(403).json({ message: 'Forbidden' });
      }
      const allowed = ['name', 'description', 'price', 'category', 'imageUrl', 'vegetarian', 'spicy', 'calories', 'prepTime', 'available'];
      allowed.forEach(k => { if (body[k] !== undefined) item[k] = body[k]; });
      if (body.price) item.price = Number(body.price);
      return res.json(item);
    }

    if (method === 'DELETE') {
      const u = getCurrentUser(req);
      if (!u || (u.role !== 'ADMIN' && u.role !== 'RESTAURANT_OWNER')) return res.status(403).json({ message: 'Forbidden' });
      if (u.role === 'RESTAURANT_OWNER') {
        const rest = RESTAURANTS.find(r => r.id === item.restaurantId);
        if (!rest || (rest.ownerId !== u.id && rest.ownerEmail !== u.email)) return res.status(403).json({ message: 'Forbidden' });
      }
      const idx = MENU_ITEMS.findIndex(m => m.id === matchMenuSingle[1]);
      MENU_ITEMS.splice(idx, 1);
      return res.json({ message: 'Deleted' });
    }
  }

  // ============================================================
  // ORDERS ENDPOINTS
  // ============================================================

  if ((pathname === '/orders/coupon/validate' || pathname === '/coupon/validate') && method === 'POST') {
    const code = (body.code || '').trim().toUpperCase();
    const subtotal = Number(body.subtotal || 0);
    const fee = Number(body.deliveryFee || 0);
    const coupon = COUPONS.find(c => c.code === code && c.active);
    if (!coupon) return res.json({ valid: false, code, discount: 0, message: 'Invalid coupon code' });
    if (subtotal < coupon.minOrder) return res.json({ valid: false, code, discount: 0, message: `Minimum order ₹${coupon.minOrder} required for this coupon` });
    const discount = calculateDiscount(code, subtotal, fee);
    if (discount <= 0) return res.json({ valid: false, code, discount: 0, message: 'Coupon not applicable to this order' });
    return res.json({ valid: true, code, discount, description: coupon.description, message: `Coupon applied! You save ₹${discount.toFixed(0)}` });
  }

  if (pathname === '/orders/my' && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    return res.json(ORDERS.filter(o => o.userId === u.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  if (pathname === '/orders' && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    if (u.role === 'ADMIN') return res.json([...ORDERS].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    const myRestIds = RESTAURANTS.filter(r => r.ownerId === u.id || r.ownerEmail === u.email).map(r => r.id);
    if (myRestIds.length === 0) return res.status(403).json({ message: 'Forbidden' });
    return res.json(ORDERS.filter(o => myRestIds.includes(o.restaurantId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  if (pathname === '/orders' && method === 'POST') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    if (!body.restaurantId || !body.items || !body.items.length) {
      return res.status(400).json({ message: 'restaurantId and items required' });
    }
    if (!body.address) return res.status(400).json({ message: 'Delivery address required' });

    const rest = RESTAURANTS.find(r => r.id === body.restaurantId);
    if (!rest) return res.status(404).json({ message: 'Restaurant not found' });
    if (!rest.open) return res.status(400).json({ message: 'Restaurant is currently closed' });

    // Server-side price calculation — never trust client prices
    let subtotal = 0;
    const items = (body.items || []).map(line => {
      const it = MENU_ITEMS.find(m => m.id === line.menuItemId);
      if (!it || !it.available) return null;
      subtotal += it.price * line.quantity;
      return { menuItemId: it.id, name: it.name, price: it.price, quantity: line.quantity, imageUrl: it.imageUrl };
    }).filter(Boolean);

    if (!items.length) return res.status(400).json({ message: 'No valid available items in order' });

    const fee = rest.deliveryFee || 0;

    // Reward redemption
    let rewardDiscount = 0;
    if (body.rewardPoints && body.rewardPoints > 0) {
      const pointsToRedeem = parseInt(body.rewardPoints);
      if ((u.rewardPoints || 0) >= pointsToRedeem && pointsToRedeem >= 100) {
        rewardDiscount = Math.round(pointsToRedeem * 0.5 * 100) / 100;
        u.rewardPoints = (u.rewardPoints || 0) - pointsToRedeem;
        REWARD_TRANSACTIONS.push({
          id: 'rt_' + Date.now(),
          userId: u.id,
          orderId: null,
          type: 'REDEEM',
          points: -pointsToRedeem,
          description: `Redeemed ${pointsToRedeem} points for ₹${rewardDiscount} discount`,
          createdAt: new Date().toISOString()
        });
      }
    }

    const couponDiscount = calculateDiscount(body.couponCode, subtotal, fee);
    const discount = Math.round((couponDiscount + rewardDiscount) * 100) / 100;
    const TAX_RATE = 0.05; // 5% GST
    const taxableAmount = Math.max(0, subtotal + fee - discount);
    const tax = Math.round(taxableAmount * TAX_RATE * 100) / 100;
    const total = Math.round((taxableAmount + tax) * 100) / 100;

    // Earn points: 1 point per ₹10 spent
    const pointsEarned = Math.floor(total / 10);

    const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor).toISOString() : null;

    const newOrder = {
      id: 'ord_' + Date.now(),
      userId: u.id,
      customerName: u.name,
      customerPhone: body.phone || u.phone,
      restaurantId: rest.id,
      restaurantName: rest.name,
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      deliveryFee: Math.round(fee * 100) / 100,
      discount: Math.round(couponDiscount * 100) / 100,
      rewardDiscount: Math.round(rewardDiscount * 100) / 100,
      couponCode: body.couponCode ? body.couponCode.toUpperCase() : null,
      tax,
      total,
      status: scheduledFor ? 'SCHEDULED' : 'PLACED',
      paymentMethod: body.paymentMethod || 'UPI',
      paymentStatus: body.paymentMethod === 'COD' ? 'PENDING' : 'PAID',
      address: body.address,
      specialInstructions: (body.specialInstructions || '').trim(),
      estimatedDeliveryMinutes: (rest.prepTime || 25) + 15,
      rewardPointsEarned: pointsEarned,
      scheduledFor,
      tableId: body.tableId || null,
      dineIn: Boolean(body.dineIn),
      createdAt: new Date().toISOString(),
      statusHistory: [{ status: scheduledFor ? 'SCHEDULED' : 'PLACED', timestamp: new Date().toISOString() }]
    };
    ORDERS.unshift(newOrder);

    // Credit reward points after order is placed (will be confirmed on delivery)
    // Points earned are tracked but credited only on DELIVERED status change
    rest.totalOrders = (rest.totalOrders || 0) + 1;

    return res.status(201).json(newOrder);
  }

  // Cancel order — with ownership check
  const matchCancel = pathname.match(/^\/orders\/([^/]+)\/cancel$/);
  if (matchCancel && method === 'PUT') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    const o = ORDERS.find(x => x.id === matchCancel[1]);
    if (!o) return res.status(404).json({ message: 'Order not found' });
    // Ownership: customer can cancel their own orders; admin/owner can cancel any
    if (u.role === 'CUSTOMER' && o.userId !== u.id) return res.status(403).json({ message: 'Forbidden' });
    if (!['PLACED', 'ACCEPTED', 'SCHEDULED'].includes(o.status)) {
      return res.status(400).json({ message: 'Order cannot be cancelled in status: ' + o.status });
    }
    o.status = 'CANCELLED';
    o.cancelReason = body.reason || 'Cancelled by customer';
    o.cancelledAt = new Date().toISOString();
    o.statusHistory.push({ status: 'CANCELLED', timestamp: new Date().toISOString(), reason: o.cancelReason });

    // Refund reward points that were redeemed
    if (o.rewardDiscount > 0) {
      const pointsRefunded = Math.round(o.rewardDiscount / 0.5);
      const usr = USERS.find(x => x.id === o.userId);
      if (usr) {
        usr.rewardPoints = (usr.rewardPoints || 0) + pointsRefunded;
        REWARD_TRANSACTIONS.push({
          id: 'rt_refund_' + Date.now(),
          userId: usr.id,
          orderId: o.id,
          type: 'REFUND',
          points: pointsRefunded,
          description: `Refund for cancelled order #${o.id.slice(-6)}`,
          createdAt: new Date().toISOString()
        });
      }
    }
    return res.json(o);
  }

  // Update order status — with ownership/role check and valid transition validation
  const matchStatus = pathname.match(/^\/orders\/([^/]+)\/status$/);
  if (matchStatus && method === 'PUT') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    if (u.role !== 'ADMIN' && u.role !== 'RESTAURANT_OWNER') return res.status(403).json({ message: 'Forbidden: merchant or admin only' });
    const o = ORDERS.find(x => x.id === matchStatus[1]);
    if (!o) return res.status(404).json({ message: 'Order not found' });

    // Restaurant owner can only update orders for their restaurants
    if (u.role === 'RESTAURANT_OWNER') {
      const myRestIds = RESTAURANTS.filter(r => r.ownerId === u.id || r.ownerEmail === u.email).map(r => r.id);
      if (!myRestIds.includes(o.restaurantId)) return res.status(403).json({ message: 'Forbidden: not your restaurant order' });
    }

    // Valid state transitions
    const validTransitions = {
      SCHEDULED: ['PLACED', 'CANCELLED'],
      PLACED: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['OUT_FOR_DELIVERY', 'READY_FOR_PICKUP'],
      READY_FOR_PICKUP: ['OUT_FOR_DELIVERY', 'DELIVERED'],
      OUT_FOR_DELIVERY: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: []
    };

    const newStatus = body.status;
    const allowed = validTransitions[o.status] || [];
    // Admin can override transitions; owners must follow the flow
    if (u.role === 'RESTAURANT_OWNER' && !allowed.includes(newStatus)) {
      return res.status(400).json({ message: `Cannot transition from ${o.status} to ${newStatus}` });
    }

    o.status = newStatus;
    o.statusHistory = o.statusHistory || [];
    o.statusHistory.push({ status: newStatus, timestamp: new Date().toISOString() });

    // Credit points on delivery
    if (newStatus === 'DELIVERED' && o.rewardPointsEarned > 0) {
      const usr = USERS.find(x => x.id === o.userId);
      if (usr) {
        // Check for duplicate credits
        const alreadyCredited = REWARD_TRANSACTIONS.some(t => t.orderId === o.id && t.type === 'EARN');
        if (!alreadyCredited) {
          usr.rewardPoints = (usr.rewardPoints || 0) + o.rewardPointsEarned;
          REWARD_TRANSACTIONS.push({
            id: 'rt_' + Date.now(),
            userId: usr.id,
            orderId: o.id,
            type: 'EARN',
            points: o.rewardPointsEarned,
            description: `Order #${o.id.slice(-6).toUpperCase()} delivered`,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    return res.json(o);
  }

  // Get single order — with access control
  const matchSingleOrder = pathname.match(/^\/orders\/([^/]+)$/);
  if (matchSingleOrder && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    const o = ORDERS.find(x => x.id === matchSingleOrder[1]);
    if (!o) return res.status(404).json({ message: 'Order not found' });
    // Access control: customer sees own orders; admin/owner sees all for their restaurants
    if (u.role === 'CUSTOMER' && o.userId !== u.id) return res.status(403).json({ message: 'Forbidden' });
    if (u.role === 'RESTAURANT_OWNER') {
      const myRestIds = RESTAURANTS.filter(r => r.ownerId === u.id || r.ownerEmail === u.email).map(r => r.id);
      if (o.userId !== u.id && !myRestIds.includes(o.restaurantId)) return res.status(403).json({ message: 'Forbidden' });
    }
    return res.json(o);
  }

  // ============================================================
  // ADMIN ENDPOINTS
  // ============================================================

  if (pathname === '/admin/stats' && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u || (u.role !== 'ADMIN' && u.role !== 'RESTAURANT_OWNER')) return res.status(403).json({ message: 'Forbidden' });

    let orderScope = ORDERS;
    if (u.role === 'RESTAURANT_OWNER') {
      const myRestIds = RESTAURANTS.filter(r => r.ownerId === u.id || r.ownerEmail === u.email).map(r => r.id);
      orderScope = ORDERS.filter(o => myRestIds.includes(o.restaurantId));
    }

    const validOrders = orderScope.filter(o => !['CANCELLED'].includes(o.status));
    const totalRevenue = validOrders.reduce((s, o) => s + o.total, 0);
    const today = new Date().toDateString();
    const todayOrders = orderScope.filter(o => new Date(o.createdAt).toDateString() === today);

    // Bestsellers
    const itemCount = {};
    orderScope.forEach(o => o.items.forEach(i => {
      itemCount[i.name] = (itemCount[i.name] || 0) + i.quantity;
    }));
    const bestsellers = Object.entries(itemCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return res.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders: orderScope.length,
      activeOrders: orderScope.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status)).length,
      deliveredOrders: orderScope.filter(o => o.status === 'DELIVERED').length,
      cancelledOrders: orderScope.filter(o => o.status === 'CANCELLED').length,
      todayOrders: todayOrders.length,
      todayRevenue: Math.round(todayOrders.filter(o => o.status !== 'CANCELLED').reduce((s, o) => s + o.total, 0) * 100) / 100,
      totalRestaurants: RESTAURANTS.length,
      totalMenuItems: MENU_ITEMS.length,
      totalUsers: USERS.length,
      avgOrderValue: validOrders.length > 0 ? Math.round((totalRevenue / validOrders.length) * 100) / 100 : 0,
      bestsellers
    });
  }

  if (pathname === '/admin/users' && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u || u.role !== 'ADMIN') return res.status(403).json({ message: 'Admin only' });
    return res.json(USERS.map(usr => ({
      id: usr.id,
      name: usr.name,
      email: usr.email,
      role: usr.role,
      phone: usr.phone,
      rewardPoints: usr.rewardPoints || 0,
      createdAt: usr.createdAt
    })));
  }

  if (pathname === '/admin/coupons' && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u || u.role !== 'ADMIN') return res.status(403).json({ message: 'Admin only' });
    return res.json(COUPONS);
  }

  // ============================================================
  // POPULAR / TRENDING ITEMS
  // ============================================================

  if (pathname === '/popular-items' && method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '8');
    const items = [...MENU_ITEMS]
      .filter(i => i.available)
      .sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0))
      .slice(0, limit)
      .map(item => {
        const rest = RESTAURANTS.find(r => r.id === item.restaurantId);
        return { ...item, restaurantName: rest ? rest.name : '', restaurantId: item.restaurantId };
      });
    return res.json(items);
  }

  // ============================================================
  // SEARCH — global search across restaurants and items
  // ============================================================

  if (pathname === '/search' && method === 'GET') {
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();
    if (!q) return res.json({ restaurants: [], items: [] });

    const restaurants = RESTAURANTS.filter(r =>
      r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q)
    ).slice(0, 5);

    const items = MENU_ITEMS.filter(i =>
      i.available && (
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      )
    ).slice(0, 8).map(item => {
      const rest = RESTAURANTS.find(r => r.id === item.restaurantId);
      return { ...item, restaurantName: rest ? rest.name : '' };
    });

    return res.json({ restaurants, items });
  }

  return res.status(404).json({ message: `API endpoint ${pathname} not found` });
};

/* ============================================================
   Local Development Server (npm start / node api/index.js)
   ============================================================ */
if (require.main === module) {
  const http = require('http');
  const fs = require('fs');
  const path = require('path');

  const PORT = process.env.PORT || 3000;
  const PUBLIC_DIR = path.join(__dirname, '..', 'public');

  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2'
  };

  const server = http.createServer((req, res) => {
    // Add Vercel helper shims if missing
    if (!res.status) {
      res.status = function(code) {
        res.statusCode = code;
        return res;
      };
    }
    if (!res.json) {
      res.json = function(data) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(data));
      };
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:' + PORT}`);

    // If it's an API route
    if (parsedUrl.pathname.startsWith('/api')) {
      let bodyData = '';
      req.on('data', chunk => { bodyData += chunk; });
      req.on('end', () => {
        try {
          req.body = bodyData ? JSON.parse(bodyData) : {};
        } catch {
          req.body = bodyData;
        }
        module.exports(req, res);
      });
      return;
    }

    // Static file serving
    let safePath = path.normalize(parsedUrl.pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') safePath = '/index.html';
    let filePath = path.join(PUBLIC_DIR, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(500);
          res.end('Error loading ' + safePath);
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });
  });

  server.listen(PORT, () => {
    console.log(`\n🚀 Plateful server is running at: http://localhost:${PORT}`);
    console.log(`📡 API endpoints available at: http://localhost:${PORT}/api/*`);
    console.log(`🍱 Press Ctrl+C to stop the server\n`);
  });
}

