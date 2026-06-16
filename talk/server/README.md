# 가족 문자 발송 백엔드 (Cloudflare Worker + Solapi)

또박또박 앱에서 어르신이 완성한 문장을 **가족 전원에게 문자(SMS/LMS)** 로 보내는 작은 서버입니다.
무료로 동작하는 Cloudflare Worker 위에서 돌아가고, 실제 문자는 한국 문자 발송사 **Solapi(솔라피)** 가 보냅니다.

> 왜 서버가 필요한가요? 문자 발송 API 키는 화면(앱)에 노출하면 안 되기 때문에, 키를 감춰서 대신 발송해 주는 중간 서버가 필요합니다.

## 준비물 체크리스트

1. **가족 휴대폰 번호** (받는 사람들)
2. **발신번호로 쓸 본인 휴대폰 번호** — Solapi에 **사전등록**해야 합니다(한국 법규상 등록 번호로만 발송 가능).
3. **Solapi 계정** → API Key / Secret, 그리고 약간의 충전(문자 건당 과금).
4. **Cloudflare 계정**(무료) — Worker 배포용.

## 1단계 — Solapi 설정

1. https://solapi.com 가입.
2. **발신번호 등록**: 콘솔 → 발신번호 관리 → 본인 번호 등록(ARS/서류 인증).
3. **API 키 발급**: 콘솔 → API Key 관리 → Key / Secret 복사.
4. **충전**: 잔액을 조금 채워둡니다. (참고 단가: 단문 SMS 약 20원, 장문 LMS 약 40~50원/건 — 받는 사람 수만큼 곱해집니다.)

## 2단계 — Worker 배포

```sh
npm install -g wrangler        # 처음 한 번
wrangler login                 # Cloudflare 로그인(브라우저)

cd talk/server
# wrangler.toml 에서 SENDER(발신번호) / RECIPIENTS(가족 번호들) 를 실제 값으로 수정

# 비밀값 등록 (입력하면 화면에 안 보이게 저장됨)
wrangler secret put SOLAPI_API_KEY
wrangler secret put SOLAPI_API_SECRET
wrangler secret put SHARED_SECRET      # (선택) 아무 암호나 — 앱 설정과 똑같이 맞추면 됨

wrangler deploy
```

배포가 끝나면 주소가 나옵니다: `https://family-sms.<your-account>.workers.dev`

## 3단계 — 앱에 연결

`talk/index.html` 위쪽 `CONFIG` 를 채웁니다:

```js
var CONFIG = {
  WORKER_URL: "https://family-sms.<your-account>.workers.dev/",
  SEND_PASSCODE: "위에서 정한 SHARED_SECRET 과 동일하게"   // SHARED_SECRET 안 썼으면 빈 칸
};
```

저장 후 페이지를 다시 열면, 문장을 완성했을 때 **"📨 가족에게 문자 보내기"** 초록 버튼이 나타납니다.

## 동작 흐름

```
어르신: 말하기 → "말 다 했어요" → 문장 완성
        → "가족에게 문자 보내기" 버튼
앱 → (POST) Worker → Solapi → 가족 전원에게 문자 도착
```

## 테스트

```sh
curl -X POST https://family-sms.<your-account>.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"text":"테스트입니다","passcode":"<SHARED_SECRET>"}'
# 성공 시: {"ok":true,"count":N,...}
```

## 보안 메모

- `SHARED_SECRET` 은 앱 화면 코드에 들어가므로 강력한 비밀은 아닙니다(가벼운 남용 방지용). 공개 링크 특성상 누군가 호출을 시도할 수 있으니, 가능하면:
  - `ALLOW_ORIGIN` 을 실제 페이지 주소로 좁히고,
  - 발송량이 걱정되면 Cloudflare의 Rate Limiting / Turnstile(캡차)을 추가하세요.
- API 키/시크릿은 **반드시 `wrangler secret`** 로만 넣고, `wrangler.toml`이나 코드에 적지 마세요.

## 다른 발송사를 쓰려면

알리고·NHN·네이버 SENS 등으로 바꾸려면 `worker.js` 의 Solapi 호출 부분(인증 헤더 + fetch URL/바디)만 해당 API 규격으로 교체하면 됩니다. 나머지(앱 연동·CORS·검증)는 그대로 재사용됩니다.
