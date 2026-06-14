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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <HomePage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomeRedirect />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="items/:cno/:itemNo" element={<ItemDetailPage />} />

            <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="sell" element={<RequireAuth><SellPage /></RequireAuth>} />
            <Route path="my-items" element={<RequireAuth><MyItemsPage /></RequireAuth>} />
            <Route path="my-items/:itemNo/edit" element={<RequireAuth><EditItemPage /></RequireAuth>} />
            <Route path="trade" element={<RequireAuth><TradeHistoryPage /></RequireAuth>} />
            <Route path="chat" element={<RequireAuth><ChatListPage /></RequireAuth>} />
            <Route path="chat/:roomNo" element={<RequireAuth><ChatRoomPage /></RequireAuth>} />

            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="items" element={<AdminItemsPage />} />
              <Route path="stats" element={<StatsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
