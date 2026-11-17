import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "../lib/ui";
import { store } from "../store";
import { Modal } from "./Modal";

interface Props {
  show: boolean;
  onClose: () => void;
}

export function BackupModal({ show, onClose }: Props) {
  const [withPhotos, setWithPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (show) setText(null);
  }, [show]);

  async function exportFile() {
    setBusy(true);
    try {
      const json = await store.exportJSON(withPhotos);
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
    const json = await store.exportJSON(false);
    setText(json);
    try {
      await navigator.clipboard.writeText(json);
      toast("복사했어요 (사진 제외)");
    } catch {
      setTimeout(() => taRef.current?.select(), 0);
      toast("아래 내용을 전체 선택해 복사하세요");
    }
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const n = await store.importJSON(await f.text());
      toast(`${n}개 여행을 복원했어요`);
      onClose();
    } catch (err) {
      console.error(err);
      toast("파일을 읽지 못했어요");
    }
  }

  return (
    <Modal show={show} title="백업 / 복원" onClose={onClose} width={560}>
      <div className="modal-b">
        <p className="note" style={{ marginTop: 0 }}>
          기록은 <b>이 브라우저</b>에 저장돼요. 브라우저 데이터를 지우거나 다른 기기에서 쓰려면 백업 파일을 받아
          두었다가 불러오세요.
        </p>
        <label className="note" style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
          <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} /> 사진도 포함
          (파일이 커질 수 있어요)
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={exportFile} disabled={busy}>
            백업 파일 받기
          </button>
          <button className="btn" onClick={copy}>
            JSON 복사
          </button>
          <label className="btn" style={{ cursor: "pointer" }}>
            백업 파일 불러오기
            <input type="file" accept=".json,application/json" hidden onChange={importFile} />
          </label>
        </div>
        {text !== null && (
          <textarea
            ref={taRef}
            readOnly
            value={text}
            style={{
              width: "100%",
              marginTop: 12,
              minHeight: 160,
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: 8,
              fontFamily: "monospace",
              fontSize: 12,
            }}
          />
        )}
      </div>
    </Modal>
  );
}
