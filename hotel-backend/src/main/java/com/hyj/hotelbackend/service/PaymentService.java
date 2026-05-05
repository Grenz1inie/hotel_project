package com.hyj.hotelbackend.service;

import com.hyj.hotelbackend.entity.PaymentRecord;

import java.math.BigDecimal;

public interface PaymentService {
    PaymentRecord recordDirectPayment(Long bookingId, Long userId, BigDecimal amount, String method, String channel, String referenceNo);

    PaymentRecord markRefund(Long recordId, String status);
}
