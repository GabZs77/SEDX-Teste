import assert from "node:assert/strict";
import fs from "node:fs";

const bundle = fs.readFileSync(new URL("./script.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const start = bundle.indexOf("function BulkTasksPanel({tasks");
assert.ok(start >= 0, "o painel de lote deve existir");
const sendStart = bundle.indexOf("function send(verified){", start);
const sendEnd = bundle.indexOf("async function begin(){", sendStart);
assert.ok(sendStart >= 0 && sendEnd > sendStart, "o fluxo de envio em lote deve estar disponível");
const panel = bundle.slice(start, sendEnd);
const send = bundle.slice(sendStart, sendEnd);
assert.ok(send.includes("submitTaskAnswers(task.id,task.roomName,saved.answers,verified.token"), "cada resposta deve usar somente o CAPTCHA que acabou de ser validado");
assert.ok(send.includes('toast.info("Atividade enviada — próximo CAPTCHA"'), "após cada envio confirmado deve solicitar o CAPTCHA seguinte");
assert.ok(send.includes('void loadCaptcha("send")'), "o próximo desafio deve ser gerado antes de enviar a próxima atividade");
assert.ok(send.includes("if(remainingTasks.length)") && send.includes("return}}toast.success("), "cada iteração deve parar após um item e aguardar o próximo CAPTCHA");
assert.ok(bundle.includes("Cada atividade exige um CAPTCHA próprio"), "a interface deve explicar que há um desafio por atividade");
assert.ok(html.includes("auto-ai-tasks-20261116-1"), "o navegador deve carregar o bundle atualizado");
console.log("OK: cada atividade usa um CAPTCHA recém-validado e aguarda novo desafio antes da próxima.");
