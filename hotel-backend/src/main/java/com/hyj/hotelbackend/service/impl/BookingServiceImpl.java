package com.hyj.hotelbackend.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hyj.hotelbackend.entity.Booking;
import com.hyj.hotelbackend.mapper.BookingMapper;
import com.hyj.hotelbackend.service.BookingService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Collections;
import java.util.List;

@Service
public class BookingServiceImpl extends ServiceImpl<BookingMapper, Booking> implements BookingService {

    /**
     * {@inheritDoc}
     */
    @Override
    public List<Booking> getBookingPeriodsByRooms(Collection<Long> roomInstanceIds,
                                                   LocalDateTime windowStart,
                                                   LocalDateTime windowEnd,
                                                   Collection<String> statusFilter) {
        if (roomInstanceIds == null || roomInstanceIds.isEmpty()) {
            return Collections.emptyList();
        }
        LambdaQueryWrapper<Booking> query = new LambdaQueryWrapper<Booking>()
                .in(Booking::getRoomId, roomInstanceIds)
                .lt(Booking::getStartTime, windowEnd)
                .gt(Booking::getEndTime, windowStart);
        // 仅在明确指定状态过滤时才添加 IN 条件
        if (statusFilter != null && !statusFilter.isEmpty()) {
            query.in(Booking::getStatus, statusFilter);
        }
        return list(query);
    }
}
