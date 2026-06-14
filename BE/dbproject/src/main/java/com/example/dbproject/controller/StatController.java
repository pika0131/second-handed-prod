package com.example.dbproject.controller;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/stats")
@CrossOrigin(origins = "http://localhost:5173")
public class StatController {

    @PersistenceContext
    private EntityManager em;

    /**
     * ① 그룹 함수 — 카테고리 × 판매상태별 상품 통계 (ROLLUP)
     *
     * ROLLUP(CATEGORY, SELLSTATUS)를 사용해 아래 세 수준의 소계를 한 번에 조회한다.
     *   - 상세: (카테고리, 판매상태) 별 건수 및 가격 통계
     *   - 카테고리 소계: 판매상태 무관 카테고리 합계  (GROUPING(SELLSTATUS) = 1)
     *   - 전체 합계: 모든 상품 합계                  (GROUPING(CATEGORY) = 1)
     */
    @SuppressWarnings("unchecked")
    @GetMapping("/category-group")
    public ResponseEntity<List<Map<String, Object>>> getCategoryGroup() {
        String sql = """
                SELECT
                  CATEGORY,
                  SELLSTATUS,
                  COUNT(*)              AS ITEM_COUNT,
                  ROUND(AVG(PRICE))     AS AVG_PRICE,
                  SUM(PRICE)            AS TOTAL_PRICE,
                  MAX(PRICE)            AS MAX_PRICE,
                  MIN(PRICE)            AS MIN_PRICE,
                  GROUPING(CATEGORY)    AS GRP_CATEGORY,
                  GROUPING(SELLSTATUS)  AS GRP_STATUS
                FROM ITEM
                GROUP BY ROLLUP(CATEGORY, SELLSTATUS)
                ORDER BY
                  GROUPING(CATEGORY)   ASC,
                  CATEGORY             NULLS LAST,
                  GROUPING(SELLSTATUS) ASC,
                  SELLSTATUS           NULLS LAST
                """;

        List<Object[]> rows = (List<Object[]>) em.createNativeQuery(sql).getResultList();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] r : rows) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("category",    r[0]);
            map.put("sellStatus",  r[1]);
            map.put("itemCount",   r[2]);
            map.put("avgPrice",    r[3]);
            map.put("totalPrice",  r[4]);
            map.put("maxPrice",    r[5]);
            map.put("minPrice",    r[6]);
            map.put("grpCategory", r[7]);
            map.put("grpStatus",   r[8]);
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * ② 윈도우 함수 — 판매자별 거래 완료 금액 랭킹 (RANK OVER + SUM OVER)
     *
     * RANK() OVER (ORDER BY 총매출 DESC): 판매자를 총 매출 기준으로 순위 부여
     * SUM(FINALPRICE) / SUM(SUM(FINALPRICE)) OVER (): 전체 대비 매출 비중(%) 계산
     */
    @SuppressWarnings("unchecked")
    @GetMapping("/seller-rank")
    public ResponseEntity<List<Map<String, Object>>> getSellerRank() {
        String sql = """
                SELECT
                  CNO,
                  COUNT(*)         AS SOLD_COUNT,
                  SUM(FINALPRICE)  AS TOTAL_REVENUE,
                  RANK() OVER (ORDER BY SUM(FINALPRICE) DESC)                                AS REVENUE_RANK,
                  ROUND(SUM(FINALPRICE) / SUM(SUM(FINALPRICE)) OVER () * 100, 1)            AS REVENUE_SHARE
                FROM ITEM
                WHERE SELLSTATUS = '거래 완료'
                  AND FINALPRICE IS NOT NULL
                GROUP BY CNO
                ORDER BY REVENUE_RANK
                """;

        List<Object[]> rows = (List<Object[]>) em.createNativeQuery(sql).getResultList();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] r : rows) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("cno",           r[0]);
            map.put("soldCount",     r[1]);
            map.put("totalRevenue",  r[2]);
            map.put("revenueRank",   r[3]);
            map.put("revenueShare",  r[4]);
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }
}
