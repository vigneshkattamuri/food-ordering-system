/**
 * Plateful Vercel Serverless Function
 * Handles all /api/* requests on Vercel deployment
 */

const crypto = require('crypto');

// Initial in-memory seed state
const USERS = [
  {
    id: 'usr_admin_1',
    name: 'Platform Admin',
    email: 'admin@food.com',
    password: 'admin123',
    role: 'ADMIN',
    phone: '+1 (555) 019-2834',
    defaultAddress: '100 Tech Boulevard, Suite 500',
    token: 'tok_admin_live_demo'
  },
  {
    id: 'usr_owner_1',
    name: 'Chef Marco Liu',
    email: 'owner@lantern.com',
    password: 'owner123',
    role: 'RESTAURANT_OWNER',
    phone: '+1 (555) 832-1982',
    defaultAddress: '12 Market Lane, Kitchen District',
    token: 'tok_owner_live_demo'
  },
  {
    id: 'usr_sarah_1',
    name: 'Sarah Jenkins',
    email: 'sarah@food.com',
    password: 'sarah123',
    role: 'CUSTOMER',
    phone: '+1 (555) 349-2041',
    defaultAddress: '742 Evergreen Terrace, Apt 4B',
    token: 'tok_sarah_live_demo'
  }
];

const RESTAURANTS = [
  {
    id: 'rst_1',
    name: 'Lantern Noodle House',
    cuisine: 'Asian • Handmade Noodles • Dumplings',
    address: '12 Market Lane',
    rating: 4.8,
    deliveryTime: '20-30 min',
    deliveryFee: 1.99,
    minOrder: 10.0,
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
    ownerId: 'usr_owner_1',
    ownerEmail: 'owner@lantern.com',
    category: 'Asian',
    open: true,
    featured: true
  },
  {
    id: 'rst_2',
    name: 'Fornello Artisanal Pizza',
    cuisine: 'Italian • Wood-Fired Neapolitan Pizza',
    address: '48 Station Road',
    rating: 4.9,
    deliveryTime: '25-35 min',
    deliveryFee: 0.0,
    minOrder: 10.0,
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
    ownerId: null,
    ownerEmail: null,
    category: 'Pizza',
    open: true,
    featured: true
  },
  {
    id: 'rst_3',
    name: 'Masala Junction',
    cuisine: 'Indian • Royal Mughal Curries • Tandoor',
    address: '7 Temple Street',
    rating: 4.7,
    deliveryTime: '30-40 min',
    deliveryFee: 2.49,
    minOrder: 10.0,
    imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
    ownerId: null,
    ownerEmail: null,
    category: 'Indian',
    open: true,
    featured: true
  },
  {
    id: 'rst_4',
    name: 'The Smash Burger Co.',
    cuisine: 'American • Wagyu Burgers • Crispy Fries',
    address: '104 Waterfront Way',
    rating: 4.6,
    deliveryTime: '15-25 min',
    deliveryFee: 1.49,
    minOrder: 10.0,
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    ownerId: null,
    ownerEmail: null,
    category: 'Burgers',
    open: true,
    featured: false
  },
  {
    id: 'rst_5',
    name: 'Green & Co. Harvest Bowls',
    cuisine: 'Healthy • Superfood Bowls • Fresh Juices',
    address: '22 Sunny Meadow Drive',
    rating: 4.8,
    deliveryTime: '20-30 min',
    deliveryFee: 0.0,
    minOrder: 10.0,
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800',
    ownerId: null,
    ownerEmail: null,
    category: 'Healthy',
    open: true,
    featured: false
  }
];

const MENU_ITEMS = [
  { id: 'm_1', restaurantId: 'rst_1', name: 'Sichuan Dan Dan Noodles', description: 'Spicy toasted sesame chili oil broth, braised minced pork, bok choy', price: 11.50, category: 'Noodles', imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600', available: true, vegetarian: false, spicy: true, calories: 580 },
  { id: 'm_2', restaurantId: 'rst_1', name: 'Slow-Braised Beef Noodle Soup', description: '12-hour star anise beef bone broth, tender brisket cuts, hand-pulled wheat noodles', price: 13.50, category: 'Noodles', imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600', available: true, vegetarian: false, spicy: false, calories: 640 },
  { id: 'm_3', restaurantId: 'rst_1', name: 'Pan-Fried Pork & Chive Dumplings', description: 'Eight golden-crisp handmade dumplings served with ginger black vinegar dip', price: 8.50, category: 'Small Plates', imageUrl: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=600', available: true, vegetarian: false, spicy: false, calories: 420 },
  { id: 'm_4', restaurantId: 'rst_1', name: 'Smashed Garlic Chili Cucumber', description: 'Crispy Persian cucumbers dressed in toasted sesame, garlic, and vinegar', price: 5.50, category: 'Small Plates', imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600', available: true, vegetarian: true, spicy: true, calories: 180 },
  { id: 'm_5', restaurantId: 'rst_1', name: 'Wild Honey Jasmine Iced Tea', description: 'Freshly brewed organic jasmine blossom tea chilled over crushed ice', price: 3.50, category: 'Beverages', imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600', available: true, vegetarian: true, spicy: false, calories: 90 },

  { id: 'm_6', restaurantId: 'rst_2', name: 'Margherita Di Bufala', description: 'San Marzano D.O.P. tomato sauce, fresh buffalo mozzarella, fresh basil', price: 12.50, category: 'Pizza', imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600', available: true, vegetarian: true, spicy: false, calories: 680 },
  { id: 'm_7', restaurantId: 'rst_2', name: 'Diavola & Hot Honey', description: 'Calabrian spicy soppressata, smoked fior di latte, hot chili infused honey', price: 14.50, category: 'Pizza', imageUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600', available: true, vegetarian: false, spicy: true, calories: 780 },
  { id: 'm_8', restaurantId: 'rst_2', name: 'Truffle Wild Mushroom', description: 'Roasted cremini and shiitake, fontina cheese, white truffle cream sauce', price: 15.00, category: 'Pizza', imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600', available: true, vegetarian: true, spicy: false, calories: 720 },
  { id: 'm_9', restaurantId: 'rst_2', name: 'Garlic Butter Herb Knots', description: 'Six fresh-baked dough knots glazed with confit garlic butter, parmesan', price: 5.50, category: 'Sides', imageUrl: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600', available: true, vegetarian: true, spicy: false, calories: 360 },

  { id: 'm_10', restaurantId: 'rst_3', name: 'Royal Butter Chicken', description: 'Tender tandoor roasted chicken simmered in velvet tomato cream gravy', price: 14.50, category: 'Curries', imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600', available: true, vegetarian: false, spicy: false, calories: 710 },
  { id: 'm_11', restaurantId: 'rst_3', name: 'Paneer Tikka Masala', description: 'Charred cottage cheese cubes in spiced onion-bell pepper gravy', price: 13.50, category: 'Curries', imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600', available: true, vegetarian: true, spicy: true, calories: 650 },
  { id: 'm_12', restaurantId: 'rst_3', name: 'Charred Garlic Butter Naan', description: 'Tandoor-blistered flatbread brushed with crushed garlic and ghee', price: 3.50, category: 'Breads', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600', available: true, vegetarian: true, spicy: false, calories: 240 },

  { id: 'm_13', restaurantId: 'rst_4', name: 'Double Truffle Bacon Smash', description: 'Two 100% Angus smash patties, applewood bacon, black truffle aioli', price: 13.00, category: 'Burgers', imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600', available: true, vegetarian: false, spicy: false, calories: 820 },
  { id: 'm_14', restaurantId: 'rst_4', name: 'Parmesan Truffle Fries', description: 'Skin-on crispy shoestring fries tossed in white truffle oil and parmesan', price: 6.00, category: 'Sides', imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600', available: true, vegetarian: true, spicy: false, calories: 460 },

  { id: 'm_15', restaurantId: 'rst_5', name: 'Mediterranean Falafel Bowl', description: 'Herbed chickpea falafel, warm organic quinoa, lemon tahini dressing', price: 12.50, category: 'Bowls', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600', available: true, vegetarian: true, spicy: false, calories: 480 },
  { id: 'm_16', restaurantId: 'rst_5', name: 'Cold-Pressed Immunity Elixir', description: 'Kale, cucumber, green apple, ginger, lemon, and spirulina', price: 5.50, category: 'Beverages', imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600', available: true, vegetarian: true, spicy: false, calories: 110 }
];

const ORDERS = [
  {
    id: 'ord_active_1',
    userId: 'usr_sarah_1',
    customerName: 'Sarah Jenkins',
    customerPhone: '+1 (555) 349-2041',
    restaurantId: 'rst_1',
    restaurantName: 'Lantern Noodle House',
    items: [
      { menuItemId: 'm_1', name: 'Sichuan Dan Dan Noodles', price: 11.50, quantity: 1, imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600' },
      { menuItemId: 'm_3', name: 'Pan-Fried Pork & Chive Dumplings', price: 8.50, quantity: 1, imageUrl: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=600' },
      { menuItemId: 'm_5', name: 'Wild Honey Jasmine Iced Tea', price: 3.50, quantity: 2, imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600' }
    ],
    subtotal: 27.00,
    deliveryFee: 1.99,
    discount: 0.0,
    total: 28.99,
    status: 'PREPARING',
    paymentMethod: 'CARD',
    paymentStatus: 'PAID',
    address: '742 Evergreen Terrace, Apt 4B',
    specialInstructions: 'Please leave by the front door and ring buzzer.',
    estimatedDeliveryMinutes: 20,
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString()
  },
  {
    id: 'ord_delivered_1',
    userId: 'usr_sarah_1',
    customerName: 'Sarah Jenkins',
    customerPhone: '+1 (555) 349-2041',
    restaurantId: 'rst_2',
    restaurantName: 'Fornello Artisanal Pizza',
    items: [
      { menuItemId: 'm_6', name: 'Margherita Di Bufala', price: 12.50, quantity: 2, imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600' },
      { menuItemId: 'm_9', name: 'Garlic Butter Herb Knots', price: 5.50, quantity: 1, imageUrl: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600' }
    ],
    subtotal: 30.50,
    deliveryFee: 0.0,
    discount: 5.00,
    couponCode: 'WELCOME20',
    total: 25.50,
    status: 'DELIVERED',
    paymentMethod: 'UPI',
    paymentStatus: 'PAID',
    address: '742 Evergreen Terrace, Apt 4B',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }
];

function getCurrentUser(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return USERS.find(u => u.token === token) || null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname.replace(/^\/api/, '');
  if (!pathname.startsWith('/')) pathname = '/' + pathname;

  const method = req.method;
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  // --- Auth Endpoints ---
  if (pathname === '/auth/login' && method === 'POST') {
    const { email, password } = body;
    const u = USERS.find(x => x.email.toLowerCase() === (email || '').toLowerCase() && x.password === password);
    if (!u) return res.status(401).json({ message: 'Wrong email or password' });
    u.token = 'tok_' + crypto.randomBytes(16).toString('hex');
    return res.json({ id: u.id, token: u.token, name: u.name, email: u.email, role: u.role, phone: u.phone, defaultAddress: u.defaultAddress });
  }

  if (pathname === '/auth/register' && method === 'POST') {
    const { name, email, password, role, phone, address } = body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password required' });
    if (USERS.some(x => x.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const newUser = {
      id: 'usr_' + Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role === 'RESTAURANT_OWNER' ? 'RESTAURANT_OWNER' : 'CUSTOMER',
      phone: phone || '',
      defaultAddress: address || '',
      token: 'tok_' + crypto.randomBytes(16).toString('hex')
    };
    USERS.push(newUser);
    return res.json({ id: newUser.id, token: newUser.token, name: newUser.name, email: newUser.email, role: newUser.role, phone: newUser.phone, defaultAddress: newUser.defaultAddress });
  }

  if (pathname === '/auth/me' && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    return res.json({ id: u.id, token: u.token, name: u.name, email: u.email, role: u.role, phone: u.phone, defaultAddress: u.defaultAddress });
  }

  if (pathname === '/auth/profile' && method === 'PUT') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    if (body.name) u.name = body.name.trim();
    if (body.phone !== undefined) u.phone = body.phone.trim();
    if (body.defaultAddress !== undefined) u.defaultAddress = body.defaultAddress.trim();
    return res.json({ id: u.id, token: u.token, name: u.name, email: u.email, role: u.role, phone: u.phone, defaultAddress: u.defaultAddress });
  }

  if (pathname === '/auth/change-password' && method === 'PUT') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    if (u.password !== body.oldPassword) return res.status(400).json({ message: 'Current password does not match' });
    u.password = body.newPassword;
    return res.json({ message: 'Password changed successfully' });
  }

  // --- Restaurants Endpoints ---
  if (pathname === '/restaurants' && method === 'GET') {
    let list = [...RESTAURANTS];
    const search = url.searchParams.get('search');
    const category = url.searchParams.get('category');
    const sort = url.searchParams.get('sort');

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) || r.address.toLowerCase().includes(q));
    }
    if (category && category !== 'All') {
      list = list.filter(r => (r.category && r.category.toLowerCase().includes(category.toLowerCase())) || r.cuisine.toLowerCase().includes(category.toLowerCase()));
    }
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    else if (sort === 'fee') list.sort((a, b) => a.deliveryFee - b.deliveryFee);

    return res.json(list);
  }

  if (pathname === '/restaurants/my' && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    if (u.role === 'ADMIN') return res.json(RESTAURANTS);
    return res.json(RESTAURANTS.filter(r => r.ownerId === u.id || r.ownerEmail === u.email));
  }

  const matchRestMenu = pathname.match(/^\/restaurants\/([^/]+)\/menu$/);
  if (matchRestMenu) {
    const rId = matchRestMenu[1];
    if (method === 'GET') {
      return res.json(MENU_ITEMS.filter(m => m.restaurantId === rId));
    }
    if (method === 'POST') {
      const u = getCurrentUser(req);
      if (!u || (u.role !== 'ADMIN' && u.role !== 'RESTAURANT_OWNER')) return res.status(403).json({ message: 'Forbidden' });
      const item = {
        id: 'm_' + Date.now(),
        restaurantId: rId,
        name: body.name,
        description: body.description || '',
        price: Number(body.price),
        category: body.category || 'Mains',
        imageUrl: body.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
        available: true,
        vegetarian: Boolean(body.vegetarian),
        spicy: Boolean(body.spicy),
        calories: Number(body.calories || 450)
      };
      MENU_ITEMS.push(item);
      return res.status(201).json(item);
    }
  }

  const matchRestSingle = pathname.match(/^\/restaurants\/([^/]+)$/);
  if (matchRestSingle) {
    const r = RESTAURANTS.find(x => x.id === matchRestSingle[1]);
    if (!r) return res.status(404).json({ message: 'Restaurant not found' });
    if (method === 'GET') return res.json(r);
    if (method === 'PUT') {
      Object.assign(r, body);
      return res.json(r);
    }
  }

  if (pathname === '/restaurants' && method === 'POST') {
    const u = getCurrentUser(req);
    if (!u || (u.role !== 'ADMIN' && u.role !== 'RESTAURANT_OWNER')) return res.status(403).json({ message: 'Forbidden' });
    const r = {
      id: 'rst_' + Date.now(),
      name: body.name,
      cuisine: body.cuisine || 'Specialty Cuisine',
      address: body.address || 'Central District',
      rating: 4.8,
      deliveryTime: body.deliveryTime || '20-30 min',
      deliveryFee: Number(body.deliveryFee || 0),
      minOrder: 10.0,
      imageUrl: body.imageUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
      ownerId: u.id,
      ownerEmail: u.email,
      category: body.category || 'All',
      open: true,
      featured: false
    };
    RESTAURANTS.push(r);
    return res.status(201).json(r);
  }

  // --- Orders Endpoints ---
  if (pathname === '/orders/coupon/validate' && method === 'POST') {
    const code = (body.code || '').trim().toUpperCase();
    const subtotal = Number(body.subtotal || 0);
    const fee = Number(body.deliveryFee || 0);
    let discount = 0;
    if (code === 'WELCOME20') discount = Math.min(10, subtotal * 0.20);
    else if (code === 'FREESHIP') discount = fee;
    else if (code === 'TASTY10' && subtotal >= 30) discount = 10;

    if (discount > 0) return res.json({ valid: true, code, discount: Math.round(discount * 100) / 100, message: 'Coupon applied!' });
    return res.json({ valid: false, code, discount: 0, message: 'Invalid or non-applicable coupon' });
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
    return res.json(ORDERS.filter(o => myRestIds.includes(o.restaurantId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  if (pathname === '/orders' && method === 'POST') {
    const u = getCurrentUser(req);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    const rest = RESTAURANTS.find(r => r.id === body.restaurantId);
    if (!rest) return res.status(404).json({ message: 'Restaurant not found' });

    let subtotal = 0;
    const items = (body.items || []).map(line => {
      const it = MENU_ITEMS.find(m => m.id === line.menuItemId);
      if (!it) return null;
      subtotal += it.price * line.quantity;
      return { menuItemId: it.id, name: it.name, price: it.price, quantity: line.quantity, imageUrl: it.imageUrl };
    }).filter(Boolean);

    const fee = rest.deliveryFee || 0;
    let discount = 0;
    const code = (body.couponCode || '').toUpperCase();
    if (code === 'WELCOME20') discount = Math.min(10, subtotal * 0.20);
    else if (code === 'FREESHIP') discount = fee;
    else if (code === 'TASTY10' && subtotal >= 30) discount = 10;

    const total = Math.max(0, subtotal + fee - discount);
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
      discount: Math.round(discount * 100) / 100,
      couponCode: code || null,
      total: Math.round(total * 100) / 100,
      status: 'PLACED',
      paymentMethod: body.paymentMethod || 'CARD',
      paymentStatus: body.paymentMethod === 'COD' ? 'PENDING' : 'PAID',
      address: body.address || u.defaultAddress,
      specialInstructions: body.specialInstructions || '',
      estimatedDeliveryMinutes: 30,
      createdAt: new Date().toISOString()
    };
    ORDERS.unshift(newOrder);
    return res.status(201).json(newOrder);
  }

  const matchCancel = pathname.match(/^\/orders\/([^/]+)\/cancel$/);
  if (matchCancel && method === 'PUT') {
    const o = ORDERS.find(x => x.id === matchCancel[1]);
    if (!o) return res.status(404).json({ message: 'Order not found' });
    o.status = 'CANCELLED';
    o.cancelReason = body.reason || 'Cancelled by customer';
    return res.json(o);
  }

  const matchStatus = pathname.match(/^\/orders\/([^/]+)\/status$/);
  if (matchStatus && method === 'PUT') {
    const o = ORDERS.find(x => x.id === matchStatus[1]);
    if (!o) return res.status(404).json({ message: 'Order not found' });
    o.status = body.status;
    return res.json(o);
  }

  const matchSingleOrder = pathname.match(/^\/orders\/([^/]+)$/);
  if (matchSingleOrder && method === 'GET') {
    const o = ORDERS.find(x => x.id === matchSingleOrder[1]);
    if (!o) return res.status(404).json({ message: 'Order not found' });
    return res.json(o);
  }

  // --- Admin Stats ---
  if (pathname === '/admin/stats' && method === 'GET') {
    const u = getCurrentUser(req);
    if (!u || (u.role !== 'ADMIN' && u.role !== 'RESTAURANT_OWNER')) return res.status(403).json({ message: 'Forbidden' });
    const totalRev = ORDERS.filter(o => o.status !== 'CANCELLED').reduce((s, o) => s + o.total, 0);
    return res.json({
      totalRevenue: Math.round(totalRev * 100) / 100,
      totalOrders: ORDERS.length,
      activeOrders: ORDERS.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status)).length,
      deliveredOrders: ORDERS.filter(o => o.status === 'DELIVERED').length,
      cancelledOrders: ORDERS.filter(o => o.status === 'CANCELLED').length,
      totalRestaurants: RESTAURANTS.length,
      totalMenuItems: MENU_ITEMS.length,
      totalUsers: USERS.length
    });
  }

  return res.status(404).json({ message: `API endpoint ${pathname} not found` });
};
