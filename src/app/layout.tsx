// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: '인후쌤 과학 | 온라인 시험지 생성기',
  description: '인후쌤의 과학 수업 관리 시스템 온라인 시험지 생성 및 응시 플랫폼',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
          rel="stylesheet"
        />
      <script>(function(){if(new URLSearchParams(location.search).get('student')!=='1')return;var here=location.pathname;function cross(a){var raw=a.getAttribute('href');if(!raw||raw.charAt(0)==='#')return false;if(/^(javascript:|mailto:|tel:|sms:)/i.test(raw.trim()))return false;try{return new URL(a.href,location.href).pathname!==here;}catch(e){return false;}}function lock(){document.querySelectorAll('a[href]').forEach(function(a){if(!cross(a))return;a.removeAttribute('href');a.style.pointerEvents='none';a.style.cursor='default';a.setAttribute('aria-disabled','true');});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',lock);else lock();document.addEventListener('click',function(e){var a=e.target.closest?e.target.closest('a[href]'):null;if(a&&cross(a)){e.preventDefault();e.stopPropagation();}},true);})();</script></head>
      <body>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#166534',
              color: '#fff',
              borderRadius: '12px',
              fontFamily: 'Pretendard, sans-serif',
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
