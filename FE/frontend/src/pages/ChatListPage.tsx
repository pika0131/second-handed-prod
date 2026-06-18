/**
 * 채팅 목록 페이지
 *
 * URL: /chat
 * 로그인 필요.
 *
 * 화면 구성 (위에서 아래 순서):
 *  1. 관리자 검토 알림   — reason이 "[검토 중]"으로 시작하는 AdminMsg (보라색)
 *  2. 관리자 삭제 알림   — 나머지 AdminMsg (빨간색)
 *  3. 승인 대기 중       — 구매자가 보낸 요청 중 아직 판매자 미승인 (pendingReqs)
 *  4. 구매 요청          — 판매자가 받은 구매 요청 (receivedReqs), 수락/거절 버튼 포함
 *  5. 채팅방 목록        — 채팅방 목록 (unread 배지 포함)
 *
 * WebSocket 구독:
 *  - /topic/purchase/{cno}           : 새 구매 요청 실시간 수신
 *  - /topic/purchase/{cno}/deleted   : 요청 삭제 신호 (itemNo 전체 또는 requestCno 개별)
 *  - /topic/purchase/pending/{cno}/deleted : 구매자 pending 요청 삭제 신호
 *  - /topic/chat/{roomNo}            : 각 채팅방 메시지 — unreadMap 즉시 갱신
 *
 * 폴링: 5초마다 getUnreadCounts를 호출해 unreadMap을 동기화한다.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle, ChevronRight, ShieldAlert, ShoppingBag,
  Check, X, Clock, Eye,
} from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { chatApi, customerApi, adminApi, purchaseApi, itemApi } from '@/api/client';
import type { AdminMsg, ChatRoom, UnreadCount, ReceivedPurchaseReq } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState } from '@/components/ui';

/** ISO 문자열을 상대 시간 또는 날짜로 포맷 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000)        return '방금 전';
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatPrice(price: number): string {
  return price.toLocaleString('ko-KR') + '원';
}

export function ChatListPage() {
  const { user } = useAuth();

  const [rooms, setRooms]               = useState<ChatRoom[]>([]);
  const [unreadMap, setUnreadMap]       = useState<Record<number, number>>({});
  const [nicknameMap, setNicknameMap]   = useState<Record<string, string>>({});
  const [itemTitleMap, setItemTitleMap] = useState<Record<string, string>>({});
  const [adminMsgs, setAdminMsgs]       = useState<AdminMsg[]>([]);
  const [receivedReqs, setReceivedReqs] = useState<ReceivedPurchaseReq[]>([]);
  const [pendingReqs, setPendingReqs]   = useState<ReceivedPurchaseReq[]>([]);
  const [processingReq, setProcessingReq] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // 초기 데이터 로드 — 채팅방, 안읽음, 관리자 알림, 구매 요청 한 번에 조회
  useEffect(() => {
    if (!user) return;
    Promise.all([
      chatApi.getRoomsForUser(user.cno),
      chatApi.getUnreadCounts(user.cno),
      adminApi.getMessages(user.cno).catch(() => [] as AdminMsg[]),
      purchaseApi.getReceived(user.cno).catch(() => [] as ReceivedPurchaseReq[]),
      purchaseApi.getPending(user.cno).catch(() => [] as ReceivedPurchaseReq[]),
    ])
      .then(([r, u, msgs, reqs, pending]: [
        ChatRoom[], UnreadCount[], AdminMsg[], ReceivedPurchaseReq[], ReceivedPurchaseReq[]
      ]) => {
        // 채팅방 최신순 정렬
        const sorted = [...r].sort(
          (a, b) => new Date(b.createDatetime).getTime() - new Date(a.createDatetime).getTime(),
        );
        setRooms(sorted);
        setUnreadMap(Object.fromEntries(u.map((x) => [x.roomNo, x.unreadCount])));
        setAdminMsgs(msgs);
        setReceivedReqs(reqs);
        setPendingReqs(pending);

        // 닉네임 일괄 조회 (채팅 상대방 + 구매 요청자 + 대기 중 판매자)
        const allCnos = [
          ...new Set([
            ...sorted.map((room) => room.receiveCno === user.cno ? room.cno : room.receiveCno),
            ...reqs.map((req) => req.requestCno),
            ...pending.map((req) => req.cno),
          ]),
        ];
        Promise.all(
          allCnos.map((cno) =>
            customerApi.get(cno)
              .then((c) => [cno, c.nickname] as const)
              .catch(() => [cno, cno] as const),
          ),
        ).then((entries) => setNicknameMap(Object.fromEntries(entries)));

        // 채팅방별 상품명 일괄 조회 (중복 제거)
        const uniqueItems = [
          ...new Map(sorted.map((room) => [`${room.cno}-${room.itemNo}`, room])).values(),
        ];
        Promise.all(
          uniqueItems.map((room) =>
            itemApi.get(room.cno, room.itemNo)
              .then((i) => [`${room.cno}-${room.itemNo}`, i.title] as const)
              .catch(() => [`${room.cno}-${room.itemNo}`, `상품 #${room.itemNo}`] as const),
          ),
        ).then((entries) => setItemTitleMap(Object.fromEntries(entries)));
      })
      .catch((e) => setError(e.message ?? '채팅 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [user]);

  // WebSocket: 구매 요청 실시간 수신/삭제
  useEffect(() => {
    if (!user) return;
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        // 새 구매 요청 → receivedReqs에 추가 (중복 방지)
        client.subscribe(`/topic/purchase/${user.cno}`, (frame) => {
          const req: ReceivedPurchaseReq = JSON.parse(frame.body);
          setReceivedReqs((prev) => {
            if (prev.some((r) => r.requestCno === req.requestCno && r.itemNo === req.itemNo)) return prev;
            return [req, ...prev];
          });
          customerApi.get(req.requestCno)
            .then((c) => setNicknameMap((prev) => ({ ...prev, [req.requestCno]: c.nickname })))
            .catch(() => {});
        });

        // 요청 삭제 신호:
        //   itemNo만 있으면 해당 상품의 모든 요청 제거 (승인 후 나머지 자동 거절)
        //   requestCno도 있으면 개별 요청만 제거 (명시적 거절 또는 취소)
        client.subscribe(`/topic/purchase/${user.cno}/deleted`, (frame) => {
          const data: { requestCno?: string; itemNo: number } = JSON.parse(frame.body);
          setReceivedReqs((prev) =>
            data.requestCno
              ? prev.filter((r) => !(r.requestCno === data.requestCno && r.itemNo === data.itemNo))
              : prev.filter((r) => r.itemNo !== data.itemNo),
          );
        });

        // 판매자가 내 요청을 거절/승인하면 pendingReqs에서 제거
        client.subscribe(`/topic/purchase/pending/${user.cno}/deleted`, (frame) => {
          const data: { cno: string; itemNo: number } = JSON.parse(frame.body);
          setPendingReqs((prev) =>
            prev.filter((r) => !(r.cno === data.cno && r.itemNo === data.itemNo)),
          );
        });
      },
    });
    client.activate();
    return () => { client.deactivate(); };
  }, [user]);

  // WebSocket: 채팅방 메시지 — unreadMap을 즉시 업데이트
  useEffect(() => {
    if (!user || rooms.length === 0) return;
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        rooms.forEach((room) => {
          // 내 역할(B=구매자, S=판매자)을 결정하여 상대방 메시지만 카운트
          const mySender = room.receiveCno === user.cno ? 'B' : 'S';
          client.subscribe(`/topic/chat/${room.roomNo}`, (frame) => {
            const msg: { sender: string } = JSON.parse(frame.body);
            if (msg.sender !== mySender) {
              setUnreadMap((prev) => ({
                ...prev,
                [room.roomNo]: (prev[room.roomNo] ?? 0) + 1,
              }));
            }
          });
        });
      },
    });
    client.activate();
    return () => { client.deactivate(); };
  }, [user, rooms]);

  // 폴링: 5초마다 안읽음 수 동기화 (WebSocket 누락 보완)
  useEffect(() => {
    if (!user) return;
    const poll = () => {
      chatApi.getUnreadCounts(user.cno)
        .then((u) => setUnreadMap(Object.fromEntries(u.map((x) => [x.roomNo, x.unreadCount]))))
        .catch(() => {});
    };
    const id = setInterval(poll, 5000);
    window.addEventListener('focus', poll);
    return () => { clearInterval(id); window.removeEventListener('focus', poll); };
  }, [user]);

  /** 구매 요청 수락 — 채팅방 생성 후 rooms에 추가 */
  const handleApprove = async (req: ReceivedPurchaseReq) => {
    const key = `${req.requestCno}-${req.itemNo}`;
    setProcessingReq(key);
    try {
      await purchaseApi.approve(req.requestCno, req.cno, req.itemNo);
      const room = await chatApi.getOrCreateRoom(req.requestCno, req.cno, req.itemNo);
      // 해당 상품의 모든 구매 요청 제거 (수락 + 자동 거절된 나머지)
      setReceivedReqs((prev) => prev.filter((r) => r.itemNo !== req.itemNo));
      // 채팅방 목록에 추가 (중복 방지)
      setRooms((prev) =>
        prev.some((r) => r.roomNo === room.roomNo) ? prev : [room, ...prev],
      );
      if (!nicknameMap[req.requestCno]) {
        customerApi.get(req.requestCno)
          .then((c) => setNicknameMap((prev) => ({ ...prev, [req.requestCno]: c.nickname })))
          .catch(() => {});
      }
    } catch (e) {
      alert('수락 처리 실패: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setProcessingReq(null);
    }
  };

  /** 구매 요청 거절 — REJECT_NOTICE 채팅 메시지 전송 포함 */
  const handleReject = async (req: ReceivedPurchaseReq) => {
    const key = `${req.requestCno}-${req.itemNo}`;
    setProcessingReq(key);
    try {
      await purchaseApi.rejectBySeller(req.requestCno, req.cno, req.itemNo);
      setReceivedReqs((prev) =>
        prev.filter((r) => !(r.requestCno === req.requestCno && r.itemNo === req.itemNo)),
      );
    } catch (e) {
      alert('거절 처리 실패: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setProcessingReq(null);
    }
  };

  if (loading) return <div className="py-20 text-center text-stone-400">불러오는 중…</div>;
  if (error)   return <div className="py-20 text-center text-red-500">{error}</div>;

  return (
    <div>
      <h1 className="mb-6 text-xl font-extrabold text-stone-900">채팅</h1>

      {/* ① 관리자 검토 알림 (보라색) — reason이 "[검토 중]"으로 시작하는 경우 */}
      {adminMsgs.filter((m) => m.reason.startsWith('[검토 중]')).length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-600">
            <Eye className="h-3.5 w-3.5" /> 검토 안내
          </p>
          {adminMsgs
            .filter((m) => m.reason.startsWith('[검토 중]'))
            .map((msg) => (
              <div
                key={msg.msgId}
                className={`rounded-xl border px-4 py-3 ${
                  msg.isRead === 'N' ? 'border-purple-200 bg-purple-50' : 'border-stone-200 bg-white opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-800">
                      {msg.isRead === 'N' && (
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-purple-500 align-middle" />
                      )}
                      검토 안내: <span className="text-purple-700">{msg.itemTitle}</span>
                    </p>
                    {/* "[검토 중] " 접두사를 제거하고 사유만 표시 */}
                    <p className="mt-1 text-sm text-stone-600">
                      {msg.reason.replace(/^\[검토 중\] /, '')}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">{formatDate(msg.sentAt)}</p>
                  </div>
                  {msg.isRead === 'N' && (
                    <button
                      onClick={() => {
                        adminApi.markRead(msg.msgId).catch(() => {});
                        setAdminMsgs((prev) =>
                          prev.map((m) => (m.msgId === msg.msgId ? { ...m, isRead: 'Y' } : m)),
                        );
                      }}
                      className="shrink-0 rounded-lg border border-purple-200 px-2.5 py-1 text-xs text-purple-600 hover:bg-purple-100"
                    >
                      확인
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ② 관리자 삭제 알림 (빨간색) */}
      {adminMsgs.filter((m) => !m.reason.startsWith('[검토 중]')).length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-500">
            <ShieldAlert className="h-3.5 w-3.5" /> 관리자 알림
          </p>
          {adminMsgs
            .filter((m) => !m.reason.startsWith('[검토 중]'))
            .map((msg) => (
              <div
                key={msg.msgId}
                className={`rounded-xl border px-4 py-3 ${
                  msg.isRead === 'N' ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-800">
                      {msg.isRead === 'N' && (
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
                      )}
                      상품 삭제 안내: <span className="text-red-600">{msg.itemTitle}</span>
                    </p>
                    <p className="mt-1 text-sm text-stone-600">{msg.reason}</p>
                    <p className="mt-1 text-xs text-stone-400">{formatDate(msg.sentAt)}</p>
                  </div>
                  {msg.isRead === 'N' && (
                    <button
                      onClick={() => {
                        adminApi.markRead(msg.msgId).catch(() => {});
                        setAdminMsgs((prev) =>
                          prev.map((m) => (m.msgId === msg.msgId ? { ...m, isRead: 'Y' } : m)),
                        );
                      }}
                      className="shrink-0 rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100"
                    >
                      확인
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ③ 승인 대기 중 — 구매자가 보낸 요청이 아직 판매자 미승인 상태 */}
      {pendingReqs.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <Clock className="h-3.5 w-3.5" /> 판매자의 승인을 기다리는 중{' '}
            <span className="ml-0.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-stone-600">
              {pendingReqs.length}
            </span>
          </p>
          <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {pendingReqs.map((req) => {
              const key  = `pending-${req.cno}-${req.itemNo}`;
              const busy = processingReq === key;
              return (
                <div key={key} className="flex items-start gap-3 px-4 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100">
                    <Clock className="h-4 w-4 text-stone-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-stone-800">
                        {nicknameMap[req.cno] ?? req.cno}
                      </span>
                      <span className="text-xs text-stone-400">판매자 · 상품 #{req.itemNo}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-stone-500">{req.itemTitle}</p>
                    <p className="mt-1 text-sm font-bold text-stone-700">{formatPrice(req.reqPrice)}</p>
                    {req.reqMessage && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-stone-500">{req.reqMessage}</p>
                    )}
                    <p className="mt-1 text-xs text-stone-400">{formatDate(req.reqDateTime)}</p>
                  </div>
                  {/* 구매자가 직접 요청을 취소 (메시지 없이 단순 삭제) */}
                  <button
                    onClick={async () => {
                      setProcessingReq(key);
                      try {
                        await purchaseApi.reject(req.requestCno, req.cno, req.itemNo);
                        setPendingReqs((prev) =>
                          prev.filter((r) => !(r.cno === req.cno && r.itemNo === req.itemNo)),
                        );
                      } catch {
                        alert('요청 취소에 실패했습니다.');
                      } finally {
                        setProcessingReq(null);
                      }
                    }}
                    disabled={busy}
                    className="shrink-0 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-500 hover:bg-stone-50 disabled:opacity-50"
                  >
                    취소
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ④ 판매자가 받은 구매 요청 목록 — 수락/거절 버튼 포함 */}
      {receivedReqs.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600">
            <ShoppingBag className="h-3.5 w-3.5" /> 구매 요청{' '}
            <span className="ml-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700">
              {receivedReqs.length}
            </span>
          </p>
          <div className="divide-y divide-stone-100 rounded-2xl border border-amber-200 bg-white">
            {receivedReqs.map((req) => {
              const key  = `${req.requestCno}-${req.itemNo}`;
              const busy = processingReq === key;
              return (
                <div key={key} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-stone-800">
                          {nicknameMap[req.requestCno] ?? req.requestCno}
                        </span>
                        <span className="text-xs text-stone-400">상품 #{req.itemNo}</span>
                        <span className="truncate text-xs text-stone-500">· {req.itemTitle}</span>
                      </div>
                      <p className="mt-1 text-base font-bold text-amber-600">
                        {formatPrice(req.reqPrice)}
                      </p>
                      {req.reqMessage && (
                        <p className="mt-1 line-clamp-2 text-sm text-stone-600">{req.reqMessage}</p>
                      )}
                      <p className="mt-1 text-xs text-stone-400">{formatDate(req.reqDateTime)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={busy}
                        className="flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />수락
                      </button>
                      <button
                        onClick={() => handleReject(req)}
                        disabled={busy}
                        className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />거절
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ⑤ 채팅방 목록 */}
      {rooms.length > 0 && (
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
          <MessageCircle className="h-3.5 w-3.5" /> 채팅
        </p>
      )}
      {rooms.length === 0 && receivedReqs.length === 0 ? (
        <EmptyState
          title="채팅 내역이 없습니다"
          description="상품 페이지에서 '채팅으로 거래하기'를 눌러 대화를 시작해보세요."
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              상품 보러 가기
            </Link>
          }
        />
      ) : rooms.length === 0 ? null : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {rooms.map((room) => {
            // room.cno = 판매자, room.receiveCno = 구매자
            const isBuyer       = room.receiveCno === user?.cno;
            const partnerCno    = isBuyer ? room.cno : room.receiveCno;
            const partnerNickname = nicknameMap[partnerCno] ?? partnerCno;
            const unread        = unreadMap[room.roomNo] ?? 0;

            return (
              <Link
                key={room.roomNo}
                to={`/chat/${room.roomNo}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-stone-50"
              >
                <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-brand-100 text-brand-600">
                  <MessageCircle className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <span className="truncate font-semibold text-stone-800">{partnerNickname}</span>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-400">
                    <span className="truncate">
                      {itemTitleMap[`${room.cno}-${room.itemNo}`] ?? `상품 #${room.itemNo}`}
                    </span>
                    <span className="mx-0.5 shrink-0">·</span>
                    <span className="shrink-0">{formatDate(room.createDatetime)}</span>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  {unread > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1.5 text-xs font-bold text-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-stone-300" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
