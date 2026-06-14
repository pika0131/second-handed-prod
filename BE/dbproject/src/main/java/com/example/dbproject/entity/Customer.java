package com.example.dbproject.entity; 

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "Customer") // 오라클 DB의 Customer 테이블과 연결
@Getter
@Setter
public class Customer {

    @Id // 기본키(Primary Key) 설정
    @Column(length = 10)
    private String cno;

    @Column(nullable = false, length = 100)
    private String passwd;

    @Column(nullable = false, unique = true, length = 50)
    private String nickname;

    @Column(length = 20)
    private String phone;

    @Column(length = 100)
    private String region;
}