import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("./script.js", import.meta.url), "utf8");
const expiredUi = fs.readFileSync(new URL("./sed-session-expired.js", import.meta.url), "utf8");
assert.ok(!expiredUi.includes("tokenExpired"), "a stale local JWT exp must not show a false expiration notice");
assert.ok(expiredUi.includes('"sedx:session-restored"'), "successful renewal should clear the notice");
const agendaStart = source.indexOf("function AgendaPage()");
const agendaEnd = source.indexOf("function TodayAgenda(", agendaStart);
const agendaPageSource = source.slice(agendaStart, agendaEnd);
assert.ok(agendaPageSource.includes("fetchAgenda()"), "Agenda must use the account-aware loader");
assert.ok(agendaPageSource.includes('agendaError?jsxRuntimeExports.jsx(ErrorState'), "Agenda must show API failures instead of a false empty state");
const start = source.indexOf("function readSession(){");
const end = source.indexOf("function firstName(", start);
assert.ok(start >= 0 && end > start, "client request helpers should be present");

class MemoryStorage {
  constructor(initial) { this.values = new Map(Object.entries(initial || {})); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "X-Worker-Build": "test" } });

function createClient(fetchMock, sessionOverrides = {}) {
  const localStorage = new MemoryStorage({ sed_sessao: JSON.stringify({ usuario: "ra-test", token: "old-sed-token", token2: "old-api-token", cdUsuarioCurto: "123", ...sessionOverrides }) });
  const uiEvents = [];
  const context = { localStorage, Headers, fetch: fetchMock, WORKER_URL: "https://worker.test", SESSION_KEY: "sed_sessao", URLSearchParams,
    window: { __sedxSedExpired: true, dispatchEvent: event => uiEvents.push(event.type) },
    CustomEvent: class { constructor(type) { this.type = type; } },
  };
  vm.runInNewContext(`${source.slice(start, end)}\nthis.fetchDashboard=fetchDashboard;this.fetchOptional=fetchOptional;this.fetchAgenda=fetchAgenda;this.resumeSession=resumeSession;`, context);
  return { context, localStorage, uiEvents };
}

const calls = [];
let dashboardCalls = 0;
const dashboardClient = createClient(async (url, init = {}) => {
  const path = new URL(url).pathname;
  calls.push({ path, init });
  if (path === "/resume") return jsonResponse({ token: "renewed-sed-token", token2: "renewed-api-token", cdUsuarioCurto: "123" });
  if (path === "/dashboard") {
    dashboardCalls += 1;
    return jsonResponse({ tarefas: [{ id: "task" }], meta: { alunoApiOk: true, faltasApiOk: dashboardCalls > 1, agendaApiOk: dashboardCalls > 1 } });
  }
  throw new Error(`Unexpected path ${path}`);
});
const dashboard = await dashboardClient.context.fetchDashboard();
assert.equal(dashboardCalls, 2, "partial dashboard should be retried once after resuming the session");
assert.deepEqual(calls.map(call => call.path), ["/dashboard", "/resume", "/dashboard"]);
const secondDashboard = calls.at(-1);
assert.equal(new Headers(secondDashboard.init.headers).get("X-Token"), "renewed-sed-token");
assert.equal(new Headers(secondDashboard.init.headers).get("X-Token2"), "renewed-api-token");
assert.equal(dashboardClient.context.window.__sedxSedExpired, false, "successful renewal clears a stale session warning");
assert.ok(dashboardClient.uiEvents.includes("sedx:session-restored"));
const saved = JSON.parse(dashboardClient.localStorage.getItem("sed_sessao"));
assert.equal(saved.token, "renewed-sed-token");
assert.equal(saved.token2, "renewed-api-token");

const optionalCalls = [];
const optionalClient = createClient(async (url, init = {}) => {
  const path = new URL(url).pathname;
  optionalCalls.push({ path, init });
  if (path === "/boletim" && optionalCalls.filter(call => call.path === "/boletim").length === 1) return jsonResponse({ erro: "sessão expirada" }, 403);
  if (path === "/resume") return jsonResponse({ token: "new-sed", token2: "new-api", cdUsuarioCurto: "123" });
  if (path === "/boletim") return jsonResponse({ ok: true, data: [{ nota: 8 }] });
  throw new Error(`Unexpected path ${path}`);
});
const grades = await optionalClient.context.fetchOptional("/boletim");
assert.equal(grades.ok, true);
assert.deepEqual(optionalCalls.map(call => call.path), ["/boletim", "/resume", "/boletim"]);
assert.equal(new Headers(optionalCalls.at(-1).init.headers).get("X-Token2"), "new-api");

const failedAgendaCalls = [];
const failedAgendaClient = createClient(async url => {
  const path = new URL(url).pathname;
  failedAgendaCalls.push(path);
  if (path === "/agenda") return jsonResponse({ erro: "Não foi possível consultar a agenda na EduSP." }, 401);
  if (path === "/resume") return jsonResponse({ erro: "Não foi possível retomar a sessão EduSP." }, 401);
  throw new Error(`Unexpected path ${path}`);
});
await assert.rejects(
  () => failedAgendaClient.context.fetchOptional("/agenda", true),
  /Não foi possível retomar a sessão EduSP/,
  "the Agenda page must receive an API failure rather than render an empty schedule",
);
assert.deepEqual(failedAgendaCalls, ["/agenda", "/resume"]);

const concurrentCalls = [];
let resumed = false;
let resumeCount = 0;
const concurrentClient = createClient(async (url, init = {}) => {
  const path = new URL(url).pathname;
  concurrentCalls.push({ path, init });
  if (path === "/resume") {
    resumeCount += 1;
    await new Promise(resolve => setTimeout(resolve, 5));
    resumed = true;
    return jsonResponse({ token: "concurrent-sed", token2: "concurrent-api", cdUsuarioCurto: "123" });
  }
  if ((path === "/agenda" || path === "/boletim") && !resumed) return jsonResponse({ erro: "sessão expirada" }, 403);
  if (path === "/agenda") return jsonResponse({ data: { agendaAluno: [] } });
  if (path === "/boletim") return jsonResponse({ data: [] });
  throw new Error(`Unexpected path ${path}`);
});
const [agenda, boletim] = await Promise.all([
  concurrentClient.context.fetchOptional("/agenda"),
  concurrentClient.context.fetchOptional("/boletim"),
]);
assert.equal(agenda.data.agendaAluno.length, 0);
assert.equal(boletim.data.length, 0);
assert.equal(resumeCount, 1, "Agenda e Boletim simultâneos devem compartilhar a renovação");

assert.ok(failedAgendaClient.uiEvents.includes("sedx:sed-expired"), "students must still receive a real expiration notice");

const adminAgendaCalls = [];
const adminClient = createClient(async url => {
  const path = new URL(url).pathname;
  adminAgendaCalls.push(path);
  if (path === "/dashboard") return jsonResponse({ agenda: [], meta: { alunoApiOk: true, faltasApiOk: true, agendaApiOk: true, sessaoSedExpirada: true } });
  throw new Error(`A local administrator must not call the student Agenda API: ${path}`);
}, { localAdmin: true, token: "local-admin", token2: "local-admin" });
const adminAgenda = await adminClient.context.fetchAgenda();
assert.equal(adminAgenda.total, 0, "the fictitious administrator gets an empty agenda without a school API request");
assert.equal(adminAgenda.localAdmin, true);
assert.deepEqual(adminAgendaCalls, [], "the local administrator must not call the student Agenda API");
await adminClient.context.fetchDashboard();
assert.deepEqual(adminAgendaCalls, ["/dashboard"]);
assert.ok(!adminClient.uiEvents.includes("sedx:sed-expired"), "a local administrator must never receive a Secretary expiration notice");

console.log("OK: renovação de aluno preservada; conta administrativa local não consulta a Agenda escolar nem recebe aviso de expiração.");
