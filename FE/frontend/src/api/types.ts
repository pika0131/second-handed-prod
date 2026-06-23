/**
 * 백엔드 엔티티와 1:1 대응하는 TypeScript 타입 정의
 *
 * Spring Boot 엔티티 경로: com.example.dbproject.entity.*
 * 날짜/시간 필드는 서버에서 ISO 8601 LocalDateTime 문자열로 내려온다.
 *   예) "2024-03-15T14:30:00"
 */

// ── 회원 (Customer) ───────────────────────────────────────────
// 관리자 계정: cno === "c0"
export interface Customer {
  cno: string;         // 회원번호 PK (예: d202302618)
  passwd?: string;     // 평문 비밀번호 — 목록에 포함되지만 화면에 노출하지 않는다
  nickname: string;    // 닉네임 (UNIQUE 제약)
  phone: string | null;
  region: string | null;
}

// ── 상품 (Item) ───────────────────────────────────────────────
// 복합 PK: (cno, itemNo)
// itemNo는 판매자별 자동 채번: 해당 판매자 최대값 + 1
// pic1Url~pic3Url은 백엔드 @PostLoad에서 동적 생성됨: /api/items/{cno}/{itemNo}/pic/{n}
export interface Item {
  cno: string;              // 판매자 회원번호 (복합키 1/2)
  itemNo: number;           // 상품번호 (복합키 2/2)
  title: string;
  description: string | null;
  category: string;
  price: number;
  tradePlace: string | null;
  regDateTime: string;      // 등록 일시 (ISO LocalDateTime)
  resDateTime: string | null; // '예약 중' 전환 시각 또는 '거래 완료' 시각
  sellStatus: string;       // "판매 중" | "예약 중" | "거래 완료" | "검토 중"
  finalPrice: number | null; // 실제 거래 금액 (거래 완료 시 기록)
  pic1Url: string | null;   // 첫 번째 이미지 URL
  pic2Url: string | null;
  pic3Url: string | null;
}

// ── 판매 완료 내역 DTO ────────────────────────────────────────
// 판매자 거래 내역 화면(TradeHistoryPage)용
export interface CompletedSale {
  cno: string;
  itemNo: number;
  title: string;
  category: string;
  price: number;           // 원래 등록 가격
  finalPrice: number | null; // 실제 거래 금액
  resDateTime: string | null;
  buyerCno: string | null; // 최종 구매자 회원번호
}

// ── 상품 등록/수정 폼 데이터 ───────────────────────────────────
// 이미지는 별도 uploadPic API로 전송하므로 여기에 포함되지 않는다.
export interface ItemForm {
  cno: string;
  title: string;
  description: string;
  category: string;
  price: number;
  tradePlace: string;
  sellStatus: string;
}

// 카테고리 선택지 — as const 로 튜플 타입을 보존한다.
export const CATEGORIES = ['디지털기기', '스포츠', '도서', '가구', '티켓', '기타'] as const;
export const SELL_STATUSES = ['판매 중', '예약 중', '거래 완료'] as const;

// ── 채팅방 (ChatRoom) ─────────────────────────────────────────
// ⚠ 필드 이름 주의: 백엔드 엔티티와 달리 FE에서는 아래와 같이 해석한다.
//   cno        = 판매자 (DB FK_CHAT_ITEM 제약: CHATROOM.CNO → ITEM.CNO)
//   receiveCno = 구매자
export interface ChatRoom {
  roomNo: number;
  cno: string;          // 판매자 cno
  receiveCno: string;   // 구매자 cno
  itemNo: number;
  createDatetime: string;
}

// ── 채팅 메시지 (ChatMessage) ─────────────────────────────────
// sender: "S" = Seller(판매자), "B" = Buyer(구매자)
// content에 JSON 문자열이 들어올 경우 시스템 메시지로 처리한다.
//   {"type":"REJECT_NOTICE", "itemTitle":"...", "cno":"...", "itemNo":..., "pic1Url":"..."}
//   {"type":"FINAL_PRICE", "finalPrice":...}
export interface ChatMessage {
  seqNo: number;
  roomNo: number;
  sender: 'S' | 'B';       // S = 판매자, B = 구매자
  sentDatetime: string;
  content: string;          // 일반 텍스트 또는 시스템 JSON
  isRead: 'Y' | 'N';
}

// ── 안읽은 메시지 수 ──────────────────────────────────────────
export interface UnreadCount {
  roomNo: number;
  unreadCount: number;
}

// ── 구매 요청 (PurchaseReq) ───────────────────────────────────
// 복합 PK: (requestCno, cno, itemNo)
export interface PurchaseReq {
  requestCno: string; // 구매 요청자 회원번호
  cno: string;        // 판매자(상품 소유자) 회원번호
  itemNo: number;
  reqDateTime: string;
  reqPrice: number;   // 구매자가 제안한 가격
  reqMessage: string | null;
}

// ── 통계 타입 (관리자 전용) ───────────────────────────────────

// ROLLUP 집계 결과 — grpCategory/grpStatus 값으로 행 종류를 구분한다.
//   grpCategory=0, grpStatus=0 → 일반 상세 행
//   grpCategory=0, grpStatus=1 → 카테고리 소계 행  (category별 합계)
//   grpCategory=1, grpStatus=1 → 전체 합계 행
export interface CategoryGroupStat {
  category: string | null;    // null = 전체 합계 행
  sellStatus: string | null;  // null = 소계 행
  itemCount: number;
  avgPrice: number | null;
  totalPrice: number | null;
  maxPrice: number | null;
  minPrice: number | null;
  grpCategory: number; // GROUPING(CATEGORY)  — 1이면 집계 행
  grpStatus: number;   // GROUPING(SELLSTATUS) — 1이면 집계 행
}

// RANK OVER + SUM OVER 결과 — 판매자별 매출 랭킹
export interface SellerRankStat {
  cno: string;
  soldCount: number;
  totalRevenue: number;
  revenueRank: number;
  revenueShare: number; // 전체 매출 대비 비중 (%)
}

// ── 관리자 메시지 (AdminMsg) ──────────────────────────────────
// reason 필드 앞에 "[검토 중] " 접두사가 있으면 검토 알림,
// 없으면 강제 삭제 알림으로 구분한다.
export interface AdminMsg {
  msgId: number;
  sellerCno: string;
  itemTitle: string;
  reason: string;     // "[검토 중] 사유" 또는 "삭제 사유"
  sentAt: string;
  isRead: 'Y' | 'N';
}

// ── 구매 내역 DTO ─────────────────────────────────────────────
// 구매자의 거래 내역 화면(TradeHistoryPage)용
export interface PurchasedItem {
  cno: string;
  itemNo: number;
  title: string;
  category: string;
  price: number;           // 원래 등록 가격
  finalPrice: number | null; // 실제 거래 금액
  sellStatus: string;
  resDateTime: string | null;
  reqDateTime: string;     // 구매 요청 시각
  reqPrice: number;        // 구매자가 제안한 가격
}

// ── 수신된 구매 요청 DTO ──────────────────────────────────────
// 판매자의 요청 수신함(MyItemsPage)용 — itemTitle 포함
export interface ReceivedPurchaseReq {
  requestCno: string; // 구매 요청자
  cno: string;        // 판매자
  itemNo: number;
  itemTitle: string;  // 상품 제목 (UI 표시용)
  reqPrice: number;
  reqMessage: string | null;
  reqDateTime: string;
}

// CI 테스트용 의도적 타입 오류
const testValue: number = "이것은 CI가 잡아야 할 오류입니다";
