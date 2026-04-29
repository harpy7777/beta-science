// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: '베타과학 | 온라인 시험지 생성기',
  description: '베타과학학원 온라인 시험지 생성 및 응시 플랫폼',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
          rel="stylesheet"
        />
      </head>
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
