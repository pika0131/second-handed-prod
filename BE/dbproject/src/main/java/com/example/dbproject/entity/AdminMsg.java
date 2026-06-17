package com.example.dbproject.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "ADMIN_MSG")
@Getter
@Setter
public class AdminMsg {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "MSGID")
    private Long msgId;

    @Column(name = "SELLERCNO", nullable = false, length = 10)
    private String sellerCno;

    @Column(name = "ITEMTITLE", nullable = false, length = 300)
    private String itemTitle;

    @Column(name = "REASON", nullable = false, length = 2000)
    private String reason;

    @Column(name = "SENTAT", nullable = false)
    private LocalDateTime sentAt;

    @Column(name = "ISREAD", nullable = false, length = 1)
    private String isRead;
}
