# 🗺️ 나의 여행 지도

다녀온 나라와 도시를 지도에 표시하고, 여행 기간·호텔·경비·사진을 기록하는 개인용 여행 다이어리입니다.
빌드 과정이 없는 정적 사이트(HTML/CSS/JS)이고, 데이터는 **Supabase**(DB + 사진 저장소)에 저장해
휴대폰과 PC에서 같은 기록을 볼 수 있습니다. 배포는 **Vercel**.

로그인 화면은 없고, **기기마다 처음 한 번 비밀번호만** 입력하면 그다음부터는 바로 열립니다.
(사이트 주소를 아는 다른 사람이 기록을 보거나 지우지 못하게 하는 잠금입니다.)

## 폴더 구조

```
travel-map/
├── index.html              # 화면 구조 (지도 / 여행 기록 / 통계 + 모달 + 잠금 화면)
├── css/style.css           # 디자인
├── js/config.js            # ★ Supabase 주소, 공개 키, 내 계정 이메일 (직접 입력)
├── js/data.js              # 나라 한글명, 통화·환율, 경비 항목, 도시 목록
├── js/store-local.js       # 로컬 저장소 (IndexedDB) - config가 비어 있을 때
├── js/store-cloud.js       # 클라우드 저장소 (Supabase)
├── js/store.js             # 위 둘 중 하나를 고름
├── js/app.js               # 지도·목록·통계·편집 로직
├── data/countries.json     # 세계 지도 데이터 (Natural Earth 1:50m, world-atlas)
├── supabase/schema.sql     # ★ Supabase에서 한 번 실행할 테이블·보안 규칙
├── api/keepalive.js        # Supabase 무료 프로젝트 일시정지 방지 (Vercel Cron, 하루 1회)
├── vercel.json             # Vercel 설정 (Cron, 캐시)
├── .vscode/                # VS Code 권장 확장·설정
└── README.md
```

## 1. Supabase 준비 (처음 한 번, 약 10분)

1. https://supabase.com 가입 → **New project**
   - 이름: `travel-map`, Region: **Northeast Asia (Seoul)**, DB 비밀번호는 아무거나 저장해 두기
2. 왼쪽 **SQL Editor** → New query → `supabase/schema.sql` 내용을 전부 붙여 넣고 **Run**
   - 테이블 `trips`, `wishes`, 사진 버킷 `photos`, 보안 규칙이 만들어집니다.
3. 잠금용 계정 만들기: **Authentication → Users → Add user → Create new user**
   - 이메일 + 사이트를 열 때 쓸 **비밀번호** 입력, **Auto Confirm User** 체크
   - 이메일은 화면에서 묻지 않고 `config.js`에만 들어갑니다. 메일이 발송되지 않으니 평소 쓰는 이메일이면 됩니다.
4. 다른 사람이 가입하지 못하게: **Authentication → Sign In / Providers** 에서
   **Allow new users to sign up** 끄기 (사이트에는 원래 가입 버튼이 없지만 이중으로 막아 두기)
5. 키 복사: **Project Settings → API Keys** (또는 상단 **Connect** 버튼)
   - Project URL, **Publishable key**(또는 legacy **anon public** key)
6. `js/config.js`에 붙여 넣기

```js
window.TRAVEL_MAP_CONFIG = {
  supabaseUrl: "https://xxxxxxxx.supabase.co",
  supabaseKey: "sb_publishable_xxxxxxxx", // 또는 anon public 키
  ownerEmail: "me@example.com"           // 3번에서 만든 계정 이메일
};
```

> 이 키는 브라우저에 공개돼도 되는 키라 GitHub에 올려도 괜찮습니다.
> 데이터는 `schema.sql`의 RLS 규칙으로 **로그인한 본인만** 읽고 쓸 수 있습니다.
> **service_role / secret 키는 절대 넣지 마세요.**

`config.js`를 비워 두면 로컬 모드(브라우저에만 저장)로 동작합니다.

## 2. 로컬에서 실행 (VS Code)

폴더를 VS Code로 열면 오른쪽 아래에 **권장 확장 설치** 알림이 떠요(`.vscode/extensions.json`).

- **Live Server**: `index.html` 우클릭 → *Open with Live Server* → http://127.0.0.1:5500
- 또는 터미널에서 `npx serve .`

`index.html`을 더블클릭(`file://`)하면 지도가 안 뜹니다. 꼭 로컬 서버로 여세요.

## 3. Vercel 배포

1. GitHub에 private 저장소로 push
2. vercel.com → **Add New → Project** → 저장소 Import
3. Framework Preset **Other**, Build/Output/Install Command 모두 비움 → **Deploy**
4. (일시정지 방지) **Settings → Environment Variables** 에 추가 후 **Redeploy**
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_KEY` = Publishable(anon) 키
   - `vercel.json`의 Cron이 매일 한 번(UTC 03시 무렵) `/api/keepalive`를 호출해 Supabase에 가벼운 요청을 보냅니다.

## 데이터와 백업

- 여행 기록: Supabase `trips` / `wishes` 테이블 (`data` 칸에 JSON)
- 사진: Supabase Storage `photos` 버킷, `<내 사용자 ID>/<사진 ID>.jpg` (비공개, 24시간짜리 서명 주소로 표시)
- 무료 플랜은 **자동 백업이 없으니** 사이트의 *백업 / 복원 → 백업 파일 받기*로 월 1회 받아 두세요.
- 로컬 모드에서 받은 백업 파일도 Supabase 버전에서 그대로 *불러오기* 할 수 있습니다(사진 포함).
- 백업 파일(`travel-map-backup-*.json`)은 `.gitignore`로 GitHub에 올라가지 않습니다.

## 커스터마이징

- **도시 추가:** `js/data.js`의 `CITIES`에 `["도시명", 위도, 경도, "나라코드"]`
  (ISO 숫자 코드. 일본 `"392"`, 대만 `"158"`, 태국 `"764"`, 베트남 `"704"`, 홍콩 `"344"`)
- **나라 한글명:** `KO` / **기본 환율:** `RATE_HINT` / **경비 항목:** `CATS`, `CAT_COLORS`
- **색상:** `css/style.css` 맨 위 `:root`

## 문제 해결

| 증상 | 확인할 것 |
| --- | --- |
| 비밀번호 입력 후 “기록을 불러오지 못했어요” | `schema.sql`을 실행했는지, SQL Editor에 오류가 없었는지 |
| “비밀번호가 맞지 않아요” | `config.js`의 ownerEmail이 Users의 이메일과 같은지, Auto Confirm 했는지 |
| 비밀번호를 바꾸고 싶음 | Supabase → Authentication → Users → 내 계정 → 비밀번호 변경, 각 기기에서 🔒 잠그기 후 새 비밀번호 입력 |
| 사진 업로드 실패 | Storage에 `photos` 버킷이 있는지, `schema.sql`의 4)번 정책이 만들어졌는지 |
| 사이트가 한동안 안 열림 | Supabase 대시보드에서 프로젝트가 Paused인지 → Restore |
| 지도가 안 뜸 | F12 → Console에서 `countries.json` 또는 CDN 오류 |

## 사용 라이브러리

- [D3.js v7](https://d3js.org), [topojson-client](https://github.com/topojson/topojson-client), [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth, Public Domain)
- [supabase-js v2](https://supabase.com/docs/reference/javascript)
