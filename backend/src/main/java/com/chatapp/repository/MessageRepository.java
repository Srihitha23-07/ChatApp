package com.chatapp.repository;

import com.chatapp.model.ChatMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface MessageRepository extends MongoRepository<ChatMessage, String> {

    // FIX (Issue 5): Bidirectional query — fetches messages where
    //   (sender=user1 AND receiver=user2) OR (sender=user2 AND receiver=user1)
    // Both argument pairs are required because Spring Data MongoDB generates
    // separate OR clauses from the method name — the pairs must match symmetrically.
    List<ChatMessage> findBySenderAndReceiverOrReceiverAndSenderOrderByTimestampAsc(
        String sender, String receiver,
        String receiver2, String sender2
    );

    // All unread messages sent TO a user (for unread badge counts)
    List<ChatMessage> findByReceiverAndStatus(String receiver, String status);

    // Unread from a specific sender
    List<ChatMessage> findBySenderAndReceiverAndStatus(
        String sender, String receiver, String status
    );
}
