# Plateful: Full-Stack Online Food Ordering System

Plateful is a full-featured, artisanal food delivery web application built with Spring Boot 3, Java 21/17, and a modern single-page frontend.

- **Frontend**: Modern Vanilla HTML5, CSS3 with responsive design tokens, and JavaScript SPA (served from `src/main/resources/static`)
- **Backend**: Java 17+, Spring Boot 3.2.5 REST API
- **Dual-Storage Engine**:
  - **Auto-Detection Mode**: If MongoDB is running on `localhost:27017` (or configured URI), Plateful connects to MongoDB via Spring Data.
  - **In-Memory Fallback Mode**: If MongoDB is not running, Plateful starts instantly in zero-configuration high-performance In-Memory mode without crashing!
- **Authentication**: Role-based access control (`CUSTOMER`, `RESTAURANT_OWNER`, `ADMIN`) with BCrypt hashed passwords and Bearer tokens.

---

## Quick Start

### Option 1: Node.js Instant Local Server (Recommended for Frontend & Fast Dev)
```bash
npm start
```
Runs the unified full-stack server at 👉 **http://localhost:3000** (serves SPA frontend and all `/api/*` routes with zero external dependencies).

### Option 2: Java Spring Boot 3 Backend
```powershell
# Double click run.bat or run via command line:
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"   # If JAVA_HOME is not set
.\mvnw.cmd spring-boot:run
```
Runs the Spring Boot server at 👉 **http://localhost:8080**.

### Option 3: Vercel Cloud Deployment
Deploy to Vercel with zero configuration:
```bash
vercel --prod
```
Served automatically via `vercel.json` rewrites and `api/index.js` serverless function.

---

## Demo Accounts (1-Click Login Available in UI)

| Role | Email | Password | What You Can Do |
|---|---|---|---|
| **Customer** | `sarah@food.com` / `sarah@plateful.com` | `sarah123` | Browse menus, add dishes to cart, use AI Food Assistant, apply promo coupons, redeem Plateful Rewards points, checkout with UPI/Card/COD, live order tracking stepper, review past orders, save favorites. |
| **Restaurant Owner** | `owner@lantern.com` | `owner123` | Access Merchant Operations, accept & manage kitchen orders (`PLACED` ➔ `ACCEPTED` ➔ `PREPARING` ➔ `OUT_FOR_DELIVERY`), toggle dish availability in real-time, edit menu prices & descriptions, view restaurant analytics. |
| **Platform Admin** | `admin@food.com` / `admin@plateful.com` | `admin123` | Platform oversight, view total GMV, manage partner kitchens, review all orders, inspect registered platform users and coupon codes. |

---

## Key Features

1. **Explore & Artisanal Discovery**:
   - Live search across restaurants, cuisines, and dish names.
   - Category filtering: *Artisanal Pizza*, *Asian & Noodles*, *Indian Curries*, *Smash Burgers*, *Harvest Bowls*, *Momos*.
   - Sorting by *Highest Rated*, *Fastest Delivery Time*, and *Lowest Delivery Fee*.
   - Dietary tag filters (*🌱 Vegetarian Only*, *🌶️ Spicy*).
   - Dynamic **Dark Mode** toggle with full color token switching.

2. **AI Food Assistant**:
   - Natural language menu discovery powered by smart semantic filters (e.g. *"spicy noodles under ₹300"*, *"healthy vegan bowls"*, *"dinner for 2 under ₹500"*).
   - Generates instant dish recommendations with explanations and 1-click cart addition.

3. **Plateful Rewards & Loyalty Points**:
   - Earn points on every order (10 points per ₹100 spent).
   - Redeem points directly at checkout (1 point = ₹0.50 discount).
   - View points balance, cash value equivalent, and full transaction history.

4. **Slide-over Cart & Checkout**:
   - In-card and cart quantity steppers synced in real time.
   - Promo coupon validation (`WELCOME20`, `FREESHIP`, `TASTY10`, `PLATEFUL50`, `NEWUSER30`).
   - Payment method toggle: 💳 Card, 📱 UPI, 💵 Cash on Delivery (COD).

5. **Live Order Tracking Stepper**:
   - 4-stage visual stepper: **Order Placed** ➔ **Accepted** ➔ **Kitchen Preparing** ➔ **Out for Delivery** ➔ **Delivered**.
   - Interactive simulation button (*⚡ Simulate Next Step*) for live testing and demonstrations.
   - Verified customer cancellation (with automatic reward points refund).
   - Digital itemized receipt modal and 1-click *Reorder* button.
   - Order star-rating and text review submission.

6. **Merchant & Admin Portals**:
   - Real-time kitchen order processing with state-machine transition validation.
   - Dish creator with dietary tags, pricing, and category.
   - Real-time stock toggle switch (*In Stock* / *Sold Out*).
   - User directory and platform performance analytics.

---

## REST API Reference

### Authentication & Profile
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register customer or restaurant owner |
| POST | `/api/auth/login` | Public | Login with rate limiting and secure password hash |
| GET | `/api/auth/me` | Logged In | Get profile of current user |
| PUT | `/api/auth/profile` | Logged In | Update name, phone, default address |
| PUT | `/api/auth/change-password` | Logged In | Change user password |

### Restaurants & Menus
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/restaurants` | Public | List restaurants (supports `search`, `category`, `sort`) |
| GET | `/api/restaurants/{id}` | Public | Get single restaurant details |
| GET | `/api/restaurants/{id}/menu` | Public | Get dishes for a restaurant |
| GET | `/api/restaurants/my` | Owner / Admin | Get restaurants owned by current merchant |
| POST | `/api/restaurants` | Owner / Admin | Create a new partner kitchen |
| PUT | `/api/restaurants/{id}` | Owner / Admin | Update restaurant details |
| DELETE | `/api/restaurants/{id}` | Admin | Delete a restaurant |
| POST | `/api/restaurants/{id}/menu` | Owner / Admin | Add menu item to restaurant |
| PUT | `/api/menu/{itemId}` | Owner / Admin | Update dish details |
| PUT | `/api/menu/{itemId}/toggle-availability` | Owner / Admin | Toggle in-stock vs. sold-out |
| DELETE | `/api/menu/{itemId}` | Owner / Admin | Delete menu item |

### Orders & Checkout
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/orders` | Logged In | Place new order (prices verified on server) |
| POST | `/api/orders/coupon/validate` | Public | Validate promo coupon code and calculate discount |
| GET | `/api/orders/my` | Logged In | Get current user's order history |
| GET | `/api/orders/{id}` | Order Owner / Admin | Get single order details |
| PUT | `/api/orders/{id}/cancel` | Order Owner / Admin | Cancel order if still in *PLACED*, *ACCEPTED*, or *SCHEDULED* |
| GET | `/api/orders` | Owner / Admin | View incoming orders for merchant/admin |
| PUT | `/api/orders/{id}/status` | Owner / Admin | Update order status with valid transition check |

### AI, Rewards & Reviews
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/ai/recommend` | Public | AI Food Assistant natural language recommendation |
| GET | `/api/rewards` | Logged In | Get user reward balance and transaction history |
| POST | `/api/rewards/redeem` | Logged In | Redeem points for order discount |
| POST | `/api/reviews` | Logged In | Submit order rating and review |
| GET | `/api/reviews` | Public | Get reviews for a restaurant |
| GET | `/api/favorites` | Logged In | Get user favorite dishes |
| POST | `/api/favorites/toggle` | Logged In | Add or remove dish from favorites |
| GET | `/api/admin/users` | Admin | List all registered platform users |
| GET | `/api/admin/stats` | Owner / Admin | Total revenue, active orders, and partner counts |

---

## Project Structure

```
food-ordering-system/
├── api/
│   └── index.js                      # Vercel serverless function & standalone local server
├── public/                           # Production web app assets
│   ├── index.html                    # Semantic HTML5 layout, modals & dialogs
│   ├── css/style.css                 # Design system, dark mode tokens & responsive styles
│   └── js/app.js                     # SPA router, cart, live tracker, AI assistant & portals
├── run.bat                           # Windows Spring Boot launcher script
├── mvnw / mvnw.cmd                   # Maven wrapper
├── pom.xml                           # Spring Boot 3 dependencies
└── src/
    └── main/
        ├── java/com/foodorder/
        │   ├── FoodOrderApplication.java # Spring Boot entrypoint with dual-storage detection
        │   ├── DataSeeder.java           # Demo data seeder
        │   ├── model/                    # User, Restaurant, MenuItem, Order, OrderItem
        │   ├── repository/               # Repositories & in-memory fallbacks
        │   ├── service/                  # AuthService (BCrypt, tokens, roles)
        │   └── controller/               # Auth, Restaurant, Order, Stats REST APIs
        └── resources/
            ├── application.properties    # Configuration
            └── static/                   # Static resources synced with public/
                ├── index.html
                ├── css/style.css
                └── js/app.js
```
