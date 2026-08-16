/* ════════════════════════════════════════════════════════════════════
   문자 발송 API  ·  /api/send-sms
   ────────────────────────────────────────────────────────────────────
   위치: src/app/api/send-sms/route.js   (Next.js 14 App Router)

   왜 이 파일이 필요한가
     솔라피 API는 브라우저에서 직접 부를 수 없다.
       ① CORS 로 차단된다.
       ② API Secret 을 HTML 에 넣으면 소스보기로 다 보인다.
          (GitHub 저장소가 Public 이라 더 위험)
     그래서 Vercel 서버가 대신 부른다. Secret 은 서버에만 있고
     브라우저로는 절대 내려가지 않는다.

   흐름
     student-portal-admin.html
        │  ① 로그인한 선생님의 Firebase ID 토큰 + 보낼 내용
        ▼
     /api/send-sms  (이 파일 · Vercel 서버)
        │  ② 토큰 검증 → users/{uid}.status === 'approved' 확인
        │  ③ 번호 형식 검사 · 중복 제거 · 건수 제한
        ▼
     솔라피 API  →  학부모 휴대폰

   Vercel 환경변수 (Settings → Environment Variables)
     SOLAPI_API_KEY      발급받은 API Key
     SOLAPI_API_SECRET   발급받은 API Secret
     SOLAPI_SENDER       발신번호 (하이픈 없이 · 예 01012345678)

   추가 npm 설치 없음 — Node 내장 crypto 와 fetch 만 사용한다.

   ────────────────────────────────────────────────────────────────────
   ★ 2026-08 수정 — LMS 제목 기본값
     예전 기본값이 옛 학원 이름으로 되어 있었다. 이 값은 평소에는
     쓰이지 않지만(HTML 이 subject 를 함께 보내준다), 그 값이 빠지거나
     빈 문자열로 오면 학부모 휴대폰에 그대로 제목으로 찍힌다.
     기본값을 ACADEMY_NAME 상수 하나로 모아 「인후쌤 과학수업」으로
     통일했다. 앞으로 이름을 바꿀 일이 생기면 이 상수 한 곳만 고치면 된다.
════════════════════════════════════════════════════════════════════ */

import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ── 상수 ─────────────────────────────────────────────────────────── */
const SOLAPI_SEND     = 'https://api.solapi.com/messages/v4/send-many/detail';
const SOLAPI_BALANCE  = 'https://api.solapi.com/cash/v1/balance';
const IDENTITY_LOOKUP = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
const FIRESTORE_BASE  = 'https://firestore.googleapis.com/v1/projects';

/* ★ 학원 이름 — LMS 제목 기본값으로 쓰인다. 이 한 곳만 고치면 전체 반영된다. */
const ACADEMY_NAME = '인후쌤 과학수업';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'beta-science';
// 웹 API 키는 원래 HTML 에 공개되는 값이라 여기 있어도 보안 문제가 없다.
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyD5MQx_rXO_xRYelyKxK090TaKa3Gg2D3k';

const MAX_RECIPIENTS = 50;    // 한 번에 보낼 수 있는 최대 인원 (솔라피 개인계정 일일 한도와 동일)
const SMS_BYTE_LIMIT = 90;    // 이 이하면 SMS, 넘으면 LMS
const LMS_BYTE_LIMIT = 1900;  // LMS 본문 상한 (규격 2000, 여유 둠)
const SUBJECT_BYTE_LIMIT = 38;

/* ── 유틸 ─────────────────────────────────────────────────────────── */
const onlyDigits = v => String(v == null ? '' : v).replace(/\D/g, '');

// 휴대폰 번호만 허용 (010/011/016/017/018/019)
function normPhone(v) {
  const d = onlyDigits(v);
  return /^01[016789]\d{7,8}$/.test(d) ? d : '';
}

// 통신사 기준 바이트 수 (한글·전각 2바이트, 그 외 1바이트)
function byteLen(s) {
  let n = 0;
  for (const ch of String(s == null ? '' : s)) n += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  return n;
}

// 바이트 기준 자르기 (글자 중간에서 끊기지 않게)
function cutBytes(s, limit) {
  let n = 0, out = '';
  for (const ch of String(s == null ? '' : s)) {
    const w = ch.charCodeAt(0) > 0x7f ? 2 : 1;
    if (n + w > limit) break;
    n += w; out += ch;
  }
  return out;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

/* ── 숫자·금액 처리 ────────────────────────────────────────────────
   솔라피 응답에서 금액은 자리에 따라 숫자로 오기도 하고
   { requested, replacement, refund, sum } 객체로 오기도 한다.
   객체를 그대로 Number() 하면 NaN 이 되므로 반드시 아래 함수로 꺼낸다. */
function toNum(v) {
  if (v === null || v === undefined || v === '') return null;  // Number(null)===0 함정 차단
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// 숫자 또는 {sum:...} 객체 → 숫자 (못 꺼내면 null)
function pickAmount(v) {
  if (v == null) return null;
  if (typeof v === 'object') return toNum(v.sum);
  return toNum(v);
}

// 1234 → "1,234원"  (ICU 환경 의존 없이 직접 콤마 처리)
function won(n) {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? '-' : '';
  return sign + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원';
}

/* ── 솔라피 인증 헤더 (HMAC-SHA256) ───────────────────────────────── */
function solapiAuth(apiKey, apiSecret) {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString('hex');
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

/* ── 현재 잔액 조회 ────────────────────────────────────────────────
   발송 응답(groupInfo)에 들어있는 balance/point 는 "이번 발송 차감액"이지
   계좌 잔액이 아니다. 남은 잔액은 반드시 이 전용 API로 다시 물어본다.
   실패해도 발송 결과에는 영향을 주지 않도록 null 만 돌려준다. */
async function fetchBalance(apiKey, apiSecret) {
  try {
    const r = await fetch(SOLAPI_BALANCE, {
      headers: { Authorization: solapiAuth(apiKey, apiSecret) }
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d || typeof d !== 'object') return null;
    const b = toNum(d.balance);
    const p = toNum(d.point);
    if (b == null && p == null) return null;
    return won((b || 0) + (p || 0));
  } catch (e) {
    return null;
  }
}

/* ── 설정값 읽기 ──────────────────────────────────────────────────── */
function readConfig() {
  const apiKey    = String(process.env.SOLAPI_API_KEY || '').trim();
  const apiSecret = String(process.env.SOLAPI_API_SECRET || '').trim();
  const sender    = normPhone(process.env.SOLAPI_SENDER || '');
  const missing = [];
  if (!apiKey)    missing.push('SOLAPI_API_KEY');
  if (!apiSecret) missing.push('SOLAPI_API_SECRET');
  if (!sender)    missing.push('SOLAPI_SENDER');
  return { apiKey, apiSecret, sender, missing };
}

/* ── 로그인 검증 ──────────────────────────────────────────────────────
   ① Firebase ID 토큰이 진짜인지 확인 (구글 서버에 조회)
   ② 그 계정이 users/{uid}.status === 'approved' 인지 확인
   → 승인된 선생님만 문자를 보낼 수 있다.
     (누구나 회원가입은 할 수 있으므로 ②가 반드시 필요하다) */
async function verifyTeacher(idToken) {
  const tk = String(idToken || '').trim();
  if (!tk) return { ok: false, code: 401, msg: '로그인이 필요합니다. 페이지를 새로고침한 뒤 다시 시도해주세요.' };

  let uid = '', email = '';
  try {
    const r = await fetch(`${IDENTITY_LOOKUP}?key=${encodeURIComponent(WEB_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: tk })
    });
    const d = await r.json().catch(() => ({}));
    const u = d && Array.isArray(d.users) ? d.users[0] : null;
    if (!r.ok || !u || !u.localId) {
      return { ok: false, code: 401, msg: '로그인 정보가 만료되었습니다. 다시 로그인해주세요.' };
    }
    uid = String(u.localId);
    email = String(u.email || '');
  } catch (e) {
    return { ok: false, code: 502, msg: '로그인 확인 중 오류가 발생했습니다: ' + e.message };
  }

  try {
    const url = `${FIRESTORE_BASE}/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
    if (!r.ok) return { ok: false, code: 403, msg: '승인된 계정이 아닙니다. 관리자 승인 후 이용해주세요.' };
    const d = await r.json().catch(() => ({}));
    const status = d && d.fields && d.fields.status ? d.fields.status.stringValue : '';
    if (status !== 'approved') {
      return { ok: false, code: 403, msg: '승인 대기 중인 계정입니다. 관리자 승인 후 이용해주세요.' };
    }
  } catch (e) {
    return { ok: false, code: 502, msg: '계정 확인 중 오류가 발생했습니다: ' + e.message };
  }

  return { ok: true, uid, email };
}

/* ════════════════════════════════════════════════════════════════════
   GET /api/send-sms
   브라우저 주소창에 그냥 쳐서 "설정이 제대로 들어갔는지"만 확인하는 용도.
   Key·Secret 값은 절대 내려보내지 않고, 들어있는지 여부만 알려준다.
════════════════════════════════════════════════════════════════════ */
export async function GET() {
  const { apiKey, apiSecret, sender, missing } = readConfig();
  const masked = sender ? sender.slice(0, 3) + '-****-' + sender.slice(-4) : null;

  const body = {
    ok: missing.length === 0,
    검사결과: missing.length === 0 ? '환경변수 3개 모두 정상입니다 ✅' : '환경변수가 빠졌습니다 ❌',
    SOLAPI_API_KEY: apiKey ? '등록됨' : '없음',
    SOLAPI_API_SECRET: apiSecret ? '등록됨' : '없음',
    SOLAPI_SENDER: masked || '없음 (또는 형식 오류)',
    누락: missing
  };

  // 키가 다 있으면 솔라피에 잔액도 물어본다 → 키가 진짜 맞는지까지 확인된다
  if (missing.length === 0) {
    try {
      const r = await fetch(SOLAPI_BALANCE, {
        headers: { Authorization: solapiAuth(apiKey, apiSecret) }
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        body.솔라피연결 = '성공 ✅';
        const b = toNum(d.balance);
        const p = toNum(d.point);
        body.잔액 = (b == null && p == null) ? '조회 불가' : won((b || 0) + (p || 0));
      } else {
        body.ok = false;
        body.솔라피연결 = '실패 ❌ — API Key/Secret 을 다시 확인해주세요.';
        body.솔라피응답 = d.errorMessage || d.message || `HTTP ${r.status}`;
      }
    } catch (e) {
      body.ok = false;
      body.솔라피연결 = '실패 ❌ — ' + e.message;
    }
  }

  return json(body, body.ok ? 200 : 500);
}

/* ════════════════════════════════════════════════════════════════════
   POST /api/send-sms
   요청 형식
     {
       "idToken": "...",                      // Firebase 로그인 토큰 (필수)
       "subject": "인후쌤 과학수업",            // LMS 제목 (선택)
       "messages": [                          // 1~50건
         { "to": "010-1234-5678", "text": "..." },
         ...
       ],
       "dryRun": true                         // (선택) 실제로 보내지 않고 검사만
     }
   응답
     { ok, 요청:N, 성공:N, 실패:N, 종류:"LMS", 실패목록:[...],
       차감액:"34원", 잔액:"266원", groupId:"..." }
════════════════════════════════════════════════════════════════════ */
export async function POST(req) {
  /* ① 설정 확인 */
  const { apiKey, apiSecret, sender, missing } = readConfig();
  if (missing.length) {
    return json({
      ok: false,
      error: `Vercel 환경변수가 설정되지 않았습니다: ${missing.join(', ')}`,
      hint: 'Vercel → 프로젝트 → Settings → Environment Variables 에서 추가한 뒤 다시 배포해주세요.'
    }, 500);
  }

  /* ② 요청 본문 파싱 */
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json({ ok: false, error: '요청 형식이 올바르지 않습니다.' }, 400);
  }

  /* ③ 로그인·승인 확인 */
  const who = await verifyTeacher(body && body.idToken);
  if (!who.ok) return json({ ok: false, error: who.msg }, who.code);

  /* ④ 보낼 목록 정리 */
  const raw = Array.isArray(body.messages) ? body.messages : [];
  if (!raw.length) return json({ ok: false, error: '보낼 메시지가 없습니다.' }, 400);

  const seen = new Set();
  const bad = [];
  const list = [];
  raw.forEach((m, i) => {
    const name = String((m && m.name) || `${i + 1}번째`);
    const to = normPhone(m && m.to);
    const text = String((m && m.text) || '').trim();
    if (!to)   { bad.push({ name, reason: '휴대폰 번호 형식이 올바르지 않습니다' }); return; }
    if (!text) { bad.push({ name, reason: '문자 내용이 비어 있습니다' }); return; }
    if (byteLen(text) > LMS_BYTE_LIMIT) {
      bad.push({ name, reason: `내용이 너무 깁니다 (${byteLen(text)}/${LMS_BYTE_LIMIT}바이트)` });
      return;
    }
    if (seen.has(to)) { bad.push({ name, reason: '같은 번호가 중복되어 건너뛰었습니다' }); return; }
    seen.add(to);
    list.push({ name, to, text });
  });

  if (!list.length) {
    return json({ ok: false, error: '보낼 수 있는 대상이 없습니다.', 실패목록: bad }, 400);
  }
  if (list.length > MAX_RECIPIENTS) {
    return json({
      ok: false,
      error: `한 번에 최대 ${MAX_RECIPIENTS}명까지 보낼 수 있습니다. (요청 ${list.length}명)`
    }, 400);
  }

  /* ⑤ SMS / LMS 자동 판별
        90바이트 이하면 SMS(저렴), 넘으면 LMS.
        리포트 링크가 들어가면 거의 항상 LMS 가 된다.
        ★ 제목이 비어 오거나 공백만 오면 학원 이름으로 채운다.
          (빈 제목이 그대로 학부모 휴대폰에 찍히는 것을 막는다) */
  const subjectRaw = String(body.subject == null ? '' : body.subject).trim();
  const subject = cutBytes(subjectRaw || ACADEMY_NAME, SUBJECT_BYTE_LIMIT) || ACADEMY_NAME;
  const messages = list.map(m => {
    const isLms = byteLen(m.text) > SMS_BYTE_LIMIT;
    const one = { to: m.to, from: sender, text: m.text, type: isLms ? 'LMS' : 'SMS' };
    if (isLms) one.subject = subject;
    return one;
  });
  const kind = messages.some(m => m.type === 'LMS') ? 'LMS' : 'SMS';

  /* ⑥ 검사만 하고 끝내는 모드 (실제 발송 없음 · 요금 발생 없음) */
  if (body.dryRun) {
    return json({
      ok: true,
      dryRun: true,
      요청: raw.length,
      발송대상: list.length,
      종류: kind,
      제목: subject,
      발신번호: sender.slice(0, 3) + '-****-' + sender.slice(-4),
      미리보기: messages.slice(0, 3).map(m => ({
        받는번호: m.to.slice(0, 3) + '-****-' + m.to.slice(-4),
        종류: m.type,
        바이트: byteLen(m.text),
        내용: m.text
      })),
      실패목록: bad
    });
  }

  /* ⑦ 실제 발송 */
  let res, data;
  try {
    res = await fetch(SOLAPI_SEND, {
      method: 'POST',
      headers: {
        Authorization: solapiAuth(apiKey, apiSecret),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messages })
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    return json({ ok: false, error: '솔라피 연결 실패: ' + e.message }, 502);
  }

  if (!res.ok) {
    const code = data.errorCode || '';
    const msg  = data.errorMessage || data.message || `HTTP ${res.status}`;
    // 자주 나오는 오류는 한국어로 풀어서 알려준다
    const guide =
      /NotEnoughBalance|balance/i.test(code + msg) ? '솔라피 잔액이 부족합니다. 충전 후 다시 시도해주세요.' :
      /Sender|발신/i.test(code + msg)             ? '발신번호가 솔라피에 등록되어 있지 않습니다. 솔라피 → 발신번호 관리를 확인해주세요.' :
      /Authenticate|Unauthorized|signature/i.test(code + msg) ? 'API Key 또는 Secret 이 올바르지 않습니다. Vercel 환경변수를 확인해주세요.' :
      /LimitExceeded|limit/i.test(code + msg)     ? '오늘 발송 한도를 초과했습니다. (개인계정 기본 50건)' :
      '';
    return json({ ok: false, error: msg, code, hint: guide }, 502);
  }

  /* ⑧ 결과 정리 */
  const failedList = Array.isArray(data.failedMessageList) ? data.failedMessageList : [];
  const failedMap = new Map(failedList.map(f => [String(f.to || ''), f]));
  const failedNamed = list
    .filter(m => failedMap.has(m.to))
    .map(m => {
      const f = failedMap.get(m.to);
      return { name: m.name, reason: f.statusMessage || f.statusCode || '발송 실패' };
    });

  const okCount = list.length - failedNamed.length;
  const gi = (data && typeof data.groupInfo === 'object' && data.groupInfo) ? data.groupInfo : {};

  // 이번 발송으로 빠져나간 금액 (숫자/객체 두 형태 모두 대응)
  const cb = pickAmount(gi.balance);
  const cp = pickAmount(gi.point);
  const charged = (cb == null && cp == null) ? null : (cb || 0) + (cp || 0);

  // 남은 잔액은 전용 API로 재조회 (실패해도 발송 결과는 그대로 반환)
  const balanceText = await fetchBalance(apiKey, apiSecret);

  const out = {
    ok: true,
    요청: raw.length,
    성공: okCount,
    실패: failedNamed.length + bad.length,
    종류: kind,
    실패목록: bad.concat(failedNamed)
  };
  if (charged != null && charged > 0) out.차감액 = won(charged);
  if (balanceText) out.잔액 = balanceText;
  if (gi.groupId || data.groupId) out.groupId = gi.groupId || data.groupId;

  return json(out);
}
