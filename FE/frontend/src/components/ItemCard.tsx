/**
 * 상품 카드 컴포넌트
 *
 * 홈 화면과 내 상품 목록에서 상품을 그리드로 표시할 때 사용한다.
 * 카드를 클릭하면 /items/:cno/:itemNo 상세 페이지로 이동한다.
 *
 * 이미지가 없으면 상품명의 해시값으로 파스텔 색상 블록을 표시한다(tint 함수).
 * 판매 중이 아닌 상품은 오버레이로 상태를 표시한다.
 */

import { Link } from 'react-router-dom';
import { MapPin, ImageOff } from 'lucide-react';
import type { Item } from '@/api/types';
import { Price, StatusBadge } from './ui';

// 이미지가 없을 때 상품명 기반 파스텔 배경색 팔레트
const palette = ['#fde68a', '#bfdbfe', '#bbf7d0', '#fbcfe8', '#ddd6fe', '#fed7aa'];

/**
 * 문자열 seed를 단순 해시하여 palette 인덱스를 반환한다.
 * 같은 상품명은 항상 같은 색상이 나온다.
 */
function tint(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export function ItemCard({ item }: { item: Item }) {
  // 판매 중이 아닌 경우 이미지 위에 상태 오버레이를 표시한다.
  const sold = item.sellStatus !== '판매 중';

  return (
    <Link
      to={`/items/${item.cno}/${item.itemNo}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* 이미지 영역 */}
      <div
        className="relative flex h-44 items-center justify-center overflow-hidden"
        style={{ backgroundColor: tint(item.title) }}
      >
        {item.pic1Url ? (
          <img src={item.pic1Url} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          // 이미지 없음 아이콘
          <ImageOff className="h-8 w-8 text-black/15" />
        )}

        {/* 판매 중이 아닌 경우 반투명 오버레이 */}
        {sold && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="rounded-md border-2 border-white px-3 py-1 text-base font-bold text-white">
              {item.sellStatus}
            </span>
          </div>
        )}

        {/* 카테고리 태그 */}
        <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2 py-0.5 text-xs font-medium text-stone-600 backdrop-blur">
          {item.category}
        </span>
      </div>

      {/* 정보 영역 */}
      <div className="flex flex-grow flex-col p-4">
        <h3 className="truncate font-semibold text-stone-900 group-hover:text-brand-600">
          {item.title}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-stone-400">
          <MapPin className="h-3.5 w-3.5" />
          {item.tradePlace || '지역 미정'}
        </p>
        <div className="mt-auto flex items-end justify-between pt-3">
          <Price value={item.price} className="text-lg font-bold text-stone-900" />
          <StatusBadge status={item.sellStatus} />
        </div>
      </div>
    </Link>
  );
}
