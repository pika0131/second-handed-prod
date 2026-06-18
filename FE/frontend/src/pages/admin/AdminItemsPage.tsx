/**
 * 관리자 — 상품 관리 페이지
 *
 * URL: /admin/items
 * 관리자(cno === 'c0')만 접근 가능 (AdminLayout에서 검증).
 *
 * 기능:
 *  - 전체 상품 목록 조회 + 상태/카테고리/키워드 복합 필터
 *  - 상품 삭제: adminApi.deleteItem(cno, itemNo, reason) → 판매자에게 AdminMsg 알림 전송
 *  - 검토 중 설정: adminApi.setReview(cno, itemNo, reason) → 상태를 '검토 중'으로 변경
 *
 * 공용 모달(ModalType):
 *  - 'delete': 삭제 이유 입력 → adminApi.deleteItem
 *  - 'review': 검토 사유 입력 → adminApi.setReview
 *  두 타입은 reason 입력 UI를 공유하고 isDelete 플래그로 분기한다.
 */

import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Package, X, Eye } from 'lucide-react';
import { itemApi, adminApi } from '@/api/client';
import type { Item } from '@/api/types';
import { CATEGORIES } from '@/api/types';
import { Price, StatusBadge, Button, EmptyState } from '@/components/ui';

const STATUS_TABS = ['전체', '판매 중', '예약 중', '거래 완료', '검토 중'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

type ModalType = 'delete' | 'review';

export function AdminItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('전체');
  const [statusTab, setStatusTab] = useState<StatusTab>('전체');

  // 공용 모달 상태
  const [modalTarget, setModalTarget] = useState<Item | null>(null);
  const [modalType, setModalType] = useState<ModalType>('delete');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /** 전체 상품 목록을 서버에서 다시 로드한다. */
  const load = () => {
    setLoading(true);
    itemApi
      .list()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  /**
   * 상태 탭, 카테고리, 키워드를 복합 적용하여 표시할 상품 목록을 계산한다.
   * 키워드는 상품명(title) + 판매자 ID(cno) 대상으로 검색한다.
   */
  const filtered = useMemo(
    () =>
      items
        .filter((i) => (statusTab === '전체' ? true : i.sellStatus === statusTab))
        .filter((i) => (category === '전체' ? true : i.category === category))
        .filter((i) => (keyword ? (i.title + i.cno).includes(keyword) : true)),
    [items, statusTab, category, keyword],
  );

  /**
   * 대상 상품과 모달 유형을 설정하고 모달을 연다.
   * @param item - 삭제 또는 검토 대상 상품
   * @param type - 'delete' | 'review'
   */
  const openModal = (item: Item, type: ModalType) => {
    setModalTarget(item);
    setModalType(type);
    setReason('');
  };

  /** 모달을 닫고 모달 관련 상태를 초기화한다. */
  const closeModal = () => {
    setModalTarget(null);
    setReason('');
  };

  /**
   * 모달에서 확인 버튼을 눌렀을 때 실행한다.
   * - 'delete': adminApi.deleteItem 호출 → 로컬 목록에서 해당 상품 제거
   * - 'review': adminApi.setReview 호출 → 로컬 목록에서 해당 상품의 sellStatus를 '검토 중'으로 변경
   * reason이 비어 있으면 아무것도 하지 않는다.
   */
  const handleSubmit = async () => {
    if (!modalTarget || !reason.trim()) return;
    setSubmitting(true);
    try {
      if (modalType === 'delete') {
        await adminApi.deleteItem(modalTarget.cno, modalTarget.itemNo, reason.trim());
        // Optimistic update: 목록에서 즉시 제거
        setItems((prev) =>
          prev.filter(
            (i) => !(i.cno === modalTarget.cno && i.itemNo === modalTarget.itemNo),
          ),
        );
      } else {
        await adminApi.setReview(modalTarget.cno, modalTarget.itemNo, reason.trim());
        // 해당 상품의 판매 상태를 '검토 중'으로 업데이트
        setItems((prev) =>
          prev.map((i) =>
            i.cno === modalTarget.cno && i.itemNo === modalTarget.itemNo
              ? { ...i, sellStatus: '검토 중' }
              : i,
          ),
        );
      }
      closeModal();
    } catch (e) {
      alert((modalType === 'delete' ? '삭제' : '검토 설정') + ' 실패: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setSubmitting(false);
    }
  };

  const isDelete = modalType === 'delete';

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold text-stone-900">상품 관리</h1>
        <p className="mt-1 text-sm text-stone-500">전체 {items.length}개 상품</p>
      </header>

      {/* 상태 필터 탭 */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-stone-200 pb-px">
        {STATUS_TABS.map((tab) => {
          const count = tab === '전체' ? items.length : items.filter((i) => i.sellStatus === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`-mb-px shrink-0 border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors ${
                statusTab === tab
                  ? tab === '검토 중'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-brand-500 text-brand-600'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              {tab}{' '}
              <span className="tnum text-xs">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 검색·카테고리 필터 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="상품명·판매자 검색"
            className="w-60 rounded-xl border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
        >
          {['전체', ...CATEGORIES].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-20 text-center text-stone-400">불러오는 중…</div>
      ) : error ? (
        <EmptyState title="상품 목록을 불러오지 못했습니다" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Package className="h-10 w-10" />} title="상품이 없습니다" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="px-4 py-3 font-semibold">상품명</th>
                <th className="px-4 py-3 font-semibold">카테고리</th>
                <th className="px-4 py-3 text-right font-semibold">가격</th>
                <th className="px-4 py-3 font-semibold">판매자</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((i) => {
                const alreadyReview = i.sellStatus === '검토 중';
                const done = i.sellStatus === '거래 완료';
                return (
                  <tr key={`${i.cno}-${i.itemNo}`} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium text-stone-800">{i.title}</td>
                    <td className="px-4 py-3 text-stone-500">{i.category}</td>
                    <td className="px-4 py-3 text-right">
                      <Price value={i.price} className="font-semibold" />
                    </td>
                    <td className="px-4 py-3 tnum text-stone-500">{i.cno}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={i.sellStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* 검토 중으로 변경 버튼 — 이미 검토 중이거나 거래 완료면 비활성 */}
                        <button
                          onClick={() => openModal(i, 'review')}
                          disabled={alreadyReview || done}
                          title="검토 중으로 변경"
                          className="grid h-8 w-8 place-items-center rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <Button
                          variant="danger"
                          className="px-2.5 py-1.5"
                          onClick={() => openModal(i, 'delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 공용 모달 (삭제 / 검토 중 설정) */}
      {modalTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-900">
                {isDelete ? '상품 삭제' : '검토 중으로 변경'}
              </h2>
              <button
                onClick={closeModal}
                className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`mt-3 rounded-xl px-4 py-3 ${isDelete ? 'bg-red-50' : 'bg-purple-50'}`}>
              <p className="font-semibold text-stone-800">{modalTarget.title}</p>
              <p className="mt-0.5 text-xs text-stone-500">판매자: {modalTarget.cno}</p>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-stone-700">
                {isDelete ? '삭제 이유' : '검토 사유'}{' '}
                <span className="text-red-500">*</span>
              </span>
              <p className="mt-0.5 text-xs text-stone-400">
                이 내용은 판매자에게 알림으로 전달됩니다.
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  isDelete
                    ? '예) 불법 상품, 중복 게시, 허위 정보 등 삭제 이유를 입력하세요'
                    : '예) 허위 정보 의심, 추가 확인 필요 등 검토 사유를 입력하세요'
                }
                rows={4}
                maxLength={500}
                autoFocus
                className={`mt-1 w-full resize-none rounded-xl border px-4 py-2.5 text-sm outline-none placeholder:text-stone-400 ${
                  isDelete
                    ? 'border-stone-300 focus:border-red-400'
                    : 'border-stone-300 focus:border-purple-400'
                }`}
              />
              <p className="mt-0.5 text-right text-xs text-stone-400">{reason.length}/500</p>
            </label>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={closeModal} disabled={submitting}>
                취소
              </Button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !reason.trim()}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isDelete
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {submitting
                  ? '처리 중…'
                  : isDelete
                  ? '삭제 및 알림 전송'
                  : '검토 중 설정 및 알림 전송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
