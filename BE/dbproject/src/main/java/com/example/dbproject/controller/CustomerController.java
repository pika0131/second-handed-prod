package com.example.dbproject.controller;

import com.example.dbproject.entity.Customer;
import com.example.dbproject.repository.CustomerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 기존 CustomerController.java에 회원가입(POST /api/customers) 1개를 추가했습니다.
 * 기존 파일을 이 내용으로 교체하면 됩니다.
 */
@RestController
@RequestMapping("/api/customers")
@CrossOrigin(origins = "http://localhost:5173")
public class CustomerController {

    @Autowired
    private CustomerRepository customerRepository;

    // 1. 전체 고객 목록 조회 (기존) — 관리자 회원 관리 화면에서 사용
    @GetMapping
    public List<Customer> getAllCustomers() {
        return customerRepository.findAll();
    }

    // 2. 로그인 (기존)
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> loginData) {
        String cno = loginData.get("cno");
        String passwd = loginData.get("passwd");

        Optional<Customer> customerOpt = customerRepository.findById(cno);
        if (customerOpt.isPresent()) {
            Customer customer = customerOpt.get();
            if (customer.getPasswd().equals(passwd)) {
                return ResponseEntity.ok(customer);
            }
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("아이디 또는 비밀번호가 틀렸습니다.");
    }

    // 3. 단일 고객 조회
    @GetMapping("/{cno}")
    public ResponseEntity<?> getCustomer(@PathVariable String cno) {
        return customerRepository.findById(cno)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body("존재하지 않는 회원입니다."));
    }

    // 4. 프로필 수정 (닉네임, 전화번호, 지역)
    @PutMapping("/{cno}")
    public ResponseEntity<?> updateCustomer(@PathVariable String cno, @RequestBody Map<String, String> data) {
        return customerRepository.findById(cno).<ResponseEntity<?>>map(customer -> {
            if (data.containsKey("nickname") && data.get("nickname") != null) {
                customer.setNickname(data.get("nickname"));
            }
            customer.setPhone(data.get("phone"));
            customer.setRegion(data.get("region"));
            return ResponseEntity.ok(customerRepository.save(customer));
        }).orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body("존재하지 않는 회원입니다."));
    }

    // 5. 회원가입
    @PostMapping
    public ResponseEntity<?> signup(@RequestBody Customer customer) {
        if (customerRepository.existsById(customer.getCno())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("이미 존재하는 회원번호입니다.");
        }
        Customer saved = customerRepository.save(customer);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
