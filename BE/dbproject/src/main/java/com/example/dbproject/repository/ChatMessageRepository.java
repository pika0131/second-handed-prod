package com.example.dbproject.repository;

import com.example.dbproject.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 채팅 메시지(ChatMessage) 데이터 접근 레이어
 *
 * 채팅방 번호(roomNo)를 기준으로 메시지를 조회·삭제하며,
 * 읽음 처리와 안읽은 메시지 수 집계를 위한 커스텀 JPQL 쿼리를 포함한다.
 */
@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /**
     * 특정 채팅방의 메시지를 시간순(오래된 것부터)으로 조회.
     * 채팅방 입장 시 전체 대화 내역을 표시할 때 사용한다.
     */
    List<ChatMessage> findByRoomNoOrderBySentDatetimeAsc(Long roomNo);

    /**
     * 특정 채팅방의 모든 메시지 삭제.
     * 상품 삭제 시 연관 채팅방→메시지를 FK 순서에 따라 먼저 삭제하기 위해 사용한다.
     */
    void deleteByRoomNo(Long roomNo);

    /**
     * 채팅방 입장 시 상대방이 보낸 안읽은 메시지를 읽음 처리.
     *
     * @param roomNo   채팅방 번호
     * @param mySender 내 역할 ("S" or "B") — 상대방(sender != mySender)이 보낸 것만 처리
     * @return         업데이트된 행 수
     */
    @Modifying
    @Transactional
    @Query("UPDATE ChatMessage m SET m.isRead = 'Y' " +
           "WHERE m.roomNo = :roomNo AND m.sender <> :mySender AND m.isRead = 'N'")
    int markAsRead(@Param("roomNo") Long roomNo, @Param("mySender") String mySender);

    /**
     * 특정 채팅방에서 상대방이 보낸 안읽은 메시지 수 조회.
     * Layout 헤더의 채팅 배지와 ChatListPage의 unreadMap에 사용한다.
     *
     * @param roomNo   채팅방 번호
     * @param mySender 내 역할 ("S" or "B")
     * @return         안읽은 메시지 수
     */
    @Query("SELECT COUNT(m) FROM ChatMessage m " +
           "WHERE m.roomNo = :roomNo AND m.sender <> :mySender AND m.isRead = 'N'")
    Long countUnread(@Param("roomNo") Long roomNo, @Param("mySender") String mySender);
}
