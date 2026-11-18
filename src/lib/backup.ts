import { store } from "../store";

/** 내 여행 기록 전체를 JSON 파일로 내려받기 (백업 창, 계정 메뉴에서 같이 씀) */
export async function downloadBackup() {
  const json = await store.exportJSON();
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `mytriplog-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
