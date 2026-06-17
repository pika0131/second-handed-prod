package com.example.dbproject.repository;

import com.example.dbproject.entity.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    List<ChatRoom> findByCnoOrReceiveCno(String cno, String receiveCno);

    Optional<ChatRoom> findByCnoAndReceiveCnoAndItemNo(String cno, String receiveCno, Long itemNo);

    // 상품 무관하게 판매자-구매자 쌍의 기존 채팅방 조회 (재활용용)
    List<ChatRoom> findByCnoAndReceiveCno(String cno, String receiveCno);

    // 두 사용자 사이의 채팅방 양방향 조회 (역할 무관)
    @Query("SELECT r FROM ChatRoom r WHERE (r.cno = :a AND r.receiveCno = :b) OR (r.cno = :b AND r.receiveCno = :a)")
    List<ChatRoom> findByPair(@Param("a") String a, @Param("b") String b);

    List<ChatRoom> findByCnoAndItemNo(String cno, Long itemNo);

    void deleteByCnoAndItemNo(String cno, Long itemNo);
}
