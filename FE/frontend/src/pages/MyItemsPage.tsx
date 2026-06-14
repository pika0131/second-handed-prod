import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, PlusCircle, ImageOff, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { itemApi, purchaseApi } from '@/api/client';
import type { Item, PurchaseReq } from '@/api/types';
import { SELL_STATUSES } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button, Price, StatusBadge, EmptyState } from '@/components/ui';

const TABS = ['전체', ...SELL_STATUSES] as const;

export function MyItemsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('전체');

  // 구매 요청 패널 상태
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [reqMap, setReqMap] = useState<Record<string, PurchaseReq[]>>({});
  const [reqLoading, setReqLoading] = useState(false);

  const load = () => {
    if (!user) return;
    setLoading(true);
    itemApi
      .bySeller(user.cno)
      .catch(() => itemApi.list().then((all) => all.filter((i) => i.cno === user.cno)))
      .then((mine) => setItems(mine ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [user]);

  const filtered = useMemo(
    () => (tab === '전체' ? items : items.filter((i) => i.sellStatus === tab)),
    [items, tab],
  );

  const changeStatus = async (item: Item, status: string) => {
    if (status === '거래 완료' && !confirm('정말 거래를 완료 처리하시겠습니까?')) return;
    setItems((prev) =>
      prev.map((i) => (i.itemNo === item.itemNo ? { ...i, sellStatus: status } : i)),
    );
    try {
      await itemApi.updateStatus(item.cno, item.itemNo, status);
    } catch (e) {
      alert('상태 변경 실패: ' + (e instanceof Error ? e.message : ''));
      load();
    }
  };

  const remove = async (item: Item) => {
    if (!confirm('삭제하면 복구할 수 없습니다. 삭제하시겠습니까?')) return;
    setItems((prev) => prev.filter((i) => i.itemNo !== item.itemNo));
    try {
      await itemApi.remove(item.cno, item.itemNo);
    } catch (e) {
      alert('삭제 실패: ' + (e instanceof Error ? e.message : ''));
      load();
    }
  };

  // 구매 요청 패널 토글 — 열 때마다 최신 데이터 재조회
  const toggleRequests = async (item: Item) => {
    const key = `${item.cno}-${item.itemNo}`;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    setReqLoading(true);
    try {
      const data = await purchaseApi.getByItem(item.cno, item.itemNo);
      setReqMap((prev) => ({ ...prev, [key]: data }));
    } catch {
      setReqMap((prev) => ({ ...prev, [key]: [] }));
    } finally {
      setReqLoading(false);
    }
  };

  // 구매 요청 승인 → 상품 상태 예약 중, 나머지 요청 자동 삭제 (백엔드 처리)
  const handleApprove = async (req: PurchaseReq) => {
    if (
      !confirm(
        `${req.requestCno}님의 구매 요청(${req.reqPrice.toLocaleString()}원)을 승인하시겠습니까?\n승인 시 나머지 구매 요청은 자동으로 삭제됩니다.`,
      )
    )
      return;
    try {
      await purchaseApi.approve(req.requestCno, req.cno, req.itemNo);
      load();
      setExpandedKey(null);
    } catch (e) {
      alert('승인 실패: ' + (e instanceof Error ? e.message : ''));
    }
  };

  // 구매 요청 거절
  const handleReject = async (req: PurchaseReq) => {
    if (!confirm('이 구매 요청을 거절하시겠습니까?')) return;
    const key = `${req.cno}-${req.itemNo}`;
    try {
      await purchaseApi.reject(req.requestCno, req.cno, req.itemNo);
      setReqMap((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).filter((r) => r.requestCno !== req.requestCno),
      }));
    } catch (e) {
      alert('거절 실패: ' + (e instanceof Error ? e.message : ''));
    }
  };

  if (!user) return null;

  return (
    <div>
      <header className="mb-6 flex items-end justify-between border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">내 판매 상품</h1>
          <p className="mt-1 text-sm text-stone-500">등록한 상품을 관리하세요</p>
        </div>
        <Link to="/sell">
          <Button>
            <PlusCircle className="h-4 w-4" />새 상품 등록
          </Button>
        </Link>
      </header>

      <div className="mb-5 flex gap-1 border-b border-stone-200">
        {TABS.map((t) => {
          const count = t === '전체' ? items.length : items.filter((i) => i.sellStatus === t).length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors ${
                tab === t
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              {t} <span className="tnum text-xs">{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 text-center text-stone-400">불러오는 중…</div>
      ) : error ? (
        <EmptyState title="목록을 불러오지 못했습니다" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ImageOff className="h-10 w-10" />}
          title="해당하는 상품이 없습니다"
          action={
            <Link to="/sell">
              <Button variant="outline">첫 상품 등록하기</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const done = item.sellStatus === '거래 완료';
            const itemKey = `${item.cno}-${item.itemNo}`;
            const isExpanded = expandedKey === itemKey;
            const reqs = reqMap[itemKey] ?? [];

            return (
              <div key={itemKey}>
                {/* 상품 행 */}
                <div
                  className={`flex flex-wrap items-center gap-4 border border-stone-200 bg-white p-4 ${
                    isExpanded
                      ? 'rounded-t-2xl border-b-stone-100'
                      : 'rounded-2xl'
                  }`}
                >
                  <Link
                    to={`/items/${item.cno}/${item.itemNo}`}
                    className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-stone-100"
                  >
                    <ImageOff className="h-5 w-5 text-stone-300" />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/items/${item.cno}/${item.itemNo}`}
                        className="truncate font-semibold text-stone-900 hover:text-brand-600"
                      >
                        {item.title}
                      </Link>
                      <StatusBadge status={item.sellStatus} />
                    </div>
                    <p className="mt-0.5 text-sm text-stone-400">
                      {item.category} · {item.tradePlace || '지역 미정'}
                    </p>
                    <Price value={item.price} className="mt-0.5 block font-bold text-stone-800" />
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 판매 중일 때만 구매 요청 패널 토글 */}
                    {item.sellStatus === '판매 중' && (
                      <Button
                        variant="outline"
                        className="flex items-center gap-1 px-3 text-xs"
                        onClick={() => toggleRequests(item)}
                      >
                        구매 요청
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                    <select
                      value={item.sellStatus}
                      onChange={(e) => changeStatus(item, e.target.value)}
                      className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-400"
                    >
                      {SELL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <Link to={done ? '#' : `/my-items/${item.itemNo}/edit`}>
                      <Button variant="outline" disabled={done} className="px-2.5">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="danger" className="px-2.5" onClick={() => remove(item)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* 구매 요청 패널 */}
                {isExpanded && (
                  <div className="rounded-b-2xl border border-t-0 border-stone-200 bg-stone-50 p-4">
                    <h3 className="mb-3 text-sm font-bold text-stone-700">구매 요청 목록</h3>
                    {reqLoading ? (
                      <p className="text-sm text-stone-400">불러오는 중…</p>
                    ) : reqs.length === 0 ? (
                      <p className="text-sm text-stone-400">아직 구매 요청이 없습니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {reqs.map((req) => (
                          <div
                            key={req.requestCno}
                            className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-stone-800">
                                  {req.requestCno}
                                </span>
                                <span className="text-xs text-stone-400">
                                  {new Date(req.reqDateTime).toLocaleString('ko-KR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })}
                                </span>
                              </div>
                              <p className="mt-0.5 text-sm font-bold text-emerald-600">
                                희망가: {req.reqPrice.toLocaleString()}원
                              </p>
                              {req.reqMessage && (
                                <p className="mt-0.5 text-xs text-stone-500 whitespace-pre-wrap">
                                  {req.reqMessage}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <button
                                onClick={() => handleApprove(req)}
                                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                <Check className="h-3 w-3" />
                                승인
                              </button>
                              <button
                                onClick={() => handleReject(req)}
                                className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                              >
                                <X className="h-3 w-3" />
                                거절
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
