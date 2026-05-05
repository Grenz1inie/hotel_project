package com.hyj.hotelbackend.controller;

import com.hyj.hotelbackend.auth.AuthUser;
import com.hyj.hotelbackend.auth.CurrentUserHolder;
import com.hyj.hotelbackend.dto.analytics.VacancyAnalyticsResponse;
import com.hyj.hotelbackend.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/vacancy")
    public VacancyAnalyticsResponse vacancyAnalytics(@RequestParam(required = false) String roomTypeIds,
                                                      @RequestParam(required = false) String start,
                                                      @RequestParam(required = false) String end,
                                                      @RequestParam(required = false) String granularity,
                                                      @RequestParam(required = false) Double thresholdHigh,
                                                      @RequestParam(required = false) Double thresholdLow,
                                                      @RequestParam(required = false) Integer forecastDays) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        if (me.getRole() == null || !"ADMIN".equals(me.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可查看该数据");
        }
        List<Long> roomTypeIdList = parseRoomTypeIds(roomTypeIds);
        LocalDateTime startTime = parseDateTime(start);
        LocalDateTime endTime = parseDateTime(end);
        return analyticsService.getVacancyAnalytics(roomTypeIdList, startTime, endTime, granularity, thresholdHigh, thresholdLow, forecastDays);
    }

    private List<Long> parseRoomTypeIds(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .flatMap(s -> {
                    try {
                        return java.util.stream.Stream.of(Long.parseLong(s));
                    } catch (NumberFormatException ex) {
                        return java.util.stream.Stream.empty();
                    }
                })
                .collect(Collectors.toList());
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return java.time.OffsetDateTime.parse(value).toLocalDateTime();
        } catch (Exception ignore) {
        }
        try {
            return java.time.Instant.parse(value).atZone(java.time.ZoneId.systemDefault()).toLocalDateTime();
        } catch (Exception ignore) {
        }
        try {
            return LocalDateTime.parse(value);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "时间格式不正确: " + value, ex);
        }
    }
}
