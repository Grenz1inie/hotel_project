package com.hyj.hotelbackend.controller;

import com.hyj.hotelbackend.entity.Hotel;
import com.hyj.hotelbackend.service.HotelService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/hotel")
public class HotelController {

    @Autowired
    private HotelService hotelService;

    @GetMapping("/primary")
    public Hotel primaryHotel() {
        Hotel hotel = hotelService.getPrimaryHotel();
        if (hotel == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "暂无酒店信息");
        }
        return hotel;
    }

    @GetMapping("/{id}")
    public Hotel getById(@PathVariable Long id) {
        Hotel hotel = hotelService.getById(id);
        if (hotel == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "酒店不存在");
        }
        return hotel;
    }
}