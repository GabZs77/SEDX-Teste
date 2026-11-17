import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./script.js", import.meta.url), "utf8");
assert.match(source, /function getRedacaoDurationMinutes\(\)/);
assert.match(source, /sed_redacao_duration_minutes/);
assert.match(source, /n>=20&&n<=60\?n:20/);
assert.match(source, /min:20,max:60,step:1/);
assert.match(source, /Informe um número inteiro entre 20 e 60 minutos/);
assert.match(source, /function getTaskDurationForTask\(task\)/);
assert.match(source, /task\?\.isRedacao===true\?getRedacaoDurationMinutes\(\):getTaskDurationMinutes\(\)/);
assert.match(source, /jsxRuntimeExports\.jsx\(RedacaoTimerSettings,\{\}\)/);
assert.match(source, /isRedacao:a\.isRedacao===true/);
console.log("OK: Redação possui temporizador próprio com limite de 20 a 60 minutos.");
