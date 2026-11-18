import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { LIMITS } from "../lib/limits";
import { toast } from "../lib/ui";
import { store } from "../store";
import { authErrorText } from "../store/cloud";
import { Button, Field, Modal, TextInput } from "./ui";

/** 닉네임 바꾸기 (계정 메뉴에서 엶) */
export function NicknameModal({ show, current, onClose }: { show: boolean; current: string; onClose: () => void }) {
  const [nick, setNick] = useState(current);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!show) return;
    setNick(current);
    setErr("");
    const t = setTimeout(() => inputRef.current?.select(), 50);
    return () => clearTimeout(t);
  }, [show, current]);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = nick.trim();
    if (v.length < 2) return setErr("닉네임은 2자 이상이어야 해요.");
    if (v === current) return onClose();
    setBusy(true);
    setErr("");
    try {
      await store.updateNickname(v);
      toast("닉네임을 바꿨어요");
      onClose();
    } catch (ex) {
      setErr(authErrorText(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show={show} dialog title="닉네임" onClose={busy ? undefined : onClose}>
      <form className="modal-b" onSubmit={submit} noValidate>
        <Field label="닉네임" hint={`2~${LIMITS.nickname}자`}>
          <TextInput
            ref={inputRef}
            autoComplete="nickname"
            maxLength={LIMITS.nickname}
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            onClear={() => setNick("")}
            invalid={!!err}
          />
        </Field>
        <div className="form-error" role="alert">
          {err}
        </div>
        <div className="nick-actions">
          <Button onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button variant="primary" type="submit" loading={busy} disabled={!nick.trim()}>
            저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
