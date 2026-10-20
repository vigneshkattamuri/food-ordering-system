package com.foodorder.controller;

import com.foodorder.model.MenuItem;
import com.foodorder.model.Order;
import com.foodorder.model.OrderItem;
import com.foodorder.model.Restaurant;
import com.foodorder.model.User;
import com.foodorder.repository.MenuItemRepository;
import com.foodorder.repository.OrderRepository;
import com.foodorder.repository.RestaurantRepository;
import com.foodorder.service.AuthService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    public static class Line {
        public String menuItemId;
        public int quantity;
    }

    public static class OrderRequest {
        public String restaurantId;
        public String address;
        public String phone;
        public String specialInstructions;
        public String couponCode;
        public String paymentMethod = "CARD";
        public List<Line> items;
    }

    private final OrderRepository orders;
    private final RestaurantRepository restaurants;
    private final MenuItemRepository menu;
    private final AuthService auth;

    public OrderController(OrderRepository orders, RestaurantRepository restaurants,
                           MenuItemRepository menu, AuthService auth) {
        this.orders = orders;
        this.restaurants = restaurants;
        this.menu = menu;
        this.auth = auth;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Order place(@RequestHeader(value = "Authorization", required = false) String authHeader,
                       @RequestBody OrderRequest req) {
        User user = auth.currentUser(authHeader);

        if (req == null || req.items == null || req.items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Your cart is empty");
        }
        if (req.address == null || req.address.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Delivery address is required");
        }
        Restaurant restaurant = restaurants.findById(String.valueOf(req.restaurantId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));

        List<OrderItem> lines = new ArrayList<>();
        double subtotal = 0;
        for (Line line : req.items) {
            if (line.quantity < 1 || line.quantity > 50) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be between 1 and 50");
            }
            MenuItem item = menu.findById(String.valueOf(line.menuItemId))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "An item in your cart no longer exists"));
            if (!item.getRestaurantId().equals(restaurant.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All items must come from one restaurant");
            }
            if (!item.isAvailable()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, item.getName() + " is currently unavailable");
            }
            lines.add(new OrderItem(item.getId(), item.getName(), item.getPrice(), line.quantity, item.getImageUrl()));
            subtotal += item.getPrice() * line.quantity;
        }

        double deliveryFee = restaurant.getDeliveryFee();
        double discount = calculateDiscount(req.couponCode, subtotal, deliveryFee);

        double total = Math.max(0, subtotal + deliveryFee - discount);

        Order order = new Order();
        order.setUserId(user.getId());
        order.setCustomerName(user.getName());
        order.setCustomerPhone(req.phone != null && !req.phone.isBlank() ? req.phone.trim() : user.getPhone());
        order.setRestaurantId(restaurant.getId());
        order.setRestaurantName(restaurant.getName());
        order.setItems(lines);
        order.setSubtotal(round(subtotal));
        order.setDeliveryFee(round(deliveryFee));
        order.setDiscount(round(discount));
        order.setCouponCode(req.couponCode != null ? req.couponCode.trim().toUpperCase() : null);
        order.setTotal(round(total));
        order.setAddress(req.address.trim());
        order.setSpecialInstructions(req.specialInstructions != null ? req.specialInstructions.trim() : "");
        order.setPaymentMethod(req.paymentMethod != null ? req.paymentMethod.toUpperCase() : "CARD");
        order.setPaymentStatus("COD".equalsIgnoreCase(req.paymentMethod) ? "PENDING" : "PAID");
        order.setStatus("PLACED");
        order.setEstimatedDeliveryMinutes(30);

        return orders.save(order);
    }

    @PostMapping("/coupon/validate")
    public Map<String, Object> validateCoupon(@RequestBody Map<String, Object> body) {
        String code = (String) body.get("code");
        double subtotal = body.get("subtotal") != null ? Double.parseDouble(body.get("subtotal").toString()) : 0.0;
        double deliveryFee = body.get("deliveryFee") != null ? Double.parseDouble(body.get("deliveryFee").toString()) : 0.0;

        double discount = calculateDiscount(code, subtotal, deliveryFee);
        Map<String, Object> res = new LinkedHashMap<>();
        if (discount > 0) {
            res.put("valid", true);
            res.put("code", code.trim().toUpperCase());
            res.put("discount", round(discount));
            res.put("message", "Coupon applied successfully!");
        } else {
            res.put("valid", false);
            res.put("code", code);
            res.put("discount", 0.0);
            res.put("message", "Invalid or non-applicable coupon code");
        }
        return res;
    }

    @GetMapping("/my")
    public List<Order> mine(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = auth.currentUser(authHeader);
        return orders.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    @GetMapping("/{id}")
    public Order getOne(@RequestHeader(value = "Authorization", required = false) String authHeader,
                        @PathVariable String id) {
        User user = auth.currentUser(authHeader);
        Order order = orders.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        if (!"ADMIN".equals(user.getRole()) && !order.getUserId().equals(user.getId())) {
            Restaurant r = restaurants.findById(order.getRestaurantId()).orElse(null);
            if (r == null || !user.getId().equals(r.getOwnerId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to this order");
            }
        }
        return order;
    }

    @PutMapping("/{id}/cancel")
    public Order cancel(@RequestHeader(value = "Authorization", required = false) String authHeader,
                        @PathVariable String id,
                        @RequestBody(required = false) Map<String, String> body) {
        User user = auth.currentUser(authHeader);
        Order order = orders.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        if (!"ADMIN".equals(user.getRole()) && !order.getUserId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only cancel your own orders");
        }

        if ("DELIVERED".equals(order.getStatus()) || "CANCELLED".equals(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot cancel an order that is already " + order.getStatus());
        }

        order.setStatus("CANCELLED");
        String reason = (body != null && body.containsKey("reason")) ? body.get("reason") : "Cancelled by customer";
        order.setCancelReason(reason);
        return orders.save(order);
    }

    @GetMapping
    public List<Order> all(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = auth.currentUser(authHeader);
        if ("ADMIN".equals(user.getRole())) {
            return orders.findAllByOrderByCreatedAtDesc();
        }
        if ("RESTAURANT_OWNER".equals(user.getRole())) {
            List<Restaurant> myRests = restaurants.findAll().stream()
                    .filter(r -> user.getId().equals(r.getOwnerId()) || (r.getOwnerEmail() != null && r.getOwnerEmail().equalsIgnoreCase(user.getEmail())))
                    .toList();
            Set<String> myRestIds = myRests.stream().map(Restaurant::getId).collect(Collectors.toSet());
            return orders.findAllByOrderByCreatedAtDesc().stream()
                    .filter(o -> myRestIds.contains(o.getRestaurantId()))
                    .toList();
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admins or restaurant owners only");
    }

    @PutMapping("/{id}/status")
    public Order updateStatus(@RequestHeader(value = "Authorization", required = false) String authHeader,
                              @PathVariable String id,
                              @RequestBody Map<String, String> body) {
        User user = auth.currentUser(authHeader);
        String status = body.get("status");
        if (status == null || !Order.STATUSES.contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be one of " + Order.STATUSES);
        }
        Order order = orders.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        if (!"ADMIN".equals(user.getRole())) {
            Restaurant r = restaurants.findById(order.getRestaurantId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
            auth.requireOwnerOrAdmin(authHeader, r.getOwnerId());
        }

        order.setStatus(status);
        if (body.containsKey("cancelReason")) {
            order.setCancelReason(body.get("cancelReason"));
        }
        return orders.save(order);
    }

    private static double calculateDiscount(String code, double subtotal, double deliveryFee) {
        if (code == null || code.isBlank()) return 0.0;
        String c = code.trim().toUpperCase();
        switch (c) {
            case "WELCOME20":
                return Math.min(10.0, subtotal * 0.20);
            case "FREESHIP":
                return deliveryFee;
            case "TASTY10":
                return subtotal >= 30.0 ? 10.0 : 0.0;
            case "FEAST15":
                return subtotal >= 25.0 ? subtotal * 0.15 : 0.0;
            default:
                return 0.0;
        }
    }

    private static double round(double val) {
        return Math.round(val * 100.0) / 100.0;
    }
}
