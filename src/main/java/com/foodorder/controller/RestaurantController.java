package com.foodorder.controller;

import com.foodorder.model.MenuItem;
import com.foodorder.model.Restaurant;
import com.foodorder.model.User;
import com.foodorder.repository.MenuItemRepository;
import com.foodorder.repository.RestaurantRepository;
import com.foodorder.service.AuthService;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class RestaurantController {
    private final RestaurantRepository restaurants;
    private final MenuItemRepository menu;
    private final AuthService auth;

    public RestaurantController(RestaurantRepository restaurants, MenuItemRepository menu, AuthService auth) {
        this.restaurants = restaurants;
        this.menu = menu;
        this.auth = auth;
    }

    @GetMapping("/restaurants")
    public List<Restaurant> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String sort) {
        List<Restaurant> list = restaurants.findAll();

        if (search != null && !search.isBlank()) {
            String q = search.trim().toLowerCase();
            list = list.stream()
                    .filter(r -> (r.getName() != null && r.getName().toLowerCase().contains(q))
                            || (r.getCuisine() != null && r.getCuisine().toLowerCase().contains(q))
                            || (r.getAddress() != null && r.getAddress().toLowerCase().contains(q)))
                    .toList();
        }

        if (category != null && !category.isBlank() && !"All".equalsIgnoreCase(category)) {
            String cat = category.trim().toLowerCase();
            list = list.stream()
                    .filter(r -> (r.getCategory() != null && r.getCategory().toLowerCase().contains(cat))
                            || (r.getCuisine() != null && r.getCuisine().toLowerCase().contains(cat)))
                    .toList();
        }

        if ("rating".equalsIgnoreCase(sort)) {
            list = list.stream().sorted(Comparator.comparingDouble(Restaurant::getRating).reversed()).toList();
        } else if ("deliveryTime".equalsIgnoreCase(sort)) {
            list = list.stream().sorted(Comparator.comparing(Restaurant::getDeliveryTime)).toList();
        } else if ("fee".equalsIgnoreCase(sort)) {
            list = list.stream().sorted(Comparator.comparingDouble(Restaurant::getDeliveryFee)).toList();
        }

        return list;
    }

    @GetMapping("/restaurants/{id}")
    public Restaurant get(@PathVariable String id) {
        return restaurants.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
    }

    @GetMapping("/restaurants/{id}/menu")
    public List<MenuItem> menu(@PathVariable String id) {
        return menu.findByRestaurantId(id);
    }

    @GetMapping("/restaurants/my")
    public List<Restaurant> myRestaurants(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User u = auth.currentUser(authHeader);
        if ("ADMIN".equals(u.getRole())) {
            return restaurants.findAll();
        }
        if ("RESTAURANT_OWNER".equals(u.getRole())) {
            return restaurants.findAll().stream()
                    .filter(r -> u.getId().equals(r.getOwnerId()) || (r.getOwnerEmail() != null && r.getOwnerEmail().equalsIgnoreCase(u.getEmail())))
                    .toList();
        }
        return List.of();
    }

    // ----- admin / owner -----

    @PostMapping("/restaurants")
    @ResponseStatus(HttpStatus.CREATED)
    public Restaurant create(@RequestHeader(value = "Authorization", required = false) String authHeader,
                             @RequestBody Restaurant r) {
        User u = auth.currentUser(authHeader);
        if (!"ADMIN".equals(u.getRole()) && !"RESTAURANT_OWNER".equals(u.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admins or restaurant owners only");
        }
        if (r.getName() == null || r.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Restaurant name is required");
        }
        r.setId(null);
        if ("RESTAURANT_OWNER".equals(u.getRole())) {
            r.setOwnerId(u.getId());
            r.setOwnerEmail(u.getEmail());
        }
        return restaurants.save(r);
    }

    @PutMapping("/restaurants/{id}")
    public Restaurant update(@RequestHeader(value = "Authorization", required = false) String authHeader,
                             @PathVariable String id,
                             @RequestBody Restaurant r) {
        Restaurant existing = restaurants.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
        auth.requireOwnerOrAdmin(authHeader, existing.getOwnerId());

        if (r.getName() != null && !r.getName().isBlank()) existing.setName(r.getName().trim());
        if (r.getCuisine() != null) existing.setCuisine(r.getCuisine().trim());
        if (r.getAddress() != null) existing.setAddress(r.getAddress().trim());
        if (r.getRating() > 0) existing.setRating(r.getRating());
        if (r.getDeliveryTime() != null) existing.setDeliveryTime(r.getDeliveryTime().trim());
        if (r.getDeliveryFee() >= 0) existing.setDeliveryFee(r.getDeliveryFee());
        if (r.getMinOrder() >= 0) existing.setMinOrder(r.getMinOrder());
        if (r.getImageUrl() != null && !r.getImageUrl().isBlank()) existing.setImageUrl(r.getImageUrl().trim());
        if (r.getCategory() != null) existing.setCategory(r.getCategory().trim());
        existing.setOpen(r.isOpen());
        existing.setFeatured(r.isFeatured());

        return restaurants.save(existing);
    }

    @DeleteMapping("/restaurants/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRestaurant(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                 @PathVariable String id) {
        auth.requireAdmin(authHeader);
        restaurants.deleteById(id);
    }

    @PostMapping("/restaurants/{id}/menu")
    @ResponseStatus(HttpStatus.CREATED)
    public MenuItem addItem(@RequestHeader(value = "Authorization", required = false) String authHeader,
                            @PathVariable String id,
                            @RequestBody MenuItem item) {
        Restaurant r = restaurants.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
        auth.requireOwnerOrAdmin(authHeader, r.getOwnerId());

        if (item.getName() == null || item.getName().isBlank() || item.getPrice() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item needs a name and a price above 0");
        }
        item.setId(null);
        item.setRestaurantId(id);
        if (item.getCategory() == null || item.getCategory().isBlank()) {
            item.setCategory("Mains");
        }
        return menu.save(item);
    }

    @PutMapping("/menu/{itemId}")
    public MenuItem updateItem(@RequestHeader(value = "Authorization", required = false) String authHeader,
                               @PathVariable String itemId,
                               @RequestBody MenuItem item) {
        MenuItem existing = menu.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"));
        Restaurant r = restaurants.findById(existing.getRestaurantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
        auth.requireOwnerOrAdmin(authHeader, r.getOwnerId());

        if (item.getName() != null && !item.getName().isBlank()) existing.setName(item.getName().trim());
        if (item.getDescription() != null) existing.setDescription(item.getDescription().trim());
        if (item.getPrice() > 0) existing.setPrice(item.getPrice());
        if (item.getCategory() != null && !item.getCategory().isBlank()) existing.setCategory(item.getCategory().trim());
        if (item.getImageUrl() != null) existing.setImageUrl(item.getImageUrl().trim());
        existing.setAvailable(item.isAvailable());
        existing.setVegetarian(item.isVegetarian());
        existing.setSpicy(item.isSpicy());
        if (item.getCalories() > 0) existing.setCalories(item.getCalories());

        return menu.save(existing);
    }

    @PutMapping("/menu/{itemId}/toggle-availability")
    public MenuItem toggleAvailability(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                       @PathVariable String itemId) {
        MenuItem existing = menu.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"));
        Restaurant r = restaurants.findById(existing.getRestaurantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
        auth.requireOwnerOrAdmin(authHeader, r.getOwnerId());

        existing.setAvailable(!existing.isAvailable());
        return menu.save(existing);
    }

    @DeleteMapping("/menu/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(@RequestHeader(value = "Authorization", required = false) String authHeader,
                           @PathVariable String itemId) {
        MenuItem existing = menu.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"));
        Restaurant r = restaurants.findById(existing.getRestaurantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
        auth.requireOwnerOrAdmin(authHeader, r.getOwnerId());

        menu.deleteById(itemId);
    }
}
