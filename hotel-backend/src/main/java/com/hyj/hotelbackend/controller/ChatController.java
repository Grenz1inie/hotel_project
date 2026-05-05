package com.hyj.hotelbackend.controller;

import com.hyj.hotelbackend.service.ChatService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "*") // 允许跨域，生产环境请指定具体前端域名
public class ChatController {

    @Autowired
    private ChatService chatService;

    @PostMapping
    public Map<String, String> chat(@RequestBody Map<String, String> payload) {
        String userMessage = payload.get("message");
        String reply = chatService.askDeepseek(userMessage);
        return Map.of("reply", reply);
    }
}