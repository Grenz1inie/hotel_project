package com.hyj.hotelbackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("room_type")
public class Room {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String type;

    @TableField("theme_color")
    private String themeColor;

    @TableField("total_count")
    private Integer totalCount;

    @TableField("available_count")
    private Integer availableCount;

    @TableField("price_per_night")
    private BigDecimal pricePerNight;

    private String images; // comma separated URLs

    private String description;

    private String amenities;

    @TableField("area_sqm")
    private BigDecimal areaSqm;

    @TableField("bed_type")
    private String bedType;

    @TableField("max_guests")
    private Integer maxGuests;

    @TableField("is_active")
    private Integer isActive;

    @TableField("hotel_id")
    private Long hotelId;

    @TableField("created_time")
    private LocalDateTime createdTime;

    @TableField("updated_time")
    private LocalDateTime updatedTime;
}