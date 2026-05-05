package com.hyj.hotelbackend.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hyj.hotelbackend.entity.VacancyStatistics;

import java.time.LocalDate;
import java.util.List;

public interface VacancyStatisticsService extends IService<VacancyStatistics> {
    
    /**
     * 计算并保存指定日期的空置率统计
     * @param date 统计日期
     */
    void calculateAndSaveStatistics(LocalDate date);
    
    /**
     * 查询指定时间范围内的统计数据
     * @param roomTypeIds 房型ID列表，为空则查询所有
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @param includeHourly 是否包含小时级别数据
     * @return 统计数据列表
     */
    List<VacancyStatistics> queryStatistics(List<Long> roomTypeIds, LocalDate startDate, LocalDate endDate, boolean includeHourly);
}
