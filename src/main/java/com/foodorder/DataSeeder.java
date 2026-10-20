package com.foodorder;

import com.foodorder.model.MenuItem;
import com.foodorder.model.Order;
import com.foodorder.model.OrderItem;
import com.foodorder.model.Restaurant;
import com.foodorder.model.User;
import com.foodorder.repository.MenuItemRepository;
import com.foodorder.repository.OrderRepository;
import com.foodorder.repository.RestaurantRepository;
import com.foodorder.repository.UserRepository;
import com.foodorder.service.AuthService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {
    private final UserRepository users;
    private final RestaurantRepository restaurants;
    private final MenuItemRepository menu;
    private final OrderRepository orders;
    private final AuthService auth;

    public DataSeeder(UserRepository users, RestaurantRepository restaurants,
                      MenuItemRepository menu, OrderRepository orders, AuthService auth) {
        this.users = users;
        this.restaurants = restaurants;
        this.menu = menu;
        this.orders = orders;
        this.auth = auth;
    }

    @Override
    public void run(String... args) {
        User admin = users.findByEmail("admin@food.com").orElse(null);
        if (admin == null) {
            admin = new User();
            admin.setName("Platform Admin");
            admin.setEmail("admin@food.com");
            admin.setPasswordHash(auth.hash("admin123"));
            admin.setRole("ADMIN");
            admin.setPhone("+1 (555) 019-2834");
            admin.setDefaultAddress("100 Tech Boulevard, Suite 500");
            admin.setToken(UUID.randomUUID().toString().replace("-", ""));
            admin = users.save(admin);
        }

        User owner = users.findByEmail("owner@lantern.com").orElse(null);
        if (owner == null) {
            owner = new User();
            owner.setName("Chef Marco Liu");
            owner.setEmail("owner@lantern.com");
            owner.setPasswordHash(auth.hash("owner123"));
            owner.setRole("RESTAURANT_OWNER");
            owner.setPhone("+1 (555) 832-1982");
            owner.setDefaultAddress("12 Market Lane, Kitchen District");
            owner.setToken(UUID.randomUUID().toString().replace("-", ""));
            owner = users.save(owner);
        }

        User customer = users.findByEmail("sarah@food.com").orElse(null);
        if (customer == null) {
            customer = new User();
            customer.setName("Sarah Jenkins");
            customer.setEmail("sarah@food.com");
            customer.setPasswordHash(auth.hash("sarah123"));
            customer.setRole("CUSTOMER");
            customer.setPhone("+1 (555) 349-2041");
            customer.setDefaultAddress("742 Evergreen Terrace, Apt 4B");
            customer.setToken(UUID.randomUUID().toString().replace("-", ""));
            customer = users.save(customer);
        }

        if (restaurants.count() > 0) {
            return;
        }

        // 1. Lantern Noodle House
        Restaurant noodle = new Restaurant(
            "Lantern Noodle House",
            "Asian • Handmade Noodles • Dumplings",
            "12 Market Lane",
            4.8,
            "20-30 min",
            1.99,
            "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80",
            "Asian"
        );
        noodle.setOwnerId(owner.getId());
        noodle.setOwnerEmail(owner.getEmail());
        noodle.setFeatured(true);
        noodle = restaurants.save(noodle);

        MenuItem danDan = menu.save(new MenuItem(noodle.getId(), "Sichuan Dan Dan Noodles",
                "Spicy toasted sesame chili oil broth, braised minced pork, bok choy, scallions",
                11.50, "Noodles",
                "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80",
                false, true, 580));

        MenuItem beefSoup = menu.save(new MenuItem(noodle.getId(), "Slow-Braised Beef Noodle Soup",
                "12-hour star anise beef bone broth, tender brisket cuts, hand-pulled wheat noodles",
                13.50, "Noodles",
                "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80",
                false, false, 640));

        MenuItem dumplings = menu.save(new MenuItem(noodle.getId(), "Pan-Fried Pork & Chive Dumplings",
                "Eight golden-crisp handmade dumplings served with aged ginger black vinegar dip",
                8.50, "Small Plates",
                "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=600&q=80",
                false, false, 420));

        MenuItem cucumber = menu.save(new MenuItem(noodle.getId(), "Smashed Garlic Chili Cucumber",
                "Crispy Persian cucumbers dressed in toasted sesame, garlic, and Sichuan peppercorn vinegar",
                5.50, "Small Plates",
                "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80",
                true, true, 180));

        MenuItem jasmineTea = menu.save(new MenuItem(noodle.getId(), "Wild Honey Jasmine Iced Tea",
                "Freshly brewed organic jasmine blossom tea chilled over crushed ice with wildflower honey",
                3.50, "Beverages",
                "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80",
                true, false, 90));

        // 2. Fornello Artisanal Pizza
        Restaurant pizza = new Restaurant(
            "Fornello Artisanal Pizza",
            "Italian • Wood-Fired Neapolitan Pizza",
            "48 Station Road",
            4.9,
            "25-35 min",
            0.00, // Free delivery
            "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
            "Pizza"
        );
        pizza.setFeatured(true);
        pizza = restaurants.save(pizza);

        MenuItem margherita = menu.save(new MenuItem(pizza.getId(), "Margherita Di Bufala",
                "San Marzano D.O.P. tomato sauce, fresh buffalo mozzarella, fragrant Genovese basil, EVOO",
                12.50, "Pizza",
                "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80",
                true, false, 680));

        MenuItem diavola = menu.save(new MenuItem(pizza.getId(), "Diavola & Hot Honey",
                "Calabrian spicy soppressata, smoked fior di latte, hot chili infused wildflower honey",
                14.50, "Pizza",
                "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80",
                false, true, 780));

        MenuItem funghi = menu.save(new MenuItem(pizza.getId(), "Truffle Wild Mushroom",
                "Roasted cremini and shiitake, fontina cheese, white truffle cream sauce, fresh thyme",
                15.00, "Pizza",
                "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80",
                true, false, 720));

        MenuItem garlicKnots = menu.save(new MenuItem(pizza.getId(), "Garlic Butter Herb Knots",
                "Six fresh-baked dough knots glazed with confit garlic butter, parmesan, and marinara dip",
                5.50, "Sides",
                "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=600&q=80",
                true, false, 360));

        MenuItem bloodOrange = menu.save(new MenuItem(pizza.getId(), "San Pellegrino Blood Orange",
                "Chilled sparkling Italian citrus soda",
                3.50, "Beverages",
                "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
                true, false, 120));

        // 3. Masala Junction
        Restaurant curry = new Restaurant(
            "Masala Junction",
            "Indian • Royal Mughal Curries • Tandoor",
            "7 Temple Street",
            4.7,
            "30-40 min",
            2.49,
            "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80",
            "Indian"
        );
        curry.setFeatured(true);
        curry = restaurants.save(curry);

        MenuItem butterChicken = menu.save(new MenuItem(curry.getId(), "Royal Butter Chicken",
                "Tender tandoor roasted chicken simmered in a velvet tomato, fenugreek, and cream gravy with cumin basmati rice",
                14.50, "Curries",
                "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80",
                false, false, 710));

        MenuItem paneerTikka = menu.save(new MenuItem(curry.getId(), "Paneer Tikka Masala",
                "Charred cottage cheese cubes in rich spiced onion-bell pepper gravy with steamed basmati rice",
                13.50, "Curries",
                "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80",
                true, true, 650));

        MenuItem naan = menu.save(new MenuItem(curry.getId(), "Charred Garlic Butter Naan",
                "Tandoor-blistered flatbread brushed with crushed garlic and ghee",
                3.50, "Breads",
                "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
                true, false, 240));

        MenuItem samosaChaat = menu.save(new MenuItem(curry.getId(), "Crisp Samosa Chaat",
                "Crushed potato-pea pastry layered with warm spiced chickpea curry, sweetened yogurt, and tamarind mint chutneys",
                7.00, "Starters",
                "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
                true, true, 410));

        MenuItem mangoLassi = menu.save(new MenuItem(curry.getId(), "Alphonso Mango Lassi",
                "Chilled churned yogurt blended with Alphonso mango pulp and cardamom",
                4.50, "Beverages",
                "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80",
                true, false, 220));

        // 4. The Smash Burger Co.
        Restaurant burger = new Restaurant(
            "The Smash Burger Co.",
            "American • Wagyu Burgers • Crispy Fries",
            "104 Waterfront Way",
            4.6,
            "15-25 min",
            1.49,
            "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
            "Burgers"
        );
        burger = restaurants.save(burger);

        MenuItem truffleSmash = menu.save(new MenuItem(burger.getId(), "Double Truffle Bacon Smash",
                "Two 100% Angus smash patties, applewood bacon, black truffle aioli, melted sharp cheddar on brioche",
                13.00, "Burgers",
                "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80",
                false, false, 820));

        MenuItem hotChicken = menu.save(new MenuItem(burger.getId(), "Nashville Hot Crunch Chicken",
                "Double-dredged spicy buttermilk chicken breast, bread-and-butter pickles, creamy coleslaw on potato bun",
                11.50, "Burgers",
                "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=600&q=80",
                false, true, 740));

        MenuItem truffleFries = menu.save(new MenuItem(burger.getId(), "Parmesan Truffle Fries",
                "Skin-on crispy shoestring fries tossed in white truffle oil, shaved aged parmesan, and parsley",
                6.00, "Sides",
                "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80",
                true, false, 460));

        MenuItem maltShake = menu.save(new MenuItem(burger.getId(), "Salted Caramel Pretzel Shake",
                "Hand-spun vanilla bean ice cream, dulce de leche, crushed sea salt pretzels",
                5.50, "Beverages",
                "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80",
                true, false, 510));

        // 5. Green & Co. Harvest Bowls
        Restaurant bowls = new Restaurant(
            "Green & Co. Harvest Bowls",
            "Healthy • Superfood Bowls • Fresh Juices",
            "22 Sunny Meadow Drive",
            4.8,
            "20-30 min",
            0.00, // Free delivery
            "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
            "Healthy"
        );
        bowls = restaurants.save(bowls);

        MenuItem falafelBowl = menu.save(new MenuItem(bowls.getId(), "Mediterranean Falafel Bowl",
                "Herbed chickpea falafel, warm organic quinoa, lemon tahini dressing, kalamata olives, marinated tomatoes",
                12.50, "Bowls",
                "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80",
                true, false, 480));

        MenuItem salmonSalad = menu.save(new MenuItem(bowls.getId(), "Citrus Grilled Salmon Harvest",
                "Wild Alaskan salmon fillet, baby spinach, roasted sweet potatoes, toasted pumpkin seeds, citrus vinaigrette",
                15.50, "Bowls",
                "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
                false, false, 530));

        MenuItem greenJuice = menu.save(new MenuItem(bowls.getId(), "Cold-Pressed Immunity Elixir",
                "Kale, cucumber, green apple, ginger, lemon, and spirulina cold pressed daily",
                5.50, "Beverages",
                "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80",
                true, false, 110));

        // Seed 2 realistic demo orders for customer Sarah
        // Order 1: Active order in PREPARING status
        Order activeOrder = new Order();
        activeOrder.setUserId(customer.getId());
        activeOrder.setCustomerName(customer.getName());
        activeOrder.setCustomerPhone(customer.getPhone());
        activeOrder.setRestaurantId(noodle.getId());
        activeOrder.setRestaurantName(noodle.getName());
        activeOrder.setItems(List.of(
            new OrderItem(danDan.getId(), danDan.getName(), danDan.getPrice(), 1, danDan.getImageUrl()),
            new OrderItem(dumplings.getId(), dumplings.getName(), dumplings.getPrice(), 1, dumplings.getImageUrl()),
            new OrderItem(jasmineTea.getId(), jasmineTea.getName(), jasmineTea.getPrice(), 2, jasmineTea.getImageUrl())
        ));
        double activeSub = 11.50 + 8.50 + (3.50 * 2);
        activeOrder.setSubtotal(activeSub);
        activeOrder.setDeliveryFee(noodle.getDeliveryFee());
        activeOrder.setDiscount(0.0);
        activeOrder.setTotal(activeSub + noodle.getDeliveryFee());
        activeOrder.setStatus("PREPARING");
        activeOrder.setPaymentMethod("CARD");
        activeOrder.setPaymentStatus("PAID");
        activeOrder.setAddress(customer.getDefaultAddress());
        activeOrder.setSpecialInstructions("Please leave by the front door and ring buzzer.");
        activeOrder.setEstimatedDeliveryMinutes(20);
        activeOrder.setCreatedAt(Instant.now().minus(8, ChronoUnit.MINUTES));
        orders.save(activeOrder);

        // Order 2: Delivered order from yesterday
        Order pastOrder = new Order();
        pastOrder.setUserId(customer.getId());
        pastOrder.setCustomerName(customer.getName());
        pastOrder.setCustomerPhone(customer.getPhone());
        pastOrder.setRestaurantId(pizza.getId());
        pastOrder.setRestaurantName(pizza.getName());
        pastOrder.setItems(List.of(
            new OrderItem(margherita.getId(), margherita.getName(), margherita.getPrice(), 2, margherita.getImageUrl()),
            new OrderItem(garlicKnots.getId(), garlicKnots.getName(), garlicKnots.getPrice(), 1, garlicKnots.getImageUrl())
        ));
        double pastSub = (12.50 * 2) + 5.50;
        pastOrder.setSubtotal(pastSub);
        pastOrder.setDeliveryFee(pizza.getDeliveryFee());
        pastOrder.setDiscount(5.00); // WELCOME coupon used
        pastOrder.setCouponCode("WELCOME20");
        pastOrder.setTotal(pastSub - 5.00);
        pastOrder.setStatus("DELIVERED");
        pastOrder.setPaymentMethod("UPI");
        pastOrder.setPaymentStatus("PAID");
        pastOrder.setAddress(customer.getDefaultAddress());
        pastOrder.setCreatedAt(Instant.now().minus(1, ChronoUnit.DAYS));
        orders.save(pastOrder);
    }
}
