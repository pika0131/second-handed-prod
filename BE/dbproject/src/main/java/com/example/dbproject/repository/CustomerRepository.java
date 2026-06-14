package com.example.dbproject.repository; 

import com.example.dbproject.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, String> {
    // JpaRepository를 상속받으면 기본적인 CRUD(생성, 조회, 수정, 삭제) 기능이 자동 완성됩니다!
}