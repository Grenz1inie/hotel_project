package com.hyj.hotelbackend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

@Data
public class RoomTimelineResponse {
    private Long roomTypeId;
    private Long hotelId;
    private String roomTypeName;
    private String roomTypeCode;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime windowStart;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime windowEnd;

    private int page;
    private int size;
    private long total;

    private List<RoomTimelineItem> items = Collections.emptyList();

    public void setItems(List<RoomTimelineItem> items) {
        this.items = items == null ? Collections.emptyList() : items;
    }
}