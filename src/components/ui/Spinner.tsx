/** 작은 회전 표시 (버튼 안, 목록 불러오기 등) */
export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span className="spinner" style={{ width: size, height: size }} role={label ? "status" : undefined} aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.5" opacity=".22" />
        <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/**
 * 전체 화면 로딩 (앱 시작, 기록 불러오기).
 * 로고 도장이 찍히듯 나타나고, 아래에 비행기가 점선을 따라 날아감.
 */
export function LoadingScreen({ show, message = "여행 기록을 펼치는 중이에요" }: { show: boolean; message?: string }) {
  return (
    <div className={"loading-screen" + (show ? " show" : "")} role="status" aria-live="polite" aria-hidden={!show}>
      <div className="loading-card">
        <img className="loading-logo" src="/logo-mark.png" alt="" width={140} height={140} />
        <div className="loading-route" aria-hidden="true">
          <span className="loading-plane">
            <svg viewBox="0 0 24 24">
              <path
                d="M21 15.5v-2l-8-5V3.8a1.3 1.3 0 0 0-2.6 0v4.7l-8 5v2l8-2.5v4.3L8.5 19v1.5l3.5-1 3.5 1V19l-1.9-1.7v-4.3z"
                fill="currentColor"
              />
            </svg>
          </span>
        </div>
        <p className="loading-msg">{message}</p>
      </div>
    </div>
  );
}
