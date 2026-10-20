package com.foodorder.controller;

import com.foodorder.model.User;
import com.foodorder.service.AuthService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody Map<String, String> body) {
        User u = auth.register(
            body.get("name"),
            body.get("email"),
            body.get("password"),
            body.get("role"),
            body.get("phone"),
            body.get("address")
        );
        return session(u);
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        User u = auth.login(body.get("email"), body.get("password"));
        return session(u);
    }

    @GetMapping("/me")
    public Map<String, Object> me(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User u = auth.currentUser(authHeader);
        return session(u);
    }

    @PutMapping("/profile")
    public Map<String, Object> updateProfile(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body) {
        User u = auth.updateProfile(
            authHeader,
            body.get("name"),
            body.get("phone"),
            body.get("defaultAddress")
        );
        return session(u);
    }

    @PutMapping("/change-password")
    public Map<String, Object> changePassword(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body) {
        auth.changePassword(authHeader, body.get("oldPassword"), body.get("newPassword"));
        return Map.of("message", "Password changed successfully");
    }

    private Map<String, Object> session(User u) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", u.getId());
        out.put("token", u.getToken());
        out.put("name", u.getName());
        out.put("email", u.getEmail());
        out.put("role", u.getRole());
        out.put("phone", u.getPhone() != null ? u.getPhone() : "");
        out.put("defaultAddress", u.getDefaultAddress() != null ? u.getDefaultAddress() : "");
        return out;
    }
}
