package com.example.dbproject.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class PurchaseReqId implements Serializable {
    private String requestCno;
    private String cno;
    private Long itemNo;
}
