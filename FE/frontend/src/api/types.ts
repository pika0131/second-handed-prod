// 백엔드 엔티티와 1:1로 대응하는 타입 정의
// (com.example.dbproject.entity.Customer / Item)

export interface Customer {
  cno: string;        // 회원번호 (PK, 학번 형식 예: d202302618)
  passwd?: string;    // 비밀번호 (목록 조회 시에는 내려오지만 화면에 노출 X)
  nickname: string;   // 닉네임 (unique)
  phone: string | null;
  region: string | null;
}

export interface Item {
  cno: string;             // 판매자 회원번호 (복합키)
  itemNo: number;          // 상품번호 (복합키)
  title: string;
  description: string | null;
  category: string;
  price: number;
  tradePlace: string | null;
  regDateTime: string;     // ISO LocalDateTime 문자열
  resDateTime: string | null;
  sellStatus: string;      // "판매 중" | "예약 중" | "거래 완료"
  finalPrice: number | null;
  pic1Url: string | null;
  pic2Url: string | null;
  pic3Url: string | null;
}

export interface CompletedSale {
  cno: string;
  itemNo: number;
  title: string;
  category: string;
  price: number;
  finalPrice: number | null;
  resDateTime: string | null;
  buyerCno: string | null;
}

// 상품 등록/수정 시 보내는 폼 데이터
export interface ItemForm {
  cno: string;
  title: string;
  description: string;
  category: string;
  price: number;
  tradePlace: string;
  sellStatus: string;
}

export const CATEGORIES = ['디지털기기', '스포츠', '도서', '가구', '티켓', '기타'] as const;
export const SELL_STATUSES = ['판매 중', '예약 중', '거래 완료'] as const;

export interface ChatRoom {
  roomNo: number;
  cno: string;         // 구매자
  receiveCno: string;  // 판매자
  itemNo: number;
  createDatetime: string;
}

export interface ChatMessage {
  seqNo: number;
  roomNo: number;
  sender: 'S' | 'B';
  sentDatetime: string;
  content: string;
  isRead: 'Y' | 'N';
}

export interface UnreadCount {
  roomNo: number;
  unreadCount: number;
}

export interface PurchaseReq {
  requestCno: string;
  cno: string;
  itemNo: number;
  reqDateTime: string;
  reqPrice: number;
  reqMessage: string | null;
}

// ── 통계 질의 타입 (관리자 전용) ─────────────────
export interface CategoryGroupStat {
  category: string | null;     // null = 전체 합계 행
  sellStatus: string | null;   // null = 카테고리 소계 행
  itemCount: number;
  avgPrice: number | null;
  totalPrice: number | null;
  maxPrice: number | null;
  minPrice: number | null;
  grpCategory: number;  // 1 = category가 집계된 행(전체 합계)
  grpStatus: number;    // 1 = sellStatus가 집계된 행(소계)
}

export interface SellerRankStat {
  cno: string;
  soldCount: number;
  totalRevenue: number;
  revenueRank: number;
  revenueShare: number; // 전체 대비 매출 비중 (%)
}

export interface AdminMsg {
  msgId: number;
  sellerCno: string;
  itemTitle: string;
  reason: string;
  sentAt: string;
  isRead: 'Y' | 'N';
}

export interface PurchasedItem {
  cno: string;
  itemNo: number;
  title: string;
  category: string;
  price: number;
  finalPrice: number | null;
  sellStatus: string;
  resDateTime: string | null;
  reqDateTime: string;
  reqPrice: number;
}

export interface ReceivedPurchaseReq {
  requestCno: string;
  cno: string;
  itemNo: number;
  itemTitle: string;
  reqPrice: number;
  reqMessage: string | null;
  reqDateTime: string;
}
