import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FAQ_DATABASE,
  matchFAQ,
  isNonsenseMessage,
  FALLBACK_REPLY,
  NONSENSE_REPLY,
} from "../faq";

/**
 * Mô phỏng đúng thứ tự quyết định của webhook (tầng FAQ):
 *   nonsense → FAQ → fallback.
 */
function resolveReply(msg: string): { reply: string; faqId: string | null; nonsense: boolean } {
  const nonsense = isNonsenseMessage(msg);
  const matched = matchFAQ(msg);
  if (nonsense) return { reply: NONSENSE_REPLY, faqId: matched?.id ?? null, nonsense };
  if (matched) return { reply: matched.answer, faqId: matched.id, nonsense };
  return { reply: FALLBACK_REPLY, faqId: null, nonsense };
}

// ── Database shape ──────────────────────────────────────────────────────────
test("FAQ_DATABASE có đúng 30 entry, id duy nhất, mỗi entry có keyword + answer", () => {
  assert.equal(FAQ_DATABASE.length, 30);
  const ids = new Set(FAQ_DATABASE.map((e) => e.id));
  assert.equal(ids.size, 30, "id phải duy nhất");
  for (const e of FAQ_DATABASE) {
    assert.ok(e.keywords.length > 0, `${e.id} phải có keyword`);
    assert.ok(e.answer.trim().length > 0, `${e.id} phải có answer`);
  }
});

// ── 7 acceptance test cases ─────────────────────────────────────────────────
test("case 1: 'BodiX giá bao nhiêu?' → FAQ price", () => {
  const r = resolveReply("BodiX giá bao nhiêu?");
  assert.equal(r.faqId, "price");
  assert.match(r.reply, /499\.000đ/);
});

test("case 2: 'tap co giup giam can ko' (no diacritics) → FAQ weight_loss", () => {
  const r = resolveReply("tap co giup giam can ko");
  assert.equal(r.faqId, "weight_loss");
});

test("case 3: 'xin chào' → thanks hoặc fallback (ở đây: fallback)", () => {
  const r = resolveReply("xin chào");
  // 'xin chào' không chứa keyword thanks ('cảm ơn'...) → fallback.
  assert.ok(r.faqId === "thanks" || r.faqId === null);
  assert.equal(r.reply, FALLBACK_REPLY);
});

test("case 4: 'a' → NONSENSE_REPLY", () => {
  const r = resolveReply("a");
  assert.equal(r.nonsense, true);
  assert.equal(r.reply, NONSENSE_REPLY);
});

test("case 5: '😂😂😂' → NONSENSE_REPLY", () => {
  const r = resolveReply("😂😂😂");
  assert.equal(r.nonsense, true);
  assert.equal(r.reply, NONSENSE_REPLY);
});

test("case 6: 'tôi muốn hỏi về việc thanh toán bằng thẻ tín dụng' → FAQ payment_method", () => {
  const r = resolveReply("tôi muốn hỏi về việc thanh toán bằng thẻ tín dụng");
  assert.equal(r.faqId, "payment_method");
});

test("case 7: câu không match → FALLBACK_REPLY", () => {
  const r = resolveReply("trời hôm nay đẹp quá nhỉ");
  assert.equal(r.faqId, null);
  assert.equal(r.nonsense, false);
  assert.equal(r.reply, FALLBACK_REPLY);
});

// ── Thêm: tolerant matching + edge nonsense ─────────────────────────────────
test("diacritics-insensitive: 'GIẢM GIÁ' và 'giam gia' cùng match discount", () => {
  assert.equal(matchFAQ("cho mình hỏi GIẢM GIÁ")?.id, "discount");
  assert.equal(matchFAQ("co ma giam gia khong")?.id, "discount");
});

test("nonsense: ký tự lặp 'aaaaaa' và '......' và chuỗi rỗng", () => {
  assert.equal(isNonsenseMessage("aaaaaa"), true);
  assert.equal(isNonsenseMessage("......"), true);
  assert.equal(isNonsenseMessage("   "), true); // trim → '' length 0 < 2
});

test("không nonsense: câu hỏi bình thường", () => {
  assert.equal(isNonsenseMessage("BodiX giá bao nhiêu?"), false);
  assert.equal(isNonsenseMessage("tập ở đâu"), false);
});

test("'ok' không nonsense nhưng không match FAQ → fallback", () => {
  // 'ok' dài 2 ký tự, có chữ → không nonsense; không có keyword → fallback.
  const r = resolveReply("ok");
  assert.equal(r.nonsense, false);
  assert.equal(r.reply, FALLBACK_REPLY);
});
