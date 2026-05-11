package com.hyj.hotelbackend.config;

import com.alibaba.csp.sentinel.annotation.aspectj.SentinelResourceAspect;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Sentinel 限流配置。
 *
 * <p>职责：
 * <ol>
 *   <li>注册 {@link SentinelResourceAspect} Bean，使 {@code @SentinelResource} 注解的 AOP 织入生效。</li>
 *   <li>通过 Sentinel Dashboard 进行动态规则配置与推送，无需硬编码规则。</li>
 * </ol>
 *
 * <p>规则配置方式：
 * <ul>
 *   <li>连接到 Sentinel Dashboard（配置在 application.yml 中）</li>
 *   <li>在 Dashboard 中为各资源名配置流控规则，实时生效</li>
 *   <li>资源名通过 {@code @SentinelResource#value} 指定</li>
 * </ul>
 *
 * <p>推荐的资源名及限流策略：
 * <ul>
 *   <li>booking-create      — 预订接口，防止超卖与刷单，建议 20 QPS</li>
 *   <li>auth-login          — 登录接口，防暴力破解，建议 10 QPS</li>
 *   <li>auth-register       — 注册接口，防恶意注册，建议 5 QPS</li>
 *   <li>room-day-availability — 公开可用性查询，无需认证，建议 50 QPS</li>
 *   <li>booking-cancel      — 取消订单接口，建议 30 QPS</li>
 *   <li>wallet-recharge     — 钱包充值接口，建议 10 QPS</li>
 * </ul>
 */
@Configuration
public class SentinelConfig {

    /**
     * 注册 Sentinel 注解 AOP 切面。
     * 若缺少此 Bean，{@code @SentinelResource} 注解将静默失效。
     */
    @Bean
    public SentinelResourceAspect sentinelResourceAspect() {
        return new SentinelResourceAspect();
    }
}
