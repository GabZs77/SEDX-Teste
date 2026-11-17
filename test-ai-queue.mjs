import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleGroqChat, groqRetrySeconds } from "./groq-worker.mjs";

const source = await readFile(new URL("./script.js", import.meta.url), "utf8");
const start = source.indexOf("function createAiRequestQueue");
const end = source.indexOf("const queuedAiRequest", start);
const createAiRequestQueue = new Function(source.slice(start, end) + ";return createAiRequestQueue")();
let clock = 0;
let active = 0;
let peak = 0;
const calls = [];
const queue = createAiRequestQueue(async (path) => {
  active++;
  peak = Math.max(peak, active);
  calls.push([path, clock]);
  await Promise.resolve();
  active--;
  return path;
}, { now: () => clock, sleep: async (ms) => { clock += ms; } });
const results = await Promise.all(Array.from({ length: 60 }, (_, i) => queue(String(i), {})));
assert.equal(results.length, 60);
assert.equal(peak, 1);
assert.equal(calls.length, 60);
assert.equal(calls[59][1], 59 * 3000);

clock = 0;
let attempts = 0;
const waits = [];
const retry = createAiRequestQueue(async () => {
  if (++attempts === 1) throw Object.assign(new Error("quota"), { status: 429, retryAfterSeconds: 90 });
  return "ok";
}, { now: () => clock, sleep: async (ms) => { waits.push(ms); clock += ms; } });
assert.equal(await retry("/groq-chat", {}), "ok");
assert.deepEqual(waits, [90000]);
assert.equal(attempts, 2);
let fatalCalls = 0;
const fatal = createAiRequestQueue(async () => {
  fatalCalls++;
  throw Object.assign(new Error("unauthorized"), { status: 401 });
}, { spacing: 0 });
await assert.rejects(fatal("", {}));
assert.equal(fatalCalls, 1);
clock = 0;
let quotaCalls = 0;
const quota = createAiRequestQueue(async () => {
  quotaCalls++;
  throw Object.assign(new Error("daily quota"), { status: 429, retryAfterSeconds: 3600 });
}, { now: () => clock, sleep: async (ms) => { clock += ms; } });
await assert.rejects(quota("", {}), (error) => error.status === 429);
assert.equal(quotaCalls, 1);
assert.equal(clock, 0);
assert.equal(groqRetrySeconds(new Headers({ "retry-after": "90" }), null), 90);
assert.equal(groqRetrySeconds(new Headers(), { error: { message: "Please try again in 1m30.5s" } }), 91);
assert.equal(groqRetrySeconds(new Headers(), null), 60);
assert.equal(groqRetrySeconds(new Headers({ "retry-after": "Fri, 13 Nov 2026 21:13:30 GMT" }), null, Date.parse("2026-11-13T21:12:00Z")), 90);

clock = 0;
let emptyFallbackAttempts = 0;
const emptyFallbackWaits = [];
const retryEmptyFallback = createAiRequestQueue(async () => {
  if (++emptyFallbackAttempts < 3) throw new Error("fallback vazio");
  return "ok";
}, { now: () => clock, sleep: async (ms) => { emptyFallbackWaits.push(ms); clock += ms; }, spacing: 0 });
assert.equal(await retryEmptyFallback("/groq-chat", {}), "ok");
assert.equal(emptyFallbackAttempts, 3);
assert.deepEqual(emptyFallbackWaits, [2000, 4000]);

const fallbackStart = source.indexOf("async function requestWithPollinations");
const fallbackEnd = source.indexOf("const queuedAiRequest", fallbackStart);
assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart, "o roteador de IA e fallback deve existir");
let fallbackCalls = 0;
const requestWithPollinations = new Function("request", "fetch", `${source.slice(fallbackStart, fallbackEnd)}\nreturn requestWithPollinations;`)(
  async () => { throw Object.assign(new Error("quota"), { status: 429, retryAfterSeconds: 90 }); },
  async () => { fallbackCalls++; return new Response("não deveria consultar o fallback"); },
);
await assert.rejects(requestWithPollinations("/groq-chat", { body: JSON.stringify({ messages: [{ role: "user", content: "responda" }] }) }), (error) => error.status === 429);
assert.equal(fallbackCalls, 0, "limite 429 deve ser tratado pela fila serial, sem chamada de fallback paralela");
console.log("OK: fallback vazio recebe retries espaçados; 429 da IA principal segue para a fila com Retry-After.");

const original = globalThis.fetch;
let upstreamCalls = 0;
try {
  globalThis.fetch = async () => {
    upstreamCalls++;
    return new Response(JSON.stringify({ error: { message: "rate limit" } }), { status: 429, headers: { "retry-after": "90" } });
  };
  const response = await handleGroqChat(new Request("https://worker.test/groq-chat", {
    method: "POST",
    headers: { "X-Token2": "test-session" },
    body: JSON.stringify({ prompt: "Explique fotossíntese" }),
  }), { GROQ_API_KEY: "test-key" });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "90");
  assert.equal((await response.json()).retry_after_seconds, 90);
  assert.equal(upstreamCalls, 1);
} finally {
  globalThis.fetch = original;
}
console.log("OK: 60 requests serialized; 429 waits honored; daily quota stops without a retry storm; authentication never retried.");

const bulkStart = source.indexOf("async function selectAllWithAi()");
const bulkEnd = source.indexOf("reactExports.useEffect(", bulkStart);
const bulkSource = source.slice(bulkStart, bulkEnd);
const tasks = Array.from({ length: 3 }, (_, i) => ({ id: i + 1, title: `Task ${i + 1}`, roomName: "Sala" }));

async function exerciseBulk({ selected = {}, previousStatus = null, token = "captcha", cache = { current: {} }, blocked = false, openErrorStatus = 0, quota = false } = {}) {
  let state = null;
  let nextSelected = selected;
  let restoredCaptcha = null;
  const openedTokens = [];
  let opened = 0;
  let generated = 0;
  const vars = {
    P: token ? { token } : null,
    a: tasks,
    m: selected,
    aiStatus: previousStatus,
    taskDetailsCache: cache,
    G: (value) => { if (value) restoredCaptcha = value; },
    h: () => {},
    o: () => {},
    setAiStatus: (value) => { state = typeof value === "function" ? value(state || previousStatus) : value; },
    fetchTaskDetails: async (_id, _room, usedToken) => {
      opened++;
      openedTokens.push(usedToken);
      if (blocked) throw Object.assign(new Error("Acesso recusado"), { status: 403, taskAccessBlocked: true });
      if (openErrorStatus) throw Object.assign(new Error("Serviço de atividades indisponível"), { status: openErrorStatus });
      return { task: true };
    },
    extractTaskQuestions: () => [{ id: 1, type: "single" }],
    generateAnswer: async () => {
      generated++;
      if (quota) throw Object.assign(new Error("quota"), { status: 429 });
      return { answer: "op-b", title: "" };
    },
    buildAnswer: (_question, answer) => answer,
    A: (update) => { nextSelected = update(nextSelected); },
    duration: 60,
    autoAiMode: false,
    loadCaptcha: () => {},
    mapWithConcurrency: async (items, _limit, callback) => Promise.all(items.map(callback)),
    bulkAiRequest: async () => ({}),
    toast: { info: () => {}, warning: () => {}, success: () => {} },
  };
  const select = new Function(...Object.keys(vars), bulkSource + ";return selectAllWithAi")(...Object.values(vars));
  await select();
  return { state, selected: nextSelected, cache, openedTokens, opened, generated, restoredCaptcha };
}

let saved = {};
let status = null;
const cache = { current: {} };
const tokens = [];
for (let i = 1; i <= tasks.length; i++) {
  const result = await exerciseBulk({ selected: saved, previousStatus: status, token: `captcha-${i}`, cache });
  saved = result.selected;
  status = result.state;
  tokens.push(...result.openedTokens);
  assert.equal(result.opened, 1, "Cada desafio deve abrir no máximo uma atividade");
  assert.equal(status.completed, i);
  assert.equal(status.waitingForCaptcha, i < tasks.length);
}
assert.deepEqual(tokens, ["captcha-1", "captcha-2", "captcha-3"]);
assert.equal(Object.keys(saved).length, 3);
console.log("OK: cada atividade consome um CAPTCHA distinto e o progresso é preservado entre pausas.");

const first = await exerciseBulk({ token: "captcha-first" });
const blocked = await exerciseBulk({ selected: first.selected, previousStatus: first.state, token: "captcha-second", cache: first.cache, blocked: true });
assert.equal(blocked.opened, 1);
assert.equal(blocked.state.completed, 1);
assert.equal(blocked.state.waitingForCaptcha, true);
assert.equal(blocked.state.nextTask, "Task 2");
assert.equal(Object.keys(blocked.selected).length, 1);
const resumed = await exerciseBulk({ selected: blocked.selected, previousStatus: blocked.state, token: "captcha-third", cache: blocked.cache });
assert.equal(resumed.state.completed, 2);
assert.equal(Object.keys(resumed.selected).length, 2);
console.log("OK: acesso recusado pausa o lote, mantém tarefas pendentes e retoma com um CAPTCHA novo.");

const transientFailure = await exerciseBulk({ token: "captcha-temporario", openErrorStatus: 502 });
assert.equal(transientFailure.state.waitingForCaptcha, false, "Falha transitória não deve pedir outro CAPTCHA automaticamente");
assert.equal(transientFailure.state.pausedForAi, true);
assert.equal(transientFailure.restoredCaptcha.token, "captcha-temporario", "O desafio atual deve ser preservado para uma tentativa após erro transitório");
const transientRetry = await exerciseBulk({ token: transientFailure.restoredCaptcha.token, cache: transientFailure.cache });
assert.equal(transientRetry.state.completed, 1);
assert.deepEqual(transientRetry.openedTokens, ["captcha-temporario"]);
console.log("OK: falha transitória restaura o desafio atual e permite retentar sem solicitar outro CAPTCHA.");

const quotaCache = { current: {} };
const rateLimited = await exerciseBulk({ token: "captcha-ai", cache: quotaCache, quota: true });
assert.equal(rateLimited.state.waitingForCaptcha, false, "Falha da IA após abrir a atividade não deve exigir outro CAPTCHA");
assert.equal(rateLimited.state.pausedForAi, true);
const retryAi = await exerciseBulk({ selected: rateLimited.selected, previousStatus: rateLimited.state, token: null, cache: quotaCache });
assert.equal(retryAi.opened, 0, "A retentativa deve reutilizar os detalhes já abertos sem reabrir a atividade");
assert.equal(retryAi.state.completed, 1);
assert.equal(Object.keys(retryAi.selected).length, 1);
console.log("OK: retentativa após limite da IA reutiliza dados já abertos e não consome outro CAPTCHA.");
