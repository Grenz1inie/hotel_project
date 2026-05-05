package com.hyj.hotelbackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("payment_record")
public class PaymentRecord {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("booking_id")
    private Long bookingId;

    @TableField("user_id")
    private Long userId;

    private BigDecimal amount;

    private String method;

    private String channel;

    private String status;

    @TableField("paid_at")
    private LocalDateTime paidAt;

    @TableField("refunded_at")
    private LocalDateTime refundedAt;

    @TableField("reference_no")
    private String referenceNo;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
