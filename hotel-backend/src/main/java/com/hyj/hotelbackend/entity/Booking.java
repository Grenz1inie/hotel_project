package com.hyj.hotelbackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("bookings")
public class Booking {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("hotel_id")
    private Long hotelId;

    @TableField("room_type_id")
    private Long roomTypeId;

    @TableField("room_id")
    private Long roomId;

    @TableField("user_id")
    private Long userId;

    @TableField("start_time")
    private LocalDateTime startTime;

    @TableField("end_time")
    private LocalDateTime endTime;
    private String status; // PENDING, PENDING_CONFIRMATION, PENDING_PAYMENT, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, REFUND_REQUESTED, REFUNDED

    @TableField("guests")
    private Integer guests;

    @TableField("amount")
    private java.math.BigDecimal amount;

    @TableField("original_amount")
    private java.math.BigDecimal originalAmount;

    @TableField("discount_amount")
    private java.math.BigDecimal discountAmount;

    @TableField("payable_amount")
    private java.math.BigDecimal payableAmount;

    @TableField("paid_amount")
    private java.math.BigDecimal paidAmount;

    @TableField("discount_rate")
    private java.math.BigDecimal discountRate;

    @TableField("payment_status")
    private String paymentStatus;

    @TableField("payment_method")
    private String paymentMethod;

    @TableField("payment_channel")
    private String paymentChannel;

    @TableField("wallet_transaction_id")
    private Long walletTransactionId;

    @TableField("payment_record_id")
    private Long paymentRecordId;

    @TableField("currency")
    private String currency;

    @TableField("contact_name")
    private String contactName;

    @TableField("contact_phone")
    private String contactPhone;

    private String remark;

    @TableField("refund_reason")
    private String refundReason;

    @TableField("refund_requested_at")
    private LocalDateTime refundRequestedAt;

    @TableField("refund_approved_at")
    private LocalDateTime refundApprovedAt;

    @TableField("refund_rejected_at")
    private LocalDateTime refundRejectedAt;

    @TableField("refund_approved_by")
    private Long refundApprovedBy;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
