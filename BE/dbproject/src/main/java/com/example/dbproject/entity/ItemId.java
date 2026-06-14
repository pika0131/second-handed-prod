package com.example.dbproject.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class ItemId implements Serializable {
    private String cno;     // 판매자 회원번호
    private Long itemNo;    // 상품 번호
}