package com.hyj.hotelbackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("vip_level_policy")
public class VipLevelPolicy {
    @TableId(type = IdType.INPUT)
    private Integer vip_level;
    private String name;
    private BigDecimal discountRate;
    private Integer checkoutHour;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
