package com.example.dbproject.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "PURCHASEREQ")
@IdClass(PurchaseReqId.class)
@Getter
@Setter
public class PurchaseReq {

    @Id
    @Column(name = "REQUESTCNO", length = 10)
    private String requestCno;

    @Id
    @Column(name = "CNO", length = 10)
    private String cno;

    @Id
    @Column(name = "ITEMNO")
    private Long itemNo;

    @Column(name = "REQDATETIME")
    private LocalDateTime reqDateTime;

    @Column(name = "REQPRICE")
    private Long reqPrice;

    @Column(name = "REQMESSAGE", length = 1000)
    private String reqMessage;
}
