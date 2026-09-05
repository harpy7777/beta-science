/* ════════════════════════════════════════════════════════════════════
   포털 데이터 API  ·  /api/portal
   ────────────────────────────────────────────────────────────────────
   위치: api/portal.js   (프로젝트 루트의 api 폴더 — backup.js 옆)

   무엇을 하는가
     학부모/학생 링크의 토큰 하나를 받아, 그 학생 것만 서버에서 읽어
     JSON 으로 돌려준다. 브라우저는 Firestore 를 직접 읽지 않는다.

   왜 필요한가
     Firestore 보안 규칙은 where 조건을 검사할 수 없다.
     그래서 students 를 where('viewToken','==',...) 로 찾으려면
     컬렉션 전체 읽기(list)를 열어야 하고, 그 순간 토큰까지 통째로
     털린다. 대조를 서버로 옮기면 students / classCards / grades /
     classOff 를 전부 isApproved() 로 잠글 수 있다.

   호출 방법
     GET /api/portal?t=<토큰>

   응답 (성공)
     {
       ok: true,
       student:   { __id, ... },   // 토큰 계열 필드는 제거됨
       classCards: [ { __id, ... } ],
       grades:     [ { __id, ... } ],
       classOff:   [ { __id, ... } ]
     }

   응답 (실패)
     400 { ok:false, error:'...' }   토큰이 없거나 형식이 이상함
     404 { ok:false, error:'...' }   토큰에 해당하는 학생이 없음
     500 { ok:false, error:'...' }   서버 오류

   ⚠ 이 파일은 서버에서만 실행된다. FIREBASE_SERVICE_ACCOUNT 는
     브라우저로 내려가지 않는다. (backup.js 와 같은 환경변수를 쓴다)
════════════════════════════════════════════════════════════════════ */

import admin from 'firebase-admin';

export const config = { maxDuration: 30 };

/* ── Firebase Admin 초기화 (backup.js 와 동일한 방식) ──────────── */
function getDb() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT 환경변수가 없습니다.');

    let cred;
    try {
      cred = JSON.parse(raw);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT 값이 올바른 JSON 이 아닙니다.');
    }

    if (typeof cred.private_key === 'string') {
      cred.private_key = cred.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  return admin.firestore();
}

/* ── Firestore 특수 타입을 JSON 으로 안전하게 바꾸기 ───────────── */
/*  브라우저에서 그대로 쓸 수 있도록 Timestamp 는 ISO 문자열로 편다. */
function encode(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof admin.firestore.GeoPoint) {
    return { lat: value.latitude, lng: value.longitude };
  }
  if (value instanceof admin.firestore.DocumentReference) {
    return value.path;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }
  if (Array.isArray(value)) {
    return value.map(encode);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = encode(value[k]);
    return out;
  }
  return value;
}

/* ── 밖으로 내보내면 안 되는 필드 ─────────────────────────────── */
/*  토큰이 응답에 섞여 나가면 이번 작업이 통째로 무의미해진다.
    이름에 token / secret / password 가 들어간 필드는 전부 자른다. */
function isSecretKey(key) {
  const k = String(key).toLowerCase();
  return k.includes('token') || k.includes('secret') || k.includes('password') || k.includes('apikey');
}

function sanitize(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (isSecretKey(k)) continue;
    out[k] = obj[k];
  }
  return out;
}

function docToJson(d) {
  return sanitize({ __id: d.id, ...encode(d.data()) });
}

/* ── 학생에 연결된 문서 찾기 ──────────────────────────────────── */
/*  컬렉션마다 학생을 가리키는 필드 이름이 다를 수 있어서
    후보를 순서대로 시도하고, 처음으로 결과가 나온 것을 쓴다.
    (실제 필드 이름이 확정되면 후보를 1개로 줄이면 된다) */
const LINK_FIELDS = ['studentId', 'sid', 'studentDocId', 'student'];

async function findByStudent(db, collectionName, keys, limit) {
  for (const field of LINK_FIELDS) {
    for (const key of keys) {
      if (!key) continue;
      const snap = await db
        .collection(collectionName)
        .where(field, '==', key)
        .limit(limit)
        .get();
      if (!snap.empty) {
        return snap.docs.map(docToJson);
      }
    }
  }
  return [];
}

/* ── 본체 ──────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  /* 토큰이 URL 에 들어가므로 어디에도 캐시되지 않게 막는다 */
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Referrer-Policy', 'no-referrer');

  try {
    const token = String((req.query && req.query.t) || '').trim();

    /* 1) 토큰 형식 검사 — 무작위 대입에 서버 자원을 쓰지 않는다 */
    if (!token) {
      return res.status(400).json({ ok: false, error: '토큰이 없습니다.' });
    }
    if (token.length < 16 || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return res.status(400).json({ ok: false, error: '토큰 형식이 올바르지 않습니다.' });
    }

    const db = getDb();

    /* 2) 토큰으로 학생 1명 찾기 — 대조는 전부 서버에서 한다 */
    const snap = await db
      .collection('students')
      .where('viewToken', '==', token)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ ok: false, error: '유효하지 않은 링크입니다.' });
    }

    const studentDoc = snap.docs[0];
    const studentRaw = encode(studentDoc.data());
    const student = sanitize({ __id: studentDoc.id, ...studentRaw });

    /* 3) 그 학생에게 연결된 문서만 골라 온다 */
    /*    학생 ID 는 문서 ID 가 아니라 필드 값(예: h01001)이므로
          필드 값과 문서 ID 둘 다 후보로 넣는다 */
    const keys = [studentRaw.id, studentDoc.id].filter(Boolean);

    const [classCards, grades] = await Promise.all([
      findByStudent(db, 'classCards', keys, 500),
      findByStudent(db, 'grades', keys, 500),
    ]);

    /* 4) 휴강 정보는 학생별이 아니라 전체 공지 성격이라 통째로 준다 */
    const offSnap = await db.collection('classOff').limit(500).get();
    const classOff = offSnap.docs.map(docToJson);

    return res.status(200).json({
      ok: true,
      student,
      classCards,
      grades,
      classOff,
    });
  } catch (e) {
    console.error('[portal] 실패:', e);
    return res.status(500).json({ ok: false, error: '데이터를 불러오지 못했습니다.' });
  }
}
