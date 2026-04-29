'use client';
// src/app/page.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Users, BarChart3, Zap, ArrowRight, FlaskConical } from 'lucide-react';
import { getExamByCode } from '@/lib/examService';
import toast from 'react-hot-toast';

export default function HomePage() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleStudentAccess() {
    if (!accessCode.trim()) {
      toast.error('접속 코드를 입력하세요');
      return;
    }
    setLoading(true);
    try {
      const exam = await getExamByCode(accessCode.trim());
      if (!exam) {
        toast.error('유효하지 않은 코드입니다');
        return;
      }
      router.push(`/student/${exam.id}`);
    } catch {
      toast.error('오류가 발생했습니다. 다시 시도해주세요');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="border-b border-green-100 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
              <FlaskConical size={20} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-green-900 text-lg leading-none">베타과학학원</div>
              <div className="text-xs text-green-600">온라인 테스트 생성기</div>
            </div>
          </div>
          <button
            onClick={() => router.push('/teacher')}
            className="btn-primary text-sm"
          >
            선생님 로그인
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Zap size={14} />
            쉽고 빠른 온라인 시험
          </div>
          <h1 className="text-5xl font-black text-green-900 mb-4 leading-tight">
            베타과학<br />
            <span className="text-green-600">온라인 시험지</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-md mx-auto">
            OX 문제와 4지선다를 섞어서 시험지를 만들고,<br />
            학생들이 바로 응시할 수 있어요.
          </p>
        </div>

        {/* 학생 접속 카드 */}
        <div className="card p-8 max-w-md mx-auto mb-12 border-green-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-green-600" />
            </div>
            <div>
              <div className="font-bold text-gray-800">학생 응시</div>
              <div className="text-sm text-gray-500">선생님께 받은 코드를 입력하세요</div>
            </div>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              className="input-field uppercase tracking-widest font-mono text-center text-lg"
              placeholder="ABC123"
              value={accessCode}
              onChange={e => setAccessCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleStudentAccess()}
              maxLength={8}
            />
            <button
              onClick={handleStudentAccess}
              disabled={loading}
              className="btn-primary whitespace-nowrap"
            >
              {loading ? '확인 중...' : '입장'}
              {!loading && <ArrowRight size={16} className="inline ml-1" />}
            </button>
          </div>
        </div>

        {/* 기능 소개 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: BookOpen,
              title: 'OX + 4지선다',
              desc: '두 가지 유형을 자유롭게 조합해 시험지를 만드세요',
              color: 'bg-green-100 text-green-600',
            },
            {
              icon: Users,
              title: '실시간 응시',
              desc: '학생이 코드 하나로 바로 접속해 온라인으로 시험을 볼 수 있어요',
              color: 'bg-blue-100 text-blue-600',
            },
            {
              icon: BarChart3,
              title: '성적 통계',
              desc: '학생별 점수와 문제별 정답률을 대시보드에서 확인하세요',
              color: 'bg-purple-100 text-purple-600',
            },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="card p-6">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                <Icon size={22} />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-10 text-sm text-gray-400 border-t border-green-50">
        <div className="flex items-center justify-center gap-2 mb-1">
          <FlaskConical size={14} className="text-green-500" />
          <span className="font-medium text-green-700">베타과학학원</span>
        </div>
        <div>온라인 테스트 생성기 · 쉽고 빠르게 온라인 시험을 만드세요</div>
        <div className="mt-1">© 2024 베타과학학원. All rights reserved.</div>
      </footer>
    </div>
  );
}
