import { useEffect, useMemo, useState } from 'react';
import {
  Receipt, TrendingUp, Coins, ShoppingBag, ImageOff, ArrowDownCircle,
} from 'lucide-react';
import { salesApi, purchaseApi } from '@/api/client';
import type { CompletedSale, PurchasedItem } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Price, EmptyState } from '@/components/ui';

/* ── 이미지 플레이스홀더 색상 (ItemCard와 동일 로직) ── */
const palette = ['#fde68a', '#bfdbfe', '#bbf7d0', '#fbcfe8', '#ddd6fe', '#fed7aa'];
function tint(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

const PERIODS = [
  { label: '1개월', months: 1 },
  { label: '3개월', months: 3 },
  { label: '6개월', months: 6 },
  { label: '전체', months: 0 },
];

type Tab = 'sell' | 'buy';

export function TradeHistoryPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('sell');

  if (!user) return null;

  return (
    <div>
      <header className="mb-6 border-b border-stone-200 pb-5">
        <h1 className="text-2xl font-extrabold text-stone-900">거래 기록</h1>
        <p className="mt-1 text-sm text-stone-500">완료된 판매 및 구매 내역</p>
      </header>

      {/* 탭 */}
      <div className="mb-6 flex gap-1 rounded-xl bg-stone-100 p-1 w-fit">
        <button
          onClick={() => setTab('sell')}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
            tab === 'sell'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          판매 내역
        </button>
        <button
          onClick={() => setTab('buy')}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
            tab === 'buy'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          구매 내역
        </button>
      </div>

      {tab === 'sell' ? <SellTab cno={user.cno} /> : <BuyTab cno={user.cno} />}
    </div>
  );
}

/* ════════════════ 판매 내역 탭 ════════════════ */
function SellTab({ cno }: { cno: string }) {
  const [sales, setSales] = useState<CompletedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(0);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    salesApi
      .getCompleted(cno)
      .then((data) => setSales(data ?? []))
      .finally(() => setLoading(false));
  }, [cno]);

  const filtered = useMemo(() => {
    const cutoff =
      period === 0 ? 0 : Date.now() - PERIODS[period].months * 30 * 24 * 60 * 60 * 1000;
    return sales
      .filter((s) => {
        if (period === 0) return true;
        const t = new Date(s.resDateTime ?? '').getTime();
        return isNaN(t) ? true : t >= cutoff;
      })
      .filter((s) => (keyword ? s.title.includes(keyword) : true))
      .sort((a, b) => (b.resDateTime ?? '').localeCompare(a.resDateTime ?? ''));
  }, [sales, period, keyword]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, i) => s + (i.finalPrice ?? i.price), 0);
    return {
      count: filtered.length,
      total,
      avg: filtered.length ? Math.round(total / filtered.length) : 0,
    };
  }, [filtered]);

  return (
    <>
      {/* 기간 필터 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {PERIODS.map((p, idx) => (
            <button
              key={p.label}
              onClick={() => setPeriod(idx)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                period === idx
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="상품명 검색"
          className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
      </div>

      {/* 통계 카드 */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<ShoppingBag className="h-5 w-5" />} label="총 판매 건수" value={`${stats.count}건`} />
        <StatCard icon={<Coins className="h-5 w-5" />} label="총 판매 금액" value={<Price value={stats.total} />} />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="평균 판매가" value={<Price value={stats.avg} />} />
      </div>

      {loading ? (
        <div className="py-20 text-center text-stone-400">불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-10 w-10" />}
          title="판매 내역이 없습니다"
          description="거래가 완료되면 여기에 기록됩니다."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="px-4 py-3 font-semibold">상품명</th>
                <th className="px-4 py-3 font-semibold">카테고리</th>
                <th className="px-4 py-3 font-semibold">구매자</th>
                <th className="px-4 py-3 text-right font-semibold">최종 판매가</th>
                <th className="px-4 py-3 text-right font-semibold">등록가</th>
                <th className="px-4 py-3 font-semibold">완료일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((s) => (
                <tr key={`${s.cno}-${s.itemNo}`} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-800">{s.title}</td>
                  <td className="px-4 py-3 text-stone-500">{s.category}</td>
                  <td className="px-4 py-3 text-stone-500">{s.buyerCno ?? '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {s.finalPrice != null ? (
                      <span className="font-semibold text-emerald-600">
                        <Price value={s.finalPrice} />
                      </span>
                    ) : (
                      <Price value={s.price} className="font-semibold" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-stone-400">
                    {s.finalPrice != null ? <Price value={s.price} /> : '-'}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {s.resDateTime ? new Date(s.resDateTime).toLocaleDateString('ko-KR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ════════════════ 구매 내역 탭 ════════════════ */
function BuyTab({ cno }: { cno: string }) {
  const [items, setItems] = useState<PurchasedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    purchaseApi
      .getHistory(cno)
      .then((data) => setItems(data ?? []))
      .finally(() => setLoading(false));
  }, [cno]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => (b.resDateTime ?? '').localeCompare(a.resDateTime ?? '')),
    [items],
  );

  if (loading) return <div className="py-20 text-center text-stone-400">불러오는 중…</div>;

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={<ArrowDownCircle className="h-10 w-10" />}
        title="구매 내역이 없습니다"
        description="거래가 완료된 구매 항목이 여기에 기록됩니다."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((item) => (
        <div
          key={`${item.cno}-${item.itemNo}`}
          className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4"
        >
          {/* 이미지 플레이스홀더 */}
          <div
            className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: tint(item.title) }}
          >
            <ImageOff className="h-5 w-5 text-black/20" />
          </div>

          {/* 정보 */}
          <div className="flex flex-1 flex-col gap-0.5 min-w-0">
            <p className="truncate font-semibold text-stone-900">{item.title}</p>
            <p className="text-xs text-stone-400">{item.category}</p>
          </div>

          {/* 가격 + 날짜 */}
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <span className="font-bold text-stone-900">
              <Price value={item.finalPrice ?? item.price} />
            </span>
            <span className="text-xs text-stone-400">
              {item.resDateTime
                ? new Date(item.resDateTime).toLocaleDateString('ko-KR')
                : '-'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 공용 StatCard ── */
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center gap-2 text-stone-400">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-stone-900">{value}</p>
    </div>
  );
}
