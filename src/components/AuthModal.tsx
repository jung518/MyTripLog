import { useEffect, useRef, useState, type FormEvent } from "react";
import { CONFIG } from "../config";
import { store } from "../store";
import { Button, Field, Modal, TextInput } from "./ui";

/** 잠금 화면 (Supabase, 비밀번호만 입력). 닫을 수 없는 모달입니다. */
export function AuthModal({ show }: { show: boolean }) {
  const email = CONFIG.ownerEmail || "";
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!show) return;
    setErr(
      email ? "" : "src/config.ts에 ownerEmail(내 계정 이메일)을 넣어 주세요.",
    );
    const t = setTimeout(() => pwRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [show, email]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await store.signIn(email.trim(), pw);
      setPw("");
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : String(ex);
      setErr(
        /invalid/i.test(msg)
          ? "비밀번호가 일치하지 않아요."
          : "열지 못했어요: " + msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      show={show}
      title="나의 여행 지도"
      width={400}
      style={{ marginTop: "8vh" }}
    >
      <form className="modal-b" onSubmit={submit}>
        <p className="note" style={{ marginTop: 0 }}>
          처음 한 번만 비밀번호를 입력하면 이후에는 바로 열려요.
        </p>
        <input
          type="text"
          autoComplete="username"
          value={email}
          readOnly
          hidden
        />
        <Field label="비밀번호" style={{ marginBottom: 6 }}>
          <TextInput
            ref={pwRef}
            type="password"
            autoComplete="current-password"
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            invalid={!!err && !busy}
            icon={
              <svg viewBox="0 0 16 16">
                <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            }
          />
        </Field>
        <div className="form-error" role="alert">
          {err}
        </div>
        <Button variant="primary" type="submit" loading={busy} block style={{ marginTop: 6 }}>
          {busy ? "여는 중…" : "열기"}
        </Button>
      </form>
    </Modal>
  );
}
