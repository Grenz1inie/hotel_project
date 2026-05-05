package com.hyj.hotelbackend.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hyj.hotelbackend.entity.Booking;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface BookingMapper extends BaseMapper<Booking> {
}
