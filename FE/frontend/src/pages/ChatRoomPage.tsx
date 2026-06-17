import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Send, Wifi, WifiOff, X, ImageOff } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { chatApi, customerApi, itemApi, purchaseApi } from '@/api/client';
import type { ChatMessage, ChatRoom, Item } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';

const WS_URL = `${window.location.origin}/ws`;

// 시스템 메시지 상수
const REJECT_MSG = '❌ 최종 가격을 거절했습니다.';
const CANCEL_MSG = '🚫 판매자가 거래를 취소했습니다.';
const APPROVE_MSG = '판매자가 요청을 수락했어요.';

interface FinalPricePayload {
  type: 'FINAL_PRICE';
  title: string;
  price: number;
}

interface RejectNoticePayload {
  type: 'REJECT_NOTICE';
  itemTitle: string;
  cno: string;
  itemNo: number;
  pic1Url: string | null;
}

function parseFinalPrice(content: string): FinalPricePayload | null {
  try {
    if (!content.startsWith('{')) return null;
    const obj = JSON.parse(content);
    if (obj.type === 'FINAL_PRICE') return obj as FinalPricePayload;
  } catch {}
  return null;
}

function parseRejectNotice(content: string): RejectNoticePayload | null {
  try {
    if (!content.startsWith('{')) return null;
    const obj = JSON.parse(content);
    if (obj.type === 'REJECT_NOTICE') return obj as RejectNoticePayload;
  } catch {}
  return null;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export function ChatRoomPage() {
  const { roomNo } = useParams<{ roomNo: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [partnerNickname, setPartnerNickname] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 최종 가격 모달 (판매자용)
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [finalPriceInput, setFinalPriceInput] = useState('');

  // 수락 처리 중 여부
  const [accepting, setAccepting] = useState(false);

  // 거래 완료 여부
  const [tradeCompleted, setTradeCompleted] = useState(false);

  // 거래 취소 여부 (판매자가 재협상 거부)
  const [tradeCancelled, setTradeCancelled] = useState(false);

  // 거절된 가격 제안 카드의 seqNo 집합
  const [rejectedSeqNos, setRejectedSeqNos] = useState<Set<number>>(new Set());

  // 판매자 재협상 프롬프트 표시 여부
  const [showRenegotiatePrompt, setShowRenegotiatePrompt] = useState(false);

  const [pendingMessage] = useState<string | null>(
    (location.state as { purchaseMessage?: string } | null)?.purchaseMessage ?? null,
  );
  const pendingSentRef = useRef(false);
  const stompRef = useRef<Client | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const myRoleRef = useRef<'B' | 'S' | null>(null);

  // 방 정보 + 메시지 로드
  useEffect(() => {
    if (!user || !roomNo) return;
    const rn = Number(roomNo);

    Promise.all([
      chatApi.getRoomsForUser(user.cno),
      chatApi.getMessages(rn),
    ])
      .then(([rooms, msgs]) => {
        const found = rooms.find((r) => r.roomNo === rn);
        if (!found) { setError('참여하지 않은 채팅방입니다.'); return; }
        const role: 'B' | 'S' = found.receiveCno === user.cno ? 'B' : 'S';
        myRoleRef.current = role;
        setRoom(found);
        setMessages(msgs);
        chatApi.markAsRead(rn, role).catch(() => {});

        // 기존 메시지에서 취소/재협상 상태 복원
        if (msgs.some((m) => m.content === CANCEL_MSG)) {
          setTradeCancelled(true);
        } else if (role === 'S') {
          // 가장 최근 거절 메시지 이후 새 가격 제안이 없으면 재협상 프롬프트 표시
          const reversed = [...msgs].reverse();
          const lastRejectIdx = reversed.findIndex((m) => m.content === REJECT_MSG);
          if (lastRejectIdx >= 0) {
            const afterReject = reversed.slice(0, lastRejectIdx);
            if (!afterReject.some((m) => parseFinalPrice(m.content))) {
              setShowRenegotiatePrompt(true);
            }
          }
        }

        // 이미 처리된 가격 제안 카드 복원 (수락·거절·취소 메시지가 뒤따르는 카드)
        const actedSeqNos = new Set<number>();
        let pendingFpSeqNo: number | null = null;
        for (const m of msgs) {
          if (parseFinalPrice(m.content)) {
            pendingFpSeqNo = m.seqNo;
          } else if (pendingFpSeqNo !== null) {
            if (
              m.content === REJECT_MSG ||
              m.content === CANCEL_MSG ||
              m.content.startsWith('✅')
            ) {
              actedSeqNos.add(pendingFpSeqNo);
              pendingFpSeqNo = null;
            }
          }
        }
        if (actedSeqNos.size > 0) setRejectedSeqNos(actedSeqNos);
      })
      .catch((e) => setError(e.message ?? '채팅방을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [roomNo, user]);

  // 방 정보가 로드되면 상품 정보 + 상대방 닉네임도 가져옴
  useEffect(() => {
    if (!room || !user) return;
    itemApi.get(room.cno, room.itemNo).then((i) => {
      setItem(i);
      if (i.sellStatus === '거래 완료') {
        setTradeCompleted(true);
      } else if (i.sellStatus === '예약 중') {
        // 새 거래가 수락된 상태 → 이전 세션의 취소/완료 잠금 해제
        setTradeCompleted(false);
        setTradeCancelled(false);
      }
    }).catch(() => {});
    const pCno = room.receiveCno === user.cno ? room.cno : room.receiveCno;
    customerApi.get(pCno).then((c) => setPartnerNickname(c.nickname)).catch(() => setPartnerNickname(pCno));
  }, [room, user]);

  // STOMP WebSocket 연결
  useEffect(() => {
    if (!roomNo) return;
    const rn = Number(roomNo);
    let cancelled = false;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        if (cancelled) return;
        setConnected(true);
        client.subscribe(`/topic/chat/${rn}`, (frame) => {
          const msg: ChatMessage = JSON.parse(frame.body);
          setMessages((prev) => {
            if (prev.some((m) => m.seqNo === msg.seqNo)) return prev;
            return [...prev, msg];
          });
          // 판매자: 구매자가 거절하면 재협상 프롬프트
          if (myRoleRef.current === 'S' && msg.sender === 'B' && msg.content === REJECT_MSG) {
            setShowRenegotiatePrompt(true);
          }
          // 취소 메시지 수신 시 채팅 잠금
          if (msg.content === CANCEL_MSG) {
            setTradeCancelled(true);
          }
          if (msg.sender !== myRoleRef.current && myRoleRef.current) {
            chatApi.markAsRead(rn, myRoleRef.current).catch(() => {});
          }
        });
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    });

    client.activate();
    stompRef.current = client;

    return () => {
      cancelled = true;
      client.deactivate();
      stompRef.current = null;
      setConnected(false);
    };
  }, [roomNo]);

  // 거래 요청 메시지 자동 전송
  useEffect(() => {
    if (!pendingMessage || pendingSentRef.current || !connected || !room || !myRoleRef.current || !stompRef.current?.connected) return;
    pendingSentRef.current = true;
    stompRef.current.publish({
      destination: `/app/chat/${roomNo}`,
      body: JSON.stringify({ sender: myRoleRef.current, content: pendingMessage }),
    });
  }, [pendingMessage, connected, room, roomNo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const publish = (content: string) => {
    if (!stompRef.current?.connected || !myRoleRef.current) return;
    stompRef.current.publish({
      destination: `/app/chat/${roomNo}`,
      body: JSON.stringify({ sender: myRoleRef.current, content }),
    });
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    publish(text);
    setInput('');
  };

  // 판매자: 최종 가격 제안 메시지 전송
  const sendFinalPrice = () => {
    const price = Number(finalPriceInput);
    if (!price || price <= 0) return;
    const payload: FinalPricePayload = {
      type: 'FINAL_PRICE',
      title: item?.title ?? `상품 #${room?.itemNo}`,
      price,
    };
    publish(JSON.stringify(payload));
    setShowPriceModal(false);
    setFinalPriceInput('');
    setShowRenegotiatePrompt(false);
  };

  // 구매자: 수락
  const handleAccept = async (price: number) => {
    if (!room || accepting || tradeCompleted || tradeCancelled) return;
    setAccepting(true);
    try {
      await purchaseApi.complete(room.receiveCno, room.cno, room.itemNo, price);
      publish('✅ 최종 가격을 수락했습니다. 거래가 완료되었습니다.');
      setTradeCompleted(true);
    } catch {
      alert('수락 처리 중 오류가 발생했습니다.');
      setAccepting(false);
    }
  };

  // 구매자: 거절
  const handleReject = (seqNo: number) => {
    if (tradeCompleted || tradeCancelled || rejectedSeqNos.has(seqNo)) return;
    setRejectedSeqNos((prev) => new Set([...prev, seqNo]));
    publish(REJECT_MSG);
  };

  // 판매자: 거래 취소 (재협상 거부)
  const handleCancelTrade = () => {
    setShowRenegotiatePrompt(false);
    publish(CANCEL_MSG);
    setTradeCancelled(true);
  };

  if (loading) return <div className="py-20 text-center text-stone-400">불러오는 중…</div>;

  if (error)
    return (
      <div className="py-20 text-center">
        <p className="text-red-500">{error}</p>
        <button onClick={() => navigate('/chat')} className="mt-4 text-sm text-brand-600 hover:underline">
          채팅 목록으로
        </button>
      </div>
    );

  const isBuyer = room?.receiveCno === user?.cno;
  const partnerCno = room ? (isBuyer ? room.cno : room.receiveCno) : '';
  const chatLocked = tradeCompleted || tradeCancelled;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 160px)' }}>
      {/* 헤더 */}
      <div className="flex flex-shrink-0 items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 mb-3">
        <button
          onClick={() => navigate('/chat')}
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* 상품 썸네일 */}
        {item?.pic1Url ? (
          <img
            src={item.pic1Url}
            alt={item.title}
            className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-stone-100">
            <ImageOff className="h-4 w-4 text-stone-300" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-stone-900">{partnerNickname ?? partnerCno}</p>
          <p className="truncate text-xs text-stone-400">
            {item?.title ?? `상품 #${room?.itemNo}`}
          </p>
        </div>
        <span className={`flex flex-shrink-0 items-center gap-1 text-xs ${connected ? 'text-green-500' : 'text-stone-400'}`}>
          {connected ? <><Wifi className="h-3.5 w-3.5" /> 연결됨</> : <><WifiOff className="h-3.5 w-3.5" /> 연결 중…</>}
        </span>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50 px-3 py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-stone-400">첫 메시지를 보내 대화를 시작해보세요.</p>
        )}
        <div className="space-y-2">
          {messages.map((msg) => {
            const isMe = msg.sender === myRoleRef.current;
            const rn = parseRejectNotice(msg.content);
            const fp = parseFinalPrice(msg.content);

            // 수락 시스템 메시지
            if (msg.content === APPROVE_MSG) {
              return (
                <div key={msg.seqNo} className="flex justify-center my-3">
                  <div className="flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5">
                    <span className="text-xs font-semibold text-emerald-600">✅ {APPROVE_MSG}</span>
                    <span className="text-xs text-stone-400">{formatTime(msg.sentDatetime)}</span>
                  </div>
                </div>
              );
            }

            // 거절 알림 카드
            if (rn) {
              return (
                <div key={msg.seqNo} className="flex justify-center my-3">
                  <div className="w-72 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 bg-stone-500 px-4 py-2">
                      <span className="text-xs font-bold text-white">❌ 구매 요청 거절</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3">
                      {rn.pic1Url ? (
                        <img
                          src={rn.pic1Url}
                          alt={rn.itemTitle}
                          className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-lg bg-stone-100">
                          <ImageOff className="h-5 w-5 text-stone-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-700">{rn.itemTitle}</p>
                        <p className="mt-0.5 text-xs text-stone-500">판매자가 요청을 거절했습니다.</p>
                      </div>
                    </div>
                    <p className="px-4 pb-2 text-right text-xs text-stone-400">{formatTime(msg.sentDatetime)}</p>
                  </div>
                </div>
              );
            }

            // 최종 가격 제안 카드
            if (fp) {
              const isRejected = rejectedSeqNos.has(msg.seqNo);
              return (
                <div key={msg.seqNo} className="flex justify-center my-3">
                  <div className="w-72 rounded-2xl border border-brand-200 bg-white shadow-sm overflow-hidden">
                    <div className={`px-4 py-2 flex items-center justify-between ${
                      isRejected || tradeCancelled ? 'bg-stone-400' : tradeCompleted ? 'bg-emerald-500' : 'bg-brand-500'
                    }`}>
                      <p className="text-xs font-bold text-white">
                        {isRejected || tradeCancelled ? '❌ 거절된 제안' : tradeCompleted ? '✅ 수락된 제안' : '💰 최종 가격 제안'}
                      </p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="font-semibold text-stone-800 text-sm">{fp.title}</p>
                      <p className={`mt-1 text-xl font-extrabold ${isRejected || tradeCancelled ? 'text-stone-400 line-through' : 'text-brand-600'}`}>
                        {fp.price.toLocaleString()}원
                      </p>
                      <p className="mt-0.5 text-xs text-stone-400">{formatTime(msg.sentDatetime)}</p>
                      {isBuyer && (
                        <div className="mt-3">
                          {isRejected || tradeCancelled ? (
                            <div className="flex items-center justify-center rounded-lg bg-stone-100 py-2 text-sm font-semibold text-stone-400">
                              거절됨
                            </div>
                          ) : tradeCompleted ? (
                            <div className="flex items-center justify-center rounded-lg bg-emerald-50 py-2 text-sm font-semibold text-emerald-600">
                              거래 완료
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAccept(fp.price)}
                                disabled={accepting}
                                className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                              >
                                {accepting ? '처리 중…' : '수락'}
                              </button>
                              <button
                                onClick={() => handleReject(msg.seqNo)}
                                className="flex-1 rounded-lg border border-stone-300 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
                              >
                                거절
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // 일반 메시지
            return (
              <div key={msg.seqNo} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[70%] flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isMe ? 'rounded-tr-sm bg-brand-500 text-white' : 'rounded-tl-sm bg-white text-stone-800 shadow-sm'
                  }`}>
                    {msg.content}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isMe && msg.isRead === 'Y' && <span className="text-xs text-stone-400">읽음</span>}
                    <span className="text-xs text-stone-400">{formatTime(msg.sentDatetime)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="flex-shrink-0 pt-3 space-y-2">
        {chatLocked ? (
          <div className="flex items-center justify-center rounded-xl border border-stone-200 bg-stone-50 py-3 text-sm font-medium text-stone-400">
            이미 거래가 완료된 상품입니다.
          </div>
        ) : (
          <>
            {/* 판매자: 구매자가 거절했을 때 재협상 프롬프트 */}
            {!isBuyer && showRenegotiatePrompt && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-800">구매자가 최종 가격 제안을 거절했습니다.</p>
                <p className="mt-0.5 text-sm text-amber-700">가격을 조정하시겠어요?</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setShowRenegotiatePrompt(false);
                      setFinalPriceInput('');
                      setShowPriceModal(true);
                    }}
                    className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                  >
                    예, 가격 재제안
                  </button>
                  <button
                    onClick={handleCancelTrade}
                    className="flex-1 rounded-lg border border-stone-300 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
                  >
                    아니오, 거래 취소
                  </button>
                </div>
              </div>
            )}

            {/* 판매자 전용: 최종 가격 제안 버튼 */}
            {!isBuyer && !showRenegotiatePrompt && (
              <button
                onClick={() => { setFinalPriceInput(''); setShowPriceModal(true); }}
                disabled={!connected}
                className="w-full rounded-xl border border-brand-300 bg-brand-50 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-100 disabled:opacity-40"
              >
                💰 최종 가격 제안하기
              </button>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={connected ? '메시지를 입력하세요… (Enter로 전송)' : '서버에 연결 중… 잠시만 기다려주세요'}
                className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-stone-400 focus:border-brand-400"
              />
              <button
                onClick={sendMessage}
                disabled={!connected || !input.trim()}
                className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {!connected && (
              <p className="text-center text-xs text-stone-400">Spring Boot 서버(8080)가 실행 중인지 확인하세요</p>
            )}
          </>
        )}
      </div>

      {/* 최종 가격 제안 모달 (판매자) */}
      {showPriceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPriceModal(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-stone-900">최종 가격 제안</h2>
              <button
                onClick={() => setShowPriceModal(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {item && (
              <div className="mb-4 rounded-xl bg-stone-50 px-4 py-3">
                <p className="font-semibold text-stone-800 text-sm">{item.title}</p>
                <p className="text-xs text-stone-400 mt-0.5">등록 가격: {item.price.toLocaleString()}원</p>
              </div>
            )}
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">최종 가격 <span className="text-red-500">*</span></span>
              <div className="relative mt-1">
                <input
                  type="number"
                  min={1}
                  value={finalPriceInput}
                  onChange={(e) => setFinalPriceInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendFinalPrice(); }}
                  placeholder="최종 거래 가격을 입력하세요"
                  autoFocus
                  className="w-full rounded-xl border border-stone-300 py-2.5 pl-4 pr-10 text-sm outline-none focus:border-brand-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">원</span>
              </div>
            </label>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowPriceModal(false)}
                className="flex-1 rounded-xl border border-stone-300 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50"
              >
                취소
              </button>
              <button
                onClick={sendFinalPrice}
                disabled={!finalPriceInput || Number(finalPriceInput) <= 0}
                className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
              >
                제안 전송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
