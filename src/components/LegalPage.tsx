import type { ReactNode } from "react";
import { closeLegal, legalLink, type LegalDoc } from "../lib/router";

/* =========================================================
 * 이용약관 / 개인정보 처리방침
 * - 내용을 바꾸면 EFFECTIVE(시행일)도 같이 바꾸세요. 중요한 변경은 시행 7일 전에 알려야 해요.
 * - 법률 자문을 받은 문서가 아니라 개인 운영 서비스에 맞춘 초안입니다.
 * ========================================================= */
const SERVICE = "MyTripLog";
const OPERATOR = "MyTripLog 운영자";
const CONTACT = "mytriplog.help@gmail.com";
const EFFECTIVE = "2026년 11월 18일";

const Mail = () => <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

function Terms() {
  return (
    <>
      <h1>이용약관</h1>
      <p className="lg-date">시행일: {EFFECTIVE}</p>

      <h2>1. 서비스</h2>
      <p>
        {SERVICE}(이하 “서비스”)는 {OPERATOR}(이하 “운영자”)가 개인적으로 운영하는 무료 여행 기록 서비스예요. 다녀온
        여행을 지도와 통계로 정리해 줘요.
      </p>

      <h2>2. 가입과 계정</h2>
      <ul>
        <li>만 14세 이상만 가입할 수 있어요.</li>
        <li>비밀번호는 직접 관리해 주세요. 도용이 의심되면 바로 비밀번호를 바꿔 주세요.</li>
      </ul>

      <h2>3. 하지 말아야 할 일</h2>
      <p>
        자동 가입, 서비스에 과한 부하를 주는 행위, 다른 사람의 기록에 접근하려는 행위, 불법적인 내용 기록은 안 돼요. 어기면
        이용을 제한하거나 계정을 삭제할 수 있어요.
      </p>

      <h2>4. 내 기록</h2>
      <p>여행 기록의 권리는 이용자에게 있어요. 운영자는 서비스를 제공하는 데에만 쓰고 공개하지 않아요.</p>

      <h2>5. 서비스 변경·중단</h2>
      <p>
        기능은 바뀔 수 있고, 점검이나 장애로 잠시 멈출 수 있어요. 서비스를 끝낼 때는 30일 전에 알리고 그동안 기록을 내려받을
        수 있게 해요.
      </p>

      <h2>6. 탈퇴</h2>
      <p>
        계정 메뉴의 <b>회원 탈퇴</b>로 언제든 탈퇴할 수 있어요. 계정과 모든 기록이 바로 지워지고 되돌릴 수 없어요.
      </p>

      <h2>7. 책임</h2>
      <p>
        무료 서비스라서, 운영자의 고의나 중대한 과실이 없는 한 기록 손실 등으로 생긴 손해는 책임지지 않아요. 중요한 기록은{" "}
        <b>내 기록 내려받기</b>로 따로 보관해 주세요.
      </p>

      <h2>8. 약관 변경·문의</h2>
      <p>
        약관을 바꿀 때는 7일 전(불리한 변경은 30일 전)에 서비스 화면에 알려요. 문의는 <Mail />로 보내 주세요. 이 약관은
        대한민국 법을 따라요.
      </p>
    </>
  );
}

function Privacy() {
  return (
    <>
      <h1>개인정보 처리방침</h1>
      <p className="lg-date">시행일: {EFFECTIVE}</p>

      <h2>1. 수집하는 정보와 목적</h2>
      <ul>
        <li>
          <b>이메일, 비밀번호</b>(암호화 저장), <b>닉네임</b>: 가입, 로그인, 인증·비밀번호 재설정 메일, 화면 표시
        </li>
        <li>
          <b>여행 기록</b>(직접 입력한 제목, 기간, 동행, 메모, 도시·위치, 숙소, 경비, 가고 싶은 곳): 서비스 제공
        </li>
        <li>
          <b>접속 기록</b>(IP, 접속 시간, 브라우저 정보, 방문 화면): 보안, 장애 대응, 익명 방문 통계
        </li>
      </ul>

      <h2>2. 보관과 삭제</h2>
      <p>
        탈퇴할 때까지 보관하고, 탈퇴하면 계정과 기록을 바로 지워요(복구 불가). 접속 기록과 백업은 아래 업체의 정책에 따라
        일정 기간 뒤 자동 삭제돼요. 다른 사람에게 제공하지 않아요(법에 따른 요청은 예외).
      </p>

      <h2>3. 처리를 맡기는 업체 (국외 이전 포함)</h2>
      <table className="lg-table">
        <tbody>
          <tr>
            <th>업체</th>
            <th>하는 일</th>
            <th>위치</th>
          </tr>
          <tr>
            <td>Supabase</td>
            <td>계정·기록 저장, 로그인</td>
            <td>대한민국(서울)</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>웹사이트 제공, 익명 방문 통계 (접속 기록 전송)</td>
            <td>미국</td>
          </tr>
          <tr>
            <td>Brevo</td>
            <td>인증·재설정 메일 발송 (이메일 전송)</td>
            <td>프랑스</td>
          </tr>
        </tbody>
      </table>
      <p className="lg-note">
        미국·프랑스 업체로는 접속하거나 메일을 보낼 때 네트워크로 전송되며, 각 업체 정책에 따른 기간 동안 보관돼요. 이 전송
        없이는 서비스를 제공할 수 없어요.
      </p>

      <h2>4. 내 권리</h2>
      <p>
        내 기록은 계정 메뉴에서 <b>내려받기</b>(열람), 화면에서 <b>수정</b>, <b>회원 탈퇴</b>(삭제)로 직접 할 수 있어요. 그
        밖의 요청은 메일로 보내 주시면 본인 확인 후 10일 안에 처리해요.
      </p>

      <h2>5. 안전 조치와 쿠키</h2>
      <p>
        모든 통신은 암호화(HTTPS)되고, 비밀번호는 암호화해 저장하며, 각자 자기 기록에만 접근할 수 있어요. 광고·추적 쿠키는
        쓰지 않고, 로그인 유지 정보만 브라우저에 저장해요(로그아웃하면 삭제).
      </p>

      <h2>6. 만 14세 미만</h2>
      <p>만 14세 미만은 가입할 수 없어요.</p>

      <h2>7. 개인정보 보호책임자</h2>
      <p>
        {OPERATOR} · <Mail />
        <br />
        <span className="lg-note">
          개인정보침해신고센터(118, privacy.kisa.or.kr), 개인정보분쟁조정위원회(1833-6972, www.kopico.go.kr)에도 신고·상담할
          수 있어요.
        </span>
      </p>

      <h2>8. 변경</h2>
      <p>이 방침을 바꿀 때는 7일 전에 서비스 화면에 알려요.</p>
    </>
  );
}

const DOCS: Record<LegalDoc, () => ReactNode> = {
  terms: Terms,
  privacy: Privacy,
};

/** 약관 페이지 (로그인 여부와 상관없이 /terms, /privacy 주소로 열림) */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const Doc = DOCS[doc];
  return (
    <div className="legal">
      <div className="ld-bar">
        <img
          className="ld-logo"
          src="/logo-mark.png"
          alt="MyTripLog"
          width={48}
          height={48}
        />
        <span className="ld-name">MyTripLog</span>
        <div className="spacer" />
        <button
          type="button"
          className="btn ghost lg-back"
          onClick={closeLegal}
        >
          ← 돌아가기
        </button>
      </div>
      <article className="lg-body">
        {/* nav 태그는 휴대폰에서 하단 탭 바 스타일이 붙어서 div 사용 */}
        <div className="lg-tabs" role="navigation" aria-label="약관">
          <a
            {...legalLink("terms", true)}
            className={doc === "terms" ? "on" : undefined}
          >
            이용약관
          </a>
          <a
            {...legalLink("privacy", true)}
            className={doc === "privacy" ? "on" : undefined}
          >
            개인정보 처리방침
          </a>
        </div>
        <Doc />
      </article>
    </div>
  );
}
