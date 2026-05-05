package com.hyj.hotelbackend.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hyj.hotelbackend.auth.AuthUser;
import com.hyj.hotelbackend.auth.CurrentUserHolder;
import com.hyj.hotelbackend.common.PageResponse;
import com.hyj.hotelbackend.entity.Booking;
import com.hyj.hotelbackend.entity.Room;
import com.hyj.hotelbackend.entity.RoomInstance;
import com.hyj.hotelbackend.entity.WalletTransaction;
import com.hyj.hotelbackend.entity.User;
import com.hyj.hotelbackend.service.BookingService;
import com.hyj.hotelbackend.service.RoomService;
import com.hyj.hotelbackend.service.RoomInstanceService;
import com.hyj.hotelbackend.service.WalletService;
import com.hyj.hotelbackend.service.PaymentService;
import com.hyj.hotelbackend.service.VipPricingService;
import com.hyj.hotelbackend.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;
import java.util.Objects;

@RestController
@RequestMapping("/api")
public class BookingController {

    @Autowired
    private BookingService bookingService;

    @Autowired
    private RoomService roomService;

    @Autowired
    private RoomInstanceService roomInstanceService;

    @Autowired
    private WalletService walletService;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private VipPricingService vipPricingService;

    @Autowired
    private UserMapper userMapper;


    // GET /api/users/{userId}/bookings?status=&page=&size=
    @GetMapping("/users/{userId}/bookings")
    public PageResponse<Booking> userBookings(@PathVariable Long userId,
                                              @RequestParam(defaultValue = "1") long page,
                                              @RequestParam(defaultValue = "10") long size,
                                              @RequestParam(required = false) String status) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        boolean isOwner = Objects.equals(me.getId(), userId);
        boolean isAdmin = me.getRole() != null && me.getRole().equals("ADMIN");
        if (!isOwner && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权限查看他人订单");
        }
        LambdaQueryWrapper<Booking> qw = new LambdaQueryWrapper<Booking>()
                .eq(Booking::getUserId, userId)
                .orderByDesc(Booking::getStartTime);
        if (status != null && !status.isBlank()) {
            qw.eq(Booking::getStatus, status);
        }
        Page<Booking> p = bookingService.page(new Page<>(page, size), qw);
        return PageResponse.of(p.getRecords(), p.getCurrent(), p.getSize(), p.getTotal());
    }

    // PUT /api/bookings/{id}/cancel
    @PutMapping("/bookings/{id}/cancel")
    public Booking cancel(@PathVariable Long id) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        Booking b = bookingService.getById(id);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        boolean isOwner = Objects.equals(me.getId(), b.getUserId());
        boolean isAdmin = me.getRole() != null && me.getRole().equals("ADMIN");
        if (!isOwner && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权取消该订单");
        }
        if ("CHECKED_IN".equals(b.getStatus()) || "CHECKED_OUT".equals(b.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该状态不允许取消");
        }
        // 检查是否已支付
        if ("PAID".equals(b.getPaymentStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已支付订单请使用退款申请");
        }
        if (!"CANCELLED".equals(b.getStatus())) {
            String previousStatus = b.getStatus();
            b.setStatus("CANCELLED");
            handleRefundIfNecessary(b, "用户取消");
            bookingService.updateById(b);
            restoreAvailabilityIfNeeded(b, previousStatus);
        }
        return b;
    }

    // PUT /api/bookings/{id}/request-refund - 用户申请退款
    @PutMapping("/bookings/{id}/request-refund")
    public Booking requestRefund(@PathVariable Long id, @RequestParam(required = false) String reason) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        Booking b = bookingService.getById(id);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        boolean isOwner = Objects.equals(me.getId(), b.getUserId());
        boolean isAdmin = me.getRole() != null && me.getRole().equals("ADMIN");
        if (!isOwner && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权申请退款");
        }
        // 必须是已支付状态
        if (!"PAID".equals(b.getPaymentStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "仅已支付订单可申请退款");
        }
        // 只有已退房状态不允许申请退款（已完成服务）
        if ("CHECKED_OUT".equals(b.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已退房订单不允许申请退款");
        }
        // 已取消或已退款的订单不能重复申请
        if ("CANCELLED".equals(b.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已取消订单不能申请退款");
        }
        // 不能重复申请
        if ("REFUND_REQUESTED".equals(b.getStatus()) || "REFUNDED".equals(b.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "退款申请已存在或已完成");
        }
        b.setStatus("REFUND_REQUESTED");
        b.setRefundReason(reason);
        b.setRefundRequestedAt(LocalDateTime.now());
        bookingService.updateById(b);
        return b;
    }

    // PUT /api/bookings/{id}/approve-refund - 管理员批准退款
    @PutMapping("/bookings/{id}/approve-refund")
    public Booking approveRefund(@PathVariable Long id) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !me.getRole().equals("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }
        Booking b = bookingService.getById(id);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        if (!"REFUND_REQUESTED".equals(b.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "订单未处于退款申请状态");
        }
        String previousStatus = b.getStatus();
        b.setStatus("REFUNDED");
        b.setRefundApprovedAt(LocalDateTime.now());
        b.setRefundApprovedBy(me.getId());
        handleRefundIfNecessary(b, "管理员批准退款");
        bookingService.updateById(b);
        restoreAvailabilityIfNeeded(b, previousStatus);
        return b;
    }

    // PUT /api/bookings/{id}/reject-refund - 管理员拒绝退款
    @PutMapping("/bookings/{id}/reject-refund")
    public Booking rejectRefund(@PathVariable Long id, @RequestParam(required = false) String reason) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !me.getRole().equals("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }
        Booking b = bookingService.getById(id);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        if (!"REFUND_REQUESTED".equals(b.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "订单未处于退款申请状态");
        }
        // 恢复到之前的确认状态
        b.setStatus("CONFIRMED");
        b.setRefundRejectedAt(LocalDateTime.now());
        b.setRefundApprovedBy(me.getId());
        if (reason != null && !reason.isBlank()) {
            String existingRemark = b.getRemark() == null ? "" : b.getRemark();
            b.setRemark(existingRemark + (existingRemark.isEmpty() ? "" : "; ") + "退款被拒: " + reason);
        }
        bookingService.updateById(b);
        return b;
    }

    // 获取订单详情（本人或管理员）
    @GetMapping("/bookings/{id}")
    public Booking detail(@PathVariable Long id) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        Booking b = bookingService.getById(id);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        boolean isOwner = Objects.equals(me.getId(), b.getUserId());
        boolean isAdmin = me.getRole() != null && me.getRole().equals("ADMIN");
        if (!isOwner && !isAdmin) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权限查看该订单");
        return b;
    }

    // 管理员分页筛选订单：status、userId、roomId、bookingId、时间段重叠过滤
    @GetMapping("/bookings")
    public PageResponse<Booking> adminList(@RequestParam(defaultValue = "1") long page,
                                           @RequestParam(defaultValue = "10") long size,
                                           @RequestParam(required = false) String status,
                                           @RequestParam(required = false) Long userId,
                                           @RequestParam(required = false) Long roomId,
                                           @RequestParam(required = false) Long roomTypeId,
                                           @RequestParam(required = false) Long hotelId,
                                           @RequestParam(required = false) Long bookingId,
                                           @RequestParam(required = false) String contactPhone,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end,
                                           @RequestParam(required = false, defaultValue = "status") String sortBy) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        if (me.getRole() == null || !me.getRole().equals("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可查看全部订单");
        }
        LambdaQueryWrapper<Booking> qw = new LambdaQueryWrapper<>();
        if (bookingId != null) qw.eq(Booking::getId, bookingId);
        if (status != null && !status.isBlank()) qw.eq(Booking::getStatus, status);
        if (userId != null) qw.eq(Booking::getUserId, userId);
        if (roomId != null) qw.eq(Booking::getRoomId, roomId);
        if (roomTypeId != null) qw.eq(Booking::getRoomTypeId, roomTypeId);
        if (hotelId != null) qw.eq(Booking::getHotelId, hotelId);
        if (contactPhone != null && !contactPhone.isBlank()) {
            qw.like(Booking::getContactPhone, contactPhone);
        }
        if (start != null && end != null) {
            if (!start.isBefore(end)) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "开始时间必须早于结束时间");
            qw.lt(Booking::getStartTime, end).gt(Booking::getEndTime, start);
        }

        // 根据sortBy参数决定排序方式
        if ("time".equalsIgnoreCase(sortBy)) {
            // 按创建时间降序（最新的在前）
            qw.orderByDesc(Booking::getCreatedAt);
        } else {
            // 默认按状态优先级分组排序（CASE WHEN 语法 Oracle 支持）
            qw.last(" ORDER BY CASE status " +
                    "WHEN 'PENDING' THEN 1 " +
                    "WHEN 'PENDING_CONFIRMATION' THEN 2 " +
                    "WHEN 'PENDING_PAYMENT' THEN 3 " +
                    "WHEN 'CONFIRMED' THEN 4 " +
                    "WHEN 'CHECKED_IN' THEN 5 " +
                    "WHEN 'CHECKED_OUT' THEN 6 " +
                    "WHEN 'CANCELLED' THEN 7 " +
                    "WHEN 'REFUNDED' THEN 8 " +
                    "ELSE 99 END, start_time DESC, id DESC");
        }

        Page<Booking> p = bookingService.page(new Page<>(page, size), qw);
        return PageResponse.of(p.getRecords(), p.getCurrent(), p.getSize(), p.getTotal());
    }

    // 改期（本人或管理员）：校验状态与重叠，重算金额
    @PutMapping("/bookings/{id}/reschedule")
    public Booking reschedule(@PathVariable Long id,
                              @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
                              @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        if (start == null || end == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "start/end 必填");
        if (!start.isBefore(end)) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "开始时间必须早于结束时间");
        Booking b = bookingService.getById(id);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        boolean isOwner = Objects.equals(me.getId(), b.getUserId());
        boolean isAdmin = me.getRole() != null && me.getRole().equals("ADMIN");
        if (!isOwner && !isAdmin) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权修改该订单");
        if ("CANCELLED".equals(b.getStatus()) || "CHECKED_OUT".equals(b.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该状态不允许改期");
        }
        // 重叠校验：排除自身
        long overlapping = bookingService.count(new LambdaQueryWrapper<Booking>()
                .eq(Booking::getRoomTypeId, b.getRoomTypeId())
                .ne(Booking::getStatus, "CHECKED_OUT")
                .ne(Booking::getStatus, "CANCELLED")
                .ne(Booking::getId, id)
                .lt(Booking::getStartTime, end)
                .gt(Booking::getEndTime, start)
        );
        Room r = roomService.getById(b.getRoomTypeId());
        if (r == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "房型不存在");
        if (overlapping >= r.getTotalCount()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "库存不足或时间段冲突");
        }
        // 更新时间与金额
        b.setStartTime(start);
        b.setEndTime(end);
        int checkoutHour = vipPricingService.getCheckoutBoundaryHour(resolveUserVipLevel(b.getUserId()));
        long days = computeChargeableDays(start, end, checkoutHour);
        b.setAmount(r.getPricePerNight().multiply(java.math.BigDecimal.valueOf(days)));
        bookingService.updateById(b);
        return b;
    }

    // 管理员确认入住（与 /api/rooms/bookings/{id}/confirm 一致）
    @PutMapping("/bookings/{id}/confirm")
    public Booking confirmByAdmin(@PathVariable Long id) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !me.getRole().equals("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }
        Booking b = bookingService.getById(id);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        if (!isPendingLikeStatus(b.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前状态不支持确认");
        }
        b.setStatus("CONFIRMED");
        bookingService.updateById(b);
        markRoomInstanceStatus(b.getRoomId(), 2, false);
        return b;
    }

    @PutMapping("/bookings/{id}/checkin")
    public Booking checkinByAdmin(@PathVariable Long id) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !me.getRole().equals("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }
        Booking b = bookingService.getById(id);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        if (!"CONFIRMED".equals(b.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前状态不支持办理入住");
        }
        b.setStatus("CHECKED_IN");
        bookingService.updateById(b);
        markRoomInstanceStatus(b.getRoomId(), 3, false);
        return b;
    }

    // 管理员退房（与 /api/rooms/bookings/{id}/checkout 一致）
    @PutMapping("/bookings/{id}/checkout")
    public Booking checkoutByAdmin(@PathVariable Long id) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !me.getRole().equals("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }
        Booking b = bookingService.getById(id);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        if (!"CHECKED_IN".equals(b.getStatus()) && !"CONFIRMED".equals(b.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前状态不支持退房");
        }
        String previousStatus = b.getStatus();
        b.setStatus("CHECKED_OUT");
        bookingService.updateById(b);
        restoreAvailabilityIfNeeded(b, previousStatus);
        return b;
    }

    @PutMapping("/bookings/{id}/reject")
    public Booking rejectByAdmin(@PathVariable Long id) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !me.getRole().equals("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }
        Booking b = bookingService.getById(id);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        if (!isPendingLikeStatus(b.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前状态不支持拒绝");
        }
        String previousStatus = b.getStatus();
        restoreAvailabilityIfNeeded(b, previousStatus);
        b.setStatus("CANCELLED");
        handleRefundIfNecessary(b, "管理员拒绝订单");
        bookingService.updateById(b);
        return b;
    }

    @DeleteMapping("/bookings/{id}")
    public Booking deleteByAdmin(@PathVariable Long id) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !me.getRole().equals("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }
        Booking b = bookingService.getById(id);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        handleRefundIfNecessary(b, "管理员删除订单");
        restoreAvailabilityIfNeeded(b, b.getStatus());
        bookingService.removeById(id);
        return b;
    }

    private void handleRefundIfNecessary(Booking booking, String remark) {
        if (booking == null) {
            return;
        }
        if (!"PAID".equalsIgnoreCase(String.valueOf(booking.getPaymentStatus()))) {
            return;
        }
        java.math.BigDecimal paid = booking.getPaidAmount();
        if (paid == null || paid.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            return;
        }
        String method = booking.getPaymentMethod() == null ? "" : booking.getPaymentMethod().toUpperCase();
        java.math.BigDecimal amount = paid;
        if ("WALLET".equals(method)) {
            WalletTransaction tx = walletService.refund(booking.getUserId(), amount, "WALLET", booking.getId(), remark);
            booking.setWalletTransactionId(tx.getId());
        } else {
            if (booking.getPaymentRecordId() != null) {
                paymentService.markRefund(booking.getPaymentRecordId(), "REFUNDED");
            }
        }
        booking.setPaidAmount(java.math.BigDecimal.ZERO);
        booking.setPaymentStatus("REFUNDED");
    }

    private void restoreAvailabilityIfNeeded(Booking booking, String previousStatus) {
        if (booking == null) {
            return;
        }
        String normalized = previousStatus == null ? "" : previousStatus.toUpperCase();
        if (!"CANCELLED".equals(normalized) && !"CHECKED_OUT".equals(normalized)) {
            Long roomTypeId = booking.getRoomTypeId();
            if (roomTypeId != null) {
                Room roomType = roomService.getById(roomTypeId);
                if (roomType != null) {
                    int current = roomType.getAvailableCount() == null ? 0 : roomType.getAvailableCount();
                    int total = roomType.getTotalCount() == null ? Integer.MAX_VALUE : roomType.getTotalCount();
                    roomType.setAvailableCount(Math.min(total, current + 1));
                    roomService.updateById(roomType);
                }
            }
        }
        boolean stayed = "CHECKED_IN".equals(normalized) || "CHECKED_OUT".equals(normalized);
        markRoomInstanceStatus(booking.getRoomId(), 1, stayed);
    }

    private void markRoomInstanceStatus(Long roomInstanceId, int status, boolean updateCheckoutTime) {
        if (roomInstanceId == null) {
            return;
        }
        RoomInstance instance = roomInstanceService.getById(roomInstanceId);
        if (instance == null) {
            return;
        }
        instance.setStatus(status);
        instance.setUpdatedTime(LocalDateTime.now());
        if (updateCheckoutTime) {
            instance.setLastCheckoutTime(LocalDateTime.now());
        }
        roomInstanceService.updateById(instance);
    }

    private boolean isPendingLikeStatus(String status) {
        if (status == null) {
            return false;
        }
        String value = status.toUpperCase();
        return "PENDING".equals(value) || "PENDING_CONFIRMATION".equals(value) || "PENDING_PAYMENT".equals(value);
    }

    private int resolveUserVipLevel(Long userId) {
        if (userId == null) {
            return 0;
        }
        User user = userMapper.selectById(userId);
        if (user == null || user.getVipLevel() == null) {
            return 0;
        }
        return user.getVipLevel();
    }

    private long computeChargeableDays(LocalDateTime start, LocalDateTime end, Integer checkoutHour) {
        if (start == null || end == null || !start.isBefore(end)) {
            return 1L;
        }
        long days = 1L;
        int rawHour = checkoutHour == null ? 12 : checkoutHour;
        int normalizedHour = Math.floorMod(rawHour, 24);
        int extraDays = rawHour / 24;
        LocalDateTime boundary = start.toLocalDate().atStartOfDay().plusHours(normalizedHour).plusDays(extraDays);
        if (!start.isBefore(boundary)) {
            boundary = boundary.plusDays(1);
        }
        while (end.isAfter(boundary)) {
            days++;
            boundary = boundary.plusDays(1);
        }
        return days;
    }
}
