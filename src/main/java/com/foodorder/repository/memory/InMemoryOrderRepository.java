package com.foodorder.repository.memory;

import com.foodorder.model.Order;
import com.foodorder.repository.OrderRepository;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "plateful.storage.mode", havingValue = "memory", matchIfMissing = true)
public class InMemoryOrderRepository extends BaseInMemoryRepository<Order> implements OrderRepository {

    public InMemoryOrderRepository() {
        super(Order::getId, o -> {
            if (o.getId() == null || o.getId().isBlank()) {
                o.setId(UUID.randomUUID().toString().replace("-", ""));
            }
        });
    }

    @Override
    public List<Order> findByUserIdOrderByCreatedAtDesc(String userId) {
        if (userId == null) return List.of();
        return map.values().stream()
                .filter(o -> userId.equals(o.getUserId()))
                .sorted(Comparator.comparing(Order::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    @Override
    public List<Order> findAllByOrderByCreatedAtDesc() {
        return map.values().stream()
                .sorted(Comparator.comparing(Order::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }
}
