package com.hyj.hotelbackend.service.impl;

import com.hyj.hotelbackend.entity.PaymentRecord;
import com.hyj.hotelbackend.entity.User;
import com.hyj.hotelbackend.mapper.PaymentRecordMapper;
import com.hyj.hotelbackend.mapper.UserMapper;
import com.hyj.hotelbackend.service.PaymentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.Assert;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
public class PaymentServiceImpl implements PaymentService {

    @Autowired
    private PaymentRecordMapper paymentRecordMapper;

    @Autowired
    private UserMapper userMapper;

    @Override
    @Transactional
    public PaymentRecord recordDirectPayment(Long bookingId, Long userId, BigDecimal amount, String method, String channel, String referenceNo) {
        Assert.notNull(bookingId, "bookingId 必填");
        Assert.notNull(userId, "userId 必填");
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("支付金额需大于0");
        }
        PaymentRecord record = new PaymentRecord();
        record.setBookingId(bookingId);
        record.setUserId(userId);
        record.setAmount(amount);
        record.setMethod(method);
        record.setChannel(channel);
        record.setStatus("PAID");
        record.setPaidAt(LocalDateTime.now());
        record.setReferenceNo(referenceNo);
        record.setCreatedAt(LocalDateTime.now());
        record.setUpdatedAt(LocalDateTime.now());
        paymentRecordMapper.insert(record);
        
        // 支付成功后更新累计消费金额并检查VIP升级
        try {
            User user = userMapper.selectById(userId);
            if (user != null) {
                // 增加累计消费金额
                BigDecimal currentConsumption = user.getTotalConsumption() != null ? user.getTotalConsumption() : BigDecimal.ZERO;
                BigDecimal newConsumption = currentConsumption.add(amount);
                user.setTotalConsumption(newConsumption);
                
                // 根据累计消费金额更新VIP等级
                int oldLevel = user.getVipLevel() != null ? user.getVipLevel() : 0;
                int newLevel = calculateVipLevel(newConsumption);
                
                if (newLevel != oldLevel) {
                    user.setVipLevel(newLevel);
                    System.out.println("用户 " + userId + " VIP等级已从 " + oldLevel + " 升级到 " + newLevel + "（累计消费：" + newConsumption + "）");
                }
                
                userMapper.updateById(user);
            }
        } catch (Exception e) {
            System.err.println("更新累计消费和VIP等级失败: " + e.getMessage());
            e.printStackTrace();
        }
        
        return record;
    }
    
    /**
     * 根据累计消费金额计算VIP等级
     */
    private int calculateVipLevel(BigDecimal totalConsumption) {
        if (totalConsumption == null) {
            return 0;
        }
        
        if (totalConsumption.compareTo(new BigDecimal("50000")) >= 0) {
            return 4; // 钻石会员
        } else if (totalConsumption.compareTo(new BigDecimal("30000")) >= 0) {
            return 3; // 铂金会员
        } else if (totalConsumption.compareTo(new BigDecimal("15000")) >= 0) {
            return 2; // 黄金会员
        } else if (totalConsumption.compareTo(new BigDecimal("5000")) >= 0) {
            return 1; // 白银会员
        } else {
            return 0; // 普通会员
        }
    }

    @Override
    @Transactional
    public PaymentRecord markRefund(Long recordId, String status) {
        Assert.notNull(recordId, "recordId 必填");
        PaymentRecord record = paymentRecordMapper.selectById(recordId);
        if (record == null) {
            return null;
        }
        record.setStatus(status == null ? "REFUNDED" : status);
        record.setRefundedAt(LocalDateTime.now());
        record.setUpdatedAt(LocalDateTime.now());
        paymentRecordMapper.updateById(record);
        return record;
    }
}
