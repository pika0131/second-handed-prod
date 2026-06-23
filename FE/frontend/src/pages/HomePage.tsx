/**
 * 홈 화면 (상품 목록)
 *
 * 기능:
 *  - WebSocket(/topic/items, /topic/items/delete)으로 상품 등록·수정·삭제를 실시간 반영
 *  - 다중 검색 조건 빌더: AND / OR / NOT 연산자 지원, 최대 5개 조건
 *    - 필드: 제목+설명 / 제목 / 설명 / 거래 장소 / 가격(범위)
 *  - 카테고리 필터 버튼
 *  - 상태 탭(전체 / 판매 중 / 예약 중 / 거래 완료) — 카운트 표시
 *  - 정렬: 최신순 / 가격 오름차순 / 가격 내림차순
 *    (거래 완료 상품은 정렬 결과 무관하게 항상 후순위)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, PackageOpen, RotateCw, PlusCircle, X } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { itemApi } from '@/api/client';
import type { Item } from '@/api/types';
import { CATEGORIES } from '@/api/types';
import { ItemCard } from '@/components/ItemCard';
import { Button, EmptyState } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';

const STATUS_TABS = ['전체', '판매 중', '예약 중', '거래 완료'] as const;

const SORT_OPTIONS = [
  { label: '최신순',  value: 'latest'     as const },
  { label: '가격↑',  value: 'price_asc'  as const },
  { label: '가격↓',  value: 'price_desc' as const },
];

/** 논리 연산자 — 첫 번째 조건은 op가 무시된다. */
type SearchOp    = 'AND' | 'OR' | 'NOT';
type SearchField = '제목+설명' | '제목' | '설명' | '거래 장소' | '가격';

interface SearchCond {
  id: number;
  op: SearchOp;
  field: SearchField;
  keyword: string; // 텍스트 검색어 ('가격' 필드일 때는 미사용)
  minVal: string;  // 가격 최솟값
  maxVal: string;  // 가격 최댓값
}

export function HomePage() {
  const { user } = useAuth();
  const [items, setItems]     = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // 검색 조건 — id는 React key와 조건 구분에 사용
  const nextId = useRef(1);
  const [conditions, setConditions] = useState<SearchCond[]>([
    { id: 0, op: 'AND', field: '제목+설명', keyword: '', minVal: '', maxVal: '' },
  ]);
  const [category, setCategory] = useState<string>('전체');
  const [status, setStatus]     = useState<(typeof STATUS_TABS)[number]>('전체');
  const [sortBy, setSortBy]     = useState<'latest' | 'price_asc' | 'price_desc'>('latest');

  /**
   * 서버에서 전체 상품 목록을 다시 가져온다.
   * 오류 발생 시 error 상태를 설정하여 EmptyState를 렌더링한다.
   */
  const load = () => {
    setLoading(true);
    setError(null);
    itemApi
      .list()
      .then(setItems)
      .catch((e) => setError(e.message ?? '상품을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // WebSocket 구독 — 상품 등록·수정·상태변경·삭제를 실시간으로 반영
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(`${window.location.origin}/ws`),
      reconnectDelay: 5000,
      onConnect: () => {
        // 등록 / 수정 / 상태 변경 (같은 복합키면 update, 없으면 prepend)
        client.subscribe('/topic/items', (frame) => {
          const updated: Item = JSON.parse(frame.body);
          setItems((prev) => {
            const exists = prev.some(
              (i) => i.cno === updated.cno && i.itemNo === updated.itemNo,
            );
            if (exists) {
              return prev.map((i) =>
                i.cno === updated.cno && i.itemNo === updated.itemNo ? updated : i,
              );
            }
            return [updated, ...prev]; // 새 상품은 목록 맨 앞에 추가
          });
        });

        // 삭제 이벤트 — 복합키로 항목 제거
        client.subscribe('/topic/items/delete', (frame) => {
          const { cno, itemNo } = JSON.parse(frame.body) as { cno: string; itemNo: number };
          setItems((prev) => prev.filter((i) => !(i.cno === cno && i.itemNo === itemNo)));
        });
      },
    });
    client.activate();
    return () => { client.deactivate(); };
  }, []);

  // ── 검색 조건 핸들러 ──────────────────────────────────────────

  /**
   * 특정 조건의 단일 필드 값을 변경한다.
   * @param id  - 변경할 조건의 고유 id
   * @param key - 변경할 필드 이름 (op / field / keyword / minVal / maxVal)
   * @param value - 새 값
   */
  const updateCondition = (id: number, key: keyof SearchCond, value: string) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)),
    );
  };

  /**
   * 새 검색 조건을 목록 끝에 추가한다. (최대 5개)
   * 기본값: op=AND, field=제목+설명, 빈 keyword
   */
  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      { id: nextId.current++, op: 'AND', field: '제목+설명', keyword: '', minVal: '', maxVal: '' },
    ]);
  };

  /**
   * 검색 필드를 변경할 때 기존 입력값(keyword/minVal/maxVal)을 모두 초기화한다.
   * 필드에 따라 사용 가능한 입력 UI가 달라지므로(텍스트 vs 범위) 값이 섞이면 안 된다.
   */
  const handleFieldChange = (id: number, newField: SearchField) => {
    setConditions((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, field: newField, keyword: '', minVal: '', maxVal: '' } : c,
      ),
    );
  };

  /**
   * 특정 조건 행을 삭제한다. (첫 번째 행은 UI에서 삭제 버튼을 표시하지 않음)
   * @param id - 삭제할 조건의 고유 id
   */
  const removeCondition = (id: number) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  // ── 필터링 파이프라인 ─────────────────────────────────────────

  // 1단계: 카테고리 필터
  const categoryFiltered = useMemo(
    () => items.filter((i) => category === '전체' || i.category === category),
    [items, category],
  );

  // 2단계: 검색 조건(AND/OR/NOT) 적용
  const searchFiltered = useMemo(() => {
    // 입력값이 있는 조건만 활성화 ('가격'은 minVal/maxVal, 나머지는 keyword 기준)
    const active = conditions.filter((c) =>
      c.field === '가격' ? c.minVal.trim() || c.maxVal.trim() : c.keyword.trim(),
    );
    if (active.length === 0) return categoryFiltered; // 활성 조건 없으면 그대로 통과

    return categoryFiltered.filter((item) => {
      /**
       * 단일 조건 하나가 특정 상품에 부합하는지 판단한다.
       * - '가격': min/max 범위 검사 (한쪽만 있으면 단방향 비교)
       * - '제목'/'설명'/'거래 장소': 해당 필드에서 소문자 포함 검색
       * - '제목+설명': 제목, 설명, 거래 장소 중 하나라도 포함
       */
      const matchCond = (c: SearchCond): boolean => {
        if (c.field === '가격') {
          const min = c.minVal ? Number(c.minVal) : null;
          const max = c.maxVal ? Number(c.maxVal) : null;
          if (min !== null && max !== null) return item.price >= min && item.price <= max;
          if (min !== null) return item.price >= min;
          if (max !== null) return item.price <= max;
          return true;
        }
        const kw    = c.keyword.toLowerCase();
        const title = item.title.toLowerCase();
        const desc  = (item.description ?? '').toLowerCase();
        const place = (item.tradePlace ?? '').toLowerCase();
        if (c.field === '제목')     return title.includes(kw);
        if (c.field === '설명')     return desc.includes(kw);
        if (c.field === '거래 장소') return place.includes(kw);
        return title.includes(kw) || desc.includes(kw) || place.includes(kw); // '제목+설명'
      };

      // 첫 번째 조건으로 초기값(pass) 설정
      // 나머지 조건을 op(AND/OR/NOT)에 따라 누적 적용
      let pass = matchCond(active[0]);
      for (let i = 1; i < active.length; i++) {
        const m = matchCond(active[i]);
        if      (active[i].op === 'AND') pass = pass && m;  // 둘 다 참이어야 통과
        else if (active[i].op === 'OR')  pass = pass || m;  // 하나라도 참이면 통과
        else                             pass = pass && !m; // NOT: 해당 조건을 만족하지 않는 항목만
      }
      return pass;
    });
  }, [categoryFiltered, conditions]);

  // 3단계: 상태 탭 필터 + 정렬
  // 거래 완료 상품은 sortBy 값에 관계없이 항상 목록 후순위로 밀려난다.
  const filtered = useMemo(() => {
    return searchFiltered
      .filter((i) => status === '전체' || i.sellStatus === status)
      .sort((a, b) => {
        // '거래 완료'인 상품은 정렬 기준 무관하게 뒤로
        const aDone = a.sellStatus === '거래 완료' ? 1 : 0;
        const bDone = b.sellStatus === '거래 완료' ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        // 같은 그룹 내에서 정렬
        if (sortBy === 'price_asc')  return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        return (b.regDateTime ?? '').localeCompare(a.regDateTime ?? ''); // 최신순
      });
  }, [searchFiltered, status, sortBy]);

  return (
    <div>
      {/* 페이지 헤더 */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">동네 중고 상품</h1>
          <p className="mt-1.5 text-stone-500">우리 동네에서 거래되는 따끈따끈한 중고 물품 🛒</p>
        </div>
        <Link to={user ? '/sell' : '/login'}>
          <Button>
            <PackageOpen className="h-4 w-4" />내 상품 등록
          </Button>
        </Link>
      </header>

      {/* 검색/필터 영역 */}
      <div className="mb-5 space-y-3">

        {/* ① 다중 검색 조건 빌더 */}
        <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            검색 조건
          </p>
          {conditions.map((cond, idx) => (
            <div key={cond.id} className="flex flex-wrap items-center gap-2">
              {/* 첫 번째 조건은 연산자 없음 */}
              {idx === 0 ? (
                <span className="w-14 shrink-0 text-center text-xs font-semibold text-stone-400">
                  검색
                </span>
              ) : (
                <select
                  value={cond.op}
                  onChange={(e) => updateCondition(cond.id, 'op', e.target.value)}
                  className="w-14 shrink-0 rounded-lg border border-stone-300 bg-white px-1 py-1.5 text-xs font-bold outline-none focus:border-brand-400"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                  <option value="NOT">NOT</option>
                </select>
              )}

              {/* 검색 필드 선택 */}
              <select
                value={cond.field}
                onChange={(e) => handleFieldChange(cond.id, e.target.value as SearchField)}
                className="shrink-0 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-400"
              >
                <option value="제목+설명">제목+설명</option>
                <option value="제목">제목</option>
                <option value="설명">설명</option>
                <option value="거래 장소">거래 장소</option>
                <option value="가격">가격</option>
              </select>

              {/* 가격: 범위 입력 / 나머지: 키워드 입력 */}
              {cond.field === '가격' ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={cond.minVal}
                    onChange={(e) => updateCondition(cond.id, 'minVal', e.target.value)}
                    placeholder="최소"
                    className="w-28 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                  <span className="shrink-0 text-stone-400">~</span>
                  <input
                    type="number"
                    min={0}
                    value={cond.maxVal}
                    onChange={(e) => updateCondition(cond.id, 'maxVal', e.target.value)}
                    placeholder="최대"
                    className="w-28 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                  <span className="shrink-0 text-sm text-stone-400">원</span>
                </div>
              ) : (
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    value={cond.keyword}
                    onChange={(e) => updateCondition(cond.id, 'keyword', e.target.value)}
                    placeholder="검색어를 입력하세요"
                    className="w-full rounded-xl border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              )}

              {/* 두 번째 조건부터 삭제 버튼 표시 */}
              {idx > 0 && (
                <button
                  onClick={() => removeCondition(cond.id)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}

          {conditions.length < 5 && (
            <button
              onClick={addCondition}
              className="mt-1 flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              조건 추가
            </button>
          )}
        </div>

        {/* ② 정렬 선택 */}
        <div className="flex items-center justify-end gap-1">
          <span className="mr-1 text-sm text-stone-500">정렬</span>
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSortBy(s.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                sortBy === s.value
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ③ 카테고리 필터 버튼 */}
        <div className="flex flex-wrap gap-2">
          {['전체', ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                category === c
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* ④ 상태 탭 — 카운트는 검색/카테고리 필터 적용 후 기준 */}
        <div className="flex gap-1 border-b border-stone-200">
          {STATUS_TABS.map((s) => {
            const count =
              s === '전체'
                ? searchFiltered.length
                : searchFiltered.filter((i) => i.sellStatus === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                  status === s
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                {s} <span className="tnum text-xs">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 본문: 로딩 / 오류 / 빈 결과 / 상품 그리드 */}
      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <EmptyState
          icon={<PackageOpen className="h-10 w-10" />}
          title="상품을 불러오지 못했습니다"
          description={`${error} — 백엔드(localhost:8080)가 실행 중인지 확인해 주세요.`}
          action={
            <Button variant="outline" onClick={load}>
              <RotateCw className="h-4 w-4" />다시 시도
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="h-10 w-10" />}
          title="조건에 맞는 상품이 없습니다"
          description="검색어나 필터를 바꿔보세요."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <ItemCard key={`${item.cno}-${item.itemNo}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 데이터 로딩 중 표시하는 플레이스홀더 그리드 */
function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="h-44 animate-pulse bg-stone-100" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-stone-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
