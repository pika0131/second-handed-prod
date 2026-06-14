import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Package } from 'lucide-react';
import { itemApi } from '@/api/client';
import type { Item } from '@/api/types';
import { CATEGORIES } from '@/api/types';
import { Price, StatusBadge, Button, EmptyState } from '@/components/ui';

export function AdminItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('전체');

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

  const remove = async (item: Item) => {
    if (!confirm(`'${item.title}' 상품을 삭제할까요? 복구할 수 없습니다.`)) return;
    setItems((prev) => prev.filter((i) => !(i.cno === item.cno && i.itemNo === item.itemNo)));
    try {
      await itemApi.remove(item.cno, item.itemNo);
    } catch (e) {
      alert('삭제 실패: ' + (e instanceof Error ? e.message : ''));
      load();
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
                    <Button variant="danger" className="px-2.5 py-1.5" onClick={() => remove(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
