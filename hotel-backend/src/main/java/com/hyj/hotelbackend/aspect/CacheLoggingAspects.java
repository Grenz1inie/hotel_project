package com.hyj.hotelbackend.aspect;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 缓存读操作命中/穿透 日志切面
 * 利用 Spring AOP 调用链的优先级原理进行判断
 */
public class CacheLoggingAspects {

    private static final Logger log = LoggerFactory.getLogger(CacheLoggingAspects.class);
    private static final ThreadLocal<Boolean> METHOD_EXECUTED = new ThreadLocal<>();

    /**
     * 外部切面：优先级最高 (Order=99)
     * 它会在 Spring Cache 拦截器 (Order=100) 之前执行。
     */
    @Aspect
    @Component
    @Order(99)
    public static class OuterCacheAspect {
        @Around("@annotation(org.springframework.cache.annotation.Cacheable)")
        public Object outerLog(ProceedingJoinPoint joinPoint) throws Throwable {
            METHOD_EXECUTED.set(false); // 初始化执行标记为 false
            try {
                // 放行，进入下一个拦截器（优先进入 Spring Cache 的拦截器）
                Object result = joinPoint.proceed();

                String className = joinPoint.getSignature().getDeclaringTypeName();
                String methodName = joinPoint.getSignature().getName();

                // 如果内部切面被触发，说明 Spring Cache 没有命中缓存，放行到了实际方法
                if (Boolean.TRUE.equals(METHOD_EXECUTED.get())) {
                    log.info("【缓存穿透】执行了实际方法查库/运算：{} # {}", className, methodName);
                } else {
                    log.info("【缓存命中】直接从 Redis 缓存中返回：{} # {}", className, methodName);
                }

                return result;
            } finally {
                METHOD_EXECUTED.remove(); // 必须清理，防止线程池复用导致的内存泄漏 
            }
        }
    }

    /**
     * 内部切面：优先级最低 (Order=101)
     * 它会在 Spring Cache 拦截器 (Order=100) 之后执行。
     * 如果 Spring Cache 命中了缓存，它会直接返回，这个内部切面根本没有机会执行。
     * 只有发生【缓存穿透 / 缓存未命中】时，Spring Cache 才会继续往下放行调用，从而触发本切面。
     */
    @Aspect
    @Component
    @Order(101)
    public static class InnerCacheAspect {
        @Around("@annotation(org.springframework.cache.annotation.Cacheable)")
        public Object innerMark(ProceedingJoinPoint joinPoint) throws Throwable {
            // 被触发了，标记实际方法将要/已经执行！
            METHOD_EXECUTED.set(true);
            return joinPoint.proceed();
        }
    }
}