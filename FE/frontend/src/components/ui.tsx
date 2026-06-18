/**
 * 공통 UI 컴포넌트 모음
 *
 * - StatusBadge : 판매 상태를 색상 배지로 표시
 * - Price       : 한국 원화 형식으로 가격 표시
 * - Button      : 5가지 스타일 variant를 지원하는 버튼
 * - EmptyState  : 목록이 비었을 때 표시하는 안내 화면
 */

import type { ReactNode } from 'react';

/**
 * 판매 상태 배지
 * sellStatus 값에 따라 색상이 자동으로 결정된다.
 *   판매 중  → 초록
 *   예약 중  → 주황
 *   거래 완료 → 회색
 *   검토 중  → 보라
 */
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    '판매 중':  'bg-emerald-100 text-emerald-700 ring-emerald-200',
    '예약 중':  'bg-amber-100   text-amber-700   ring-amber-200',
    '거래 완료': 'bg-stone-200   text-stone-600   ring-stone-300',
    '검토 중':  'bg-purple-100  text-purple-700   ring-purple-200',
  };
  const cls = styles[status] ?? 'bg-stone-100 text-stone-600 ring-stone-200';
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${cls}`}>
      {status}
    </span>
  );
}

/**
 * 원화 가격 표시
 * Intl.NumberFormat(ko-KR) 으로 쉼표 구분 표기한다. 예) 1,000원
 * tnum 클래스는 tabular-nums 폰트 피처로 숫자 너비를 고정한다.
 */
export function Price({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`tnum ${className}`}>
      {value.toLocaleString('ko-KR')}
      <span className="text-[0.7em] font-medium">원</span>
    </span>
  );
}

/** 버튼 스타일 종류 */
type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'soft';

/**
 * 공통 버튼
 *   primary — 브랜드 색상 (주 행동)
 *   soft    — 연한 브랜드 색상 (보조 행동)
 *   ghost   — 배경 없음, 텍스트만 (취소 등)
 *   outline — 테두리 버튼
 *   danger  — 빨간 계열 (삭제 등 위험 행동)
 *
 * HTML button의 모든 속성을 그대로 전달(spread)한다.
 */
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: {
  children: ReactNode;
  variant?: BtnVariant;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ' +
    'transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-400';

  const variants: Record<BtnVariant, string> = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600',
    soft:    'bg-brand-50 text-brand-700 hover:bg-brand-100',
    ghost:   'text-stone-600 hover:bg-stone-100',
    outline: 'border border-stone-300 text-stone-700 hover:bg-stone-50',
    danger:  'bg-red-50 text-red-600 hover:bg-red-100',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

/**
 * 빈 목록 안내 컴포넌트
 * 데이터가 없을 때 아이콘 + 제목 + 설명 + 행동 버튼을 중앙 정렬로 표시한다.
 *
 * @param icon        - 상단에 표시할 아이콘 (선택)
 * @param title       - 주 안내 문구
 * @param description - 부연 설명 (선택)
 * @param action      - 행동 유도 버튼 등 (선택)
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-16 text-center">
      {icon && <div className="mb-3 text-stone-300">{icon}</div>}
      <p className="text-base font-semibold text-stone-700">{title}</p>
      {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
