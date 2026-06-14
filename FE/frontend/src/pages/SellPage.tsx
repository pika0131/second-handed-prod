import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { itemApi } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ItemFormFields } from '@/components/ItemFormFields';

export function SellPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-extrabold text-stone-900">상품 등록</h1>
      <p className="mb-6 text-sm text-stone-500">우리 동네 이웃에게 물건을 팔아보세요</p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <ItemFormFields
        submitLabel="등록하기"
        busy={busy}
        onSubmit={async (form, newFiles) => {
          setBusy(true);
          setError(null);
          try {
            const item = await itemApi.create({ ...form, cno: user.cno });
            // 이미지 업로드 (순서 보장)
            for (const [i, file] of newFiles.entries()) {
              if (file) {
                await itemApi.uploadPic(item.cno, item.itemNo, (i + 1) as 1 | 2 | 3, file);
              }
            }
            navigate('/my-items');
          } catch (err) {
            setError(err instanceof Error ? err.message : '등록에 실패했습니다.');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
