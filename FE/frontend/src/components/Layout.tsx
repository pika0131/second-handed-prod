import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Store, PlusCircle, Package, Receipt, Shield, LogOut, LogIn, MessageCircle } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
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
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  );
}

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
          <Link to="/" className="mr-2 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white">
              <Store className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-stone-900">
              동네장터
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <NavItem to="/" icon={<Store className="h-4 w-4" />} label="홈" />
            {user && (
              <>
                <NavItem to="/sell" icon={<PlusCircle className="h-4 w-4" />} label="판매하기" />
                <NavItem to="/my-items" icon={<Package className="h-4 w-4" />} label="내 상품" />
                <NavItem to="/trade" icon={<Receipt className="h-4 w-4" />} label="거래기록" />
                <NavItem to="/chat" icon={<MessageCircle className="h-4 w-4" />} label="채팅" />
              </>
            )}
            {isAdmin && (
              <NavItem to="/admin" icon={<Shield className="h-4 w-4" />} label="관리자" />
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <Link to="/profile" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-stone-100">
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold leading-tight text-stone-800">
                      {user.nickname}
                    </p>
                    <p className="text-xs leading-tight text-stone-400">{user.region || '동네 미설정'}</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-stone-200 text-sm font-bold text-stone-600">
                    {user.nickname.slice(0, 1)}
                  </span>
                </Link>
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-400">
        동네장터 · Spring Boot + Oracle DB 연동 중고거래 데모
      </footer>
    </div>
  );
}
