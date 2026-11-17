import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const bundle = fs.readFileSync(new URL("./script.js", import.meta.url), "utf8");
const start = bundle.indexOf("function captchaImageBytesToBase64(");
const end = bundle.indexOf("async function sendAssistantMessage(", start);
assert.ok(start >= 0 && end > start, "helpers de imagem do CAPTCHA devem existir");
const context = { btoa, atob, ArrayBuffer, Uint8Array };
context.request = async () => ({ id: "challenge-123", challenge: "challenge-123", data: { image: "data:image/png;base64,AA==" } });
vm.runInNewContext(`${bundle.slice(start, end)}\nthis.source=captchaImageSource; this.fetchChallenge=fetchCaptchaChallenge;`, context);

const png = [137, 80, 78, 71, 13, 10, 26, 10];
const pngBase64 = Buffer.from(png).toString("base64");
assert.equal(context.source(png), `data:image/png;base64,${pngBase64}`);
assert.equal(context.source(Object.fromEntries(png.map((byte, index) => [index, byte]))), `data:image/png;base64,${pngBase64}`);
assert.equal(context.source({ data: png }), `data:image/png;base64,${pngBase64}`);
assert.equal(context.source(`data:image/png;base64,${pngBase64}`), `data:image/png;base64,${pngBase64}`);
assert.equal(context.source("https://example.test/captcha.png"), "https://example.test/captcha.png");
assert.equal(context.source([255, 216, 255, 0]), `data:image/jpeg;base64,${Buffer.from([255, 216, 255, 0]).toString("base64")}`);
const jpegBytes = Buffer.from([255, 216, 255, 251, 255, 255]);
const standardBase64 = jpegBytes.toString("base64");
const urlSafeBase64 = jpegBytes.toString("base64url");
assert.equal(context.source(urlSafeBase64), `data:image/jpeg;base64,${standardBase64}`, "Base64 URL-safe deve ser convertido e receber padding");
assert.equal(context.source(`data:image/jpeg;base64,${urlSafeBase64}`), `data:image/jpeg;base64,${standardBase64}`, "data URLs com Base64 URL-safe também devem ser normalizadas");
const challenge = await context.fetchChallenge();
assert.equal(challenge.challengeId, "challenge-123");
assert.equal(challenge.image, "data:image/png;base64,AA==", "o ID challenge deve ser ignorado em favor do campo real da imagem");
console.log("test-captcha-image: payloads binários e MIME verificados.");
