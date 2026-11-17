import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./script.js", import.meta.url), "utf8");
const start = source.indexOf("function essaySubmitted(");
const end = source.indexOf("function normalizeTasks(", start);
assert.ok(start >= 0 && end > start, "essaySubmitted não encontrado");
const essaySubmitted = new Function(`${source.slice(start, end)};return essaySubmitted;`)();

// Redação enviada na Sala do Futuro (resposta existe, aguardando correção) aparece como enviada.
assert.equal(essaySubmitted({ answer_id: 123, answer_status: "pending" }, "pending"), true);
assert.equal(essaySubmitted({}, "submitted"), true);
assert.equal(essaySubmitted({}, "finished"), true);
// Rascunho e proposta sem resposta continuam pendentes.
assert.equal(essaySubmitted({ answer_id: 123, answer_status: "draft" }, "draft"), false);
assert.equal(essaySubmitted({}, "pending"), false);
// A aba Redação mostra "Enviada" e não descarta redações enviadas.
assert.ok(source.includes('children:sent?(a.status==="completed"?"Concluída":"Enviada"):a.isDraft?"Rascunho":c?"Expirada":"Pendente"'));
assert.ok(!source.includes('normalizeTasks(a?.redacoes||a?.tasks||[],true,true).filter(task=>task.status!=="completed")'));
console.log("OK: redações enviadas aparecem como Enviada; rascunhos e não respondidas continuam Pendente.");

// Recusa "task already answered" vira confirmação de envio, não erro.
const h0 = source.indexOf("function isTaskAlreadyAnsweredError(");
const h1 = source.indexOf("\n", h0);
const isAlready = new Function(`${source.slice(h0, h1)};return isTaskAlreadyAnsweredError;`)();
assert.equal(isAlready(new Error('A plataforma recusou o envio (HTTP 403): {"errors":[{"message":"task already answered by user"}]}')), true);
assert.equal(isAlready(new Error("A plataforma recusou o envio (HTTP 403): captcha inválido")), false);
assert.ok(source.includes("if(!isTaskAlreadyAnsweredError(error))throw error;markTaskSent(taskId)"));
console.log("OK: tarefa já respondida é tratada como enviada.");
