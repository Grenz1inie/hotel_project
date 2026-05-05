package com.hyj.hotelbackend.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hyj.hotelbackend.entity.Room;
import com.hyj.hotelbackend.entity.RoomPriceStrategy;
import com.hyj.hotelbackend.entity.VipLevelPolicy;
import com.hyj.hotelbackend.mapper.RoomPriceStrategyMapper;
import com.hyj.hotelbackend.mapper.VipLevelPolicyMapper;
import com.hyj.hotelbackend.service.RoomService;
import com.hyj.hotelbackend.service.VipPricingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.util.StringUtils;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.Comparator;
import java.util.stream.Collectors;

@Service
public class VipPricingServiceImpl implements VipPricingService {

    private static final Map<Integer, BigDecimal> BASE_RATES = Map.of(
            0, BigDecimal.ONE,
            1, new BigDecimal("0.95"),
            2, new BigDecimal("0.90"),
            3, new BigDecimal("0.88"),
            4, new BigDecimal("0.85")
    );

    private static final Map<Integer, String> LEVEL_NAMES = Map.of(
            0, "普通会员",
            1, "白银会员",
            2, "黄金会员",
            3, "铂金会员",
            4, "钻石会员"
    );

    private static final Map<Integer, String> LEVEL_DESCRIPTIONS = Map.of(
            0, "注册即可成为普通会员，享受基础服务",
            1, "年消费满 5000 元晋升白银会员，享受 95 折",
            2, "年消费满 15000 元晋升黄金会员，享受 9 折",
            3, "年消费满 30000 元晋升铂金会员，享受 88 折",
            4, "受邀成为钻石会员，建议年消费 50000 元以上，享受 85 折并附赠贵宾礼遇"
    );

    private static final Map<Integer, Integer> DEFAULT_CHECKOUT_HOURS = Map.of(
            0, 12,
            1, 13,
            2, 14,
            3, 15,
            4, 16
    );

    @Autowired
    private RoomPriceStrategyMapper roomPriceStrategyMapper;

    @Autowired
    private RoomService roomService;

    @Autowired
    private VipLevelPolicyMapper vipLevelPolicyMapper;

    @Override
    @Cacheable(value = "vipBaseRates", key = "'all'")
    public Map<Integer, BigDecimal> getBaseVipDiscountRates() {
        Map<Integer, VipLevelPolicy> policies = loadPolicyMap();
        Map<Integer, BigDecimal> result = new LinkedHashMap<>();
        policies.forEach((level, policy) -> result.put(level, scaleRate(policy.getDiscountRate())));
        return result;
    }

    @Override
    @Cacheable(value = "vipLevelNames", key = "'all'")
    public Map<Integer, String> getVipLevelNames() {
        Map<Integer, VipLevelPolicy> policies = loadPolicyMap();
        Map<Integer, String> result = new LinkedHashMap<>();
        policies.forEach((level, policy) -> result.put(level, policy.getName()));
        return result;
    }

    @Override
    @Cacheable(value = "vipCheckoutHours", key = "'all'")
    public Map<Integer, Integer> getCheckoutBoundaryHours() {
        Map<Integer, VipLevelPolicy> policies = loadPolicyMap();
        Map<Integer, Integer> result = new LinkedHashMap<>();
        policies.forEach((level, policy) -> result.put(level, policy.getCheckoutHour()));
        return result;
    }

    @Override
    public int getCheckoutBoundaryHour(Integer vipLevel) {
        int level = safeVipLevel(vipLevel);
        VipLevelPolicy policy = loadPolicyMap().get(level);
        if (policy == null) {
            policy = createDefaultPolicy(level);
        }
        Integer hour = policy.getCheckoutHour();
        return hour == null ? DEFAULT_CHECKOUT_HOURS.getOrDefault(level, 12) : hour;
    }

    @Override
    public BigDecimal getDiscountRateForRoom(Long roomTypeId, Integer vipLevel) {
        int level = safeVipLevel(vipLevel);
        Map<Integer, VipLevelPolicy> policies = loadPolicyMap();
        BigDecimal defaultRate = policies.getOrDefault(level, createDefaultPolicy(level)).getDiscountRate();
        if (roomTypeId == null) {
            return defaultRate;
        }
        Map<Integer, BigDecimal> roomRates = getActiveRoomVipDiscounts().get(roomTypeId);
        if (roomRates == null || roomRates.isEmpty()) {
            return defaultRate;
        }
        return roomRates.getOrDefault(level, defaultRate);
    }

    @Override
    public Map<Long, Map<Integer, BigDecimal>> getActiveRoomVipDiscounts() {
        LocalDate today = LocalDate.now();
        List<RoomPriceStrategy> strategies = roomPriceStrategyMapper.selectList(new LambdaQueryWrapper<RoomPriceStrategy>()
                .eq(RoomPriceStrategy::getStrategyType, 2)
                .eq(RoomPriceStrategy::getStatus, 1)
                .le(RoomPriceStrategy::getStartDate, today)
                .ge(RoomPriceStrategy::getEndDate, today));
        if (strategies.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<Long, Map<Integer, BigDecimal>> result = new HashMap<>();
        for (RoomPriceStrategy strategy : strategies) {
            if (strategy.getRoomTypeId() == null || strategy.getDiscountRate() == null || strategy.getVipLevel() == null) {
                continue;
            }
            int vipLevel = safeVipLevel(strategy.getVipLevel());
            Map<Integer, BigDecimal> roomMap = result.computeIfAbsent(strategy.getRoomTypeId(), k -> new HashMap<>());
            roomMap.put(vipLevel, scaleRate(strategy.getDiscountRate()));
        }
        return result;
    }

    @Override
    @Cacheable(value = "vipLevelDescriptors", key = "'all'")
    public List<VipLevelDescriptor> getVipLevelDescriptors() {
        Map<Integer, VipLevelPolicy> policies = loadPolicyMap();
        return policies.values().stream()
                .sorted(Comparator.comparingInt(VipLevelPolicy::getVip_level))
                .map(policy -> new VipLevelDescriptor(
                        policy.getVip_level(),
                        policy.getName(),
                        scaleRate(policy.getDiscountRate()),
                        policy.getCheckoutHour(),
                        policy.getDescription()
                ))
                .collect(Collectors.toList());
    }

    @Override
    public Map<Long, RoomVipDiscountDescriptor> getRoomDiscountDescriptors() {
        Map<Long, Map<Integer, BigDecimal>> active = getActiveRoomVipDiscounts();
        if (active.isEmpty()) {
            return Collections.emptyMap();
        }
        Set<Long> roomIds = active.keySet();
        Map<Long, String> roomNames = roomService.listByIds(roomIds).stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(Room::getId, Room::getName));
        Map<Long, RoomVipDiscountDescriptor> res = new HashMap<>();
        for (Long roomId : roomIds) {
            Map<Integer, BigDecimal> discounts = active.get(roomId);
            if (discounts == null || discounts.isEmpty()) {
                continue;
            }
            res.put(roomId, new RoomVipDiscountDescriptor(roomId, roomNames.getOrDefault(roomId, "房型 " + roomId), discounts));
        }
        return res;
    }

    private Map<Integer, VipLevelPolicy> loadPolicyMap() {
        List<VipLevelPolicy> policies = vipLevelPolicyMapper.selectList(new LambdaQueryWrapper<VipLevelPolicy>()
                .orderByAsc(VipLevelPolicy::getVip_level));
        Map<Integer, VipLevelPolicy> map = new LinkedHashMap<>();
        if (policies != null) {
            for (VipLevelPolicy policy : policies) {
                if (policy == null || policy.getVip_level() == null) {
                    continue;
                }
                ensurePolicyDefaults(policy);
                map.put(policy.getVip_level(), policy);
            }
        }
        DEFAULT_CHECKOUT_HOURS.keySet().stream()
                .sorted()
                .forEach(level -> map.computeIfAbsent(level, this::createDefaultPolicy));
        return map;
    }

    private void ensurePolicyDefaults(VipLevelPolicy policy) {
        int level = safeVipLevel(policy.getVip_level());
        policy.setVip_level(level);
        if (!StringUtils.hasText(policy.getName())) {
            policy.setName(LEVEL_NAMES.getOrDefault(level, "VIP " + level));
        }
        if (policy.getDiscountRate() == null) {
            policy.setDiscountRate(BASE_RATES.getOrDefault(level, BigDecimal.ONE));
        }
        if (policy.getCheckoutHour() == null) {
            policy.setCheckoutHour(DEFAULT_CHECKOUT_HOURS.getOrDefault(level, 12));
        }
        if (!StringUtils.hasText(policy.getDescription())) {
            policy.setDescription(LEVEL_DESCRIPTIONS.getOrDefault(level, ""));
        }
        policy.setDiscountRate(scaleRate(policy.getDiscountRate()));
    }

    private VipLevelPolicy createDefaultPolicy(Integer level) {
        VipLevelPolicy policy = new VipLevelPolicy();
        int safeLevel = safeVipLevel(level);
        policy.setVip_level(safeLevel);
        policy.setName(LEVEL_NAMES.getOrDefault(safeLevel, "VIP " + safeLevel));
        policy.setDiscountRate(scaleRate(BASE_RATES.getOrDefault(safeLevel, BigDecimal.ONE)));
        policy.setCheckoutHour(DEFAULT_CHECKOUT_HOURS.getOrDefault(safeLevel, 12));
        policy.setDescription(LEVEL_DESCRIPTIONS.getOrDefault(safeLevel, ""));
        return policy;
    }

    private int safeVipLevel(Integer level) {
        return level == null ? 0 : Math.max(level, 0);
    }

    private BigDecimal scaleRate(BigDecimal rate) {
        if (rate == null) {
            return BigDecimal.ONE;
        }
        return rate.setScale(2, RoundingMode.HALF_UP);
    }
}
