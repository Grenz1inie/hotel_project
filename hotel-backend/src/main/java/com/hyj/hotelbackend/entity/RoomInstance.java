package com.hyj.hotelbackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("room")
public class RoomInstance {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("hotel_id")
    private Long hotelId;

    @TableField("room_type_id")
    private Long roomTypeId;

    @TableField("room_number")
    private String roomNumber;

    private Integer floor;

    private Integer status;

    @TableField("last_checkout_time")
    private LocalDateTime lastCheckoutTime;

    @TableField("created_time")
    private LocalDateTime createdTime;

    @TableField("updated_time")
    private LocalDateTime updatedTime;
}
