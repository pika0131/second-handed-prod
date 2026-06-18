package com.example.dbproject.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * 회원(Customer) 엔티티
 *
 * Oracle DB의 CUSTOMER 테이블과 1:1 매핑된다.
 * cno(회원번호)를 PK로 사용하며, 별도의 자동 채번 없이 회원이 직접 입력한 ID를 그대로 저장한다.
 * 관리자 계정은 cno == "c0" 로 식별한다 (AuthContext.checkAdmin 참고).
 */
@Entity
@Table(name = "CUSTOMER")
@Getter
@Setter
public class Customer {

    /** 회원번호 (Primary Key). 학번 형식 예: d202302618 */
    @Id
    @Column(length = 10)
    private String cno;

    /** 비밀번호 (평문 저장 — 실습 목적, 프로덕션에서는 BCrypt 등 해시 필요) */
    @Column(nullable = false, length = 100)
    private String passwd;

    /** 닉네임 — 전체 회원 중 유일해야 한다 (UNIQUE 제약) */
    @Column(nullable = false, unique = true, length = 50)
    private String nickname;

    /** 연락처 (선택 항목, null 허용) */
    @Column(length = 20)
    private String phone;

    /** 거주 동네 (선택 항목, 예: "인천 연수구 송도동") */
    @Column(length = 100)
    private String region;
}
