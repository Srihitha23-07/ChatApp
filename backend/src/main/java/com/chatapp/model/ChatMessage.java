package com.chatapp.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import java.time.Instant;

@Document(collection = "messages")
public class ChatMessage {

    @Id
    private String id;

    private String sender;
    private String receiver;
    private String content;
    private String type;          // "text" | "file" | "image"
    private String status;        // "sent" | "delivered" | "read"
    private boolean deleted;      // soft delete — shows "This message was deleted"
    private boolean edited;       // flag shown in UI like WhatsApp
    private String originalContent; // kept for audit trail when edited

    @Indexed
    private Instant timestamp;

    public ChatMessage() {
        this.timestamp = Instant.now();
        this.status    = "sent";
        this.deleted   = false;
        this.edited    = false;
    }

    // ── Getters & Setters ──────────────────────────────────
    public String getId()                            { return id; }
    public void   setId(String id)                   { this.id = id; }

    public String getSender()                        { return sender; }
    public void   setSender(String s)                { this.sender = s; }

    public String getReceiver()                      { return receiver; }
    public void   setReceiver(String r)              { this.receiver = r; }

    public String getContent()                       { return content; }
    public void   setContent(String c)               { this.content = c; }

    public String getType()                          { return type; }
    public void   setType(String t)                  { this.type = t; }

    public String getStatus()                        { return status; }
    public void   setStatus(String s)                { this.status = s; }

    public boolean isDeleted()                       { return deleted; }
    public void    setDeleted(boolean d)             { this.deleted = d; }

    public boolean isEdited()                        { return edited; }
    public void    setEdited(boolean e)              { this.edited = e; }

    public String getOriginalContent()               { return originalContent; }
    public void   setOriginalContent(String c)       { this.originalContent = c; }

    public Instant getTimestamp()                    { return timestamp; }
    public void    setTimestamp(Instant t)           { this.timestamp = t; }
}
