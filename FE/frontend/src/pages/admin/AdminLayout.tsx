import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, Package, ShieldAlert, BarChart2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';

const MENU = [
  { to: '/admin', label: '대시보드', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: '회원 관리', icon: Users, end: false },
  { to: '/admin/items', label: '상품 관리', icon: Package, end: false },
  { to: '/admin/stats', label: '통계 질의', icon: BarChart2, end: false },
];

export function AdminLayout() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="flex gap-6">
      <aside className="hidden w-52 shrink-0 sm:block">
        <div className="mb-4 flex items-center gap-2 px-2">
          <ShieldAlert className="h-5 w-5 text-purple-600" />
          <span className="font-bold text-stone-800">관리자</span>
        </div>
        <nav className="space-y-1">
          {MENU.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-purple-600 text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`
              }
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
