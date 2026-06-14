package com.example.dbproject.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "MESSAGE")
@Getter
@Setter
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SEQNO")
    private Long seqNo;

    @Column(name = "ROOMNO", nullable = false)
    private Long roomNo;

    // 'S' = 판매자(Seller), 'B' = 구매자(Buyer)
    @Column(name = "SENDER", length = 1, nullable = false)
    private String sender;

    @Column(name = "SENTDATETIME")
    private LocalDateTime sentDatetime;

    @Column(name = "CONTENT", length = 2000, nullable = false)
    private String content;

    // 'Y' = 읽음, 'N' = 안읽음
    @Column(name = "ISREAD", length = 1)
    private String isRead;
}
