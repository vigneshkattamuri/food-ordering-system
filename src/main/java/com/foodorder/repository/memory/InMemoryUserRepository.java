package com.foodorder.repository.memory;

import com.foodorder.model.User;
import com.foodorder.repository.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "plateful.storage.mode", havingValue = "memory", matchIfMissing = true)
public class InMemoryUserRepository extends BaseInMemoryRepository<User> implements UserRepository {

    public InMemoryUserRepository() {
        super(User::getId, u -> {
            if (u.getId() == null || u.getId().isBlank()) {
                u.setId(UUID.randomUUID().toString().replace("-", ""));
            }
        });
    }

    @Override
    public Optional<User> findByEmail(String email) {
        if (email == null) return Optional.empty();
        String normalized = email.trim().toLowerCase();
        return map.values().stream()
                .filter(u -> u.getEmail() != null && u.getEmail().trim().equalsIgnoreCase(normalized))
                .findFirst();
    }

    @Override
    public Optional<User> findByToken(String token) {
        if (token == null) return Optional.empty();
        return map.values().stream()
                .filter(u -> token.equals(u.getToken()))
                .findFirst();
    }
}
