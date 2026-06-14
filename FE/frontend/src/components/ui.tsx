import type { ReactNode } from 'react';

/* 판매 상태 배지 */
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    '판매 중': 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    '예약 중': 'bg-amber-100 text-amber-700 ring-amber-200',
    '거래 완료': 'bg-stone-200 text-stone-600 ring-stone-300',
  };
  const cls = styles[status] ?? 'bg-stone-100 text-stone-600 ring-stone-200';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${cls}`}
    >
      {status}
    </span>
  );
}

/* 가격 표기 */
export function Price({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`tnum ${className}`}>
      {value.toLocaleString('ko-KR')}
      <span className="text-[0.7em] font-medium">원</span>
    </span>
  );
}

/* 버튼 (variant) */
type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'soft';
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
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-400';
  const variants: Record<BtnVariant, string> = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600',
    soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
    ghost: 'text-stone-600 hover:bg-stone-100',
    outline: 'border border-stone-300 text-stone-700 hover:bg-stone-50',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

/* 빈 화면 안내 */
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
