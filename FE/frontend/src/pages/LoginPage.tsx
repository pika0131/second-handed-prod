import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Store, LogIn } from 'lucide-react';
import { customerApi } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/';
  const [cno, setCno] = useState('');
  const [passwd, setPasswd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cno || !passwd) {
      setError('회원번호와 비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await customerApi.login(cno.trim(), passwd);
      login(user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm pt-6">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-white">
          <Store className="h-7 w-7" />
        </span>
        <h1 className="text-2xl font-extrabold text-stone-900">동네장터 로그인</h1>
        <p className="mt-1 text-sm text-stone-500">회원번호로 로그인하세요</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <Field label="아이디">
          <input
            value={cno}
            onChange={(e) => setCno(e.target.value)}
            placeholder="예: d202302618"
            autoFocus
            className="input"
          />
        </Field>
        <Field label="비밀번호">
          <input
            type="password"
            value={passwd}
            onChange={(e) => setPasswd(e.target.value)}
            placeholder="비밀번호"
            className="input"
          />
        </Field>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <Button type="submit" disabled={busy} className="w-full py-2.5">
          <LogIn className="h-4 w-4" />
          {busy ? '확인 중…' : '로그인'}
        </Button>

        <p className="text-center text-sm text-stone-500">
          계정이 없으신가요?{' '}
          <Link to="/signup" className="font-semibold text-brand-600 hover:underline">
            회원가입
          </Link>
        </p>
      </form>

      <p className="mt-4 text-center text-xs text-stone-400">
        회원번호가 <code className="rounded bg-stone-100 px-1">admin</code> 으로 시작하면 관리자 메뉴가 보입니다.
      </p>

      <style>{`.input{width:100%;border:1px solid #d6d3d1;border-radius:.6rem;padding:.6rem .75rem;font-size:.9rem;outline:none}
      .input:focus{border-color:var(--color-brand-400);box-shadow:0 0 0 3px var(--color-brand-100)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-stone-700">{label}</span>
      {children}
    </label>
  );
}
