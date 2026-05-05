package com.hyj.hotelbackend.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hyj.hotelbackend.entity.Hotel;

public interface HotelService extends IService<Hotel> {
    /**
     * 获取系统默认展示的酒店信息。
     *
     * @return 默认酒店
     */
    Hotel getPrimaryHotel();
}