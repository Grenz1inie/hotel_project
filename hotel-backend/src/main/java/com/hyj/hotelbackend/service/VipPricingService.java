package com.hyj.hotelbackend.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public interface VipPricingService {

    Map<Integer, BigDecimal> getBaseVipDiscountRates();

    Map<Integer, String> getVipLevelNames();

    Map<Integer, Integer> getCheckoutBoundaryHours();

    int getCheckoutBoundaryHour(Integer vipLevel);

    BigDecimal getDiscountRateForRoom(Long roomTypeId, Integer vipLevel);

    Map<Long, Map<Integer, BigDecimal>> getActiveRoomVipDiscounts();

    List<VipLevelDescriptor> getVipLevelDescriptors();

    Map<Long, RoomVipDiscountDescriptor> getRoomDiscountDescriptors();

    record VipLevelDescriptor(Integer level, String name, BigDecimal discountRate, Integer checkoutHour, String description) {}

    record RoomVipDiscountDescriptor(Long roomTypeId, String roomName, Map<Integer, BigDecimal> discounts) {}
}
