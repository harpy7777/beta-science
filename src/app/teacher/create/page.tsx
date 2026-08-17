'use client';
// src/app/teacher/create/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 이 화면은 /exam-studio 로 옮겨졌습니다.
// 기존 주소로 들어오는 링크·북마크가 깨지지 않도록 새 주소로 넘겨줍니다.
// ?edit=... 로 들어온 수정 요청도 그대로 전달합니다.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fdf2f8' }}>
      <div
        className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: '#f472b6', borderTopColor: 'transparent' }}
      />
    </div>
  );
}

function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const edit = searchParams.get('edit');
    router.replace(
      edit
        ? `/exam-studio?mode=basic&edit=${encodeURIComponent(edit)}`
        : '/exam-studio?mode=basic'
    );
  }, [router, searchParams]);

  return <Spinner />;
}

export default function TeacherCreateRedirectPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RedirectInner />
    </Suspense>
  );
}
