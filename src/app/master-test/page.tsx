'use client';
// src/app/master-test/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 이 화면은 /exam-studio 로 옮겨졌습니다.
// 기존 주소로 들어오는 링크·북마크가 깨지지 않도록 새 주소로 넘겨줍니다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MasterTestRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/exam-studio?mode=master');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fdf2f8' }}>
      <div
        className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: '#f472b6', borderTopColor: 'transparent' }}
      />
    </div>
  );
}
