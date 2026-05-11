package com.hyj.hotelbackend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import com.alicp.jetcache.anno.config.EnableMethodCache;

@SpringBootApplication
@EnableScheduling
@EnableMethodCache(basePackages = "com.hyj.hotelbackend")
public class HotelBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(HotelBackendApplication.class, args);
	}

}
