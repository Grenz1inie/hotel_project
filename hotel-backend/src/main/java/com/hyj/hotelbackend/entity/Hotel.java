package com.hyj.hotelbackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("hotel")
public class Hotel {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String address;

    private String city;

    private String phone;

    @TableField("star_level")
    private Integer starLevel;

    private Integer status;

    private String introduction;

    @TableField("hero_image_url")
    private String heroImageUrl;

    @TableField("created_time")
    private LocalDateTime createdTime;

    @TableField("updated_time")
    private LocalDateTime updatedTime;
}