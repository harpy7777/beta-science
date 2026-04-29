'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowRight, FlaskConical } from 'lucide-react';
import { getExamByCode } from '@/lib/examService';
import toast from 'react-hot-toast';

export default function StudentTestPage() {
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
            <FlaskConical size={22} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-green-900 text-xl leading-none">베타과학학원</div>
            <div className="text-xs text-green-600">온라인 테스트</div>
          </div>
        </div>
        <div className="card p-8 border-green-200">
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
      </div>
    </div>
  );
}
