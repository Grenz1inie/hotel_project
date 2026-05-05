package com.hyj.hotelbackend.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hyj.hotelbackend.entity.Booking;
import com.hyj.hotelbackend.entity.Room;
import com.hyj.hotelbackend.entity.RoomInstance;
import com.hyj.hotelbackend.entity.VacancyStatistics;
import com.hyj.hotelbackend.mapper.VacancyStatisticsMapper;
import com.hyj.hotelbackend.service.BookingService;
import com.hyj.hotelbackend.service.RoomInstanceService;
import com.hyj.hotelbackend.service.RoomService;
import com.hyj.hotelbackend.service.VacancyStatisticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class VacancyStatisticsServiceImpl extends ServiceImpl<VacancyStatisticsMapper, VacancyStatistics> implements VacancyStatisticsService {
    
    private final RoomService roomService;
    private final RoomInstanceService roomInstanceService;
    private final BookingService bookingService;
    
    @Override
    @Transactional
    public void calculateAndSaveStatistics(LocalDate date) {
        log.info("开始计算日期 {} 的空置率统计", date);
        
        // 获取所有房型
        List<Room> allRoomTypes = roomService.list();
        if (allRoomTypes.isEmpty()) {
            log.warn("没有找到任何房型，跳过统计");
            return;
        }
        
        List<VacancyStatistics> statisticsList = new ArrayList<>();
        
        // 对每个房型进行统计
        for (Room roomType : allRoomTypes) {
            // 按小时统计（0-23点）
            for (int hour = 0; hour < 24; hour++) {
                VacancyStatistics stats = calculateForRoomTypeAndHour(roomType, date, hour);
                if (stats != null) {
                    statisticsList.add(stats);
                }
            }
            
            // 全天统计（hour = null）
            VacancyStatistics dailyStats = calculateDailyStats(roomType, date);
            if (dailyStats != null) {
                statisticsList.add(dailyStats);
            }
        }
        
        // 删除当天旧数据
        this.remove(new LambdaQueryWrapper<VacancyStatistics>()
                .eq(VacancyStatistics::getStatDate, date));
        
        // 批量保存新数据
        if (!statisticsList.isEmpty()) {
            this.saveBatch(statisticsList);
            log.info("成功保存 {} 条统计记录", statisticsList.size());
        }
    }
    
    private VacancyStatistics calculateForRoomTypeAndHour(Room roomType, LocalDate date, int hour) {
        LocalDateTime slotStart = LocalDateTime.of(date, LocalTime.of(hour, 0));
        LocalDateTime slotEnd = slotStart.plusHours(1);
        
        return calculateStats(roomType, date, hour, slotStart, slotEnd);
    }
    
    private VacancyStatistics calculateDailyStats(Room roomType, LocalDate date) {
        LocalDateTime slotStart = LocalDateTime.of(date, LocalTime.MIN);
        LocalDateTime slotEnd = LocalDateTime.of(date, LocalTime.MAX);
        
        return calculateStats(roomType, date, null, slotStart, slotEnd);
    }
    
    private VacancyStatistics calculateStats(Room roomType, LocalDate date, Integer hour, 
                                             LocalDateTime slotStart, LocalDateTime slotEnd) {
        // 获取房型的所有房间实例
        List<RoomInstance> roomInstances = roomInstanceService.list(
                new LambdaQueryWrapper<RoomInstance>()
                        .eq(RoomInstance::getRoomTypeId, roomType.getId())
        );
        
        int totalRooms = roomInstances.size();
        if (totalRooms == 0) {
            totalRooms = roomType.getTotalCount() != null ? roomType.getTotalCount() : 0;
        }
        
        // 统计维护中的房间
        int maintenanceRooms = (int) roomInstances.stream()
                .filter(r -> r.getStatus() == 5) // 5 = 维护中
                .count();
        
        // 统计锁定的房间
        int lockedRooms = (int) roomInstances.stream()
                .filter(r -> r.getStatus() == 4) // 4 = 锁定
                .count();
        
        // 查询该时间段内的所有有效订单
        List<Booking> bookings = bookingService.list(
                new LambdaQueryWrapper<Booking>()
                        .eq(Booking::getRoomTypeId, roomType.getId())
                        .lt(Booking::getStartTime, slotEnd)
                        .gt(Booking::getEndTime, slotStart)
                        .in(Booking::getStatus, "CONFIRMED", "CHECKED_IN", "CHECKED_OUT")
        );
        
        // 统计预订和入住
        int occupiedRooms = 0;
        int reservedRooms = 0;
        BigDecimal totalPrice = BigDecimal.ZERO;
        int priceCount = 0;
        
        for (Booking booking : bookings) {
            if ("CHECKED_IN".equals(booking.getStatus())) {
                occupiedRooms++;
            } else if ("CONFIRMED".equals(booking.getStatus()) || "PENDING_PAYMENT".equals(booking.getStatus())) {
                reservedRooms++;
            }
            
            if (booking.getAmount() != null && booking.getAmount().compareTo(BigDecimal.ZERO) > 0) {
                totalPrice = totalPrice.add(booking.getAmount());
                priceCount++;
            }
        }
        
        // 计算可售房间数
        int sellableRooms = totalRooms - maintenanceRooms - lockedRooms;
        sellableRooms = Math.max(0, sellableRooms);
        
        // 计算空置房间数
        int busyRooms = occupiedRooms + reservedRooms;
        int availableRooms = Math.max(0, sellableRooms - busyRooms);
        
        // 计算各种比率
        BigDecimal vacancyRate = BigDecimal.ZERO;
        BigDecimal occupancyRate = BigDecimal.ZERO;
        BigDecimal bookingRate = BigDecimal.ZERO;
        
        if (sellableRooms > 0) {
            vacancyRate = BigDecimal.valueOf(availableRooms)
                    .divide(BigDecimal.valueOf(sellableRooms), 4, RoundingMode.HALF_UP);
            occupancyRate = BigDecimal.valueOf(occupiedRooms)
                    .divide(BigDecimal.valueOf(sellableRooms), 4, RoundingMode.HALF_UP);
            bookingRate = BigDecimal.valueOf(busyRooms)
                    .divide(BigDecimal.valueOf(sellableRooms), 4, RoundingMode.HALF_UP);
        }
        
        // 计算平均价格
        BigDecimal averagePrice = null;
        if (priceCount > 0) {
            averagePrice = totalPrice.divide(BigDecimal.valueOf(priceCount), 2, RoundingMode.HALF_UP);
        }
        
        // 构建统计对象
        VacancyStatistics stats = new VacancyStatistics();
        stats.setHotelId(roomType.getHotelId());
        stats.setRoomTypeId(roomType.getId());
        stats.setStatDate(date);
        stats.setStatHour(hour);
        stats.setTotalRooms(totalRooms);
        stats.setAvailableRooms(availableRooms);
        stats.setOccupiedRooms(occupiedRooms);
        stats.setReservedRooms(reservedRooms);
        stats.setMaintenanceRooms(maintenanceRooms);
        stats.setLockedRooms(lockedRooms);
        stats.setVacancyCount(BigDecimal.valueOf(availableRooms));
        stats.setVacancyRate(vacancyRate);
        stats.setOccupancyRate(occupancyRate);
        stats.setBookingRate(bookingRate);
        stats.setAveragePrice(averagePrice);
        
        return stats;
    }
    
    @Override
    public List<VacancyStatistics> queryStatistics(List<Long> roomTypeIds, LocalDate startDate, 
                                                   LocalDate endDate, boolean includeHourly) {
        LambdaQueryWrapper<VacancyStatistics> wrapper = new LambdaQueryWrapper<>();
        
        if (roomTypeIds != null && !roomTypeIds.isEmpty()) {
            wrapper.in(VacancyStatistics::getRoomTypeId, roomTypeIds);
        }
        
        if (startDate != null) {
            wrapper.ge(VacancyStatistics::getStatDate, startDate);
        }
        
        if (endDate != null) {
            wrapper.le(VacancyStatistics::getStatDate, endDate);
        }
        
        if (!includeHourly) {
            wrapper.isNull(VacancyStatistics::getStatHour);
        }
        
        wrapper.orderByAsc(VacancyStatistics::getStatDate, VacancyStatistics::getStatHour);
        
        return this.list(wrapper);
    }
}
