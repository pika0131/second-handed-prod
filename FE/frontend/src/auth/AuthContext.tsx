/**
 * 인증 컨텍스트 (AuthContext)
 *
 * React Context API를 사용해 로그인 상태를 전역으로 관리한다.
 * 로그인 정보는 sessionStorage에 직렬화되어 저장되므로 탭을 닫으면 자동으로 로그아웃된다.
 *
 * 사용법:
 *   - 컴포넌트 트리 최상단에 <AuthProvider> 를 감싼다. (App.tsx 참조)
 *   - 하위 컴포넌트에서 useAuth() 훅으로 user, login, logout, isAdmin을 가져온다.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Customer } from '@/api/types';

/** AuthContext가 제공하는 상태와 액션 */
interface AuthState {
  user: Customer | null; // 로그인한 사용자 정보 (null = 비로그인)
  login: (user: Customer) => void;
  logout: () => void;
  isAdmin: boolean;      // cno === 'c0' 이면 true
}

const AuthContext = createContext<AuthState | null>(null);

// sessionStorage 키 — 브라우저 탭 단위로 세션 유지
const STORAGE_KEY = 'dongne-market-user';

/** 관리자 여부 확인 — cno가 'c0'인 경우만 관리자로 처리한다. */
function checkAdmin(user: Customer | null): boolean {
  return !!user && user.cno === 'c0';
}

/** 앱 전체를 감싸는 인증 Provider */
export function AuthProvider({ children }: { children: ReactNode }) {
  // 새로고침 후에도 로그인 상태를 유지하도록 초기값을 sessionStorage에서 읽는다.
  const [user, setUser] = useState<Customer | null>(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Customer) : null;
  });

  // user 상태가 바뀔 때마다 sessionStorage를 동기화한다.
  useEffect(() => {
    if (user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const value: AuthState = {
    user,
    login:   setUser,
    logout:  () => setUser(null),
    isAdmin: checkAdmin(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 인증 상태를 가져오는 커스텀 훅
 * AuthProvider 바깥에서 호출하면 에러를 던진다.
 */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
