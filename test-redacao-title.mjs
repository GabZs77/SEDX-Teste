import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./script.js", import.meta.url), "utf8");
// A IA recebe o pedido de título no mesmo JSON do texto.
assert.ok(source.includes(`'{"title":"título da redação","text_answer":"texto completo da redação"}'`));
// O título da IA só entra quando o aluno não digitou um.
assert.ok(source.includes('if(aiTitle&&!String(currentTitle||"").trim())onTitle(aiTitle)'));
// O título fica salvo junto das respostas e vai no envio antes da redação.
assert.ok(source.includes('onTitleChange:R=>H("__redacao_title",R)'));
assert.ok(source.includes('answer:a.isRedacao&&L.type==="text"?{title:String(P.__redacao_title||"").trim(),body:String(P[L.id]||"").trim()}:P[L.id]'));
// Simula o envio: título + redação.
const join = (title, body) => [String(title || "").trim(), String(body || "")].filter(Boolean).join("\n\n");
assert.equal(join("Amor que prende", "Texto."), "Amor que prende\n\nTexto.");
assert.equal(join("", "Texto."), "Texto.");
console.log("OK: título da redação gerado pela IA, preservado quando digitado e enviado junto da redação.");
assert.ok(source.includes("no máximo 3.000 caracteres"));
assert.ok(source.includes("nível de um aluno de 16 anos"));
assert.ok(source.includes('finalAnswer.length>3000'));
console.log("OK: redação limitada a 3.000 caracteres e em linguagem de aluno de 16 anos.");
