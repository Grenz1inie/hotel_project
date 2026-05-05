package com.hyj.hotelbackend.controller;

import com.hyj.hotelbackend.auth.AuthUser;
import com.hyj.hotelbackend.auth.CurrentUserHolder;
import com.hyj.hotelbackend.entity.WalletAccount;
import com.hyj.hotelbackend.entity.WalletTransaction;
import com.hyj.hotelbackend.service.WalletService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wallet")
public class WalletController {

    @Autowired
    private WalletService walletService;

    @GetMapping("/me")
    public Map<String, Object> me(@RequestParam(defaultValue = "10") int limit) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        WalletAccount account = walletService.getOrCreateAccount(me.getId());
        List<WalletTransaction> recent = walletService.recentTransactions(me.getId(), limit);
        return Map.of(
                "balance", account.getBalance(),
                "frozenBalance", account.getFrozenBalance(),
                "status", account.getStatus(),
                "transactions", recent
        );
    }

    @PostMapping("/recharge")
    public WalletTransaction recharge(@RequestBody RechargeRequest request) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        if (request == null || request.amount == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "充值金额必填");
        }
        BigDecimal amount = request.amount;
        String channel = request.channel == null ? "MANUAL" : request.channel.trim().toUpperCase();
        String reference = request.referenceNo;
        String remark = request.remark;
        return walletService.recharge(me.getId(), amount, channel, reference, remark);
    }

    public static class RechargeRequest {
        public BigDecimal amount;
        public String channel;
        public String referenceNo;
        public String remark;
    }
}
