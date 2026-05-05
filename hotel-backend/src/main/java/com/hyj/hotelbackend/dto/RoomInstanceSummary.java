package com.hyj.hotelbackend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.hyj.hotelbackend.entity.Booking;
import com.hyj.hotelbackend.entity.RoomInstance;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class RoomInstanceSummary {
    private Long id;
    private Long hotelId;
    private Long roomTypeId;
    private String roomNumber;
    private Integer floor;
    private Integer status;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime lastCheckoutTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime updatedTime;

    private Long bookingId;
    private String bookingStatus;
    private Long bookingUserId;
    private Integer bookingGuests;
    private String bookingContactName;
    private String bookingContactPhone;
    private String bookingRemark;
    private BigDecimal bookingAmount;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime checkinTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime checkoutTime;

    public static RoomInstanceSummary fromRoom(RoomInstance room) {
        RoomInstanceSummary summary = new RoomInstanceSummary();
        summary.setId(room.getId());
        summary.setHotelId(room.getHotelId());
        summary.setRoomTypeId(room.getRoomTypeId());
        summary.setRoomNumber(room.getRoomNumber());
        summary.setFloor(room.getFloor());
        summary.setStatus(room.getStatus());
        summary.setLastCheckoutTime(room.getLastCheckoutTime());
        summary.setCreatedTime(room.getCreatedTime());
        summary.setUpdatedTime(room.getUpdatedTime());
        return summary;
    }

    public void applyBooking(Booking booking) {
        this.bookingId = booking.getId();
        this.bookingStatus = booking.getStatus();
        this.bookingUserId = booking.getUserId();
        this.bookingGuests = booking.getGuests();
        this.bookingContactName = booking.getContactName();
        this.bookingContactPhone = booking.getContactPhone();
        this.bookingRemark = booking.getRemark();
        this.bookingAmount = booking.getAmount();
        this.checkinTime = booking.getStartTime();
        this.checkoutTime = booking.getEndTime();
    }
}
