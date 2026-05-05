package com.hyj.hotelbackend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 房型某日可用性响应 DTO。
 * 公开接口专用，仅包含时间段信息，不暴露任何客户敏感数据。
 */
@Data
public class RoomDayAvailabilityResponse {

    /** 房型 ID */
    private Long roomTypeId;

    /** 查询日期 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate date;

    /** 该房型的房间实例总数，用于前端计算「全满」阈值 */
    private int totalRooms;

    /** 当日活跃预订的时间段列表（仅含 startTime / endTime） */
    private List<Period> periods;

    /**
     * 预订时间段（只含开始和结束时间，不包含任何客户信息）。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Period {

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime startTime;

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime endTime;
    }
}
