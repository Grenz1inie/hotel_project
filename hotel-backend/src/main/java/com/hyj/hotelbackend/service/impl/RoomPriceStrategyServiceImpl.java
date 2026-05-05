package com.hyj.hotelbackend.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hyj.hotelbackend.entity.RoomPriceStrategy;
import com.hyj.hotelbackend.mapper.RoomPriceStrategyMapper;
import com.hyj.hotelbackend.service.RoomPriceStrategyService;
import org.springframework.stereotype.Service;

@Service
public class RoomPriceStrategyServiceImpl extends ServiceImpl<RoomPriceStrategyMapper, RoomPriceStrategy>
        implements RoomPriceStrategyService {
}
