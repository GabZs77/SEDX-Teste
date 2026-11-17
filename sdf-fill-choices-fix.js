/* Isolated reader for nested EduSP word banks; keeps the app bundle unchanged. */
(function () {
  var fields = /^(options?|choices?|words?|word_options|wordOptions|word_list|wordList|available_words|availableWords|word_bank|wordBank|bank|alternatives?|alternativas|opcoes|terms|tokens|answers?|correct|respostas?)$/i;
  var containers = /^(raw|content|question|data|payload|items|gaps|blanks)$/i;
  function choices(question) {
    var out = [], seen = new Set(), visited = new Set();
    function add(value) {
      if (value == null || typeof value === 'boolean') return;
      if (Array.isArray(value)) { value.forEach(add); return; }
      if (typeof value === 'object') {
        var label = value.text ?? value.label ?? value.word ?? value.name ?? value.statement ?? value.value;
        if (label != null) add(label);
        else Object.keys(value).forEach(function (key) { if (!/^(id|key|index|fixed|type|score)$/i.test(key)) add(value[key]); });
        return;
      }
      var node = document.createElement('div');
      node.innerHTML = String(value);
      var word = (node.textContent || '').trim();
      if (!word || /^_{2,}$/.test(word) || seen.has(word)) return;
      seen.add(word); out.push(word);
    }
    function walk(value, offered) {
      if (value == null) return;
      if (typeof value !== 'object') { if (offered) add(value); return; }
      if (visited.has(value)) return;
      visited.add(value);
      if (Array.isArray(value)) { value.forEach(function (item) { walk(item, offered); }); return; }
      if (value.fixed === true || value.fixed === 1 || value.fixed === 'true') return;
      var gap = value.fixed === false || value.fixed === 0 || value.fixed === 'false' || value.gap === true || value.blank === true || value.type === 'blank';
      if (offered && !Object.keys(value).some(function (key) { return fields.test(key) || /^(phrase|sentences)$/i.test(key); })) add(value);
      Object.keys(value).forEach(function (key) {
        var child = value[key];
        if (fields.test(key)) walk(child, true);
        else if (/^(phrase|sentences)$/i.test(key)) walk(child, false);
        else if (containers.test(key)) walk(child, offered);
        else if (gap && /^(value|text|word|label)$/i.test(key)) add(child);
        else if (offered && /^\d+$/.test(key)) walk(child, true);
      });
    }
    walk(question && question.raw ? question.raw : question, false);
    if (question) ['words', 'choices', 'word_bank'].forEach(function (key) { walk(question[key], true); });
    return out;
  }
  function isSentenceQuestion(question) {
    return String(question && (question.rawType || question.raw && (question.raw.question_type || question.raw.type) || question.type) || '').trim().toLowerCase().replace(/[_\s]+/g, '-') === 'order-sentences';
  }
  function sentenceText(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return null;
    var label = value.value ?? value.text ?? value.statement ?? value.label ?? value.name ?? value.word;
    return typeof label === 'string' ? label : null;
  }
  function sentenceBank(question) {
    var root = question && question.raw || question;
    var visited = new Set();
    function read(value) {
      if (!value || typeof value !== 'object' || visited.has(value)) return [];
      visited.add(value);
      if (Array.isArray(value)) {
        var labels = value.map(sentenceText);
        if (labels.length && labels.every(function (label) { return label !== null; })) return labels;
        return [];
      }
      for (var key of ['sentences', 'phrase', 'words', 'items', 'choices', 'options', 'word_bank', 'wordBank']) {
        var bank = read(value[key]);
        if (bank.length) return bank;
      }
      var keys = Object.keys(value);
      if (keys.length && keys.every(function (key) { return /^\d+$/.test(key); })) {
        var labels = keys.sort(function (a, b) { return Number(a) - Number(b); }).map(function (key) { return sentenceText(value[key]); });
        if (labels.every(function (label) { return label !== null; })) return labels;
      }
      for (var key of ['content', 'question', 'data', 'payload']) {
        var bank = read(value[key]);
        if (bank.length) return bank;
      }
      return [];
    }
    return read(root);
  }
  function visibleSentence(value) {
    var node = document.createElement('div');
    node.innerHTML = value;
    return (node.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function sentenceAnswer(question, answer) {
    var bank = sentenceBank(question);
    if (!bank.length) throw new Error('As frases originais desta questão não foram carregadas. Abra a atividade novamente.');
    if (!Array.isArray(answer) || answer.length !== bank.length) throw new Error('Ordene todas as frases desta questão, incluindo as repetidas, antes de enviar.');
    var used = new Set();
    return answer.map(function (value) {
      var index = bank.findIndex(function (original, i) { return !used.has(i) && original === value; });
      if (index < 0) {
        var matches = bank.map(function (original, i) { return !used.has(i) && visibleSentence(original) === visibleSentence(String(value)) ? i : -1; }).filter(function (i) { return i >= 0; });
        if (matches.length && matches.every(function (i) { return bank[i] === bank[matches[0]]; })) index = matches[0];
      }
      if (index < 0) throw new Error('Uma frase foi alterada ou repetida além do permitido. Selecione novamente as frases originais.');
      used.add(index);
      return bank[index];
    });
  }
  window.__sdfSentenceOrder = { isQuestion: isSentenceQuestion, bank: sentenceBank, answer: sentenceAnswer };
  window.__sdfGapChoices = choices;
})();
