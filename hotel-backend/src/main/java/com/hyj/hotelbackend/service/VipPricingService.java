package com.hyj.hotelbackend.service;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.hyj.hotelbackend.service.VipPricingService.RoomVipDiscountDescriptor;

public interface VipPricingService {

    Map<Integer, BigDecimal> getBaseVipDiscountRates();

    Map<Integer, String> getVipLevelNames();

    Map<Integer, Integer> getCheckoutBoundaryHours();

    int getCheckoutBoundaryHour(Integer vipLevel);

    BigDecimal getDiscountRateForRoom(Long roomTypeId, Integer vipLevel);

    Map<Long, Map<Integer, BigDecimal>> getActiveRoomVipDiscounts();

    List<VipLevelDescriptor> getVipLevelDescriptors();

    Map<Long, RoomVipDiscountDescriptor> getRoomDiscountDescriptors();

    static class VipLevelDescriptor implements Serializable {
        private Integer level;
        private String name;
        private BigDecimal discountRate;
        private Integer checkoutHour;
        private String description;

        public VipLevelDescriptor() {}

        public VipLevelDescriptor(Integer level, String name, BigDecimal discountRate, Integer checkoutHour, String description) {
            this.level = level;
            this.name = name;
            this.discountRate = discountRate;
            this.checkoutHour = checkoutHour;
            this.description = description;
        }

        public Integer getLevel() { return level; }
        public void setLevel(Integer level) { this.level = level; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public BigDecimal getDiscountRate() { return discountRate; }
        public void setDiscountRate(BigDecimal discountRate) { this.discountRate = discountRate; }
        public Integer getCheckoutHour() { return checkoutHour; }
        public void setCheckoutHour(Integer checkoutHour) { this.checkoutHour = checkoutHour; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    static class RoomVipDiscountDescriptor implements Serializable {
        private Long roomTypeId;
        private String roomName;
        private Map<Integer, BigDecimal> discounts;

        public RoomVipDiscountDescriptor() {}

        public RoomVipDiscountDescriptor(Long roomTypeId, String roomName, Map<Integer, BigDecimal> discounts) {
            this.roomTypeId = roomTypeId;
            this.roomName = roomName;
            this.discounts = discounts;
        }

        public Long getRoomTypeId() { return roomTypeId; }
        public void setRoomTypeId(Long roomTypeId) { this.roomTypeId = roomTypeId; }
        public String getRoomName() { return roomName; }
        public void setRoomName(String roomName) { this.roomName = roomName; }
        public Map<Integer, BigDecimal> getDiscounts() { return discounts; }
        public void setDiscounts(Map<Integer, BigDecimal> discounts) { this.discounts = discounts; }
    }
}
