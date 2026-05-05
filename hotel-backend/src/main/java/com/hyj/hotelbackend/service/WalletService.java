package com.hyj.hotelbackend.service;

import com.hyj.hotelbackend.entity.WalletAccount;
import com.hyj.hotelbackend.entity.WalletTransaction;

import java.math.BigDecimal;
import java.util.List;

public interface WalletService {
    WalletAccount getOrCreateAccount(Long userId);

    WalletTransaction recharge(Long userId, BigDecimal amount, String channel, String referenceNo, String remark);

    WalletTransaction consume(Long userId, BigDecimal amount, String channel, Long bookingId, String remark);

    WalletTransaction refund(Long userId, BigDecimal amount, String channel, Long bookingId, String remark);

    List<WalletTransaction> recentTransactions(Long userId, int limit);

    /**
     * 获取用户年度累计消费金额
     */
    BigDecimal getYearlyConsumption(Long userId);

    /**
     * 检查并更新用户VIP等级（基于年度累计消费）
     */
    void checkAndUpgradeVipLevel(Long userId);
}
