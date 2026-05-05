package com.hyj.hotelbackend.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hyj.hotelbackend.entity.Booking;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface BookingService extends IService<Booking> {

    /**
     * 查询指定房间实例集合在时间窗口内的预订列表，可按状态过滤。
     * 该方法抽象了时间轴渲染和日可用性计算的公共查询逻辑，供管理员时间轴
     * 和公开日可用性接口复用。
     *
     * @param roomInstanceIds 房间实例 ID 集合
     * @param windowStart     窗口开始时间（booking.endTime > windowStart）
     * @param windowEnd       窗口结束时间（booking.startTime < windowEnd）
     * @param statusFilter    状态过滤集合；传 null 或空集合时不过滤状态
     * @return 满足条件的预订列表
     */
    List<Booking> getBookingPeriodsByRooms(Collection<Long> roomInstanceIds,
                                            LocalDateTime windowStart,
                                            LocalDateTime windowEnd,
                                            Collection<String> statusFilter);
}
