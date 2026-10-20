package com.foodorder.repository;

import com.foodorder.model.MenuItem;
import java.util.List;
import org.springframework.data.repository.ListCrudRepository;

public interface MenuItemRepository extends ListCrudRepository<MenuItem, String> {
    List<MenuItem> findByRestaurantId(String restaurantId);
}
