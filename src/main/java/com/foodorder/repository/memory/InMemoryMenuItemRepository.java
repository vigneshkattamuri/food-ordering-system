package com.foodorder.repository.memory;

import com.foodorder.model.MenuItem;
import com.foodorder.repository.MenuItemRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "plateful.storage.mode", havingValue = "memory", matchIfMissing = true)
public class InMemoryMenuItemRepository extends BaseInMemoryRepository<MenuItem> implements MenuItemRepository {

    public InMemoryMenuItemRepository() {
        super(MenuItem::getId, m -> {
            if (m.getId() == null || m.getId().isBlank()) {
                m.setId(UUID.randomUUID().toString().replace("-", ""));
            }
        });
    }

    @Override
    public List<MenuItem> findByRestaurantId(String restaurantId) {
        if (restaurantId == null) return List.of();
        return map.values().stream()
                .filter(m -> restaurantId.equals(m.getRestaurantId()))
                .toList();
    }
}
