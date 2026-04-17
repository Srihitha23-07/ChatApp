package com.chatapp.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import java.time.Instant;

@Document(collection = "users")
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    private String username;

    @Indexed(unique = true)
    private String email;

    private String password;          // BCrypt hashed
    private String status;            // "online" | "offline" | "away"
    private String about;             // Profile bio — like WhatsApp "About"
    private String avatarColor;       // Hex color for avatar placeholder
    private Instant lastSeen;
    private Instant createdAt;

    public User() {
        this.status    = "offline";
        this.about     = "Hey there! I am using ChatApp.";
        this.createdAt = Instant.now();
        this.lastSeen  = Instant.now();
    }

    // ── Getters & Setters ──────────────────────────────────
    public String getId()                        { return id; }
    public void   setId(String id)               { this.id = id; }

    public String getUsername()                  { return username; }
    public void   setUsername(String username)   { this.username = username; }

    public String getEmail()                     { return email; }
    public void   setEmail(String email)         { this.email = email; }

    public String getPassword()                  { return password; }
    public void   setPassword(String password)   { this.password = password; }

    public String getStatus()                    { return status; }
    public void   setStatus(String status)       { this.status = status; }

    public String getAbout()                     { return about; }
    public void   setAbout(String about)         { this.about = about; }

    public String getAvatarColor()               { return avatarColor; }
    public void   setAvatarColor(String c)       { this.avatarColor = c; }

    public Instant getLastSeen()                 { return lastSeen; }
    public void    setLastSeen(Instant t)        { this.lastSeen = t; }

    public Instant getCreatedAt()                { return createdAt; }
    public void    setCreatedAt(Instant t)       { this.createdAt = t; }
}
