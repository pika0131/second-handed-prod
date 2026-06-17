import type { Customer, Item, ItemForm, ChatRoom, ChatMessage, UnreadCount, PurchaseReq, CompletedSale, PurchasedItem, CategoryGroupStat, SellerRankStat, AdminMsg, ReceivedPurchaseReq } from './types';

// Vite 프록시(vite.config.ts)가 /api → http://localhost:8080 으로 전달.
// 배포 환경에서 절대 URL이 필요하면 VITE_API_BASE 환경변수로 덮어쓸 수 있음.
const BASE = import.meta.env.VITE_API_BASE ?? '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    // 백엔드가 문자열 에러 메시지를 보내는 경우(로그인 실패 등) 그대로 노출
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || `요청에 실패했습니다 (${res.status})`);
  }

  // 본문이 없을 수 있음 (204 등)
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/* ── 회원 (Customer) ─────────────────────────── */
export const customerApi = {
  list: () => request<Customer[]>('/api/customers'),

  get: (cno: string) => request<Customer>(`/api/customers/${cno}`),

  login: (cno: string, passwd: string) =>
    request<Customer>('/api/customers/login', {
      method: 'POST',
      body: JSON.stringify({ cno, passwd }),
    }),

  // ⚠ 백엔드에 POST /api/customers 추가 필요 (BACKEND_추가코드 참고)
  signup: (customer: Customer) =>
    request<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    }),

  update: (cno: string, data: Partial<Pick<Customer, 'nickname' | 'phone' | 'region'>>) =>
    request<Customer>(`/api/customers/${cno}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

/* ── 상품 (Item) ─────────────────────────────── */
export const itemApi = {
  list: () => request<Item[]>('/api/items'),

  // ⚠ 백엔드에 아래 엔드포인트들 추가 필요 (BACKEND_추가코드 참고)
  get: (cno: string, itemNo: number) =>
    request<Item>(`/api/items/${cno}/${itemNo}`),

  bySeller: (cno: string) => request<Item[]>(`/api/items/seller/${cno}`),

  create: (form: ItemForm) =>
    request<Item>('/api/items', {
      method: 'POST',
      body: JSON.stringify(form),
    }),

  update: (cno: string, itemNo: number, form: Partial<ItemForm>) =>
    request<Item>(`/api/items/${cno}/${itemNo}`, {
      method: 'PUT',
      body: JSON.stringify(form),
    }),

  updateStatus: (cno: string, itemNo: number, sellStatus: string) =>
    request<Item>(`/api/items/${cno}/${itemNo}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ sellStatus }),
    }),

  remove: (cno: string, itemNo: number) =>
    request<void>(`/api/items/${cno}/${itemNo}`, { method: 'DELETE' }),

  uploadPic: async (cno: string, itemNo: number, n: 1 | 2 | 3, file: File): Promise<void> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/api/items/${cno}/${itemNo}/pic/${n}`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => '업로드 실패'));
  },

  deletePic: (cno: string, itemNo: number, n: 1 | 2 | 3) =>
    request<void>(`/api/items/${cno}/${itemNo}/pic/${n}`, { method: 'DELETE' }),
};

/* ── 구매 요청 (PurchaseReq) ─────────────────── */
export const purchaseApi = {
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

  getByItem: (cno: string, itemNo: number) =>
    request<PurchaseReq[]>(`/api/purchase/item/${cno}/${itemNo}`),

  getSent: (requestCno: string) =>
    request<PurchaseReq[]>(`/api/purchase/sent/${requestCno}`),

  approve: (requestCno: string, cno: string, itemNo: number) =>
    request<Item>(`/api/purchase/${requestCno}/${cno}/${itemNo}/approve`, { method: 'PATCH' }),

  // 판매자가 명시적으로 거절 (채팅 메시지 전송 포함)
  rejectBySeller: (requestCno: string, cno: string, itemNo: number) =>
    request<void>(`/api/purchase/${requestCno}/${cno}/${itemNo}/reject`, { method: 'PATCH' }),

  // 구매자가 자신의 요청을 취소 (메시지 없이 단순 삭제)
  reject: (requestCno: string, cno: string, itemNo: number) =>
    request<void>(`/api/purchase/${requestCno}/${cno}/${itemNo}`, { method: 'DELETE' }),

  complete: (requestCno: string, cno: string, itemNo: number, finalPrice: number) =>
    request<Item>(`/api/purchase/${requestCno}/${cno}/${itemNo}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ finalPrice }),
    }),

  getHistory: (requestCno: string) =>
    request<PurchasedItem[]>(`/api/purchase/history/${requestCno}`),

  getReceived: (cno: string) =>
    request<ReceivedPurchaseReq[]>(`/api/purchase/received/${cno}`),

  getPending: (requestCno: string) =>
    request<ReceivedPurchaseReq[]>(`/api/purchase/pending/${requestCno}`),
};

/* ── 판매 내역 (CompletedSales) ──────────────── */
export const salesApi = {
  getCompleted: (cno: string) =>
    request<CompletedSale[]>(`/api/purchase/sales/${cno}`),
};

/* ── 통계 (Stats) — 관리자 전용 ─────────────── */
export const statsApi = {
  getCategoryGroup: () => request<CategoryGroupStat[]>('/api/stats/category-group'),
  getSellerRank: () => request<SellerRankStat[]>('/api/stats/seller-rank'),
};

/* ── 관리자 (Admin) ──────────────────────────── */
export const adminApi = {
  deleteItem: (cno: string, itemNo: number, reason: string) =>
    request<void>(`/api/admin/items/${cno}/${itemNo}/delete`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getMessages: (sellerCno: string) =>
    request<AdminMsg[]>(`/api/admin/messages/${sellerCno}`),

  getUnreadCount: (sellerCno: string) =>
    request<{ count: number }>(`/api/admin/messages/${sellerCno}/unread-count`),

  markRead: (msgId: number) =>
    request<void>(`/api/admin/messages/${msgId}/read`, { method: 'PATCH' }),
};

/* ── 채팅 (Chat) ─────────────────────────────── */
export const chatApi = {
  getOrCreateRoom: (cno: string, receiveCno: string, itemNo: number) =>
    request<ChatRoom>('/api/chat/rooms', {
      method: 'POST',
      body: JSON.stringify({ cno, receiveCno, itemNo }),
    }),

  getRoomsForUser: (cno: string) =>
    request<ChatRoom[]>(`/api/chat/rooms/user/${cno}`),

  getMessages: (roomNo: number) =>
    request<ChatMessage[]>(`/api/chat/rooms/${roomNo}/messages`),

  markAsRead: (roomNo: number, mySender: 'B' | 'S') =>
    request<void>(`/api/chat/rooms/${roomNo}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ mySender }),
    }),

  getUnreadCounts: (cno: string) =>
    request<UnreadCount[]>(`/api/chat/unread/${cno}`),
};
