package com.example.dbproject.dto;

import java.time.LocalDateTime;

public record CompletedSaleDto(
        String cno,
        Long itemNo,
        String title,
        String category,
        Long price,
        Long finalPrice,
        LocalDateTime resDateTime,
        String buyerCno
) {}
