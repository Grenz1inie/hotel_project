package com.hyj.hotelbackend.config;

import com.hyj.hotelbackend.service.HotelService;
import com.hyj.hotelbackend.service.RoomService;
import com.hyj.hotelbackend.service.VipPricingService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import jakarta.annotation.Resource;

@Component
public class CacheWarmupRunner implements CommandLineRunner {

    @Resource
    private HotelService hotelService;

    @Resource
    private RoomService roomService;

    @Resource
    private VipPricingService vipPricingService;

    @Override
    public void run(String... args) {
        System.out.println(">>> 正在执行 JetCache 缓存预热...");
        try {
            // 1. 预热核心酒店信息
            hotelService.getPrimaryHotel();
            System.out.println("   [OK] 酒店列表预热完成");

            // 2. 预热 VIP 基础信息
            vipPricingService.getBaseVipDiscountRates();
            vipPricingService.getVipLevelNames();
            vipPricingService.getCheckoutBoundaryHours();
            vipPricingService.getVipLevelDescriptors();
            System.out.println("   [OK] VIP设置预热完成");

            // 3. 预热房型列表
            roomService.list();
            System.out.println("   [OK] 房型信息预热完成");

            System.out.println("<<< 缓存预热全部完成！");
        } catch (Exception e) {
            System.err.println("<<< 缓存预热出现异常: " + e.getMessage());
        }
    }
}
