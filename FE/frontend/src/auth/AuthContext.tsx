import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Customer } from '@/api/types';

interface AuthState {
  user: Customer | null;
  login: (user: Customer) => void;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = 'dongne-market-user';

// 요구사항: 관리자는 회원번호가 'c0'인 특별한 회원
function checkAdmin(user: Customer | null) {
  return !!user && user.cno === 'c0';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Customer | null>(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Customer) : null;
  });

  useEffect(() => {
    if (user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const value: AuthState = {
    user,
    login: setUser,
    logout: () => setUser(null),
    isAdmin: checkAdmin(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
