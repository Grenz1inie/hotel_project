package com.hyj.hotelbackend.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hyj.hotelbackend.entity.Room;
import com.hyj.hotelbackend.mapper.RoomMapper;
import com.hyj.hotelbackend.service.RoomService;
import com.alicp.jetcache.anno.Cached;
import com.alicp.jetcache.anno.CacheInvalidate;
import com.alicp.jetcache.anno.CacheType;
import org.springframework.stereotype.Service;

import java.io.Serializable;
import java.util.List;

@Service
public class RoomServiceImpl extends ServiceImpl<RoomMapper, Room> implements RoomService {

    @Override
    @Cached(name = "roomInfoCache.", key = "#id", cacheType = CacheType.BOTH, localExpire = 120, expire = 3600)
    public Room getById(Serializable id) {
        return super.getById(id);
    }

    @Override
    @Cached(name = "roomListCache.", key = "'all'", cacheType = CacheType.BOTH, localExpire = 120, expire = 3600)
    public List<Room> list() {
        return super.list();
    }

    @Override
    @CacheInvalidate(name = "roomInfoCache.", key = "#entity.id")
    // 注意：JetCache 不支持批量前缀的 allEntries=true 清除，可以通过清理整个 roomListCache.all
    public boolean save(Room entity) {
        return super.save(entity);
    }

    @Override
    @CacheInvalidate(name = "roomInfoCache.", key = "#entity.id")
    public boolean updateById(Room entity) {
        return super.updateById(entity);
    }

    @Override
    @CacheInvalidate(name = "roomInfoCache.", key = "#id")
    public boolean removeById(Serializable id) {
        return super.removeById(id);
    }
}
