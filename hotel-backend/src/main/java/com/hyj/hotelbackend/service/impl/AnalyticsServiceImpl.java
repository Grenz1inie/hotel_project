package com.hyj.hotelbackend.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hyj.hotelbackend.dto.analytics.VacancyAnalyticsResponse;
import com.hyj.hotelbackend.entity.Booking;
import com.hyj.hotelbackend.entity.Room;
import com.hyj.hotelbackend.entity.RoomInstance;
import com.hyj.hotelbackend.entity.VacancyStatistics;
import com.hyj.hotelbackend.service.AnalyticsService;
import com.hyj.hotelbackend.service.BookingService;
import com.hyj.hotelbackend.service.RoomInstanceService;
import com.hyj.hotelbackend.service.RoomService;
import com.hyj.hotelbackend.service.VacancyStatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsServiceImpl implements AnalyticsService {

    private final BookingService bookingService;
    private final RoomService roomService;
    private final RoomInstanceService roomInstanceService;
    private final VacancyStatisticsService vacancyStatisticsService;
    private final RedisTemplate<String, Object> redisTemplate;

    private static final String DASHBOARD_CACHE_KEY = "analytics:dashboard:vacancy";

    private enum Granularity {
        HOUR, DAY;

        public static Granularity from(String raw) {
            if (raw == null || raw.isBlank()) {
                return DAY;
            }
            try {
                return Granularity.valueOf(raw.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                return DAY;
            }
        }

        public long stepAmount() {
            return 1;
        }

        public ChronoUnit unit() {
            return this == HOUR ? ChronoUnit.HOURS : ChronoUnit.DAYS;
        }

        public LocalDateTime alignStart(LocalDateTime dateTime) {
            if (dateTime == null) {
                return null;
            }
            if (this == HOUR) {
                return dateTime.truncatedTo(ChronoUnit.HOURS);
            }
            return dateTime.toLocalDate().atStartOfDay();
        }
    }

    @Scheduled(fixedRate = 300000)
    public void warmupDashboardAnalytics() {
        try {
            // 参数全部传 null，代表生成全量默认的看板视图
            VacancyAnalyticsResponse response = calculateVacancyAnalytics(null, null, null, null, null, null, null);
            redisTemplate.opsForValue().set(DASHBOARD_CACHE_KEY, response);
            System.out.println("成功预热统计看板数据到 Redis");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public VacancyAnalyticsResponse getVacancyAnalytics(List<Long> roomTypeIds,
                                                        LocalDateTime rawStart,
                                                        LocalDateTime rawEnd,
                                                        String granularity,
                                                        Double thresholdHigh,
                                                        Double thresholdLow,
                                                        Integer forecastDays) {
        // 如果是前端默认看板请求（全 null 参数）
        if (CollectionUtils.isEmpty(roomTypeIds) && rawStart == null && rawEnd == null && granularity == null 
               && thresholdHigh == null && thresholdLow == null && forecastDays == null) {
            Object cached = redisTemplate.opsForValue().get(DASHBOARD_CACHE_KEY);
            if (cached instanceof VacancyAnalyticsResponse) {
                return (VacancyAnalyticsResponse) cached;
            }
            // 优雅降级：如果不存在则当即计算并写回 Redis
            VacancyAnalyticsResponse response = calculateVacancyAnalytics(null, null, null, null, null, null, null);
            redisTemplate.opsForValue().set(DASHBOARD_CACHE_KEY, response);
            return response;
        }

        // 自定义条件的查询，不走总体缓存，依然查库
        return calculateVacancyAnalytics(roomTypeIds, rawStart, rawEnd, granularity, thresholdHigh, thresholdLow, forecastDays);
    }

    private VacancyAnalyticsResponse calculateVacancyAnalytics(List<Long> roomTypeIds,
                                                        LocalDateTime rawStart,
                                                        LocalDateTime rawEnd,
                                                        String granularity,
                                                        Double thresholdHigh,
                                                        Double thresholdLow,
                                                        Integer forecastDays) {
        Granularity g = Granularity.from(granularity);
        LocalDateTime start = g.alignStart(rawStart != null ? rawStart : defaultStart(g));
        LocalDateTime end = g.alignStart(rawEnd != null ? rawEnd : defaultEnd(g));
        if (end.isBefore(start)) {
            LocalDateTime tmp = start;
            start = end;
            end = tmp;
        }
        Double high = thresholdHigh != null ? thresholdHigh : 0.7d;
        Double low = thresholdLow != null ? thresholdLow : 0.2d;
        int forecast = forecastDays != null ? Math.max(forecastDays, 0) : (g == Granularity.DAY ? 14 : 2);

        List<Room> rooms = resolveRooms(roomTypeIds);
        LinkedHashSet<Long> roomTypeIdSet = rooms.stream()
                .map(Room::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, InventorySnapshot> inventorySnapshotMap = loadInventory(roomTypeIdSet);
        rooms.forEach(room -> {
            InventorySnapshot snapshot = room.getId() == null ? null : inventorySnapshotMap.get(room.getId());
            if (snapshot != null) {
                room.setTotalCount(snapshot.totalRooms());
                room.setAvailableCount(snapshot.availableRooms());
            }
        });
        if (roomTypeIdSet.isEmpty()) {
            VacancyAnalyticsResponse empty = new VacancyAnalyticsResponse();
            empty.setGranularity(g.name());
            empty.setStart(start);
            empty.setEnd(end);
            return empty;
        }

        LocalDateTime queryStart = start.minus(g == Granularity.HOUR ? Duration.ofHours(1) : Duration.ofDays(1));
        LocalDateTime queryEnd = end.plus(g == Granularity.HOUR ? Duration.ofHours(forecast + 1) : Duration.ofDays(forecast + 1));
        List<Booking> bookings = bookingService.list(new LambdaQueryWrapper<Booking>()
                .in(!roomTypeIdSet.isEmpty(), Booking::getRoomTypeId, roomTypeIdSet)
                .lt(Booking::getStartTime, queryEnd)
                .gt(Booking::getEndTime, queryStart));

        Map<Long, List<Booking>> bookingsByRoomType = bookings.stream()
                .collect(Collectors.groupingBy(Booking::getRoomTypeId));

        VacancyAnalyticsResponse resp = new VacancyAnalyticsResponse();
        resp.setGranularity(g.name());
        resp.setStart(start);
        resp.setEnd(end);
        resp.setEvents(eventMarkersBetween(start, end));

        List<VacancyAnalyticsResponse.ThresholdAlert> alerts = new ArrayList<>();

        for (Room room : rooms) {
            List<Booking> roomBookings = new ArrayList<>(bookingsByRoomType.getOrDefault(room.getId(), java.util.Collections.emptyList()));
            roomBookings.sort(Comparator.comparing(Booking::getStartTime));
            VacancyAnalyticsResponse.VacancySeries series = new VacancyAnalyticsResponse.VacancySeries();
            series.setRoomTypeId(room.getId());
            series.setRoomTypeName(room.getName());
            InventorySnapshot rawSnapshot = room.getId() == null ? null : inventorySnapshotMap.get(room.getId());
            int fallbackTotal = room.getTotalCount() == null ? 0 : room.getTotalCount();
            int fallbackAvailable = room.getAvailableCount() == null ? fallbackTotal : room.getAvailableCount();
            InventorySnapshot snapshot = rawSnapshot != null ? rawSnapshot : new InventorySnapshot(
                    fallbackTotal,
                    Math.min(fallbackAvailable, fallbackTotal),
                    Math.max(0, fallbackTotal - fallbackAvailable),
                    0,
                    0,
                    0
            );
            room.setTotalCount(snapshot.totalRooms());
            room.setAvailableCount(snapshot.availableRooms());

            series.setTotalRooms(snapshot.totalRooms());
            series.setInventorySnapshot(snapshot.toMap());

            List<VacancyAnalyticsResponse.VacancyPoint> actualPoints = buildPoints(room, roomBookings, start, end, g, high, low, alerts, snapshot);
            if (!actualPoints.isEmpty()) {
                series.getPoints().addAll(actualPoints);
            }
            if (forecast > 0) {
                List<VacancyAnalyticsResponse.VacancyPoint> forecasts = forecastPoints(actualPoints, room, g, forecast);
                if (!forecasts.isEmpty()) {
                    series.getPoints().addAll(forecasts);
                }
            }
            resp.getSeries().add(series);
        }

        resp.getAlerts().addAll(alerts);
        resp.getSeries().sort(Comparator.comparing(VacancyAnalyticsResponse.VacancySeries::getRoomTypeId));
        return resp;
    }

    private List<VacancyAnalyticsResponse.VacancyPoint> buildPoints(Room room,
                                                                    List<Booking> roomBookings,
                                                                    LocalDateTime start,
                                                                    LocalDateTime end,
                                                                    Granularity granularity,
                                                                    double thresholdHigh,
                                                                    double thresholdLow,
                                    List<VacancyAnalyticsResponse.ThresholdAlert> alertsOut,
                                    InventorySnapshot snapshot) {
        List<VacancyAnalyticsResponse.VacancyPoint> points = new ArrayList<>();
        int totalRooms = snapshot != null ? snapshot.totalRooms() : (room.getTotalCount() == null ? 0 : room.getTotalCount());
        if (totalRooms <= 0) {
            return points;
        }
        
        // 尝试从数据库读取历史统计数据
        LocalDate today = LocalDate.now();
        LocalDate startDate = start.toLocalDate();
        LocalDate endDate = end.toLocalDate();
        
        // 对于历史数据（今天之前），优先从数据库读取
        Map<String, VacancyStatistics> statsMap = new HashMap<>();
        if (startDate.isBefore(today)) {
            LocalDate historyEndDate = endDate.isBefore(today) ? endDate : today.minusDays(1);
            List<VacancyStatistics> historyStats = vacancyStatisticsService.queryStatistics(
                    java.util.Collections.singletonList(room.getId()),
                    startDate,
                    historyEndDate,
                    granularity == Granularity.HOUR
            );
            
            // 构建缓存Map，key = "date_hour" 或 "date" (全天统计)
            for (VacancyStatistics stat : historyStats) {
                String key = stat.getStatDate().toString();
                if (stat.getStatHour() != null) {
                    key += "_" + stat.getStatHour();
                }
                statsMap.put(key, stat);
            }
        }
    
        // 计算可售房间数 = 总数 - 维护中 - 锁定
        int maintenanceRooms = snapshot != null ? snapshot.maintenanceRooms() : 0;
        int lockedRooms = snapshot != null ? snapshot.lockedRooms() : 0;
        int sellableRooms = totalRooms - maintenanceRooms - lockedRooms;
        sellableRooms = Math.max(0, sellableRooms);
        
        int availableRooms = snapshot != null ? snapshot.availableRooms() : (room.getAvailableCount() == null ? sellableRooms : room.getAvailableCount());
        availableRooms = Math.min(availableRooms, sellableRooms);
        
        // 只对"当前时间之后"的时间点使用 baselineOccupied
        LocalDateTime now = LocalDateTime.now();
        int baselineOccupied = Math.max(0, sellableRooms - availableRooms);
        
        LocalDateTime cursor = start;
        while (!cursor.isAfter(end)) {
            final LocalDateTime slotStart = cursor;
            LocalDateTime slotEnd = slotStart.plus(granularity.stepAmount(), granularity.unit());
            VacancyAnalyticsResponse.VacancyPoint point = new VacancyAnalyticsResponse.VacancyPoint();
            point.setTimestamp(slotStart);
            
            // 尝试从缓存的统计数据中读取
            String cacheKey = slotStart.toLocalDate().toString();
            if (granularity == Granularity.HOUR) {
                cacheKey += "_" + slotStart.getHour();
            }
            
            VacancyStatistics cachedStat = statsMap.get(cacheKey);
            
            if (cachedStat != null && slotStart.toLocalDate().isBefore(today)) {
                // 使用数据库中的历史数据
                point.setVacancyCount(cachedStat.getVacancyCount().doubleValue());
                point.setVacancyRate(round(cachedStat.getVacancyRate().doubleValue()));
                point.setBookingRate(round(cachedStat.getBookingRate().doubleValue()));
                point.setAveragePrice(cachedStat.getAveragePrice());
                point.setPriceStrategy(calculatePriceStrategy(cachedStat.getAveragePrice(), room.getPricePerNight()));
                
                // 状态和来源分类需要实时计算（或者后续也可以存到数据库）
                List<Booking> overlapping = roomBookings.stream()
                        .filter(b -> isActiveStatus(b.getStatus()))
                        .filter(b -> overlaps(b.getStartTime(), b.getEndTime(), slotStart, slotEnd))
                        .collect(Collectors.toList());
                point.setStatusBreakdown(buildStatusBreakdown(overlapping));
                point.setSourceBreakdown(buildSourceBreakdown(overlapping));
                
                // 评估预警
                evaluateAlert(room, slotStart, slotEnd, cachedStat.getVacancyRate().doubleValue(), 
                             thresholdHigh, thresholdLow, alertsOut);
            } else {
                // 实时计算（今天及未来的数据）
                List<Booking> overlapping = roomBookings.stream()
                        .filter(b -> isActiveStatus(b.getStatus()))
                        .filter(b -> overlaps(b.getStartTime(), b.getEndTime(), slotStart, slotEnd))
                        .collect(Collectors.toList());

                // 计算实际占用的房间数
                long bookingsWithRoomId = overlapping.stream()
                        .map(Booking::getRoomId)
                        .filter(Objects::nonNull)
                        .distinct()
                        .count();
                long bookingsWithoutRoomId = overlapping.stream()
                        .filter(b -> b.getRoomId() == null)
                        .count();
                int bookingOccupancy = (int) (bookingsWithRoomId + bookingsWithoutRoomId);
                
                int occupied;
                if (slotStart.isBefore(now)) {
                    occupied = bookingOccupancy;
                } else {
                    occupied = Math.max(baselineOccupied, bookingOccupancy);
                }
                occupied = Math.min(occupied, sellableRooms);
                
                double vacancyCount = Math.max(sellableRooms - occupied, 0);
                double vacancyRate = sellableRooms == 0 ? 0d : vacancyCount / sellableRooms;
                double bookingRate = sellableRooms == 0 ? 0d : Math.min(occupied / (double) sellableRooms, 1d);

                point.setVacancyCount(vacancyCount);
                point.setVacancyRate(round(vacancyRate));
                point.setBookingRate(round(bookingRate));
                point.setAveragePrice(calculateAveragePrice(overlapping));
                point.setPriceStrategy(calculatePriceStrategy(point.getAveragePrice(), room.getPricePerNight()));
                point.setStatusBreakdown(buildStatusBreakdown(overlapping));
                point.setSourceBreakdown(buildSourceBreakdown(overlapping));

                evaluateAlert(room, slotStart, slotEnd, vacancyRate, thresholdHigh, thresholdLow, alertsOut);
            }

            points.add(point);
            cursor = slotEnd;
        }
        return points;
    }

    private Map<Long, InventorySnapshot> loadInventory(Set<Long> roomTypeIds) {
        if (CollectionUtils.isEmpty(roomTypeIds)) {
            return java.util.Collections.emptyMap();
        }
        List<RoomInstance> instances = roomInstanceService.lambdaQuery()
                .in(RoomInstance::getRoomTypeId, roomTypeIds)
                .list();
        if (CollectionUtils.isEmpty(instances)) {
            return java.util.Collections.emptyMap();
        }
        Map<Long, InventoryAccumulator> accumulatorMap = new HashMap<>();
        for (RoomInstance instance : instances) {
            if (instance == null || instance.getRoomTypeId() == null) {
                continue;
            }
            InventoryAccumulator acc = accumulatorMap.computeIfAbsent(instance.getRoomTypeId(), key -> new InventoryAccumulator());
            acc.totalRooms++;
            int status = instance.getStatus() == null ? 0 : instance.getStatus();
            switch (status) {
                case 1 -> acc.availableRooms++;
                case 2 -> acc.reservedRooms++;
                case 3 -> acc.occupiedRooms++;
                case 5 -> acc.maintenanceRooms++;
                default -> acc.lockedRooms++;
            }
        }
        Map<Long, InventorySnapshot> result = new HashMap<>();
        accumulatorMap.forEach((roomTypeId, acc) -> result.put(roomTypeId, acc.toSnapshot()));
        return result;
    }

    private boolean overlaps(LocalDateTime bookingStart, LocalDateTime bookingEnd, LocalDateTime slotStart, LocalDateTime slotEnd) {
        return bookingStart.isBefore(slotEnd) && bookingEnd.isAfter(slotStart);
    }

    private boolean isActiveStatus(String status) {
        if (status == null) return false;
        String s = status.toUpperCase(Locale.ROOT);
        return !("CANCELLED".equals(s) || "REFUNDED".equals(s) || "CHECKED_OUT".equals(s));
    }

    private BigDecimal calculateAveragePrice(List<Booking> overlapping) {
        if (CollectionUtils.isEmpty(overlapping)) {
            return BigDecimal.ZERO;
        }
        BigDecimal total = BigDecimal.ZERO;
        int nightsSum = 0;
        for (Booking booking : overlapping) {
            if (booking.getAmount() == null) continue;
            long nights = Math.max(1, Duration.between(booking.getStartTime(), booking.getEndTime()).toHours() / 24);
            total = total.add(booking.getAmount());
            nightsSum += nights;
        }
        if (nightsSum == 0) {
            return total.setScale(2, RoundingMode.HALF_UP);
        }
        return total.divide(BigDecimal.valueOf(nightsSum), 2, RoundingMode.HALF_UP);
    }

    private String calculatePriceStrategy(BigDecimal avgPrice, BigDecimal basePrice) {
        if (avgPrice == null || basePrice == null || basePrice.compareTo(BigDecimal.ZERO) <= 0) {
            return "标准价";
        }
        BigDecimal ratio = avgPrice.divide(basePrice, 4, RoundingMode.HALF_UP);
        if (ratio.compareTo(BigDecimal.valueOf(1.1)) >= 0) {
            return "高峰价";
        }
        if (ratio.compareTo(BigDecimal.valueOf(0.9)) <= 0) {
            return "折扣价";
        }
        return "标准价";
    }

    private Map<String, Integer> buildStatusBreakdown(List<Booking> bookings) {
        Map<String, Integer> map = new HashMap<>();
        for (Booking booking : bookings) {
            String key = booking.getStatus() == null ? "UNKNOWN" : booking.getStatus().toUpperCase(Locale.ROOT);
            map.merge(key, 1, (a, b) -> a + b);        }
        return map;
    }

    private Map<String, Integer> buildSourceBreakdown(List<Booking> bookings) {
        Map<String, Integer> map = new HashMap<>();
        for (Booking booking : bookings) {
            String source = "DIRECT";
            if (booking.getContactPhone() != null) {
                if (booking.getContactPhone().startsWith("13")) {
                    source = "OTA";
                } else if (booking.getContactPhone().startsWith("15")) {
                    source = "企业协议";
                }
            }
            map.merge(source, 1, (a, b) -> a + b);
        }
        return map;
    }

    private void evaluateAlert(Room room,
                               LocalDateTime slotStart,
                               LocalDateTime slotEnd,
                               double vacancyRate,
                               double thresholdHigh,
                               double thresholdLow,
                               List<VacancyAnalyticsResponse.ThresholdAlert> alertsOut) {
        // 只在空置率真正超出阈值时才触发警告
        // HIGH: 空置率 > 阈值（不包括等于）
        // LOW: 空置率 < 阈值（不包括等于）
        if (vacancyRate > thresholdHigh) {
            alertsOut.add(buildAlert(room, slotStart, slotEnd, "HIGH", thresholdHigh, vacancyRate,
                    "空置率高于阈值"));
        } else if (vacancyRate < thresholdLow) {
            alertsOut.add(buildAlert(room, slotStart, slotEnd, "LOW", thresholdLow, vacancyRate,
                    "空置率低于阈值"));
        }
    }

    private VacancyAnalyticsResponse.ThresholdAlert buildAlert(Room room,
                                                                LocalDateTime start,
                                                                LocalDateTime end,
                                                                String level,
                                                                double threshold,
                                                                double actual,
                                                                String reason) {
        VacancyAnalyticsResponse.ThresholdAlert alert = new VacancyAnalyticsResponse.ThresholdAlert();
        alert.setRoomTypeId(room.getId());
        alert.setRoomTypeName(room.getName());
        alert.setStart(start);
        alert.setEnd(end);
        alert.setLevel(level);
        alert.setThreshold(round(threshold));
        alert.setActual(round(actual));
        alert.setReason(reason);
        return alert;
    }

    private List<VacancyAnalyticsResponse.EventMarker> eventMarkersBetween(LocalDateTime start, LocalDateTime end) {
        List<VacancyAnalyticsResponse.EventMarker> events = new ArrayList<>();
        List<EventSeed> seeds = defaultEventSeeds();
        for (EventSeed seed : seeds) {
            // 检查事件区间是否与查询区间有交集
            boolean overlaps = !seed.endDate.isBefore(start.toLocalDate()) && 
                             !seed.startDate.isAfter(end.toLocalDate());
            
            if (overlaps) {
                VacancyAnalyticsResponse.EventMarker marker = new VacancyAnalyticsResponse.EventMarker();
                marker.setTimestamp(seed.startDate.atStartOfDay());
                marker.setEndTimestamp(seed.endDate.atTime(23, 59, 59)); // 设置结束时间为当天最后一刻
                marker.setTitle(seed.title);
                marker.setDescription(seed.description);
                marker.setCategory(seed.category);
                events.add(marker);
            }
        }
        return events;
    }

    private List<EventSeed> defaultEventSeeds() {
        List<EventSeed> seeds = new ArrayList<>();
        LocalDate now = LocalDate.now();
        
        // 多天节假日（开始日期 -> 结束日期）
        seeds.add(new EventSeed(
            now.withMonth(10).withDayOfMonth(1), 
            now.withMonth(10).withDayOfMonth(7), 
            "国庆黄金周", 
            "旅客高峰，建议提前备房", 
            "节假日"
        ));
        
        seeds.add(new EventSeed(
            now.withMonth(5).withDayOfMonth(1), 
            now.withMonth(5).withDayOfMonth(5), 
            "五一假期", 
            "短途旅行热，关注家庭房型", 
            "节假日"
        ));
        
        seeds.add(new EventSeed(
            now.withMonth(1).withDayOfMonth(1), 
            now.withMonth(1).withDayOfMonth(3), 
            "元旦假期", 
            "新年出游，酒店预订高峰", 
            "节假日"
        ));
        
        seeds.add(new EventSeed(
            now.withMonth(6).withDayOfMonth(10), 
            now.withMonth(6).withDayOfMonth(12), 
            "端午假期", 
            "家庭旅游热门时段", 
            "节假日"
        ));
        
        seeds.add(new EventSeed(
            now.withMonth(9).withDayOfMonth(15), 
            now.withMonth(9).withDayOfMonth(17), 
            "中秋假期", 
            "团圆出游，酒店需求旺盛", 
            "节假日"
        ));
        
        // 单天活动事件
        seeds.add(new EventSeed(
            now.withMonth(11).withDayOfMonth(11), 
            now.withMonth(11).withDayOfMonth(11), 
            "双十一营销", 
            "线上促销活动", 
            "促销"
        ));
        
        seeds.add(new EventSeed(
            now.withMonth(3).withDayOfMonth(18), 
            now.withMonth(3).withDayOfMonth(20), 
            "春季家装展", 
            "商旅客人集中", 
            "展会"
        ));
        
        return seeds;
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP).doubleValue();
    }

    private List<VacancyAnalyticsResponse.VacancyPoint> forecastPoints(List<VacancyAnalyticsResponse.VacancyPoint> actualPoints,
                                                                       Room room,
                                                                       Granularity granularity,
                                                                       int horizon) {
        List<VacancyAnalyticsResponse.VacancyPoint> result = new ArrayList<>();
        if (CollectionUtils.isEmpty(actualPoints)) {
            return result;
        }
        
        // 使用更多历史数据点来计算趋势（最多取最后10个点）
        int window = Math.min(10, actualPoints.size());
        List<VacancyAnalyticsResponse.VacancyPoint> recentPoints = actualPoints.subList(
            Math.max(actualPoints.size() - window, 0), 
            actualPoints.size()
        );
        
        // 计算线性趋势（使用简单线性回归）
        double[] vacancyTrend = calculateLinearTrend(recentPoints, VacancyAnalyticsResponse.VacancyPoint::getVacancyRate);
        
        // 计算基准值（使用最近几个点的平均值，而不是最后一个点）
        double baseVacancy = recentPoints.stream()
            .mapToDouble(VacancyAnalyticsResponse.VacancyPoint::getVacancyRate)
            .average()
            .orElse(0.5);
        
        // 添加随机波动因子（模拟真实场景的不确定性）
        double volatility = calculateVolatility(recentPoints, VacancyAnalyticsResponse.VacancyPoint::getVacancyRate);
        volatility = Math.max(0.03, volatility); // 至少保持3%的波动率
        
        // 趋势衰减因子：越远期的预测，趋势影响越小
        double trendDecayRate = 0.95;
        
        LocalDateTime cursor = actualPoints.get(actualPoints.size() - 1).getTimestamp()
            .plus(granularity.stepAmount(), granularity.unit());
        
        for (int i = 0; i < horizon; i++) {
            VacancyAnalyticsResponse.VacancyPoint point = new VacancyAnalyticsResponse.VacancyPoint();
            point.setTimestamp(cursor);
            point.setForecast(true);
            
            // 趋势调整：随着时间推移逐渐衰减
            double trendWeight = Math.pow(trendDecayRate, i);
            double trendAdjustment = (vacancyTrend[0] * (i + 1)) * trendWeight;
            
            // 周期性因子（模拟周末效应和月度周期）
            double periodicFactor = 1.0;
            if (granularity == Granularity.DAY) {
                int dayOfWeek = cursor.getDayOfWeek().getValue();
                // 周五(5)、周六(6)、周日(7) 预订率更高，空置率更低
                if (dayOfWeek >= 5 && dayOfWeek <= 7) {
                    periodicFactor = 0.80; // 周末空置率降低20%
                } else if (dayOfWeek <= 2) {
                    periodicFactor = 1.15; // 周初空置率略高15%
                } else {
                    periodicFactor = 1.05; // 周中略高5%
                }
            }
            
            // 多频率波动：结合快速波动和慢速波动
            double fastWave = Math.sin(i * 0.8) * 0.15;  // 快速波动，幅度±15%
            double slowWave = Math.cos(i * 0.3) * 0.08;  // 慢速波动，幅度±8%
            double mediumWave = Math.sin(i * 0.5 + 1.2) * 0.10; // 中速波动，幅度±10%
            
            // 叠加波动，使用波动率作为振幅系数
            double waveFactor = 1.0 + (fastWave + slowWave + mediumWave) * (volatility / 0.1);
            
            // 均值回归：远期预测逐渐回归到历史平均值
            double historicalMean = recentPoints.stream()
                .mapToDouble(VacancyAnalyticsResponse.VacancyPoint::getVacancyRate)
                .average()
                .orElse(0.5);
            double meanReversionWeight = Math.min(0.3, i * 0.02); // 逐步增加均值回归权重
            
            // 计算预测值
            double forecastVacancy = baseVacancy + trendAdjustment;
            forecastVacancy = forecastVacancy * periodicFactor * waveFactor;
            
            // 应用均值回归
            forecastVacancy = forecastVacancy * (1 - meanReversionWeight) + historicalMean * meanReversionWeight;
            
            // 限制在合理范围[0.1, 0.9]，避免极端值
            forecastVacancy = Math.max(0.10, Math.min(0.90, forecastVacancy));
            
            double forecastBooking = 1.0 - forecastVacancy;
            forecastBooking = Math.max(0.10, Math.min(0.90, forecastBooking));
            
            int totalRooms = room.getTotalCount() != null ? room.getTotalCount() : 0;
            double forecastCount = totalRooms * forecastVacancy;
            
            point.setVacancyRate(round(forecastVacancy));
            point.setBookingRate(round(forecastBooking));
            point.setVacancyCount(round(forecastCount));
            point.setAveragePrice(BigDecimal.ZERO);
            point.setPriceStrategy("预测");
            result.add(point);
            cursor = cursor.plus(granularity.stepAmount(), granularity.unit());
        }
        return result;
    }
    
    /**
     * 计算线性趋势：返回 [slope, intercept]
     * 使用简单线性回归: y = slope * x + intercept
     */
    private double[] calculateLinearTrend(List<VacancyAnalyticsResponse.VacancyPoint> points, 
                                          java.util.function.ToDoubleFunction<VacancyAnalyticsResponse.VacancyPoint> valueExtractor) {
        if (points.size() < 2) {
            return new double[]{0.0, 0.0};
        }
        
        int n = points.size();
        double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        for (int i = 0; i < n; i++) {
            double x = i; // 时间索引
            double y = valueExtractor.applyAsDouble(points.get(i));
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        }
        
        double denominator = n * sumX2 - sumX * sumX;
        if (Math.abs(denominator) < 1e-10) {
            return new double[]{0.0, sumY / n};
        }
        
        double slope = (n * sumXY - sumX * sumY) / denominator;
        double intercept = (sumY - slope * sumX) / n;
        
        return new double[]{slope, intercept};
    }
    
    /**
     * 计算波动率（标准差）
     */
    private double calculateVolatility(List<VacancyAnalyticsResponse.VacancyPoint> points,
                                       java.util.function.ToDoubleFunction<VacancyAnalyticsResponse.VacancyPoint> valueExtractor) {
        if (points.size() < 2) {
            return 0.05; // 默认5%波动率
        }
        
        double mean = points.stream().mapToDouble(valueExtractor).average().orElse(0.0);
        double variance = points.stream()
            .mapToDouble(valueExtractor)
            .map(v -> Math.pow(v - mean, 2))
            .average()
            .orElse(0.0);
        
        return Math.sqrt(variance);
    }

    private List<Room> resolveRooms(List<Long> roomTypeIds) {
        if (!CollectionUtils.isEmpty(roomTypeIds)) {
            return roomService.listByIds(roomTypeIds).stream()
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
        }
        return roomService.list().stream()
                .filter(room -> room.getIsActive() == null || room.getIsActive() == 1)
                .sorted(Comparator.comparing(Room::getId))
                .collect(Collectors.toList());
    }

    private LocalDateTime defaultStart(Granularity g) {
        LocalDateTime now = LocalDateTime.now();
        if (g == Granularity.HOUR) {
            return now.minusDays(1).truncatedTo(ChronoUnit.HOURS);
        }
        return now.minusDays(30).toLocalDate().atStartOfDay();
    }

    private LocalDateTime defaultEnd(Granularity g) {
        LocalDateTime now = LocalDateTime.now();
        if (g == Granularity.HOUR) {
            return now.truncatedTo(ChronoUnit.HOURS);
        }
        return now.toLocalDate().atStartOfDay();
    }

    private record EventSeed(LocalDate startDate, LocalDate endDate, String title, String description, String category) {
    }

    private static final class InventoryAccumulator {
        private int totalRooms;
        private int availableRooms;
        private int reservedRooms;
        private int occupiedRooms;
        private int maintenanceRooms;
        private int lockedRooms;

        private InventorySnapshot toSnapshot() {
            int total = totalRooms;
            int available = Math.max(0, Math.min(availableRooms, total));
            int reserved = Math.max(0, Math.min(reservedRooms, total));
            int occupied = Math.max(0, Math.min(occupiedRooms, total));
            int maintenance = Math.max(0, Math.min(maintenanceRooms, total));
            int locked = Math.max(0, Math.min(lockedRooms, total));
            return new InventorySnapshot(total, available, reserved, occupied, maintenance, locked);
        }
    }

    private record InventorySnapshot(int totalRooms,
                                     int availableRooms,
                                     int reservedRooms,
                                     int occupiedRooms,
                                     int maintenanceRooms,
                                     int lockedRooms) {

        private Map<String, Integer> toMap() {
            Map<String, Integer> map = new HashMap<>();
            map.put("total", totalRooms);
            map.put("available", availableRooms);
            map.put("reserved", reservedRooms);
            map.put("occupied", occupiedRooms);
            map.put("maintenance", maintenanceRooms);
            map.put("locked", lockedRooms);
            return map;
        }
    }
}
