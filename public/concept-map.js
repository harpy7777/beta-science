/*!
 * concept-map.js — 통합과학2 개념 지도 (2022 개정 교육과정)
 * 인후쌤의 과학 수업 관리 시스템 / beta-science
 *
 * [설계 원칙]
 *  1) 개념 노드는 "교과서 단원명"이 아니라 "성취기준 코드"에 붙인다.
 *     → 출판사(미래엔/비상/동아)마다 서술이 달라도 지도가 어긋나지 않는다.
 *     → 2028 수능 출제 범위가 통합과학1·2이므로 성취기준 = 출제 단위.
 *  2) 단원 페이지 링크는 {publisher}-science2-unit{unit}.html 규칙으로 자동 생성.
 *     영역1 → unit1 / 영역2 → unit2 / 영역3 → unit3
 *  3) prereq(선수관계)를 타고 올라가 "진짜 막힌 지점(root cause)"을 찾는다.
 *
 * [사용법]
 *   <script src="/concept-map.js"></script>
 *   const CM = window.ConceptMap;
 *   CM.pageUrl('S2-120', 'visang');        // 'visang-science2-unit1.html'
 *   CM.matchConcepts('중화 반응에서 온도가...'); // 문항 자동 태깅
 *   CM.analyze(records);                    // 취약 개념 + 근본 원인 진단
 *
 * 전역 노출: window.ConceptMap
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------
   * 1. 기본 메타
   * ---------------------------------------------------------------- */

  var SUBJECT = '통합과학2';
  var CURRICULUM = '2022 개정 교육과정';

  var PUBLISHERS = {
    miraen: '미래엔',
    visang: '비상교육',
    donga: '동아출판'
  };

  var DEFAULT_PUBLISHER = 'miraen';

  // 영역 = 성취기준 대영역. unit = 실제 HTML 파일 번호.
  var AREAS = [
    { id: 1, unit: 1, name: '변화와 다양성', color: '#db2777' },
    { id: 2, unit: 2, name: '환경과 에너지', color: '#2563eb' },
    { id: 3, unit: 3, name: '과학과 미래 사회', color: '#059669' }
  ];

  // 물·화·생·지 구분 (지도 색상 및 과목별 취약도 집계용)
  var DOMAINS = {
    phys: { name: '물리', color: '#6366f1' },
    chem: { name: '화학', color: '#db2777' },
    bio: { name: '생명', color: '#059669' },
    earth: { name: '지구', color: '#d97706' },
    conv: { name: '융합', color: '#64748b' }
  };

  /* ------------------------------------------------------------------
   * 2. 개념 노드 (57개)
   *    id       : 고유 코드 (문항 태깅 시 사용)
   *    name     : 화면 표시명
   *    area     : 영역 번호 (1~3)
   *    std      : 2022 개정 성취기준 코드
   *    domain   : phys | chem | bio | earth | conv
   *    prereq   : 선수 개념 id 배열 (이게 무너지면 뒤가 전부 흔들림)
   *    related  : 참고 연결 (선수관계는 아니지만 함께 보면 좋은 개념)
   *    cross    : 통합과학1 연계 성취기준 코드
   *    kw       : 문항 자동 태깅용 키워드
   * ---------------------------------------------------------------- */

  var NODES = [
    /* ===== 영역 1. 변화와 다양성 (unit1) ===== */

    /* 10통과2-01-01 지질시대와 환경 변화 */
    {
      id: 'S2-101', name: '지질시대 구분', area: 1, std: '10통과2-01-01', domain: 'earth',
      prereq: [], related: [], cross: [],
      kw: ['지질시대', '선캄브리아', '고생대', '중생대', '신생대', '절대 연령', '상대 연령', '지층 누중']
    },
    {
      id: 'S2-102', name: '화석과 표준화석', area: 1, std: '10통과2-01-01', domain: 'earth',
      prereq: [], related: [], cross: [],
      kw: ['화석', '표준화석', '시상화석', '삼엽충', '암모나이트', '화폐석', '매머드']
    },
    {
      id: 'S2-103', name: '지질시대의 환경 변화', area: 1, std: '10통과2-01-01', domain: 'earth',
      prereq: ['S2-101', 'S2-102'], related: [], cross: [],
      kw: ['고기후', '빙하기', '간빙기', '대륙 분포', '산소 농도', '초대륙', '판게아']
    },
    {
      id: 'S2-104', name: '대멸종', area: 1, std: '10통과2-01-01', domain: 'earth',
      prereq: ['S2-103'], related: [], cross: [],
      kw: ['대멸종', '멸종', '페름기', '백악기', '운석 충돌', '공룡', '화산 활동']
    },

    /* 10통과2-01-02 변이·자연선택·진화·생물다양성 */
    {
      id: 'S2-105', name: '변이', area: 1, std: '10통과2-01-02', domain: 'bio',
      prereq: [], related: [], cross: ['10통과1-03-06'],
      kw: ['변이', '돌연변이', '유전적 변이', '개체 차이', '형질']
    },
    {
      id: 'S2-106', name: '자연선택', area: 1, std: '10통과2-01-02', domain: 'bio',
      prereq: ['S2-105'], related: [], cross: [],
      kw: ['자연선택', '다윈', '적자생존', '핀치', '항생제 내성', '살충제 저항성', '기린']
    },
    {
      id: 'S2-107', name: '진화와 종분화', area: 1, std: '10통과2-01-02', domain: 'bio',
      prereq: ['S2-106'], related: [], cross: [],
      kw: ['진화', '종분화', '지리적 격리', '생식적 격리', '진화설']
    },
    {
      id: 'S2-108', name: '생물다양성의 세 요소', area: 1, std: '10통과2-01-02', domain: 'bio',
      prereq: ['S2-107', 'S2-104'], related: [], cross: [],
      kw: ['생물다양성', '유전적 다양성', '종 다양성', '생태계 다양성']
    },
    {
      id: 'S2-109', name: '생물다양성 보전', area: 1, std: '10통과2-01-02', domain: 'bio',
      prereq: ['S2-108'], related: ['S2-206'], cross: [],
      kw: ['보전', '서식지 파괴', '멸종위기종', '종자은행', '생태통로', '외래종']
    },

    /* 10통과2-01-03 산화·환원 */
    {
      id: 'S2-110', name: '산화·환원 (산소의 이동)', area: 1, std: '10통과2-01-03', domain: 'chem',
      prereq: [], related: [], cross: ['10통과1-02-04'],
      kw: ['산화', '환원', '산소', '연소', '산소를 얻는']
    },
    {
      id: 'S2-111', name: '산화·환원 (전자의 이동)', area: 1, std: '10통과2-01-03', domain: 'chem',
      prereq: ['S2-110'], related: [], cross: ['10통과1-02-03', '10통과1-02-04'],
      kw: ['전자의 이동', '전자를 잃', '전자를 얻', '산화제', '환원제', '동시에 일어']
    },
    {
      id: 'S2-112', name: '광합성과 세포호흡', area: 1, std: '10통과2-01-03', domain: 'chem',
      prereq: ['S2-111'], related: ['S2-215'], cross: [],
      kw: ['광합성', '세포호흡', '포도당', '엽록체', '이산화탄소', '산소 발생']
    },
    {
      id: 'S2-113', name: '화석 연료의 연소', area: 1, std: '10통과2-01-03', domain: 'chem',
      prereq: ['S2-111'], related: ['S2-208'], cross: [],
      kw: ['화석 연료', '연소', '메테인', '탄화수소', '이산화탄소 배출']
    },
    {
      id: 'S2-114', name: '철의 제련과 부식', area: 1, std: '10통과2-01-03', domain: 'chem',
      prereq: ['S2-111'], related: [], cross: [],
      kw: ['제련', '용광로', '철', '산화 철', '코크스', '녹', '부식', '도금']
    },
    {
      id: 'S2-115', name: '생활 속 산화·환원', area: 1, std: '10통과2-01-03', domain: 'chem',
      prereq: ['S2-111'], related: [], cross: [],
      kw: ['갈변', '과산화수소', '표백', '살균', '산화 방지제', '변색']
    },

    /* 10통과2-01-04 산·염기와 중화 반응 */
    {
      id: 'S2-116', name: '산의 성질', area: 1, std: '10통과2-01-04', domain: 'chem',
      prereq: [], related: [], cross: [],
      kw: ['산', '신맛', '수소 이온', '금속과 반응', '수소 기체', '염산', '황산', '아세트산']
    },
    {
      id: 'S2-117', name: '염기의 성질', area: 1, std: '10통과2-01-04', domain: 'chem',
      prereq: [], related: [], cross: [],
      kw: ['염기', '쓴맛', '미끈', '수산화 이온', '단백질', '수산화 나트륨', '암모니아']
    },
    {
      id: 'S2-118', name: '아레니우스 산·염기 정의', area: 1, std: '10통과2-01-04', domain: 'chem',
      prereq: ['S2-116', 'S2-117'], related: [], cross: ['10통과1-02-04'],
      kw: ['아레니우스', '이온화', '수용액', '수소 이온', '수산화 이온', '정의']
    },
    {
      id: 'S2-119', name: '지시약과 액성', area: 1, std: '10통과2-01-04', domain: 'chem',
      prereq: ['S2-118'], related: [], cross: [],
      kw: ['지시약', '리트머스', '페놀프탈레인', 'BTB', '메틸 오렌지', 'pH', '액성']
    },
    {
      id: 'S2-120', name: '중화 반응', area: 1, std: '10통과2-01-04', domain: 'chem',
      prereq: ['S2-118'], related: [], cross: [],
      kw: ['중화', '중화 반응', '물이 생성', '염', '알짜 이온', '구경꾼 이온', '1:1']
    },
    {
      id: 'S2-121', name: '중화점과 온도 변화', area: 1, std: '10통과2-01-04', domain: 'chem',
      prereq: ['S2-120'], related: ['S2-123'], cross: [],
      kw: ['중화점', '중화열', '최고 온도', '이온 수 변화', '그래프', '부피 관계']
    },
    {
      id: 'S2-122', name: '생활 속 중화 반응', area: 1, std: '10통과2-01-04', domain: 'chem',
      prereq: ['S2-120'], related: [], cross: [],
      kw: ['제산제', '위산', '석회', '토양 산성화', '치약', '벌레 물린', '생석회']
    },

    /* 10통과2-01-05 물질 변화에서의 에너지 출입 */
    {
      id: 'S2-123', name: '발열 반응', area: 1, std: '10통과2-01-05', domain: 'chem',
      prereq: [], related: [], cross: [],
      kw: ['발열', '열을 방출', '주변 온도가 높아', '연소', '손난로', '산화 칼슘']
    },
    {
      id: 'S2-124', name: '흡열 반응', area: 1, std: '10통과2-01-05', domain: 'chem',
      prereq: [], related: [], cross: [],
      kw: ['흡열', '열을 흡수', '주변 온도가 낮아', '냉각팩', '질산 암모늄', '탄산수소 나트륨']
    },
    {
      id: 'S2-125', name: '에너지 출입의 활용', area: 1, std: '10통과2-01-05', domain: 'chem',
      prereq: ['S2-123', 'S2-124'], related: [], cross: [],
      kw: ['발열 도시락', '냉찜질', '온찜질', '제설제', '휴대용 발열']
    },

    /* ===== 영역 2. 환경과 에너지 (unit2) ===== */

    /* 10통과2-02-01 생태계 구성 요소 */
    {
      id: 'S2-201', name: '생태계 구성 요소', area: 2, std: '10통과2-02-01', domain: 'bio',
      prereq: [], related: [], cross: ['10통과1-03-01'],
      kw: ['생태계', '생물적 요인', '비생물적 요인', '생산자', '소비자', '분해자']
    },
    {
      id: 'S2-202', name: '생물과 환경의 상호 관계', area: 2, std: '10통과2-02-01', domain: 'bio',
      prereq: ['S2-201'], related: [], cross: [],
      kw: ['작용', '반작용', '상호작용', '빛의 세기', '온도', '물', '토양', '음지 식물']
    },
    {
      id: 'S2-203', name: '개체군과 군집', area: 2, std: '10통과2-02-01', domain: 'bio',
      prereq: ['S2-201'], related: [], cross: [],
      kw: ['개체군', '군집', '개체군 밀도', '생장 곡선', '환경 저항', 'S자']
    },

    /* 10통과2-02-02 생태계 평형 */
    {
      id: 'S2-204', name: '먹이 사슬과 먹이 그물', area: 2, std: '10통과2-02-02', domain: 'bio',
      prereq: ['S2-203'], related: [], cross: [],
      kw: ['먹이 사슬', '먹이 그물', '영양 단계', '포식', '피식']
    },
    {
      id: 'S2-205', name: '생태 피라미드', area: 2, std: '10통과2-02-02', domain: 'bio',
      prereq: ['S2-204'], related: [], cross: [],
      kw: ['생태 피라미드', '에너지양', '개체 수', '생물량', '상위 영양 단계']
    },
    {
      id: 'S2-206', name: '생태계 평형과 교란', area: 2, std: '10통과2-02-02', domain: 'bio',
      prereq: ['S2-205'], related: ['S2-109'], cross: [],
      kw: ['생태계 평형', '교란', '복원력', '외래종', '남획', '서식지 단편화']
    },

    /* 10통과2-02-03 기후 변화 */
    {
      id: 'S2-207', name: '지구의 복사 평형', area: 2, std: '10통과2-02-03', domain: 'earth',
      prereq: [], related: [], cross: ['10통과1-03-01'],
      kw: ['복사 평형', '태양 복사', '지구 복사', '반사율', '흡수', '방출', '열수지']
    },
    {
      id: 'S2-208', name: '온실 효과와 온실 기체', area: 2, std: '10통과2-02-03', domain: 'earth',
      prereq: ['S2-207'], related: ['S2-113'], cross: [],
      kw: ['온실 효과', '온실 기체', '이산화탄소', '메테인', '수증기', '재복사']
    },
    {
      id: 'S2-209', name: '지구 온난화', area: 2, std: '10통과2-02-03', domain: 'earth',
      prereq: ['S2-208'], related: [], cross: [],
      kw: ['지구 온난화', '평균 기온', '해수면 상승', '빙하 감소', '기후 변화']
    },
    {
      id: 'S2-210', name: '대기와 해양의 상호작용', area: 2, std: '10통과2-02-03', domain: 'earth',
      prereq: ['S2-207'], related: [], cross: [],
      kw: ['대기 대순환', '해류', '무역풍', '편서풍', '용승', '표층 순환']
    },
    {
      id: 'S2-211', name: '엘니뇨와 라니냐', area: 2, std: '10통과2-02-03', domain: 'earth',
      prereq: ['S2-210'], related: [], cross: [],
      kw: ['엘니뇨', '라니냐', '무역풍 약화', '용승 약화', '동태평양', '수온 상승']
    },
    {
      id: 'S2-212', name: '사막화와 기후 변화 대응', area: 2, std: '10통과2-02-03', domain: 'earth',
      prereq: ['S2-209'], related: [], cross: [],
      kw: ['사막화', '황사', '파리 협정', '탄소 중립', '온실가스 감축']
    },

    /* 10통과2-02-04 핵융합과 태양 에너지 */
    {
      id: 'S2-213', name: '태양의 수소 핵융합', area: 2, std: '10통과2-02-04', domain: 'phys',
      prereq: [], related: [], cross: ['10통과1-02-02'],
      kw: ['핵융합', '수소 핵융합', '헬륨', '태양 중심부', '고온 고압']
    },
    {
      id: 'S2-214', name: '질량 결손과 에너지', area: 2, std: '10통과2-02-04', domain: 'phys',
      prereq: ['S2-213'], related: [], cross: [],
      kw: ['질량 결손', '질량 감소', '에너지로 전환', '질량-에너지']
    },
    {
      id: 'S2-215', name: '태양 에너지의 전환과 순환', area: 2, std: '10통과2-02-04', domain: 'phys',
      prereq: ['S2-214'], related: ['S2-112'], cross: [],
      kw: ['태양 에너지', '에너지 흐름', '물의 순환', '대기 순환', '화학 에너지']
    },

    /* 10통과2-02-05 발전 */
    {
      id: 'S2-216', name: '전자기 유도', area: 2, std: '10통과2-02-05', domain: 'phys',
      prereq: [], related: [], cross: [],
      kw: ['전자기 유도', '코일', '자석', '유도 전류', '자기장 변화', '검류계']
    },
    {
      id: 'S2-217', name: '발전기의 원리', area: 2, std: '10통과2-02-05', domain: 'phys',
      prereq: ['S2-216'], related: [], cross: [],
      kw: ['발전기', '터빈', '운동 에너지', '전기 에너지', '간이 발전기']
    },
    {
      id: 'S2-218', name: '화력 발전', area: 2, std: '10통과2-02-05', domain: 'phys',
      prereq: ['S2-217'], related: ['S2-113'], cross: [],
      kw: ['화력 발전', '보일러', '증기', '화석 연료 연소', '대기 오염']
    },
    {
      id: 'S2-219', name: '핵발전', area: 2, std: '10통과2-02-05', domain: 'phys',
      prereq: ['S2-217'], related: ['S2-214'], cross: [],
      kw: ['핵발전', '원자력', '핵분열', '우라늄', '원자로', '방사성 폐기물']
    },

    /* 10통과2-02-06 에너지 효율과 신재생 에너지 */
    {
      id: 'S2-220', name: '에너지 전환과 보존', area: 2, std: '10통과2-02-06', domain: 'phys',
      prereq: ['S2-215'], related: [], cross: [],
      kw: ['에너지 전환', '에너지 보존', '총량', '열에너지로 전환']
    },
    {
      id: 'S2-221', name: '에너지 효율', area: 2, std: '10통과2-02-06', domain: 'phys',
      prereq: ['S2-220'], related: [], cross: [],
      kw: ['에너지 효율', '버려지는 열', '소비 효율 등급', 'LED', '열효율']
    },
    {
      id: 'S2-222', name: '신재생 에너지', area: 2, std: '10통과2-02-06', domain: 'phys',
      prereq: ['S2-221'], related: ['S2-218'], cross: [],
      kw: ['신재생', '태양광', '풍력', '조력', '지열', '연료 전지', '바이오']
    },
    {
      id: 'S2-223', name: '지속가능한 발전', area: 2, std: '10통과2-02-06', domain: 'conv',
      prereq: ['S2-222', 'S2-212'], related: [], cross: [],
      kw: ['지속가능', '적정 기술', '에너지 하베스팅', '탄소 발자국']
    },

    /* ===== 영역 3. 과학과 미래 사회 (unit3) ===== */

    /* 10통과2-03-01 감염병 */
    {
      id: 'S2-301', name: '감염병과 병원체', area: 3, std: '10통과2-03-01', domain: 'bio',
      prereq: [], related: [], cross: [],
      kw: ['감염병', '병원체', '세균', '바이러스', '곰팡이', '원생생물', '변형 단백질']
    },
    {
      id: 'S2-302', name: '감염병 진단 기술', area: 3, std: '10통과2-03-01', domain: 'bio',
      prereq: ['S2-301'], related: [], cross: [],
      kw: ['진단', 'PCR', '유전자 증폭', '항원', '항체', '신속 항원', '핵산']
    },
    {
      id: 'S2-303', name: '감염병 확산과 대응', area: 3, std: '10통과2-03-01', domain: 'bio',
      prereq: ['S2-301'], related: [], cross: [],
      kw: ['확산', '역학 조사', '백신', '방역', '전파 경로', '집단 면역']
    },

    /* 10통과2-03-02 빅데이터 */
    {
      id: 'S2-304', name: '빅데이터의 활용', area: 3, std: '10통과2-03-02', domain: 'conv',
      prereq: [], related: [], cross: [],
      kw: ['빅데이터', '데이터 축적', '기상 관측', '유전체 분석', '신약 개발']
    },
    {
      id: 'S2-305', name: '빅데이터의 한계와 문제점', area: 3, std: '10통과2-03-02', domain: 'conv',
      prereq: ['S2-304'], related: [], cross: [],
      kw: ['개인 정보', '데이터 편향', '보안', '오남용', '프라이버시']
    },

    /* 10통과2-03-03 인공지능과 로봇 */
    {
      id: 'S2-306', name: '인공지능과 과학 탐구', area: 3, std: '10통과2-03-03', domain: 'conv',
      prereq: ['S2-304'], related: [], cross: [],
      kw: ['인공지능', '기계 학습', '딥러닝', '과학 탐구', '예측 모델']
    },
    {
      id: 'S2-307', name: '로봇과 사물인터넷', area: 3, std: '10통과2-03-03', domain: 'conv',
      prereq: ['S2-306'], related: [], cross: [],
      kw: ['로봇', '사물인터넷', 'IoT', '자율주행', '센서', '스마트']
    },

    /* 10통과2-03-04 과학기술과 윤리 */
    {
      id: 'S2-308', name: '과학기술의 양면성', area: 3, std: '10통과2-03-04', domain: 'conv',
      prereq: [], related: [], cross: [],
      kw: ['양면성', '유용성', '한계', '부작용', '기술 발전']
    },
    {
      id: 'S2-309', name: '과학 윤리와 SSI', area: 3, std: '10통과2-03-04', domain: 'conv',
      prereq: ['S2-308'], related: [], cross: [],
      kw: ['과학 윤리', 'SSI', '사회적 쟁점', '생명 윤리', '연구 윤리', '의사 결정']
    }
  ];

  /* ------------------------------------------------------------------
   * 3. 인덱스 구축
   * ---------------------------------------------------------------- */

  var NODE_BY_ID = {};
  var CHILDREN = {};   // id -> 이 개념을 선수로 삼는 하위 개념들
  var AREA_BY_ID = {};
  var i, j, n;

  for (i = 0; i < AREAS.length; i++) {
    AREA_BY_ID[AREAS[i].id] = AREAS[i];
  }

  for (i = 0; i < NODES.length; i++) {
    n = NODES[i];
    NODE_BY_ID[n.id] = n;
    CHILDREN[n.id] = [];
  }

  for (i = 0; i < NODES.length; i++) {
    n = NODES[i];
    for (j = 0; j < n.prereq.length; j++) {
      if (CHILDREN[n.prereq[j]]) {
        CHILDREN[n.prereq[j]].push(n.id);
      }
    }
  }

  /* ------------------------------------------------------------------
   * 4. 조회 헬퍼
   * ---------------------------------------------------------------- */

  function getNode(id) {
    return NODE_BY_ID[id] || null;
  }

  function allNodes() {
    return NODES.slice();
  }

  function byArea(areaId) {
    return NODES.filter(function (x) { return x.area === Number(areaId); });
  }

  function byStandard(code) {
    return NODES.filter(function (x) { return x.std === code; });
  }

  function byDomain(key) {
    return NODES.filter(function (x) { return x.domain === key; });
  }

  function listStandards() {
    var seen = {};
    var out = [];
    for (var k = 0; k < NODES.length; k++) {
      if (!seen[NODES[k].std]) {
        seen[NODES[k].std] = true;
        out.push(NODES[k].std);
      }
    }
    return out.sort();
  }

  /** 노드 id → 해당 단원 페이지 URL */
  function pageUrl(id, publisher) {
    var node = getNode(id);
    if (!node) return null;
    var pub = PUBLISHERS[publisher] ? publisher : DEFAULT_PUBLISHER;
    var area = AREA_BY_ID[node.area];
    if (!area) return null;
    return pub + '-science2-unit' + area.unit + '.html';
  }

  /** 선수 개념 전체(조상) — 가까운 순서 */
  function ancestors(id) {
    var out = [];
    var seen = {};
    var queue = [id];
    var cur, node, k;
    seen[id] = true;
    while (queue.length) {
      cur = queue.shift();
      node = getNode(cur);
      if (!node) continue;
      for (k = 0; k < node.prereq.length; k++) {
        if (!seen[node.prereq[k]]) {
          seen[node.prereq[k]] = true;
          out.push(node.prereq[k]);
          queue.push(node.prereq[k]);
        }
      }
    }
    return out;
  }

  /** 이 개념이 무너지면 함께 흔들리는 후속 개념 전체 */
  function descendants(id) {
    var out = [];
    var seen = {};
    var queue = [id];
    var cur, kids, k;
    seen[id] = true;
    while (queue.length) {
      cur = queue.shift();
      kids = CHILDREN[cur] || [];
      for (k = 0; k < kids.length; k++) {
        if (!seen[kids[k]]) {
          seen[kids[k]] = true;
          out.push(kids[k]);
          queue.push(kids[k]);
        }
      }
    }
    return out;
  }

  /** 위상 정렬 깊이 — 지도 세로 배치용 (0 = 뿌리 개념) */
  function levels() {
    var depth = {};
    var k;

    function calc(id, guard) {
      if (depth[id] !== undefined) return depth[id];
      if (guard[id]) return 0;               // 순환 방어
      guard[id] = true;
      var node = getNode(id);
      var best = 0;
      if (node) {
        for (var m = 0; m < node.prereq.length; m++) {
          var d = calc(node.prereq[m], guard) + 1;
          if (d > best) best = d;
        }
      }
      guard[id] = false;
      depth[id] = best;
      return best;
    }

    for (k = 0; k < NODES.length; k++) {
      calc(NODES[k].id, {});
    }
    return depth;
  }

  /* ------------------------------------------------------------------
   * 5. 문항 자동 태깅 (B안: 기존 데이터를 살리는 방식)
   *    문항 지문/시험명에서 키워드를 찾아 개념 후보를 점수순으로 반환
   * ---------------------------------------------------------------- */

  function matchConcepts(text, options) {
    if (!text || typeof text !== 'string') return [];
    var opts = options || {};
    var limit = opts.limit || 3;
    var minScore = opts.minScore || 1;
    var haystack = text.replace(/\s+/g, ' ');
    var scored = [];
    var k, m, kwList, hit, kw;

    for (k = 0; k < NODES.length; k++) {
      hit = 0;
      kwList = NODES[k].kw;
      for (m = 0; m < kwList.length; m++) {
        kw = kwList[m];
        if (haystack.indexOf(kw) !== -1) {
          // 긴 키워드일수록 변별력이 높으므로 가중치를 준다
          hit += (kw.length >= 4 ? 2 : 1);
        }
      }
      // 개념명이 통째로 들어 있으면 강한 신호
      if (haystack.indexOf(NODES[k].name) !== -1) hit += 3;
      if (hit >= minScore) {
        scored.push({ id: NODES[k].id, name: NODES[k].name, score: hit });
      }
    }

    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.id < b.id ? -1 : 1;
    });
    return scored.slice(0, limit);
  }

  /* ------------------------------------------------------------------
   * 6. 취약 개념 진단
   *    records: [{ conceptId?, std?, correct: true|false }, ...]
   *      - conceptId 가 있으면 그 노드에 집계 (정밀, A안)
   *      - 없고 std 만 있으면 해당 성취기준의 모든 노드에 분산 집계 (B안)
   * ---------------------------------------------------------------- */

  var DEFAULT_THRESHOLD = {
    minAttempts: 3,   // 이 횟수 미만이면 '판단 보류'
    weak: 0.6,        // 정답률 60% 미만 → 취약
    warn: 0.8         // 60~80% → 주의
  };

  function analyze(records, options) {
    var opts = options || {};
    var th = {
      minAttempts: opts.minAttempts || DEFAULT_THRESHOLD.minAttempts,
      weak: opts.weak || DEFAULT_THRESHOLD.weak,
      warn: opts.warn || DEFAULT_THRESHOLD.warn
    };

    var stats = {};
    var k, m, rec, targets, node, id;

    for (k = 0; k < NODES.length; k++) {
      stats[NODES[k].id] = { id: NODES[k].id, total: 0, correct: 0, rate: null, status: 'unknown' };
    }

    var list = Array.isArray(records) ? records : [];
    for (k = 0; k < list.length; k++) {
      rec = list[k];
      if (!rec) continue;

      targets = [];
      if (rec.conceptId && NODE_BY_ID[rec.conceptId]) {
        targets = [rec.conceptId];
      } else if (rec.std) {
        targets = byStandard(rec.std).map(function (x) { return x.id; });
      }

      for (m = 0; m < targets.length; m++) {
        stats[targets[m]].total += 1;
        if (rec.correct) stats[targets[m]].correct += 1;
      }
    }

    for (k = 0; k < NODES.length; k++) {
      id = NODES[k].id;
      if (stats[id].total >= th.minAttempts) {
        stats[id].rate = stats[id].correct / stats[id].total;
        if (stats[id].rate < th.weak) stats[id].status = 'weak';
        else if (stats[id].rate < th.warn) stats[id].status = 'warn';
        else stats[id].status = 'ok';
      } else if (stats[id].total > 0) {
        stats[id].rate = stats[id].correct / stats[id].total;
        stats[id].status = 'few';
      }
    }

    // 취약 목록 (정답률 낮은 순)
    var weak = [];
    for (k = 0; k < NODES.length; k++) {
      if (stats[NODES[k].id].status === 'weak') weak.push(NODES[k].id);
    }
    weak.sort(function (a, b) { return stats[a].rate - stats[b].rate; });

    // 근본 원인: 취약하면서, 선수 개념 중에는 취약한 것이 없는 노드
    var isWeak = {};
    for (k = 0; k < weak.length; k++) isWeak[weak[k]] = true;

    var roots = [];
    for (k = 0; k < weak.length; k++) {
      node = getNode(weak[k]);
      var upstreamWeak = false;
      for (m = 0; m < node.prereq.length; m++) {
        if (isWeak[node.prereq[m]]) { upstreamWeak = true; break; }
      }
      if (!upstreamWeak) {
        roots.push({
          id: node.id,
          name: node.name,
          rate: stats[node.id].rate,
          // 이 개념 때문에 함께 무너진 후속 개념들
          blocking: descendants(node.id).filter(function (x) { return isWeak[x]; })
        });
      }
    }
    roots.sort(function (a, b) { return b.blocking.length - a.blocking.length; });

    // 영역별 / 과목별 요약
    var areaSummary = {};
    for (k = 0; k < AREAS.length; k++) {
      areaSummary[AREAS[k].id] = { id: AREAS[k].id, name: AREAS[k].name, total: 0, correct: 0, rate: null };
    }
    var domainSummary = {};
    for (var key in DOMAINS) {
      if (Object.prototype.hasOwnProperty.call(DOMAINS, key)) {
        domainSummary[key] = { id: key, name: DOMAINS[key].name, total: 0, correct: 0, rate: null };
      }
    }
    for (k = 0; k < NODES.length; k++) {
      node = NODES[k];
      areaSummary[node.area].total += stats[node.id].total;
      areaSummary[node.area].correct += stats[node.id].correct;
      domainSummary[node.domain].total += stats[node.id].total;
      domainSummary[node.domain].correct += stats[node.id].correct;
    }
    for (k = 0; k < AREAS.length; k++) {
      var a = areaSummary[AREAS[k].id];
      a.rate = a.total > 0 ? a.correct / a.total : null;
    }
    for (var key2 in domainSummary) {
      if (Object.prototype.hasOwnProperty.call(domainSummary, key2)) {
        var d = domainSummary[key2];
        d.rate = d.total > 0 ? d.correct / d.total : null;
      }
    }

    return {
      stats: stats,
      weak: weak,
      roots: roots,
      areaSummary: areaSummary,
      domainSummary: domainSummary,
      answered: list.length
    };
  }

  /** 상담용 한 줄 요약 문장 생성 */
  function explainRoot(root) {
    if (!root) return '';
    var node = getNode(root.id);
    if (!node) return '';
    var pct = Math.round((root.rate || 0) * 100);
    if (root.blocking && root.blocking.length > 0) {
      var names = root.blocking.slice(0, 3).map(function (x) {
        var t = getNode(x);
        return t ? t.name : x;
      });
      return '「' + node.name + '」 정답률 ' + pct + '%. 이 개념이 무너져서 '
        + names.join(', ')
        + (root.blocking.length > 3 ? ' 등 ' + root.blocking.length + '개' : '')
        + ' 개념이 함께 흔들리고 있습니다.';
    }
    return '「' + node.name + '」 정답률 ' + pct + '%로 보완이 필요합니다.';
  }

  /* ------------------------------------------------------------------
   * 7. 무결성 검증 (개발 중 데이터 실수 방지)
   * ---------------------------------------------------------------- */

  function validate() {
    var errors = [];
    var seen = {};
    var k, m, node;

    for (k = 0; k < NODES.length; k++) {
      node = NODES[k];
      if (seen[node.id]) errors.push('중복 id: ' + node.id);
      seen[node.id] = true;
      if (!AREA_BY_ID[node.area]) errors.push(node.id + ': 잘못된 area ' + node.area);
      if (!DOMAINS[node.domain]) errors.push(node.id + ': 잘못된 domain ' + node.domain);
      if (!node.std) errors.push(node.id + ': std 누락');
      if (!node.kw || node.kw.length === 0) errors.push(node.id + ': 키워드 누락');
      for (m = 0; m < node.prereq.length; m++) {
        if (!NODE_BY_ID[node.prereq[m]]) errors.push(node.id + ': 없는 prereq ' + node.prereq[m]);
      }
      for (m = 0; m < node.related.length; m++) {
        if (!NODE_BY_ID[node.related[m]]) errors.push(node.id + ': 없는 related ' + node.related[m]);
      }
    }

    // 순환 참조 검사
    var state = {};
    function dfs(id, path) {
      if (state[id] === 2) return;
      if (state[id] === 1) {
        errors.push('순환 참조: ' + path.concat(id).join(' → '));
        return;
      }
      state[id] = 1;
      var nd = getNode(id);
      if (nd) {
        for (var p = 0; p < nd.prereq.length; p++) {
          dfs(nd.prereq[p], path.concat(id));
        }
      }
      state[id] = 2;
    }
    for (k = 0; k < NODES.length; k++) dfs(NODES[k].id, []);

    return { ok: errors.length === 0, errors: errors, count: NODES.length };
  }

  /* ------------------------------------------------------------------
   * 8. 전역 노출
   * ---------------------------------------------------------------- */

  var ConceptMap = {
    SUBJECT: SUBJECT,
    CURRICULUM: CURRICULUM,
    PUBLISHERS: PUBLISHERS,
    DEFAULT_PUBLISHER: DEFAULT_PUBLISHER,
    AREAS: AREAS,
    DOMAINS: DOMAINS,
    NODES: NODES,
    CHILDREN: CHILDREN,

    getNode: getNode,
    allNodes: allNodes,
    byArea: byArea,
    byStandard: byStandard,
    byDomain: byDomain,
    listStandards: listStandards,
    pageUrl: pageUrl,
    ancestors: ancestors,
    descendants: descendants,
    levels: levels,

    matchConcepts: matchConcepts,
    analyze: analyze,
    explainRoot: explainRoot,
    validate: validate
  };

  global.ConceptMap = ConceptMap;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConceptMap;
  }
})(typeof window !== 'undefined' ? window : globalThis);
