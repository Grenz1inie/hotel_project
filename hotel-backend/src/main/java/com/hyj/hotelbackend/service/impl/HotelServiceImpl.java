package com.hyj.hotelbackend.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hyj.hotelbackend.entity.Hotel;
import com.hyj.hotelbackend.mapper.HotelMapper;
import com.hyj.hotelbackend.service.HotelService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class HotelServiceImpl extends ServiceImpl<HotelMapper, Hotel> implements HotelService {

    @Value("${hotel.primary-id:1}")
    private Long primaryHotelId;

    @Cacheable(value = "hotelCache", key = "'primary'", unless = "#result == null")
    @Override
    public Hotel getPrimaryHotel() {
        if (primaryHotelId != null) {
            Hotel hotel = getById(primaryHotelId);
            if (hotel != null) {
                return hotel;
            }
        }
        // Oracle 11g 使用 ROWNUM 限制返回一条记录
        return getOne(new LambdaQueryWrapper<Hotel>()
                .orderByAsc(Hotel::getId)
                .apply("ROWNUM = 1"));
    }
}
