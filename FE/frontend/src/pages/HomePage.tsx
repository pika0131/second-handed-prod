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
  { label: '최신순', value: 'latest' as const },
  { label: '가격↑', value: 'price_asc' as const },
  { label: '가격↓', value: 'price_desc' as const },
];

type SearchOp = 'AND' | 'OR' | 'NOT';
type SearchField = '제목+설명' | '제목' | '설명';
interface SearchCond {
  id: number;
  op: SearchOp;
  field: SearchField;
  keyword: string;
}

export function HomePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 검색 조건
  const nextId = useRef(1);
  const [conditions, setConditions] = useState<SearchCond[]>([
    { id: 0, op: 'AND', field: '제목+설명', keyword: '' },
  ]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [category, setCategory] = useState<string>('전체');
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>('전체');
  const [sortBy, setSortBy] = useState<'latest' | 'price_asc' | 'price_desc'>('latest');

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

  // 다른 사용자가 상품 등록 시 실시간 반영
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(`${window.location.origin}/ws`),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe('/topic/items', (frame) => {
          const newItem: Item = JSON.parse(frame.body);
          setItems((prev) => {
            const exists = prev.some(
              (i) => i.cno === newItem.cno && i.itemNo === newItem.itemNo,
            );
            return exists ? prev : [newItem, ...prev];
          });
        });
      },
    });
    client.activate();
    return () => { client.deactivate(); };
  }, []);

  // ── 검색 조건 핸들러 ──────────────────────────────
  const updateCondition = (id: number, key: keyof SearchCond, value: string) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)),
    );
  };

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      { id: nextId.current++, op: 'AND', field: '제목+설명', keyword: '' },
    ]);
  };

  const removeCondition = (id: number) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  // ── 필터링 ───────────────────────────────────────
  // 1단계: 카테고리
  const categoryFiltered = useMemo(
    () => items.filter((i) => category === '전체' || i.category === category),
    [items, category],
  );

  // 2단계: 검색 조건(AND/OR/NOT) + 가격 범위
  const searchFiltered = useMemo(() => {
    let result = categoryFiltered;

    const active = conditions.filter((c) => c.keyword.trim());
    if (active.length > 0) {
      result = result.filter((item) => {
        const matchCond = (c: SearchCond): boolean => {
          const kw = c.keyword.toLowerCase();
          const title = item.title.toLowerCase();
          const desc = (item.description ?? '').toLowerCase();
          const place = (item.tradePlace ?? '').toLowerCase();
          if (c.field === '제목') return title.includes(kw);
          if (c.field === '설명') return desc.includes(kw);
          return title.includes(kw) || desc.includes(kw) || place.includes(kw);
        };

        let pass = matchCond(active[0]);
        for (let i = 1; i < active.length; i++) {
          const m = matchCond(active[i]);
          if (active[i].op === 'AND') pass = pass && m;
          else if (active[i].op === 'OR') pass = pass || m;
          else pass = pass && !m; // NOT
        }
        return pass;
      });
    }

    if (minPrice) result = result.filter((i) => i.price >= Number(minPrice));
    if (maxPrice) result = result.filter((i) => i.price <= Number(maxPrice));

    return result;
  }, [categoryFiltered, conditions, minPrice, maxPrice]);

  // 3단계: 상태 탭 + 정렬
  const filtered = useMemo(() => {
    return searchFiltered
      .filter((i) => status === '전체' || i.sellStatus === status)
      .sort((a, b) => {
        // 거래 완료는 항상 후순위
        const aDone = a.sellStatus === '거래 완료' ? 1 : 0;
        const bDone = b.sellStatus === '거래 완료' ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        return (b.regDateTime ?? '').localeCompare(a.regDateTime ?? '');
      });
  }, [searchFiltered, status, sortBy]);

  return (
    <div>
      {/* 헤더 */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">동네 상품</h1>
          <p className="mt-1.5 text-stone-500">우리 동네에서 거래되는 따끈따끈한 중고 물품</p>
        </div>
        <Link to={user ? '/sell' : '/login'}>
          <Button>
            <PackageOpen className="h-4 w-4" />내 상품 등록
          </Button>
        </Link>
      </header>

      {/* 검색 영역 */}
      <div className="mb-5 space-y-3">

        {/* ① 검색 조건 빌더 (AND / OR / NOT) */}
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
                onChange={(e) => updateCondition(cond.id, 'field', e.target.value)}
                className="shrink-0 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-400"
              >
                <option value="제목+설명">제목+설명</option>
                <option value="제목">제목</option>
                <option value="설명">설명</option>
              </select>

              {/* 검색어 입력 */}
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  value={cond.keyword}
                  onChange={(e) => updateCondition(cond.id, 'keyword', e.target.value)}
                  placeholder="검색어를 입력하세요"
                  className="w-full rounded-xl border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              {/* 조건 삭제 버튼 (첫 번째 제외) */}
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

        {/* ② 가격 범위 + 정렬 */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-600">가격</span>
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="최소"
              className="w-28 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <span className="text-stone-400">~</span>
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="최대"
              className="w-28 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <span className="text-sm text-stone-400">원</span>
          </div>

          <div className="ml-auto flex items-center gap-1">
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
        </div>

        {/* ③ 카테고리 버튼 */}
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

        {/* ④ 상태 탭 — 카운트는 검색/가격 필터 적용 후 기준 */}
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

      {/* 본문 */}
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
