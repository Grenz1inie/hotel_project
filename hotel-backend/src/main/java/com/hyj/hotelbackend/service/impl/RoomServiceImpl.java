package com.hyj.hotelbackend.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hyj.hotelbackend.entity.Room;
import com.hyj.hotelbackend.mapper.RoomMapper;
import com.hyj.hotelbackend.service.RoomService;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.io.Serializable;
import java.util.List;

@Service
public class RoomServiceImpl extends ServiceImpl<RoomMapper, Room> implements RoomService {

    @Override
    @Cacheable(value = "roomInfoCache", key = "#id")
    public Room getById(Serializable id) {
        return super.getById(id);
    }

    @Override
    @Cacheable(value = "roomListCache", key = "'all'")
    public List<Room> list() {
        return super.list();
    }

    @Override
    @CacheEvict(value = {"roomInfoCache", "roomListCache"}, allEntries = true)
    public boolean save(Room entity) {
        return super.save(entity);
    }

    @Override
    @CacheEvict(value = {"roomInfoCache", "roomListCache"}, allEntries = true)
    public boolean updateById(Room entity) {
        return super.updateById(entity);
    }

    @Override
    @CacheEvict(value = {"roomInfoCache", "roomListCache"}, allEntries = true)
    public boolean removeById(Serializable id) {
        return super.removeById(id);
    }
}
