import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./script.js", import.meta.url), "utf8");
const helper = source.match(/function compactAiPromptText[\s\S]*?:text\}/)?.[0];
assert.ok(helper, "compactAiPromptText deve existir");
const compactAiPromptText = new Function(`${helper}; return compactAiPromptText;`)();
const essay = `<p>Texto&nbsp;I</p><img src="data:image/png;base64,${"A".repeat(60000)}"><div>${"palavra ".repeat(4000)}</div>`;
const result = compactAiPromptText(essay, 11000);
assert.ok(!result.includes("base64"), "imagens embutidas não vão para a IA");
assert.ok(!result.includes("<"), "HTML é removido");
assert.ok(JSON.stringify(result).length < 18000, "enunciado cabe no limite de 18.000 caracteres da IA");
assert.ok(source.includes("compactAiPromptText(question.statement"));
console.log("OK: enunciados longos de redação são compactados antes de ir para a IA.");
