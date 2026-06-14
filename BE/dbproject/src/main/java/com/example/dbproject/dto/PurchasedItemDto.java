package com.example.dbproject.dto;

import java.time.LocalDateTime;

public record PurchasedItemDto(
        String cno,
        Long itemNo,
        String title,
        String category,
        Long price,
        Long finalPrice,
        String sellStatus,
        LocalDateTime resDateTime,
        LocalDateTime reqDateTime,
        Long reqPrice
) {}
