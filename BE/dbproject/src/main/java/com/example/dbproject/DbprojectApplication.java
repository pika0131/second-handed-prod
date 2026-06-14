package com.example.dbproject;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DbprojectApplication {

	public static void main(String[] args) {
		SpringApplication.run(DbprojectApplication.class, args);
	}

}
