package com.hyj.hotelbackend.dto;

import com.hyj.hotelbackend.entity.Booking;
import com.hyj.hotelbackend.entity.RoomInstance;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

@Data
public class RoomOccupancyOverviewResponse {
    private LocalDateTime windowStart;
    private LocalDateTime windowEnd;
    private List<Booking> bookings = Collections.emptyList();
    private List<RoomInstance> roomInstances = Collections.emptyList();

    public void setBookings(List<Booking> bookings) {
        this.bookings = bookings == null ? Collections.emptyList() : bookings;
    }

    public void setRoomInstances(List<RoomInstance> roomInstances) {
        this.roomInstances = roomInstances == null ? Collections.emptyList() : roomInstances;
    }
}