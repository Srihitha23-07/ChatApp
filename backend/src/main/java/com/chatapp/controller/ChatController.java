package com.chatapp.controller;

import com.chatapp.model.ChatMessage;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Controller
@CrossOrigin(origins = "*")
public class ChatController {

    @Autowired private MessageRepository     messageRepository;
    @Autowired private UserRepository        userRepository;
    @Autowired private SimpMessagingTemplate messagingTemplate;

    // sessionId → username — for disconnect cleanup
    private final ConcurrentHashMap<String, String> sessionUserMap = new ConcurrentHashMap<>();

    // ── CREATE: send a new message privately ──────────────
    // FIX (Issue 1 & 2): Use convertAndSendToUser so messages are routed only to
    // the named user's session(s) via /user/queue/messages — not a shared /topic
    // that any subscribed client could intercept.
    @MessageMapping("/chat")
    public void send(ChatMessage message) {
        message.setStatus("delivered");
        message.setTimestamp(Instant.now());
        ChatMessage saved = messageRepository.save(message);

        // Deliver privately to the recipient's queue
        messagingTemplate.convertAndSendToUser(saved.getReceiver(), "/queue/messages", saved);
        // Echo back to the sender for multi-device sync and delivery confirmation
        messagingTemplate.convertAndSendToUser(saved.getSender(),   "/queue/messages", saved);
    }

    // ── READ: get chat history between two users ──────────
    @GetMapping("/messages/{user1}/{user2}")
    @ResponseBody
    public ResponseEntity<List<ChatMessage>> getHistory(
            @PathVariable String user1, @PathVariable String user2) {

        List<ChatMessage> msgs = messageRepository
            .findBySenderAndReceiverOrReceiverAndSenderOrderByTimestampAsc(
                user1, user2, user1, user2);
        return ResponseEntity.ok(msgs);
    }

    // ── READ: get unread counts for all conversations ─────
    @GetMapping("/messages/{username}/unread")
    @ResponseBody
    public ResponseEntity<Map<String, Long>> getUnreadCounts(@PathVariable String username) {
        List<ChatMessage> unread = messageRepository.findByReceiverAndStatus(username, "delivered");
        Map<String, Long> counts = unread.stream()
            .collect(Collectors.groupingBy(ChatMessage::getSender, Collectors.counting()));
        return ResponseEntity.ok(counts);
    }

    // ── UPDATE: mark all messages from a sender as read ───
    @PutMapping("/messages/read/{sender}/{receiver}")
    @ResponseBody
    public ResponseEntity<?> markAsRead(
            @PathVariable String sender, @PathVariable String receiver) {

        List<ChatMessage> msgs = messageRepository
            .findBySenderAndReceiverAndStatus(sender, receiver, "delivered");
        msgs.forEach(m -> m.setStatus("read"));
        messageRepository.saveAll(msgs);

        // FIX (Issue 1 & 2): Notify sender privately via their user queue
        messagingTemplate.convertAndSendToUser(sender, "/queue/read",
            Map.of("reader", receiver, "sender", sender));

        return ResponseEntity.ok(Map.of("updated", msgs.size()));
    }

    // ── UPDATE: edit a message ────────────────────────────
    @PutMapping("/messages/{id}")
    @ResponseBody
    public ResponseEntity<?> editMessage(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {

        String requestingUser = body.get("username");
        String newContent     = body.get("content");

        if (newContent == null || newContent.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Content cannot be empty"));

        Optional<ChatMessage> opt = messageRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        ChatMessage msg = opt.get();

        // Only the sender can edit their own messages
        if (!msg.getSender().equals(requestingUser))
            return ResponseEntity.status(403).body(Map.of("error", "You can only edit your own messages"));

        // Can't edit a deleted message
        if (msg.isDeleted())
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot edit a deleted message"));

        msg.setOriginalContent(msg.getContent()); // preserve original
        msg.setContent(newContent.trim());
        msg.setEdited(true);
        ChatMessage saved = messageRepository.save(msg);

        // FIX (Issue 1 & 2): Broadcast edit privately to both participants
        messagingTemplate.convertAndSendToUser(msg.getReceiver(), "/queue/messages", saved);
        messagingTemplate.convertAndSendToUser(msg.getSender(),   "/queue/messages", saved);

        return ResponseEntity.ok(saved);
    }

    // ── DELETE: delete a message (soft delete) ────────────
    @DeleteMapping("/messages/{id}")
    @ResponseBody
    public ResponseEntity<?> deleteMessage(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {

        String requestingUser = body.get("username");

        Optional<ChatMessage> opt = messageRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        ChatMessage msg = opt.get();

        // Only the sender can delete their own messages
        if (!msg.getSender().equals(requestingUser))
            return ResponseEntity.status(403).body(Map.of("error", "You can only delete your own messages"));

        msg.setDeleted(true);
        msg.setContent("This message was deleted");
        ChatMessage saved = messageRepository.save(msg);

        // FIX (Issue 1 & 2): Notify both participants privately
        messagingTemplate.convertAndSendToUser(msg.getReceiver(), "/queue/messages", saved);
        messagingTemplate.convertAndSendToUser(msg.getSender(),   "/queue/messages", saved);

        return ResponseEntity.ok(Map.of("message", "Message deleted"));
    }

    // ── DELETE: clear entire conversation ─────────────────
    @DeleteMapping("/messages/conversation/{user1}/{user2}")
    @ResponseBody
    public ResponseEntity<?> clearConversation(
            @PathVariable String user1, @PathVariable String user2,
            @RequestParam String requestingUser) {

        if (!requestingUser.equals(user1) && !requestingUser.equals(user2))
            return ResponseEntity.status(403).body(Map.of("error", "Not authorized"));

        List<ChatMessage> msgs = messageRepository
            .findBySenderAndReceiverOrReceiverAndSenderOrderByTimestampAsc(
                user1, user2, user1, user2);
        messageRepository.deleteAll(msgs);

        return ResponseEntity.ok(Map.of("message", "Conversation cleared", "deleted", msgs.size()));
    }

    // ── WebSocket: typing indicator ───────────────────────
    // FIX (Issue 1 & 2): Route typing events only to the intended recipient
    @MessageMapping("/typing")
    public void typing(Map<String, String> payload) {
        String sender    = payload.get("sender");
        String receiver  = payload.get("receiver");
        boolean isTyping = Boolean.parseBoolean(payload.getOrDefault("typing", "false"));
        messagingTemplate.convertAndSendToUser(receiver, "/queue/typing",
            Map.of("sender", sender, "typing", isTyping));
    }

    // ── WebSocket: user joins ─────────────────────────────
    @MessageMapping("/user.join")
    public void userJoin(Map<String, String> payload,
                         org.springframework.messaging.Message<?> message) {
        String username  = payload.get("username");
        String sessionId = StompHeaderAccessor.wrap(message).getSessionId();
        if (sessionId != null && username != null) sessionUserMap.put(sessionId, username);

        userRepository.findByUsername(username).ifPresent(u -> {
            u.setStatus("online");
            u.setLastSeen(Instant.now());
            userRepository.save(u);
        });
        broadcastOnlineUsers();
    }

    // ── WebSocket: user leaves (clean logout) ─────────────
    @MessageMapping("/user.leave")
    public void userLeave(Map<String, String> payload,
                          org.springframework.messaging.Message<?> message) {
        String username  = payload.get("username");
        String sessionId = StompHeaderAccessor.wrap(message).getSessionId();
        if (sessionId != null) sessionUserMap.remove(sessionId);

        userRepository.findByUsername(username).ifPresent(u -> {
            u.setStatus("offline");
            u.setLastSeen(Instant.now());
            userRepository.save(u);
        });
        broadcastOnlineUsers();
    }

    // ── Handle abrupt disconnects (tab close, crash) ──────
    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        String sessionId = StompHeaderAccessor.wrap(event.getMessage()).getSessionId();
        String username  = sessionUserMap.remove(sessionId);
        if (username == null) return;

        userRepository.findByUsername(username).ifPresent(u -> {
            u.setStatus("offline");
            u.setLastSeen(Instant.now());
            userRepository.save(u);
        });
        broadcastOnlineUsers();
    }

    // ── Broadcast all users with current status ───────────
    // FIX (Issue 3): Was filtering to only online users — offline users then
    // disappeared from the contacts list entirely. Now we send everyone with
    // their current status so the frontend can show offline + last-seen correctly.
    private void broadcastOnlineUsers() {
        List<Map<String, String>> allUsers = userRepository.findAll().stream()
            .map(u -> {
                Map<String, String> m = new java.util.HashMap<>();
                m.put("id",          u.getId());
                m.put("username",    u.getUsername());
                m.put("status",      u.getStatus() != null ? u.getStatus() : "offline");
                m.put("about",       u.getAbout()       != null ? u.getAbout()       : "");
                m.put("avatarColor", u.getAvatarColor() != null ? u.getAvatarColor() : "#00d4aa");
                m.put("lastSeen",    u.getLastSeen()    != null ? u.getLastSeen().toString() : "");
                return m;
            })
            .collect(Collectors.toList());
        messagingTemplate.convertAndSend("/topic/online-users", allUsers);
    }
}
