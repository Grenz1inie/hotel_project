package com.hyj.hotelbackend.controller;

import com.hyj.hotelbackend.service.VipPricingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/pricing")
public class PricingController {

    @Autowired
    private VipPricingService vipPricingService;

    @GetMapping("/vip")
    public Map<String, Object> vipSnapshot() {
        Map<Integer, BigDecimal> baseRates = vipPricingService.getBaseVipDiscountRates();
        List<VipPricingService.VipLevelDescriptor> levels = vipPricingService.getVipLevelDescriptors();
        Map<Long, VipPricingService.RoomVipDiscountDescriptor> rooms = vipPricingService.getRoomDiscountDescriptors();
    return Map.of(
        "generatedAt", LocalDateTime.now().toString(),
        "baseRates", baseRates,
        "levels", levels,
        "rooms", rooms.values().stream().collect(Collectors.toList()),
        "checkoutHours", vipPricingService.getCheckoutBoundaryHours()
    );
    }

    @GetMapping("/vip/rooms/{roomTypeId}")
    public Map<Integer, BigDecimal> roomVipRates(@PathVariable Long roomTypeId) {
        Map<Integer, BigDecimal> base = vipPricingService.getBaseVipDiscountRates();
        Map<Integer, BigDecimal> response = new java.util.HashMap<>(base);
        VipPricingService.RoomVipDiscountDescriptor descriptor = vipPricingService.getRoomDiscountDescriptors().get(roomTypeId);
        if (descriptor != null && descriptor.discounts() != null) {
            response.putAll(descriptor.discounts());
        }
        return response;
    }
}
