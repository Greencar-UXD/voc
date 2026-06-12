# G car VOC 월별 추이 대시보드

로컬 단일 페이지 대시보드. **`index.html`을 더블클릭**하면 브라우저에서 열린다.
오프라인 `file://` 환경에서 동작하며 CDN·네트워크 의존이 없다 (Chart.js 로컬 포함, `fetch()` 미사용).
GitHub Pages로 배포하면 공유용 링크로도 제공된다 (아래 [배포](#배포-github-pages) 참조).

## 폴더 구조

```
voc-dashboard/
├── index.html          ← 대시보드 (data.js만 읽음, 로직과 데이터 완전 분리)
├── data.js             ← 모든 수치 (window.VOC_DATA) — 집계 수치만, 원문 금지
├── lib/chart.umd.js    ← Chart.js v4 로컬 사본 (CDN 금지, 오프라인 실행 보장)
├── rules/classification-rules.md  ← 분류 룰셋 (버전 2026-06-10)
├── rules/labeled-examples.md      ← 분류 골드 예시집 (학습 자산, 비식별)
├── rules/decision-log.md          ← 분류 결정 로그 + 일치율 추적 (학습 자산)
├── deploy.sh           ← GitHub Pages 배포/갱신 스크립트
└── README.md           ← 이 파일
```

## 갱신 절차 (새 기간 처리)

1. **새 기간 엑셀을 Claude에 전달** → `rules/classification-rules.md` 룰 + `rules/labeled-examples.md` 예시로 분류한다. 애매한 새 경계 케이스는 `rules/decision-log.md`에 기록하고, 노션 확정치와의 불일치 건수를 일치율 표에 남긴다(학습 누적).
2. **검증 확정 후** `data.js`의 해당 월 엔트리만 갱신한다.
3. **`index.html` 새로고침**으로 로컬 확인. 끝.
4. (배포 중인 경우) **commit → push**하면 공유 링크에 1~2분 내 자동 반영:
   ```sh
   git add data.js && git commit -m "data.js 갱신 YYYY-MM" && git push
   ```
   또는 `./deploy.sh` 한 번 실행 (커밋·푸시 자동 처리).

> ※ **노션 대시보드가 최종 기준(source of truth).** `data.js`는 노션 확정치의 사본이며, 충돌 시 노션을 따른다.

## 배포 (GitHub Pages)

### 최초 1회

```sh
~/.local/bin/gh auth login --web   # GitHub 로그인 (브라우저 인증)
./deploy.sh                        # 저장소 생성 → push → Pages 활성화 → 링크 출력
```

`deploy.sh`가 자동으로 처리하는 내용:
- git 사용자 설정(미설정 시 GitHub 계정 기준) 및 커밋
- GitHub에 `voc-dashboard` **public** 저장소 생성 후 push
  (무료 계정의 GitHub Pages는 public 저장소에서만 동작)
- GitHub Pages 활성화 — Branch: `main`, 폴더: `/ (root)`
- 공유용 링크 출력: `https://{계정명}.github.io/voc-dashboard/`

수동으로 할 경우: 저장소 push 후 GitHub의 **Settings → Pages → Branch: main, 폴더: / (root)** 선택.

### 이후 갱신

`data.js` 수정 → commit → push → 1~2분 내 자동 반영. (`./deploy.sh` 재실행으로도 가능)

## 배포 시 데이터 제약 (절대 규칙)

- **`data.js`에는 집계 수치만 포함한다.** VOC 원문, 차량모델, 차고지명 등
  **원본 후기 식별 가능 정보는 절대 포함하지 말 것.** 공개 저장소로 배포되는 전제이다.
- push 전 반드시 아래 체크리스트의 식별 정보 항목을 확인한다.

## data.js 갱신 시 수정 위치

| 항목 | 위치 | 비고 |
|---|---|---|
| 새 월 추가/수정 | `months` 배열 | `{ ym, total, regime, days, categories, unknown?, partial? }` |
| 누적 총계·분포 | `cumulative` | 노션 확정치로 통째로 교체 |
| 전수 구간 일수 | `fullRegime.days` | 일평균(= 전수 누적 ÷ 일수) 계산에 사용 |
| 부분 월 확정 | 해당 월의 `partial`/`partialLabel` 제거, `days`를 말일로 | 예: 2026-06이 월말 확정되면 `partial` 삭제, `days: 30` |
| 인사이트 갱신 | `insights` 배열 | 노션 확정 방향 변경 시에만 |

### 데이터 규칙 (위반 금지)

- **집계 수치만 포함** — VOC 원문·차량모델·차고지명 등 원본 후기 식별 가능 정보 금지 (공개 배포 전제).
- 노션 확정치에 없는 수치를 만들지 말 것 — 미상은 `unknown` 필드(화면에는 "기타(미상)")로.
- `regime`은 `past5`(과거 1년, 5개 유형만) / `excerpt`(OCR 발췌본) / `full`(전수 10개 카테고리) 중 하나.
- 시간 축은 오직 월 단위 — 일별·요일별·주차별 데이터를 넣지 않는다.
- 카테고리 표기는 "카테고리 N + 정식 분류명" 완전 표기 (줄임말 금지).

## 갱신 후 자체 검증 체크리스트

- [ ] `file://`로 열어 오프라인에서 차트가 뜨는가
- [ ] `months` 합산 = `cumulative.total` 검산 일치하는가
- [ ] regime 경계를 넘는 전월 대비 비교가 표·차트에 없는가
- [ ] 카테고리 줄임말이 화면에 0건인가
- [ ] 일별·요일별·주차별 차트가 없는가
- [ ] 발췌 월 미상분이 지어낸 수치 없이 "기타(미상)"으로 표기됐는가
- [ ] **`data.js`에 VOC 원문·차량모델·차고지명 등 식별 가능 정보가 없는가 (push 전 필수)**
