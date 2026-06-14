import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { CATEGORIES, SELL_STATUSES, type ItemForm } from '@/api/types';
import { Button } from './ui';

interface Props {
  initial?: Partial<ItemForm>;
  initialPicUrls?: [string | null, string | null, string | null];
  submitLabel: string;
  busy?: boolean;
  onSubmit: (form: Omit<ItemForm, 'cno'>, newFiles: [File | null, File | null, File | null], removed: [boolean, boolean, boolean]) => void;
}

export function ItemFormFields({ initial, initialPicUrls, submitLabel, busy, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [price, setPrice] = useState(initial?.price ? String(initial.price) : '');
  const [tradePlace, setTradePlace] = useState(initial?.tradePlace ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [sellStatus, setSellStatus] = useState(initial?.sellStatus ?? '판매 중');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 미리보기 URL (기존 URL 또는 새 파일의 object URL)
  const [previews, setPreviews] = useState<[string | null, string | null, string | null]>([
    initialPicUrls?.[0] ?? null,
    initialPicUrls?.[1] ?? null,
    initialPicUrls?.[2] ?? null,
  ]);
  // 새로 선택한 파일
  const [newFiles, setNewFiles] = useState<[File | null, File | null, File | null]>([null, null, null]);
  // 기존 이미지를 삭제했는지 여부
  const [removed, setRemoved] = useState<[boolean, boolean, boolean]>([false, false, false]);

  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // object URL 메모리 해제
  useEffect(() => {
    return () => {
      newFiles.forEach((f) => { if (f) URL.revokeObjectURL(URL.createObjectURL(f)); });
    };
  }, []);

  const priceNum = Number(price.replace(/[^0-9]/g, ''));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = '상품명을 입력해주세요.';
    else if (title.length > 100) e.title = '상품명은 100자 이내로 입력해주세요.';
    if (!category) e.category = '카테고리를 선택해주세요.';
    if (!price || priceNum < 0) e.price = '가격을 올바르게 입력해주세요.';
    if (description.trim().length > 0 && description.trim().length < 10)
      e.description = '설명은 10자 이상 입력해주세요.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleFileChange = (idx: 0 | 1 | 2, file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setPreviews((p) => { const n = [...p] as typeof previews; n[idx] = objectUrl; return n; });
    setNewFiles((p) => { const n = [...p] as typeof newFiles; n[idx] = file; return n; });
    setRemoved((p) => { const n = [...p] as typeof removed; n[idx] = false; return n; });
  };

  const handleRemove = (idx: 0 | 1 | 2) => {
    if (newFiles[idx]) URL.revokeObjectURL(previews[idx]!);
    setPreviews((p) => { const n = [...p] as typeof previews; n[idx] = null; return n; });
    setNewFiles((p) => { const n = [...p] as typeof newFiles; n[idx] = null; return n; });
    setRemoved((p) => { const n = [...p] as typeof removed; n[idx] = true; return n; });
    if (fileRefs[idx].current) fileRefs[idx].current!.value = '';
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    onSubmit(
      { title: title.trim(), category, price: priceNum, tradePlace: tradePlace.trim(), description: description.trim(), sellStatus },
      newFiles,
      removed,
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">

      {/* 이미지 업로드 */}
      <div>
        <span className="mb-2 block text-sm font-semibold text-stone-700">
          상품 이미지 <span className="text-xs font-normal text-stone-400">(최대 3장)</span>
        </span>
        <div className="flex gap-3">
          {([0, 1, 2] as const).map((idx) => (
            <div key={idx} className="relative">
              <input
                ref={fileRefs[idx]}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(idx, f); }}
              />
              {previews[idx] ? (
                <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-stone-200">
                  <img src={previews[idx]!} alt={`사진 ${idx + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRefs[idx].current?.click()}
                  className="grid h-28 w-28 place-items-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 text-stone-400 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-500 transition-colors"
                >
                  <div className="flex flex-col items-center gap-1">
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-xs">{idx + 1}번째 사진</span>
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-400">JPG · PNG · GIF · WebP / 장당 최대 10MB</p>
      </div>

      <div>
        <Label required>상품명</Label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="판매할 상품 이름" maxLength={100} className="input" />
        {errors.title && <span className="mt-1 block text-xs text-red-500">{errors.title}</span>}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label required>카테고리</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            <option value="">선택하세요</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.category && <span className="mt-1 block text-xs text-red-500">{errors.category}</span>}
        </div>
        <div>
          <Label required>가격 (원)</Label>
          <input value={price ? priceNum.toLocaleString('ko-KR') : price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="0" className="input tnum" />
          {errors.price && <span className="mt-1 block text-xs text-red-500">{errors.price}</span>}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label>거래 희망 장소</Label>
          <input value={tradePlace} onChange={(e) => setTradePlace(e.target.value)} placeholder="예: 인천 연수구 송도동" className="input" />
        </div>
        <div>
          <Label>판매 상태</Label>
          <select value={sellStatus} onChange={(e) => setSellStatus(e.target.value)} className="input">
            {SELL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <Label>상품 설명</Label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} maxLength={300} placeholder="상품 상태, 사용 기간 등을 자세히 적어주세요." className="input resize-none" />
        {errors.description && <span className="mt-1 block text-xs text-red-500">{errors.description}</span>}
        <span className="mt-1 block text-right text-xs text-stone-400">{description.length}/300</span>
      </div>

      <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
        <Button type="submit" disabled={busy} className="px-6">
          {busy ? '처리 중…' : submitLabel}
        </Button>
      </div>

      <style>{`.input{width:100%;border:1px solid #d6d3d1;border-radius:.6rem;padding:.6rem .75rem;font-size:.9rem;outline:none;background:#fff}
      .input:focus{border-color:var(--color-brand-400);box-shadow:0 0 0 3px var(--color-brand-100)}`}</style>
    </form>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-2 block text-sm font-semibold text-stone-700">
      {children} {required && <span className="text-brand-500">*</span>}
    </span>
  );
}
