package com.example.dbproject.repository;

import com.example.dbproject.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * 회원(Customer) 데이터 접근 레이어
 *
 * Spring Data JPA가 런타임에 구현체를 자동 생성한다.
 * JpaRepository<Customer, String> 상속으로 아래 CRUD 메서드가 기본 제공된다:
 *   - findAll()       : 전체 회원 조회
 *   - findById(cno)   : cno로 단건 조회
 *   - save(entity)    : 저장 / 수정
 *   - existsById(cno) : 존재 여부 확인
 *   - deleteById(cno) : 삭제
 *
 * 추가 쿼리 메서드가 필요하면 이 인터페이스에 선언만 하면 된다.
 * (예: findByNickname(String nickname))
 */
@Repository
public interface CustomerRepository extends JpaRepository<Customer, String> {
    // 현재는 기본 CRUD만 사용. 닉네임·지역 검색 등이 필요하면 메서드 추가.
}
