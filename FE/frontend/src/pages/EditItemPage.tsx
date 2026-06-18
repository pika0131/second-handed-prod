/**
 * 상품 수정 페이지
 *
 * URL: /my-items/:itemNo/edit
 * 로그인 필요. URL 파라미터 :itemNo 로 상품 식별.
 *
 * 처리 순서:
 *  1. itemApi.get(cno, itemNo) 로 상품 로드 (실패 시 list() 전체에서 탐색)
 *  2. ItemFormFields에 initial / initialPicUrls 전달
 *  3. onSubmit:
 *     a. itemApi.update() — 메타데이터 수정
 *     b. itemApi.uploadPic() — 새 이미지 슬롯 업로드 (순서 보장)
 *     c. itemApi.deletePic() — 삭제된 슬롯 처리 (새 이미지가 없는 슬롯만)
 *     d. /my-items 로 이동
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { itemApi } from '@/api/client';
import type { Item } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { ItemFormFields } from '@/components/ItemFormFields';
import { EmptyState } from '@/components/ui';

export function EditItemPage() {
  const { itemNo } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !itemNo) return;
    const id = Number(itemNo);
    itemApi
      .get(user.cno, id)
      .catch(() => itemApi.list().then((all) => all.find((i) => i.cno === user.cno && i.itemNo === id)))
      .then((found) => setItem(found ?? null))
      .finally(() => setLoading(false));
  }, [user, itemNo]);

  if (!user) return null;
  if (loading) return <div className="py-20 text-center text-stone-400">불러오는 중…</div>;
  if (!item) return <EmptyState title="수정할 상품을 찾을 수 없습니다" />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-extrabold text-stone-900">상품 수정</h1>
      <p className="mb-6 text-sm text-stone-500">{item.title}</p>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <ItemFormFields
        submitLabel="수정 완료"
        busy={busy}
        initial={{
          title: item.title,
          category: item.category,
          price: item.price,
          tradePlace: item.tradePlace ?? '',
          description: item.description ?? '',
          sellStatus: item.sellStatus,
        }}
        initialPicUrls={[item.pic1Url ?? null, item.pic2Url ?? null, item.pic3Url ?? null]}
        onSubmit={async (form, newFiles, removed) => {
          setBusy(true);
          setError(null);
          try {
            await itemApi.update(item.cno, item.itemNo, form);
            // 새 이미지 업로드
            for (const [i, file] of newFiles.entries()) {
              if (file) {
                await itemApi.uploadPic(item.cno, item.itemNo, (i + 1) as 1 | 2 | 3, file);
              }
            }
            // 삭제된 이미지 처리
            for (const [i, isRemoved] of removed.entries()) {
              if (isRemoved && !newFiles[i]) {
                await itemApi.deletePic(item.cno, item.itemNo, (i + 1) as 1 | 2 | 3);
              }
            }
            navigate('/my-items');
          } catch (err) {
            setError(err instanceof Error ? err.message : '수정에 실패했습니다.');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
