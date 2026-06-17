import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Package, X } from 'lucide-react';
import { itemApi, adminApi } from '@/api/client';
import type { Item } from '@/api/types';
import { CATEGORIES } from '@/api/types';
import { Price, StatusBadge, Button, EmptyState } from '@/components/ui';

export function AdminItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('전체');

  // 삭제 모달
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    itemApi
      .list()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(
    () =>
      items
        .filter((i) => (category === '전체' ? true : i.category === category))
        .filter((i) => (keyword ? (i.title + i.cno).includes(keyword) : true)),
    [items, category, keyword],
  );

  const openDeleteModal = (item: Item) => {
    setDeleteTarget(item);
    setReason('');
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setReason('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !reason.trim()) return;
    setDeleting(true);
    try {
      await adminApi.deleteItem(deleteTarget.cno, deleteTarget.itemNo, reason.trim());
      setItems((prev) =>
        prev.filter((i) => !(i.cno === deleteTarget.cno && i.itemNo === deleteTarget.itemNo)),
      );
      closeDeleteModal();
    } catch (e) {
      alert('삭제 실패: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold text-stone-900">상품 관리</h1>
        <p className="mt-1 text-sm text-stone-500">전체 {items.length}개 상품</p>
      </header>

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
              {filtered.map((i) => (
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
                    <Button variant="danger" className="px-2.5 py-1.5" onClick={() => openDeleteModal(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 삭제 이유 모달 */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-900">상품 삭제</h2>
              <button
                onClick={closeDeleteModal}
                className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 rounded-xl bg-red-50 px-4 py-3">
              <p className="font-semibold text-stone-800">{deleteTarget.title}</p>
              <p className="mt-0.5 text-xs text-stone-500">판매자: {deleteTarget.cno}</p>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-stone-700">
                삭제 이유 <span className="text-red-500">*</span>
              </span>
              <p className="mt-0.5 text-xs text-stone-400">
                이 내용은 판매자에게 알림으로 전달됩니다.
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예) 불법 상품, 중복 게시, 허위 정보 등 삭제 이유를 입력하세요"
                rows={4}
                maxLength={500}
                autoFocus
                className="mt-1 w-full resize-none rounded-xl border border-stone-300 px-4 py-2.5 text-sm outline-none placeholder:text-stone-400 focus:border-red-400"
              />
              <p className="mt-0.5 text-right text-xs text-stone-400">{reason.length}/500</p>
            </label>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={closeDeleteModal} disabled={deleting}>
                취소
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={confirmDelete}
                disabled={deleting || !reason.trim()}
              >
                {deleting ? '처리 중…' : '삭제 및 알림 전송'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
