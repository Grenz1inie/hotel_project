package com.hyj.hotelbackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("wallet_transaction")
public class WalletTransaction {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("wallet_id")
    private Long walletId;

    @TableField("user_id")
    private Long userId;

    @TableField("booking_id")
    private Long bookingId;

    private String type;

    private String direction;

    private BigDecimal amount;

    @TableField("balance_after")
    private BigDecimal balanceAfter;

    @TableField("payment_channel")
    private String paymentChannel;

    @TableField("reference_no")
    private String referenceNo;

    private String remark;

    @TableField("created_at")
    private LocalDateTime createdAt;
}
