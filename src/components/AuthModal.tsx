import { useEffect, useRef, useState, type ReactNode, type SubmitEvent } from "react";
import { store } from "../store";
import { authErrorText } from "../store/cloud";
import { LIMITS } from "../lib/limits";
import { toast } from "../lib/ui";
import { Button, Field, Modal, TextInput } from "./ui";

/**
 * login   로그인
 * signup  회원가입
 * sent    가입 인증 메일을 보냄 (메일함 확인 안내)
 * forgot  비밀번호 재설정 메일 요청
 * reset   재설정 메일의 링크로 들어와 새 비밀번호 정하기
 */
type Mode = "login" | "signup" | "sent" | "forgot" | "reset";

/** 비밀번호 최소 길이 (Supabase 기본값과 같음) */
const MIN_PW = 6;
const MISMATCH = "비밀번호가 일치하지 않습니다.";

const MailIcon = (
  <svg viewBox="0 0 16 16">
    <rect x="2" y="3.5" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="m2.5 4.5 5.5 4 5.5-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
const LockIcon = (
  <svg viewBox="0 0 16 16">
    <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/**
 * 로그인 / 회원가입 / 비밀번호 재설정 화면 (클라우드 모드). 첫 화면의 버튼으로 열고, 닫으면 첫 화면으로 돌아감.
 * 비밀번호 재설정 링크로 들어온 경우만 닫을 수 없음 (새 비밀번호를 정해야 해서).
 * 가입하면 인증 메일이 가고, 메일의 링크를 누르면 이 앱으로 돌아와 바로 로그인됨.
 */
export function AuthModal({
  show,
  recovery,
  initialMode = "login",
  onClose,
}: {
  show: boolean;
  recovery: boolean;
  /** 열 때 보여줄 탭 */
  initialMode?: "login" | "signup";
  onClose?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [nick, setNick] = useState("");
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const open = show || recovery;

  useEffect(() => {
    if (!open) return;
    // 재설정 링크로 들어왔으면 새 비밀번호 화면, 아니면 첫 화면에서 누른 버튼의 탭
    setMode(recovery ? "reset" : initialMode);
    setErr("");
    setInfo("");
    const t = setTimeout(() => emailRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, recovery, initialMode]);

  function go(m: Mode) {
    setMode(m);
    setErr("");
    setInfo("");
    setPw("");
    setPw2("");
    setAgree(false);
  }

  /** 버튼을 누르는 동안 스피너 + 오류를 한국어로 */
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setErr("");
    setInfo("");
    try {
      await task();
    } catch (ex) {
      setErr(authErrorText(ex));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const addr = email.trim();
    if (mode === "signup" || mode === "reset") {
      if (pw.length < MIN_PW) return setErr(`비밀번호는 ${MIN_PW}자 이상이어야 해요.`);
      if (pw !== pw2) return setErr(MISMATCH);
    }
    if (mode === "signup" && nick.trim().length < 2) return setErr("닉네임은 2자 이상이어야 해요.");
    if (mode === "signup" && !agree) return setErr("만 14세 이상 확인과 약관 동의에 체크해 주세요.");
    void run(async () => {
      if (mode === "login") {
        await store.signIn(addr, pw);
      } else if (mode === "signup") {
        const r = await store.signUp(addr, pw, nick.trim());
        if (r === "confirm") go("sent");
      } else if (mode === "forgot") {
        await store.sendPasswordReset(addr);
        setInfo("비밀번호를 다시 정하는 링크를 메일로 보냈어요. 메일함을 확인해 주세요.");
      } else if (mode === "reset") {
        await store.updatePassword(pw);
        toast("새 비밀번호로 바꿨어요");
      }
      setPw("");
      setPw2("");
    });
  }

  const resend = () =>
    run(async () => {
      await store.resendSignup(email.trim());
      setInfo("인증 메일을 다시 보냈어요.");
    });

  const titles: Record<Mode, string> = {
    login: "MyTripLog",
    signup: "MyTripLog",
    sent: "메일함을 확인해 주세요",
    forgot: "비밀번호 찾기",
    reset: "새 비밀번호 정하기",
  };

  let body: ReactNode;
  if (mode === "sent") {
    body = (
      <>
        <p className="auth-msg">
          <b>{email.trim()}</b>(으)로 인증 메일을 보냈어요.
          <br />
          메일의 <b>링크를 누르면</b> 가입이 끝나고 바로 시작할 수 있어요.
        </p>
        <p className="note">메일이 안 보이면 스팸함도 확인해 주세요.</p>
        <Messages err={err} info={info} />
        <Button block loading={busy} onClick={() => void resend()}>
          인증 메일 다시 보내기
        </Button>
        <p className="note auth-switch">
          인증을 마쳤나요?{" "}
          <button type="button" className="link-btn" onClick={() => go("login")}>
            로그인
          </button>
        </p>
      </>
    );
  } else {
    const signup = mode === "signup";
    const needEmail = mode !== "reset";
    const needPw = mode !== "forgot";
    const newPw = signup || mode === "reset";
    const submitLabel = { login: "로그인", signup: "가입하기", forgot: "재설정 메일 보내기", reset: "비밀번호 바꾸기" }[mode];
    const busyLabel = { login: "로그인 중…", signup: "가입하는 중…", forgot: "보내는 중…", reset: "바꾸는 중…" }[mode];
    body = (
      <>
        {(mode === "login" || signup) && (
          <div className="auth-tabs" role="tablist" aria-label="로그인 또는 회원가입">
            <button type="button" role="tab" aria-selected={!signup} className={!signup ? "on" : ""} onClick={() => go("login")}>
              로그인
            </button>
            <button type="button" role="tab" aria-selected={signup} className={signup ? "on" : ""} onClick={() => go("signup")}>
              회원가입
            </button>
          </div>
        )}
        {mode === "forgot" && <p className="note auth-lead">가입한 이메일을 넣으면 비밀번호를 재설정하는 링크를 보내드려요.</p>}
        <form onSubmit={submit} noValidate>
          {needEmail && (
            <Field label="이메일">
              <TextInput
                ref={emailRef}
                type="email"
                inputMode="email"
                autoComplete={signup ? "email" : "username"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                icon={MailIcon}
                invalid={!!err && !busy && mode !== "signup"}
              />
            </Field>
          )}
          {signup && (
            <Field label="닉네임" hint={`2~${LIMITS.nickname}자`}>
              <TextInput
                autoComplete="nickname"
                required
                maxLength={LIMITS.nickname}
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="예: 여행곰"
                invalid={err.includes("닉네임")}
              />
            </Field>
          )}
          {needPw && (
            <Field label={mode === "reset" ? "새 비밀번호" : "비밀번호"} hint={newPw ? `${MIN_PW}자 이상` : undefined}>
              <TextInput
                type="password"
                autoComplete={newPw ? "new-password" : "current-password"}
                required
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                icon={LockIcon}
                invalid={!!err && !busy && err.includes("비밀번호") && err !== MISMATCH}
              />
            </Field>
          )}
          {newPw && (
            <Field label="비밀번호 확인">
              <TextInput
                type="password"
                autoComplete="new-password"
                required
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                icon={LockIcon}
                invalid={err === MISMATCH}
              />
            </Field>
          )}
          {signup && (
            <label className="auth-agree">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                만 14세 이상이며,{" "}
                <a href="/terms" target="_blank" rel="noopener">
                  이용약관
                </a>
                과{" "}
                <a href="/privacy" target="_blank" rel="noopener">
                  개인정보 처리방침
                </a>
                에 동의합니다.
              </span>
            </label>
          )}
          <Messages err={err} info={info} />
          <Button
            variant="primary"
            type="submit"
            loading={busy}
            block
            disabled={(needEmail && !email.trim()) || (needPw && !pw)}
          >
            {busy ? busyLabel : submitLabel}
          </Button>
        </form>
        {mode === "login" && (
          <p className="note auth-switch">
            <button type="button" className="link-btn" onClick={() => go("forgot")}>
              비밀번호를 잊으셨나요?
            </button>
          </p>
        )}
        {(mode === "login" || signup) && (
          <p className="note auth-switch">
            {signup ? "이미 계정이 있나요? " : "아직 계정이 없나요? "}
            <button type="button" className="link-btn" onClick={() => go(signup ? "login" : "signup")}>
              {signup ? "로그인" : "회원가입"}
            </button>
          </p>
        )}
        {mode === "forgot" && (
          <p className="note auth-switch">
            <button type="button" className="link-btn" onClick={() => go("login")}>
              로그인으로 돌아가기
            </button>
          </p>
        )}
      </>
    );
  }

  return (
    <Modal show={open} title={titles[mode]} width={420} onClose={recovery ? undefined : onClose}>
      <div className="modal-b auth">{body}</div>
    </Modal>
  );
}

/** 오류(빨강) 또는 안내(초록) 한 줄 */
function Messages({ err, info }: { err: string; info: string }) {
  return (
    <div className={"form-error" + (info && !err ? " ok" : "")} role={err ? "alert" : "status"}>
      {err || info}
    </div>
  );
}
