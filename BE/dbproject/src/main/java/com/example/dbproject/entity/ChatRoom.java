package com.example.dbproject.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "CHATROOM")
@Getter
@Setter
public class ChatRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ROOMNO")
    private Long roomNo;

    @Column(name = "CNO", length = 10)
    private String cno;           // 판매자 cno (FK_CHAT_ITEM 제약으로 ITEM.CNO 참조)

    @Column(name = "RECEIVECNO", length = 10)
    private String receiveCno;    // 구매자 cno

    @Column(name = "ITEMNO")
    private Long itemNo;

    @Column(name = "CREATEDATETIME")
    private LocalDateTime createDatetime;
}
