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
 * 회원(Customer) REST API 컨트롤러
 *
 * Base URL: /api/customers
 * CORS: http://localhost:5173 (Vite 개발 서버)
 *
 * 제공 기능:
 *   GET    /             : 전체 회원 목록 (관리자 화면용)
 *   POST   /login        : 로그인
 *   GET    /{cno}        : 단일 회원 조회
 *   PUT    /{cno}        : 프로필 수정 (닉네임, 전화번호, 지역)
 *   POST   /             : 회원가입
 */
@RestController
@RequestMapping("/api/customers")
@CrossOrigin(origins = "http://localhost:5173")
public class CustomerController {

    @Autowired
    private CustomerRepository customerRepository;

    // ── 1. 전체 회원 목록 조회 ────────────────────────────────────
    // 관리자 회원 관리 화면(UsersPage)에서 전체 목록을 표시할 때 사용
    @GetMapping
    public List<Customer> getAllCustomers() {
        return customerRepository.findAll();
    }

    // ── 2. 로그인 ─────────────────────────────────────────────────
    // body: { cno, passwd }
    // 성공 시 Customer 객체 반환, 실패 시 401 + 에러 메시지
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> loginData) {
        String cno    = loginData.get("cno");
        String passwd = loginData.get("passwd");

        Optional<Customer> customerOpt = customerRepository.findById(cno);
        if (customerOpt.isPresent() && customerOpt.get().getPasswd().equals(passwd)) {
            return ResponseEntity.ok(customerOpt.get());
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body("아이디 또는 비밀번호가 틀렸습니다.");
    }

    // ── 3. 단일 회원 조회 ─────────────────────────────────────────
    // 채팅 상대방 닉네임 조회 등에서 사용
    @GetMapping("/{cno}")
    public ResponseEntity<?> getCustomer(@PathVariable String cno) {
        return customerRepository.findById(cno)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("존재하지 않는 회원입니다."));
    }

    // ── 4. 프로필 수정 ────────────────────────────────────────────
    // body: { nickname, phone, region }
    // cno(회원번호)는 변경 불가, 닉네임은 null이 아닌 경우에만 수정
    @PutMapping("/{cno}")
    public ResponseEntity<?> updateCustomer(
            @PathVariable String cno,
            @RequestBody Map<String, String> data) {
        return customerRepository.findById(cno).<ResponseEntity<?>>map(customer -> {
            if (data.containsKey("nickname") && data.get("nickname") != null) {
                customer.setNickname(data.get("nickname"));
            }
            customer.setPhone(data.get("phone"));
            customer.setRegion(data.get("region"));
            return ResponseEntity.ok(customerRepository.save(customer));
        }).orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("존재하지 않는 회원입니다."));
    }

    // ── 5. 회원가입 ───────────────────────────────────────────────
    // body: Customer 객체 전체 (cno, passwd, nickname, phone, region)
    // cno 중복 시 409 Conflict 반환
    @PostMapping
    public ResponseEntity<?> signup(@RequestBody Customer customer) {
        if (customerRepository.existsById(customer.getCno())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("이미 존재하는 회원번호입니다.");
        }
        Customer saved = customerRepository.save(customer);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
