/**
 * 상품 상세 페이지
 *
 * URL: /items/:cno/:itemNo
 * 비로그인 사용자도 조회 가능.
 *
 * 기능:
 *  - 이미지 갤러리 (최대 3장, 썸네일 클릭으로 대표 이미지 교체)
 *  - 상품 정보(카테고리, 상태, 제목, 가격, 거래 장소, 판매자 닉네임, 등록일)
 *  - 구매 요청 모달 (희망 가격 + 메시지 입력)
 *    - 이미 요청한 경우(409) 예외 처리 후 조용히 성공 처리
 *    - 판매 중이 아닌 상품은 요청 버튼 비활성화
 *  - 내 상품인 경우 '수정' 링크 표시
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Clock, Tag,
  MessageCircle, Heart, ImageOff, Pencil, X,
} from 'lucide-react';
import { itemApi, purchaseApi, customerApi, ApiError } from '@/api/client';
import type { Item, Customer } from '@/api/types';
import { Button, Price, StatusBadge, EmptyState } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';

/** ISO 날짜 문자열을 한국어 형식으로 포맷 */
function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function ItemDetailPage() {
  const { cno, itemNo } = useParams();
  const { user }        = useAuth();
  const navigate        = useNavigate();

  const [item, setItem]       = useState<Item | null>(null);
  const [seller, setSeller]   = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // 구매 요청 모달 상태
  const [showModal, setShowModal]   = useState(false);
  const [reqPrice, setReqPrice]     = useState('');
  const [reqMessage, setReqMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const priceInputRef = useRef<HTMLInputElement>(null);

  // 이미지 갤러리 — 현재 대표 이미지
  const [mainPic, setMainPic] = useState<string | null>(null);

  // 상품 로드 — itemApi.get이 없으면 전체 목록에서 탐색(fallback)
  useEffect(() => {
    if (!cno || !itemNo) return;
    const id = Number(itemNo);
    setLoading(true);
    itemApi
      .get(cno, id)
      .catch(() => itemApi.list().then((all) => all.find((i) => i.cno === cno && i.itemNo === id)))
      .then((found) => {
        if (found) {
          setItem(found);
          customerApi.get(found.cno).then(setSeller).catch(() => null);
        } else {
          setError('상품을 찾을 수 없습니다.');
        }
      })
      .catch((e) => setError(e.message ?? '상품을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [cno, itemNo]);

  // item 로드 완료 후 첫 번째 이미지를 대표 이미지로 설정
  useEffect(() => {
    if (item) setMainPic(item.pic1Url ?? null);
  }, [item]);

  // 모달이 열리면 가격 입력 필드에 포커스
  useEffect(() => {
    if (showModal) setTimeout(() => priceInputRef.current?.focus(), 50);
  }, [showModal]);

  /**
   * 구매 요청 모달을 연다.
   * 비로그인 사용자는 로그인 페이지로 리다이렉트한다.
   * 이전 입력값을 초기화하고 모달을 표시한다.
   */
  function openModal() {
    if (!user) { navigate('/login'); return; }
    setReqPrice('');
    setReqMessage('');
    setShowModal(true);
  }

  /**
   * 구매 요청을 전송한다.
   * - 가격이 0 이하면 가격 입력란에 포커스하고 중단한다.
   * - 이미 요청한 경우(409 Conflict)는 성공으로 처리하여 채팅 목록으로 이동한다.
   * - 성공 시 /chat 으로 이동 — '승인 대기 중' 섹션에서 요청을 확인할 수 있다.
   */
  async function handleSubmit() {
    if (!user || !item) return;
    const price = Number(reqPrice);
    if (!price || price <= 0) { priceInputRef.current?.focus(); return; }

    setSubmitting(true);
    try {
      await purchaseApi
        .create({
          requestCno: user.cno,
          cno: item.cno,
          itemNo: item.itemNo,
          reqPrice: price,
          reqMessage: reqMessage.trim(),
        })
        .catch((e: unknown) => {
          // 이미 요청을 보낸 경우(409 Conflict) — 성공으로 처리
          if (e instanceof ApiError && e.status === 409) return null;
          throw e;
        });

      setShowModal(false);
      navigate('/chat'); // 채팅 목록 → '승인 대기 중' 섹션에서 요청 확인 가능
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '요청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  /** Escape 키로 모달을 닫는다. onKeyDown 핸들러로 모달 div에 부착된다. */
  function handleModalKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setShowModal(false);
  }

  if (loading) return <div className="py-20 text-center text-stone-400">불러오는 중…</div>;
  if (error || !item)
    return (
      <EmptyState
        title="상품을 찾을 수 없습니다"
        description={error ?? undefined}
        action={<Link to="/"><Button variant="outline">홈으로</Button></Link>}
      />
    );

  const isOwner  = user?.cno === item.cno;
  const sold     = item.sellStatus !== '판매 중';
  const soldLabel =
    item.sellStatus === '예약 중' ? '예약 중인 상품입니다' :
    item.sellStatus === '검토 중' ? '해당 상품은 검토 중입니다' :
    '거래가 끝난 상품입니다';
  const allPics = [item.pic1Url, item.pic2Url, item.pic3Url].filter(Boolean) as string[];

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"
      >
        <ArrowLeft className="h-4 w-4" /> 목록으로
      </button>

      <div className="grid gap-8 md:grid-cols-2">
        {/* 이미지 갤러리 */}
        <div className="flex flex-col gap-3">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-stone-100">
            {mainPic ? (
              <img src={mainPic} alt={item.title} className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-12 w-12 text-stone-300" />
            )}
            {sold && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45">
                <span className="rounded-lg border-2 border-white px-4 py-1.5 text-xl font-bold text-white">
                  {item.sellStatus}
                </span>
              </div>
            )}
          </div>
          {/* 썸네일 — 이미지가 2장 이상일 때만 표시 */}
          {allPics.length > 1 && (
            <div className="flex gap-2">
              {allPics.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setMainPic(url)}
                  className={`h-20 w-20 overflow-hidden rounded-xl border-2 transition-colors ${
                    mainPic === url ? 'border-brand-500' : 'border-transparent hover:border-stone-300'
                  }`}
                >
                  <img src={url} alt={`사진 ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 상품 정보 */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-500">
              {item.category}
            </span>
            <StatusBadge status={item.sellStatus} />
          </div>

          <h1 className="mt-3 text-2xl font-extrabold text-stone-900">{item.title}</h1>
          <Price value={item.price} className="mt-2 text-3xl font-extrabold text-stone-900" />

          <dl className="mt-6 space-y-2.5 border-t border-stone-200 pt-5 text-sm">
            <Row icon={<MapPin className="h-4 w-4" />} label="거래 희망 장소">
              {item.tradePlace || '미정'}
            </Row>
            <Row icon={<Tag className="h-4 w-4" />} label="판매자">
              {seller ? seller.nickname : item.cno}
            </Row>
            <Row icon={<Clock className="h-4 w-4" />} label="등록일">
              {formatDate(item.regDateTime)}
            </Row>
          </dl>

          {item.description && (
            <div className="mt-6 border-t border-stone-200 pt-5">
              <h2 className="mb-2 text-sm font-semibold text-stone-700">상품 설명</h2>
              <p className="whitespace-pre-wrap leading-relaxed text-stone-700">
                {item.description}
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-2">
            {isOwner ? (
              // 내 상품: 수정 링크
              <Link to="/my-items">
                <Button variant="outline" className="w-full">
                  <Pencil className="h-4 w-4" />내 상품 관리에서 수정
                </Button>
              </Link>
            ) : (
              // 타인 상품: 구매 요청 버튼
              <div className="flex gap-2">
                <Button variant="outline" className="px-3">
                  <Heart className="h-4 w-4" />
                </Button>
                <Button className="flex-1" disabled={sold} onClick={openModal}>
                  <MessageCircle className="h-4 w-4" />
                  {sold ? soldLabel : '구매 요청하기'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 구매 요청 모달 */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          onKeyDown={handleModalKeyDown}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-900">구매 요청하기</h2>
              <button
                onClick={() => setShowModal(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 상품 요약 */}
            <div className="mt-3 rounded-xl bg-stone-50 px-4 py-3">
              <p className="font-semibold text-stone-800">{item.title}</p>
              <p className="mt-0.5 text-sm text-stone-500">
                판매가: {item.price.toLocaleString()}원
              </p>
            </div>

            {/* 희망 가격 입력 */}
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-stone-700">
                희망 가격 <span className="text-red-500">*</span>
              </span>
              <div className="relative mt-1">
                <input
                  ref={priceInputRef}
                  type="number"
                  min={1}
                  value={reqPrice}
                  onChange={(e) => setReqPrice(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                  placeholder="원하는 가격을 입력하세요"
                  className="w-full rounded-xl border border-stone-300 py-2.5 pl-4 pr-10 text-sm outline-none transition-colors placeholder:text-stone-400 focus:border-brand-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">원</span>
              </div>
            </label>

            {/* 메시지 입력 (선택) */}
            <label className="mt-3 block">
              <span className="text-sm font-semibold text-stone-700">
                메시지 <span className="text-xs font-normal text-stone-400">(선택)</span>
              </span>
              <textarea
                value={reqMessage}
                onChange={(e) => setReqMessage(e.target.value)}
                placeholder="판매자에게 전달할 메시지를 입력하세요"
                rows={3}
                maxLength={800}
                className="mt-1 w-full resize-none rounded-xl border border-stone-300 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-stone-400 focus:border-brand-400"
              />
            </label>

            {/* 확인/취소 버튼 */}
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)} disabled={submitting}>
                취소
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting || !reqPrice || Number(reqPrice) <= 0}
              >
                {submitting ? '처리 중…' : '거래 요청 전송'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 상품 정보 행 — 아이콘 + 라벨 + 값 레이아웃 */
function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-stone-600">
      <span className="text-stone-400">{icon}</span>
      <span className="w-28 text-stone-400">{label}</span>
      <span className="font-medium text-stone-800">{children}</span>
    </div>
  );
}
