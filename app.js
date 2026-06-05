// '내가 만약 시장이라면' - 초등학생 눈높이에 맞춘 게임 로직 및 상태 관리 (밸런싱 튜닝 및 개편 버전)

// Google Apps Script 웹 앱 배포 URL (여기에 복사한 URL을 입력하세요)
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxjRV8pvy3cUz16tiFZ40UrXX6nKOJ4Nva860e7VRABaulDV6T27vpXcDEOYehswrnJ/exec";

// 피셔-예이츠 셔플 알고리즘 (이벤트와 카드의 진정한 랜덤성을 보장)
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 커스텀 알림(Alert) 모달 - Promise 기반 비동기식
function customAlert(message, type = "info") {
  return new Promise((resolve) => {
    const container = document.getElementById("custom-alert-container");
    const titleEl = document.getElementById("custom-alert-title");
    const msgEl = document.getElementById("custom-alert-message");
    const iconEl = document.getElementById("custom-alert-icon");
    const cancelBtn = document.getElementById("btn-custom-alert-cancel");
    const okBtn = document.getElementById("btn-custom-alert-ok");
    
    // 타이틀 및 아이콘 색상 설정
    titleEl.textContent = "시장실 알림 📢";
    iconEl.className = "custom-alert-icon";
    if (type === "warning") {
      iconEl.classList.add("warning");
      iconEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i>`;
    } else if (type === "success") {
      iconEl.classList.add("success");
      iconEl.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
    } else {
      iconEl.innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
    }
    
    msgEl.textContent = message;
    cancelBtn.style.display = "none"; // 경고창일 땐 취소 버튼 감춤
    
    container.style.display = "flex";
    
    // 이벤트 리스너 재정의
    const handleOk = () => {
      container.style.display = "none";
      okBtn.removeEventListener("click", handleOk);
      resolve();
    };
    okBtn.addEventListener("click", handleOk);
  });
}

// 커스텀 확인(Confirm) 모달 - Promise 기반 비동기식
function customConfirm(message, type = "question") {
  return new Promise((resolve) => {
    const container = document.getElementById("custom-alert-container");
    const titleEl = document.getElementById("custom-alert-title");
    const msgEl = document.getElementById("custom-alert-message");
    const iconEl = document.getElementById("custom-alert-icon");
    const cancelBtn = document.getElementById("btn-custom-alert-cancel");
    const okBtn = document.getElementById("btn-custom-alert-ok");
    
    titleEl.textContent = "시장실 결재 결심 🖋️";
    iconEl.className = "custom-alert-icon";
    if (type === "warning") {
      iconEl.classList.add("warning");
      iconEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>`;
    } else {
      iconEl.innerHTML = `<i class="fa-solid fa-signature"></i>`;
    }
    
    msgEl.textContent = message;
    cancelBtn.style.display = "inline-flex"; // 확인창일 땐 취소 버튼 노출
    
    container.style.display = "flex";
    
    const handleOk = () => {
      container.style.display = "none";
      okBtn.removeEventListener("click", handleOk);
      cancelBtn.removeEventListener("click", handleCancel);
      resolve(true);
    };
    
    const handleCancel = () => {
      container.style.display = "none";
      okBtn.removeEventListener("click", handleOk);
      cancelBtn.removeEventListener("click", handleCancel);
      resolve(false);
    };
    
    okBtn.addEventListener("click", handleOk);
    cancelBtn.addEventListener("click", handleCancel);
  });
}

// 1. 게임 상태 관리
const gameState = {
  mayorName: "",
  cityName: "",
  cityType: "", // 'large' (대도시), 'medium' (중간도시), 'small' (소도시)
  
  // 현재 도시 수치
  budget: 0,       // 예산 (억 원)
  population: 0,   // 인구수 (만 명)
  happiness: 0,    // 시민 행복도 (0 ~ 100점)
  
  // 5년간의 변화 기록 (선 그래프용)
  history: {
    budget: [],
    population: [],
    happiness: []
  },
  
  // 게임 진행 단계
  termYear: 1, // 1 ~ 5년 차
  phase: "policy1", // 'policy1' (정책1), 'news1' (뉴스1), 'event' (돌발상황), 'policy2' (정책2), 'news2' (뉴스2)
  
  // 결정했던 역사 기록
  decisions: [],
  
  // 활성화된 변수들
  selectedPolicyId: null,
  activeEvent: null,
  currentRoundPolicies: [], // 이번 해에 추천될 5가지 정책 카드
  isApproving: false, // 결재 중복 클릭 방지용 플래그
  executedPolicyIds: [], // 이미 결재가 승인되어 집행 완료된 정책 카드 ID 목록
  executedEventIds: [], // 이미 발생한 돌발 상황 이벤트 ID 목록
  activeEvents: [] // 이번 게임 플레이에서 매년 순차적으로 등장할 무작위 돌발 이벤트 5종 (하위 호환 유지)
};

// 2. 도시 규모별 초기 설정 데이터
const CITY_CONFIGS = {
  large: {
    name: "대도시 (사람들이 많이 붐비는 도시)",
    budget: 1000,
    population: 50.0,
    happiness: 65,
    densityBadge: "🔴 매우 복잡함 (북적북적)",
    densityClass: "density-red",
    penaltyDesc: "교통 체증과 매연 문제로, 아무것도 하지 않아도 매년 예산 -25억 원(도로 관리비), 시민 행복도 -6점이 자동으로 줄어듭니다.",
    applyAnnualPenalty: (state) => {
      state.budget = Math.max(0, state.budget - 25);
      state.happiness = Math.max(0, state.happiness - 6);
      return { budget: -25, population: 0, happiness: -6, desc: "대도시 과밀 패널티 (교통 체증과 환경 오염 발생)" };
    }
  },
  medium: {
    name: "중간 도시 (성장하고 있는 도시)",
    budget: 500,
    population: 30.0,
    happiness: 70,
    densityBadge: "🟡 보통 (인구 유출 주의)",
    densityClass: "density-yellow",
    penaltyDesc: "주변의 더 큰 대도시로 사람들이 이사 가기 쉬워, 아무것도 하지 않으면 매년 인구가 1.2만 명씩 줄어듭니다.",
    applyAnnualPenalty: (state) => {
      state.population = Math.max(0.1, parseFloat((state.population - 1.2).toFixed(1)));
      return { budget: 0, population: -1.2, happiness: 0, desc: "더 큰 대도시로 사람들이 떠나는 패널티" };
    }
  },
  small: {
    name: "소도시 (사라질 위기의 시골 마을)",
    budget: 120,
    population: 8.0,
    happiness: 72,
    densityBadge: "🟢 한적함 (인구 소멸 위기)",
    densityClass: "density-green",
    penaltyDesc: "학교와 큰 병원이 부족해서 살기가 힘들어요. 매년 인구 0.9만 명 감소, 행복도 -4점이 자동으로 줄어듭니다.",
    applyAnnualPenalty: (state) => {
      state.population = Math.max(0.1, parseFloat((state.population - 0.9).toFixed(1)));
      state.happiness = Math.max(0, state.happiness - 4);
      return { budget: 0, population: -0.9, happiness: -4, desc: "병원·학교 부족으로 마을이 작아지는 패널티" };
    }
  }
};

// 랜덤 도시 이름 조합 단어들
const randomCityPrefix = ["푸른샘", "미리내", "한누리", "늘푸른", "햇살마루", "솔바람", "은가람", "달빛마루", "새늘", "온누리"];
const randomCitySuffix = ["시", "군", "마을", "밸리"];

// 18가지 초등학생용 정책 카드 풀 (쉬운 용어와 직관적 기회비용, 밸런스 조정 완료)
const POLICIES = [
  {
    id: "p1",
    name: "큰 관공서와 연구소 유치하기 🏢",
    desc: "다른 지역에 있는 공기업이나 국가 연구소를 우리 도시로 이사 오게 하여 좋은 일자리를 만듭니다.",
    effects: {
      large: { budget: -45, population: -2.0, happiness: +5, news: "큰 기관의 지방 이전 발표! 대도시 붐빔 현상이 조금 줄어듭니다" },
      medium: { budget: -30, population: +1.2, happiness: +10, news: "우리 도시에 새로운 공기업 유치 성공! 일하러 온 청년들로 도심이 들썩들썩" },
      small: { budget: -20, population: +2.0, happiness: +16, news: "소도시에 국가 연구소 준공! 박사님들이 대거 이사 와서 마을 인구 급증!" }
    }
  },
  {
    id: "p2",
    name: "컴퓨터·IT 회사 유치하기 💻",
    desc: "인터넷, 게임, 로봇을 만드는 유명한 컴퓨터 회사들이 들어설 수 있는 멋진 첨단 연구 단지를 짓습니다.",
    effects: {
      large: { budget: -150, population: +3.5, happiness: -5, news: "첨단 테크노 단지 완공! 회사는 늘었지만 교통 체증으로 퇴근길 정체 심각" },
      medium: { budget: -100, population: +2.2, happiness: +12, news: "게임 회사 대거 이사 완료! 젊은 직장인 유치로 도시 이미지 쇄신" },
      small: { budget: -50, population: +1.0, happiness: +8, news: "소도시 소형 특화 컴퓨터 지원 센터 건립! 청년 창업 발판 마련" }
    }
  },
  {
    id: "p3",
    name: "청년 상인과 동네 야시장 지원하기 🎨",
    desc: "청년 예술가와 창업가들이 낡은 골목이나 시장에서 이색 먹거리를 팔고 예쁜 가게를 열도록 돈을 대 줍니다.",
    effects: {
      large: { budget: -20, population: +0.2, happiness: +12, news: "대도시 낡은 시장의 변신! 맛집 골목으로 청년들과 관광객 몰린다" },
      medium: { budget: -12, population: +0.6, happiness: +15, news: "강가 공원에서 열린 청년 야시장 성황! 주말마다 맛있는 냄새와 버스킹 음악 솔솔" },
      small: { budget: -8, population: +1.0, happiness: +20, news: "버려진 시골 폐교가 핫플레이스 예술 카페로! 전국에서 놀러 오는 명물 낙점" }
    }
  },
  {
    id: "p4",
    name: "밤에도 여는 어린이 병원 세우기 🏥",
    desc: "밤이나 주말에 아이가 갑자기 아파도 멀리 가지 않고 곧바로 치료를 받을 수 있는 전용 병원을 유치합니다.",
    effects: {
      large: { budget: -50, population: +0.5, happiness: +10, news: "밤늦게 아파도 걱정 끝! 24시간 안심 어린이 응급 병원 추가 개원 완료" },
      medium: { budget: -38, population: +1.5, happiness: +15, news: "종합 의료 지원 센터 완공! 이사 오고 싶을 정도로 안심되는 안전 도시 구축" },
      small: { budget: -25, population: +2.2, happiness: +22, news: "원정 병원 안 가도 된다! 소도시 첫 종합 응급 소아 센터 준공 감격" }
    }
  },
  {
    id: "p5",
    name: "컴퓨터와 친환경 숲이 있는 미래 학교 🏫",
    desc: "학교 건물에 인공지능 교실을 만들고, 태양광 발전기와 자연 숲이 어우러진 친환경 스마트 교실을 짓습니다.",
    effects: {
      large: { budget: -42, population: +0.3, happiness: +8, news: "스마트 생태 학교 시범 지정! 가상현실 교실에서 전자기기로 재미있게 공부해요" },
      medium: { budget: -32, population: +1.0, happiness: +12, news: "명품 학업 인프라 완성! 수준 높은 미래형 교실 도입으로 학부모 만족도 상승" },
      small: { budget: -15, population: +1.8, happiness: +18, news: "폐교 위험 극복! 도시에서 거꾸로 전학 오는 소도시 작은 학교의 기적" }
    }
  },
  {
    id: "p6",
    name: "고향 사랑 기부금과 특산물 선물 💝",
    desc: "다른 지역에 사는 어른들에게 우리 도시를 응원하는 기부금을 받고, 감사로 맛있는 고장 특산물을 선물합니다.",
    effects: {
      large: { budget: +8, population: 0, happiness: +2, news: "대도시 기부금 소폭 확보, 이색적인 답례품 알리기 경쟁 개시" },
      medium: { budget: +20, population: +0.1, happiness: +6, news: "지역 특산품 사과와 쌀 불티나게 팔려! 농사짓는 주민들 세입 활짝" },
      small: { budget: +30, population: +0.3, happiness: +15, news: "기부금 폭발적 확보! 시청 예산에 보너스 30억 장착으로 주민 쉼터 짓는다" }
    }
  },
  {
    id: "p7",
    name: "도심 속 자연 공원과 맑은 시냇가 가꾸기 🌳",
    desc: "매연으로 퀴퀴해진 도심에 커다란 나무 숲 공원을 만들고, 더러워진 하천 물길을 깨끗하게 되살립니다.",
    effects: {
      large: { budget: -65, population: -0.5, happiness: +18, news: "도심 한복판 대형 숲 정원 탄생! 미세먼지 마스크 벗고 주민들 산책" },
      medium: { budget: -38, population: +0.4, happiness: +14, news: "생태 물길 산책로 완공! 걷기 좋은 물소리에 동네 강아지들도 신났다" },
      small: { budget: -20, population: +0.8, happiness: +12, news: "청정 에코 습지 조성! 자연 체험 캠핑족 유치로 소도시 매력 뿜뿜" }
    }
  },
  {
    id: "p8",
    name: "시골로 이사 오는 분들을 위한 전원마을 🏡",
    desc: "시끄러운 도시를 떠나 조용하고 자연이 고운 시골에 정착하고 싶은 분들을 위해 은퇴 전원주택을 지원합니다.",
    effects: {
      large: { budget: -28, population: -1.5, happiness: +5, news: "도시 은퇴 어르신들 지방 이사 선호! 도심 고령 정체 현상 완화에 도움" },
      medium: { budget: -20, population: +0.8, happiness: +8, news: "숲세권 전원마을 입주 대성황! 조용한 자연을 찾는 귀촌 세대 정착" },
      small: { budget: -14, population: +1.8, happiness: +15, news: "소도시에 활기 불어넣는 귀농 주거지! 젊은 농업 희망자들이 찾아온다" }
    }
  },
  {
    id: "p9",
    name: "이웃 도시로 오가는 빠른 지하철과 버스 🚊",
    desc: "다른 큰 도시까지 막힘없이 가도록 전철을 놓고, 시내버스와 고속버스를 쉽게 골라타는 환승 정류장을 만듭니다.",
    effects: {
      large: { budget: -140, population: +2.5, happiness: +10, news: "광역 환승 교통망 추가 개통! 외곽에서 출퇴근하는 사람들의 피로 싹 해결" },
      medium: { budget: -85, population: +1.8, happiness: +8, news: "대도시 통학 급행 버스 개통! 대도시로 놀러 가기는 더 편해졌다?" },
      small: { budget: -38, population: +0.8, happiness: +12, news: "소도시 방방곡곡 달리는 '100원 행복 택시' 도입! 할아버지 할머니 이동권 보장" }
    }
  },
  {
    id: "p10",
    name: "스스로 전기를 만드는 친환경 에너지 마을 ⚡",
    desc: "집 지붕마다 친환경 태양광 발전기를 올리고, 전기를 아끼는 똑똑한 스마트 동네를 시범적으로 짓습니다.",
    effects: {
      large: { budget: -75, population: +0.5, happiness: +10, news: "에너지 자립 아파트 첫 준공! 전기요금을 직접 만들어 아끼는 친환경 단지" },
      medium: { budget: -50, population: +0.8, happiness: +12, news: "전력 자급자족 성공! 전기료 대폭 하락! 스마트 그리드 기술 접목에 주민들 지갑 든든" },
      small: { budget: -26, population: +0.5, happiness: +10, news: "기후 위기 탈출! 환경을 아끼는 저탄소 청정 마을로 시골 동네 명성 획득" }
    }
  },
  {
    id: "p11",
    name: "문화 복지 센터 및 체육관 건립 🏟️",
    desc: "모든 시민이 다양한 취미 생활과 스포츠를 배울 수 있는 대형 문화 복지 체육 센터를 짓습니다.",
    effects: {
      large: { budget: -60, population: +0.4, happiness: +14, news: "대형 문화 체육관 준공! 대도시 복합 문화 혜택에 시민들 환호" },
      medium: { budget: -40, population: +0.8, happiness: +16, news: "중간도시에 공공 문화 예술 회관 건립! 취미 및 강좌 개설로 들썩" },
      small: { budget: -20, population: +1.2, happiness: +22, news: "소도시에 현대식 복지 체육 센터 건립! 어르신 건강교실 대성황" }
    }
  },
  {
    id: "p12",
    name: "동네 불량 간판 및 거리 환경 정비 사업 🎨",
    desc: "보기 흉하게 방치된 낡은 불량 간판들을 떼어내고 걷기 편한 예쁜 특색 거리를 조성합니다.",
    effects: {
      large: { budget: -30, population: 0, happiness: +8, news: "깨끗해진 도심 빌딩 거리! 보기 흉한 낡은 간판 일제 교체로 품격 업그레이드" },
      medium: { budget: -18, population: +0.2, happiness: +10, news: "거리 미관 정비 사업 대성황! 걷고 싶은 예쁜 특색 테마 골목길 탄생" },
      small: { budget: -9, population: +0.4, happiness: +12, news: "시골 마을 안길 벽화 정비 완료! 아기자기하고 화사한 동네로 대변신" }
    }
  },
  {
    id: "p13",
    name: "장애인·임산부 무장애 안심 보도블록 정비 ♿",
    desc: "유모차나 휠체어도 안전하게 오가도록 보도 턱을 낮추고, 시각장애인용 안전 바닥 타일을 설치합니다.",
    effects: {
      large: { budget: -40, population: 0, happiness: +10, news: "휠체어도 유모차도 씽씽! 턱이 낮아진 안심 보행로 대폭 확대" },
      medium: { budget: -25, population: +0.1, happiness: +12, news: "교통 약자를 위한 배려 장벽 철폐! 무장애 걷기 친화 명품 도시 발돋움" },
      small: { budget: -12, population: +0.2, happiness: +15, news: "휠체어 탄 이웃도 외출이 쉬워졌어요! 소도시 첫 무장애 도보 정비 완료" }
    }
  },
  {
    id: "p14",
    name: "어두운 밤길 가로등 및 안심 CCTV 확충 🚨",
    desc: "아이들과 주민들이 어두운 골목길도 걱정 없이 다닐 수 있게 밝은 가로등을 더 놓고 감시 카메라를 더 답니다.",
    effects: {
      large: { budget: -25, population: +0.2, happiness: +8, news: "대도시 밤거리 사각지대 완전 퇴치! 지능형 스마트 CCTV 대대적 확충" },
      medium: { budget: -16, population: +0.4, happiness: +10, news: "밤길 안심 귀갓길 시스템 작동! 골목길 LED 보안등 올 교체" },
      small: { budget: -8, population: +0.6, happiness: +12, news: "시골길 밤길이 밝아졌어요! 범죄 제로 안전 소마을 지향 인프라 장착" }
    }
  },
  {
    id: "p15",
    name: "로컬 푸드 직매장 및 농민 직거래 시장 육성 🍎",
    desc: "지역의 농가에서 기른 신선한 과일과 채소를 저렴하고 안전하게 직거래로 구입할 수 있는 전용 마켓을 짓습니다.",
    effects: {
      large: { budget: -20, population: +0.1, happiness: +6, news: "신선한 산지 채소가 바로 밥상으로! 대도시 첫 대형 로컬푸드점 오픈" },
      medium: { budget: -12, population: +0.4, happiness: +10, news: "우리 농가 돕고 신선함은 더하고! 중간도시 농민 마켓 인기 폭발" },
      small: { budget: -6, population: +0.8, happiness: +16, news: "텃밭 채소 내다 파는 시골 장터 부흥! 지역 소규모 농민들의 활짝 핀 웃음" }
    }
  },
  {
    id: "p16",
    name: "이색 관광 출렁다리 및 수목원 숲 조성 🌉",
    desc: "외지 관광객들이 찾아와 돈을 쓰도록 자연 절경을 즐기는 흔들다리와 식물 숲 정원을 가꿉니다.",
    effects: {
      large: { budget: -85, population: +0.6, happiness: +15, news: "도심 속 초대형 생태 수목원 완공! 멀리 안 가도 자연을 만끽해요" },
      medium: { budget: -55, population: +1.4, happiness: +18, news: "강가 출렁다리 관광 랜드마크 조성 완료! 주말 나들이 명소로 등극" },
      small: { budget: -30, population: +2.0, happiness: +24, news: "소도시 꽃길 정원 수목원에 관광객 급증! 지역 경제에 단비 같은 관광 효과" }
    }
  },
  {
    id: "p17",
    name: "지방 대학교 연계 청년 일자리 인턴십 지원 🎓",
    desc: "우리 고장의 대학생들이 외지로 떠나지 않고 지역 우수 중소기업에 취직해 일자리를 잡도록 연계 훈련을 지원합니다.",
    effects: {
      large: { budget: -45, population: -0.3, happiness: +6, news: "대학-기업 일자리 매칭 추진! 우수 인프라 대비 청년 취업률 다소 상승" },
      medium: { budget: -30, population: +0.9, happiness: +11, news: "산학협력 기업 인턴 장학제 도입! 우리 지역 청년 인재들이 정착해요" },
      small: { budget: -15, population: +1.6, happiness: +16, news: "소도시 대학생 학업-취업 원스톱 지원 가동! 마을 인구 뼈대 세울 청년 유치" }
    }
  },
  {
    id: "p18",
    name: "공공 초고속 와이파이(Wi-Fi) 망 및 디지털 교육 📶",
    desc: "시민들이 어딜 가든 무선 인터넷을 공짜로 쓰고, 디지털 기기 다루는 법을 친절히 교육해 줍니다.",
    effects: {
      large: { budget: -40, population: +0.2, happiness: +8, news: "대도시 전철 및 버스 어디서나 빵빵! 초고속 공공 와이파이 전면 무료화" },
      medium: { budget: -26, population: +0.4, happiness: +10, news: "스마트 소통망 완비! 동네 경로당과 복지관 디지털 정보 접근권 대폭 강화" },
      small: { budget: -13, population: +0.6, happiness: +13, news: "시골 마을 정보 소외 극복! 태블릿 무료 대여 및 스마트 기기 활용 교육 개시" }
    }
  },
  {
    id: "p19",
    name: "대도시 대학-지방 대학 공동 캠퍼스 구축 🎓",
    desc: "대도시에 있는 유명 대학교의 일부 학과나 대학원을 소도시로 옮겨, 두 지역 대학생들이 함께 공부할 수 있는 캠퍼스를 만듭니다.",
    allowedCities: ["large"],
    effects: {
      large: { budget: -25, population: -0.3, happiness: +12, news: "대학 공동 캠퍼스 구축! 대도시 과밀화가 조금 줄어들고 교육 교류가 활성화됩니다." },
      medium: { budget: -15, population: -0.1, happiness: +8, news: "대학 공동 캠퍼스 참여! 인근 대학과의 활발한 교류로 학생들의 만족도가 올라갑니다." },
      small: { budget: -5, population: +0.5, happiness: +15, news: "공동 캠퍼스 소도시 유치! 대도시 대학생들이 내려와 마을에 젊은 활기가 넘칩니다." }
    }
  },
  {
    id: "p20",
    name: "도심 공장 및 유통센터 외곽 이전 지원 🚛",
    desc: "도심 한가운데 있어서 먼지와 교통 체증을 일으키는 큰 공장이나 택배 터미널을 도시 외곽이나 주변 소도시로 옮기도록 보상금을 줍니다.",
    allowedCities: ["large"],
    effects: {
      large: { budget: -20, population: -0.2, happiness: +15, news: "도심 공장 외곽 이전! 맑아진 하늘과 뻥 뚫린 도로에 시민들이 크게 기뻐합니다." },
      medium: { budget: -15, population: -0.1, happiness: +10, news: "도심 물류센터 이전 지원! 도심 소음과 혼잡이 눈에 띄게 완화되었습니다." },
      small: { budget: +10, population: +0.3, happiness: +8, news: "이전 공장 소도시 유치! 공장이 들어서며 세금 수입과 일자리가 늘어납니다." }
    }
  },
  {
    id: "p21",
    name: "주말 농장 및 '귀농·귀촌 체험 지원센터' 운영 🚜",
    desc: "대도시 시민들이 주말마다 소도시에 가서 농사를 짓거나 쉴 수 있도록 체험 비용과 기차표를 지원해 줍니다.",
    allowedCities: ["large"],
    effects: {
      large: { budget: -5, population: 0, happiness: +10, news: "귀농·귀촌 지원센터 개설! 주말마다 텃밭을 가꾸며 힐링하는 시민들이 늘어납니다." },
      medium: { budget: -4, population: 0, happiness: +8, news: "주말 농장 지원 사업 안착! 자연과 함께 여가를 즐기는 가정이 많아졌습니다." },
      small: { budget: +5, population: +0.2, happiness: +12, news: "주말 체험객 소도시 유치! 주말마다 외지 사람들로 활기가 돋고 농산물 판매가 늘어납니다." }
    }
  },
  {
    id: "p22",
    name: "지역 혁신 기업(스타트업) 타운 조성 🚀",
    desc: "새로운 아이디어로 창업하는 젊은 기업가들에게 사무실을 무료로 빌려주고 연구비를 지원하여 대도시로 떠나지 않게 만듭니다.",
    allowedCities: ["medium"],
    effects: {
      large: { budget: -25, population: +1.0, happiness: +8, news: "스타트업 타운 활성화! 수많은 청년 기업가들이 모여 창업 열기가 뜨겁습니다." },
      medium: { budget: -15, population: +0.8, happiness: +12, news: "지역 혁신 기업 타운 조성! 청년 인재들이 대도시로 떠나지 않고 이곳에 둥지를 틉니다." },
      small: { budget: -10, population: +0.4, happiness: +10, news: "소도시 청년 창업 허브 구축! 아이디어를 가진 청년들이 모여 마을을 바꿉니다." }
    }
  },
  {
    id: "p23",
    name: "24시간 돌봄 어린이집 및 아동 종합병원 건립 🏥",
    desc: "부모님이 늦게까지 안심하고 아이를 맡길 수 있는 어린이집과, 밤에도 아픈 아이를 치료할 수 있는 어린이 전문 병원을 만듭니다.",
    allowedCities: ["medium"],
    effects: {
      large: { budget: -30, population: +1.0, happiness: +15, news: "아동 병원 및 어린이집 건립! 안심하고 아이 키우기 좋은 환경이 조성됩니다." },
      medium: { budget: -20, population: +1.2, happiness: +18, news: "24시간 돌봄 어린이집 개원! 맞벌이 부부들의 육아 걱정이 싹 사라집니다." },
      small: { budget: -12, population: +1.5, happiness: +22, news: "소도시 첫 야간 어린이 안심 시설 완공! 아기 울음소리가 들리는 동네로 변합니다." }
    }
  },
  {
    id: "p24",
    name: "광역 급행 버스(BRT) 및 환승 주차장 개통 🚌",
    desc: "주변 소도시나 대도시를 빠르게 연결하는 전용 버스 노선을 만들고, 역 근처에 주차장을 지어 출퇴근을 편리하게 만듭니다.",
    allowedCities: ["medium"],
    effects: {
      large: { budget: -25, population: +0.8, happiness: +8, news: "광역 BRT 노선 신설! 외곽 도시와의 통행 시간이 단축되어 출퇴근길이 빨라집니다." },
      medium: { budget: -15, population: +0.6, happiness: +10, news: "급행 버스 및 환승 주차장 개통! 이웃 도시와의 접근성이 획기적으로 향상됩니다." },
      small: { budget: -10, population: +0.3, happiness: +8, news: "대도시 연결 급행 버스 도입! 교통 소외를 극복하고 주민들의 이동 편의가 증진됩니다." }
    }
  },
  {
    id: "p25",
    name: "은퇴자 복합 웰니스 실버타운 조성 🏡",
    desc: "대도시에서 직장을 은퇴한 어르신들이 맑은 공기를 마시며 건강하게 살 수 있도록 병원과 운동 시설이 합쳐진 멋진 마을을 짓습니다.",
    allowedCities: ["small"],
    effects: {
      large: { budget: -15, population: -0.5, happiness: +8, news: "대도시 은퇴자 지방 실버타운 이주 시작! 도심 고령층 과밀 해소에 도움을 줍니다." },
      medium: { budget: -12, population: +0.2, happiness: +10, news: "웰니스 실버타운 유치! 은퇴 가구 유입으로 노후 건강 케어 거점 마련." },
      small: { budget: -10, population: +0.5, happiness: +10, news: "복합 실버타운 대성공! 대도시 은퇴층이 대거 이주하여 마을이 다시 북적입니다." }
    }
  },
  {
    id: "p26",
    name: "시골 유학 및 가족 체류 센터 운영 🏫",
    desc: "학생이 없어 문을 닫은 학교를 개조하여, 대도시 초등학생들이 6개월간 가족과 함께 시골 학교를 다닐 수 있도록 주택과 장학금을 지원합니다.",
    allowedCities: ["small"],
    effects: {
      large: { budget: -4, population: -0.1, happiness: +6, news: "시골 유학 체험단 출발! 아이들이 대자연 속에서 마음껏 뛰어놀며 배웁니다." },
      medium: { budget: -4, population: +0.1, happiness: +8, news: "가족 체류형 유학 프로그램 연계! 도시와 농촌의 상생 교육이 시작됩니다." },
      small: { budget: -5, population: +0.3, happiness: +12, news: "폐교의 대변신! 시골 유학생 가족 유치로 학교가 살아나고 동네에 웃음꽃이 핍니다." }
    }
  },
  {
    id: "p27",
    name: "스마트 원격 진료소 및 이동식 버스 병원 도입 🚑",
    desc: "큰 병원이 부족한 마을 어르신들을 위해 화면으로 대도시 의사에게 진료를 받는 시스템을 만들고, 물리치료 버스를 매주 보냅니다.",
    allowedCities: ["small"],
    effects: {
      large: { budget: -10, population: 0, happiness: +6, news: "지방 원격 진료망 연계! 대도시 대형 병원 의사들이 재능 기부로 의료 봉사를 벌입니다." },
      medium: { budget: -8, population: 0, happiness: +8, news: "외곽 원격 진료소 오픈! 병원 방문이 힘든 고령층의 편의가 대폭 증진됩니다." },
      small: { budget: -8, population: +0.1, happiness: +15, news: "화면으로 의사를 만나요! 이동식 버스 병원 도입으로 어르신들 건강 고민 해결." }
    }
  },
  {
    id: "p28",
    name: "크리에이터 및 디지털 노마드 공유 오피스 구축 💻",
    desc: "인터넷만 있으면 어디서나 일할 수 있는 유튜버나 컴퓨터 프로그래머들이 아름다운 자연 속에서 일할 수 있도록 무선 인터넷이 빵빵한 숙소와 사무실을 지원합니다.",
    allowedCities: ["small"],
    effects: {
      large: { budget: -8, population: -0.2, happiness: +6, news: "디지털 노마드의 지방 이동! 대도시의 빽빽한 오피스를 벗어나 힐링 업무를 선호합니다." },
      medium: { budget: -6, population: +0.2, happiness: +8, news: "IT 공유 오피스 조성! 트렌디한 디지털 인재들이 도시를 찾습니다." },
      small: { budget: -5, population: +0.4, happiness: +12, news: "자연 속에서 코딩을! 디지털 노마드들이 몰려와 마을을 적극적으로 홍보합니다." }
    }
  }
];

// 5가지 초등학생 딜레마형 돌발 상황
const EVENTS = [
  {
    id: "e1",
    title: "🚨 쓰레기 처리장 위치 선정 갈등!",
    desc: "도시의 쓰레기 매립장이 가득 찼습니다! 주민들은 우리 동네에 혐오 시설(쓰레기장)을 짓지 말라며 강력히 반대하고 나섰습니다. 어떻게 해결할까요?",
    options: [
      {
        text: "💰 15억 원을 들여 소각장은 지하에 숨겨 짓고, 지상에는 물놀이 파크와 테마 공원을 꾸민다.",
        effects: {
          large: { budget: -15, population: +0.2, happiness: +12, result: "상생 극복! 지하화 소각장 주변으로 핫플레이스 카페거리가 조성되어 주민들이 무척 좋아합니다." },
          medium: { budget: -15, population: +0.1, happiness: +10, result: "재정이 조금 들었지만, 주민 설명회와 공원 혜택 덕분에 원만하게 타협했습니다." },
          small: { budget: -10, population: 0, happiness: +8, result: "소도시에겐 큰 금액이지만, 청정 에코 테마파크로 변신하여 다른 고장 아이들도 찾아오는 명소가 되었습니다." }
        }
      },
      {
        text: "👮 예산을 쓰지 않고 강제로 지으라고 명령을 내리고 강행한다.",
        effects: {
          large: { budget: 0, population: -1.0, happiness: -25, result: "주민들의 분노! 시청 앞에서 대규모 반대 시위와 파업이 벌어져 도시 치안과 이미지가 크게 나빠지고 이사를 가기 시작합니다." },
          medium: { budget: 0, population: -0.6, happiness: -20, result: "도시 내 이웃 간 불화가 심해지고, 시청 게시판이 매일 민원 댓글로 도배되어 마비됩니다." },
          small: { budget: 0, population: -0.4, happiness: -15, result: "작고 훈훈하던 시골 동네가 처리장 찬성파와 반대파로 갈려 삭막해졌습니다." }
        }
      }
    ]
  },
  {
    id: "e2",
    title: "🚨 큰 태풍으로 인한 도심 홍수 발생!",
    desc: "기습적인 집중호우로 도심 개울물이 넘쳐 상가와 주택가 수백 곳이 물에 잠기는 큰 침수 수해가 발생했습니다!",
    options: [
      {
        text: "💰 긴급 재난 예산 20억 원을 써서 피해주민을 돕고, 도로 하수구와 물막이벽을 튼튼히 고친다.",
        effects: {
          large: { budget: -20, population: +0.5, happiness: +15, result: "신속한 복구! 역시 안전하고 재해 대처가 빠른 도시라며 이사 오는 사람들이 늘고 시장 인기가 올라갑니다." },
          medium: { budget: -18, population: +0.3, happiness: +12, result: "재난 지원금을 지급하여 침수 피해를 입은 동네 자영업자들이 다시 기운을 내 가게를 열 수 있었습니다." },
          small: { budget: -12, population: +0.1, happiness: +10, result: "소도시 금고가 많이 비었지만, 재빠른 대처로 주민들의 생명과 재산을 무사히 지켜내어 든든합니다." }
        }
      },
      {
        text: "📢 자연재해이므로 시 재정을 아끼고 자원봉사자 모집과 모금 기부 운동 위주로 수습한다.",
        effects: {
          large: { budget: 0, population: -1.5, happiness: -25, result: "주민들의 야유! '시청은 세금 걷어서 뭐 하나!'라며 침수 피해 복구를 방치한다는 비난에 인구가 줄어듭니다." },
          medium: { budget: 0, population: -0.8, happiness: -20, result: "복구가 질질 늦어지며 상가 곳곳에 문을 닫는 빈 가게가 나타나고 침수 우려 지역 딱지가 붙어 동네가 낙후됩니다." },
          small: { budget: 0, population: -0.4, happiness: -15, result: "수해 지원을 방치하자 전국에서 자원봉사자들이 돕기는 했으나, 복구 지연과 시에 대한 서운함으로 마을 공동체 행복도가 크게 무너졌습니다." }
        }
      }
    ]
  },
  {
    id: "e3",
    title: "🚨 우리 도시의 대학교가 문을 닫을 위기!",
    desc: "아기들이 태어나지 않아 입학생이 너무 부족해진 지역 대학이 문을 닫으려 합니다. 대학이 없어지면 주변 상인들이 굶게 되고 청년들이 떠납니다.",
    options: [
      {
        text: "💰 예산 10억 원을 대학교에 투자해 직업 학습 센터를 열고 파격 장학금을 주어 학생들을 모은다.",
        effects: {
          large: { budget: -10, population: +0.2, happiness: +6, result: "대학 살리기 성공! 새로운 직업 교육 전공 신설로 입시 경쟁률이 다소 개선되었습니다." },
          medium: { budget: -10, population: +0.8, happiness: +12, result: "청년 인구 방어 성공! 주변 소도시에서 전액 장학생 소식을 듣고 학생들이 전학 및 통학하러 유입됩니다." },
          small: { budget: -8, population: +1.5, happiness: +18, result: "기적의 소도시! 대학이 살아남아 주변 원룸과 식당들이 다시 장사가 잘되고 활기를 되찾았습니다." }
        }
      },
      {
        text: "🏫 대학 관리는 국가 일이고 시청 일이 아니므로 자연스럽게 문을 닫도록 수용한다.",
        effects: {
          large: { budget: 0, population: -0.2, happiness: -12, result: "대도시 특성상 다른 배울 곳이 많아 피해는 크지 않지만 다소 정주 가치가 손실되었습니다." },
          medium: { budget: 0, population: -1.5, happiness: -22, result: "대학가 상권 붕괴! 대학이 문을 닫자 텅 빈 원룸촌과 닫힌 식당가가 을씨년스럽게 변해 도시 쇠퇴가 일어납니다." },
          small: { budget: 0, population: -2.5, happiness: -30, result: "마지막 보루 붕괴! 청년 대학생들이 몽땅 빠져나가 버려 시골 소도시 소멸 위험 수치가 수직으로 떨어졌습니다." }
        }
      }
    ]
  },
  {
    id: "e4",
    title: "🚨 오래된 동네의 빈집 방치 문제!",
    desc: "새 아파트로 사람들이 다 이사를 가 버려서, 구도심 주택가에 버려진 빈집이 많아졌습니다. 밤길이 너무 무섭고 안전하지 못하다는 동네 민원이 쏟아집니다.",
    options: [
      {
        text: "💰 8억 원의 돈으로 빈집들을 시청이 매입하여 헐고, 그 자리에 동네 어린이 쉼터와 공공 주차장을 짓는다.",
        effects: {
          large: { budget: -8, population: +0.1, happiness: +8, result: "안심 골목길 재탄생! 밤길 쓰레기 방치가 사라지고 쾌적한 주차 공간으로 동네가 안정을 찾았습니다." },
          medium: { budget: -8, population: +0.4, happiness: +12, result: "어린이 놀이터와 미니 정원으로 꾸며, 인근 어르신과 어린이들이 안심하고 산책하는 예쁜 골목이 되었습니다." },
          small: { budget: -6, population: +0.8, happiness: +16, result: "시골 마을 탈바꿈! 무너져 가던 흉가가 동네 사랑방 갤러리 및 로컬 찻집으로 화려하게 복원되었습니다." }
        }
      },
      {
        text: "👮 돈을 쓰지 않고 순찰관을 조금 늘리고 감시 카메라(CCTV)를 추가로 설치한다.",
        effects: {
          large: { budget: -1, population: 0, happiness: -10, result: "치안은 다소 보강되었으나 골목 곳곳에 방치된 빈집 흉물들이 그대로 남아 주민들의 주거 만족도와 행복도가 저하됩니다." },
          medium: { budget: -1, population: -0.2, happiness: -15, result: "여전히 지저분한 방치 빈집들이 그대로 남아 있어 어두운 밤길을 피하는 근본적 문제는 남았습니다." },
          small: { budget: -1, population: -0.5, happiness: -20, result: "소도시는 빈집 흉물 방치로 동네 붕괴를 피하기 어렵고 점점 이웃이 살기 싫은 곳이 되어갑니다." }
        }
      }
    ]
  },
  {
    id: "e5",
    title: "🚨 엄청난 폭설과 한파로 도로가 꽁꽁!",
    desc: "하룻밤 사이에 무릎 높이까지 폭설이 내려 도로가 빙판길로 완전히 얼어붙었습니다. 수도관 동파 신고도 급증하고 있습니다.",
    options: [
      {
        text: "💰 긴급 제설 작업 업체를 부르고 독거노인들을 위해 따뜻하게 온열 난방 쉼터를 열도록 6억 원을 쓴다.",
        effects: {
          large: { budget: -6, population: 0, happiness: +10, result: "빠른 행정 대처! 전철역과 도심 도로의 눈이 신속히 치워져 통학 대란을 막고, 안전 대처 우수 평가를 받습니다." },
          medium: { budget: -5, population: 0, happiness: +8, result: "염화칼슘 살포 및 긴급 배관 수리반 가동으로 동네 결빙 구간을 말끔히 해결했습니다." },
          small: { budget: -3, population: 0, happiness: +12, result: "시골 쉼터 기적! 갈 곳 없는 시골 어르신들을 온방 회관으로 모셔와 따뜻한 식사와 안전을 든든하게 챙겼습니다." }
        }
      },
      {
        text: "❄️ 돈을 안 쓰고 방송을 해서 '우리 집 앞 눈은 알아서 치웁시다'라고 유도하고 눈이 녹기를 기다린다.",
        effects: {
          large: { budget: 0, population: -0.4, happiness: -22, result: "지각 대란과 낙상 사고! 빙판길 제설차가 제때 안 다녀 등굣길, 출근길에 넘어져 다치는 사람들이 속출하고 분통을 터트립니다." },
          medium: { budget: 0, population: -0.2, happiness: -16, result: "언 도로 위에 차들이 미끄러져 추돌 사고가 나고 꽁꽁 언 얼음판 위에 빙판길 마비가 며칠간 유지되었습니다." },
          small: { budget: 0, population: -0.1, happiness: -12, result: "다행히 시골 동네 어르신들이 힘을 모았으나 역부족이었으며, 빙판길 미끄러짐 낙상 및 난방 고장 등으로 겨울철 주민 행복도가 떨어집니다." }
        }
      }
    ]
  },
  {
    id: "e6",
    title: "🚨 출퇴근길 '지옥철' 및 교통 마비 사태 발생!",
    desc: "우리 시로 몰려오는 인구가 너무 많아져 출퇴근길 지하철과 도로가 완전히 마비되고 시민들의 불만이 폭발합니다!",
    allowedCities: ["large"],
    options: [
      {
        text: "🚌 2층 광역버스를 즉시 도입하고 지하철 운행을 늘린다.",
        effects: {
          large: { budget: -40, population: +0.2, happiness: +10, result: "출퇴근 대란 해결! 2층 버스 도입과 지하철 증편으로 시민들의 통근길 행복도가 크게 올라갔습니다." },
          medium: { budget: -25, population: +0.1, happiness: +8, result: "출퇴근 통제 완료! 인근 지역과의 교통 연결망 확대 조치 성공." },
          small: { budget: -15, population: +0.1, happiness: +8, result: "출퇴근 복구! 소도시-대도시 오가는 버스 배차 간격 최적화 완료." }
        }
      },
      {
        text: "🚲 예산을 아끼기 위해 자전거 출퇴근(자출족) 권장 캠페인을 벌인다.",
        effects: {
          large: { budget: -2, population: -0.4, happiness: -15, result: "시민들의 거센 비난! 실효성 없는 자전거 캠페인에 시민들이 냉소를 보내며 교통 체증은 여전히 해결되지 않습니다." },
          medium: { budget: -1, population: -0.2, happiness: -12, result: "홍보 부족과 사고 위험 증가로 주민들의 자전거 이용률은 미미하며 불편이 지속됩니다." },
          small: { budget: -1, population: -0.1, happiness: -10, result: "소도시에 자전거 전용 도로가 부족하여 주민들이 위험을 느끼고 불만을 표시합니다." }
        }
      }
    ]
  },
  {
    id: "e7",
    title: "🚨 도심 노후 아파트 대규모 정전 및 단수!",
    desc: "지은 지 40년이 넘은 대단지 아파트의 낡은 변전소가 터져 수천 세대의 전기가 나가고 물 공급마저 끊겨 아수라장이 되었습니다.",
    allowedCities: ["large"],
    options: [
      {
        text: "🛠️ 긴급 노후 배관 및 변전소 교체 비용을 예산으로 보조해 준다.",
        effects: {
          large: { budget: -30, population: 0, happiness: +8, result: "안전 최우선 복구! 신속한 변전소 교체 보조금 지원으로 주거 안전도가 올라가고 전력 공급이 안정화되었습니다." },
          medium: { budget: -20, population: 0, happiness: +6, result: "발 빠른 행정 대처! 침수와 단수를 빠르게 예방하여 단지 주민들이 큰 고비를 넘겼습니다." },
          small: { budget: -12, population: 0, happiness: +6, result: "소도시 전력 복구 완료! 작은 예산이지만 긴급 안전 진단을 완료했습니다." }
        }
      },
      {
        text: "📢 비상 발전차만 보내주고 주민들 자체 회의로 해결하도록 한다.",
        effects: {
          large: { budget: -1, population: -0.2, happiness: -20, result: "주민 갈등 격화! 지원 없는 방치 정책에 아파트 주민들이 항의하며 다른 살기 좋은 곳으로 이사를 결정합니다." },
          medium: { budget: -1, population: -0.1, happiness: -15, result: "상수도 모터가 타버려 장기 단수가 이어지고 위생 상태와 주민 만족도가 최악으로 떨어집니다." },
          small: { budget: -1, population: -0.1, happiness: -12, result: "소도시는 자력 복구가 어려운 독거노인 세대가 많아 큰 고통을 겪고 불만이 쌓입니다." }
        }
      }
    ]
  },
  {
    id: "e8",
    title: "🚨 쓰레기 매립지 포화 및 쓰레기 대란 위기!",
    desc: "우리 시에서 나오는 쓰레기를 묻을 매립지가 꽉 찼습니다. 당장 대책을 마련하지 않으면 거리 전체가 쓰레기장으로 변할 위기입니다.",
    allowedCities: ["large"],
    options: [
      {
        text: "🏭 첨단 친환경 소각장을 건립하고 인근 주민들에게 보상한다.",
        effects: {
          large: { budget: -50, population: +0.2, happiness: +5, result: "친환경 소각장 완공! 일부 주민들의 반발은 있었으나 친환경 기술 덕분에 장기적으로 살기 좋은 친환경 도시로 거듭납니다." },
          medium: { budget: -35, population: +0.1, happiness: +5, result: "민관 협의체 구성 성공! 환경 정화 및 주민 보상 타결로 소각장이 안전하게 가동됩니다." },
          small: { budget: -18, population: +0.1, happiness: +6, result: "친환경 소각 시설 준공! 타 지역의 폐기물 처리 보조금으로 시 재정 활성화의 발판 마련." }
        }
      },
      {
        text: "💰 쓰레기 종량제 봉투 가격을 올리고 재활용 단속을 강력히 늘린다.",
        effects: {
          large: { budget: +5, population: -0.5, happiness: -25, result: "시민들의 거센 항의! 봉투값 인상으로 세입은 조금 늘었지만 거리 무단 투기가 급증해 도시 이미지가 크게 망가집니다." },
          medium: { budget: +3, population: -0.3, happiness: -20, result: "봉투 가격 저항으로 시민 반발이 빗발치고 골목길마다 쓰레기 투기 단속 민원이 쏟아집니다." },
          small: { budget: +1, population: -0.1, happiness: -15, result: "단속 인력이 턱없이 부족하여 효과는 거의 없고 시청 행정에 대한 불신만 늘어납니다." }
        }
      }
    ]
  },
  {
    id: "e9",
    title: "🚨 신도시 연결 도로 대형 싱크홀(땅 꺼짐) 발생!",
    desc: "최근 공사 차량과 물동량이 급증한 배후 도로 한복판이 푹 꺼지는 대형 싱크홀이 생겨 출근길 차량 2대가 추락했습니다!",
    allowedCities: ["medium"],
    options: [
      {
        text: "🛡️ 도로를 전면 통제하고 지하 상하수도 관로 일제 정밀 전수조사를 실시한다.",
        effects: {
          large: { budget: -25, population: +0.3, happiness: +10, result: "완벽한 안전 진단! 전철 지하 선로와 주변 관로를 꼼꼼히 점검하여 도로 지반을 단단히 보강했습니다." },
          medium: { budget: -15, population: +0.2, happiness: +12, result: "철저한 전수조사 완료! 땅속 위험 요소들을 미리 파악하여 정비함으로써 시민들이 안심하고 도로를 이용할 수 있게 되었습니다." },
          small: { budget: -8, population: +0.1, happiness: +10, result: "안전 예방 조치 안착! 침하 가능 도로를 전면 수리하여 통행 안전을 강화했습니다." }
        }
      },
      {
        text: "🚧 흙과 아스팔트로 싱크홀 구멍만 신속히 메우고 도로를 다시 개통한다.",
        effects: {
          large: { budget: -3, population: -0.2, happiness: -12, result: "땜질 처방의 비극! 며칠 뒤 옆 차로에서 또 미세 침하가 관찰되어 시민들의 불안감이 가중됩니다." },
          medium: { budget: -2, population: -0.2, happiness: -10, result: "불안한 도로 재개통! 당장 차는 다니지만 언제 또 무너질지 모른다는 도로 불안감에 주민들의 원성이 높습니다." },
          small: { budget: -1, population: -0.1, happiness: -8, result: "소도시는 부실 도로 방치로 결국 인근 농지와 연결로까지 균열이 가 통행 불편을 겪게 됩니다." }
        }
      }
    ]
  },
  {
    id: "e10",
    title: "🚨 구도심 전통시장 대형 화재 발생!",
    desc: "겨울철 낡은 전선 누전으로 인해 우리 지역 전통시장에 큰불이 나 점포 30여 곳이 잿더미가 되어 상인들의 비명이 가득합니다.",
    allowedCities: ["medium"],
    options: [
      {
        text: "💸 피해 상인 긴급 지원 및 현대식 소방 스프링클러 시설을 전면 설치한다.",
        effects: {
          large: { budget: -30, population: +0.5, happiness: +12, result: "시장의 기적적 재건! 대형 안전 시설 확충과 긴급 구호로 활기 넘치는 특화 전통시장으로 복원했습니다." },
          medium: { budget: -20, population: +0.4, happiness: +15, result: "전통시장 완벽 재건! 긴급 재난지원금과 최신 소방 인프라 구축 덕분에 시장이 다시 활기를 되찾고 시민들이 안심합니다." },
          small: { budget: -10, population: +0.2, happiness: +12, result: "소도시 시장 화재 진압 및 긴급 위로금 지급을 통해 주민 간의 따뜻한 상생을 이끌어 냈습니다." }
        }
      },
      {
        text: "🎪 천막으로 임시 시장만 가설해 주고 상인들 자체 생계를 유지하게 유도한다.",
        effects: {
          large: { budget: -4, population: -0.2, happiness: -18, result: "상인들의 집단 반발! 시청 정문 앞에서 보상과 제대로 된 대책을 요구하는 침묵 시위가 지속됩니다." },
          medium: { budget: -3, population: -0.1, happiness: -15, result: "상인들의 절망! 춥고 좁은 천막 시장에서 버티지 못한 많은 상인들과 가족들이 눈물을 흘리며 다른 대도시로 떠나갑니다." },
          small: { budget: -1, population: -0.1, happiness: -12, result: "고장 유일의 시장이 무력화되어 주민들의 장보기 쉼터가 마비되고 이웃 활력이 저하됩니다." }
        }
      }
    ]
  },
  {
    id: "e11",
    title: "🚨 인근 대도시로의 '소아과 원정 진료' 대란!",
    desc: "우리 시에 소아과 전문 병원이 너무 부족하여, 아이가 조금만 아파도 새벽부터 다른 대도시 종합병원으로 원정 진료를 가야 하는 부모들의 불만이 쏟아집니다.",
    allowedCities: ["medium"],
    options: [
      {
        text: "🏥 공공 심야 어린이병원을 지정하고 의사 채용 보조금을 지원한다.",
        effects: {
          large: { budget: -15, population: +0.6, happiness: +15, result: "어린이 병원 연계 확보! 안심 보육 소아센터 신설로 자녀가 있는 가구 유입 가속." },
          medium: { budget: -10, population: +0.5, happiness: +20, result: "소아 의료 인프라 완비! 이제 한밤중에도 안심하고 진료를 볼 수 있게 되어 아이 키우는 젊은 가족들의 만족도가 매우 높습니다." },
          small: { budget: -5, population: +0.4, happiness: +18, result: "소도시에 찾아온 희소식! 소아 전문 안심 순회 진료단 가동으로 안심 돌봄 체계 완비." }
        }
      },
      {
        text: "🕒 시 보건소 소아 진료 시간을 야간 1시간만 연장한다.",
        effects: {
          large: { budget: -1, population: -0.2, happiness: -12, result: "실효성 부족! 여전히 전문 응급 치료를 받기 어려워 대도시 대형 병원 원정길은 끊이지 않습니다." },
          medium: { budget: -0.5, population: -0.3, happiness: -15, result: "빛바랜 대책! 1시간 연장으로는 여전히 소아 전문의 치료를 받기 어려워 부모들의 불만이 지속되고 인구가 빠져나갑니다." },
          small: { budget: -0.2, population: -0.2, happiness: -10, result: "의료 혜택 공백이 깊어져 소아 환자가 있는 가정들의 지방 소멸 탈출 행렬이 가속됩니다." }
        }
      }
    ]
  },
  {
    id: "e12",
    title: "🚨 극심한 가뭄으로 농업용수 부족 위기!",
    desc: "몇 달째 비가 오지 않아 저수지가 완전히 바닥났습니다. 지역 특산물 농사와 주말 작물들이 전부 말라 죽을 위기입니다.",
    allowedCities: ["small"],
    options: [
      {
        text: "🚜 긴급 관정(지하수)을 파고 양수 장비 가동 유류비를 긴급 지원한다.",
        effects: {
          large: { budget: -20, population: +0.1, happiness: +8, result: "대도시 외곽 주말 농장 가뭄 극복! 자연 텃밭의 물길을 무사히 복구했습니다." },
          medium: { budget: -15, population: +0.1, happiness: +10, result: "가뭄 비상 대책 통과! 관내 배후 농가의 가뭄 피해를 최소화하는 정비 추진." },
          small: { budget: -10, population: +0.1, happiness: +15, result: "가뭄 위기 극복! 소도시의 소중한 1년 예산 중 큰 돈을 들였지만, 다행히 농업용수 공급 성공으로 사과 풍년의 뼈대를 지켜냅니다." }
        }
      },
      {
        text: "🌧️ 전통 급수 기우제를 개최하고 살수차 3대만 시범 운행한다.",
        effects: {
          large: { budget: -1, population: -0.1, happiness: -10, result: "급수 차량이 너무 적어 주말 정원과 외곽 텃밭들이 갈색으로 말라 죽어갑니다." },
          medium: { budget: -1, population: -0.2, happiness: -12, result: "농가 지원 지연으로 인해 재배 농작물의 질이 크게 떨어지고 불만이 제기됩니다." },
          small: { budget: -0.5, population: -0.05, happiness: -10, result: "기우제와 한계! 물이 부족해 사과 농사를 망친 상심에 일부 농민들이 고향을 포기하고 외지로 떠납니다." }
        }
      }
    ]
  },
  {
    id: "e13",
    title: "🚨 관내 유일한 고등학교 폐교 및 통합 위기!",
    desc: "아이가 없어 입학생이 급감하자 교육청에서 우리 지역 유일한 고등학교를 인접 중간도시 학교로 내년에 강제 통합하겠다고 예고했습니다.",
    allowedCities: ["small"],
    options: [
      {
        text: "🏫 기숙사비와 장학금 전액을 대고, 우리 고장만의 특성화 미래 전공을 유치한다.",
        effects: {
          large: { budget: -25, population: +0.1, happiness: +10, result: "학교 특성 보강 성공! 지역 특화 명문교 구축을 적극 장려합니다." },
          medium: { budget: -18, population: +0.2, happiness: +12, result: "기숙 지원 정책 연착륙! 인근 도시 인재들의 전입 장학금 기틀 완성." },
          small: { budget: -15, population: +0.3, happiness: +20, result: "고등학교 살리기 안착! 장학 지원 소문이 퍼지며 인근 지역에서도 학생들이 전학을 오고 명품 시골 학교로 대성공합니다." }
        }
      },
      {
        text: "🚌 통학 버스를 운영해 주기로 약속하고 폐교 결정을 받아들인다.",
        effects: {
          large: { budget: -3, population: -0.2, happiness: -15, result: "대도시 교육 인프라 폐지 충격! 먼 통학 거리에 학부모들이 우려를 나타냅니다." },
          medium: { budget: -2, population: -0.5, happiness: -18, result: "교육 수준 하락과 통학 지연 민원 발생으로 부모 정주도가 떨어집니다." },
          small: { budget: -2, population: -0.2, happiness: -20, result: "학교 붕괴로 인한 도시 소멸 가속! 고등학교가 사라지자 자녀 교육 때문에 학부모들이 가족 단위로 대거 전출하여 동네가 삭막해집니다." }
        }
      }
    ]
  },
  {
    id: "e14",
    title: "🚨 폭우 산사태로 시골 마을 도로 함몰 및 고립!",
    desc: "집중호우로 마을 뒷산 흙더미가 쓸려 내려와 어르신들이 모여 사는 시골 마을의 도로가 묻히고 전선이 끊겼습니다.",
    allowedCities: ["small"],
    options: [
      {
        text: "👷 중장비를 대거 투입해 진입로를 복구하고 산사태 방지벽 대대적 공사를 시행한다.",
        effects: {
          large: { budget: -15, population: 0, happiness: +10, result: "도로 축벽 안전 공사 완성! 집중호우 추가 재해 가능 구간을 완벽 봉쇄했습니다." },
          medium: { budget: -10, population: 0, happiness: +12, result: "산림 옹벽 보강 완료! 토사 붕괴로부터 신도시 배후 단지 도로를 사수했습니다." },
          small: { budget: -8, population: 0, happiness: +15, result: "철저한 복구와 안전 강화! 무너진 도로를 다시 깔고 방지벽을 단단히 세워 마을 주민들이 두 번 다시 고립될 위험을 방지했습니다." }
        }
      },
      {
        text: "🚧 흙더미만 임시로 쓸어내고 통행만 가능하게 대처한다.",
        effects: {
          large: { budget: -2, population: -0.1, happiness: -10, result: "임시 개방 불안! 절개지 낙석 위험이 잔존하여 통행 제한 조치가 잦아집니다." },
          medium: { budget: -1, population: -0.1, happiness: -10, result: "부실 정비 논란! 근본 원인을 해결 안 해 주민들의 행정 비판 목소리가 터져 나옵니다." },
          small: { budget: -1, population: -0.1, happiness: -12, result: "임시 개통의 불안! 안전 공사 없이 길만 뚫어놓아 비가 올 때마다 붕괴 공포에 떠는 어르신들의 시름이 깊어집니다." }
        }
      }
    ]
  },
  {
    id: "e15",
    title: "🚨 외지인의 쓰레기 무단 무단투기로 청정 계곡 오염!",
    desc: "주말마다 놀러 오는 관광객들이 쓰레기를 몰래 버리고 취사를 해 우리 고장의 자랑인 1급수 계곡이 쓰레기장으로 오염되고 있습니다.",
    allowedCities: ["small"],
    options: [
      {
        text: "🌲 마을 주민을 '환경 지킴이 감시단'으로 고용하고 안전 CCTV를 설치한다.",
        effects: {
          large: { budget: -5, population: +0.1, happiness: +10, result: "생태 하천 순찰대 가동! 대도시 하천 주변 오염원 단속 성황 및 고용 창출." },
          medium: { budget: -4, population: +0.1, happiness: +12, result: "환경 파수꾼 고용! 계곡 관리 인프라 강화로 깨끗하고 살기 좋은 에코 시티 구현." },
          small: { budget: -3, population: +0.1, happiness: +15, result: "일자리와 자연보호 일석이조! 마을 어르신들이 지키는 환경 감시단 덕분에 깨끗해진 계곡과 새로운 주민 소득이 생겼습니다." }
        }
      },
      {
        text: "📢 '계곡 쓰레기 무단 투기 금지' 현수막만 10개 눈에 띄게 걸어둔다.",
        effects: {
          large: { budget: -0.02, population: 0, happiness: -5, result: "관광객 무시! 현수막 아래로 여전히 쓰레기가 잔뜩 버려져 흉물이 되어버립니다." },
          medium: { budget: -0.01, population: 0, happiness: -5, result: "현수막 대처의 쓴맛! 악취가 심해져 행락철 계곡 상인과 인근 주민의 원성이 커집니다." },
          small: { budget: -0.01, population: 0, happiness: -5, result: "무용지물 현수막! 현수막이 무색하게 관광객들의 무단 투기가 지속되며 악취와 썩은 시냇물만 늘어납니다." }
        }
      }
    ]
  }
];

// 3. 화면 네비게이션 제어
function goToScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });
  
  const target = document.getElementById(screenId);
  target.classList.add("active");
  
  // 글로벌 헤더 유저 정보 가시성 제어
  const headerInfo = document.getElementById("header-user-info");
  if (screenId === "screen-login" || screenId === "screen-city-select") {
    headerInfo.style.display = "none";
  } else {
    headerInfo.style.display = "flex";
    document.getElementById("header-mayor-name").textContent = gameState.mayorName;
    document.getElementById("header-city-name").textContent = `${gameState.cityName} (${gameState.cityType === 'large' ? '대도시' : gameState.cityType === 'medium' ? '중간도시' : '소도시'})`;
  }
}

// 4. 초기 이벤트 핸들러 연동
document.addEventListener("DOMContentLoaded", () => {
  // 화면 1: 로그인 액션
  const btnRandomCity = document.getElementById("btn-random-city");
  const inputCityName = document.getElementById("input-city-name");
  const inputMayorName = document.getElementById("input-mayor-name");
  const btnToCitySelect = document.getElementById("btn-to-city-select");
  
  btnRandomCity.addEventListener("click", () => {
    const randomPref = randomCityPrefix[Math.floor(Math.random() * randomCityPrefix.length)];
    const randomSuff = randomCitySuffix[Math.floor(Math.random() * randomCitySuffix.length)];
    inputCityName.value = randomPref + randomSuff;
  });
  
  btnToCitySelect.addEventListener("click", async () => {
    const mayor = inputMayorName.value.trim();
    const city = inputCityName.value.trim();
    
    if (!mayor) {
      await customAlert("시장님의 이름을 입력해 주세요!", "warning");
      inputMayorName.focus();
      return;
    }
    if (!city) {
      await customAlert("다스릴 도시의 이름을 입력해 주세요!", "warning");
      inputCityName.focus();
      return;
    }
    
    gameState.mayorName = mayor;
    gameState.cityName = city;
    
    goToScreen("screen-city-select");
  });
  
  // 화면 2: 도시 규모 선택
  document.querySelectorAll(".btn-select-city").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const card = e.target.closest(".city-card");
      const cityType = card.getAttribute("data-city-type");
      
      initGame(cityType);
    });
  });

  // 화면 3: 정책 결재
  document.getElementById("btn-approve-policy").addEventListener("click", () => {
    approveSelectedPolicy();
  });

  // 화면 4: 뉴스 결과 창 닫기
  document.getElementById("btn-close-newspaper").addEventListener("click", () => {
    closeNewspaperAndProceed();
  });

  // 화면 5: 엔딩 리포트
  document.getElementById("btn-print-report").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("btn-submit-teacher").addEventListener("click", () => {
    submitToTeacher();
  });

  document.getElementById("btn-go-to-login").addEventListener("click", () => {
    // 폼 초기화
    document.getElementById("input-mayor-name").value = "";
    document.getElementById("input-city-name").value = "";
    
    // 에세이 폼도 초기화
    document.getElementById("essay-q1").value = "";
    document.getElementById("essay-q2").value = "";
    document.getElementById("essay-q3").value = "";
    
    // 버튼 상태 초기화
    const submitBtn = document.getElementById("btn-submit-teacher");
    submitBtn.disabled = false;
    submitBtn.className = "btn btn-success";
    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> 선생님께 제출하기 📤`;
    document.getElementById("btn-go-to-login").style.display = "none";
    
    goToScreen("screen-login");
  });

  // 교사용 대시보드 진입 링크 (로그인 화면으로 이동)
  document.getElementById("link-teacher-dashboard").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("input-admin-id").value = "";
    document.getElementById("input-admin-pw").value = "";
    goToScreen("screen-admin-login");
    document.getElementById("input-admin-id").focus();
  });

  // 관리자 로그인 버튼 이벤트
  document.getElementById("btn-admin-login").addEventListener("click", async () => {
    const adminId = document.getElementById("input-admin-id").value.trim();
    const adminPw = document.getElementById("input-admin-pw").value.trim();

    if (!adminId) {
      await customAlert("아이디를 입력해 주세요.", "warning");
      document.getElementById("input-admin-id").focus();
      return;
    }
    if (!adminPw) {
      await customAlert("비밀번호를 입력해 주세요.", "warning");
      document.getElementById("input-admin-pw").focus();
      return;
    }

    if (adminId === "admin" && adminPw === "admin1204") {
      // 입력값 초기화
      document.getElementById("input-admin-id").value = "";
      document.getElementById("input-admin-pw").value = "";
      
      goToScreen("screen-teacher");
      loadTeacherDashboardData();
    } else {
      await customAlert("아이디 또는 비밀번호가 올바르지 않습니다.", "warning");
      document.getElementById("input-admin-pw").value = "";
      document.getElementById("input-admin-pw").focus();
    }
  });

  // 관리자 로그인 화면에서 엔터키 입력 시 로그인 시도
  document.getElementById("input-admin-pw").addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      document.getElementById("btn-admin-login").click();
    }
  });
  document.getElementById("input-admin-id").addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      document.getElementById("input-admin-pw").focus();
    }
  });

  // 관리자 로그인 화면에서 돌아가기 버튼
  document.getElementById("btn-admin-back").addEventListener("click", () => {
    goToScreen("screen-login");
  });

  // 대시보드 새로고침
  document.getElementById("btn-refresh-dashboard").addEventListener("click", () => {
    loadTeacherDashboardData();
  });

  // 대시보드 나가기
  document.getElementById("btn-exit-teacher").addEventListener("click", () => {
    goToScreen("screen-login");
  });

  // 대시보드로 돌아가기 (조회 모드 종료)
  document.getElementById("btn-back-to-dashboard").addEventListener("click", () => {
    goToScreen("screen-teacher");
    // 버튼 다시 학생용으로 복원
    document.getElementById("btn-submit-teacher").style.display = "inline-flex";
    document.getElementById("btn-back-to-dashboard").style.display = "none";
  });
});

// 5. 게임 초기화
function initGame(cityType) {
  const config = CITY_CONFIGS[cityType];
  
  gameState.cityType = cityType;
  gameState.budget = config.budget;
  gameState.population = config.population;
  gameState.happiness = config.happiness;
  gameState.termYear = 1;
  gameState.phase = "policy1";
  gameState.decisions = [];
  gameState.executedPolicyIds = [];
  gameState.executedEventIds = []; // 이번 게임의 돌발 상황 이력 초기화
  gameState.activeEvents = []; // 미사용 처리 리셋
  
  // 그래프 기록 비우기 및 첫 데이터 삽입
  gameState.history.budget = [config.budget];
  gameState.history.population = [config.population];
  gameState.history.happiness = [config.happiness];
  
  // 대시보드 텍스트 할당
  document.getElementById("dash-mayor-name").textContent = `${gameState.mayorName} 시장님`;
  document.getElementById("dash-city-name").textContent = gameState.cityName;
  
  updateDashboard();
  renderPolicyList();
  goToScreen("screen-game");
}

// 6. 대시보드 화면 업데이트
function updateDashboard() {
  document.getElementById("dash-term-year").textContent = gameState.termYear;
  
  // 수치 업데이트
  document.getElementById("val-budget").textContent = `${gameState.budget}억 원`;
  document.getElementById("val-population").textContent = `${gameState.population.toFixed(1)}만 명`;
  document.getElementById("val-happiness").textContent = `${gameState.happiness}점`;
  
  // 게이지 프로그레스 바 조절
  const maxBudget = CITY_CONFIGS[gameState.cityType].budget * 1.5;
  const budgetPercentage = Math.max(0, Math.min(100, (gameState.budget / maxBudget) * 100));
  document.getElementById("bar-budget").style.width = `${budgetPercentage}%`;
  
  const maxPop = CITY_CONFIGS[gameState.cityType].population * 1.5;
  const popPercentage = Math.min(100, (gameState.population / maxPop) * 100);
  document.getElementById("bar-population").style.width = `${popPercentage}%`;
  
  document.getElementById("bar-happiness").style.width = `${gameState.happiness}%`;
  
  // 밀도 경고 배지 텍스트 조절
  const densityBadge = document.getElementById("badge-density");
  const densityDesc = document.getElementById("txt-density-desc");
  
  let currentDensityClass = "density-green";
  let currentDensityText = "🟢 한적함 (지상 쾌적)";
  let currentDensityDetail = "동네 밀도가 한적하여 살기 쾌적합니다.";
  
  if (gameState.cityType === 'large') {
    if (gameState.population >= 48.0) {
      currentDensityClass = "density-red";
      currentDensityText = "🔴 매우 복잡함 (북적북적)";
      currentDensityDetail = "대도시 과밀 패널티 작동: 매년 예산 -25억, 행복도 -6점 감소 중";
    } else {
      currentDensityClass = "density-yellow";
      currentDensityText = "🟡 적당함 (정비 안착)";
      currentDensityDetail = "붐비는 문제가 해소되어 도시가 점차 살기 편해집니다.";
    }
  } else if (gameState.cityType === 'medium') {
    if (gameState.population >= 28.0) {
      currentDensityClass = "density-yellow";
      currentDensityText = "🟡 적당함 (인구 유지)";
      currentDensityDetail = "인구가 더 떠나지 않게 지키세요! 매년 인구 -1.2만 패널티 작동";
    } else {
      currentDensityClass = "density-red";
      currentDensityText = "🔴 인구 부족 (유출 경고)";
      currentDensityDetail = "대도시로 인구가 너무 빠져나가요! 인프라 투자가 시급합니다.";
    }
  } else {
    // 소도시
    if (gameState.population >= 10.0) {
      currentDensityClass = "density-yellow";
      currentDensityText = "🟡 보통 (소생 조짐)";
      currentDensityDetail = "소멸 마을 딱지를 떼고 정착하려는 가구가 늘고 있습니다!";
    } else {
      currentDensityClass = "density-green";
      currentDensityText = "🟢 지방 소멸 위기 (인구 비상)";
      currentDensityDetail = "인구 부족 위기: 매년 인구 -0.9만, 행복도 -4점 감소 중";
    }
  }
  
  densityBadge.className = `density-status ${currentDensityClass}`;
  densityBadge.textContent = currentDensityText;
  densityDesc.textContent = currentDensityDetail;
}

// 7. 정책 카드 리스트 렌더링
function renderPolicyList() {
  const container = document.getElementById("policy-cards-container");
  container.innerHTML = "";
  
  // 서류 대기 화면 리셋
  document.getElementById("approval-empty-state").style.display = "flex";
  document.getElementById("approval-document").style.display = "none";
  gameState.selectedPolicyId = null;
  
  // 비서실 서류 도장 떼기
  const docStamp = document.getElementById("doc-approved-stamp");
  if (docStamp) docStamp.classList.remove("stamped");
  
  // 이미 집행(결재) 완료한 카드를 제외하고, 현재 도시 규모에 맞는 정책만 필터링하여 무작위 5가지 추출
  const availablePolicies = POLICIES.filter(p => {
    if (gameState.executedPolicyIds.includes(p.id)) return false;
    if (p.allowedCities && !p.allowedCities.includes(gameState.cityType)) return false;
    return true;
  });
  const shuffled = shuffleArray(availablePolicies);
  gameState.currentRoundPolicies = shuffled.slice(0, 5);
  
  // 항상 6번째 선택지로 "아무 정책도 실행하지 않기(건너뛰기)" 카드를 리스트에 추가
  gameState.currentRoundPolicies.push({
    id: "skip_policy",
    name: "🚫 아무 정책도 실행하지 않기 (건너뛰기)",
    desc: "이번 턴에는 시 예산을 아끼기 위해 어떤 정책도 실행하지 않고 그냥 넘어갑니다. (경고: 인구 감소 및 행복도 하락)",
    effects: {
      large: { budget: 0, population: -1.5, happiness: -15, news: "시정 공백 사태 발생! 대도시에서 아무런 정책도 결정되지 않아 시민들의 불만이 가득합니다." },
      medium: { budget: 0, population: -1.0, happiness: -12, news: "시정 보류! 중간도시 정책이 멈춰 선 사이 인구 유출과 행복도 하락이 가속화됩니다." },
      small: { budget: 0, population: -0.8, happiness: -10, news: "시정 멈춤! 소도시에 필요한 예산 투자가 지연되면서 소멸 위기가 가중됩니다." }
    }
  });
  
  gameState.currentRoundPolicies.forEach(policy => {
    const effect = policy.effects[gameState.cityType];
    const card = document.createElement("div");
    card.className = "policy-item card";
    card.setAttribute("data-policy-id", policy.id);
    
    const budgetVal = Math.abs(effect.budget);
    const budgetPrefix = effect.budget > 0 ? "예산 추가 +" : "예산 소모 💰 ";
    const budgetClass = effect.budget > 0 ? "text-pos" : "";
    
    card.innerHTML = `
      <div class="policy-item-title">
        <h4>${policy.name}</h4>
        <span class="policy-cost ${budgetClass}">${budgetPrefix}${budgetVal}억 원</span>
      </div>
      <p class="policy-item-desc">${policy.desc}</p>
    `;
    
    card.addEventListener("click", () => {
      selectPolicy(policy.id);
    });
    
    container.appendChild(card);
  });
}

function selectPolicy(policyId) {
  gameState.selectedPolicyId = policyId;
  
  // 선택 하이라이트
  document.querySelectorAll(".policy-item").forEach(card => {
    if (card.getAttribute("data-policy-id") === policyId) {
      card.classList.add("active-selection");
    } else {
      card.classList.remove("active-selection");
    }
  });
  
  // 비서실 서류 패널 기안서 세팅
  const policy = POLICIES.find(p => p.id === policyId) || gameState.currentRoundPolicies.find(p => p.id === policyId);
  const effect = policy.effects[gameState.cityType];
  
  document.getElementById("approval-empty-state").style.display = "none";
  const doc = document.getElementById("approval-document");
  doc.style.display = "flex";
  
  document.getElementById("doc-title").textContent = policy.name;
  document.getElementById("doc-desc").textContent = policy.desc;
  
  // 도장 떼기
  const docStamp = document.getElementById("doc-approved-stamp");
  if (docStamp) docStamp.classList.remove("stamped");
  
  // 예상 증감 표시
  formatImpactText("impact-budget", effect.budget, "억 원");
  formatImpactText("impact-population", effect.population, "만 명");
  formatImpactText("impact-happiness", effect.happiness, "점");
}

function formatImpactText(elementId, value, unit) {
  const el = document.getElementById(elementId);
  if (value > 0) {
    el.textContent = `+${value}${unit} 📈`;
    el.className = "text-pos";
  } else if (value < 0) {
    el.textContent = `${value}${unit} 📉`;
    el.className = "text-neg";
  } else {
    el.textContent = `변동 없음`;
    el.className = "text-neutral";
  }
}

// 8. 정책 최종 결재 실행 (비서실 기안서 도장 타격 연출 추가)
async function approveSelectedPolicy() {
  if (!gameState.selectedPolicyId || gameState.isApproving) return;
  
  const policy = POLICIES.find(p => p.id === gameState.selectedPolicyId) || gameState.currentRoundPolicies.find(p => p.id === gameState.selectedPolicyId);
  const effect = policy.effects[gameState.cityType];
  
  // 예산 가능 여부 확인
  const cost = Math.abs(effect.budget);
  if (gameState.budget < cost && effect.budget < 0 && policy.id !== "skip_policy") {
    // 이번 라운드 정책들의 최대 비용 (skip_policy 및 emergency_policy 제외)
    const activePolicies = gameState.currentRoundPolicies.filter(p => p.id !== "skip_policy" && p.id !== "emergency_policy");
    const maxCost = Math.max(...activePolicies.map(p => Math.abs(p.effects[gameState.cityType].budget)));
    
    // 예상 마이너스 잔고가 최대 비용(대출 한도)을 넘는지 체크
    const nextBudget = gameState.budget + effect.budget;
    if (nextBudget < -maxCost) {
      await customAlert(`대출 한도 초과! 은행에서 빌릴 수 있는 최대 누적 대출 금액은 이번 라운드 정책 최대 비용인 ${maxCost}억 원입니다.\n(현재 예산: ${gameState.budget}억 원, 선택 정책 비용: ${cost}억 원)`, "warning");
      return;
    }
    
    const wantLoan = await customConfirm(`시청 예산이 부족합니다! 은행에서 대출을 받아 마이너스 예산 상태로 정책을 강행하시겠습니까?\n\n- 부족한 금액(대출액): ${cost - gameState.budget}억 원\n- 경고: 마이너스 예산으로 임기가 끝날 경우 시장 평가 점수가 크게 감점됩니다.`, "warning");
    if (!wantLoan) {
      return;
    }
  }
  
  // 연타 방지 및 결재 버튼 비활성화 시각 피드백 적용
  gameState.isApproving = true;
  const btnApprove = document.getElementById("btn-approve-policy");
  if (btnApprove) {
    btnApprove.disabled = true;
    btnApprove.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 결재 진행 중...`;
  }
  
  // 1) 비서실 기안서 서류에 결재 완료 도장 찍기 연출!
  const docStamp = document.getElementById("doc-approved-stamp");
  const docSheet = document.getElementById("approval-document");
  
  if (docStamp) {
    docStamp.classList.add("stamped");
  }
  
  // 종이 문서가 살짝 쾅 흔들리는 연출 클래스 임시 추가
  if (docSheet) {
    docSheet.classList.add("shake-effect");
    setTimeout(() => {
      docSheet.classList.remove("shake-effect");
    }, 500);
  }
  
  // 실제 값 적용
  if (policy.id === "skip_policy") {
    gameState.budget = gameState.budget; // 변동 없음
  } else {
    gameState.budget = gameState.budget + effect.budget; // 대출 허용을 위해 Math.max(0) 제거
  }
  gameState.population = Math.max(0.1, parseFloat((gameState.population + effect.population).toFixed(1)));
  gameState.happiness = Math.min(100, Math.max(0, gameState.happiness + effect.happiness));
  
  // 집행된 정책 ID 기록 (단, 긴급 예산 조율은 중복 배제 제외)
  if (policy.id !== "emergency_policy") {
    gameState.executedPolicyIds.push(policy.id);
  }
  
  // 역사 기록 누적
  gameState.decisions.push({
    year: gameState.termYear,
    type: "policy",
    name: policy.name,
    effectDesc: `예산 ${effect.budget > 0 ? '+' : ''}${effect.budget}억, 인구 ${effect.population > 0 ? '+' : ''}${effect.population}만, 행복도 ${effect.happiness > 0 ? '+' : ''}${effect.happiness}점`
  });
  
  // 화면 지표 증감 수치 연출 효과
  showChangeIndicators(effect.budget, effect.population, effect.happiness);
  
  // 2) 도장이 찍히는 애니메이션을 플레이어가 충분히 만끽하도록 1.2초 후 신문 모달 팝업 렌더링
  setTimeout(() => {
    // 승인 도장 리셋
    const stamp = document.getElementById("approved-stamp");
    if (stamp) stamp.classList.remove("stamped");
    
    // 결재 잠금 및 버튼 상태 복구
    gameState.isApproving = false;
    if (btnApprove) {
      btnApprove.disabled = false;
      btnApprove.innerHTML = `정책 실행 결재하기 🖋️`;
    }
    
    showNewspaper(policy, effect);
  }, 1200);
}

// 9. 신문 결과 모달 팝업
function showNewspaper(policy, effect) {
  const modal = document.getElementById("modal-container");
  const paper = document.getElementById("modal-newspaper");
  const event = document.getElementById("modal-event");
  
  event.style.display = "none";
  paper.style.display = "flex";
  modal.style.display = "flex";
  
  // Newspaper parameters
  document.getElementById("news-term-year").textContent = gameState.termYear;
  document.getElementById("news-paper-logo").textContent = `📰 ${gameState.cityName} 신문`;
  document.getElementById("news-headline").textContent = `"${effect.news}"`;
  
  let pDesc = `우리 ${gameState.cityName} 시청은 이번에 주민들을 돕기 위해 『${policy.name}』 정책의 시행을 최종 결재하여 실행했습니다. `;
  if (effect.happiness > 0) {
    pDesc += `학부모와 주민 회의 대표들은 우리 마을의 환경과 정주 여건이 눈에 띄게 좋아질 것이라며 시장님의 선택에 감사를 표했습니다. `;
  } else {
    pDesc += `일부 주민들은 이번 사업을 진행하는 데 필요한 예산 지출이 생각보다 너무 크다며, 향후 시 예산을 아껴 써야 할 것이라 염려하기도 했습니다. `;
  }
  document.getElementById("news-article").textContent = pDesc + " 시장 비서실장은 '앞으로도 예산과 인구 변화를 꼼꼼히 살피며 모두가 살기 좋은 동네를 만들겠다'고 포부를 남겼습니다.";
  
  // 지표 갱신
  formatImpactText("news-change-budget", effect.budget, "억 원");
  formatImpactText("news-change-population", effect.population, "만 명");
  formatImpactText("news-change-happiness", effect.happiness, "점");
  
  // 도장 연출
  setTimeout(() => {
    const stamp = document.getElementById("approved-stamp");
    if (stamp) stamp.classList.add("stamped");
  }, 150);
  
  // 페이즈 버튼 글씨 분기
  const btnText = document.getElementById("news-btn-text");
  if (gameState.phase === "policy1") {
    btnText.textContent = "돌발 상황 확인하기";
  } else {
    btnText.textContent = gameState.termYear < 5 ? "다음 연차로 이동" : "임기 최종 결과 보러 가기";
  }
}

function showChangeIndicators(b, p, h) {
  const format = (v) => v > 0 ? `+${v}` : v === 0 ? '' : `${v}`;
  
  const bChange = document.getElementById("change-budget");
  bChange.textContent = format(b);
  bChange.className = `stat-change ${b > 0 ? 'text-pos' : b < 0 ? 'text-neg' : ''}`;
  
  const pChange = document.getElementById("change-population");
  pChange.textContent = format(p);
  pChange.className = `stat-change ${p > 0 ? 'text-pos' : p < 0 ? 'text-neg' : ''}`;
  
  const hChange = document.getElementById("change-happiness");
  hChange.textContent = format(h);
  hChange.className = `stat-change ${h > 0 ? 'text-pos' : h < 0 ? 'text-neg' : ''}`;
  
  setTimeout(() => {
    bChange.textContent = "";
    pChange.textContent = "";
    hChange.textContent = "";
  }, 3000);
}

function closeNewspaperAndProceed() {
  const modal = document.getElementById("modal-container");
  modal.style.display = "none";
  
  updateDashboard();
  
  if (gameState.phase === "policy1") {
    // 뉴스1 완료 -> 돌발상황으로
    gameState.phase = "event";
    triggerSurpriseEvent();
  } else if (gameState.phase === "policy2") {
    // 뉴스2 완료 -> 매년 세수 보너스 추가 (밸런싱 튜닝 버전)
    let taxIncome = 0;
    if (gameState.cityType === 'large') taxIncome = 50;
    else if (gameState.cityType === 'medium') taxIncome = 30;
    else taxIncome = 10; // 소도시 10억 정기 보너스
    
    gameState.budget += taxIncome;
    
    gameState.decisions.push({
      year: gameState.termYear,
      type: "income",
      name: `정기 세금 세입 확보 💰`,
      effectDesc: `매년 들어오는 시정 고유 수입으로 예산 +${taxIncome}억 원 확보`
    });
    
    // 년도별 패널티 적용 및 한 해 마감
    const config = CITY_CONFIGS[gameState.cityType];
    const penalty = config.applyAnnualPenalty(gameState);
    
    if (penalty.budget !== 0 || penalty.population !== 0 || penalty.happiness !== 0) {
      gameState.decisions.push({
        year: gameState.termYear,
        type: "penalty",
        name: penalty.desc,
        effectDesc: `예산 ${penalty.budget}억, 인구 ${penalty.population}만, 행복도 ${penalty.happiness}점`
      });
    }
    
    // 연말 히스토리 누적 (그래프 연동용)
    gameState.history.budget.push(gameState.budget);
    gameState.history.population.push(gameState.population);
    gameState.history.happiness.push(gameState.happiness);
    
    updateDashboard();
    
    if (gameState.termYear < 5) {
      gameState.termYear += 1;
      gameState.phase = "policy1";
      renderPolicyList();
      document.querySelector(".policy-indicator").textContent = "올해의 첫 번째 결재 정책 후보 (5개 중 1개 선택)";
    } else {
      // 5개년 종료 -> 엔딩 리포트
      finishGame();
    }
  }
}

// 10. 돌발 상황 발생 연출
function triggerSurpriseEvent() {
  // 현재 도시 규모에 적합한 돌발 이벤트 풀 필터링
  const allowedEvents = EVENTS.filter(e => !e.allowedCities || e.allowedCities.includes(gameState.cityType));
  
  // 아직 이번 게임 플레이에서 발생하지 않은 이벤트 목록만 추출
  let availableEvents = allowedEvents.filter(e => !gameState.executedEventIds.includes(e.id));
  
  // 만약 모든 이벤트를 다 소진했다면 (예: 5년 초과 긴급 플레이 등 대비), 이력 리셋하여 순환
  if (availableEvents.length === 0) {
    gameState.executedEventIds = [];
    availableEvents = allowedEvents;
  }
  
  // 남은 이벤트를 진정으로 무작위하게 셔플한 후 첫 번째 것을 선택
  const shuffled = shuffleArray(availableEvents);
  const currentEvent = shuffled[0];
  
  gameState.activeEvent = currentEvent;
  // 발생한 이벤트 목록에 ID 추가
  gameState.executedEventIds.push(currentEvent.id);
  
  const modal = document.getElementById("modal-container");
  const paper = document.getElementById("modal-newspaper");
  const eventCard = document.getElementById("modal-event");
  
  paper.style.display = "none";
  eventCard.style.display = "flex";
  modal.style.display = "flex";
  
  document.getElementById("event-title").textContent = currentEvent.title;
  document.getElementById("event-desc").textContent = currentEvent.desc;
  
  const optionsContainer = document.getElementById("event-options-container");
  optionsContainer.innerHTML = "";
  
  currentEvent.options.forEach((opt, idx) => {
    const effect = opt.effects[gameState.cityType];
    const btn = document.createElement("button");
    btn.className = "btn btn-block btn-secondary event-opt-btn";
    
    // 예산 소요 텍스트
    const costText = effect.budget < 0 ? ` [💰 예산 지출: ${Math.abs(effect.budget)}억 원]` : '';
    btn.innerHTML = `<i class="fa-solid fa-hand-point-right"></i> ${opt.text}${costText}`;
    
    btn.addEventListener("click", () => {
      resolveEvent(opt);
    });
    
    optionsContainer.appendChild(btn);
  });
}

async function resolveEvent(option) {
  const effect = option.effects[gameState.cityType];
  
  // 돌발상황은 예산 부족으로 게임 진행이 영구 중단되는 데드락을 방지하기 위해 
  // 예산이 마이너스 적자가 되더라도 진행을 허용합니다. (초등교육용 재정적자 시각 피드백 제공)
  const isDeficit = gameState.budget < Math.abs(effect.budget) && effect.budget < 0;
  
  // 변화치 적용 (예산은 적자 허용을 위해 Math.max(0) 제거)
  gameState.budget = gameState.budget + effect.budget;
  gameState.population = Math.max(0.1, parseFloat((gameState.population + effect.population).toFixed(1)));
  gameState.happiness = Math.min(100, Math.max(0, gameState.happiness + effect.happiness));
  
  // 역사 기록 저장
  gameState.decisions.push({
    year: gameState.termYear,
    type: "event",
    name: gameState.activeEvent.title,
    effectDesc: `[대처] ${option.text.substring(0, 30)}... (예산 ${effect.budget}억, 인구 ${effect.population}만, 행복도 ${effect.happiness}점)`
  });
  
  // 해결 결과 요약 피드백 구성
  let resultMsg = `[현장 행정 해결 보고]\n${effect.result}`;
  if (isDeficit) {
    resultMsg += `\n\n🚨 [재정 적자 경고]\n예산이 모자란 상황에서 무리하게 긴급 사업을 집행하여, 도시 재정이 적자 상태에 진입했습니다! (현재 예산: ${gameState.budget}억 원)\n\n앞으로 시 예산을 아끼고 세수 보너스를 확보해 회복해야 합니다.`;
  }
  
  await customAlert(resultMsg, isDeficit ? "warning" : "success");
  
  const modal = document.getElementById("modal-container");
  modal.style.display = "none";
  
  // 돌발 해결 -> 정책2 선택 페이즈로
  gameState.phase = "policy2";
  updateDashboard();
  renderPolicyList();
  
  document.querySelector(".policy-indicator").textContent = "올해의 두 번째 결재 정책 후보 (5개 중 1개 선택)";
}

// 11. 최종 시정 결과 엔딩 평가
function finishGame() {
  goToScreen("screen-ending");
  
  document.getElementById("end-city-name").textContent = gameState.cityName;
  document.getElementById("end-mayor-name").textContent = gameState.mayorName;
  
  const initConfig = CITY_CONFIGS[gameState.cityType];
  
  // 1) 지표 증감 계산 및 바인딩
  const popDiff = gameState.population - initConfig.population;
  const popChangeText = (popDiff >= 0 ? "시작 대비 +" : "시작 대비 ") + popDiff.toFixed(1) + "만 명";
  const popChangeEl = document.getElementById("final-pop-change");
  document.getElementById("final-pop-val").textContent = `${gameState.population.toFixed(1)}만 명`;
  popChangeEl.textContent = popChangeText;
  popChangeEl.className = `change-val ${popDiff >= 0 ? 'text-pos' : 'text-neg'}`;
  
  const happyDiff = gameState.happiness - initConfig.happiness;
  const happyChangeText = (happyDiff >= 0 ? "시작 대비 +" : "시작 대비 ") + happyDiff + "점";
  const happyChangeEl = document.getElementById("final-happy-change");
  document.getElementById("final-happy-val").textContent = `${gameState.happiness}점`;
  happyChangeEl.textContent = happyChangeText;
  happyChangeEl.className = `change-val ${happyDiff >= 0 ? 'text-pos' : 'text-neg'}`;
  
  const budgetDiff = gameState.budget - initConfig.budget;
  const budgetChangeText = (budgetDiff >= 0 ? "시작 대비 +" : "시작 대비 ") + budgetDiff + "억 원";
  const budgetChangeEl = document.getElementById("final-budget-change");
  const budgetValEl = document.getElementById("final-budget-val");
  
  budgetValEl.textContent = `${gameState.budget}억 원`;
  budgetChangeEl.textContent = budgetChangeText;
  budgetChangeEl.className = `change-val ${budgetDiff >= 0 ? 'text-pos' : 'text-neg'}`;
  
  // 예산 적자 시 붉은색 강조 처리
  if (gameState.budget < 0) {
    budgetValEl.className = "final-val text-neg";
  } else {
    budgetValEl.className = "final-val";
  }
  
  // 2) 종합 등급 및 분야별 세부 시정 평가 점수 산출
  const score = evaluateScore();
  renderTitleAndStars(score);
  
  document.getElementById("score-population").textContent = `${score.popScore}점`;
  document.getElementById("score-happiness").textContent = `${score.happyScore}점`;
  document.getElementById("score-budget").textContent = `${score.budgetScore}점`;
  
  document.getElementById("end-mayor-compliment").textContent = `"${score.compliment}"`;
  
  renderTimeline();
  renderEndingCharts();
}

function evaluateScore() {
  const initConfig = CITY_CONFIGS[gameState.cityType];
  
  // 1) 인구 관리 점수 산출 (난이도 상향 및 변별력 강화)
  let popScore = 100;
  if (gameState.cityType === 'large') {
    if (gameState.population <= 42.0) popScore = 100;
    else if (gameState.population >= 50.0) popScore = Math.max(30, 70 - Math.round((gameState.population - 50.0) * 8));
    else popScore = Math.round(70 + (50.0 - gameState.population) * 3.75);
  } else if (gameState.cityType === 'small') {
    if (gameState.population >= 12.0) popScore = 100;
    else if (gameState.population <= 8.0) popScore = Math.max(20, 70 - Math.round((8.0 - gameState.population) * 8));
    else popScore = Math.round(70 + (gameState.population - 8.0) * 7.5);
  } else {
    if (gameState.population >= 35.0) popScore = 100;
    else if (gameState.population <= 30.0) popScore = Math.max(30, 80 - Math.round((30.0 - gameState.population) * 5));
    else popScore = Math.round(80 + (gameState.population - 30.0) * 4);
  }
  
  // 2) 행복도 점수
  let happyScore = gameState.happiness;
  
  // 3) 예산 관리 점수 (투자를 안 하고 돈을 너무 불리거나 적자가 난 경우 패널티)
  let budgetScore = 0;
  if (gameState.budget < 0) {
    budgetScore = 30; // 재정 적자 상태
  } else {
    const budgetRatio = gameState.budget / initConfig.budget;
    if (budgetRatio >= 0.2 && budgetRatio <= 1.2) {
      budgetScore = Math.min(100, 80 + Math.round((gameState.budget / initConfig.budget) * 15));
    } else if (budgetRatio > 1.2) {
      // 짠돌이 시장 패널티 (지방 발전 투자를 게을리함)
      budgetScore = Math.max(65, 100 - Math.round((budgetRatio - 1.2) * 12));
    } else {
      // 예산 과다 지출
      budgetScore = Math.max(40, Math.round(budgetRatio * 300));
    }
  }
  
  // 평균 점수 산출
  const averageScore = Math.round((popScore + happyScore + budgetScore) / 3);
  
  // 4) 평균 점수 기반 등급 칭찬 매핑
  let title = "🍀 무난하게 시정을 이끈 수고한 시장";
  let stars = 3.0;
  let compliment = "주민들을 위해 5년 임기 동안 헌신하고, 기회비용을 고민하며 우리 도시를 훌륭하게 이끈 멋진 시장님!";
  
  if (gameState.cityType === "large") {
    if (averageScore >= 92) {
      title = "🏆 쾌적한 균형을 맞춘 영웅 시장 (붐비던 도시 해결!)";
      stars = 5.0;
      compliment = "교통 혼잡과 매연을 멋지게 해결하고 쾌적한 친환경 대도시를 만든 최고의 영웅 시장님!";
    } else if (averageScore >= 82) {
      title = "🌳 초록 환경을 가꾼 안심 수호 시장";
      stars = 4.0;
      compliment = "도심 곳곳에 숲과 푸른 하천을 조성하여 시민들의 건강과 행복을 안심하고 지켜낸 환경 파수꾼 시장님!";
    } else if (averageScore >= 70) {
      title = "🤝 대도시 지표를 평온히 관리한 실무형 시장";
      stars = 3.0;
      compliment = "교통 문제와 미세먼지라는 험난한 과밀 패널티 속에서도 무너지지 않고 예산을 잘 조율해 낸 시장님!";
    } else {
      title = "🚗 북적북적 복잡한 도시의 바쁜 시장";
      stars = 2.0;
      compliment = "대도시의 인구 과밀화와 재정적 문제를 해결하기에는 시정 투자와 예산 안배가 다소 아쉬웠습니다.";
    }
  } 
  else if (gameState.cityType === "medium") {
    if (averageScore >= 92) {
      title = "🏆 주민 행복과 웃음을 찾아준 명품 시장";
      stars = 5.0;
      compliment = "시민들의 작은 목소리에도 귀를 기울이며 이웃들에게 풍부한 복지와 감동적인 미소를 되찾아준 명품 복지 시장님!";
    } else if (averageScore >= 82) {
      title = "📈 도시에 활기를 가득 채운 보람찬 시장";
      stars = 4.0;
      compliment = "젊은 청년들과 일자리를 대거 유치하여 정체되어 가던 성장 도시에 힘찬 맥박과 활기를 불어넣은 에너지 시장님!";
    } else if (averageScore >= 70) {
      title = "🌟 적정 성장 기반을 다진 균형 시장";
      stars = 3.0;
      compliment = "자재 재해 복구 및 소아 전용 병원, 미래 학교 등 중간도시 안착을 위해 상생과 안심의 기초를 마련한 시장님!";
    } else {
      title = "🤝 인구 유출 극복에 버거웠던 시장";
      stars = 2.0;
      compliment = "대도시로의 주민 이사 유출과 일자리 정체를 막기 위한 인프라 개발 투자가 다소 늦어 아쉬움이 남습니다.";
    }
  } 
  else {
    // 소도시
    if (averageScore >= 92) {
      title = "🏆 사라질 위기의 소도시를 살려낸 기적의 전설 시장";
      stars = 5.0;
      compliment = "폐교와 고사 위기에 처해 있던 지방 소도시에 청년과 기부금을 불러 모아 기적처럼 부흥을 이끈 전설적인 시장님!";
    } else if (averageScore >= 82) {
      title = "🌱 작은 동네를 정겹고 크게 키운 부흥 시장";
      stars = 4.5;
      compliment = "이웃 도시와의 대중교통망을 잇고 아기자기한 이색 야시장을 열어 숨은 고장의 매력을 전국에 널리 알린 마케터 시장님!";
    } else if (averageScore >= 72) {
      title = "🥰 아름다운 자연과 마을을 지켜낸 힐링 시장";
      stars = 3.5;
      compliment = "소박한 산책로와 따뜻한 주거 커뮤니티 공간을 꾸며 주민들이 정답게 살아가도록 동고동락한 힐링 시장님!";
    } else if (averageScore >= 60) {
      title = "🤝 끝까지 주민들과 동고동락한 다정한 시장";
      stars = 2.5;
      compliment = "예산이 적자가 나고 인구 감소를 완벽히 저지하진 못했지만, 주민 상생과 마을 기초 복지를 위해 애쓴 시장님!";
    } else {
      title = "🏚️ 이주 가속화를 저지하려 분투했던 비운의 시장";
      stars = 1.5;
      compliment = "인구 소멸과 학교 폐교 위기라는 거대한 시골 소도시의 소멸 극복을 이끌기엔 정책적 균형과 예산 배분이 다소 한계에 부딪혔습니다.";
    }
  }
  
  // 마이너스 예산(적자)일 경우 시장 평가 점수 및 별점을 크게 감점하고 칭호를 빚더미 칭호로 변경
  if (gameState.budget < 0) {
    budgetScore = 0; // 예산 점수 최하점
    popScore = Math.max(0, popScore - 15); // 적자로 인한 인구 점수 감점
    happyScore = Math.max(0, happyScore - 15); // 적자로 인한 행복도 점수 감점
    
    title = "💸 빚더미에 앉은 적자 시장";
    stars = 1.0;
    compliment = "우리 도시의 재정 예산이 적자 상태(빚더미)로 임기가 끝났습니다. 무리한 은행 대출과 선심성 정책 지출로 인해 도시 재정이 크게 망가졌습니다! 다음에는 예산 한도 내에서 현명하게 시정을 이끌어 주세요.";
  }
  
  return { title, stars, compliment, popScore, happyScore, budgetScore };
}

function renderTitleAndStars(score) {
  document.getElementById("end-mayor-title").textContent = score.title;
  
  const starsContainer = document.getElementById("stars-container");
  starsContainer.innerHTML = "";
  
  const fullStars = Math.floor(score.stars);
  const halfStar = score.stars % 1 !== 0;
  
  for (let i = 0; i < 5; i++) {
    const star = document.createElement("i");
    if (i < fullStars) {
      star.className = "fa-solid fa-star";
    } else if (i === fullStars && halfStar) {
      star.className = "fa-solid fa-star-half-stroke";
    } else {
      star.className = "fa-regular fa-star";
    }
    starsContainer.appendChild(star);
  }
}

function renderTimeline() {
  const container = document.getElementById("timeline-container");
  container.innerHTML = "";
  
  gameState.decisions.forEach(item => {
    if (item.type === "penalty") return;
    
    const timelineItem = document.createElement("div");
    timelineItem.className = "timeline-item";
    
    const icon = item.type === "policy" ? "🖋️" : item.type === "event" ? "🚨" : "💰";
    const titleType = item.type === "policy" ? "올해의 정책 결재" : item.type === "event" ? "돌발 위기 극복" : "지방 세수 확보";
    
    timelineItem.innerHTML = `
      <div class="timeline-badge">${icon}</div>
      <div class="timeline-content">
        <span class="timeline-year">${item.year}년 차 - ${titleType}</span>
        <h4>${item.name}</h4>
        <p>${item.effectDesc}</p>
      </div>
    `;
    
    container.appendChild(timelineItem);
  });
}

// 12. Chart.js 연동 차트 렌더링
let charts = {};

function renderEndingCharts() {
  const years = ["초기", "1년 차", "2년 차", "3년 차", "4년 차", "5년 차"];
  
  if (charts.pop) charts.pop.destroy();
  if (charts.budget) charts.budget.destroy();
  if (charts.happy) charts.happy.destroy();
  
  const createChart = (canvasId, label, data, color, yLabel) => {
    const ctx = document.getElementById(canvasId).getContext("2d");
    return new Chart(ctx, {
      type: "line",
      data: {
        labels: years,
        datasets: [{
          label: label,
          data: data,
          borderColor: color,
          backgroundColor: color + "1a",
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            title: { display: true, text: yLabel, font: { weight: 'bold' } },
            ticks: { precision: 0 }
          }
        }
      }
    });
  };

  charts.pop = createChart("chart-population", "인구 변화", gameState.history.population, "#E74C3C", "인구 (만 명)");
  charts.budget = createChart("chart-budget", "예산 변화", gameState.history.budget, "#4A90E2", "예산 (억 원)");
  charts.happy = createChart("chart-happiness", "행복도 변화", gameState.history.happiness, "#2ECC71", "행복도 (점)");
}

// 13. 학습 포트폴리오 전송
async function submitToTeacher() {
  const q1 = document.getElementById("essay-q1").value.trim();
  const q2 = document.getElementById("essay-q2").value.trim();
  const q3 = document.getElementById("essay-q3").value.trim();
  
  if (!q1 || !q2 || !q3) {
    await customAlert("시정 마무리 생각 정리 질문 3가지를 모두 성실하게 채우고 제출해 주세요!", "warning");
    return;
  }
  
  const score = evaluateScore();
  const payload = {
    mayorName: gameState.mayorName,
    cityType: gameState.cityType === 'large' ? '대도시' : gameState.cityType === 'medium' ? '중간도시' : '소도시',
    cityName: gameState.cityName,
    finalBudget: gameState.budget,
    finalPopulation: parseFloat(gameState.population.toFixed(1)),
    finalHappiness: gameState.happiness,
    mayorTitle: score.title,
    stars: score.stars,
    popScore: score.popScore,
    happyScore: score.happyScore,
    budgetScore: score.budgetScore,
    compliment: score.compliment,
    essayQ1: q1,
    essayQ2: q2,
    essayQ3: q3,
    decisionsJson: JSON.stringify(gameState.decisions),
    historyJson: JSON.stringify(gameState.history)
  };
  
  const submitBtn = document.getElementById("btn-submit-teacher");
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 선생님 구글 스프레드시트로 전송 중...`;
  
  if (GAS_WEB_APP_URL === "YOUR_GAS_WEB_APP_URL_HERE" || !GAS_WEB_APP_URL) {
    // 임시 모드 (스프레드시트 URL 미설정 시)
    setTimeout(async () => {
      submitBtn.className = "btn btn-secondary";
      submitBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> 제출 완료!`;
      document.getElementById("btn-go-to-login").style.display = "inline-flex";
      await customAlert("축하합니다! 시정 결과 보고서와 서술형 답변이 로컬에 저장되었습니다.\n(참고: app.js 상단의 GAS_WEB_APP_URL에 구글 스프레드시트 GAS 앱 URL을 입력하면 실시간 전송이 가능해집니다.)", "success");
    }, 1500);
    return;
  }

  fetch(GAS_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors", // Preflight OPTIONS 요청 차단을 차단하기 위해 no-cors 지정
    headers: {
      "Content-Type": "text/plain" // Simple Request로 분류시켜 프리플라이트 요청 원천 방지
    },
    body: JSON.stringify(payload)
  })
  .then(async () => {
    // no-cors 특상상 응답 body는 읽을 수 없으나(opaque), 전송 자체는 성공적으로 도달함
    submitBtn.className = "btn btn-secondary";
    submitBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> 제출 완료!`;
    document.getElementById("btn-go-to-login").style.display = "inline-flex";
    await customAlert("축하합니다! 시정 결과 보고서와 서술형 답변이 선생님의 구글 스프레드시트에 성공적으로 제출되었습니다.", "success");
  })
  .catch(async err => {
    console.error("구글 스프레드시트 제출 오류:", err);
    await customAlert("선생님 구글 스프레드시트로 전송하는 중 오류가 발생했습니다. 네트워크 상태를 확인해 주세요.", "warning");
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> 선생님께 제출하기 📤`;
  });
}

// 14. 교사용 대시보드 제어 및 데이터 로드 로직
let teacherLoadedStudents = [];

function loadTeacherDashboardData() {
  const listContainer = document.getElementById("teacher-report-list");
  const countContainer = document.getElementById("teacher-report-count");
  
  listContainer.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-sub);">
        <i class="fa-solid fa-spinner fa-spin fa-lg"></i> 데이터를 불러오고 있습니다...
      </td>
    </tr>
  `;
  countContainer.textContent = "0";

  if (GAS_WEB_APP_URL === "YOUR_GAS_WEB_APP_URL_HERE" || !GAS_WEB_APP_URL) {
    listContainer.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 30px; color: var(--negative-color); font-weight: bold;">
          <i class="fa-solid fa-circle-xmark"></i> 구글 Apps Script 웹 앱 URL이 설정되지 않았습니다.<br>
          <span style="font-size: 0.95rem; font-weight: normal; color: var(--text-sub);">app.js 파일의 4라인 'GAS_WEB_APP_URL' 변수에 배포된 URL을 등록해 주세요.</span>
        </td>
      </tr>
    `;
    return;
  }

  fetch(GAS_WEB_APP_URL)
    .then(response => response.json())
    .then(data => {
      teacherLoadedStudents = data;
      countContainer.textContent = data.length;
      
      if (data.length === 0) {
        listContainer.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-sub);">
              제출된 학생 보고서가 아직 없습니다.
            </td>
          </tr>
        `;
        return;
      }

      listContainer.innerHTML = "";
      
      // 최신 제출 데이터가 위로 오도록 역순 렌더링
      for (let i = data.length - 1; i >= 0; i--) {
        const student = data[i];
        
        let dateStr = student.timestamp;
        try {
          const date = new Date(student.timestamp);
          dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        } catch(e) {}

        const tr = document.createElement("tr");
        const avgScore = Math.round((parseInt(student.popScore || 0) + parseInt(student.happyScore || 0) + parseInt(student.budgetScore || 0)) / 3);

        tr.innerHTML = `
          <td style="padding: 12px;">${dateStr}</td>
          <td style="padding: 12px; font-weight: bold; color: #1E3A8A;">${student.mayorName}</td>
          <td style="padding: 12px;">${student.cityName} (${student.cityType})</td>
          <td style="padding: 12px;">👥 ${parseFloat(student.finalPopulation || 0).toFixed(1)}만 | 🥰 ${student.finalHappiness}점 | 💰 ${student.finalBudget}억</td>
          <td style="padding: 12px; font-size: 0.9rem;">${student.mayorTitle}</td>
          <td style="padding: 12px; font-weight: bold; color: var(--primary-color);">${avgScore}점</td>
          <td style="padding: 12px; text-align: center; white-space: nowrap;">
            <button class="btn btn-secondary btn-view-report" data-index="${i}" style="padding: 6px 12px; font-size: 0.9rem; border-radius: var(--border-radius-sm);">
              <i class="fa-solid fa-file-magnifying-glass"></i> 조회
            </button>
            <button class="btn btn-delete-report" data-timestamp="${student.timestamp}" style="padding: 6px 12px; font-size: 0.9rem; border-radius: var(--border-radius-sm); background-color: var(--negative-color); color: white; margin-left: 4px;">
              <i class="fa-solid fa-trash"></i> 삭제
            </button>
          </td>
        `;
        
        listContainer.appendChild(tr);
      }

      // 조회 버튼 바인딩
      listContainer.querySelectorAll(".btn-view-report").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const idx = parseInt(e.currentTarget.getAttribute("data-index"));
          viewStudentReport(teacherLoadedStudents[idx]);
        });
      });

      // 삭제 버튼 바인딩
      listContainer.querySelectorAll(".btn-delete-report").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const timestamp = e.currentTarget.getAttribute("data-timestamp");
          const wantDelete = await customConfirm("정말로 이 학생의 시정 결과 보고서를 삭제하시겠습니까?\n구글 스프레드시트에서도 완전히 지워집니다.", "warning");
          if (wantDelete) {
            deleteStudentReport(timestamp);
          }
        });
      });
    })
    .catch(err => {
      console.error("데이터 조회 오류:", err);
      listContainer.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: var(--negative-color); font-weight: bold;">
            <i class="fa-solid fa-circle-xmark"></i> 데이터를 불러오는 중 오류가 발생했습니다.<br>
            <span style="font-size: 0.95rem; font-weight: normal; color: var(--text-sub);">CORS 웹 정책 또는 Apps Script 배포 설정(모든 사용자 접근 허용)을 재점검해 주세요.</span>
          </td>
        </tr>
      `;
    });
}

async function deleteStudentReport(timestamp) {
  if (GAS_WEB_APP_URL === "YOUR_GAS_WEB_APP_URL_HERE" || !GAS_WEB_APP_URL) {
    await customAlert("GAS 웹 앱 URL이 설정되지 않아 삭제할 수 없습니다.", "warning");
    return;
  }

  const listContainer = document.getElementById("teacher-report-list");
  listContainer.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-sub);">
        <i class="fa-solid fa-spinner fa-spin fa-lg"></i> 구글 스프레드시트에서 데이터를 삭제하는 중입니다...
      </td>
    </tr>
  `;

  fetch(GAS_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain"
    },
    body: JSON.stringify({ action: "delete", timestamp: timestamp })
  })
  .then(async () => {
    await customAlert("선택한 학생의 시정 보고서 기록이 구글 스프레드시트에서 완전히 삭제되었습니다.", "success");
    loadTeacherDashboardData(); // 삭제 후 대시보드 새로고침
  })
  .catch(async err => {
    console.error("삭제 요청 실패:", err);
    await customAlert("기록 삭제 중 오류가 발생했습니다. 네트워크 상태를 확인해 주세요.", "warning");
    loadTeacherDashboardData();
  });
}

function viewStudentReport(student) {
  // 1) gameState에 학생 데이터 로드
  gameState.mayorName = student.mayorName;
  gameState.cityName = student.cityName;
  gameState.cityType = student.cityType === '대도시' ? 'large' : student.cityType === '중간도시' ? 'medium' : 'small';
  gameState.budget = parseInt(student.finalBudget || 0);
  gameState.population = parseFloat(student.finalPopulation || 0);
  gameState.happiness = parseInt(student.finalHappiness || 0);
  
  try {
    gameState.decisions = JSON.parse(student.decisionsJson || "[]");
  } catch(e) {
    gameState.decisions = [];
  }
  
  try {
    gameState.history = JSON.parse(student.historyJson || "{}");
  } catch(e) {
    gameState.history = { budget: [], population: [], happiness: [] };
  }

  // 2) 엔딩 스크린 전환 및 렌더링
  goToScreen("screen-ending");
  
  // HTML 바인딩
  document.getElementById("end-city-name").textContent = gameState.cityName;
  document.getElementById("end-mayor-name").textContent = gameState.mayorName;
  
  const initConfig = CITY_CONFIGS[gameState.cityType];
  
  // 지표 비교
  const popDiff = gameState.population - initConfig.population;
  const popChangeText = (popDiff >= 0 ? "시작 대비 +" : "시작 대비 ") + popDiff.toFixed(1) + "만 명";
  const popChangeEl = document.getElementById("final-pop-change");
  document.getElementById("final-pop-val").textContent = `${gameState.population.toFixed(1)}만 명`;
  popChangeEl.textContent = popChangeText;
  popChangeEl.className = `change-val ${popDiff >= 0 ? 'text-pos' : 'text-neg'}`;
  
  const happyDiff = gameState.happiness - initConfig.happiness;
  const happyChangeText = (happyDiff >= 0 ? "시작 대비 +" : "시작 대비 ") + happyDiff + "점";
  const happyChangeEl = document.getElementById("final-happy-change");
  document.getElementById("final-happy-val").textContent = `${gameState.happiness}점`;
  happyChangeEl.textContent = happyChangeText;
  happyChangeEl.className = `change-val ${happyDiff >= 0 ? 'text-pos' : 'text-neg'}`;
  
  const budgetDiff = gameState.budget - initConfig.budget;
  const budgetChangeText = (budgetDiff >= 0 ? "시작 대비 +" : "시작 대비 ") + budgetDiff + "억 원";
  const budgetChangeEl = document.getElementById("final-budget-change");
  const budgetValEl = document.getElementById("final-budget-val");
  
  budgetValEl.textContent = `${gameState.budget}억 원`;
  budgetChangeEl.textContent = budgetChangeText;
  budgetChangeEl.className = `change-val ${budgetDiff >= 0 ? 'text-pos' : 'text-neg'}`;
  if (gameState.budget < 0) {
    budgetValEl.className = "final-val text-neg";
  } else {
    budgetValEl.className = "final-val";
  }

  // 등급 & 코멘트 렌더링
  document.getElementById("end-mayor-title").textContent = student.mayorTitle;
  document.getElementById("end-mayor-compliment").textContent = `"${student.compliment}"`;
  
  // 별점 렌더링
  const starsContainer = document.getElementById("stars-container");
  starsContainer.innerHTML = "";
  const stars = parseFloat(student.stars || 3.0);
  const fullStars = Math.floor(stars);
  const halfStar = stars % 1 !== 0;
  for (let i = 0; i < 5; i++) {
    const star = document.createElement("i");
    if (i < fullStars) {
      star.className = "fa-solid fa-star";
    } else if (i === fullStars && halfStar) {
      star.className = "fa-solid fa-star-half-stroke";
    } else {
      star.className = "fa-regular fa-star";
    }
    starsContainer.appendChild(star);
  }

  // 세부 점수 바인딩
  document.getElementById("score-population").textContent = `${student.popScore || 0}점`;
  document.getElementById("score-happiness").textContent = `${student.happyScore || 0}점`;
  document.getElementById("score-budget").textContent = `${student.budgetScore || 0}점`;

  // 질문 응답 값 채우기
  document.getElementById("essay-q1").value = student.essayQ1 || "";
  document.getElementById("essay-q2").value = student.essayQ2 || "";
  document.getElementById("essay-q3").value = student.essayQ3 || "";

  // 타임라인 & 차트 렌더링
  renderTimeline();
  renderEndingCharts();

  // 3) 조회 모드 버튼 활성화
  document.getElementById("btn-submit-teacher").style.display = "none";
  document.getElementById("btn-back-to-dashboard").style.display = "inline-flex";
}
