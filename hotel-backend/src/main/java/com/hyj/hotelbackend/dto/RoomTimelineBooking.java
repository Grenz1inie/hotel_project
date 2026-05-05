package com.hyj.hotelbackend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class RoomTimelineBooking {
    private Long id;
    private Long roomId;
    private Long roomTypeId;
    private Long userId;
    private String status;
    private Integer guests;
    private BigDecimal amount;
    private String contactName;
    private String contactPhone;
    private String remark;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;
}