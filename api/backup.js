/* ════════════════════════════════════════════════════════════════════
   자동 백업 API  ·  /api/backup
   ────────────────────────────────────────────────────────────────────
   위치: api/backup.js   (프로젝트 루트의 api 폴더)

   무엇을 하는가
     ① Firestore 안에 있는 "모든" 컬렉션을 자동으로 찾아낸다.
        - 목록을 손으로 적지 않는다. 앞으로 새 기능을 만들어
          컬렉션이 늘어나도 이 파일은 고칠 필요가 없다.
     ② 전부 읽어서 JSON 하나로 만든다.
     ③ 비공개 GitHub 저장소(beta-science-backup)에 커밋한다.
        - backups/2026-09-02.json  (날짜별 보관)
        - backups/latest.json      (항상 최신본)

   언제 도는가
     매일 새벽, Vercel Cron 이 자동으로 호출한다.
     (Hobby 요금제는 하루 1회까지. 시각은 그 시간대 안에서 유동적)

   Vercel 환경변수 (4개, 이미 등록 완료)
     FIREBASE_SERVICE_ACCOUNT   Firebase 서비스 계정 JSON 전체
     GITHUB_TOKEN               github_pat_ 로 시작하는 토큰
     GITHUB_REPO                harpy7777/beta-science-backup
     CRON_SECRET                아무나 호출하지 못하게 막는 암호

   손으로 돌려보고 싶을 때
     브라우저 주소창에 아래를 입력한다.
     https://beta-science.vercel.app/api/backup?key=<CRON_SECRET값>

   ⚠ 이 파일은 서버에서만 실행된다. 브라우저로 내려가지 않으므로
     환경변수(키·토큰)가 노출될 일이 없다.
════════════════════════════════════════════════════════════════════ */

import admin from 'firebase-admin';

export const config = { maxDuration: 60 };

/* ── Firebase Admin 초기화 (한 번만) ───────────────────────────── */
function getDb() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT 환경변수가 없습니다.');

    let cred;
    try {
      cred = JSON.parse(raw);
    } catch {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT 값이 올바른 JSON 이 아닙니다. ' +
        '붙여넣을 때 { 부터 } 까지 전체가 들어갔는지 확인하세요.'
      );
    }

    // Vercel 환경변수에 넣으면 개행이 \n 문자로 바뀌는 경우가 있어 되돌린다
    if (typeof cred.private_key === 'string') {
      cred.private_key = cred.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  return admin.firestore();
}

/* ── Firestore 값을 JSON 으로 안전하게 바꾸기 ──────────────────── */
/*  Timestamp, GeoPoint, DocumentReference 같은 특수 타입은 그냥
    JSON.stringify 하면 뭉개진다. 나중에 복원할 수 있도록 표시를 남긴다. */
function encode(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof admin.firestore.Timestamp) {
    return { __type: 'timestamp', value: value.toDate().toISOString() };
  }
  if (value instanceof admin.firestore.GeoPoint) {
    return { __type: 'geopoint', lat: value.latitude, lng: value.longitude };
  }
  if (value instanceof admin.firestore.DocumentReference) {
    return { __type: 'ref', path: value.path };
  }
  if (Buffer.isBuffer(value)) {
    return { __type: 'bytes', value: value.toString('base64') };
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

/* ── 컬렉션 하나를 통째로 읽기 ─────────────────────────────────── */
async function dumpCollection(db, name) {
  const snap = await db.collection(name).get();
  const docs = [];
  snap.forEach(d => {
    docs.push({ __id: d.id, ...encode(d.data()) });
  });
  return docs;
}

/* ── GitHub 에 파일 하나 커밋 ──────────────────────────────────── */
async function commitFile(repo, token, path, contentString, message) {
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'beta-science-backup',
  };

  // 이미 같은 경로에 파일이 있으면 sha 가 있어야 덮어쓸 수 있다
  let sha;
  const probe = await fetch(api, { headers });
  if (probe.status === 200) {
    const info = await probe.json();
    sha = info.sha;
  } else if (probe.status !== 404) {
    const t = await probe.text();
    throw new Error(`GitHub 조회 실패 (${probe.status}): ${t.slice(0, 300)}`);
  }

  const body = {
    message,
    content: Buffer.from(contentString, 'utf8').toString('base64'),
    branch: 'main',
  };
  if (sha) body.sha = sha;

  const res = await fetch(api, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    let hint = '';
    if (res.status === 401) hint = ' → GITHUB_TOKEN 값이 잘못되었거나 만료되었습니다.';
    if (res.status === 403) hint = ' → 토큰에 Contents: Read and write 권한이 있는지 확인하세요.';
    if (res.status === 404) hint = ' → GITHUB_REPO 이름이 맞는지, 토큰이 그 저장소를 선택했는지 확인하세요.';
    throw new Error(`GitHub 저장 실패 (${res.status})${hint}: ${t.slice(0, 300)}`);
  }
}

/* ── 본체 ──────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  const started = Date.now();

  /* 1) 호출자 확인 — Vercel Cron 이거나, 암호를 아는 사람만 */
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(500).json({ ok: false, error: 'CRON_SECRET 환경변수가 설정되지 않았습니다.' });
  }

  const isVercelCron = String(req.headers['user-agent'] || '').includes('vercel-cron');
  const bearer = String(req.headers.authorization || '');
  const byHeader = bearer === `Bearer ${secret}`;
  const byQuery = String((req.query && req.query.key) || '') === secret;

  if (!isVercelCron && !byHeader && !byQuery) {
    return res.status(401).json({ ok: false, error: '권한이 없습니다.' });
  }

  try {
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    if (!repo) throw new Error('GITHUB_REPO 환경변수가 없습니다.');
    if (!token) throw new Error('GITHUB_TOKEN 환경변수가 없습니다.');

    const db = getDb();

    /* 2) 컬렉션 목록을 "자동으로" 가져온다 (손으로 적지 않는다) */
    const collections = await db.listCollections();
    const names = collections.map(c => c.id).sort();

    if (names.length === 0) {
      throw new Error('컬렉션을 하나도 찾지 못했습니다. 서비스 계정 권한을 확인하세요.');
    }

    /* 3) 전부 읽는다 */
    const data = {};
    const counts = {};
    for (const name of names) {
      const docs = await dumpCollection(db, name);
      data[name] = docs;
      counts[name] = docs.length;
    }

    const totalDocs = Object.values(counts).reduce((a, b) => a + b, 0);

    /* 4) 한국 시간 기준 날짜로 파일 이름을 만든다 */
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const stamp = kst.toISOString().slice(0, 10);          // 2026-09-02
    const stampFull = kst.toISOString().replace('T', ' ').slice(0, 19);

    const payload = {
      academy: '인후쌤 과학수업',
      backedUpAt: stampFull + ' (KST)',
      collections: names,
      counts,
      totalDocs,
      data,
    };

    const json = JSON.stringify(payload, null, 2);
    const sizeMb = (Buffer.byteLength(json, 'utf8') / 1024 / 1024).toFixed(2);

    // GitHub Contents API 는 파일 1개당 약 100MB 가 상한이지만,
    // 실제로는 훨씬 작아야 안전하다. 50MB 를 넘으면 알린다.
    if (Number(sizeMb) > 50) {
      throw new Error(`백업 크기가 너무 큽니다 (${sizeMb}MB). 방식을 나눠야 합니다.`);
    }

    /* 5) GitHub 에 두 벌 저장한다 */
    const msg = `백업 ${stampFull} KST · ${names.length}개 컬렉션 · ${totalDocs}건`;
    await commitFile(repo, token, `backups/${stamp}.json`, json, msg);
    await commitFile(repo, token, 'backups/latest.json', json, `${msg} (최신본)`);

    const secs = ((Date.now() - started) / 1000).toFixed(1);

    return res.status(200).json({
      ok: true,
      message: `백업 완료 · ${names.length}개 컬렉션 · 총 ${totalDocs}건 · ${sizeMb}MB · ${secs}초`,
      savedAs: [`backups/${stamp}.json`, 'backups/latest.json'],
      counts,
    });
  } catch (e) {
    console.error('[backup] 실패:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
