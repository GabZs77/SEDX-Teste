import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const bundle = fs.readFileSync(new URL("./script.js", import.meta.url), "utf8");
const start = bundle.indexOf("function captchaImageBytesToBase64(");
const end = bundle.indexOf("async function sendAssistantMessage(", start);
assert.ok(start >= 0 && end > start, "helpers de CAPTCHA devem continuar disponíveis no bundle");

const calls = [];
const agreementCalls = [];
const submissionOrder = [];
let challengeCount = 0;
let invalidApiTokenOnce = false;
let sessionRenewals = 0;
const context = {
  URLSearchParams,
  Headers,
  Date,
  AbortSignal,
  btoa,
  atob,
  ArrayBuffer,
  Uint8Array,
  readSession: () => ({ token2: "test-session-key", apelido: "student-test" }),
  resumeSession: async () => { sessionRenewals += 1; return { token2: "renewed-session-key" }; },
  fetch: async (url, options = {}) => {
    submissionOrder.push("agreement");
    agreementCalls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ ok: true, total: 1, confirmed: 1, failed: 0 }) };
  },
  request: async (path, options = {}) => {
    calls.push({ path, options });
    if (path === "/captcha/challenge") {
      challengeCount += 1;
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), { realm: "edusp", type: "image" });
      return {
        challengeId: `challenge-${challengeCount}`,
        image: "data:image/png;base64,AA==",
        sessionKey: `session-${challengeCount}`,
        captchaCookie: `captcha_sid=${challengeCount}; captcha_aux=two`,
      };
    }
    if (path === "/captcha/verify") {
      const body = JSON.parse(options.body);
      const expectedIndex = body.sessionKey === "session-1" ? 1 : 2;
      assert.equal(body.sessionKey, `session-${expectedIndex}`);
      assert.equal(body.captchaCookie, `captcha_sid=${expectedIndex}; captcha_aux=two`);
      assert.equal(body.payload.answer, expectedIndex === 1 ? "Jrwnu" : "K7x4p");
      return {
        valid: true,
        token: `captcha-token-${expectedIndex}`,
        sessionKey: body.sessionKey,
        captchaCookie: body.captchaCookie,
      };
    }
    if (path.startsWith("/task-details?")) {
      const parsed = new URL(`https://worker.test${path}`);
      const headers = new Headers(options.headers);
      assert.equal(options.method, "GET");
      assert.equal(options.cache, "no-store");
      assert.equal(parsed.searchParams.get("task_id"), "task-1");
      assert.equal(parsed.searchParams.get("room_name"), "2ª B - EMP LOGÍSTICA");
      assert.equal(headers.get("X-Captcha-Token"), "captcha-token-1");
      assert.equal(headers.get("X-Captcha-Session"), "session-1");
      assert.equal(headers.get("X-Captcha-Cookie"), "captcha_sid=1; captcha_aux=two");
      return { questions: [{ id: "q1" }] };
    }
    if (path === "/answer-task") {
      submissionOrder.push("activity");
      if (invalidApiTokenOnce) {
        invalidApiTokenOnce = false;
        throw Object.assign(new Error('A plataforma recusou o envio (HTTP 400): {"errors":[{"field":"token","cause":"invalid token"}]}'), { status: 400 });
      }
      return { ok: true };
    }
    throw new Error(`rota inesperada: ${path}`);
  },
};

vm.runInNewContext(
  `${bundle.slice(start, end)}\n` +
    "this.fetchCaptchaChallenge=fetchCaptchaChallenge; " +
    "this.verifyCaptcha=verifyCaptcha; " +
    "this.fetchTaskDetails=fetchTaskDetails; " +
    "this.submitTaskAnswers=submitTaskAnswers; " +
    "this.submitTaskAgreement=submitTaskAgreement; " +
    "this.submitTaskAnswersWithCaptcha=submitTaskAnswersWithCaptcha;",
  context,
);

const readChallenge = await context.fetchCaptchaChallenge();
assert.equal(readChallenge.captchaCookie, "captcha_sid=1; captcha_aux=two");
assert.equal(calls[0].path, "/captcha/challenge");
assert.equal(calls[0].options.headers["Content-Type"], "application/json");

const readVerified = await context.verifyCaptcha(readChallenge, " Jrwnu ");
assert.equal(readVerified.token, "captcha-token-1");
assert.equal(readVerified.sessionKey, readChallenge.sessionKey);
assert.equal(readVerified.captchaCookie, readChallenge.captchaCookie);
assert.equal(calls[1].path, "/captcha/verify");

await context.fetchTaskDetails(
  "task-1",
  "2ª B - EMP LOGÍSTICA",
  readVerified.token,
  "task-code",
  readVerified.sessionKey,
  readVerified.captchaCookie,
);
assert.ok(calls[2].path.startsWith("/task-details?"));
assert.equal(calls[2].options.cache,"no-store");

const submissionChallenge = await context.fetchCaptchaChallenge();
assert.equal(calls[3].path, "/captcha/challenge");
const chosenAnswers = {
  q1: { question_id: "q1", question_type: "single", value: { option_a: false, option_b: true } },
};
const submitted = await context.submitTaskAnswersWithCaptcha(
  "task-1",
  "2ª B - EMP LOGÍSTICA",
  chosenAnswers,
  submissionChallenge,
  "K7x4p",
  60,
);
assert.equal(submitted.token, "captcha-token-2");
assert.equal(submitted.agreement.confirmed, 1);
assert.equal(calls[4].path, "/captcha/verify");
assert.equal(calls[5].path, "/answer-task");
assert.equal(agreementCalls.length, 1);
assert.equal(agreementCalls[0].url, "/api/edusp-agreements");
assert.equal(agreementCalls[0].options.method, "POST");
assert.equal(agreementCalls[0].options.headers["X-Api-Key"], "test-session-key");
assert.deepEqual(JSON.parse(agreementCalls[0].options.body), { taskId: "task-1", agreed: true });
assert.deepEqual(submissionOrder, ["activity", "agreement"]);
const answerHeaders = new Headers(calls[5].options.headers);
assert.equal(answerHeaders.get("X-Captcha-Token"), "captcha-token-2");
assert.equal(answerHeaders.get("X-Captcha-Session"), "session-2");
assert.equal(answerHeaders.get("X-Captcha-Cookie"), "captcha_sid=2; captcha_aux=two");
const answerBody = JSON.parse(calls[5].options.body);
assert.equal(answerBody.captcha_token, "captcha-token-2");
assert.equal(answerBody.captcha_session, "session-2");
assert.equal(answerBody.captcha_cookie, "captcha_sid=2; captcha_aux=two");
assert.equal(answerBody.duration, 60);
assert.deepEqual(answerBody.answers.q1.value, { option_a: false, option_b: true });
assert.deepEqual(
  calls.map(({ path }) => path.split("?")[0]),
  ["/captcha/challenge", "/captcha/verify", "/task-details", "/captcha/challenge", "/captcha/verify", "/answer-task"],
);

assert.ok(!bundle.includes("/api/edusp-captcha"));
assert.ok(!bundle.includes("/api/edusp-task-details"));
assert.ok(bundle.includes("submitTaskAnswersWithCaptcha(J,st,pendingAnswers,c,_,durationSeconds,a.answerId"));
assert.ok(bundle.includes("setPendingDurationSeconds(getTaskDurationForTask(a)*60),setPendingAnswers(R),setSubmitMode(true)"), "o duration selecionado deve ser congelado no clique em Enviar");
assert.ok(bundle.includes("const durationSeconds=pendingDurationSeconds;"), "o valor congelado deve ser enviado após validar o CAPTCHA");
assert.ok(bundle.includes("markTaskSent(task.id);completed++;try{await submitTaskAgreement(task.id)}catch{agreementFailures.push(currentTask)}"), "falha na confirmação acessória não pode marcar como falho o envio já confirmado");
assert.ok(bundle.includes("Falha ao enviar ${currentTask}. "), "falha upstream deve apontar a atividade que não foi enviada");
assert.ok(bundle.includes('${completed} atividade${completed===1?" foi":"s foram"} enviada${completed===1?"":"s"} antes da falha.'), "erro parcial deve informar quantas atividades tiveram envio confirmado");
assert.ok(bundle.includes('Não foi possível confirmar o comentário de correção em ${agreementFailures.join(", ")}; o envio das respostas foi confirmado.'), "falha de confirmação acessória deve ser comunicada sem desfazer o envio");
assert.ok(bundle.includes("void At(true)"), "o botão Enviar deve gerar um segundo desafio");
assert.ok(bundle.includes("Resolva um novo CAPTCHA antes de enviar suas respostas à Sala do Futuro."));
assert.ok(!bundle.includes("submitTaskAnswers(J,st,R,u,yt,ct)"), "não enviar usando o CAPTCHA da leitura");
assert.ok(bundle.includes('status!==400||!/invalid\\s+token/i.test(message)||typeof resumeSession!=="function"'), "só uma resposta HTTP 400 de token inválido deve renovar sessão");
invalidApiTokenOnce = true;
const retried = await context.submitTaskAnswers("task-1", "2ª B - EMP LOGÍSTICA", chosenAnswers, "captcha-after-renewal", "session-after-renewal", "cookie-after-renewal", 60);
assert.equal(retried.ok, true);
assert.equal(sessionRenewals, 1, "renovar a sessão uma única vez quando a EduSP disser invalid token");
assert.equal(calls.filter(({ path }) => path === "/answer-task").length, 3, "repetir só a chamada explicitamente recusada por token inválido");

console.log("test-task-captcha: CAPTCHA novo validado; atividade enviada antes do acordo automático.");
