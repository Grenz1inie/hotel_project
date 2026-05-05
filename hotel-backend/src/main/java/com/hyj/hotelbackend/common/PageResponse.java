package com.hyj.hotelbackend.common;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> {
    private List<T> items;
    private long page;
    private long size;
    private long total;

    public static <T> PageResponse<T> of(List<T> items, long page, long size, long total) {
        return new PageResponse<>(items, page, size, total);
    }
}

