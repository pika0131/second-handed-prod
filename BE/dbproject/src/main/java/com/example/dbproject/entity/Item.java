package com.example.dbproject.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "ITEM")
@IdClass(ItemId.class)
@Getter
@Setter
public class Item {

    @Id
    @Column(name = "CNO", length = 10)
    private String cno;

    @Id
    @Column(name = "ITEMNO")
    private Long itemNo;

    @Column(name = "TITLE", nullable = false, length = 100)
    private String title;

    @Column(name = "DESCRIPTION", length = 300)
    private String description;

    @Column(name = "CATEGORY", nullable = false, length = 50)
    private String category;

    @Column(name = "PRICE", nullable = false)
    private Long price;

    @Column(name = "TRADEPLACE", length = 200)
    private String tradePlace;

    @Column(name = "REGDATETIME", nullable = false)
    private LocalDateTime regDateTime;

    @Column(name = "RESDATETIME")
    private LocalDateTime resDateTime;

    @Column(name = "SELLSTATUS", length = 20)
    private String sellStatus;

    @Column(name = "FINALPRICE")
    private Long finalPrice;

    // BLOB 필드 — JSON 직렬화 제외
    @JsonIgnore
    @Lob
    @Column(name = "PIC1")
    private byte[] pic1;

    @JsonIgnore
    @Lob
    @Column(name = "PIC2")
    private byte[] pic2;

    @JsonIgnore
    @Lob
    @Column(name = "PIC3")
    private byte[] pic3;

    // JSON에 포함될 URL 필드 (DB 저장 안됨)
    @Transient
    private String pic1Url;

    @Transient
    private String pic2Url;

    @Transient
    private String pic3Url;

    @PostLoad
    private void populateImageUrls() {
        if (pic1 != null && pic1.length > 0)
            this.pic1Url = "/api/items/" + cno + "/" + itemNo + "/pic/1";
        if (pic2 != null && pic2.length > 0)
            this.pic2Url = "/api/items/" + cno + "/" + itemNo + "/pic/2";
        if (pic3 != null && pic3.length > 0)
            this.pic3Url = "/api/items/" + cno + "/" + itemNo + "/pic/3";
    }
}
