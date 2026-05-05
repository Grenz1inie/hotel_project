package com.hyj.hotelbackend.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyj.hotelbackend.service.ChatService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class ChatServiceImpl implements ChatService {

    private static final Logger logger = LoggerFactory.getLogger(ChatServiceImpl.class);

    @Value("${deepseek.api.url}")
    private String apiUrl;

    @Value("${deepseek.api.key}")
    private String apiKey;

    @Value("${deepseek.model:deepseek-chat}")
    private String model;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public ChatServiceImpl(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;

        // 配置带超时的 RestTemplate
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);   // 连接超时 5 秒
        factory.setReadTimeout(30000);     // 读取超时 30 秒
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    public String askDeepseek(String message) {
        // 记录接收到的用户消息（便于调试）
        logger.info("收到用户消息: {}", message);

        // 构建符合 DeepSeek API 的请求体
        Map<String, Object> requestBody = Map.of(
                "model", model,
                "messages", new Object[]{
                        Map.of("role", "user", "content", message)
                },
                "stream", false
        );

        try {
            // 设置请求头
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            String bodyJson = objectMapper.writeValueAsString(requestBody);
            HttpEntity<String> entity = new HttpEntity<>(bodyJson, headers);

            // 记录请求 URL 和模型（不记录完整 Key 以避免泄露）
            logger.debug("调用 DeepSeek API, URL: {}, Model: {}", apiUrl, model);

            // 发送 POST 请求
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl,
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            if (!response.getStatusCode().is2xxSuccessful()) {
                logger.error("DeepSeek API 响应异常，状态码：{}", response.getStatusCode());
                return "机器人服务暂不可用：API 响应错误";
            }

            String responseJson = response.getBody();
            // 解析响应 JSON，提取 content
            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode contentNode = root.path("choices").get(0).path("message").path("content");
            if (contentNode.isMissingNode()) {
                logger.warn("DeepSeek API 响应缺少 content 字段，原始响应：{}", responseJson);
                return "机器人服务异常：响应格式错误";
            }
            String reply = contentNode.asText();
            logger.info("DeepSeek 回复成功，长度: {}", reply.length());
            return reply;

        } catch (Exception e) {
            logger.error("调用 DeepSeek API 失败", e);
            return "机器人服务暂不可用：" + e.getMessage();
        }
    }
}