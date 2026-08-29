// api/analyze.js
// Vercel 서버리스 함수 — 브라우저 대신 서버에서 Anthropic API를 호출합니다.
// 프로젝트 루트에 api/ 폴더를 만들고 이 파일을 넣으면 /api/analyze 로 자동 배포됩니다.

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-20250514',
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
]);

export default async function handler(req, res) {
  // 같은 도메인에서만 호출하므로 CORS 헤더는 사실상 불필요하지만, 안전하게 처리
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정에서 추가하세요.',
    });
  }

  // ── 요청 본문 파싱 (Vercel이 자동 파싱하지만, 문자열/스트림도 대비) ──
  let body = req.body;
  try {
    if (body === undefined || body === null) {
      body = JSON.parse(await readRawBody(req) || '{}');
    } else if (typeof body === 'string') {
      body = JSON.parse(body);
    } else if (Buffer.isBuffer(body)) {
      body = JSON.parse(body.toString('utf8'));
    }
  } catch (e) {
    return res.status(400).json({ error: '요청 본문 JSON 파싱 실패: ' + e.message });
  }

  const { model, max_tokens, system, messages } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 배열이 필요합니다.' });
  }

  const safeModel = ALLOWED_MODELS.has(model) ? model : 'claude-sonnet-4-20250514';
  const safeMaxTokens = Math.min(Math.max(Number(max_tokens) || 4000, 256), 16000);

  const payload = { model: safeModel, max_tokens: safeMaxTokens, messages };
  if (typeof system === 'string' && system.trim()) payload.system = system;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: 'Anthropic API 호출 실패: ' + e.message });
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
