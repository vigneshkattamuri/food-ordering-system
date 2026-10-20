package com.foodorder.controller;

import com.foodorder.model.Order;
import com.foodorder.model.User;
import com.foodorder.repository.MenuItemRepository;
import com.foodorder.repository.OrderRepository;
import com.foodorder.repository.RestaurantRepository;
import com.foodorder.repository.UserRepository;
import com.foodorder.service.AuthService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/stats")
public class StatsController {

    private final OrderRepository orders;
    private final RestaurantRepository restaurants;
    private final MenuItemRepository menu;
    private final UserRepository users;
    private final AuthService auth;

    public StatsController(OrderRepository orders, RestaurantRepository restaurants,
                           MenuItemRepository menu, UserRepository users, AuthService auth) {
        this.orders = orders;
        this.restaurants = restaurants;
        this.menu = menu;
        this.users = users;
        this.auth = auth;
    }

    @GetMapping
    public Map<String, Object> getStats(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = auth.currentUser(authHeader);
        if (!"ADMIN".equals(user.getRole()) && !"RESTAURANT_OWNER".equals(user.getRole())) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.FORBIDDEN, "Admins or restaurant owners only");
        }

        List<Order> orderList = orders.findAll();
        double totalRevenue = 0;
        int activeOrders = 0;
        int deliveredOrders = 0;
        int cancelledOrders = 0;

        for (Order o : orderList) {
            if ("DELIVERED".equals(o.getStatus())) {
                totalRevenue += o.getTotal();
                deliveredOrders++;
            } else if ("CANCELLED".equals(o.getStatus())) {
                cancelledOrders++;
            } else {
                totalRevenue += o.getTotal();
                activeOrders++;
            }
        }

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalRevenue", Math.round(totalRevenue * 100.0) / 100.0);
        stats.put("totalOrders", orderList.size());
        stats.put("activeOrders", activeOrders);
        stats.put("deliveredOrders", deliveredOrders);
        stats.put("cancelledOrders", cancelledOrders);
        stats.put("totalRestaurants", restaurants.count());
        stats.put("totalMenuItems", menu.count());
        stats.put("totalUsers", users.count());

        return stats;
    }
}
