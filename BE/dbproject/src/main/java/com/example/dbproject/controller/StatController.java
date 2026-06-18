package com.example.dbproject.controller;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * 통계(Statistics) REST API 컨트롤러 — 관리자 전용
 *
 * Base URL: /api/stats
 * CORS: http://localhost:5173
 *
 * Oracle SQL의 고급 집계 함수를 직접 사용하는 Native Query를 두 개 제공한다.
 * JPA JPQL로 표현하기 어려운 ROLLUP, RANK OVER, SUM OVER 등의 구문을 처리하기 위해
 * EntityManager.createNativeQuery()를 사용한다.
 */
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
     *   - 상세 행:        (카테고리, 판매상태) 별 건수 및 가격 통계
     *   - 카테고리 소계:   판매상태 무관 카테고리 합계  (GROUPING(SELLSTATUS) = 1)
     *   - 전체 합계 행:   모든 상품 합계              (GROUPING(CATEGORY)   = 1)
     *
     * 반환 필드: category, sellStatus, itemCount, avgPrice, totalPrice, maxPrice, minPrice,
     *            grpCategory(집계 여부), grpStatus(집계 여부)
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
            map.put("grpCategory", r[7]); // 1 = category가 집계된 전체 합계 행
            map.put("grpStatus",   r[8]); // 1 = sellStatus가 집계된 소계 행
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * ② 윈도우 함수 — 판매자별 거래 완료 금액 랭킹 (RANK OVER + SUM OVER)
     *
     * RANK() OVER (ORDER BY 총매출 DESC):
     *   판매자를 총 매출 기준으로 순위를 매긴다. 동률이면 같은 순위가 부여된다.
     *
     * SUM(FINALPRICE) / SUM(SUM(FINALPRICE)) OVER ():
     *   개인 매출을 전체 매출 합계로 나눠 비중(%)을 계산한다.
     *   내부 SUM()은 GROUP BY 집계, 외부 OVER ()는 모든 행의 합계를 참조하는 윈도우 함수다.
     *
     * 반환 필드: cno, soldCount, totalRevenue, revenueRank, revenueShare(%)
     */
    @SuppressWarnings("unchecked")
    @GetMapping("/seller-rank")
    public ResponseEntity<List<Map<String, Object>>> getSellerRank() {
        String sql = """
                SELECT
                  CNO,
                  COUNT(*)                                                            AS SOLD_COUNT,
                  SUM(FINALPRICE)                                                     AS TOTAL_REVENUE,
                  RANK() OVER (ORDER BY SUM(FINALPRICE) DESC)                        AS REVENUE_RANK,
                  ROUND(SUM(FINALPRICE) / SUM(SUM(FINALPRICE)) OVER () * 100, 1)     AS REVENUE_SHARE
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
            map.put("cno",          r[0]);
            map.put("soldCount",    r[1]);
            map.put("totalRevenue", r[2]);
            map.put("revenueRank",  r[3]);
            map.put("revenueShare", r[4]); // 전체 대비 매출 비중 (%)
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }
}
