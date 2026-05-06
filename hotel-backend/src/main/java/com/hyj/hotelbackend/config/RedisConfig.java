package com.hyj.hotelbackend.config;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.lettuce.core.ReadFrom;
import io.lettuce.core.event.connection.ConnectedEvent;
import io.lettuce.core.resource.DefaultClientResources;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.data.redis.LettuceClientConfigurationBuilderCustomizer;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.boot.autoconfigure.data.redis.RedisProperties;

import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.time.Duration;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Configuration
public class RedisConfig {

    /**
     * 配置 Lettuce 客户端资源，注入日志监听器
     */
    @Bean(destroyMethod = "shutdown")
    public DefaultClientResources clientResources(RedisProperties redisProperties) {
        DefaultClientResources res = DefaultClientResources.create();

        // 预先获取配置中的 Sentinel 端口列表，避免硬编码
        Set<Integer> sentinelPorts = redisProperties.getSentinel().getNodes().stream()
                .map(node -> Integer.parseInt(node.split(":")[1]))
                .collect(Collectors.toSet());

        res.eventBus().get().subscribe(event -> {
            if (event instanceof ConnectedEvent) {
                ConnectedEvent e = (ConnectedEvent) event;
                SocketAddress remoteAddress = e.remoteAddress();

                if (remoteAddress instanceof InetSocketAddress) {
                    int port = ((InetSocketAddress) remoteAddress).getPort();
                    // 方案 A：动态判断端口是否在 Sentinel 配置列表中
                    if (sentinelPorts.contains(port)) {
                        return;
                    }
                }
                log.info("🟢 Redis 数据节点已连接: {}", remoteAddress);
            }
        });

        return res;
    }

    /**
     * 配置 Lettuce 客户端读写分离策略
     */
    @Bean
    public LettuceClientConfigurationBuilderCustomizer lettuceClientConfigurationBuilderCustomizer(
            DefaultClientResources clientResources) {
        return clientConfigurationBuilder -> {
            // 绑定自定义资源
            clientConfigurationBuilder.clientResources(clientResources);
            // REPLICA_PREFERRED: 优先从从节点读，若不可用则从主节点读
            clientConfigurationBuilder.readFrom(ReadFrom.REPLICA_PREFERRED);
        };
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // 使用Jackson2JsonRedisSerializer来序列化和反序列化redis的value值
        ObjectMapper mapper = new ObjectMapper();
        mapper.setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.ANY);
        mapper.activateDefaultTyping(LaissezFaireSubTypeValidator.instance, ObjectMapper.DefaultTyping.NON_FINAL);
        mapper.registerModule(new JavaTimeModule());

        Jackson2JsonRedisSerializer<Object> serializer = new Jackson2JsonRedisSerializer<>(mapper, Object.class);

        // 使用StringRedisSerializer来序列化和反序列化redis的key值
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(serializer);

        // Hash的key也采用StringRedisSerializer的序列化方式
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(serializer);

        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        // 配置序列化（解决乱码的问题）
        ObjectMapper mapper = new ObjectMapper();
        mapper.setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.ANY);
        mapper.activateDefaultTyping(LaissezFaireSubTypeValidator.instance, ObjectMapper.DefaultTyping.NON_FINAL);
        mapper.registerModule(new JavaTimeModule());

        Jackson2JsonRedisSerializer<Object> serializer = new Jackson2JsonRedisSerializer<>(mapper, Object.class);

        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10)) // 设置缓存默认过期时间10分钟
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(serializer))
                .disableCachingNullValues();

        return RedisCacheManager.builder(factory)
                .cacheDefaults(config)
                .build();
    }
}
