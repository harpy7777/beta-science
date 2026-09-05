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
     classOff / feedbacks 를 전부 잠글 수 있다.

   호출 방법
     GET /api/portal?t=<토큰>      ← 앞으로 쓸 방식 (무작위 토큰)
     GET /api/portal?id=<학생ID>   ← 기존 학부모 링크 유지용 (한시적)

   ⚠ ?id= 경로에 대하여
     학부모께 이미 ?id=m03003 형태의 링크를 보내 둔 상태라, 이 경로를
     막으면 기존 링크가 전부 죽는다. 그래서 한시적으로 함께 받는다.
     ID 는 추측이 가능하지만, 그 위험은 '지금과 같은 수준'일 뿐이고
     전교생 덤프와 토큰 유출은 이 API 로 완전히 막힌다.
     → 토큰 재발급과 새 링크 발송이 끝나면 ALLOW_ID_LOOKUP 을 false 로
       바꾸는 것만으로 이 경로를 닫을 수 있다.

   응답 (성공)
     {
       ok: true,
       student:      { __id, name, grade, ... },   // 화이트리스트 필드만
       grades:       [ { __id, ... } ],            // 정답(correctAnswer) 제거됨
       classCards:   [ { __id, ... } ],
       classOff:     [ { __id, ... } ],
       feedback:     { ... } | null,               // feedbacks/{학생문서ID}
       testSubjects: { "시험ID": "통합과학2" }      // 과목 표시용
     }

   응답 (실패)
     400  토큰이 없거나 형식이 이상함
     404  토큰에 해당하는 학생이 없음
     500  서버 오류

   ⚠ 이 파일은 서버에서만 실행된다. FIREBASE_SERVICE_ACCOUNT 는
     브라우저로 내려가지 않는다. (backup.js 와 같은 환경변수를 쓴다)
════════════════════════════════════════════════════════════════════ */

import admin from 'firebase-admin';

export const config = { maxDuration: 30 };

/* ── 기존 ?id= 링크를 계속 받아줄지 ─────────────────────────────
   학부모께 보낸 새 ?t= 링크 발송이 끝나면 false 로 바꾼다.
   그 순간부터 ?id= 로는 아무것도 조회되지 않는다. */
const ALLOW_ID_LOOKUP = true;

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
/*  브라우저에서 그대로 쓸 수 있도록 Timestamp 는 ISO 문자열로 편다.
    (두 페이지 모두 문자열 날짜를 Date.parse 로 읽을 수 있다) */
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

/* ════════════════════════════════════════════════════════════════
   학생 문서 — 화이트리스트
   ────────────────────────────────────────────────────────────────
   student-portal.html 과 student-detail.html 이 실제로 읽는 필드만
   내보낸다. 목록에 없는 필드는 무엇이든 나가지 않는다.
   → viewToken 은 물론이고, 앞으로 학생 문서에 연락처·메모 같은
     필드를 새로 추가해도 이 파일을 고치지 않는 한 새지 않는다.

   차단 목록(blocklist)이 아니라 허용 목록으로 만든 이유가 이것이다.
   차단 목록은 새 필드가 생길 때마다 잊어버리면 그대로 뚫린다.
════════════════════════════════════════════════════════════════ */
const STUDENT_FIELDS = [
  'id', 'name', 'displayName', 'grade', 'year', 'subject',
  'classes', 'classIds', 'classNames',
  'startDate', 'lastClassDate',
  'sessionCount', 'absentCount', 'makeupCount',
  'recentAttendance', 'recentLessons', 'lastHomework',
];

function pickStudent(docId, data) {
  const out = { __id: docId };
  for (const key of STUDENT_FIELDS) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}

/* ── 그 밖의 컬렉션 — 이름에 비밀이 들어간 필드는 자른다 ───────── */
function isSecretKey(key) {
  const k = String(key).toLowerCase();
  return k.includes('token') || k.includes('secret')
      || k.includes('password') || k.includes('apikey')
      || k.includes('phone');
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

/* ════════════════════════════════════════════════════════════════
   성적 문서에서 정답을 지운다
   ────────────────────────────────────────────────────────────────
   마스터테스트 기록의 answers 배열에는 문항마다 correctAnswer 가
   들어 있다. 학부모 화면은 isCorrect 만 쓰고 정답은 쓰지 않으므로
   내보낼 이유가 없다. (오답 상세는 선생님 화면에서만 표시된다)
   → 학생이 브라우저 개발자도구로 정답을 미리 보는 길을 막는다.
════════════════════════════════════════════════════════════════ */
function stripAnswerKeys(grade) {
  if (!Array.isArray(grade.answers)) return grade;
  grade.answers = grade.answers.map(a => {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return a;
    const copy = {};
    for (const k of Object.keys(a)) {
      if (k === 'correctAnswer') continue;
      copy[k] = a[k];
    }
    return copy;
  });
  return grade;
}

/* ── 학생에 연결된 문서 찾기 ──────────────────────────────────── */
/*  grades 와 classCards 는 둘 다 studentId 필드로 학생을 가리킨다.
    (Firestore 콘솔에서 확인 완료)
    학생 ID 는 문서 ID 가 아니라 필드 값(예: h01001)이므로,
    필드 값과 문서 ID 를 모두 후보로 넣고 찾는다. */
async function findByStudent(db, collectionName, keys, limitN) {
  const seen = new Set();
  const out = [];
  for (const key of keys) {
    if (!key) continue;
    const snap = await db
      .collection(collectionName)
      .where('studentId', '==', key)
      .limit(limitN)
      .get();
    snap.docs.forEach(d => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      out.push(docToJson(d));
    });
  }
  return out;
}

/* ── 성적에 붙일 과목 이름 (tests 문서에서 가져온다) ───────────── */
/*  예전 성적 기록에는 subject 가 비어 있는 것이 있어서, 화면이
    tests 컬렉션을 통째로 읽어 과목을 채우고 있었다.
    필요한 시험지만 서버에서 골라 오면 tests 를 열지 않아도 된다. */
async function fetchTestSubjects(db, grades) {
  const ids = [];
  grades.forEach(g => {
    const eid = g.examId || g.testId;
    if (eid && typeof eid === 'string' && ids.indexOf(eid) < 0) ids.push(eid);
  });
  if (!ids.length) return {};

  const picked = ids.slice(0, 100);
  const refs = picked.map(id => db.collection('tests').doc(id));

  let snaps;
  try {
    snaps = await db.getAll(...refs);
  } catch (e) {
    console.warn('[portal] tests 조회 실패:', e && e.message);
    return {};
  }

  const map = {};
  snaps.forEach(s => {
    if (!s.exists) return;
    const data = s.data() || {};
    if (data.subject) map[s.id] = String(data.subject);
  });
  return map;
}

/* ── 본체 ──────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  /* 토큰이 URL 에 들어가므로 어디에도 캐시되지 않게 막는다 */
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Referrer-Policy', 'no-referrer');

  try {
    const token = String((req.query && req.query.t) || '').trim();
    const legacyId = String((req.query && req.query.id) || '').trim().toLowerCase();

    /* 1) 어느 방식으로 들어왔는지 정한다. 토큰이 있으면 토큰이 우선이다. */
    let lookupField, lookupValue;

    if (token) {
      /* 토큰 형식 검사 — 무작위 대입에 서버 자원을 쓰지 않는다 */
      if (token.length < 16 || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
        return res.status(400).json({ ok: false, error: '토큰 형식이 올바르지 않습니다.' });
      }
      lookupField = 'viewToken';
      lookupValue = token;
    } else if (legacyId && ALLOW_ID_LOOKUP) {
      /* 학생 ID 형식: [영문 1자][숫자 5자]  예) h01001 · m03004 */
      if (!/^[a-z]\d{5}$/.test(legacyId)) {
        return res.status(400).json({ ok: false, error: '링크 형식이 올바르지 않습니다.' });
      }
      lookupField = 'id';
      lookupValue = legacyId;
    } else {
      return res.status(400).json({ ok: false, error: '토큰이 없습니다.' });
    }

    const db = getDb();

    /* 2) 학생 1명 찾기 — 대조는 전부 서버에서 한다 */
    const snap = await db
      .collection('students')
      .where(lookupField, '==', lookupValue)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ ok: false, error: '유효하지 않은 링크입니다.' });
    }

    const studentDoc = snap.docs[0];
    const studentRaw = encode(studentDoc.data()) || {};
    const student = pickStudent(studentDoc.id, studentRaw);

    /* 3) 그 학생에게 연결된 문서만 골라 온다 */
    const keys = [];
    if (studentRaw.id) keys.push(String(studentRaw.id));
    if (studentDoc.id !== studentRaw.id) keys.push(studentDoc.id);

    const [classCards, gradesRaw, offSnap, fbSnap] = await Promise.all([
      findByStudent(db, 'classCards', keys, 500),
      findByStudent(db, 'grades', keys, 500),
      db.collection('classOff').limit(500).get(),
      db.collection('feedbacks').doc(studentDoc.id).get(),
    ]);

    const grades = gradesRaw.map(stripAnswerKeys);
    const classOff = offSnap.docs.map(docToJson);
    const feedback = fbSnap.exists ? sanitize(encode(fbSnap.data()) || {}) : null;

    /* 4) 성적에 붙일 과목 이름 */
    const testSubjects = await fetchTestSubjects(db, grades);

    return res.status(200).json({
      ok: true,
      student,
      grades,
      classCards,
      classOff,
      feedback,
      testSubjects,
    });
  } catch (e) {
    console.error('[portal] 실패:', e);
    return res.status(500).json({ ok: false, error: '데이터를 불러오지 못했습니다.' });
  }
}
