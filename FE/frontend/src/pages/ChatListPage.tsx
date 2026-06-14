import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ChevronRight, Package } from 'lucide-react';
import { chatApi } from '@/api/client';
import type { ChatRoom, UnreadCount } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState } from '@/components/ui';

function formatDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return '방금 전';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export function ChatListPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      chatApi.getRoomsForUser(user.cno),
      chatApi.getUnreadCounts(user.cno),
    ])
      .then(([r, u]: [ChatRoom[], UnreadCount[]]) => {
        const sorted = [...r].sort(
          (a, b) =>
            new Date(b.createDatetime).getTime() - new Date(a.createDatetime).getTime()
        );
        setRooms(sorted);
        setUnreadMap(
          Object.fromEntries(u.map((x) => [x.roomNo, x.unreadCount]))
        );
      })
      .catch((e) => setError(e.message ?? '채팅 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading)
    return <div className="py-20 text-center text-stone-400">불러오는 중…</div>;

  if (error)
    return <div className="py-20 text-center text-red-500">{error}</div>;

  if (rooms.length === 0)
    return (
      <EmptyState
        title="채팅 내역이 없습니다"
        description="상품 페이지에서 '채팅으로 거래하기'를 눌러 대화를 시작해보세요."
        action={
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            상품 보러 가기
          </Link>
        }
      />
    );

  return (
    <div>
      <h1 className="mb-6 text-xl font-extrabold text-stone-900">채팅</h1>
      <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
        {rooms.map((room) => {
          // DB: room.cno = 판매자, room.receiveCno = 구매자
          const isBuyer = room.receiveCno === user?.cno;
          const partnerCno = isBuyer ? room.cno : room.receiveCno;
          const myRole = isBuyer ? '구매자' : '판매자';
          const unread = unreadMap[room.roomNo] ?? 0;

          return (
            <Link
              key={room.roomNo}
              to={`/chat/${room.roomNo}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-stone-50"
            >
              <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-brand-100 text-brand-600">
                <MessageCircle className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-stone-800">
                    {partnerCno}
                  </span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                    {myRole}로 참여
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-400">
                  <Package className="h-3 w-3" />
                  상품 #{room.itemNo}
                  <span className="mx-1">·</span>
                  {formatDate(room.createDatetime)}
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                {unread > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1.5 text-xs font-bold text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-stone-300" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
