import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "../lib/ui";
import { store } from "../store";
import { Button, Modal, Spinner, TextArea } from "./ui";

interface Props {
  show: boolean;
  onClose: () => void;
}

export function BackupModal({ show, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (show) setText(null);
  }, [show]);

  async function exportFile() {
    setBusy(true);
    try {
      const json = await store.exportJSON();
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `travel-map-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("백업 파일을 저장했어요");
    } catch {
      toast("백업 파일을 만들지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const json = await store.exportJSON();
    setText(json);
    try {
      await navigator.clipboard.writeText(json);
      toast("복사했어요");
    } catch {
      setTimeout(() => taRef.current?.select(), 0);
      toast("아래 내용을 전체 선택해 복사하세요");
    }
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setImporting(true);
    try {
      const n = await store.importJSON(await f.text());
      toast(`${n}개 여행을 복원했어요`);
      onClose();
    } catch (err) {
      console.error(err);
      toast("파일을 읽지 못했어요");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal show={show} title="백업 / 복원" onClose={onClose} width={560}>
      <div className="modal-b">
        <p className="note" style={{ marginTop: 0 }}>
          {store.mode === "cloud" ? (
            <>
              기록은 <b>클라우드</b>에 저장돼요. 만일을 대비해 가끔 백업 파일을 받아 두세요.
            </>
          ) : (
            <>
              기록은 <b>이 브라우저</b>에 저장돼요. 브라우저 데이터를 지우거나 다른 기기에서 쓰려면 백업 파일을 받아
              두었다가 불러오세요.
            </>
          )}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="primary" onClick={exportFile} loading={busy}>
            백업 파일 받기
          </Button>
          <Button onClick={copy}>JSON 복사</Button>
          {/* 파일 고르기는 label 안의 숨은 input으로 열어서 버튼 모양만 같게 맞춤 */}
          <label className={"btn" + (importing ? " is-loading" : "")} style={{ cursor: "pointer" }} aria-busy={importing || undefined}>
            {importing && <Spinner size={14} />}
            백업 파일 불러오기
            <input type="file" accept=".json,application/json" hidden disabled={importing} onChange={importFile} />
          </label>
        </div>
        {text !== null && (
          <TextArea ref={taRef} readOnly value={text} className="code" aria-label="백업 JSON" />
        )}
      </div>
    </Modal>
  );
}
