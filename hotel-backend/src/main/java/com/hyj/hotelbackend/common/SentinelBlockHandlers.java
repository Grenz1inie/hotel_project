package com.hyj.hotelbackend.common;

import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.hyj.hotelbackend.controller.AuthController;
import com.hyj.hotelbackend.controller.RoomController;
import com.hyj.hotelbackend.controller.WalletController;
import com.hyj.hotelbackend.dto.RoomDayAvailabilityResponse;
import com.hyj.hotelbackend.entity.Booking;
import com.hyj.hotelbackend.entity.WalletTransaction;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Sentinel {@code @SentinelResource} 注解的 blockHandler 集中处理类。
 *
 * <p>规则：
 * <ul>
 *   <li>所有方法必须是 {@code public static}。</li>
 *   <li>方法签名须与原 Controller 方法 <strong>完全一致</strong>，末尾额外追加 {@link BlockException}。</li>
 *   <li>统一抛出 {@code ResponseStatusException(429)}，由 {@code GlobalExceptionHandler} 序列化为 JSON。</li>
 * </ul>
 */
public class SentinelBlockHandlers {

    // ──────────────────────────────────────────────────────────────────────
    // RoomController
    // ──────────────────────────────────────────────────────────────────────

    /**
     * 对应 {@code RoomController#book(Long, RoomController.BookRoomRequest)}
     */
    public static Booking handleBookingBlock(Long id,
                                             RoomController.BookRoomRequest request,
                                             BlockException ex) {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "预订请求过于频繁，请稍后再试");
    }

    /**
     * 对应 {@code RoomController#dayAvailability(Long, LocalDate, Long)}
     */
    public static RoomDayAvailabilityResponse handleDayAvailabilityBlock(
            Long roomTypeId,
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Long hotelId,
            BlockException ex) {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "查询过于频繁，请稍后再试");
    }

    // ──────────────────────────────────────────────────────────────────────
    // AuthController
    // ──────────────────────────────────────────────────────────────────────

    /**
     * 对应 {@code AuthController#login(AuthController.LoginRequest)}
     */
    public static Map<String, Object> handleLoginBlock(AuthController.LoginRequest req,
                                                       BlockException ex) {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "登录请求过于频繁，请稍后再试");
    }

    /**
     * 对应 {@code AuthController#register(AuthController.RegisterRequest)}
     */
    public static Map<String, Object> handleRegisterBlock(AuthController.RegisterRequest req,
                                                          BlockException ex) {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "注册请求过于频繁，请稍后再试");
    }

    // ──────────────────────────────────────────────────────────────────────
    // BookingController
    // ──────────────────────────────────────────────────────────────────────

    /**
     * 对应 {@code BookingController#cancel(Long)}
     */
    public static Booking handleBookingCancelBlock(Long id, BlockException ex) {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "取消订单请求过于频繁，请稍后再试");
    }

    /**
     * 对应 {@code BookingController#requestRefund(Long, String)}
     */
    public static Booking handleRefundRequestBlock(Long id, String reason, BlockException ex) {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "退款申请请求过于频繁，请稍后再试");
    }

    /**
     * 对应 {@code BookingController#reschedule(Long, LocalDateTime, LocalDateTime)}
     */
    public static Booking handleRescheduleBlock(Long id,
                                                @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
                                                @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end,
                                                BlockException ex) {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "改期请求过于频繁，请稍后再试");
    }

    // ──────────────────────────────────────────────────────────────────────
    // WalletController
    // ──────────────────────────────────────────────────────────────────────

    /**
     * 对应 {@code WalletController#recharge(WalletController.RechargeRequest)}
     */
    public static WalletTransaction handleWalletRechargeBlock(WalletController.RechargeRequest request,
                                                              BlockException ex) {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "充值请求过于频繁，请稍后再试");
    }

    /**
     * 对应 {@code WalletController#me(int)}
     */
    public static Map<String, Object> handleWalletQueryBlock(int limit, BlockException ex) {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "钱包查询过于频繁，请稍后再试");
    }
}
