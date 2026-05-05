package com.hyj.hotelbackend.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hyj.hotelbackend.entity.PaymentRecord;
import com.hyj.hotelbackend.entity.User;
import com.hyj.hotelbackend.entity.WalletAccount;
import com.hyj.hotelbackend.entity.WalletTransaction;
import com.hyj.hotelbackend.mapper.PaymentRecordMapper;
import com.hyj.hotelbackend.mapper.UserMapper;
import com.hyj.hotelbackend.mapper.WalletAccountMapper;
import com.hyj.hotelbackend.mapper.WalletTransactionMapper;
import com.hyj.hotelbackend.service.WalletService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.Assert;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class WalletServiceImpl implements WalletService {

    @Autowired
    private WalletAccountMapper walletAccountMapper;

    @Autowired
    private WalletTransactionMapper walletTransactionMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PaymentRecordMapper paymentRecordMapper;

    @Override
    @Transactional
    public WalletAccount getOrCreateAccount(Long userId) {
        Assert.notNull(userId, "userId 必填");
        WalletAccount account = walletAccountMapper.selectOne(new LambdaQueryWrapper<WalletAccount>()
                .eq(WalletAccount::getUserId, userId));
        if (account != null) {
            if (account.getBalance() == null) {
                account.setBalance(BigDecimal.ZERO);
            }
            if (account.getFrozenBalance() == null) {
                account.setFrozenBalance(BigDecimal.ZERO);
            }
            return account;
        }
        WalletAccount created = new WalletAccount();
        created.setUserId(userId);
        created.setBalance(BigDecimal.ZERO);
        created.setFrozenBalance(BigDecimal.ZERO);
        created.setStatus("ACTIVE");
        created.setCreatedAt(LocalDateTime.now());
        created.setUpdatedAt(LocalDateTime.now());
        walletAccountMapper.insert(created);
        return created;
    }

    @Override
    @Transactional
    public WalletTransaction recharge(Long userId, BigDecimal amount, String channel, String referenceNo, String remark) {
        Assert.notNull(userId, "userId 必填");
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("充值金额需大于0");
        }
        WalletAccount account = getOrCreateAccount(userId);
        BigDecimal newBalance = safeValue(account.getBalance()).add(amount);
        account.setBalance(newBalance);
        account.setUpdatedAt(LocalDateTime.now());
        walletAccountMapper.updateById(account);
        WalletTransaction tx = buildTransaction(account, userId, amount, newBalance, "RECHARGE", "IN", channel, referenceNo, remark, null);
        walletTransactionMapper.insert(tx);
        return tx;
    }

    @Override
    @Transactional
    public WalletTransaction consume(Long userId, BigDecimal amount, String channel, Long bookingId, String remark) {
        Assert.notNull(userId, "userId 必填");
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("扣费金额需大于0");
        }
        WalletAccount account = getOrCreateAccount(userId);
        BigDecimal current = safeValue(account.getBalance());
        if (current.compareTo(amount) < 0) {
            throw new IllegalStateException("钱包余额不足");
        }
        BigDecimal newBalance = current.subtract(amount);
        account.setBalance(newBalance);
        account.setUpdatedAt(LocalDateTime.now());
        walletAccountMapper.updateById(account);
        WalletTransaction tx = buildTransaction(account, userId, amount, newBalance, "PAYMENT", "OUT", channel, null, remark, bookingId);
        walletTransactionMapper.insert(tx);

        // 消费后立即更新累计消费金额并检查VIP升级
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

        return tx;
    }

    @Override
    @Transactional
    public WalletTransaction refund(Long userId, BigDecimal amount, String channel, Long bookingId, String remark) {
        Assert.notNull(userId, "userId 必填");
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("退款金额需大于0");
        }
        WalletAccount account = getOrCreateAccount(userId);
        BigDecimal newBalance = safeValue(account.getBalance()).add(amount);
        account.setBalance(newBalance);
        account.setUpdatedAt(LocalDateTime.now());
        walletAccountMapper.updateById(account);
        WalletTransaction tx = buildTransaction(account, userId, amount, newBalance, "REFUND", "IN", channel, null, remark, bookingId);
        walletTransactionMapper.insert(tx);

        // 退款后减少累计消费金额并重新计算VIP等级
        try {
            User user = userMapper.selectById(userId);
            if (user != null) {
                // 减少累计消费金额
                BigDecimal currentConsumption = user.getTotalConsumption() != null ? user.getTotalConsumption() : BigDecimal.ZERO;
                BigDecimal newConsumption = currentConsumption.subtract(amount);
                // 确保不为负数
                if (newConsumption.compareTo(BigDecimal.ZERO) < 0) {
                    newConsumption = BigDecimal.ZERO;
                }
                user.setTotalConsumption(newConsumption);

                // 根据新的累计消费金额重新计算VIP等级（可能降级）
                int oldLevel = user.getVipLevel() != null ? user.getVipLevel() : 0;
                int newLevel = calculateVipLevel(newConsumption);

                if (newLevel != oldLevel) {
                    user.setVipLevel(newLevel);
                    System.out.println("用户 " + userId + " VIP等级已从 " + oldLevel + " 调整到 " + newLevel + "（退款后累计消费：" + newConsumption + "）");
                }

                userMapper.updateById(user);
            }
        } catch (Exception e) {
            System.err.println("更新累计消费和VIP等级失败: " + e.getMessage());
            e.printStackTrace();
        }

        return tx;
    }

    @Override
    public List<WalletTransaction> recentTransactions(Long userId, int limit) {
        Assert.notNull(userId, "userId 必填");
        int pageSize = limit <= 0 ? 10 : Math.min(limit, 200);
        // 使用 MyBatis Plus 分页，自动适配 Oracle 11g（需配置分页插件）
        Page<WalletTransaction> page = new Page<>(1, pageSize);
        Page<WalletTransaction> result = walletTransactionMapper.selectPage(page,
                new LambdaQueryWrapper<WalletTransaction>()
                        .eq(WalletTransaction::getUserId, userId)
                        .orderByDesc(WalletTransaction::getCreatedAt));
        return result.getRecords();
    }

    private WalletTransaction buildTransaction(WalletAccount account,
                                               Long userId,
                                               BigDecimal amount,
                                               BigDecimal balanceAfter,
                                               String type,
                                               String direction,
                                               String channel,
                                               String referenceNo,
                                               String remark,
                                               Long bookingId) {
        WalletTransaction tx = new WalletTransaction();
        tx.setWalletId(account.getId());
        tx.setUserId(userId);
        tx.setBookingId(bookingId);
        tx.setAmount(amount);
        tx.setBalanceAfter(balanceAfter);
        tx.setType(type);
        tx.setDirection(direction);
        tx.setPaymentChannel(channel);
        tx.setReferenceNo(referenceNo);
        tx.setRemark(remark);
        tx.setCreatedAt(LocalDateTime.now());
        return tx;
    }

    private BigDecimal safeValue(BigDecimal source) {
        return source == null ? BigDecimal.ZERO : source;
    }

    @Override
    public BigDecimal getYearlyConsumption(Long userId) {
        Assert.notNull(userId, "userId 必填");

        // 获取本年度1月1日的开始时间
        LocalDateTime yearStart = LocalDateTime.now().withMonth(1).withDayOfMonth(1)
                .withHour(0).withMinute(0).withSecond(0).withNano(0);

        BigDecimal total = BigDecimal.ZERO;

        // 1. 查询本年度所有钱包消费记录（type=PAYMENT, direction=OUT）
        List<WalletTransaction> walletTransactions = walletTransactionMapper.selectList(
                new LambdaQueryWrapper<WalletTransaction>()
                        .eq(WalletTransaction::getUserId, userId)
                        .eq(WalletTransaction::getType, "PAYMENT")
                        .eq(WalletTransaction::getDirection, "OUT")
                        .ge(WalletTransaction::getCreatedAt, yearStart)
        );

        // 累加钱包消费金额
        for (WalletTransaction tx : walletTransactions) {
            if (tx.getAmount() != null) {
                total = total.add(tx.getAmount());
            }
        }

        // 2. 查询本年度所有其他支付方式的消费记录（payment_record表，status=PAID）
        List<PaymentRecord> paymentRecords = paymentRecordMapper.selectList(
                new LambdaQueryWrapper<PaymentRecord>()
                        .eq(PaymentRecord::getUserId, userId)
                        .eq(PaymentRecord::getStatus, "PAID")
                        .ge(PaymentRecord::getCreatedAt, yearStart)
        );

        // 累加其他支付方式的消费金额
        for (PaymentRecord record : paymentRecords) {
            if (record.getAmount() != null) {
                total = total.add(record.getAmount());
            }
        }

        return total;
    }

    @Override
    @Transactional
    public void checkAndUpgradeVipLevel(Long userId) {
        Assert.notNull(userId, "userId 必填");

        // 获取用户当前信息
        User user = userMapper.selectById(userId);
        if (user == null) {
            return;
        }

        // 使用用户的累计消费金额字段
        BigDecimal totalConsumption = user.getTotalConsumption() != null ? user.getTotalConsumption() : BigDecimal.ZERO;

        // 根据累计消费计算应有的VIP等级
        int currentLevel = user.getVipLevel() != null ? user.getVipLevel() : 0;
        int newLevel = calculateVipLevel(totalConsumption);

        // 如果等级有变化，更新用户VIP等级
        if (newLevel != currentLevel) {
            user.setVipLevel(newLevel);
            userMapper.updateById(user);
            System.out.println("用户 " + userId + " VIP等级已从 " + currentLevel + " 调整到 " + newLevel + "（累计消费：" + totalConsumption + "）");
        }
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
}
