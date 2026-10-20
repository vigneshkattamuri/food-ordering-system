package com.foodorder.service;

import com.foodorder.model.User;
import com.foodorder.repository.UserRepository;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
    private final UserRepository users;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthService(UserRepository users) {
        this.users = users;
    }

    public User register(String name, String email, String password, String role, String phone, String address) {
        if (isBlank(name) || isBlank(email) || isBlank(password)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name, email and password are required");
        }
        if (password.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters");
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (users.findByEmail(normalized).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That email is already registered");
        }
        User u = new User();
        u.setName(name.trim());
        u.setEmail(normalized);
        u.setPasswordHash(encoder.encode(password));
        String assignedRole = "CUSTOMER";
        if ("RESTAURANT_OWNER".equalsIgnoreCase(role)) {
            assignedRole = "RESTAURANT_OWNER";
        } else if ("ADMIN".equalsIgnoreCase(role)) {
            assignedRole = "ADMIN";
        }
        u.setRole(assignedRole);
        u.setPhone(phone != null ? phone.trim() : "");
        u.setDefaultAddress(address != null ? address.trim() : "");
        u.setToken(newToken());
        return users.save(u);
    }

    public User login(String email, String password) {
        if (isBlank(email) || isBlank(password)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required");
        }
        User u = users.findByEmail(email.trim().toLowerCase(Locale.ROOT))
                .filter(found -> encoder.matches(password, found.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Wrong email or password"));
        u.setToken(newToken());
        return users.save(u);
    }

    /** Resolves "Authorization: Bearer <token>" to a user, or throws 401. */
    public User currentUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        String token = authHeader.substring(7).trim();
        return users.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired, please log in again"));
    }

    public User requireAdmin(String authHeader) {
        User u = currentUser(authHeader);
        if (!"ADMIN".equals(u.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admins only");
        }
        return u;
    }

    public User requireOwnerOrAdmin(String authHeader, String restaurantOwnerId) {
        User u = currentUser(authHeader);
        if ("ADMIN".equals(u.getRole())) {
            return u;
        }
        if ("RESTAURANT_OWNER".equals(u.getRole())) {
            if (restaurantOwnerId == null || restaurantOwnerId.equals(u.getId()) || restaurantOwnerId.equalsIgnoreCase(u.getEmail())) {
                return u;
            }
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have permission to manage this restaurant");
    }

    public User updateProfile(String authHeader, String name, String phone, String defaultAddress) {
        User u = currentUser(authHeader);
        if (name != null && !name.isBlank()) {
            u.setName(name.trim());
        }
        if (phone != null) {
            u.setPhone(phone.trim());
        }
        if (defaultAddress != null) {
            u.setDefaultAddress(defaultAddress.trim());
        }
        return users.save(u);
    }

    public void changePassword(String authHeader, String oldPassword, String newPassword) {
        User u = currentUser(authHeader);
        if (isBlank(oldPassword) || isBlank(newPassword)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current and new password are required");
        }
        if (!encoder.matches(oldPassword, u.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password does not match");
        }
        if (newPassword.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password must be at least 6 characters");
        }
        u.setPasswordHash(encoder.encode(newPassword));
        users.save(u);
    }

    public String hash(String password) {
        return encoder.encode(password);
    }

    private static String newToken() {
        return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
