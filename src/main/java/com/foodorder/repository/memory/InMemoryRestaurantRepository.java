package com.foodorder.repository.memory;

import com.foodorder.model.Restaurant;
import com.foodorder.repository.RestaurantRepository;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "plateful.storage.mode", havingValue = "memory", matchIfMissing = true)
public class InMemoryRestaurantRepository extends BaseInMemoryRepository<Restaurant> implements RestaurantRepository {

    public InMemoryRestaurantRepository() {
        super(Restaurant::getId, r -> {
            if (r.getId() == null || r.getId().isBlank()) {
                r.setId(UUID.randomUUID().toString().replace("-", ""));
            }
        });
    }
}
