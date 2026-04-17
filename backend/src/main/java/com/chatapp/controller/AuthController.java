package com.chatapp.controller;

import com.chatapp.model.User;
import com.chatapp.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired private UserRepository  userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    // ── Register ──────────────────────────────────────────
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String email    = body.get("email");
        String password = body.get("password");

        if (username == null || username.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required"));
        if (email == null || email.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        if (password == null || password.length() < 6)
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters"));

        if (userRepository.existsByUsernameIgnoreCase(username))
            return ResponseEntity.badRequest().body(Map.of("error", "Username already taken"));
        if (userRepository.existsByEmail(email))
            return ResponseEntity.badRequest().body(Map.of("error", "Email already registered"));

        // Pick a random avatar color from a palette
        String[] colors = {"#00d4aa","#ff6b6b","#ffd93d","#a29bfe","#fd79a8","#74b9ff","#55efc4"};
        String color = colors[(int)(Math.random() * colors.length)];

        User user = new User();
        user.setUsername(username.trim());
        user.setEmail(email.trim().toLowerCase());
        user.setPassword(passwordEncoder.encode(password)); // BCrypt hash
        user.setStatus("offline"); // offline until WebSocket connects
        user.setAvatarColor(color);

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
            "message",  "Account created successfully",
            "username", username.trim(),
            "id",       user.getId()
        ));
    }

    // ── Login ─────────────────────────────────────────────
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        if (username == null || username.isBlank() || password == null)
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));

        Optional<User> userOpt = userRepository.findByUsernameIgnoreCase(username.trim());
        if (userOpt.isEmpty() || !passwordEncoder.matches(password, userOpt.get().getPassword()))
            return ResponseEntity.status(401).body(Map.of("error", "Invalid username or password"));

        User user = userOpt.get();
        // Don't set "online" here — WebSocket user.join does that

        return ResponseEntity.ok(Map.of(
            "message",     "Login successful",
            "username",    user.getUsername(),
            "id",          user.getId(),
            "avatarColor", user.getAvatarColor() != null ? user.getAvatarColor() : "#00d4aa",
            "about",       user.getAbout() != null ? user.getAbout() : ""
        ));
    }

    // ── Logout ────────────────────────────────────────────
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        userRepository.findByUsernameIgnoreCase(username).ifPresent(u -> {
            u.setStatus("offline");
            userRepository.save(u);
        });
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }
}
