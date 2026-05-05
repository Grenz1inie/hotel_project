package com.hyj.hotelbackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("vacancy_statistics")
public class VacancyStatistics {
    
    @TableId(type = IdType.AUTO)
    private Long id;
    
    private Long hotelId;
    
    private Long roomTypeId;
    
    private LocalDate statDate;
    
    private Integer statHour;
    
    private Integer totalRooms;
    
    private Integer availableRooms;
    
    private Integer occupiedRooms;
    
    private Integer reservedRooms;
    
    private Integer maintenanceRooms;
    
    private Integer lockedRooms;
    
    private BigDecimal vacancyCount;
    
    private BigDecimal vacancyRate;
    
    private BigDecimal occupancyRate;
    
    private BigDecimal bookingRate;
    
    private BigDecimal averagePrice;
    
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
}
