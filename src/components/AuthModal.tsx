import { useEffect, useRef, useState, type FormEvent } from "react";
import { CONFIG } from "../config";
import { store } from "../store";
import { Modal } from "./Modal";

/** 잠금 화면 (Supabase, 비밀번호만 입력). 닫을 수 없는 모달입니다. */
export function AuthModal({ show }: { show: boolean }) {
  const email = CONFIG.ownerEmail || "";
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!show) return;
    setErr(email ? "" : "src/config.ts에 ownerEmail(내 계정 이메일)을 넣어 주세요.");
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
      setErr(/invalid/i.test(msg) ? "비밀번호가 맞지 않아요." : "열지 못했어요: " + msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show={show} title="🔒 나의 여행 지도" width={400} style={{ marginTop: "8vh" }}>
      <form className="modal-b" onSubmit={submit}>
        <p className="note" style={{ marginTop: 0 }}>
          이 기기에서 처음 한 번만 비밀번호를 입력하면, 다음부터는 바로 열려요.
        </p>
        <input type="text" autoComplete="username" value={email} readOnly hidden />
        <label className="f" style={{ marginBottom: 10 }}>
          비밀번호
          <input
            ref={pwRef}
            type="password"
            autoComplete="current-password"
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </label>
        <div className="note" style={{ color: "#b23a2a", minHeight: 20 }}>
          {err}
        </div>
        <button className="btn primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 6 }}>
          열기
        </button>
      </form>
    </Modal>
  );
}
