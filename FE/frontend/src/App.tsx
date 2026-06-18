/**
 * 루트 컴포넌트 — 라우팅 구조 정의
 *
 * 라우팅 구조:
 *   /                 → 로그인 여부에 따라 홈 또는 /login 리다이렉트 (HomeRedirect)
 *   /login            → 로그인 페이지
 *   /signup           → 회원가입 페이지
 *   /items/:cno/:itemNo → 상품 상세 페이지 (비로그인 접근 가능)
 *
 *   [로그인 필요 — RequireAuth로 보호]
 *   /profile          → 프로필 수정
 *   /sell             → 상품 등록
 *   /my-items         → 내 상품 목록 + 구매 요청 관리
 *   /my-items/:itemNo/edit → 상품 수정
 *   /trade            → 거래 내역
 *   /chat             → 채팅 목록
 *   /chat/:roomNo     → 채팅방
 *
 *   [관리자 — AdminLayout 내부에서 별도 접근 제어]
 *   /admin            → 대시보드
 *   /admin/users      → 회원 관리
 *   /admin/items      → 상품 관리
 *   /admin/stats      → 통계
 *
 *   /*                → / 로 리다이렉트
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { Layout } from '@/components/Layout';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { ItemDetailPage } from '@/pages/ItemDetailPage';
import { SellPage } from '@/pages/SellPage';
import { EditItemPage } from '@/pages/EditItemPage';
import { MyItemsPage } from '@/pages/MyItemsPage';
import { TradeHistoryPage } from '@/pages/TradeHistoryPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { AdminItemsPage } from '@/pages/admin/AdminItemsPage';
import { StatsPage } from '@/pages/admin/StatsPage';
import { ChatListPage } from '@/pages/ChatListPage';
import { ChatRoomPage } from '@/pages/ChatRoomPage';

/**
 * 로그인이 필요한 라우트 보호 컴포넌트
 * 비로그인 상태에서 접근하면 /login 으로 리다이렉트하며,
 * 로그인 후 원래 경로로 돌아올 수 있도록 location을 state로 전달한다.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/**
 * 루트(/) 접근 시 로그인 여부에 따라 홈 또는 로그인 페이지로 분기
 */
function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <HomePage />;
}

export default function App() {
  return (
    // AuthProvider: 전체 트리에 인증 컨텍스트 제공
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Layout: 공통 헤더/푸터 — 모든 페이지를 감싼다 */}
          <Route path="/" element={<Layout />}>
            <Route index element={<HomeRedirect />} />
            <Route path="login"  element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />

            {/* 상품 상세는 비로그인도 조회 가능 */}
            <Route path="items/:cno/:itemNo" element={<ItemDetailPage />} />

            {/* 로그인 필요 라우트 */}
            <Route path="profile"             element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="sell"                element={<RequireAuth><SellPage /></RequireAuth>} />
            <Route path="my-items"            element={<RequireAuth><MyItemsPage /></RequireAuth>} />
            <Route path="my-items/:itemNo/edit" element={<RequireAuth><EditItemPage /></RequireAuth>} />
            <Route path="trade"               element={<RequireAuth><TradeHistoryPage /></RequireAuth>} />
            <Route path="chat"                element={<RequireAuth><ChatListPage /></RequireAuth>} />
            <Route path="chat/:roomNo"        element={<RequireAuth><ChatRoomPage /></RequireAuth>} />

            {/* 관리자 라우트 — AdminLayout 내부에서 isAdmin 검사 */}
            <Route path="admin" element={<AdminLayout />}>
              <Route index        element={<DashboardPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="items" element={<AdminItemsPage />} />
              <Route path="stats" element={<StatsPage />} />
            </Route>

            {/* 존재하지 않는 경로는 홈으로 리다이렉트 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
