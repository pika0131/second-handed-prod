package com.example.dbproject.dto;

import java.time.LocalDateTime;

public record ReceivedPurchaseReqDto(
        String requestCno,
        String cno,
        Long itemNo,
        String itemTitle,
        Long reqPrice,
        String reqMessage,
        LocalDateTime reqDateTime
) {}
