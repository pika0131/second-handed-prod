/**
 * 공통 레이아웃 컴포넌트
 *
 * 모든 페이지를 감싸며 공통 헤더·푸터를 제공한다.
 * Outlet으로 하위 라우트 컴포넌트를 렌더링한다.
 *
 * 헤더 배지 (5초마다 폴링):
 *   빨간색  — 채팅 안읽은 메시지 수 (chatApi.getUnreadCounts)
 *   노란색  — 받은 구매 요청 수 (purchaseApi.getReceived)
 *   보라색  — 안읽은 관리자 알림 수 (adminApi.getUnreadCount)
 */

import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Store, PlusCircle, Package, Receipt,
  Shield, LogOut, LogIn, MessageCircle,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { chatApi, purchaseApi, adminApi } from '@/api/client';

/**
 * 헤더 내비게이션 아이템
 * 최대 3가지 색상의 배지를 아이콘 오른쪽 상단에 표시할 수 있다.
 *   badge       — 빨간색 (채팅 안읽음)
 *   yellowBadge — 노란색 (구매 요청)
 *   purpleBadge — 보라색 (관리자 알림)
 */
function NavItem({
  to, icon, label, badge, yellowBadge, purpleBadge,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  yellowBadge?: number;
  purpleBadge?: number;
}) {
  // 0 초과인 배지만 실제로 표시한다.
  const badges = [
    { count: badge ?? 0, color: 'bg-red-500' },
    { count: yellowBadge ?? 0, color: 'bg-yellow-400' },
    { count: purpleBadge ?? 0, color: 'bg-purple-500' },
  ].filter((b) => b.count > 0);

  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-brand-50 text-brand-700' : 'text-stone-600 hover:bg-stone-100'
        }`
      }
    >
      <span className="relative">
        {icon}
        {badges.length > 0 && (
          <span
            className={`absolute -top-2 flex items-center gap-0.5 ${
              badges.length === 1 ? '-right-1.5' : '-right-6'
            }`}
          >
            {badges.map((b, i) => (
              <span
                key={i}
                className={`grid h-3.5 min-w-3.5 place-items-center rounded-full ${b.color} px-0.5 text-[9px] font-bold text-white`}
              >
                {b.count > 99 ? '99+' : b.count}
              </span>
            ))}
          </span>
        )}
      </span>
      {/* sm 미만에서는 텍스트 숨김 — 아이콘만 표시 */}
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  );
}

/** 헤더 + 본문 + 푸터를 포함하는 전체 레이아웃 */
export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  // 헤더 배지 상태
  const [totalUnread, setTotalUnread] = useState(0);       // 채팅 안읽음
  const [pendingReqCount, setPendingReqCount] = useState(0); // 받은 구매 요청
  const [adminUnreadCount, setAdminUnreadCount] = useState(0); // 관리자 알림

  // 5초마다 배지 카운트를 폴링한다. 탭 포커스 시에도 즉시 갱신.
  useEffect(() => {
    if (!user) {
      setTotalUnread(0);
      setPendingReqCount(0);
      setAdminUnreadCount(0);
      return;
    }

    /**
     * 헤더 배지 카운트를 서버에서 동기화한다.
     *  1. chatApi.getUnreadCounts     → 채팅 안읽음 합산 (빨간 배지)
     *  2. purchaseApi.getReceived     → 받은 구매 요청 수 (노란 배지)
     *  3. adminApi.getUnreadCount     → 안읽은 관리자 알림 수 (보라 배지)
     * 각 API는 독립적으로 요청되며 개별 실패는 조용히 무시된다.
     */
    const poll = () => {
      chatApi.getUnreadCounts(user.cno)
        .then((u) => setTotalUnread(u.reduce((sum, x) => sum + x.unreadCount, 0)))
        .catch(() => {});

      purchaseApi.getReceived(user.cno)
        .then((reqs) => setPendingReqCount(reqs.length))
        .catch(() => {});

      adminApi.getUnreadCount(user.cno)
        .then((r) => setAdminUnreadCount(r.count))
        .catch(() => {});
    };

    poll(); // 마운트 시 즉시 1회 실행
    const id = setInterval(poll, 5000);     // 이후 5초 간격으로 반복
    window.addEventListener('focus', poll); // 탭 전환 후 복귀 시 즉시 갱신
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', poll);
    };
  }, [user]);

  return (
    <div className="flex min-h-full flex-col">
      {/* 상단 헤더 — sticky로 스크롤 시 고정 */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">

          {/* 로고 */}
          <Link to="/" className="mr-2 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white">
              <Store className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-stone-900">
              동네장터
            </span>
          </Link>

          {/* 내비게이션 */}
          <nav className="flex items-center gap-1">
            <NavItem to="/" icon={<Store className="h-4 w-4" />} label="홈" />
            {user && (
              <>
                <NavItem to="/sell"     icon={<PlusCircle className="h-4 w-4" />} label="판매하기" />
                <NavItem to="/my-items" icon={<Package className="h-4 w-4" />}    label="내 상품" />
                <NavItem to="/trade"    icon={<Receipt className="h-4 w-4" />}    label="거래기록" />
                <NavItem
                  to="/chat"
                  icon={<MessageCircle className="h-4 w-4" />}
                  label="채팅"
                  badge={totalUnread}
                  yellowBadge={pendingReqCount}
                  purpleBadge={adminUnreadCount}
                />
              </>
            )}
            {isAdmin && (
              <NavItem to="/admin" icon={<Shield className="h-4 w-4" />} label="관리자" />
            )}
          </nav>

          {/* 우측: 프로필 + 로그아웃 / 로그인 버튼 */}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-stone-100"
                >
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold leading-tight text-stone-800">
                      {user.nickname}
                    </p>
                    <p className="text-xs leading-tight text-stone-400">
                      {user.region || '동네 미설정'}
                    </p>
                  </div>
                  {/* 닉네임 첫 글자를 아바타로 표시 */}
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-stone-200 text-sm font-bold text-stone-600">
                    {user.nickname.slice(0, 1)}
                  </span>
                </Link>
                <button
                  onClick={() => { logout(); navigate('/'); }}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-stone-500 hover:bg-stone-100"
                  title="로그아웃"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                <LogIn className="h-4 w-4" />
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 페이지 본문 — Outlet이 하위 라우트를 렌더링 */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-400">
        동네장터 · Spring Boot + Oracle DB 연동 중고거래 데모
      </footer>
    </div>
  );
}
