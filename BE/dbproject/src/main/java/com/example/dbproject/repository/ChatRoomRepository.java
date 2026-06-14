package com.example.dbproject.repository;

import com.example.dbproject.entity.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    List<ChatRoom> findByCnoOrReceiveCno(String cno, String receiveCno);

    Optional<ChatRoom> findByCnoAndReceiveCnoAndItemNo(String cno, String receiveCno, Long itemNo);

    List<ChatRoom> findByCnoAndItemNo(String cno, Long itemNo);

    void deleteByCnoAndItemNo(String cno, Long itemNo);
}
