import assert from "node:assert/strict";
import {
  buildTaskSubmissionPayload,
  normalizeTaskSubmissionAnswers,
  submitTaskAnswers,
} from "./task-answer-worker.mjs";

const chosenAnswers = {
  "101": {
    question_id: "101",
    question_type: "fill-words",
    answer: { 1: "b", 0: "a" },
  },
  "102": {
    question_id: "102",
    question_type: "single",
    value: { option_a: false, option_b: true },
  },
};
const originalAnswers = structuredClone(chosenAnswers);

const normalized = normalizeTaskSubmissionAnswers(chosenAnswers);
assert.deepEqual(normalized["101"].answer, ["a", "b"]);
assert.deepEqual(normalized["102"].answer, { option_a: false, option_b: true });
const normalizedFillArray = normalizeTaskSubmissionAnswers({
  "106": { question_id: "106", question_type: "fill-words", answer: ["A eclosão", "A formação"] },
});
assert.deepEqual(normalizedFillArray["106"].answer, ["A eclosão", "A formação"]);
const normalizedFillObject = normalizeTaskSubmissionAnswers({
  "107": { question_id: "107", question_type: "fill-words", answer: { 1: "segundo", 0: "primeiro" } },
});
assert.deepEqual(normalizedFillObject["107"].answer, ["primeiro", "segundo"]);
const normalizedWordOrderObject = normalizeTaskSubmissionAnswers({
  "495918343": {
    question_id: "495918343",
    question_type: "word_order",
    answer: {
      0: "Os",
      1: "elites",
      2: "concentraram",
      3: "o",
      4: "poder",
      5: "econômico",
      6: "nas",
      7: "monopólios",
    },
  },
});
assert.deepEqual(normalizedWordOrderObject["495918343"].answer, [
  "Os", "elites", "concentraram", "o", "poder", "econômico", "nas", "monopólios",
]);
const normalizedTextAndLetters = normalizeTaskSubmissionAnswers({
  "104": { question_id: "104", question_type: "fill-letters", answer: "SP" },
  "105": { question_id: "105", question_type: "text", answer: "Resposta aberta" },
});
assert.deepEqual(normalizedTextAndLetters["104"].answer, ["S", "P"]);
assert.deepEqual(normalizedTextAndLetters["105"].answer, { "0": "Resposta aberta" });
const normalizedTextAi = normalizeTaskSubmissionAnswers({
  "108": { question_id: "108", question_type: "text-ai", answer: { "Resposta discursiva": true } },
});
assert.equal(normalizedTextAi["108"].question_type, "text");
assert.deepEqual(normalizedTextAi["108"].answer, { "0": "Resposta discursiva" });
assert.ok(Object.values({ ...normalized, ...normalizedTextAndLetters, ...normalizedTextAi }).every((item) => item.answer));
const normalizedMulti = normalizeTaskSubmissionAnswers({
  "103": { question_id: "103", question_type: "multi", answer: ["0", "2"] },
});
assert.deepEqual(normalizedMulti["103"].answer, { "0": true, "2": true });
assert.equal(normalized["101"].question_id, 101);
assert.equal(normalized["102"].question_type, "single");
assert.equal(normalized["102"].question_invalid, false);
assert.deepEqual(chosenAnswers, originalAnswers, "normalização não altera as respostas originais");

const payload = buildTaskSubmissionPayload({
  taskId: "9876",
  studentId: "1234",
  studentNick: "aluno-teste",
  answers: chosenAnswers,
  durationSeconds: 87,
});
assert.deepEqual(Object.keys(payload), [
  "id", "nick", "status", "task_id", "answers", "accessed_on", "executed_on", "duration",
  "revised_request_count", "task_published", "task_expired",
  "enable_display_answers", "result_score",
]);
assert.equal(payload.status, "submitted");
assert.equal(payload.task_id, 9876);
assert.equal(payload.accessed_on, "room");
assert.equal(payload.executed_on, "");
assert.equal(payload.duration, "87");
assert.equal(payload.result_score, 0);

const essayPayload = buildTaskSubmissionPayload({
  taskId: "101785299",
  studentId: "1234",
  studentNick: "aluno-teste",
  answers: { "470688601": { question_id: "470688601", question_type: "essay", answer: { title: "Título", body: "Texto da redação" } } },
  essay: { title: "Título", body: "Texto da redação" },
});
assert.equal(essayPayload.title, "Título");
assert.equal(essayPayload.body, "Texto da redação");
assert.throws(() => buildTaskSubmissionPayload({
  taskId: "101785299", studentId: "1234", studentNick: "aluno-teste", answers: chosenAnswers,
  essay: { title: "", body: "Texto" },
}), /título e o texto/);

let captured;
const success = await submitTaskAnswers({
  taskId: "9876",
  studentId: "1234",
  studentNick: "aluno-teste",
  answers: chosenAnswers,
  durationSeconds: 87,
  captchaToken: "fresh-token",
  captchaSessionKey: "fresh-session",
}, {
  apiBaseUrl: "https://upstream.invalid",
  upstreamHeaders: { Origin: "https://example.invalid" },
  apiKey: "test-key-not-a-secret",
  fetchImpl: async (url, init) => {
    captured = { url, init };
    assert.equal("cache" in init, false, "não usar RequestInit.cache no Worker");
    assert.equal(init.method, "POST");
    assert.equal(new Headers(init.headers).get("X-Api-Key"), "test-key-not-a-secret");
    assert.equal(new Headers(init.headers).get("X-Captcha-Token"), "fresh-token");
    assert.equal(new Headers(init.headers).get("X-Session-Key"), "fresh-session");
    assert.deepEqual(JSON.parse(init.body), payload);
    return { ok: true, status: 200, json: async () => ({ answer: { status: "submitted" } }) };
  },
});
assert.equal(captured.url, "https://upstream.invalid/tms/task/9876/answer");
assert.equal(JSON.parse(captured.init.body).status, "submitted");
assert.deepEqual(JSON.parse(captured.init.body).answers["101"].answer, ["a", "b"]);
assert.equal(success.resp.ok, true);
assert.equal(success.data.status, "submitted");

const tokenRetryHeaders = [];
let refreshCalls = 0;
const refreshedTokenSuccess = await submitTaskAnswers({
  taskId: "9876", studentId: "1234", studentNick: "aluno-teste", answers: chosenAnswers,
  durationSeconds: 87, captchaToken: "fresh-token", captchaSessionKey: "fresh-session",
}, {
  apiBaseUrl: "https://upstream.invalid",
  apiKey: "expired-key",
  refreshApiKey: async ({ apiKey }) => {
    refreshCalls += 1;
    assert.equal(apiKey, "expired-key");
    return "renewed-key";
  },
  fetchImpl: async (_url, init) => {
    tokenRetryHeaders.push(new Headers(init.headers).get("X-Api-Key"));
    return tokenRetryHeaders.length === 1
      ? { ok: false, status: 400, json: async () => ({ errors: [{ field: "token", cause: "invalid token" }] }) }
      : { ok: true, status: 200, json: async () => ({ answer: { status: "submitted" } }) };
  },
});
assert.deepEqual(tokenRetryHeaders, ["expired-key", "renewed-key"]);
assert.equal(refreshCalls, 1);
assert.equal(refreshedTokenSuccess.resp.ok, true);

const draftStatus = await submitTaskAnswers({
  taskId: "9876", answerId: 2468, studentId: "1234", studentNick: "aluno-teste", answers: chosenAnswers,
  captchaToken: "fresh-token", captchaSessionKey: "fresh-session",
}, {
  apiBaseUrl: "https://upstream.invalid",
  apiKey: "test-key-not-a-secret",
  fetchImpl: async (url, init) => init.method === "POST"
    ? { ok: true, status: 200, json: async () => ({ answer: { status: "draft" } }) }
    : { ok: true, status: 200, json: async () => ({ answer: { status: "submitted" } }) },
});
assert.equal(draftStatus.resp.ok, true, "um rascunho existente deve ser finalizado");
assert.equal(draftStatus.data.status, "submitted");

const pendingStatus = await submitTaskAnswers({
  taskId: "9876", answerId: 2468, studentId: "1234", studentNick: "aluno-teste", answers: chosenAnswers,
  captchaToken: "fresh-token", captchaSessionKey: "fresh-session",
}, {
  apiBaseUrl: "https://upstream.invalid",
  apiKey: "test-key-not-a-secret",
  fetchImpl: async (url, init) => init.method === "POST"
    ? { ok: true, status: 200, json: async () => ({ answer: { status: "pending" } }) }
    : { ok: true, status: 200, json: async () => ({ answer: { status: "submitted" } }) },
});
assert.equal(pendingStatus.resp.ok, true, "uma resposta pending existente deve ser finalizada");

const noCaptcha = await submitTaskAnswers({
  taskId: "9876", studentId: "1234", studentNick: "aluno-teste", answers: chosenAnswers,
}, {
  apiBaseUrl: "https://upstream.invalid",
  apiKey: "test-key-not-a-secret",
  fetchImpl: async () => { throw new Error("não deve chamar o upstream sem CAPTCHA"); },
});
assert.equal(noCaptcha.resp.status, 403);

const upstreamFailure = await submitTaskAnswers({
  taskId: "9876", studentId: "1234", studentNick: "aluno-teste", answers: chosenAnswers,
  captchaToken: "fresh-token", captchaSessionKey: "fresh-session", durationSeconds: 87,
}, {
  apiBaseUrl: "https://upstream.invalid",
  apiKey: "test-key-not-a-secret",
  fetchImpl: async () => ({ ok: false, status: 502, json: async () => ({}) }),
});
assert.equal(upstreamFailure.resp.ok, false);
assert.equal(upstreamFailure.resp.status, 502);

console.log("test-task-answer-worker: payload, respostas manuais, CAPTCHA novo e POST sem cache validados.");
