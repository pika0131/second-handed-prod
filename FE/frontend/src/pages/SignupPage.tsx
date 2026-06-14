import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { customerApi } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui';

export function SignupPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    cno: '',
    passwd: '',
    nickname: '',
    phone: '',
    region: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cno || !form.passwd || !form.nickname) {
      setError('회원번호, 비밀번호, 닉네임은 필수입니다.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await customerApi.signup({
        cno: form.cno.trim(),
        passwd: form.passwd,
        nickname: form.nickname.trim(),
        phone: form.phone || null,
        region: form.region || null,
      });
      login(created ?? { ...form, phone: form.phone || null, region: form.region || null });
      navigate('/');
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : '회원가입에 실패했습니다.') +
          ' (백엔드에 POST /api/customers 가 추가되어 있어야 합니다.)',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm pt-6">
      <h1 className="mb-1 text-2xl font-extrabold text-stone-900">회원가입</h1>
      <p className="mb-6 text-sm text-stone-500">동네장터 이웃이 되어보세요</p>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <Field label="회원번호 (CNO)" required>
          <input value={form.cno} onChange={set('cno')} placeholder="예: d202312345" className="input" />
        </Field>
        <Field label="비밀번호" required>
          <input type="password" value={form.passwd} onChange={set('passwd')} className="input" />
        </Field>
        <Field label="닉네임" required>
          <input value={form.nickname} onChange={set('nickname')} placeholder="동네에서 보일 이름" className="input" />
        </Field>
        <Field label="전화번호">
          <input value={form.phone} onChange={set('phone')} placeholder="010-0000-0000" className="input" />
        </Field>
        <Field label="동네">
          <input value={form.region} onChange={set('region')} placeholder="예: 인천 연수구" className="input" />
        </Field>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={busy} className="w-full py-2.5">
          <UserPlus className="h-4 w-4" />
          {busy ? '가입 중…' : '가입하기'}
        </Button>

        <p className="text-center text-sm text-stone-500">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            로그인
          </Link>
        </p>
      </form>

      <style>{`.input{width:100%;border:1px solid #d6d3d1;border-radius:.6rem;padding:.6rem .75rem;font-size:.9rem;outline:none}
      .input:focus{border-color:var(--color-brand-400);box-shadow:0 0 0 3px var(--color-brand-100)}`}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-stone-700">
        {label} {required && <span className="text-brand-500">*</span>}
      </span>
      {children}
    </label>
  );
}
