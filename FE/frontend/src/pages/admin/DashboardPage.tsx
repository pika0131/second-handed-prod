import { useEffect, useMemo, useState } from 'react';
import { Users, Package, CheckCircle2, Clock } from 'lucide-react';
import { customerApi, itemApi } from '@/api/client';
import type { Customer, Item } from '@/api/types';
import { CATEGORIES } from '@/api/types';
import { Price } from '@/components/ui';

export function DashboardPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    itemApi.list().then(setItems).catch(() => {});
    customerApi.list().then(setCustomers).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const done = items.filter((i) => i.sellStatus === '거래 완료');
    return {
      members: customers.length,
      items: items.length,
      done: done.length,
      onSale: items.filter((i) => i.sellStatus === '판매 중').length,
      revenue: done.reduce((s, i) => s + i.price, 0),
    };
  }, [items, customers]);

  const byCategory = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        category: c,
        count: items.filter((i) => i.category === c).length,
      })),
    [items],
  );
  const maxCat = Math.max(1, ...byCategory.map((c) => c.count));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold text-stone-900">대시보드</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<Users className="h-5 w-5" />} label="전체 회원" value={`${stats.members}명`} tone="blue" />
        <Stat icon={<Package className="h-5 w-5" />} label="전체 상품" value={`${stats.items}개`} tone="orange" />
        <Stat icon={<Clock className="h-5 w-5" />} label="판매 중" value={`${stats.onSale}개`} tone="green" />
        <Stat icon={<CheckCircle2 className="h-5 w-5" />} label="거래 완료" value={`${stats.done}건`} tone="purple" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* 카테고리 분포 */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-4 font-bold text-stone-800">카테고리별 상품 분포</h2>
          <div className="space-y-3">
            {byCategory.map((c) => (
              <div key={c.category}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-stone-600">{c.category}</span>
                  <span className="tnum font-semibold text-stone-800">{c.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-brand-400"
                    style={{ width: `${(c.count / maxCat) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 거래 완료 누적 금액 */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-4 font-bold text-stone-800">거래 완료 누적 금액</h2>
          <p className="text-3xl font-extrabold text-stone-900">
            <Price value={stats.revenue} />
          </p>
          <p className="mt-2 text-sm text-stone-500">
            거래 완료 {stats.done}건 기준 합계입니다.
          </p>
          <div className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
            * 신고 처리·일별 거래 그래프 등은 백엔드에 Report·거래 로그 테이블이 추가되면
            연동할 수 있습니다.
          </div>
        </div>
      </div>
    </div>
  );
}

const tones: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-brand-50 text-brand-600',
  green: 'bg-emerald-50 text-emerald-600',
  purple: 'bg-purple-50 text-purple-600',
};
function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: keyof typeof tones;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <span className={`mb-3 inline-grid h-9 w-9 place-items-center rounded-lg ${tones[tone]}`}>
        {icon}
      </span>
      <p className="text-sm text-stone-400">{label}</p>
      <p className="mt-0.5 text-2xl font-extrabold text-stone-900">{value}</p>
    </div>
  );
}
