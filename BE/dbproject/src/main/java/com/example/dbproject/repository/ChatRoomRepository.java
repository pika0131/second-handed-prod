package com.example.dbproject.repository;

import com.example.dbproject.entity.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 채팅방(ChatRoom) 데이터 접근 레이어
 *
 * 채팅방은 (판매자 cno, 구매자 receiveCno, 상품 itemNo) 조합으로 유일하게 식별된다.
 * DB UNIQUE 제약과 동일한 기준으로 findByCnoAndReceiveCnoAndItemNo()를 사용해
 * 중복 생성을 방지하고 기존 방을 재활용한다.
 *
 * 필드 명칭 규약:
 *   cno       = 판매자(Seller) 회원번호
 *   receiveCno = 구매자(Buyer) 회원번호
 */
@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    /**
     * 특정 회원이 판매자(cno) 또는 구매자(receiveCno)로 참여 중인 채팅방 전체 조회.
     * ChatListPage에서 내 채팅 목록을 불러올 때 사용한다.
     */
    List<ChatRoom> findByCnoOrReceiveCno(String cno, String receiveCno);

    /**
     * 판매자·구매자 쌍으로 채팅방 목록 조회 (상품 구분 없음).
     * 특수 케이스에서 두 사람 사이의 모든 채팅방을 확인할 때 사용한다.
     */
    List<ChatRoom> findByCnoAndReceiveCno(String cno, String receiveCno);

    /**
     * findByCnoAndReceiveCno의 별칭 — 더 의미 있는 이름으로 호출할 수 있도록 제공.
     */
    default List<ChatRoom> findByPair(String cno, String receiveCno) {
        return findByCnoAndReceiveCno(cno, receiveCno);
    }

    /**
     * (판매자, 구매자, 상품) 세 값으로 단일 채팅방 조회.
     * DB의 UNIQUE 제약과 동일한 기준이므로 결과는 항상 0 또는 1건이다.
     * 채팅방 생성 전 중복 확인 및 재활용에 사용한다.
     */
    Optional<ChatRoom> findByCnoAndReceiveCnoAndItemNo(String cno, String receiveCno, Long itemNo);

    /**
     * 특정 판매자의 특정 상품에 연결된 채팅방 목록 조회.
     * 상품 삭제 시 연관 채팅방을 일괄 처리하기 위해 사용한다.
     */
    List<ChatRoom> findByCnoAndItemNo(String cno, Long itemNo);

    /**
     * 특정 판매자의 특정 상품에 연결된 채팅방 전체 삭제.
     * 상품 삭제 플로우에서 메시지 삭제 후 채팅방을 제거할 때 사용한다.
     */
    void deleteByCnoAndItemNo(String cno, Long itemNo);
}
