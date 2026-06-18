/**
 * 관리자 — 회원 관리 페이지
 *
 * URL: /admin/users
 *
 * customerApi.list() 로 전체 회원 목록을 로드한다.
 * keyword 검색: 닉네임 + 회원번호(cno) + 동네(region) 대상 클라이언트 필터 (대소문자 무시).
 *
 * 현재는 조회 전용 (회원 수정/삭제 기능 미구현).
 * 회원 아바타는 닉네임의 첫 글자로 표시한다.
 */

import { useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { customerApi } from '@/api/client';
import type { Customer } from '@/api/types';
import { EmptyState } from '@/components/ui';

export function UsersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    customerApi
      .list()
      .then(setCustomers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  /**
   * keyword를 닉네임, 회원번호(cno), 동네(region)에 대해 소문자 포함 검색으로 필터링한다.
   * keyword가 비어 있으면 전체 목록을 그대로 반환한다.
   */
  const filtered = useMemo(
    () =>
      customers.filter((c) =>
        keyword
          ? (c.nickname + c.cno + (c.region ?? '')).toLowerCase().includes(keyword.toLowerCase())
          : true,
      ),
    [customers, keyword],
  );

  return (
    <div>
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">회원 관리</h1>
          <p className="mt-1 text-sm text-stone-500">전체 {customers.length}명</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="닉네임·회원번호·동네 검색"
            className="w-64 rounded-xl border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400"
          />
        </div>
      </header>

      {loading ? (
        <div className="py-20 text-center text-stone-400">불러오는 중…</div>
      ) : error ? (
        <EmptyState title="회원 목록을 불러오지 못했습니다" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-10 w-10" />} title="회원이 없습니다" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="px-4 py-3 font-semibold">회원</th>
                <th className="px-4 py-3 font-semibold">회원번호</th>
                <th className="px-4 py-3 font-semibold">연락처</th>
                <th className="px-4 py-3 font-semibold">동네</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((c) => (
                <tr key={c.cno} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-stone-200 text-xs font-bold text-stone-600">
                        {c.nickname.slice(0, 1)}
                      </span>
                      <span className="font-semibold text-stone-800">{c.nickname}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 tnum text-stone-500">{c.cno}</td>
                  <td className="px-4 py-3 text-stone-500">{c.phone || '-'}</td>
                  <td className="px-4 py-3 text-stone-500">{c.region || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
