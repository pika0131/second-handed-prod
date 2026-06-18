/**
 * HTTP API 클라이언트
 *
 * - 모든 API 호출은 이 파일의 fetch wrapper(request)를 통해 이뤄진다.
 * - Vite 개발 서버의 프록시 설정(vite.config.ts)이 /api → localhost:8080 으로 전달하므로
 *   BASE는 기본적으로 빈 문자열이다.
 * - 배포 환경처럼 절대 URL이 필요하면 .env 파일에 VITE_API_BASE=https://... 를 설정한다.
 */

import type {
  Customer, Item, ItemForm, ChatRoom, ChatMessage, UnreadCount,
  PurchaseReq, CompletedSale, PurchasedItem,
  CategoryGroupStat, SellerRankStat, AdminMsg, ReceivedPurchaseReq,
} from './types';

const BASE = import.meta.env.VITE_API_BASE ?? '';

/**
 * 공통 fetch wrapper
 * - Content-Type: application/json 헤더를 자동으로 붙인다.
 * - HTTP 오류(4xx, 5xx)는 ApiError로 변환해 던진다.
 * - 204 No Content처럼 본문이 없는 응답은 undefined를 반환한다.
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    // 백엔드가 문자열 오류 메시지를 보내는 경우(예: 로그인 실패) 그대로 노출한다.
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || `요청에 실패했습니다 (${res.status})`);
  }

  // 204 No Content 등 본문이 없는 응답 처리
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** HTTP 오류를 표현하는 커스텀 에러 — status 코드를 함께 전달한다. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/* ── 회원 (Customer) ─────────────────────────────────────────── */
export const customerApi = {
  /** 전체 회원 목록 조회 — 관리자 화면(UsersPage)용 */
  list: () => request<Customer[]>('/api/customers'),

  /** 단일 회원 조회 — 채팅 상대방 닉네임 조회 등에서 사용 */
  get: (cno: string) => request<Customer>(`/api/customers/${cno}`),

  /** 로그인 — 성공 시 Customer 반환, 실패 시 ApiError(401) */
  login: (cno: string, passwd: string) =>
    request<Customer>('/api/customers/login', {
      method: 'POST',
      body: JSON.stringify({ cno, passwd }),
    }),

  /** 회원가입 — cno 중복 시 ApiError(409) */
  signup: (customer: Customer) =>
    request<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    }),

  /** 프로필 수정 — nickname, phone, region 중 변경할 필드만 전달 */
  update: (cno: string, data: Partial<Pick<Customer, 'nickname' | 'phone' | 'region'>>) =>
    request<Customer>(`/api/customers/${cno}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

/* ── 상품 (Item) ─────────────────────────────────────────────── */
export const itemApi = {
  /** 전체 상품 목록 조회 — 홈 화면 초기 로드용 */
  list: () => request<Item[]>('/api/items'),

  /** 상품 단건 조회 — 복합키 (cno, itemNo) */
  get: (cno: string, itemNo: number) =>
    request<Item>(`/api/items/${cno}/${itemNo}`),

  /** 특정 판매자의 상품 목록 조회 */
  bySeller: (cno: string) => request<Item[]>(`/api/items/seller/${cno}`),

  /** 상품 등록 — itemNo는 서버에서 자동 채번 (MAX+1) */
  create: (form: ItemForm) =>
    request<Item>('/api/items', {
      method: 'POST',
      body: JSON.stringify(form),
    }),

  /** 상품 수정 — title, description, category, price, tradePlace, sellStatus */
  update: (cno: string, itemNo: number, form: Partial<ItemForm>) =>
    request<Item>(`/api/items/${cno}/${itemNo}`, {
      method: 'PUT',
      body: JSON.stringify(form),
    }),

  /** 판매 상태만 변경 — "판매 중" | "예약 중" | "거래 완료" */
  updateStatus: (cno: string, itemNo: number, sellStatus: string) =>
    request<Item>(`/api/items/${cno}/${itemNo}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ sellStatus }),
    }),

  /** 상품 삭제 — 연관된 채팅방/메시지/구매요청도 CASCADE 삭제 */
  remove: (cno: string, itemNo: number) =>
    request<void>(`/api/items/${cno}/${itemNo}`, { method: 'DELETE' }),

  /**
   * 이미지 업로드 — BLOB으로 DB에 직접 저장
   * Content-Type을 설정하지 않아야 브라우저가 multipart 헤더를 자동 생성한다.
   * n: 슬롯 번호 1~3
   */
  uploadPic: async (cno: string, itemNo: number, n: 1 | 2 | 3, file: File): Promise<void> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/api/items/${cno}/${itemNo}/pic/${n}`, {
      method: 'POST',
      body: form,
      // Content-Type을 명시하지 않아야 브라우저가 multipart boundary를 자동으로 붙인다.
    });
    if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => '업로드 실패'));
  },

  /** 이미지 삭제 — 해당 슬롯의 BLOB을 null로 초기화 */
  deletePic: (cno: string, itemNo: number, n: 1 | 2 | 3) =>
    request<void>(`/api/items/${cno}/${itemNo}/pic/${n}`, { method: 'DELETE' }),
};

/* ── 구매 요청 (PurchaseReq) ─────────────────────────────────── */
export const purchaseApi = {
  /** 구매 요청 전송 — 성공 시 판매자에게 WebSocket 알림 발송 */
  create: (data: {
    requestCno: string;
    cno: string;
    itemNo: number;
    reqPrice: number;
    reqMessage: string;
  }) =>
    request<PurchaseReq>('/api/purchase', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 특정 상품에 들어온 구매 요청 목록 — 판매자용 */
  getByItem: (cno: string, itemNo: number) =>
    request<PurchaseReq[]>(`/api/purchase/item/${cno}/${itemNo}`),

  /** 내가 보낸 구매 요청 전체 목록 — 구매자용 */
  getSent: (requestCno: string) =>
    request<PurchaseReq[]>(`/api/purchase/sent/${requestCno}`),

  /**
   * 구매 요청 승인
   * - 상품 상태: '예약 중'으로 변경
   * - 나머지 요청자들에게 REJECT_NOTICE 채팅 메시지 자동 전송
   * - 승인된 구매자 채팅방에 수락 메시지 전송
   */
  approve: (requestCno: string, cno: string, itemNo: number) =>
    request<Item>(`/api/purchase/${requestCno}/${cno}/${itemNo}/approve`, { method: 'PATCH' }),

  /** 판매자의 명시적 거절 — REJECT_NOTICE 채팅 메시지 전송 후 구매 요청 삭제 */
  rejectBySeller: (requestCno: string, cno: string, itemNo: number) =>
    request<void>(`/api/purchase/${requestCno}/${cno}/${itemNo}/reject`, { method: 'PATCH' }),

  /** 구매자가 직접 요청 취소 — 채팅 메시지 없이 단순 삭제 */
  reject: (requestCno: string, cno: string, itemNo: number) =>
    request<void>(`/api/purchase/${requestCno}/${cno}/${itemNo}`, { method: 'DELETE' }),

  /** 거래 완료 처리 — 상품 상태 '거래 완료', finalPrice 기록 */
  complete: (requestCno: string, cno: string, itemNo: number, finalPrice: number) =>
    request<Item>(`/api/purchase/${requestCno}/${cno}/${itemNo}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ finalPrice }),
    }),

  /** 구매자의 구매 내역 조회 — 거래 완료된 항목만 반환 */
  getHistory: (requestCno: string) =>
    request<PurchasedItem[]>(`/api/purchase/history/${requestCno}`),

  /** 판매자에게 들어온 전체 구매 요청 목록 — '판매 중' 상품만 필터링 */
  getReceived: (cno: string) =>
    request<ReceivedPurchaseReq[]>(`/api/purchase/received/${cno}`),

  /** 구매자의 대기 중인 요청 목록 — 상품이 아직 '판매 중'인 것만 */
  getPending: (requestCno: string) =>
    request<ReceivedPurchaseReq[]>(`/api/purchase/pending/${requestCno}`),
};

/* ── 판매 내역 (CompletedSales) ──────────────────────────────── */
export const salesApi = {
  /** 판매자의 거래 완료 내역 조회 */
  getCompleted: (cno: string) =>
    request<CompletedSale[]>(`/api/purchase/sales/${cno}`),
};

/* ── 통계 (Stats) — 관리자 전용 ─────────────────────────────── */
export const statsApi = {
  /** ROLLUP 집계 — 카테고리 × 판매상태별 상품 통계 */
  getCategoryGroup: () => request<CategoryGroupStat[]>('/api/stats/category-group'),

  /** RANK/SUM OVER 집계 — 판매자별 매출 랭킹 */
  getSellerRank: () => request<SellerRankStat[]>('/api/stats/seller-rank'),
};

/* ── 관리자 (Admin) ──────────────────────────────────────────── */
export const adminApi = {
  /** 상품 강제 삭제 — 연관 데이터 삭제 후 판매자에게 AdminMsg 알림 전송 */
  deleteItem: (cno: string, itemNo: number, reason: string) =>
    request<void>(`/api/admin/items/${cno}/${itemNo}/delete`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /** 상품 상태를 '검토 중'으로 변경 — "[검토 중] " 접두사 붙은 알림 전송 */
  setReview: (cno: string, itemNo: number, reason: string) =>
    request<void>(`/api/admin/items/${cno}/${itemNo}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  /** 판매자의 관리자 알림 목록 조회 — 최신순 */
  getMessages: (sellerCno: string) =>
    request<AdminMsg[]>(`/api/admin/messages/${sellerCno}`),

  /** 판매자의 안읽은 관리자 알림 수 조회 — Layout 헤더 배지용 */
  getUnreadCount: (sellerCno: string) =>
    request<{ count: number }>(`/api/admin/messages/${sellerCno}/unread-count`),

  /** 관리자 알림 읽음 처리 */
  markRead: (msgId: number) =>
    request<void>(`/api/admin/messages/${msgId}/read`, { method: 'PATCH' }),
};

/* ── 채팅 (Chat) ─────────────────────────────────────────────── */
export const chatApi = {
  /**
   * 채팅방 조회 또는 생성
   * body: { cno(구매자), receiveCno(판매자), itemNo }
   * ⚠ 백엔드에서 저장 시 역할이 반전: room.cno = 판매자, room.receiveCno = 구매자
   */
  getOrCreateRoom: (cno: string, receiveCno: string, itemNo: number) =>
    request<ChatRoom>('/api/chat/rooms', {
      method: 'POST',
      body: JSON.stringify({ cno, receiveCno, itemNo }),
    }),

  /** 사용자가 참여 중인 채팅방 목록 — 판매자(cno) 또는 구매자(receiveCno) 모두 포함 */
  getRoomsForUser: (cno: string) =>
    request<ChatRoom[]>(`/api/chat/rooms/user/${cno}`),

  /** 채팅방의 메시지 내역 조회 — 시간 오름차순 */
  getMessages: (roomNo: number) =>
    request<ChatMessage[]>(`/api/chat/rooms/${roomNo}/messages`),

  /** 읽음 처리 — 채팅방 입장 시 상대방 메시지를 일괄 읽음 처리 */
  markAsRead: (roomNo: number, mySender: 'B' | 'S') =>
    request<void>(`/api/chat/rooms/${roomNo}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ mySender }),
    }),

  /** 채팅방별 안읽은 메시지 수 목록 — Layout 헤더 배지 및 ChatListPage unreadMap용 */
  getUnreadCounts: (cno: string) =>
    request<UnreadCount[]>(`/api/chat/unread/${cno}`),
};
