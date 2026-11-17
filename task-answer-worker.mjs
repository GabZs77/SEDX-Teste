const REJECTED_STATUSES = new Set(["failed", "error", "rejected", "not_submitted"]);

function numericId(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number >= 0 ? number : text;
}

function normalizeQuestionType(value) {
  const type = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  return type === "text-ai" || type === "text-answer" || type === "essay-text" ? "text" : type;
}

function answerValue(item, questionType) {
  const value = Object.prototype.hasOwnProperty.call(item, "answer")
    ? item.answer
    : item.value;
  if (value === undefined || value === null) return {};

  if (questionType === "text") {
    let text;
    if (Array.isArray(value)) text = value.map((entry) => String(entry ?? "")).join(" ");
    if (value && typeof value === "object") {
      if (typeof value.body === "string") text = value.body;
      else {
        const keys = Object.keys(value);
        if (keys.length === 1 && keys[0] === "0") text = String(value[0] ?? "");
        else if (keys.length === 1 && value[keys[0]] === true) text = String(keys[0]);
        else text = Object.values(value).map((entry) => String(entry ?? "")).join(" ");
      }
    }
    if (text === undefined) text = String(value ?? "");
    return { "0": text };
  }

  if (Array.isArray(value)) {
    if (["multi", "single", "true-false"].includes(questionType)) {
      return Object.fromEntries(value.map((option) => [String(option), true]));
    }
    if (["fill", "fill-words", "fill-letters", "word-order", "order-sentences"].includes(questionType)) {
      return value.map((entry) => String(entry ?? ""));
    }
    return Object.fromEntries(value.map((entry, index) => [String(index), entry]));
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length && keys.every((key) => /^\d+$/.test(key))) {
      const ordered = keys.sort((left, right) => Number(left) - Number(right));
      const values = ordered.map((key) => value[key]);
      // EduSP uses an object map for boolean alternative states, but expects
      // every indexed textual answer (including unknown fill/cloze types) as an array.
      if (!values.every((entry) => typeof entry === "boolean")) {
        return values.map((entry) => String(entry ?? ""));
      }
    }
    return value;
  }

  if (value === "") return {};
  if (questionType === "fill-letters") {
    return Array.from(String(value));
  }
  if (["fill", "fill-words", "order-sentences", "word-order"].includes(questionType)) {
    return [String(value)];
  }
  if (["multi", "single", "true-false"].includes(questionType)) {
    return { [String(value)]: true };
  }
  return { "0": value };
}

export function normalizeTaskSubmissionAnswers(answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new TypeError("As respostas da atividade estão em formato inválido.");
  }

  const entries = Object.entries(answers);
  if (!entries.length) throw new TypeError("A atividade não contém respostas para enviar.");

  return Object.fromEntries(entries.map(([key, rawItem]) => {
    const item = rawItem && typeof rawItem === "object" && !Array.isArray(rawItem)
      ? rawItem
      : { value: rawItem };
    const questionType = normalizeQuestionType(item.question_type ?? item.type ?? "");
    const questionId = numericId(item.question_id ?? key);
    if (questionId === null || !questionType) {
      throw new TypeError("Uma resposta está sem identificação de questão.");
    }

    const suppliedScore = Number(item.score);
    return [String(questionId), {
      score: Number.isFinite(suppliedScore) ? suppliedScore : 0,
      answer: answerValue(item, questionType),
      question_id: questionId,
      question_type: questionType,
      question_invalid: Boolean(item.question_invalid ?? false),
    }];
  }));
}

export function buildTaskSubmissionPayload({
  taskId,
  studentId,
  studentNick,
  answers,
  essay,
  accessedOn = "room",
  executedOn = "",
  durationSeconds = 0,
}) {
  const id = numericId(studentId);
  const task_id = numericId(taskId);
  const nick = String(studentNick ?? "").trim();
  const seconds = Number(durationSeconds);

  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 0) {
    throw new TypeError("Não foi possível identificar o código do aluno para enviar a atividade.");
  }
  if (typeof task_id !== "number" || !Number.isSafeInteger(task_id) || task_id < 0) {
    throw new TypeError("O identificador da atividade é inválido.");
  }
  if (!nick) throw new TypeError("Não foi possível identificar o aluno para enviar a atividade.");
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new TypeError("O tempo de atividade está inválido.");
  }

  const payload = {
    id,
    nick,
    status: "submitted",
    task_id,
    answers: normalizeTaskSubmissionAnswers(answers),
    accessed_on: String(accessedOn || "room"),
    executed_on: String(executedOn || ""),
    duration: String(Math.floor(seconds)),
    revised_request_count: null,
    task_published: true,
    task_expired: false,
    enable_display_answers: false,
    result_score: 0,
  };
  if (essay && typeof essay === "object") {
    const title = String(essay.title ?? "").trim();
    const body = String(essay.body ?? "").trim();
    if (!title || !body) throw new TypeError("O título e o texto da redação são obrigatórios.");
    payload.title = title;
    payload.body = body;
  }
  return payload;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function answerIdFrom(data) {
  const value = data?.id
    ?? data?.answer_id
    ?? data?.answerId
    ?? data?.data?.id
    ?? data?.data?.answer_id
    ?? data?.answer?.id
    ?? data;
  const id = numericId(value);
  return id === null ? null : id;
}

function hasInvalidApiTokenError(data) {
  return Array.isArray(data?.errors) && data.errors.some((item) =>
    String(item?.field || "").toLowerCase() === "token"
      && String(item?.cause || item?.message || "").toLowerCase() === "invalid token",
  );
}

export async function submitTaskAnswers(input, {
  apiBaseUrl,
  upstreamHeaders = {},
  apiKey = "",
  refreshApiKey = null,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("O envio da atividade não está disponível neste momento.");
  }
  const captchaToken = String(input?.captchaToken ?? "").trim();
  const captchaSessionKey = String(input?.captchaSessionKey ?? "").trim();
  if (!captchaToken || !captchaSessionKey) {
    return {
      resp: { ok: false, status: 403 },
      data: { error: "Resolva um novo CAPTCHA antes de enviar a atividade." },
    };
  }

  let payload;
  try {
    payload = buildTaskSubmissionPayload(input || {});
  } catch (error) {
    return {
      resp: { ok: false, status: 400 },
      data: { error: error instanceof Error ? error.message : "Dados da atividade inválidos." },
    };
  }

  const baseUrl = String(apiBaseUrl ?? "").replace(/\/$/, "");
  if (!baseUrl) throw new TypeError("O endereço da plataforma de atividades não está configurado.");

  const headers = new Headers(upstreamHeaders);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  if (apiKey) headers.set("X-Api-Key", String(apiKey));
  if (!headers.has("X-Api-Key")) {
    throw new TypeError("A chave de acesso da plataforma de atividades não está configurada.");
  }
  headers.set("X-Captcha-Token", captchaToken);
  headers.set("X-Session-Key", captchaSessionKey);

  const createUrl = `${baseUrl}/tms/task/${encodeURIComponent(String(payload.task_id))}/answer`;
  const existingAnswerId = answerIdFrom(input?.answerId);
  const submitUrl = existingAnswerId === null
    ? createUrl
    : `${createUrl}/${encodeURIComponent(String(existingAnswerId))}`;
  let response;
  try {
    response = await fetchImpl(submitUrl, {
      method: existingAnswerId === null ? "POST" : "PUT",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      resp: { ok: false, status: 502 },
      data: { error: "Não foi possível conectar à plataforma para finalizar o envio da atividade." },
      url: submitUrl,
    };
  }

  let requestUrl = submitUrl;
  let submitData = await readJson(response);
  if (!response.ok && response.status === 400 && hasInvalidApiTokenError(submitData) && typeof refreshApiKey === "function") {
    let refreshedApiKey = "";
    try { refreshedApiKey = String(await refreshApiKey({ input, apiKey: String(apiKey) }) || "").trim(); } catch {}
    if (refreshedApiKey && refreshedApiKey !== String(apiKey).trim()) {
      headers.set("X-Api-Key", refreshedApiKey);
      try {
        response = await fetchImpl(submitUrl, {
          method: existingAnswerId === null ? "POST" : "PUT",
          headers,
          body: JSON.stringify(payload),
        });
        requestUrl = submitUrl;
        submitData = await readJson(response);
      } catch {
        return {
          resp: { ok: false, status: 502 },
          data: { error: "Não foi possível reconectar à plataforma para finalizar o envio da atividade." },
          url: submitUrl,
        };
      }
    }
  }
  let returnedStatus = String(
    submitData?.status
      ?? submitData?.answer_status
      ?? submitData?.answer?.status
      ?? submitData?.data?.status
      ?? submitData?.data?.answer?.status
      ?? "",
  ).trim().toLowerCase();
  if (existingAnswerId !== null && (!response.ok || ["draft", "rascunho", "pending"].includes(returnedStatus))) {
    requestUrl = createUrl;
    try {
      response = await fetchImpl(requestUrl, { method: "POST", headers, body: JSON.stringify(payload) });
    } catch {
      return { resp: { ok: false, status: 502 }, data: { error: "Não foi possível conectar à plataforma para finalizar o rascunho da atividade." }, url: requestUrl };
    }
    submitData = await readJson(response);
    returnedStatus = String(
      submitData?.status
        ?? submitData?.answer_status
        ?? submitData?.answer?.status
        ?? submitData?.data?.status
        ?? submitData?.data?.answer?.status
        ?? "",
    ).trim().toLowerCase();
  }
  const savedAsDraft = ["draft", "rascunho"].includes(returnedStatus);
  const statusRejected = REJECTED_STATUSES.has(returnedStatus)
    || savedAsDraft
    || returnedStatus === "pending";
  const ok = Boolean(response.ok && !statusRejected);

  if (!ok) {
    const status = response.ok ? 409 : response.status;
    const error = response.ok
      ? savedAsDraft
        ? "A plataforma salvou a atividade como rascunho; o envio não foi concluído."
        : "A plataforma recebeu o envio, mas ainda não confirmou a atividade como enviada."
      : `A plataforma recusou o envio da atividade (HTTP ${response.status}).`;
    return { resp: { ok: false, status }, data: { error }, url: requestUrl };
  }

  return {
    resp: { ok: true, status: response.status },
    data: { status: returnedStatus || "submitted" },
    url: requestUrl,
  };
}
