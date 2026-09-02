/* Apex Layer — White Hat Parity Lock validation worker.
 *
 * Deploy: Cloudflare dashboard -> Workers -> create -> paste this file.
 * Route:  apexlayer.xyz/api/*  (zone must be proxied, which it is)
 * Secret: set env var TOKEN_SECRET (Settings -> Variables -> encrypt).
 *
 * Design contract (Gold Circuit Build Standards):
 * - Stateless request/response; no storage, no shared mutable state.
 * - All comparisons constant-time via the double-HMAC pattern.
 * - Every rule of every stage is public; answers are derivable from the
 *   published challenge parameters. Nothing here relies on obscurity —
 *   reading this source and deriving the answers IS a valid solve.
 * - Progress tokens are an HMAC chain over stage numbers, so the chain
 *   is recomputable server-side from the secret alone: self-contained,
 *   forgery-proof without the secret, no session store needed.
 * - Event classes: RARE_EVENT_GOLD_CIRCUIT is logged ONLY on verified
 *   stage-5 clearance in production. The operator pre-launch check
 *   (CONFIG_CONFIRMATION) lives exclusively in the build test harness
 *   and is never deployed here.
 */

const ANSWERS = {
  // Derivable from public parameters published on the challenge panel.
  1: "PHASELOCK-INIT-432",
  2: "22B7",
  3: "57f4b5f44a52759a",
  4: "3B761D",
  5: "411",
};
const FINAL_STAGE = 5;

const enc = new TextEncoder();

async function hmacHex(keyBytes, msg) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time equality: compare HMACs of both values under a random
// per-request key, so the comparison itself leaks no timing signal.
async function ctEqual(a, b) {
  const k = crypto.getRandomValues(new Uint8Array(32));
  const [ha, hb] = await Promise.all([hmacHex(k, a), hmacHex(k, b)]);
  return ha === hb;
}

async function chainToken(secret, stage) {
  // token_n = HMAC(secret, "apex-parity-chain:" + n), n >= 1
  let t = "genesis";
  for (let n = 1; n <= stage; n++) {
    t = await hmacHex(enc.encode(secret), "apex-parity-chain:" + n + ":" + t);
  }
  return t;
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/verify" || request.method !== "POST") {
      return json(404, { error: "no signal at this address" });
    }
    if (!env.TOKEN_SECRET) {
      return json(503, { error: "validation offline: TOKEN_SECRET unset" });
    }

    let body;
    try { body = await request.json(); } catch { return json(400, { error: "malformed" }); }
    const stage = Number(body.stage);
    const answer = String(body.answer ?? "").trim();
    const prev = String(body.prev ?? "");
    if (!Number.isInteger(stage) || stage < 1 || stage > FINAL_STAGE || answer.length > 128) {
      return json(400, { error: "malformed" });
    }

    // Stage n requires the authentic token for stage n-1.
    if (stage > 1) {
      const expectedPrev = await chainToken(env.TOKEN_SECRET, stage - 1);
      if (!(await ctEqual(prev, expectedPrev))) {
        return json(403, { ok: false, error: "chain break: prior stage not verified" });
      }
    }

    const normalized = stage === 3 ? answer.toLowerCase() : answer.toUpperCase();
    const expected = stage === 3 ? ANSWERS[3] : ANSWERS[stage];
    if (!(await ctEqual(normalized, expected))) {
      return json(200, { ok: false });
    }

    const token = await chainToken(env.TOKEN_SECRET, stage);
    if (stage === FINAL_STAGE) {
      console.log(JSON.stringify({
        event: "RARE_EVENT_GOLD_CIRCUIT",
        note: "verified stage-5 clearance",
        ts: new Date().toISOString(),
      }));
      return json(200, { ok: true, cleared: true, token });
    }
    return json(200, { ok: true, stage, token });
  },
};
