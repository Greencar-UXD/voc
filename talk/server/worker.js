/**
 * 가족 문자 발송 백엔드 — Cloudflare Worker (문자 발송사: Solapi)
 * ------------------------------------------------------------------
 * 또박또박 앱에서 보낸 문장을 받아, 미리 등록한 가족 번호 전체에 문자(SMS/LMS)를 보냅니다.
 *
 * 필요한 환경변수
 *   비밀값 (wrangler secret put 으로 등록 — 코드/설정에 적지 말 것):
 *     SOLAPI_API_KEY      Solapi API 키
 *     SOLAPI_API_SECRET   Solapi API 시크릿
 *     SHARED_SECRET       (선택) 앱과 맞추는 간단 암호. 설정하면 이 값이 맞아야 발송됨(남용 방지).
 *   일반 설정 (wrangler.toml [vars]):
 *     SENDER              발신번호 (Solapi에 사전등록한 본인 휴대폰 번호, 예: 01012345678)
 *     RECIPIENTS          받는 가족 번호들, 쉼표로 구분 (예: 01011112222,01033334444)
 *     PREFIX              (선택) 문자 앞에 붙는 머리말. 기본 "[가족 음성메시지]\n"
 *     ALLOW_ORIGIN        (선택) CORS 허용 출처. 기본 "*". 배포 후 페이지 주소로 좁히면 더 안전.
 */

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "POST 요청만 됩니다." }, 405, cors);

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "요청 형식이 잘못됐어요." }, 400, cors);
    }

    const text = (body && body.text ? String(body.text) : "").trim();
    if (!text) return json({ error: "보낼 내용이 없어요." }, 400, cors);
    if (text.length > 1000) return json({ error: "내용이 너무 깁니다." }, 400, cors);

    // 남용 방지용 간단 암호 (설정한 경우에만 검사)
    if (env.SHARED_SECRET && body.passcode !== env.SHARED_SECRET) {
      return json({ error: "보낼 권한이 없어요." }, 403, cors);
    }

    if (!env.SOLAPI_API_KEY || !env.SOLAPI_API_SECRET || !env.SENDER) {
      return json({ error: "서버 설정이 끝나지 않았어요(키/발신번호)." }, 500, cors);
    }

    const recipients = String(env.RECIPIENTS || "")
      .split(",").map((s) => s.replace(/[^0-9]/g, "")).filter(Boolean);
    if (!recipients.length) return json({ error: "받는 번호가 설정되지 않았어요." }, 500, cors);

    const prefix = env.PREFIX != null ? env.PREFIX : "[가족 음성메시지]\n";
    const fullText = prefix + text;
    const messages = recipients.map((to) => ({ to, from: String(env.SENDER), text: fullText }));

    // Solapi 인증 헤더 (HMAC-SHA256)
    const date = new Date().toISOString();
    const salt = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "x" + Math.random()).replace(/-/g, "");
    const signature = await hmacSha256Hex(env.SOLAPI_API_SECRET, date + salt);
    const auth = `HMAC-SHA256 apiKey=${env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;

    let resp, data;
    try {
      resp = await fetch("https://api.solapi.com/messages/v4/send-many/detail", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      data = await resp.json().catch(() => ({}));
    } catch (e) {
      return json({ error: "문자 서버에 연결하지 못했어요." }, 502, cors);
    }

    if (!resp.ok) {
      return json({ error: "문자 발송 실패", detail: data }, 502, cors);
    }

    return json({ ok: true, count: messages.length, result: data.groupInfo || data }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors || {}),
  });
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
