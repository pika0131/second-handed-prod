package com.example.dbproject.repository;

import com.example.dbproject.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByRoomNoOrderBySentDatetimeAsc(Long roomNo);

    void deleteByRoomNo(Long roomNo);

    // 상대방이 보낸 메시지를 읽음 처리
    @Modifying
    @Transactional
    @Query("UPDATE ChatMessage m SET m.isRead = 'Y' WHERE m.roomNo = :roomNo AND m.sender <> :mySender AND m.isRead = 'N'")
    int markAsRead(@Param("roomNo") Long roomNo, @Param("mySender") String mySender);

    // 특정 채팅방에서 안 읽은 메시지 수 (상대방이 보낸 것 기준)
    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.roomNo = :roomNo AND m.sender <> :mySender AND m.isRead = 'N'")
    Long countUnread(@Param("roomNo") Long roomNo, @Param("mySender") String mySender);
}
