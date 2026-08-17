// src/lib/adminConfig.ts
// ─────────────────────────────────────────────────────────────────────────────
// 관리자 계정 / 로그인 경로는 여기 한 곳에서만 관리합니다.
// 계정을 바꾸려면 ADMIN_EMAIL 한 줄만 수정하면 모든 페이지에 반영됩니다.
// ─────────────────────────────────────────────────────────────────────────────

/** 관리자 계정 (이 계정만 시험 스튜디오에 접근할 수 있습니다) */
export const ADMIN_EMAIL = 'harpy7777@naver.com';

/** 로그인 화면 경로 (public/login.html) */
export const LOGIN_PATH = '/login.html';

/** 로그인 화면이 안 열릴 때를 대비한 보조 경로 (Next.js 라우트) */
export const LOGIN_FALLBACK_PATH = '/teacher';

/**
 * 로그인한 계정이 관리자인지 확인합니다.
 * 대소문자 / 앞뒤 공백 차이로 잠기는 사고를 막기 위해 정규화 후 비교합니다.
 */
export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
}
