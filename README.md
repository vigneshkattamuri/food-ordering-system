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

### Option 1: Double-Click Shortcut (Windows)
Double-click `run.bat` in the root folder. It automatically detects your installed JDK, uses the Maven wrapper, and launches the server.

### Option 2: Command Line
```powershell
# From the food-ordering-system folder:
.\mvnw.cmd spring-boot:run
```

Once you see `Started FoodOrderApplication`, open:
👉 **http://localhost:8080**

---

## Demo Accounts (1-Click Login Available in UI)

| Role | Email | Password | What You Can Do |
|---|---|---|---|
| **Customer** | `sarah@food.com` | `sarah123` | Browse menus, add dishes to cart, apply promo coupons, checkout, track live delivery stepper, cancel orders, view receipts, and reorder. |
| **Restaurant Owner** | `owner@lantern.com` | `owner123` | Access the Merchant Operations portal, manage kitchen orders, update order status in real time, add dishes, and toggle stock. |
| **Platform Admin** | `admin@food.com` | `admin123` | View total platform GMV and order metrics, manage all partner kitchens, inspect all customer orders, and add new restaurants. |

---

## Key Features

1. **Explore & Discovery**:
   - Live search by restaurant name, cuisine, address, or dish name.
   - Category filtering: *Artisanal Pizza*, *Asian & Noodles*, *Indian Curries*, *Smash Burgers*, *Harvest Bowls*.
   - Sorting by *Highest Rated*, *Fastest Delivery Time*, and *Lowest Delivery Fee*.
   - Dietary tag filters (e.g., *🌱 Veg Only*).

2. **Artisanal Menu & Ordering**:
   - Full restaurant cover banner with rating, delivery estimate, and free delivery thresholds.
   - Dish cards with high-res photography, descriptions, calorie counts, and dietary indicators (*Veg*, *Spicy*).
   - In-card quantity steppers `[- 1 +]` synced with cart.

3. **Slide-over Cart & Checkout**:
   - Quantity adjustment, item removal, and multi-restaurant order safety check.
   - Coupon promo code system (*`WELCOME20`* for 20% off, *`FREESHIP`* for free delivery, *`TASTY10`* for $10 off $30+).
   - Delivery address, contact phone, and special delivery instructions.
   - Payment method toggle: 💳 Card, 📱 UPI, 💵 Cash on Delivery (COD).

4. **Live Order Tracking**:
   - Visual 4-stage stepper: **Order Placed** ➔ **Kitchen Preparing** ➔ **Out for Delivery** ➔ **Delivered**.
   - Interactive simulation button (*⚡ Simulate Next Step*) for live testing and demonstrations.
   - Customer cancellation (for active orders in *PLACED* or *PREPARING* state).
   - Itemized digital receipt invoice modal and 1-click *Reorder* button.

5. **Merchant & Admin Portals**:
   - Analytics metric cards: Total Platform GMV, Order Counts, Active Deliveries, Partner Kitchens.
   - Real-time order status management.
   - Dish creator with dietary tags, pricing, and category.
   - Real-time stock toggle switch (*In Stock* / *Sold Out*).
   - Partner kitchen registration.

---

## REST API Reference

### Authentication & Profile
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register customer or restaurant owner |
| POST | `/api/auth/login` | Public | Login and receive bearer token |
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
| PUT | `/api/orders/{id}/cancel` | Order Owner / Admin | Cancel order if still in *PLACED* or *PREPARING* |
| GET | `/api/orders` | Owner / Admin | View incoming orders for merchant/admin |
| PUT | `/api/orders/{id}/status` | Owner / Admin | Update order status |

### Platform Metrics
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | Owner / Admin | Total revenue, active orders, and partner counts |

---

## Project Structure

```
food-ordering-system/
├── run.bat                               # Windows launcher script
├── mvnw / mvnw.cmd                       # Maven wrapper
├── pom.xml                               # Spring Boot 3 dependencies
└── src/
    └── main/
        ├── java/com/foodorder/
        │   ├── FoodOrderApplication.java # Entrypoint with dual-storage detection
        │   ├── DataSeeder.java           # Demo data seeder
        │   ├── model/                    # User, Restaurant, MenuItem, Order, OrderItem
        │   ├── repository/               # Repository interfaces (ListCrudRepository)
        │   │   └── memory/               # In-Memory fallback storage implementations
        │   ├── service/                  # AuthService (BCrypt, tokens, roles)
        │   └── controller/               # Auth, Restaurant, Order, Stats REST APIs
        └── resources/
            ├── application.properties    # Configuration
            └── static/                   # SPA Frontend
                ├── index.html            # Semantic HTML5 layout & modals
                ├── css/style.css         # Modern design system & responsive styles
                └── js/app.js             # SPA Router, Cart, Live Tracker, & Portals
```
