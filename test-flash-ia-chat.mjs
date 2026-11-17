import assert from "node:assert/strict";
import fs from "node:fs";

const bundle = fs.readFileSync(new URL("./script.js", import.meta.url), "utf8");
const start = bundle.indexOf("function IaPage()");
const end = bundle.indexOf("function ApostilasPage", start);
assert.ok(start >= 0 && end > start, "a página do Flash IA deve existir");
const iaPage = bundle.slice(start, end);

for (const removedFeature of [
  "CAPTCHA",
  "captcha",
  "fetchCaptchaChallenge",
  "verifyCaptcha",
  "fetchTaskDetails",
  "ia-task-picker",
  "study-task-preview",
  "taskMatchesMessage",
  "studyTaskContext",
]) {
  assert.ok(!iaPage.includes(removedFeature), `Flash IA não deve conter ${removedFeature}`);
}

assert.ok(iaPage.includes("chat-shell"), "o chat do Flash IA deve continuar disponível");
assert.ok(iaPage.includes("chat-composer"), "o campo de mensagem deve continuar disponível");
assert.ok(iaPage.includes("sendAssistantMessage(next)"), "mensagens continuam sendo enviadas ao tutor");
assert.ok(iaPage.includes("Explique este conteúdo de forma simples"), "sugestão de estudo geral continua disponível");

console.log("test-flash-ia-chat: chat preservado; integração de atividades removida.");
