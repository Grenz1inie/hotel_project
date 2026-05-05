package com.hyj.hotelbackend.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hyj.hotelbackend.auth.AuthUser;
import com.hyj.hotelbackend.auth.CurrentUserHolder;
import com.hyj.hotelbackend.entity.Booking;
import com.hyj.hotelbackend.dto.RoomInstanceSummary;
import com.hyj.hotelbackend.dto.RoomOccupancyOverviewResponse;
import com.hyj.hotelbackend.entity.Room;
import com.hyj.hotelbackend.entity.User;
import com.hyj.hotelbackend.entity.RoomInstance;
import com.hyj.hotelbackend.entity.WalletTransaction;
import com.hyj.hotelbackend.entity.PaymentRecord;
import com.hyj.hotelbackend.dto.RoomDayAvailabilityResponse;
import com.hyj.hotelbackend.dto.RoomTimelineResponse;
import com.hyj.hotelbackend.dto.RoomTimelineItem;
import com.hyj.hotelbackend.dto.RoomTimelineBooking;
import com.hyj.hotelbackend.mapper.UserMapper;
import com.hyj.hotelbackend.service.BookingService;
import com.hyj.hotelbackend.service.RoomService;
import com.hyj.hotelbackend.service.RoomInstanceService;
import com.hyj.hotelbackend.service.WalletService;
import com.hyj.hotelbackend.service.PaymentService;
import com.hyj.hotelbackend.service.VipPricingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    @Autowired
    private RoomService roomService;

    @Autowired
    private BookingService bookingService;

    @Autowired
    private RoomInstanceService roomInstanceService;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private WalletService walletService;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private VipPricingService vipPricingService;

    @GetMapping
    @org.springframework.cache.annotation.Cacheable(value = "dynamicRoomListCache", key = "'all'")
    public List<Room> list() {
        List<Room> rooms = roomService.list();
        if (rooms.isEmpty()) {
            return rooms;
        }
        Map<Long, InventoryMetrics> inventory = aggregateInventoryByRoomType(
                rooms.stream()
                        .map(Room::getId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet())
        );
        rooms.forEach(room -> {
            InventoryMetrics metrics = room.getId() == null ? null : inventory.get(room.getId());
            if (metrics != null) {
                room.setTotalCount(metrics.totalRooms());
                room.setAvailableCount(metrics.availableRooms());
            }
        });
        return rooms;
    }

    @PostMapping("/import")
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"dynamicRoomListCache", "roomOccupancyCache", "roomTimelineCache", "roomAvailabilityCache", "roomInstancesCache", "roomInstancesByTypeCache", "roomInfoCache"}, allEntries = true)
    public Map<String, Object> importRooms(@RequestBody List<Room> rooms) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !"ADMIN".equals(me.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可导入房型");
        }
        if (rooms == null || rooms.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "导入数据不能为空");
        }
        int count = 0;
        for (Room room : rooms) {
            if (room.getId() != null && roomService.getById(room.getId()) != null) {
                roomService.updateById(room);
            } else {
                roomService.save(room);
            }
            count++;
        }
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "成功导入 " + count + " 条房型数据");
        return res;
    }

    @GetMapping("/{id:[0-9]+}")
    @org.springframework.cache.annotation.Cacheable(value = "roomInfoCache", key = "#id")
    public Room get(@PathVariable Long id) {
        Room r = roomService.getById(id);
        if (r == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "房型不存在");
        return r;
    }

    @GetMapping("/instances")
    @org.springframework.cache.annotation.Cacheable(value = "roomInstancesCache", key = "'hotel_' + (#hotelId != null ? #hotelId : 'all') + ':type_' + (#roomTypeId != null ? #roomTypeId : 'all') + ':status_' + (#status != null ? #status : 'all')")
    public List<RoomInstanceSummary> listInstances(@RequestParam(required = false) Long hotelId,
                                                   @RequestParam(required = false) Long roomTypeId,
                                                   @RequestParam(required = false) Integer status) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !"ADMIN".equals(me.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可查看房间详情");
        }
        LambdaQueryWrapper<RoomInstance> qw = new LambdaQueryWrapper<>();
        if (hotelId != null) {
            qw.eq(RoomInstance::getHotelId, hotelId);
        }
        if (roomTypeId != null) {
            qw.eq(RoomInstance::getRoomTypeId, roomTypeId);
        }
        if (status != null) {
            qw.eq(RoomInstance::getStatus, status);
        }
        qw.orderByAsc(RoomInstance::getRoomTypeId).orderByAsc(RoomInstance::getRoomNumber);
        List<RoomInstance> instances = roomInstanceService.list(qw);
        if (instances.isEmpty()) {
            return Collections.emptyList();
        }

        Set<Long> roomIds = instances.stream()
                .map(RoomInstance::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (roomIds.isEmpty()) {
            return Collections.emptyList();
        }

        Set<String> activeStatuses = new HashSet<>(Arrays.asList(
                "PENDING",
                "PENDING_CONFIRMATION",
                "PENDING_PAYMENT",
                "CONFIRMED",
                "CHECKED_IN"
        ));

        List<Booking> relatedBookings = bookingService.lambdaQuery()
                .in(Booking::getRoomId, roomIds)
                .in(Booking::getStatus, activeStatuses)
                .orderByAsc(Booking::getStartTime)
                .list();

        Map<Long, Booking> bookingByRoom = new HashMap<>();
        LocalDateTime now = LocalDateTime.now();
        for (Booking booking : relatedBookings) {
            if (booking.getEndTime() != null
                    && booking.getEndTime().isBefore(now)
                    && (booking.getStatus() == null || !booking.getStatus().equalsIgnoreCase("CHECKED_IN"))) {
                continue;
            }
            bookingByRoom.computeIfAbsent(booking.getRoomId(), key -> booking);
        }

        return instances.stream().map(instance -> {
            RoomInstanceSummary summary = RoomInstanceSummary.fromRoom(instance);
            Booking booking = bookingByRoom.get(instance.getId());
            if (booking != null) {
                summary.applyBooking(booking);
            }
            return summary;
        }).collect(Collectors.toList());
    }

    @GetMapping("/occupancy-overview")
    @org.springframework.cache.annotation.Cacheable(value = "roomOccupancyCache", key = "'all:start_' + #start.toString() + ':end_' + (#end != null ? #end.toString() : 'none') + ':hotel_' + (#hotelId != null ? #hotelId : 'all') + ':type_' + (#roomTypeId != null ? #roomTypeId : 'all')")
    public RoomOccupancyOverviewResponse occupancyOverview(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
                                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end,
                                                           @RequestParam(required = false) Long hotelId,
                                                           @RequestParam(required = false) Long roomTypeId) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !"ADMIN".equals(me.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可查看入住规划");
        }
        if (start == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "start 参数不能为空");
        }
        LocalDateTime windowStart = start;
        LocalDateTime windowEnd = end != null ? end : windowStart.plusDays(7);
        if (!windowStart.isBefore(windowEnd)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "时间范围无效");
        }

        LambdaQueryWrapper<Booking> bookingQuery = new LambdaQueryWrapper<>();
        if (hotelId != null) {
            bookingQuery.eq(Booking::getHotelId, hotelId);
        }
        if (roomTypeId != null) {
            bookingQuery.eq(Booking::getRoomTypeId, roomTypeId);
        }
        bookingQuery.lt(Booking::getStartTime, windowEnd).gt(Booking::getEndTime, windowStart);
        bookingQuery
                .orderByAsc(Booking::getRoomTypeId)
                .orderByAsc(Booking::getRoomId)
                .orderByAsc(Booking::getStartTime)
                .orderByAsc(Booking::getId);
        List<Booking> bookings = bookingService.list(bookingQuery);

        LambdaQueryWrapper<RoomInstance> roomQuery = new LambdaQueryWrapper<>();
        if (hotelId != null) {
            roomQuery.eq(RoomInstance::getHotelId, hotelId);
        }
        if (roomTypeId != null) {
            roomQuery.eq(RoomInstance::getRoomTypeId, roomTypeId);
        }
        roomQuery.orderByAsc(RoomInstance::getRoomTypeId).orderByAsc(RoomInstance::getRoomNumber);
        List<RoomInstance> instances = roomInstanceService.list(roomQuery);

        RoomOccupancyOverviewResponse resp = new RoomOccupancyOverviewResponse();
        resp.setWindowStart(windowStart);
        resp.setWindowEnd(windowEnd);
        resp.setBookings(bookings);
        resp.setRoomInstances(instances);
        return resp;
    }

    @GetMapping("/{roomTypeId}/timeline")
    @org.springframework.cache.annotation.Cacheable(value = "roomTimelineCache", key = "#roomTypeId + ':hotel_' + (#hotelId != null ? #hotelId : 'all') + ':start_' + #start.toString() + ':end_' + (#end != null ? #end.toString() : 'none') + ':page_' + #page + ':size_' + #size")
    public RoomTimelineResponse occupancyTimeline(@PathVariable Long roomTypeId,
                                                  @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end,
                                                  @RequestParam(required = false) Long hotelId,
                                                  @RequestParam(defaultValue = "1") Integer page,
                                                  @RequestParam(defaultValue = "6") Integer size) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !"ADMIN".equals(me.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可查看入住规划");
        }
        if (roomTypeId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "roomTypeId 不能为空");
        }
        Room roomType = roomService.getById(roomTypeId);
        if (roomType == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "房型不存在");
        }
        if (hotelId != null && roomType.getHotelId() != null && !Objects.equals(hotelId, roomType.getHotelId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "酒店信息不匹配");
        }
        Long resolvedHotelId = hotelId != null ? hotelId : roomType.getHotelId();
        if (start == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "start 参数不能为空");
        }
        LocalDateTime windowStart = start.withSecond(0).withNano(0);
        LocalDateTime windowEnd = end != null ? end.withSecond(0).withNano(0) : windowStart.plusMonths(1);
        if (!windowStart.isBefore(windowEnd)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "时间范围无效");
        }
        int safeSize = size == null ? 7 : Math.min(Math.max(size, 1), 7);
        int requestedPage = page == null ? 1 : Math.max(page, 1);

        LambdaQueryWrapper<RoomInstance> roomQuery = new LambdaQueryWrapper<>();
        roomQuery.eq(RoomInstance::getRoomTypeId, roomTypeId);
        if (resolvedHotelId != null) {
            roomQuery.eq(RoomInstance::getHotelId, resolvedHotelId);
        }
        roomQuery.orderByAsc(RoomInstance::getRoomNumber).orderByAsc(RoomInstance::getId);
        List<RoomInstance> allInstances = roomInstanceService.list(roomQuery);

        RoomTimelineResponse resp = new RoomTimelineResponse();
        resp.setRoomTypeId(roomTypeId);
        resp.setHotelId(resolvedHotelId);
        resp.setRoomTypeName(roomType.getName());
        resp.setRoomTypeCode(roomType.getType());
        resp.setWindowStart(windowStart);
        resp.setWindowEnd(windowEnd);
        resp.setSize(safeSize);

        if (allInstances.isEmpty()) {
            resp.setPage(1);
            resp.setTotal(0L);
            resp.setItems(Collections.emptyList());
            return resp;
        }

        long total = allInstances.size();
        int maxPage = (int) Math.max(1, Math.ceil(total / (double) safeSize));
        int normalizedPage = Math.min(requestedPage, maxPage);
        int fromIndex = Math.max(0, (normalizedPage - 1) * safeSize);
        int toIndex = Math.min(allInstances.size(), fromIndex + safeSize);
        List<RoomInstance> pagedInstances = fromIndex >= toIndex ? Collections.emptyList() : allInstances.subList(fromIndex, toIndex);

        resp.setPage(normalizedPage);
        resp.setTotal(total);

        if (pagedInstances.isEmpty()) {
            resp.setItems(Collections.emptyList());
            return resp;
        }

        Set<Long> roomIds = pagedInstances.stream()
                .map(RoomInstance::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        final Map<Long, List<Booking>> bookingsByRoom;
        if (!roomIds.isEmpty()) {
            // 复用 BookingService 抽象方法；null 表示不过滤状态（管理员视图展示全部）
            List<Booking> bookings = bookingService.getBookingPeriodsByRooms(
                    roomIds, windowStart, windowEnd, null);
            bookingsByRoom = bookings.stream()
                    .sorted(Comparator.comparing(Booking::getRoomId)
                            .thenComparing(Booking::getStartTime)
                            .thenComparing(Booking::getId))
                    .collect(Collectors.groupingBy(Booking::getRoomId));
        } else {
            bookingsByRoom = Collections.emptyMap();
        }

        List<RoomTimelineItem> items = pagedInstances.stream().map(instance -> {
            RoomTimelineItem item = new RoomTimelineItem();
            item.setRoomId(instance.getId());
            item.setRoomTypeId(instance.getRoomTypeId());
            item.setRoomNumber(instance.getRoomNumber());
            item.setFloor(instance.getFloor());
            item.setStatus(instance.getStatus());
            List<RoomTimelineBooking> timelineBookings = bookingsByRoom.getOrDefault(instance.getId(), Collections.emptyList())
                    .stream()
                    .map(booking -> {
                        RoomTimelineBooking timelineBooking = new RoomTimelineBooking();
                        timelineBooking.setId(booking.getId());
                        timelineBooking.setRoomId(booking.getRoomId());
                        timelineBooking.setRoomTypeId(booking.getRoomTypeId());
                        timelineBooking.setUserId(booking.getUserId());
                        timelineBooking.setStatus(booking.getStatus());
                        timelineBooking.setGuests(booking.getGuests());
                        timelineBooking.setAmount(booking.getAmount());
                        timelineBooking.setContactName(booking.getContactName());
                        timelineBooking.setContactPhone(booking.getContactPhone());
                        timelineBooking.setRemark(booking.getRemark());
                        timelineBooking.setStartTime(booking.getStartTime());
                        timelineBooking.setEndTime(booking.getEndTime());
                        return timelineBooking;
                    })
                    .collect(Collectors.toList());
            item.setBookings(timelineBookings);
            return item;
        }).collect(Collectors.toList());

        resp.setItems(items);
        return resp;
    }

    /**
     * 公开接口：查询指定房型某日的预订时段，供前端渲染可用性预览条。
     * 无需登录即可访问（AuthInterceptor 对 GET /api/rooms/** 已放行并可选附加用户上下文）。
     * 仅返回 startTime / endTime，不包含任何客户敏感信息。
     *
     * @param roomTypeId 房型 ID
     * @param date       查询日期（默认今天）
     * @param hotelId    可选的酒店 ID 过滤
     */
    @GetMapping("/{roomTypeId}/day-availability")
    public RoomDayAvailabilityResponse dayAvailability(
            @PathVariable Long roomTypeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Long hotelId) {

        Room roomType = roomService.getById(roomTypeId);
        if (roomType == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "房型不存在");
        }
        Long resolvedHotelId = hotelId != null ? hotelId : roomType.getHotelId();
        LocalDate resolvedDate = date != null ? date : LocalDate.now();
        LocalDateTime windowStart = resolvedDate.atStartOfDay();
        LocalDateTime windowEnd = windowStart.plusDays(1);

        LambdaQueryWrapper<RoomInstance> roomQuery = new LambdaQueryWrapper<>();
        roomQuery.eq(RoomInstance::getRoomTypeId, roomTypeId);
        if (resolvedHotelId != null) {
            roomQuery.eq(RoomInstance::getHotelId, resolvedHotelId);
        }
        List<RoomInstance> instances = roomInstanceService.list(roomQuery);

        List<Long> roomInstanceIds = instances.stream()
                .map(RoomInstance::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        // 为了防止数据不一致，将除了“已取消”、“已退款”之外的所有有效预订状态都计入占用
        // PENDING/PENDING_CONFIRMATION 等虽然未支付，但在流程中应锁定时间片
        List<Booking> bookings = bookingService.getBookingPeriodsByRooms(
                roomInstanceIds, windowStart, windowEnd,
                Arrays.asList("PENDING", "PENDING_CONFIRMATION", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN", "REFUND_REQUESTED"));

        RoomDayAvailabilityResponse response = new RoomDayAvailabilityResponse();
        response.setRoomTypeId(roomTypeId);
        response.setDate(resolvedDate);
        response.setTotalRooms(instances.size());
        response.setPeriods(bookings.stream()
                .map(b -> new RoomDayAvailabilityResponse.Period(b.getStartTime(), b.getEndTime()))
                .collect(Collectors.toList()));

        return response;
    }

    // admin endpoint to update available count
    @PutMapping("/{id}/adjust")
    @org.springframework.cache.annotation.CacheEvict(value = {"dynamicRoomListCache", "roomOccupancyCache", "roomTimelineCache", "roomAvailabilityCache", "roomInstancesCache", "roomInstancesByTypeCache", "roomInfoCache"}, allEntries = true)
    public Room adjust(@PathVariable Long id, @RequestParam int totalCount) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !me.getRole().equals("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可调整库存");
        }
        if (totalCount < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "totalCount 不能为负数");
        Room r = roomService.getById(id);
        if (r == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "房型不存在");
        r.setTotalCount(totalCount);
        long actualAvailable = roomInstanceService.count(new LambdaQueryWrapper<RoomInstance>()
                .eq(RoomInstance::getRoomTypeId, id)
                .eq(RoomInstance::getStatus, 1));
        int available = (int) Math.min((long) totalCount, actualAvailable);
        r.setAvailableCount(available);
        roomService.updateById(r);
        return r;
    }

    // 房间实例管理端点
    // 获取指定房型的所有房间实例
    @org.springframework.cache.annotation.Cacheable(value = "roomInstancesByTypeCache", key = "#roomTypeId")
    @GetMapping("/room-types/{roomTypeId}/rooms")
    public List<RoomInstance> getRoomInstancesByType(@PathVariable Long roomTypeId) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !"ADMIN".equals(me.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可访问");
        }
        LambdaQueryWrapper<RoomInstance> qw = new LambdaQueryWrapper<>();
        qw.eq(RoomInstance::getRoomTypeId, roomTypeId);
        qw.orderByAsc(RoomInstance::getRoomNumber);
        return roomInstanceService.list(qw);
    }

    // 为指定房型创建新房间实例
    @PostMapping("/room-types/{roomTypeId}/rooms")
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"dynamicRoomListCache", "roomOccupancyCache", "roomTimelineCache", "roomAvailabilityCache", "roomInstancesCache", "roomInstancesByTypeCache", "roomInfoCache"}, allEntries = true)
    public RoomInstance createRoomInstance(@PathVariable Long roomTypeId, @RequestBody RoomInstanceRequest request) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !"ADMIN".equals(me.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }

        // 验证房型是否存在
        Room roomType = roomService.getById(roomTypeId);
        if (roomType == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "房型不存在");
        }

        // 验证房间号是否已存在
        long existingCount = roomInstanceService.count(new LambdaQueryWrapper<RoomInstance>()
                .eq(RoomInstance::getHotelId, roomType.getHotelId())
                .eq(RoomInstance::getRoomNumber, request.roomNumber));
        if (existingCount > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "房间号已存在");
        }

        // 验证状态：创建时只允许空房(1)、待打扫(4)、维修中(5)、锁定(0)
        Integer status = request.status != null ? request.status : 1;
        if (status != 1 && status != 4 && status != 5 && status != 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "创建房间时状态只能是：空房(1)、待打扫(4)、维修中(5)或锁定(0)");
        }

        RoomInstance room = new RoomInstance();
        room.setHotelId(roomType.getHotelId());
        room.setRoomTypeId(roomTypeId);
        room.setRoomNumber(request.roomNumber);
        room.setFloor(request.floor);
        room.setStatus(status);
        room.setCreatedTime(LocalDateTime.now());
        room.setUpdatedTime(LocalDateTime.now());

        roomInstanceService.save(room);

        // 更新房型的总数和可用数
        updateRoomTypeCounts(roomTypeId);

        return room;
    }

    // 更新房间实例信息
    @PutMapping("/rooms/{roomId}")
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"dynamicRoomListCache", "roomOccupancyCache", "roomTimelineCache", "roomAvailabilityCache", "roomInstancesCache", "roomInstancesByTypeCache", "roomInfoCache"}, allEntries = true)
    public RoomInstance updateRoomInstance(@PathVariable Long roomId, @RequestBody RoomInstanceRequest request) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !"ADMIN".equals(me.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }

        RoomInstance room = roomInstanceService.getById(roomId);
        if (room == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "房间不存在");
        }

        // 如果房间号有变化，检查新房间号是否已存在
        if (!room.getRoomNumber().equals(request.roomNumber)) {
            long existingCount = roomInstanceService.count(new LambdaQueryWrapper<RoomInstance>()
                    .eq(RoomInstance::getHotelId, room.getHotelId())
                    .eq(RoomInstance::getRoomNumber, request.roomNumber)
                    .ne(RoomInstance::getId, roomId));
            if (existingCount > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "房间号已存在");
            }
        }

        // 验证状态修改：只允许修改为空房(1)、待打扫(4)、维修中(5)、锁定(0)
        // 已预订(2)、已入住(3)由系统通过订单自动管理
        if (request.status != null && request.status != 1 && request.status != 4 && request.status != 5 && request.status != 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "只能将房间状态修改为：空房(1)、待打扫(4)、维修中(5)或锁定(0)。已预订、已入住状态由系统自动管理。");
        }

        room.setRoomNumber(request.roomNumber);
        room.setFloor(request.floor);
        if (request.status != null) {
            room.setStatus(request.status);
        }
        room.setUpdatedTime(LocalDateTime.now());

        roomInstanceService.updateById(room);

        // 更新房型的可用数
        updateRoomTypeCounts(room.getRoomTypeId());

        return room;
    }

    // 删除房间实例
    @DeleteMapping("/rooms/{roomId}")
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"dynamicRoomListCache", "roomOccupancyCache", "roomTimelineCache", "roomAvailabilityCache", "roomInstancesCache", "roomInstancesByTypeCache", "roomInfoCache"}, allEntries = true)
    public Map<String, Object> deleteRoomInstance(@PathVariable Long roomId) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !"ADMIN".equals(me.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }

        RoomInstance room = roomInstanceService.getById(roomId);
        if (room == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "房间不存在");
        }

        // 检查是否有活跃的订单
        Set<String> activeStatuses = new HashSet<>(Arrays.asList(
                "PENDING", "PENDING_CONFIRMATION", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"
        ));
        long activeBookingCount = bookingService.count(new LambdaQueryWrapper<Booking>()
                .eq(Booking::getRoomId, roomId)
                .in(Booking::getStatus, activeStatuses));

        if (activeBookingCount > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该房间有活跃订单，无法删除");
        }

        Long roomTypeId = room.getRoomTypeId();
        roomInstanceService.removeById(roomId);

        // 更新房型的总数和可用数
        updateRoomTypeCounts(roomTypeId);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "删除成功");
        return result;
    }

    // 辅助方法：更新房型的总数和可用数
    private void updateRoomTypeCounts(Long roomTypeId) {
        Room roomType = roomService.getById(roomTypeId);
        if (roomType == null) return;

        long totalCount = roomInstanceService.count(new LambdaQueryWrapper<RoomInstance>()
                .eq(RoomInstance::getRoomTypeId, roomTypeId));

        long availableCount = roomInstanceService.count(new LambdaQueryWrapper<RoomInstance>()
                .eq(RoomInstance::getRoomTypeId, roomTypeId)
                .eq(RoomInstance::getStatus, 1));

        roomType.setTotalCount((int) totalCount);
        roomType.setAvailableCount((int) availableCount);
        roomService.updateById(roomType);
    }

    // 请求DTO
    public static class RoomInstanceRequest {
        public String roomNumber;
        public Integer floor;
        public Integer status;
    }

    // create booking (user must be authenticated)
    @PostMapping("/{id}/book")
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"dynamicRoomListCache", "roomOccupancyCache", "roomTimelineCache", "roomAvailabilityCache", "roomInstancesCache", "roomInstancesByTypeCache", "roomInfoCache"}, allEntries = true)
    public Booking book(@PathVariable Long id, @RequestBody BookRoomRequest request) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        boolean isAdmin = me.getRole() != null && me.getRole().equals("ADMIN");
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请求体不能为空");
        }
        Long actualUserId = me.getId();
        if (request.userId != null && !Objects.equals(request.userId, me.getId())) {
            if (isAdmin) {
                actualUserId = request.userId; // admin can book for others
            } else {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "不能为他人创建预订");
            }
        } else if (isAdmin && request.userId == null) {
            actualUserId = resolveOrCreateUser(request.contactPhone);
        }
        LocalDateTime start = request.start;
        LocalDateTime end = request.end;
        if (start == null || end == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "start/end 必填");
        if (!start.isBefore(end)) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "开始时间必须早于结束时间");
        Room r = roomService.getById(id);
        if (r == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "房型不存在");
        Long resolvedHotelId = r.getHotelId();
        if (request.hotelId != null && resolvedHotelId != null && !Objects.equals(request.hotelId, resolvedHotelId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "酒店信息不匹配");
        }
        if (resolvedHotelId == null) {
            resolvedHotelId = request.hotelId;
        }
        if (resolvedHotelId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无法确定酒店信息");
        }
        // check inventory by overlapping bookings
        long overlapping = bookingService.count(new LambdaQueryWrapper<Booking>()
                .eq(Booking::getRoomTypeId, id)
                .ne(Booking::getStatus, "CHECKED_OUT")
                .ne(Booking::getStatus, "CANCELLED")
                .lt(Booking::getStartTime, end)
                .gt(Booking::getEndTime, start)
        );
        if (overlapping >= r.getTotalCount()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该时间段内所有房间已满，请选择其他时间");
        }

        // 智能房间分配：查找在指定时间段内没有冲突的房间
        // 1. 获取该房型在该酒店的所有可用房间实例
        List<RoomInstance> availableRooms = roomInstanceService.lambdaQuery()
                .eq(RoomInstance::getRoomTypeId, r.getId())
                .eq(RoomInstance::getHotelId, resolvedHotelId)
                .in(RoomInstance::getStatus, Arrays.asList(1, 2)) // 1=空房，2=已预订
                .orderByAsc(RoomInstance::getRoomNumber)
                .list();

        if (availableRooms == null || availableRooms.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "暂无可用房间，请稍后再试");
        }

        // 2. 获取所有房间在该时间段内的预订记录
        List<Long> roomInstanceIds = availableRooms.stream()
                .map(RoomInstance::getId)
                .collect(Collectors.toList());

        List<Booking> conflictingBookings = bookingService.list(new LambdaQueryWrapper<Booking>()
                .in(Booking::getRoomId, roomInstanceIds)
                .ne(Booking::getStatus, "CHECKED_OUT")
                .ne(Booking::getStatus, "CANCELLED")
                .lt(Booking::getStartTime, end)
                .gt(Booking::getEndTime, start)
        );

        // 3. 构建已占用房间的集合
        Set<Long> occupiedRoomIds = conflictingBookings.stream()
                .map(Booking::getRoomId)
                .collect(Collectors.toSet());

        // 4. 找到第一个没有时间冲突的房间
        RoomInstance allocated = null;
        for (RoomInstance room : availableRooms) {
            if (!occupiedRoomIds.contains(room.getId())) {
                allocated = room;
                break;
            }
        }

        // 5. 如果所有房间都有冲突，返回错误
        if (allocated == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    String.format("该时间段内所有%s房间已满，共有%d间房，已被预订%d间。请选择其他时间或房型。",
                            r.getName(), availableRooms.size(), occupiedRoomIds.size()));
        }
        User chargeUser = userMapper.selectById(actualUserId);
        if (chargeUser == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        }
        Booking b = new Booking();
        b.setHotelId(resolvedHotelId);
        b.setRoomTypeId(r.getId());
        b.setRoomId(allocated.getId());
        b.setUserId(actualUserId);
        b.setStartTime(start);
        b.setEndTime(end);
        int guestCount = request.guests != null && request.guests > 0 ? request.guests : 1;
        b.setGuests(guestCount);
        int checkoutHour = vipPricingService.getCheckoutBoundaryHour(chargeUser.getVipLevel());
        long days = computeChargeableDays(start, end, checkoutHour);
        BigDecimal basePrice = r.getPricePerNight() == null ? BigDecimal.ZERO : r.getPricePerNight();
        BigDecimal originalAmount = basePrice.multiply(BigDecimal.valueOf(days));
        BigDecimal discountRate = vipPricingService.getDiscountRateForRoom(r.getId(), chargeUser.getVipLevel());
        BigDecimal payableAmount = originalAmount.multiply(discountRate).setScale(2, RoundingMode.HALF_UP);
        if (payableAmount.compareTo(BigDecimal.ZERO) <= 0) {
            payableAmount = originalAmount.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal discountAmount = originalAmount.subtract(payableAmount).setScale(2, RoundingMode.HALF_UP);
        b.setOriginalAmount(originalAmount.setScale(2, RoundingMode.HALF_UP));
        b.setDiscountAmount(discountAmount);
        b.setPayableAmount(payableAmount);
        b.setAmount(payableAmount);
        b.setPaidAmount(BigDecimal.ZERO);
        b.setDiscountRate(discountRate);
        String normalizedMethod = normalizePaymentMethod(request.paymentMethod);
        if ("ADMIN".equals(normalizedMethod) && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可创建免支付预订");
        }
        boolean adminDirect = isAdmin && "ADMIN".equals(normalizedMethod);
        String paymentMethod = adminDirect ? "ADMIN" : normalizedMethod;
        String paymentChannel = adminDirect ? "ADMIN" : resolvePaymentChannel(paymentMethod, request.paymentChannel);
        boolean payNow = adminDirect ? false : shouldPayImmediately(paymentMethod, request.payNow);
        b.setPaymentMethod(paymentMethod);
        b.setPaymentChannel(paymentChannel);
        b.setStatus(resolveInitialStatus(paymentMethod));
        b.setPaymentStatus(adminDirect ? "WAIVED" : "UNPAID");
        b.setCurrency("CNY");
        if (request.contactName != null && !request.contactName.trim().isEmpty()) {
            b.setContactName(request.contactName.trim());
        } else if (request.contactPhone != null) {
            // 如果没有提供联系人姓名，使用电话号码作为默认值
            b.setContactName(request.contactPhone.trim());
        }
        if (request.contactPhone != null) {
            b.setContactPhone(request.contactPhone.trim());
        }
        if (request.remark != null) {
            b.setRemark(request.remark.trim());
        }
        bookingService.save(b);
        allocated.setStatus(2);
        allocated.setUpdatedTime(LocalDateTime.now());
        roomInstanceService.updateById(allocated);
        // payment handling
        if (payNow) {
            if ("WALLET".equals(paymentMethod)) {
                try {
                    WalletTransaction tx = walletService.consume(actualUserId, payableAmount, paymentChannel, b.getId(), "酒店预订扣款");
                    b.setWalletTransactionId(tx.getId());
                    b.setPaidAmount(payableAmount);
                    b.setPaymentStatus("PAID");
                    b.setStatus("PENDING_CONFIRMATION");
                } catch (IllegalStateException ex) {
                    throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, ex.getMessage());
                } catch (IllegalArgumentException ex) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
                }
            } else if ("ONLINE".equals(paymentMethod) || "DIRECT".equals(paymentMethod) || "POS".equals(paymentMethod)) {
                PaymentRecord record = paymentService.recordDirectPayment(b.getId(), actualUserId, payableAmount, paymentMethod, paymentChannel, request.referenceNo);
                b.setPaymentRecordId(record.getId());
                b.setPaidAmount(payableAmount);
                b.setPaymentStatus("PAID");
                b.setStatus("PENDING_CONFIRMATION");
            } else {
                // default treat as direct payment but keep unpaid to be confirmed later
                b.setPaymentStatus("UNPAID");
            }
        } else if ("ARRIVAL".equals(paymentMethod)) {
            b.setStatus("PENDING_PAYMENT");
        } else if (adminDirect) {
            b.setPaymentStatus("WAIVED");
            b.setStatus("CONFIRMED");
            b.setPaidAmount(BigDecimal.ZERO);
        }
        bookingService.updateById(b);
        // decrement availableCount (simplified, not handling overlapping bookings)
        r.setAvailableCount(Math.max(0, r.getAvailableCount() - 1));
        roomService.updateById(r);
        return b;
    }

    // availability for a room within time range
    @GetMapping("/{id}/availability")
    @org.springframework.cache.annotation.Cacheable(value = "roomAvailabilityCache", key = "#id + ':start_' + #start.toString() + ':end_' + #end.toString()")
    public Map<String, Object> availability(@PathVariable Long id,
                                            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
                                            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        if (!start.isBefore(end)) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "开始时间必须早于结束时间");
        Room r = roomService.getById(id);
        if (r == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "房型不存在");
        long overlapping = bookingService.count(new LambdaQueryWrapper<Booking>()
                .eq(Booking::getRoomId, id)
                .ne(Booking::getStatus, "CHECKED_OUT")
                .ne(Booking::getStatus, "CANCELLED")
                .lt(Booking::getStartTime, end)
                .gt(Booking::getEndTime, start)
        );
        long availableCount = Math.max(0, r.getTotalCount() - overlapping);
        return Map.of(
                "available", availableCount > 0,
                "availableCount", availableCount
        );
    }

    // admin confirms check-in
    @PutMapping("/bookings/{bookingId}/confirm")
    public Booking confirm(@PathVariable Long bookingId) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !me.getRole().equals("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }
        Booking b = bookingService.getById(bookingId);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        b.setStatus("CONFIRMED");
        bookingService.updateById(b);
        return b;
    }

    // admin checkout
    @PutMapping("/bookings/{bookingId}/checkout")
    @org.springframework.cache.annotation.CacheEvict(value = {"dynamicRoomListCache", "roomOccupancyCache", "roomTimelineCache", "roomAvailabilityCache", "roomInstancesCache", "roomInstancesByTypeCache", "roomInfoCache"}, allEntries = true)
    public Booking checkout(@PathVariable Long bookingId) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null || me.getRole() == null || !me.getRole().equals("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }
        Booking b = bookingService.getById(bookingId);
        if (b == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预订不存在");
        b.setStatus("CHECKED_OUT");
        bookingService.updateById(b);
        Room r = roomService.getById(b.getRoomId());
        if (r != null) {
            r.setAvailableCount(r.getAvailableCount() + 1);
            roomService.updateById(r);
        }
        return b;
    }

    private Long resolveOrCreateUser(String contactPhone) {
        if (contactPhone == null || contactPhone.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "管理员代客预约需提供客户联系电话");
        }
        String phone = contactPhone.trim();

        // 首先通过电话号码查找用户
        User existing = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getPhone, phone));
        if (existing != null) {
            return existing.getId();
        }

        // 如果不存在，则创建新用户
        // 用户名和密码都默认为电话号码
        User u = new User();
        u.setUsername(phone);  // 用户名默认为电话号码
        u.setPassword(phone);  // 密码默认为电话号码
        u.setRole("USER");
        u.setVipLevel(0);
        u.setPhone(phone);
        u.setStatus("ACTIVE");

        try {
            userMapper.insert(u);
        } catch (Exception e) {
            // 如果插入失败（可能是用户名重复但电话号码不同的情况），尝试用电话号码+随机数作为用户名
            String alternativeUsername = phone + "_" + System.currentTimeMillis();
            u.setUsername(alternativeUsername);
            userMapper.insert(u);
        }

        if (u.getId() == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "创建用户失败");
        }
        return u.getId();
    }

    private long computeChargeableDays(LocalDateTime start, LocalDateTime end, Integer checkoutHour) {
        if (start == null || end == null) {
            return 1L;
        }
        if (!start.isBefore(end)) {
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

    private String normalizePaymentMethod(String raw) {
        if (raw == null || raw.isBlank()) {
            return "WALLET";
        }
        String method = raw.trim().toUpperCase();
        if ("ONLINE".equals(method) || "ARRIVAL".equals(method) || "WALLET".equals(method) || "ADMIN".equals(method)) {
            return method;
        }
        if ("DIRECT".equals(method) || "POS".equals(method)) {
            return "ARRIVAL";
        }
        return "WALLET";
    }

    private String resolvePaymentChannel(String paymentMethod, String rawChannel) {
        if ("WALLET".equals(paymentMethod)) {
            return "WALLET";
        }
        if ("ARRIVAL".equals(paymentMethod)) {
            return "ARRIVAL";
        }
        if ("ADMIN".equals(paymentMethod)) {
            return "ADMIN";
        }
        String candidate = rawChannel == null ? "ONLINE" : rawChannel.trim().toUpperCase();
        switch (candidate) {
            case "WECHAT":
            case "ALIPAY":
            case "PAYPAL":
            case "VISA":
            case "MASTERCARD":
            case "UNIONPAY":
                return candidate;
            default:
                return "ONLINE";
        }
    }

    private boolean shouldPayImmediately(String paymentMethod, Boolean payNowFlag) {
        if ("ARRIVAL".equals(paymentMethod) || "ADMIN".equals(paymentMethod)) {
            return false;
        }
        if (payNowFlag == null) {
            return true;
        }
        return Boolean.TRUE.equals(payNowFlag);
    }

    private String resolveInitialStatus(String paymentMethod) {
        if ("ARRIVAL".equals(paymentMethod)) {
            return "PENDING_PAYMENT";
        }
        if ("ADMIN".equals(paymentMethod)) {
            return "CONFIRMED";
        }
        return "PENDING_CONFIRMATION";
    }

    public static class BookRoomRequest {
        public Long userId;
        public Long hotelId;
        public Integer guests;
        public String contactName;
        public String contactPhone;
        public String remark;
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss", timezone = "Asia/Shanghai")
        public LocalDateTime start;
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss", timezone = "Asia/Shanghai")
        public LocalDateTime end;
        public String paymentMethod;
        public String paymentChannel;
        public Boolean payNow;
        public String referenceNo;
    }

    private Map<Long, InventoryMetrics> aggregateInventoryByRoomType(Set<Long> roomTypeIds) {
        if (roomTypeIds == null || roomTypeIds.isEmpty()) {
            return java.util.Collections.emptyMap();
        }
        List<RoomInstance> instances = roomInstanceService.lambdaQuery()
                .in(RoomInstance::getRoomTypeId, roomTypeIds)
                .select(RoomInstance::getRoomTypeId, RoomInstance::getStatus)
                .list();
        Map<Long, InventoryAccumulator> accumulatorMap = new HashMap<>();
        for (RoomInstance instance : instances) {
            if (instance == null || instance.getRoomTypeId() == null) {
                continue;
            }
            InventoryAccumulator acc = accumulatorMap.computeIfAbsent(instance.getRoomTypeId(), key -> new InventoryAccumulator());
            acc.totalRooms++;
            int status = instance.getStatus() == null ? 0 : instance.getStatus();
            if (status == 1) {
                acc.availableRooms++;
            }
        }
        Map<Long, InventoryMetrics> result = new HashMap<>();
        accumulatorMap.forEach((roomTypeId, acc) -> result.put(roomTypeId, acc.toMetrics()));
        return result;
    }

    private static final class InventoryAccumulator {
        private int totalRooms;
        private int availableRooms;

        private InventoryMetrics toMetrics() {
            int total = Math.max(0, totalRooms);
            int available = Math.max(0, Math.min(availableRooms, total));
            return new InventoryMetrics(total, available);
        }
    }

    private record InventoryMetrics(int totalRooms, int availableRooms) {
    }
}
