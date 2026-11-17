(() => {
  'use strict';
  const WORKER_URL = 'https://sdf.gabrielreplit56.workers.dev';
  const MAX_IMAGE_BYTES = 250 * 1024;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
  const ADMIN_RAS = new Set(['1703202', '17032026']);
  const session = () => { try { return JSON.parse(localStorage.getItem('sed_sessao') || 'null'); } catch { return null; } };
  const headers = () => {
    const current = session() || {};
    const result = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (current.token2) result['X-Token2'] = current.token2;
    if (current.token) result['X-Token'] = current.token;
    if (current.cdUsuarioCurto) result['X-Cd-Usuario'] = current.cdUsuarioCurto;
    if (current.usuario) result['X-Usuario'] = current.usuario;
    const taskUser = current.nome || current.nomeCompleto || current.name || current.apelido || '';
    if (taskUser && !/^\d/.test(String(taskUser).trim())) result['X-Task-User'] = String(taskUser).trim();
    if (isAdmin()) result['X-Admin-User'] = currentRa();
    return result;
  };
  const currentRa = () => String(session()?.usuario || '').replace(/\D/g, '');
  const isAdmin = () => ADMIN_RAS.has(currentRa());
  const raDigits = (value) => String(value ?? '').replace(/\D/g, '');
  const sameRa = (value) => Boolean(currentRa()) && raDigits(value) === currentRa();
  const looksLikeRa = (value) => /^\d+\s*[a-z]{0,2}$/i.test(String(value || '').trim());
  const api = async (path, options = {}) => {
    const response = await fetch(`${WORKER_URL}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || 'Não foi possível concluir a operação.');
    return data;
  };
  const formatDateTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const statusLabel = { aberto: 'Recebido', em_analise: 'Em análise', resolvido: 'Resolvido', arquivado: 'Arquivado' };
  let modal;
  let attachment = '';
  let kind = 'suggestion';
  let view = 'home';
  let requestId = 0;
  const HELP_ROUTE = '/ajuda';
  const TICKET_ROUTE_PREFIX = '/ajuda/a/';
  let routeReturnUrl = '';
  let routeOwned = false;

  function ticketIdFromRoute() {
    if (!window.location.pathname.startsWith(TICKET_ROUTE_PREFIX)) return '';
    try { return decodeURIComponent(window.location.pathname.slice(TICKET_ROUTE_PREFIX.length)); } catch { return ''; }
  }
  function isHelpRoute() { return window.location.pathname === HELP_ROUTE || Boolean(ticketIdFromRoute()); }
  function syncHelpRoute(ticketId = '', replace = false) {
    const path = ticketId ? `${TICKET_ROUTE_PREFIX}${encodeURIComponent(String(ticketId))}` : HELP_ROUTE;
    if (window.location.pathname === path) return;
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({ ...(window.history.state || {}), sedxHelpRoute: true }, '', path);
  }
  function navigateToTicket(id) { syncHelpRoute(id); }
  function navigateToHelp() { syncHelpRoute('', true); }

  function close() {
    requestId += 1;
    if (routeOwned && isHelpRoute() && routeReturnUrl) window.history.replaceState({}, '', routeReturnUrl);
    modal?.remove();
    modal = null;
    view = 'home';
    routeOwned = false;
    routeReturnUrl = '';
    document.body.classList.remove('feedback-modal-open');
    document.removeEventListener('keydown', onKeydown);
  }
  function onKeydown(event) { if (event.key === 'Escape') close(); }
  function setError(message) {
    const node = modal?.querySelector('[data-feedback-error]');
    if (node) { node.textContent = message || ''; node.hidden = !message; }
  }
  function setKind(value) {
    kind = value;
    modal?.querySelectorAll('[data-feedback-kind]').forEach((button) => button.classList.toggle('is-active', button.dataset.feedbackKind === value));
  }
  function header(title, subtitle, backAction = 'close') {
    return `<header class="help-center-header"><button type="button" class="help-center-back" data-feedback-back="${backAction}" aria-label="${backAction === 'home' ? 'Voltar à Central de ajuda' : 'Fechar Central de ajuda'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7"/></svg></button><div class="help-center-heading"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div></header>`;
  }
  function shell() {
    return `<div class="sedx-feedback-backdrop" data-feedback-modal><section class="sedx-feedback-modal sedx-help-center" role="dialog" aria-modal="true" aria-label="Central de ajuda"></section></div>`;
  }
  function currentName() {
    const current = session() || {};
    const fullName = String([current.nome, current.nomeCompleto, current.name, current.apelido].find((value) => value && !looksLikeRa(value)) || current.usuario || 'aluno').trim();
    return { fullName, firstName: fullName.split(/\s+/)[0] || 'aluno' };
  }
  function safeImageUrl(value) {
    const url = String(value || '').trim();
    return /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(url) || /^https:\/\/[^\s"'<>]+$/i.test(url) ? url : '';
  }
  function ticketCard(item, adminList = false) {
    const type = item.type === 'bug' ? 'Problema' : 'Sugestão ou dúvida';
    const status = statusLabel[item.status] || 'Recebido';
    const id = String(item.id ?? '');
    const image = safeImageUrl(item.image);
    const owner = adminList ? `<p class="help-ticket-owner">${profileAvatarMarkup(item.userRa, item.userName)}<span><span class="help-ticket-owner-name">${escapeHtml(item.userName || 'Aluno')}</span><span class="help-ticket-owner-ra">RA ${escapeHtml(item.userRa || '')}</span></span></p>` : '';
    return `<article class="help-ticket is-clickable" data-feedback-open="${escapeHtml(id)}" tabindex="0" role="button" aria-label="Abrir atendimento #${escapeHtml(id.slice(-6))} em tela cheia">${owner}<div class="help-ticket-top"><span class="help-ticket-kind ${item.type === 'bug' ? 'is-problem' : ''}">${type}</span><span class="help-ticket-status status-${escapeHtml(item.status || 'aberto')}">${escapeHtml(status)}</span></div><p class="help-ticket-message">${escapeHtml(item.content)}</p>${image ? `<a class="help-ticket-image-link" href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer"><img class="help-ticket-image" src="${escapeHtml(image)}" alt="Imagem anexada ao atendimento" loading="lazy"></a>` : ''}<div class="help-ticket-meta"><time>${escapeHtml(formatDate(item.createdAt))}</time><span>Atendimento #${escapeHtml(id.slice(-6) || '—')}</span></div>${item.adminReply ? `<div class="help-ticket-reply"><strong>Resposta da equipe SEDX</strong><p>${escapeHtml(item.adminReply)}</p></div>` : ''}<span class="help-ticket-open">Abrir atendimento →</span></article>`;
  }
  function homeMarkup({ items = [], loading = false, error = '', notice = '', adminItems = [], adminError = '' } = {}) {
    const { firstName } = currentName();
    const count = loading ? '…' : String(items.length);
    let content;
    if (loading) {
      content = '<div class="help-state"><span class="help-spinner" aria-hidden="true"></span><strong>Carregando seus atendimentos</strong></div>';
    } else if (error) {
      content = `<div class="help-state help-state-error"><strong>Não foi possível carregar seus atendimentos</strong><p>${escapeHtml(error)}</p><button type="button" class="help-retry" data-feedback-retry>Tentar novamente</button></div>`;
    } else if (!items.length) {
      content = '<div class="help-state help-empty"><svg class="help-empty-icon" viewBox="0 0 56 56" aria-hidden="true"><path d="M8 9h33a4 4 0 0 1 4 4v25a4 4 0 0 1-4 4H21L8 52v-9a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4Z"/><path d="M18 18h18M18 25h13"/></svg><strong>Nenhum atendimento</strong><p>Suas conversas com o suporte aparecerão aqui.</p></div>';
    } else {
      content = `<div class="help-ticket-list">${items.map((item) => ticketCard(item)).join('')}</div>`;
    }
    let adminSection = '';
    if (isAdmin()) {
      const list = adminItems || [];
      const adminContent = loading ? '<div class="help-state"><span class="help-spinner" aria-hidden="true"></span><strong>Carregando atendimentos dos alunos</strong></div>' : adminError ? `<div class="help-state help-state-error"><strong>Não foi possível carregar os atendimentos dos alunos</strong><p>${escapeHtml(adminError)}</p></div>` : list.length ? `<div class="help-ticket-list">${list.map((item) => ticketCard(item, true)).join('')}</div>` : '<div class="help-state help-empty"><strong>Nenhum atendimento dos alunos</strong></div>';
      adminSection = `<div class="help-section-heading help-admin-heading"><h2>Atendimentos dos alunos</h2><span>${loading ? '…' : list.length} · Administrador</span></div><section class="help-tickets-area">${adminContent}</section>`;
    }
    modal.querySelector('.sedx-feedback-modal').innerHTML = `${header('Central de ajuda', 'Atendimento SEDX')}<main class="help-center-content"><section class="help-welcome"><div class="help-welcome-person"><span class="help-welcome-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 12H3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v-7H4Zm16 0h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2v-7h1ZM8 19h5"/><path d="M9 11h.01M15 11h.01"/></svg></span><div><h2>Olá, ${escapeHtml(firstName)}</h2><p>Conte com a equipe do SEDX</p></div></div><button type="button" class="help-new-ticket" data-feedback-new><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16v15h-9l-6 4V3Z"/><path d="M12 7v7m-3.5-3.5h7"/></svg><span>Abrir novo atendimento</span></button></section><div class="help-section-heading"><h2>Seus atendimentos</h2><span>${count} ${items.length === 1 ? 'atendimento' : 'atendimentos'}</span></div>${notice ? `<p class="help-success-notice" role="status">${escapeHtml(notice)}</p>` : ''}<section class="help-tickets-area" aria-live="polite">${content}</section>${adminSection}</main>`;
    bindHome();
  }
  async function renderHome(notice = '') {
    view = 'home';
    navigateToHelp();
    const currentRequest = ++requestId;
    homeMarkup({ loading: true });
    try {
      const [data, adminData] = await Promise.all([
        api('/feedback/mine'),
        isAdmin() ? api('/admin/feedback').then((value) => ({ value }), (error) => ({ error: error.message || 'Tente novamente.' })) : Promise.resolve(null),
      ]);
      if (!modal || view !== 'home' || currentRequest !== requestId) return;
      homeMarkup({ items: Array.isArray(data.feedback) ? data.feedback : [], notice, adminItems: Array.isArray(adminData?.value?.feedback) ? adminData.value.feedback : [], adminError: adminData?.error || '' });
    } catch (error) {
      if (!modal || view !== 'home' || currentRequest !== requestId) return;
      homeMarkup({ error: error.message || 'Tente novamente em instantes.' });
    }
  }
  function newFormMarkup() {
    const { fullName } = currentName();
    modal.querySelector('.sedx-feedback-modal').innerHTML = `${header('Novo atendimento', 'Conte como podemos ajudar', 'home')}<main class="help-center-content help-form-content"><section class="help-form-card"><p class="feedback-sender">Enviando como <strong>${escapeHtml(fullName)}</strong><span>· RA ${escapeHtml(session()?.usuario || 'não identificado')}</span></p><h2>O que aconteceu?</h2><p class="help-form-intro">Descreva sua dúvida, sugestão ou problema. A equipe do SEDX responderá por aqui.</p><div class="feedback-kind-row help-kind-row"><button type="button" class="feedback-kind is-active" data-feedback-kind="suggestion"><span aria-hidden="true">✦</span>Sugestão ou dúvida</button><button type="button" class="feedback-kind" data-feedback-kind="bug"><span aria-hidden="true">⚑</span>Problema</button></div><form data-feedback-form><label class="feedback-field"><span class="sr-only">Descreva como podemos ajudar</span><textarea name="content" maxlength="2000" minlength="10" required placeholder="Escreva sua mensagem..." aria-label="Descreva como podemos ajudar"></textarea><small><b data-feedback-count>0</b>/2000 · mínimo de 10 caracteres</small></label><label class="feedback-attachment"><input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif" hidden><span aria-hidden="true">▧</span><span data-feedback-file-label>Anexar imagem <em>(opcional)</em></span></label><div class="feedback-preview" data-feedback-preview hidden></div><p class="feedback-error" data-feedback-error role="alert" hidden></p><footer class="feedback-actions"><button type="button" class="feedback-cancel" data-feedback-back="home">Voltar</button><button type="submit" class="feedback-submit" disabled>Enviar atendimento</button></footer></form></section></main>`;
    bindForm();
  }
  function openNewForm() { view = 'form'; requestId += 1; attachment = ''; kind = 'suggestion'; newFormMarkup(); }
  function bindBack() {
    modal?.querySelectorAll('[data-feedback-back]').forEach((button) => button.addEventListener('click', () => {
      if (button.dataset.feedbackBack === 'home') renderHome(); else close();
    }));
  }
  function bindHome() {
    bindBack();
    modal?.querySelector('[data-feedback-new]')?.addEventListener('click', openNewForm);
    modal?.querySelector('[data-feedback-retry]')?.addEventListener('click', () => renderHome());
    modal?.querySelectorAll('[data-feedback-open]').forEach((card) => {
      const open = () => { navigateToTicket(card.dataset.feedbackOpen); renderTicket(card.dataset.feedbackOpen); };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
  }
  function formatHelpMarkdown(value) {
    const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let listType = '';
    const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = ''; } };
    const inline = (text) => escapeHtml(text).replace(/(https:\/\/[^\s<]+)/gi, (match) => { const suffix = match.match(/[.,!?;:)\]]+$/)?.[0] || ''; const url = suffix ? match.slice(0, -suffix.length) : match; return `<a class=\"help-msg-link\" href=\"${url}\" target=\"_blank\" rel=\"noopener noreferrer\">${url}</a>${suffix}`; }).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { closeList(); if (out.length && !out[out.length - 1].endsWith('</p>') && !out[out.length - 1].endsWith('</li>')) out.push('<br>'); continue; }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) { closeList(); out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue; }
      const ordered = line.match(/^\d+[.)]\s+(.+)$/);
      const unordered = line.match(/^(?:[-*•])\s+(.+)$/);
      if (ordered || unordered) {
        const wanted = ordered ? 'ol' : 'ul';
        if (listType !== wanted) { closeList(); listType = wanted; out.push(`<${listType}>`); }
        out.push(`<li>${inline((ordered || unordered)[1])}</li>`); continue;
      }
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
    closeList();
    return out.join('');
  }

  function sharedProfile() { try { const current = session() || {}; const ra = String(current.usuario || current.ra || 'visitante').replace(/[^a-zA-Z0-9_-]/g, '_'); return JSON.parse(localStorage.getItem(`sedx-profile-preferences-v1:${ra}`) || '{}'); } catch { return {}; } }
  function sharedProfilePhoto() { return String(sharedProfile().photo || ''); }
  function profilePhotoForRa(value) { const ra = raDigits(value); return ra ? `https://sdf.gabrielreplit56.workers.dev/profile/avatar/${encodeURIComponent(ra)}` : ''; }
  function sharedProfileInitials(name) { return String(name || 'Aluno').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'AL'; }
  function profileAvatarMarkup(ra, name, fallbackPhoto = '') { const photo = profilePhotoForRa(ra) || fallbackPhoto; const initials = escapeHtml(sharedProfileInitials(name)); return `<span class=\"help-msg-avatar\"><span>${initials}</span>${photo ? `<img src=\"${escapeHtml(photo)}\" alt=\"\" onerror=\"this.remove()\">` : ''}</span>`; }
  function messageBubble(message, adminViewer = false) {
    const admin = message.authorRole === 'admin';
    const current = session() || {};
    const mine = Boolean(message.mine) || sameRa(message.authorRa || message.userRa || message.ra || '');
    const rawName = mine ? (current.nome || current.nomeCompleto || current.name || current.apelido || '') : (message.authorName || message.userName || message.nomeUsuario || message.nome || message.name || '');
    const otherName = message.authorName || message.userName || message.nomeUsuario || message.nome || message.name || '';
    const fullName = String((rawName && !looksLikeRa(rawName) ? rawName : (!looksLikeRa(otherName) ? otherName : '')) || (admin ? 'Equipe SEDX' : 'Aluno')).trim() || (admin ? 'Equipe SEDX' : 'Aluno');
    const ra = raDigits(message.authorRa ?? message.userRa ?? message.ra ?? message.RA ?? '');
    const who = admin ? 'Equipe SEDX' : fullName;
    const profilePhoto = !admin && (profilePhotoForRa(ra) || (mine || ra === raDigits(session()?.usuario || session()?.ra || '') ? sharedProfilePhoto() : '')); const identity = admin ? `<strong class="help-msg-author">${escapeHtml(who)}</strong>` : `<span class="help-msg-identity">${profileAvatarMarkup(ra, who, profilePhoto)}<span><strong class="help-msg-author">${escapeHtml(who)}</strong>${ra ? `<span class="help-msg-ra">RA ${escapeHtml(ra)}</span>` : ''}</span></span>`;
    const cls = `help-msg ${mine ? 'is-mine' : ''} ${admin ? 'is-admin' : ''}`;
    if (message.deleted) return `<div class="${cls} is-deleted">${identity}<p class="help-msg-text"><em>Mensagem excluída</em></p><span class="help-msg-meta">${escapeHtml(formatDateTime(message.createdAt))}</span></div>`;
    const canDeleteAssistant = adminViewer && message.authorRole === 'admin' && message.authorRa === 'assistente';
    const actions = mine || canDeleteAssistant ? `<div class="help-msg-actions">${mine ? '<button type="button" data-msg-edit="' + escapeHtml(message.id) + '">Editar</button>' : ''}<button type="button" data-msg-delete="${escapeHtml(message.id)}">Excluir</button></div>` : '';
    return `<div class="${cls}" data-msg-id="${escapeHtml(message.id)}">${identity}<div class="help-msg-text">${formatHelpMarkdown(message.content)}</div><span class="help-msg-meta">${escapeHtml(formatDateTime(message.createdAt))}${message.editedAt ? ' · editada' : ''}</span>${actions}</div>`;
  }
  async function renderTicket(id, scrollToEnd = false) {
    view = 'ticket';
    syncHelpRoute(id, true);
    const currentRequest = ++requestId;
    const box = modal?.querySelector('.sedx-feedback-modal');
    if (!box) return;
    box.innerHTML = `${header('Atendimento', 'Carregando…', 'home')}<main class="help-center-content"><div class="help-state"><span class="help-spinner" aria-hidden="true"></span><strong>Abrindo atendimento</strong></div></main>`;
    bindBack();
    let data;
    try { data = await api(`/feedback/ticket?id=${encodeURIComponent(id)}`); }
    catch (error) {
      if (!modal || view !== 'ticket' || currentRequest !== requestId) return;
      navigateToHelp();
      box.innerHTML = `${header('Atendimento', 'Central de ajuda', 'home')}<main class="help-center-content"><div class="help-state help-state-error"><strong>Não foi possível abrir o atendimento</strong><p>${escapeHtml(error.message)}</p></div></main>`;
      bindBack();
      return;
    }
    if (!modal || view !== 'ticket' || currentRequest !== requestId) return;
    const ticket = data.ticket || {};
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const image = safeImageUrl(ticket.image);
    const type = ticket.type === 'bug' ? 'Problema' : 'Sugestão ou dúvida';
    const ownerMine = sameRa(ticket.userRa ?? ticket.userRA ?? ticket.ra ?? ticket.RA ?? ticket.usuarioRa);
    const sessionFullName = ownerMine ? currentName().fullName : '';
    const ticketName = [ticket.userName, ticket.nomeUsuario, ticket.nome, ticket.name].find((value) => value && !looksLikeRa(value));
    const creatorName = String((ownerMine && sessionFullName && !looksLikeRa(sessionFullName) ? sessionFullName : '') || ticketName || ticket.nomeUsuario || ticket.nome || ticket.name || 'Aluno').trim() || 'Aluno';
    const creatorRa = raDigits(ticket.userRa ?? ticket.userRA ?? ticket.ra ?? ticket.RA ?? ticket.usuarioRa ?? '');
    const creatorPhoto = creatorRa && creatorRa === raDigits(session()?.usuario || session()?.ra || '') ? sharedProfilePhoto() : ''; const creatorIdentity = `<span class="help-msg-identity">${profileAvatarMarkup(creatorRa, creatorName, creatorPhoto)}<span><strong class="help-msg-author">${escapeHtml(creatorName)}</strong>${creatorRa ? `<span class="help-msg-ra">RA ${escapeHtml(creatorRa)}</span>` : ''}</span></span>`;
    const original = `<div class="help-msg ${ownerMine ? 'is-mine' : ''} is-original">${creatorIdentity}<div class="help-msg-text">${formatHelpMarkdown(ticket.content)}</div>${image ? `<a class="help-ticket-image-link" href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer"><img class="help-ticket-image" src="${escapeHtml(image)}" alt="Imagem anexada ao atendimento" loading="lazy"></a>` : ''}<span class="help-msg-meta">${escapeHtml(formatDateTime(ticket.createdAt))}</span></div>`;
    const legacy = ticket.adminReply && !messages.some((message) => message.authorRole === 'admin') ? `<div class="help-msg is-admin"><strong class="help-msg-author">Equipe SEDX</strong><div class="help-msg-text">${formatHelpMarkdown(ticket.adminReply)}</div></div>` : '';
    const adminTools = data.admin ? '<div class="help-ticket-admin-tools"><button type="button" class="help-delete-ticket" data-ticket-delete>Excluir atendimento</button></div>' : '';
    box.innerHTML = `${header(`Atendimento #${String(ticket.id || '').slice(-6)}`, `${type} · ${statusLabel[ticket.status] || 'Recebido'}`, 'home')}<main class="help-center-content help-thread-content">${adminTools}<section class="help-thread" aria-live="polite">${original}${legacy}${messages.map((message) => messageBubble(message, Boolean(data.admin))).join('')}</section><p class="feedback-error" data-feedback-error role="alert" hidden></p><form class="help-composer" data-msg-form><textarea name="content" maxlength="2000" required placeholder="Escreva uma mensagem..." aria-label="Escreva uma mensagem"></textarea><button type="submit" class="feedback-submit" disabled>Enviar</button></form></main>`;
    bindBack();
    const thread = box.querySelector('.help-thread');
    if (scrollToEnd) box.scrollTop = box.scrollHeight;
    const form = box.querySelector('[data-msg-form]');
    const textarea = form.querySelector('textarea');
    const submit = form.querySelector('[type="submit"]');
    textarea.addEventListener('input', () => { submit.disabled = !textarea.value.trim(); });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setError('');
      submit.disabled = true;
      try { await api('/feedback/message', { method: 'POST', body: JSON.stringify({ ticketId: ticket.id, content: textarea.value.trim() }) }); await renderTicket(ticket.id, true); }
      catch (error) { setError(error.message); submit.disabled = false; }
    });
    thread.querySelectorAll('[data-msg-delete]').forEach((button) => button.addEventListener('click', async () => {
      if (!window.confirm('Excluir esta mensagem?')) return;
      try { await api(`/feedback/message?id=${encodeURIComponent(button.dataset.msgDelete)}`, { method: 'DELETE' }); await renderTicket(ticket.id); }
      catch (error) { setError(error.message); }
    }));
    thread.querySelectorAll('[data-msg-edit]').forEach((button) => button.addEventListener('click', () => {
      const message = messages.find((item) => item.id === button.dataset.msgEdit);
      const bubble = button.closest('.help-msg');
      if (!message || !bubble) return;
      bubble.innerHTML = `<textarea class="help-msg-edit" maxlength="2000" aria-label="Editar mensagem">${escapeHtml(message.content)}</textarea><div class="help-msg-actions"><button type="button" data-msg-cancel>Cancelar</button><button type="button" data-msg-save>Salvar</button></div>`;
      const editor = bubble.querySelector('textarea');
      editor.focus();
      bubble.querySelector('[data-msg-cancel]').addEventListener('click', () => renderTicket(ticket.id));
      bubble.querySelector('[data-msg-save]').addEventListener('click', async () => {
        const content = editor.value.trim();
        if (!content) { setError('A mensagem não pode ficar vazia.'); return; }
        try { await api('/feedback/message', { method: 'PUT', body: JSON.stringify({ id: message.id, content }) }); await renderTicket(ticket.id); }
        catch (error) { setError(error.message); }
      });
    }));
    box.querySelector('[data-ticket-delete]')?.addEventListener('click', async () => {
      if (!window.confirm('Excluir este atendimento e todas as mensagens? Esta ação não pode ser desfeita.')) return;
      try { await api(`/admin/feedback?id=${encodeURIComponent(ticket.id)}`, { method: 'DELETE' }); await renderHome('Atendimento excluído.'); }
      catch (error) { setError(error.message); }
    });
  }
  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      if (!file.type.startsWith('image/')) return reject(new Error('Escolha uma imagem válida.'));
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const scale = Math.min(1, 1000 / image.width, 1000 / image.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          let quality = .84;
          let data = canvas.toDataURL('image/jpeg', quality);
          while (data.length * .75 > MAX_IMAGE_BYTES && quality > .3) { quality -= .08; data = canvas.toDataURL('image/jpeg', quality); }
          if (data.length * .75 > MAX_IMAGE_BYTES) reject(new Error('A imagem precisa ter até 250 KB.'));
          else resolve(data);
        };
        image.onerror = () => reject(new Error('Não foi possível processar a imagem.'));
        image.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      reader.readAsDataURL(file);
    });
  }
  function bindForm() {
    bindBack();
    modal?.querySelectorAll('[data-feedback-kind]').forEach((button) => button.addEventListener('click', () => setKind(button.dataset.feedbackKind)));
    const form = modal?.querySelector('[data-feedback-form]');
    if (!form) return;
    const textarea = form.querySelector('textarea');
    const submit = form.querySelector('[type="submit"]');
    const count = form.querySelector('[data-feedback-count]');
    const file = form.querySelector('input[type="file"]');
    const label = form.querySelector('[data-feedback-file-label]');
    const preview = form.querySelector('[data-feedback-preview]');
    textarea.addEventListener('input', () => { count.textContent = textarea.value.length; submit.disabled = textarea.value.trim().length < 10; });
    file.addEventListener('change', async () => {
      setError('');
      try {
        attachment = await readImage(file.files?.[0]);
        label.textContent = attachment ? 'Imagem anexada' : 'Anexar imagem (opcional)';
        preview.hidden = !attachment;
        preview.innerHTML = attachment ? `<img src="${attachment}" alt="Prévia do anexo"><button type="button" data-feedback-remove>Remover</button>` : '';
        preview.querySelector('[data-feedback-remove]')?.addEventListener('click', () => { attachment = ''; file.value = ''; label.textContent = 'Anexar imagem (opcional)'; preview.hidden = true; });
      } catch (error) { attachment = ''; file.value = ''; setError(error.message); }
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setError('');
      submit.disabled = true;
      submit.textContent = 'Enviando…';
      try {
        await api('/feedback', { method: 'POST', body: JSON.stringify({ type: kind, content: textarea.value.trim(), image: attachment }) });
        attachment = '';
        await renderHome('Atendimento enviado. A equipe do SEDX responderá por aqui.');
      } catch (error) {
        setError(error.message || 'Não foi possível enviar o atendimento.');
        submit.disabled = false;
        submit.textContent = 'Enviar atendimento';
      }
    });
    textarea.focus();
  }
  window.openSedxFeedbackModal = (ticketId) => {
    if (!session()?.token2) { window.alert('Faça login para acessar a Central de ajuda.'); return; }
    attachment = '';
    kind = 'suggestion';
    requestId += 1;
    if (!routeOwned) routeReturnUrl = window.location.href;
    routeOwned = true;
    modal?.remove();
    document.body.insertAdjacentHTML('beforeend', shell());
    modal = document.querySelector('[data-feedback-modal]');
    document.body.classList.add('feedback-modal-open');
    document.addEventListener('keydown', onKeydown);
    if (typeof ticketId === 'string' && ticketId) { syncHelpRoute(ticketId, true); renderTicket(ticketId); } else renderHome();
  };
  window.openSedxFeedbackTicket = (ticketId) => window.openSedxFeedbackModal(String(ticketId || ''));
  window.closeSedxFeedbackModal = close;

  window.addEventListener('popstate', () => {
    if (!isHelpRoute()) { if (modal) close(); return; }
    if (!modal) { window.openSedxFeedbackModal(ticketIdFromRoute() || undefined); return; }
    const ticketId = ticketIdFromRoute();
    if (ticketId) renderTicket(ticketId); else renderHome();
  });

  if (isHelpRoute()) window.setTimeout(() => window.openSedxFeedbackModal(ticketIdFromRoute() || undefined), 0);
})();
