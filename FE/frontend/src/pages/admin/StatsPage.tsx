/**
 * 관리자 통계 질의 페이지
 *
 * URL: /admin/stats
 *
 * ① 카테고리별 판매 통계 (그룹 함수 · ROLLUP)
 *    - statsApi.getCategoryGroup() → StatController.getCategoryGroup()
 *    - Oracle: GROUP BY ROLLUP(CATEGORY, SELLSTATUS)
 *    - 행 분류:
 *        grpCategory=1 → 전체 합계 (검정 배경 강조)
 *        grpCategory=0, grpStatus=1 → 카테고리 소계 (회색 배경)
 *        그 외 → 카테고리+상태 상세 행
 *
 * ② 판매자별 거래 완료 매출 랭킹 (윈도우 함수 · RANK / SUM OVER)
 *    - statsApi.getSellerRank() → StatController.getSellerRank()
 *    - Oracle: RANK() OVER (ORDER BY SUM(FINALPRICE) DESC)
 *            + SUM(SUM(FINALPRICE)) OVER () — 전체 대비 비중 계산
 *    - 1~3위는 메달 이모지로 표시
 */

import { useEffect, useState } from 'react';
import { BarChart2, Trophy, RotateCw } from 'lucide-react';
import { statsApi } from '@/api/client';
import type { CategoryGroupStat, SellerRankStat } from '@/api/types';
import { Button } from '@/components/ui';

/** 숫자를 천 단위 쉼표로 포맷, null/undefined는 '-' 반환 */
function fmt(value: number | null | undefined) {
  if (value == null) return '-';
  return Number(value).toLocaleString();
}

export function StatsPage() {
  const [catStats, setCatStats] = useState<CategoryGroupStat[]>([]);
  const [rankStats, setRankStats] = useState<SellerRankStat[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [rankLoading, setRankLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [rankError, setRankError] = useState<string | null>(null);

  /**
   * 카테고리 × 판매상태 ROLLUP 통계를 서버에서 다시 조회한다.
   * 로딩/에러 상태를 관리하며, 새로고침 버튼에도 바인딩된다.
   */
  const loadCat = () => {
    setCatLoading(true);
    setCatError(null);
    statsApi
      .getCategoryGroup()
      .then(setCatStats)
      .catch((e) => setCatError(e.message ?? '조회 실패'))
      .finally(() => setCatLoading(false));
  };

  /**
   * 판매자별 매출 랭킹(윈도우 함수)을 서버에서 다시 조회한다.
   * 거래 완료 건이 없으면 빈 배열이 반환된다.
   */
  const loadRank = () => {
    setRankLoading(true);
    setRankError(null);
    statsApi
      .getSellerRank()
      .then(setRankStats)
      .catch((e) => setRankError(e.message ?? '조회 실패'))
      .finally(() => setRankLoading(false));
  };

  useEffect(() => {
    loadCat();
    loadRank();
  }, []);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-extrabold text-stone-900">거래 기록 통계</h1>

      {/* ─────────────────────────────────────────────────────────
          ① 그룹 함수 — ROLLUP
          카테고리 × 판매상태별 상품 통계 + 소계 + 전체 합계
      ───────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-bold text-stone-800">
              ① 카테고리별 판매 통계
            </h2>
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
              그룹 함수 · ROLLUP
            </span>
          </div>
          <Button variant="outline" onClick={loadCat} className="px-2.5">
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        <p className="mb-3 text-sm text-stone-500">
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">
            GROUP BY ROLLUP(CATEGORY, SELLSTATUS)
          </code>
          &nbsp;— 카테고리·판매상태 상세, 카테고리 소계, 전체 합계를 한 번에 조회합니다.
        </p>

        {catLoading ? (
          <div className="py-10 text-center text-stone-400">불러오는 중…</div>
        ) : catError ? (
          <p className="text-sm text-red-500">{catError}</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-stone-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">카테고리</th>
                  <th className="px-4 py-3 font-semibold">판매상태</th>
                  <th className="px-4 py-3 text-right font-semibold">상품 수</th>
                  <th className="px-4 py-3 text-right font-semibold">평균가</th>
                  <th className="px-4 py-3 text-right font-semibold">최고가</th>
                  <th className="px-4 py-3 text-right font-semibold">최저가</th>
                  <th className="px-4 py-3 text-right font-semibold">가격 합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {catStats.map((row, i) => {
                  const isGrandTotal = row.grpCategory === 1;
                  const isSubtotal   = row.grpCategory === 0 && row.grpStatus === 1;

                  const rowCls = isGrandTotal
                    ? 'bg-stone-800 text-white font-extrabold'
                    : isSubtotal
                    ? 'bg-stone-100 font-bold text-stone-700'
                    : 'text-stone-700';

                  const catLabel = isGrandTotal
                    ? '전체 합계'
                    : isSubtotal
                    ? `${row.category}  (소계)`
                    : row.category ?? '-';

                  const statusLabel = isGrandTotal || isSubtotal ? '-' : row.sellStatus ?? '-';

                  return (
                    <tr key={i} className={rowCls}>
                      <td className={`px-4 py-2.5 ${isSubtotal ? 'pl-6' : isGrandTotal ? '' : 'pl-8'}`}>
                        {catLabel}
                      </td>
                      <td className="px-4 py-2.5">{statusLabel}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(row.itemCount)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(row.avgPrice)}원</td>
                      <td className="px-4 py-2.5 text-right">{fmt(row.maxPrice)}원</td>
                      <td className="px-4 py-2.5 text-right">{fmt(row.minPrice)}원</td>
                      <td className="px-4 py-2.5 text-right">{fmt(row.totalPrice)}원</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────
          ② 윈도우 함수 — RANK OVER + SUM OVER
          판매자별 거래 완료 금액 랭킹
      ───────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold text-stone-800">
              ② 판매자별 거래 완료 매출 랭킹
            </h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              윈도우 함수 · RANK / SUM OVER
            </span>
          </div>
          <Button variant="outline" onClick={loadRank} className="px-2.5">
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        <p className="mb-3 text-sm text-stone-500">
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">
            RANK() OVER (ORDER BY SUM(FINALPRICE) DESC)
          </code>
          &nbsp;+&nbsp;
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">
            SUM(FINALPRICE) / SUM(SUM(FINALPRICE)) OVER ()
          </code>
          &nbsp;— 판매자별 총 매출을 집계하고, 전체 대비 비중과 순위를 함께 표시합니다.
        </p>

        {rankLoading ? (
          <div className="py-10 text-center text-stone-400">불러오는 중…</div>
        ) : rankError ? (
          <p className="text-sm text-red-500">{rankError}</p>
        ) : rankStats.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white py-12 text-center text-sm text-stone-400">
            거래 완료된 상품이 없습니다.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-stone-500">
                <tr>
                  <th className="px-4 py-3 text-center font-semibold">순위</th>
                  <th className="px-4 py-3 font-semibold">판매자 ID</th>
                  <th className="px-4 py-3 text-right font-semibold">완료 건수</th>
                  <th className="px-4 py-3 text-right font-semibold">총 매출</th>
                  <th className="px-4 py-3 text-right font-semibold">매출 비중</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {rankStats.map((row) => {
                  const medal =
                    row.revenueRank === 1 ? '🥇'
                    : row.revenueRank === 2 ? '🥈'
                    : row.revenueRank === 3 ? '🥉'
                    : null;

                  return (
                    <tr key={row.cno} className="hover:bg-stone-50">
                      <td className="px-4 py-3 text-center">
                        {medal ? (
                          <span className="text-base">{medal}</span>
                        ) : (
                          <span className="font-bold text-stone-500">{row.revenueRank}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-stone-800">{row.cno}</td>
                      <td className="px-4 py-3 text-right text-stone-600">
                        {fmt(row.soldCount)}건
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">
                        {fmt(row.totalRevenue)}원
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-stone-100">
                            <div
                              className="h-full rounded-full bg-amber-400"
                              style={{ width: `${Math.min(Number(row.revenueShare), 100)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-stone-600">
                            {Number(row.revenueShare).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
