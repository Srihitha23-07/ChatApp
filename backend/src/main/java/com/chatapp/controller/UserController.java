package com.chatapp.controller;

import com.chatapp.model.User;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/users")
@CrossOrigin(origins = "*")
public class UserController {

    @Autowired private UserRepository    userRepository;
    @Autowired private MessageRepository messageRepository;
    @Autowired private PasswordEncoder   passwordEncoder;

    // ── READ: get all users except self (sidebar contacts) ──
    @GetMapping
    public ResponseEntity<?> getAllUsers(@RequestParam(required = false) String exclude) {
        List<User> users = userRepository.findAll();
        if (exclude != null)
            users = users.stream()
                .filter(u -> !u.getUsername().equalsIgnoreCase(exclude))
                .collect(Collectors.toList());

        List<Map<String, String>> result = users.stream().map(u -> {
            Map<String, String> m = new java.util.HashMap<>();
            m.put("id",          u.getId());
            m.put("username",    u.getUsername());
            m.put("status",      u.getStatus()      != null ? u.getStatus()              : "offline");
            m.put("about",       u.getAbout()       != null ? u.getAbout()               : "");
            m.put("avatarColor", u.getAvatarColor() != null ? u.getAvatarColor()         : "#00d4aa");
            m.put("lastSeen",    u.getLastSeen()    != null ? u.getLastSeen().toString() : "");
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── READ: get a single user profile ──
    @GetMapping("/{username}")
    public ResponseEntity<?> getUser(@PathVariable String username) {
        return userRepository.findByUsernameIgnoreCase(username)
            .map(u -> ResponseEntity.ok(Map.of(
                "id",          u.getId(),
                "username",    u.getUsername(),
                "email",       u.getEmail(),
                "status",      u.getStatus() != null ? u.getStatus() : "offline",
                "about",       u.getAbout() != null ? u.getAbout() : "",
                "avatarColor", u.getAvatarColor() != null ? u.getAvatarColor() : "#00d4aa"
            )))
            .orElse(ResponseEntity.notFound().build());
    }

    // ── UPDATE: edit profile (username, email, about, avatarColor) ──
    @PutMapping("/{username}")
    public ResponseEntity<?> updateProfile(
            @PathVariable String username,
            @RequestBody Map<String, String> body) {

        Optional<User> opt = userRepository.findByUsernameIgnoreCase(username);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        User user = opt.get();

        // Update about
        if (body.containsKey("about"))
            user.setAbout(body.get("about"));

        // Update avatarColor
        if (body.containsKey("avatarColor"))
            user.setAvatarColor(body.get("avatarColor"));

        // Update email — check for duplicates
        if (body.containsKey("email")) {
            String newEmail = body.get("email").trim().toLowerCase();
            if (!newEmail.equals(user.getEmail()) && userRepository.existsByEmail(newEmail))
                return ResponseEntity.badRequest().body(Map.of("error", "Email already in use"));
            user.setEmail(newEmail);
        }

        // Update username — check for duplicates
        if (body.containsKey("newUsername")) {
            String newUsername = body.get("newUsername").trim();
            if (!newUsername.equalsIgnoreCase(user.getUsername()) &&
                userRepository.existsByUsernameIgnoreCase(newUsername))
                return ResponseEntity.badRequest().body(Map.of("error", "Username already taken"));
            if (newUsername.length() < 3)
                return ResponseEntity.badRequest().body(Map.of("error", "Username must be at least 3 characters"));
            user.setUsername(newUsername);
        }

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
            "message",     "Profile updated",
            "username",    user.getUsername(),
            "email",       user.getEmail(),
            "about",       user.getAbout(),
            "avatarColor", user.getAvatarColor() != null ? user.getAvatarColor() : "#00d4aa"
        ));
    }

    // ── UPDATE: change password ──
    @PutMapping("/{username}/password")
    public ResponseEntity<?> changePassword(
            @PathVariable String username,
            @RequestBody Map<String, String> body) {

        String currentPassword = body.get("currentPassword");
        String newPassword     = body.get("newPassword");

        if (newPassword == null || newPassword.length() < 6)
            return ResponseEntity.badRequest().body(Map.of("error", "New password must be at least 6 characters"));

        Optional<User> opt = userRepository.findByUsernameIgnoreCase(username);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        User user = opt.get();
        if (!passwordEncoder.matches(currentPassword, user.getPassword()))
            return ResponseEntity.status(401).body(Map.of("error", "Current password is incorrect"));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
    }

    // ── DELETE: delete account and all their messages ──
    @DeleteMapping("/{username}")
    public ResponseEntity<?> deleteAccount(
            @PathVariable String username,
            @RequestBody Map<String, String> body) {

        String password = body.get("password");

        Optional<User> opt = userRepository.findByUsernameIgnoreCase(username);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        User user = opt.get();
        if (!passwordEncoder.matches(password, user.getPassword()))
            return ResponseEntity.status(401).body(Map.of("error", "Password is incorrect"));

        // Delete all messages sent or received by this user
        List<com.chatapp.model.ChatMessage> msgs = messageRepository.findAll().stream()
            .filter(m -> m.getSender().equals(user.getUsername()) ||
                         m.getReceiver().equals(user.getUsername()))
            .collect(Collectors.toList());
        messageRepository.deleteAll(msgs);

        userRepository.delete(user);

        return ResponseEntity.ok(Map.of("message", "Account deleted"));
    }
}
