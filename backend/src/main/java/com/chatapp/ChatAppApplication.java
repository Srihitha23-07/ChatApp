package com.chatapp;

import com.chatapp.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class ChatAppApplication {

    public static void main(String[] args) {
        SpringApplication.run(ChatAppApplication.class, args);
    }

    // Reset ALL users to offline on startup — clears stale "online" from crashes
    @Bean
    CommandLineRunner resetStatuses(UserRepository userRepository) {
        return args -> {
            userRepository.findAll().forEach(u -> {
                u.setStatus("offline");
                userRepository.save(u);
            });
            System.out.println("[ChatApp] All user statuses reset to offline.");
        };
    }
}
