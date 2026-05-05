package com.hyj.hotelbackend.dto.analytics;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
public class VacancyAnalyticsResponse {
    private String granularity;
    private LocalDateTime start;
    private LocalDateTime end;
    private List<VacancySeries> series = new ArrayList<>();
    private List<EventMarker> events = new ArrayList<>();
    private List<ThresholdAlert> alerts = new ArrayList<>();

    @Data
    public static class VacancySeries {
        private Long roomTypeId;
        private String roomTypeName;
        private Integer totalRooms;
        private List<VacancyPoint> points = new ArrayList<>();
        private Map<String, Integer> inventorySnapshot = new HashMap<>();
    }

    @Data
    public static class VacancyPoint {
        private LocalDateTime timestamp;
        private double vacancyCount;
        private double vacancyRate;
        private double bookingRate;
        private boolean forecast;
        private Map<String, Integer> statusBreakdown = new HashMap<>();
        private Map<String, Integer> sourceBreakdown = new HashMap<>();
        private BigDecimal averagePrice;
        private String priceStrategy;
    }

    @Data
    public static class EventMarker {
        private LocalDateTime timestamp;
        private LocalDateTime endTimestamp; // 新增：结束时间
        private String title;
        private String description;
        private String category;
    }

    @Data
    public static class ThresholdAlert {
        private Long roomTypeId;
        private String roomTypeName;
        private LocalDateTime start;
        private LocalDateTime end;
        private String level;
        private double threshold;
        private double actual;
        private String reason;
    }
}
