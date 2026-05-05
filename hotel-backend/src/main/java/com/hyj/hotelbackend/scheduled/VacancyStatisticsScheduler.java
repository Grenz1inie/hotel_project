package com.hyj.hotelbackend.scheduled;

import com.hyj.hotelbackend.service.VacancyStatisticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * 空置率统计定时任务
 * 每天凌晨1点自动计算前一天的空置率数据并存储到数据库
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VacancyStatisticsScheduler {
    
    private final VacancyStatisticsService vacancyStatisticsService;
    
    /**
     * 每天凌晨1点执行
     * cron表达式: 秒 分 时 日 月 周
     */
    @Scheduled(cron = "0 0 1 * * ?")
    public void calculateDailyVacancyStatistics() {
        try {
            // 计算昨天的数据
            LocalDate yesterday = LocalDate.now().minusDays(1);
            log.info("开始执行定时任务：计算 {} 的空置率统计", yesterday);
            
            vacancyStatisticsService.calculateAndSaveStatistics(yesterday);
            
            log.info("定时任务执行完成：{} 的空置率统计已保存", yesterday);
        } catch (Exception e) {
            log.error("空置率统计定时任务执行失败", e);
        }
    }
    
    /**
     * 手动触发计算指定日期的统计数据（用于补录历史数据）
     * 可以通过管理接口调用
     */
    public void calculateStatisticsForDate(LocalDate date) {
        log.info("手动触发：计算 {} 的空置率统计", date);
        vacancyStatisticsService.calculateAndSaveStatistics(date);
        log.info("手动触发完成：{} 的空置率统计已保存", date);
    }
}
