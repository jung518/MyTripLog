import type { ReactNode } from "react";
import { legalLink } from "../lib/router";

interface Props {
  onLogin: () => void;
  onSignup: () => void;
}

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 4v14M15 6v14" fill="none" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
    title: "지도에 색칠해요",
    text: "다녀온 나라는 갈수록 진하게, 머문 도시는 핀으로. 내 여행이 한 장의 세계 지도가 돼요.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="10.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8.8 10.5h6.4M12 7.3v6.4" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <path d="M9 17h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
    title: "여권처럼 쌓여요",
    text: "여행마다 사증 페이지 한 장과 입국 도장. 도시, 숙소, 경비, 그날의 메모까지 함께 남겨요.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 20h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <rect x="6" y="11" width="3" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="11" y="6" width="3" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="16" y="13" width="3" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
    title: "한눈에 돌아봐요",
    text: "몇 개국을 다녀왔는지, 어디에 얼마를 썼는지. 연도별·항목별 통계로 정리해 줘요.",
  },
];

/**
 * 첫 화면 (로그인하기 전, 클라우드 모드).
 * 앱 위를 덮는 전체 화면 층이라 뒤에서 세계 지도를 미리 불러 둠 → 로그인하면 지도가 바로 뜸.
 * 플랫 디자인 + 여권 장식(버건디 표지, 사증 카드, 입국 도장, 판독줄)
 */
export function Landing({ onLogin, onSignup }: Props) {
  return (
    <div className="landing">
      <div className="ld-bar">
        <img className="ld-logo" src="/logo-mark.png" alt="MyTripLog" width={48} height={48} />
        <span className="ld-name">MyTripLog</span>
        <div className="spacer" />
        <button type="button" className="btn ghost ld-login" onClick={onLogin}>
          로그인
        </button>
        <button type="button" className="btn primary" onClick={onSignup}>
          시작하기
        </button>
      </div>

      <section className="ld-hero">
        <div className="ld-hero-in">
          <div className="ld-copy">
            <div className="ld-kicker">TRAVEL · PASSPORT</div>
            <h1>나의 여행 지도</h1>
            <p>다녀온 나라와 도시, 숙소와 경비를 지도 위에 여권처럼 기록해요.</p>
            <div className="ld-cta">
              <button type="button" className="btn ld-btn-gold" onClick={onSignup}>
                시작하기
              </button>
              <button type="button" className="btn ld-btn-line" onClick={onLogin}>
                로그인
              </button>
            </div>
          </div>

          {/* 예시 사증 카드 (여행 기록 화면의 카드와 같은 모양) */}
          <div className="ld-visual" aria-hidden="true">
            <div className="tcard ld-card ld-card-back">
              <div className="cover">
                <span className="visa">VISA · 사증</span>
                <span className="days">8박 9일</span>
              </div>
              <span className="stamp">
                <small>ARRIVED</small>파리<small>24.06.01</small>
              </span>
              <div className="body">
                <h3>파리 신혼여행</h3>
                <div className="meta">2024.06.01 – 2024.06.09</div>
                <div className="meta">파리 → 니스</div>
              </div>
            </div>
            <div className="tcard ld-card">
              <div className="cover">
                <span className="visa">VISA · 사증</span>
                <span className="days">4박 5일</span>
              </div>
              <span className="stamp">
                <small>ARRIVED</small>오사카<small>25.03.10</small>
              </span>
              <div className="body">
                <h3>오사카 미식 여행</h3>
                <div className="meta">2025.03.10 – 2025.03.14</div>
                <div className="meta">오사카 → 교토</div>
                <div className="foot">
                  <b>1,530,000원</b>
                </div>
              </div>
              <div className="mrz">P&lt;392&lt;&lt;250310&lt;&lt;05D&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
            </div>
          </div>
        </div>
        <div className="ld-mrz" aria-hidden="true">
          P&lt;KOR&lt;&lt;MYTRIPLOG&lt;&lt;TRAVEL&lt;&lt;DIARY&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
        </div>
      </section>

      <section className="ld-features" aria-label="주요 기능">
        {FEATURES.map((f) => (
          <article className="ld-feature" key={f.title}>
            <span className="ld-ico">{f.icon}</span>
            <h2>{f.title}</h2>
            <p>{f.text}</p>
          </article>
        ))}
      </section>

      <section className="ld-end">
        <span className="ld-end-stamp" aria-hidden="true">
          <small>DEPARTURE</small>첫 도장<small>READY</small>
        </span>
        <h2>첫 여행 도장을 찍어 볼까요?</h2>
        <p className="note">지금까지 다녀온 여행부터 하나씩 옮겨 보세요.</p>
        <button type="button" className="btn primary ld-end-btn" onClick={onSignup}>
          시작하기
        </button>
      </section>

      <footer className="ld-foot">
        <a {...legalLink("terms")}>이용약관</a>
        <a {...legalLink("privacy")}>개인정보 처리방침</a>
        <span>© MyTripLog</span>
      </footer>
    </div>
  );
}
