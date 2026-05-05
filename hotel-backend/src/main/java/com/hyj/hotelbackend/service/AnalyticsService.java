package com.hyj.hotelbackend.service;

import com.hyj.hotelbackend.dto.analytics.VacancyAnalyticsResponse;

import java.time.LocalDateTime;
import java.util.List;

public interface AnalyticsService {

    VacancyAnalyticsResponse getVacancyAnalytics(List<Long> roomTypeIds,
                                                 LocalDateTime start,
                                                 LocalDateTime end,
                                                 String granularity,
                                                 Double thresholdHigh,
                                                 Double thresholdLow,
                                                 Integer forecastDays);
}
