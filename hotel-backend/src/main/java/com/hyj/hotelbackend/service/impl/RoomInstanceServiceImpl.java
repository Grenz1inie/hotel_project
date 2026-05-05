package com.hyj.hotelbackend.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hyj.hotelbackend.entity.RoomInstance;
import com.hyj.hotelbackend.mapper.RoomInstanceMapper;
import com.hyj.hotelbackend.service.RoomInstanceService;
import org.springframework.stereotype.Service;

@Service
public class RoomInstanceServiceImpl extends ServiceImpl<RoomInstanceMapper, RoomInstance> implements RoomInstanceService {
}
