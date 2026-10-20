package com.foodorder.repository;

import com.foodorder.model.User;
import java.util.Optional;
import org.springframework.data.repository.ListCrudRepository;

public interface UserRepository extends ListCrudRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findByToken(String token);
}
