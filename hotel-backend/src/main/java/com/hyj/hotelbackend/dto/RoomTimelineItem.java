package com.hyj.hotelbackend.dto;

import lombok.Data;

import java.util.Collections;
import java.util.List;

@Data
public class RoomTimelineItem {
    private Long roomId;
    private Long roomTypeId;
    private String roomNumber;
    private Integer floor;
    private Integer status;

    private List<RoomTimelineBooking> bookings = Collections.emptyList();

    public void setBookings(List<RoomTimelineBooking> bookings) {
        this.bookings = bookings == null ? Collections.emptyList() : bookings;
    }
}