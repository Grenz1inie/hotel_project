package com.hyj.hotelbackend.controller;

import com.hyj.hotelbackend.auth.AuthUser;
import com.hyj.hotelbackend.auth.CurrentUserHolder;
import com.hyj.hotelbackend.entity.VacancyStatistics;
import com.hyj.hotelbackend.scheduled.VacancyStatisticsScheduler;
import com.hyj.hotelbackend.service.VacancyStatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/vacancy-statistics")
@RequiredArgsConstructor
public class VacancyStatisticsController {
    
    private final VacancyStatisticsService vacancyStatisticsService;
    private final VacancyStatisticsScheduler scheduler;
    
    /**
     * 手动触发计算指定日期的统计数据
     */
    @PostMapping("/calculate")
    public Map<String, Object> calculateStatistics(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        
        checkAdminPermission();
        
        scheduler.calculateStatisticsForDate(date);
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "统计计算已完成");
        result.put("date", date);
        return result;
    }
    
    /**
     * 批量补录历史数据
     */
    @PostMapping("/batch-calculate")
    public Map<String, Object> batchCalculateStatistics(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        checkAdminPermission();
        
        LocalDate current = startDate;
        int count = 0;
        
        while (!current.isAfter(endDate)) {
            scheduler.calculateStatisticsForDate(current);
            count++;
            current = current.plusDays(1);
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "批量统计计算已完成");
        result.put("startDate", startDate);
        result.put("endDate", endDate);
        result.put("daysProcessed", count);
        return result;
    }
    
    /**
     * 查询统计数据
     */
    @GetMapping
    public List<VacancyStatistics> queryStatistics(
            @RequestParam(required = false) List<Long> roomTypeIds,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "false") boolean includeHourly) {
        
        checkAdminPermission();
        
        return vacancyStatisticsService.queryStatistics(roomTypeIds, startDate, endDate, includeHourly);
    }
    
    /**
     * 删除指定日期的统计数据
     */
    @DeleteMapping
    public Map<String, Object> deleteStatistics(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        
        checkAdminPermission();
        
        boolean removed = vacancyStatisticsService.lambdaUpdate()
                .eq(VacancyStatistics::getStatDate, date)
                .remove();
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", removed);
        result.put("message", removed ? "删除成功" : "没有找到数据");
        result.put("date", date);
        return result;
    }
    
    private void checkAdminPermission() {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        if (me.getRole() == null || !"ADMIN".equals(me.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作");
        }
    }
}
