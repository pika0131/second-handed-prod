import { useState } from 'react';
import { User } from 'lucide-react';
import { customerApi } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui';

export function ProfilePage() {
  const { user, login } = useAuth();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [region, setRegion] = useState(user?.region ?? '');

  if (!user) return null;

  const startEdit = () => {
    setNickname(user.nickname);
    setPhone(user.phone ?? '');
    setRegion(user.region ?? '');
    setError(null);
    setSuccess(false);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('닉네임을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await customerApi.update(user.cno, {
        nickname: nickname.trim(),
        phone: phone.trim() || null,
        region: region.trim() || null,
      });
      login(updated);
      setEditing(false);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm pt-4">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-stone-200 text-2xl font-bold text-stone-600">
          {user.nickname.slice(0, 1)}
        </span>
        <h1 className="text-2xl font-extrabold text-stone-900">내 프로필</h1>
      </div>

      {success && !editing && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">저장되었습니다.</p>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        {editing ? (
          <form onSubmit={submit} className="space-y-4">
            <Field label="회원번호">
              <input value={user.cno} disabled className="input bg-stone-50 text-stone-400 cursor-not-allowed" />
            </Field>
            <Field label="닉네임">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoFocus
                className="input"
              />
            </Field>
            <Field label="전화번호">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="input"
              />
            </Field>
            <Field label="지역">
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="예: 서울 강남구"
                className="input"
              />
            </Field>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="flex-1 py-2.5">
                {busy ? '저장 중…' : '저장'}
              </Button>
              <button
                type="button"
                onClick={cancel}
                className="flex-1 rounded-xl border border-stone-300 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50"
              >
                취소
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <InfoRow label="회원번호" value={user.cno} />
            <InfoRow label="닉네임" value={user.nickname} />
            <InfoRow label="전화번호" value={user.phone || '—'} />
            <InfoRow label="지역" value={user.region || '—'} />

            <button
              onClick={startEdit}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <User className="h-4 w-4" />
              프로필 수정
            </button>
          </div>
        )}
      </div>

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-stone-100 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-stone-500">{label}</span>
      <span className="text-sm font-semibold text-stone-800">{value}</span>
    </div>
  );
}
