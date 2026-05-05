package com.hyj.hotelbackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("room_price_strategy")
public class RoomPriceStrategy {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long hotelId;
    private Long roomTypeId;
    private Integer strategyType;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal priceAdjust;
    private BigDecimal discountRate;
    private Integer vipLevel;
    private Integer minStayDays;
    private Integer status;
    private LocalDateTime createdTime;
    private LocalDateTime updatedTime;
}
