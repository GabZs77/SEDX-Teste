import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const bundle = await readFile(new URL("./script.js", import.meta.url), "utf8");
const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const start = bundle.indexOf("function BulkTasksPanel({tasks");
const end = bundle.indexOf("function TarefasPage(", start);
assert.ok(start >= 0 && end > start, "o painel de atividades em lote deve existir");
const panel = bundle.slice(start, end);

const verifiedNextCaptcha = panel.indexOf('if(c==="batch-next"){if(!u)l(Date.now());batchNextReady.current=!0;');
assert.ok(verifiedNextCaptcha >= 0, "confirmar o CAPTCHA seguinte deve agendar a IA para a próxima atividade");
assert.ok(panel.includes('waitingForCaptcha:false,current:`Abrindo ${status.nextTask||"próxima atividade"}`'), "ao confirmar o CAPTCHA, o estado deve sair da pausa antes da IA começar");
assert.ok(!panel.includes('toast.success("Lote retomado"'), "não deve mostrar mensagem de retomada antes da IA responder");

const continuationEffect = panel.indexOf('if(batchNextReady.current){batchNextReady.current=!1;autoAiStarted.current=!0;void selectAllWithAi();return}');
const timerGate = panel.indexOf("if(!u||remaining>0||autoAiStarted.current)return", continuationEffect);
assert.ok(continuationEffect >= 0 && timerGate > continuationEffect, "a continuação validada deve disparar a IA antes da condição do cronômetro global");

const aiStart = panel.indexOf("async function selectAllWithAi()");
const aiEnd = panel.indexOf("reactExports.useEffect(", aiStart);
const aiFlow = panel.slice(aiStart, aiEnd);
const saveAnswers = aiFlow.indexOf('A(previous=>({...previous,[String(task.id)]');
const completionMessage = aiFlow.indexOf('toast.info("Atividade concluída — lote pausado"');
assert.ok(saveAnswers >= 0 && completionMessage > saveAnswers, "a mensagem de conclusão deve vir depois de salvar as respostas geradas pela IA");
assert.ok(aiFlow.includes('Atividade concluída — toque em Continuar Lote (${nextTask.title})'), "o CTA de continuação deve ser definido após gerar respostas da atividade");

const captchaPanel = panel.indexOf('className:"bulk-captcha-panel"');
assert.ok(captchaPanel >= 0, "o painel do CAPTCHA deve existir");
const duringCaptcha = panel.slice(captchaPanel);
assert.ok(duringCaptcha.includes('children:"Verificação da próxima atividade"'), "durante o CAPTCHA deve aparecer uma instrução de verificação, não um aviso de conclusão");
assert.ok(!duringCaptcha.includes('children:"Continuar Lote"'), "o botão Continuar Lote não deve permanecer visível enquanto o CAPTCHA é resolvido");
const fallbackStart = bundle.indexOf("async function requestWithPollinations");
const fallbackEnd = bundle.indexOf("const queuedAiRequest", fallbackStart);
const fallbackSource = bundle.slice(fallbackStart, fallbackEnd);
assert.ok(fallbackSource.includes("if (Number(groqError?.status || 0) === 429) throw groqError;"), "429 deve ser preservado para a fila aplicar Retry-After");
assert.ok(panel.includes("generateAnswer(question,bulkAiRequest)"), "a resposta em lote deve usar a mesma fila serial dos demais pedidos Groq");
assert.ok(!bundle.includes("let batchAiNextAt=0") && !panel.includes("generateAnswer(question,batchAiRequest)"), "o limitador paralelo separado não deve mais contornar a fila compartilhada");
assert.ok(panel.includes('aiStatus?.pausedForAi?"Tentar novamente":"Selecionar todas com IA"'), "a atividade aberta deve oferecer retentativa sem CAPTCHA");
assert.ok(panel.includes('cachedDetails||await fetchTaskDetails(task.id'), "a retentativa deve reutilizar a atividade que já foi aberta");
assert.ok(panel.includes('aiStatus.pausedForAi?"Resposta pendente — tente novamente":"Processamento da IA concluído"'), "a interface não deve declarar concluído quando ainda há respostas pendentes");
assert.ok(html.includes("auto-ai-tasks-20261116-1"), "o bundle corrigido deve carregar com nova versão de cache");
console.log("OK: CAPTCHA seguinte dispara a IA; o aviso Continuar Lote só reaparece após as respostas serem salvas.");
assert.ok(panel.includes('o(c==="batch-next"?"batch-next":c==="send"?"send":"error")'), "CAPTCHA errado no envio deve continuar no modo de envio");
assert.ok(panel.includes('o(batchNext?"batch-next":next==="send"?"send":"error")'), "falha ao gerar CAPTCHA de envio deve continuar no modo de envio");
assert.ok(panel.includes('if(u){o("active");h("");return}const started=Date.now()'), "um CAPTCHA nunca deve reiniciar o cronômetro de um lote já iniciado");
console.log("OK: envio em lote não volta para o início do lote.");
