(() => {
  'use strict';
  const WORKER_URL = 'https://sdf.gabrielreplit56.workers.dev';
  const TAB_PARAM = 'sedxTab';
  const TAB_VALUE = 'chat';
  const COMMUNITY_ROUTE = '/comunidade';
  const channelRoute = (channel) => channel === 'general' ? `${COMMUNITY_ROUTE}/geral` : channel === 'announcements' ? `${COMMUNITY_ROUTE}/anuncios` : channel === 'voice' ? `${COMMUNITY_ROUTE}/voz` : COMMUNITY_ROUTE;
  const channelFromRoute = () => { const path = location.pathname; if (path === `${COMMUNITY_ROUTE}/geral`) return 'general'; if (path === `${COMMUNITY_ROUTE}/anuncios`) return 'announcements'; if (path === `${COMMUNITY_ROUTE}/voz`) return 'voice'; return 'channels'; };
  const isCommunityRoute = () => location.pathname === COMMUNITY_ROUTE || location.pathname.startsWith(`${COMMUNITY_ROUTE}/`);
  const ADMIN_RAS = new Set(['1703202', '17032026']);
  const POLL_MS = 5000;
  let overlay = null;
  let returnUrl = '';
  let messages = [];
  let mediaRecorder = null;
  let audioChunks = [];
  let pollTimer = null;
  let loading = false;
  let pendingAttachment = null;
  let pendingAudio = null;
  let replyingTo = null;
  let swipeState = null;
  let disposeAnnouncements = null;
  let currentView = '';
  let voiceRoomCleanup = null;
  const CHANNEL_PARAM = 'channel';

  function unmountVoiceRoom() {
    const cleanup = voiceRoomCleanup;
    voiceRoomCleanup = null;
    if (typeof cleanup === 'function') { try { cleanup(); } catch { /* limpeza best-effort */ } }
  }

  const lucide = (name, size = 18) => {
    const paths = {
      'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M5 12h14"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/>',
      'users-round': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      folder: '<path d="M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z"/>',
      megaphone: '<path d="m3 11 18-5v12L3 14zM7 15l1 6h4l-2-5M3 11v3"/>',
      headphones: '<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="3" y="12" width="4" height="9" rx="2"/><rect x="17" y="12" width="4" height="9" rx="2"/>',
      'chevron-right': '<path d="m9 18 6-6-6-6"/>',
      'chevron-up': '<path d="m6 15 6-6 6 6"/>',
      message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
      mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/><path d="M8 22h8"/>',
    };
    return `<svg class="lucide-chat-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const session = () => { try { return JSON.parse(localStorage.getItem('sed_sessao') || 'null'); } catch { return null; } };
  const profilePrefs = () => { try { const ra = String(session()?.usuario || session()?.ra || 'visitante').replace(/[^a-zA-Z0-9_-]/g, '_'); return JSON.parse(localStorage.getItem(`sedx-profile-preferences-v1:${ra}`) || '{}'); } catch { return {}; } };
  const profileAvatar = () => String(profilePrefs().photo || '');
  window.addEventListener('sedx-profile-updated', (event) => {
    const mark = document.querySelector('.community-user-mark');
    if (mark) { const photo = profileAvatar(); mark.innerHTML = photo ? `<img src="${esc(photo)}" alt="Foto do perfil">` : esc(initials({ name: session()?.nome })); }
    if (typeof renderMessages === 'function' && overlay?.querySelector('[data-chat-messages]')) renderMessages(false);
    if (typeof api === 'function') void api('/chat/profile', { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ avatarUrl: event.detail?.photo || '' }) }).catch(() => {});
  });
  const currentRa = () => String(session()?.usuario || session()?.ra || '').replace(/\D/g, '');
  const isAdmin = () => ADMIN_RAS.has(currentRa());
  const authHeaders = (json = false) => {
    const current = session() || {};
    const result = new Headers({ Accept: 'application/json' });
    if (json) result.set('Content-Type', 'application/json');
    if (current.token2) result.set('X-Token2', current.token2);
    if (current.token) result.set('X-Token', current.token);
    if (current.usuario) result.set('X-Usuario', current.usuario);
    if (current.nome) result.set('X-Task-User', current.nome);
    if (current.cdUsuarioCurto) result.set('X-Cd-Usuario', current.cdUsuarioCurto);
    if (isAdmin()) result.set('X-Admin-User', currentRa());
    return result;
  };
  const api = async (path, options = {}) => {
    const response = await fetch(`${WORKER_URL}${path}`, { cache: 'no-store', ...options, headers: options.headers || authHeaders(Boolean(options.body && typeof options.body === 'string')) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || data.error || `Não foi possível concluir a operação (${response.status}).`);
    return data;
  };
  const displayName = (user = {}) => {
    let rawName = user.name || user.nome || user.displayName || 'Aluno';
    if (/^\d+[A-Z]{0,2}$/i.test(String(rawName).trim()) && String(user.ra || user.authorRa || '') === currentRa()) rawName = session()?.nome || rawName;
    const parts = String(rawName).trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
    return parts.length > 1 ? `${parts[0]} ${parts[1].charAt(0)}.` : parts[0] || 'Aluno';
  };
  const initials = (user = {}) => displayName(user).replace(/\.$/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'A';
  const avatar = (user = {}) => user.avatarUrl || user.avatar || user.photoURL || user.foto || (String(user.authorRa || user.userRa || user.ra || '') === currentRa() ? profileAvatar() : '');
  const urlWithoutTab = () => {
    const params = new URLSearchParams(location.search); params.delete(TAB_PARAM); params.delete(CHANNEL_PARAM);
    const query = params.toString(); return `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
  };
  const setNavActive = (active) => document.querySelectorAll('[data-sedx-platform-link]').forEach((link) => {
    link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  function injectNavLinks() {
    const rail = document.querySelector('.side-rail .rail-nav');
    if (rail && !rail.querySelector('[data-sedx-platform-link]')) { const link = document.createElement('button'); link.type = 'button'; link.className = 'rail-link sedx-platforms-nav-link'; link.dataset.sedxPlatformLink = 'desktop'; link.setAttribute('aria-label', 'Abrir Comunidade'); link.innerHTML = `<span class="platform-nav-icon" aria-hidden="true">${lucide('message', 19)}</span><span>Comunidade</span>`; const first = rail.querySelector('.rail-link'); if (first) first.after(link); else rail.appendChild(link); }
    const bottom = document.querySelector('.bottom-nav');
    if (bottom && !bottom.querySelector('[data-sedx-platform-link]')) { const link = document.createElement('button'); link.type = 'button'; link.className = 'bottom-link sedx-platforms-bottom-link'; link.dataset.sedxPlatformLink = 'mobile'; link.setAttribute('aria-label', 'Abrir Comunidade'); link.innerHTML = `<span class="bottom-icon-wrap"><span class="platform-nav-icon" aria-hidden="true">${lucide('message', 19)}</span></span><span>Comunidade</span>`; const first = bottom.querySelector('.bottom-link'); if (first) first.after(link); else bottom.appendChild(link); }
  }
  function renderMessage(message) {
    const mine = String(message.authorRa || message.userRa || message.ra || '') === currentRa();
    const person = { ...(message.author || message.user || {}), name: message.author?.name || message.user?.name || message.authorName || message.author?.nome, authorRa: message.authorRa || message.userRa || message.ra, avatarUrl: message.author?.avatarUrl || message.user?.avatarUrl || message.avatarUrl };
    const parts = splitReply(message.content); const reply = parts.excerpt ? { name: parts.name, content: parts.excerpt } : message.replyTo;
    const quoted = reply ? `<div class="chat-reply-quote"><strong>Respondendo a ${esc(reply.name || 'Aluno')}</strong><span>${esc(reply.content || 'Mensagem')}</span></div>` : '';
    const content = message.deleted ? '<em>Mensagem removida pela administração.</em>' : `${quoted}${esc(parts.content || '')}`;
    const attachment = message.attachmentUrl ? (String(message.attachmentType || '').startsWith('image/') ? `<img class="chat-attachment-image" src="${esc(message.attachmentUrl)}" alt="Anexo enviado por ${esc(displayName(person))}" loading="lazy">` : `<a class="chat-attachment-file" href="${esc(message.attachmentUrl)}" target="_blank" rel="noopener noreferrer">↗ ${esc(message.attachmentName || 'Abrir anexo')}</a>`) : '';
    const audio = message.audioUrl ? `<div class="chat-audio-player" data-chat-audio-player><button type="button" class="chat-audio-play" data-chat-audio-toggle aria-label="Reproduzir áudio">▶</button><div class="chat-audio-wave">${[5,9,14,20,11,17,7,22,13,8,19,12,23,10,16,6,20,14,9,18,12,22,8,15].map((height) => `<i style="height:${height}px"></i>`).join('')}</div><time data-chat-audio-duration>--:--</time><audio class="chat-audio-native" preload="metadata" src="${esc(message.audioUrl)}"></audio></div>` : '';
    const photo = avatar(person) ? `<img src="${esc(avatar(person))}" alt="" loading="lazy">` : `<span>${esc(initials(person))}</span>`;
    const authorDigits = String(person.authorRa || '').replace(/\D/g, ''); const adminBadge = ADMIN_RAS.has(authorDigits) ? '<span class="chat-admin-badge">ADMIN</span>' : '';
    const actions = message.deleted ? '' : `<div class="chat-message-actions">${mine ? `<button type="button" data-chat-edit="${esc(message.id)}">Editar</button><button type="button" data-chat-delete="${esc(message.id)}">Excluir</button>` : ''}${isAdmin() && !mine ? `<button type="button" data-chat-mute="${esc(message.authorRa || message.userRa || '')}">Silenciar</button><button type="button" data-chat-ban="${esc(message.authorRa || message.userRa || '')}">Proibir entrada</button><button type="button" data-chat-remove="${esc(message.id)}">Apagar</button>` : ''}</div>`;
    return `<article class="chat-message ${mine ? 'is-mine' : 'is-other'}" data-chat-message="${esc(message.id)}"><div class="chat-author-avatar">${photo}</div><div class="chat-message-main"><div class="chat-author-line"><strong>${esc(displayName(person))}</strong>${adminBadge}<time>${message.createdAt ? new Date(message.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</time></div><div class="chat-bubble"${canReply(message) ? ` data-chat-reply-swipe="${esc(message.id)}"` : ''}>${content}${attachment}${audio}${message.editedAt ? '<small class="chat-edited">editada</small>' : ''}</div>${actions}</div></article>`;
  }
  const formatDuration = (seconds) => { const total = Math.max(0, Math.round(Number(seconds) || 0)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };
  function renderAudioPlayers() { overlay?.querySelectorAll('[data-chat-audio-player]').forEach((player) => { const audio = player.querySelector('.chat-audio-native'); const duration = player.querySelector('[data-chat-audio-duration]'); if (!audio || !duration) return; const update = () => { duration.textContent = formatDuration(audio.duration); }; audio.addEventListener('loadedmetadata', update, { once: true }); audio.addEventListener('ended', () => { player.classList.remove('is-playing'); player.querySelector('[data-chat-audio-toggle]').textContent = '▶'; }); update(); }); }
  function renderMessages(scroll = false) { const list = overlay?.querySelector('[data-chat-messages]'); if (!list) return; list.innerHTML = messages.length ? messages.map(renderMessage).join('') : '<div class="chat-empty"><span class="chat-empty-icon">◌</span><h2>O grupo está esperando você</h2><p>Seja a primeira pessoa a enviar uma mensagem para a turma.</p></div>'; renderAudioPlayers(); if (scroll) list.scrollTop = list.scrollHeight; }
  async function loadMessages(scroll = false) {
    if (!overlay || loading) return; loading = true;
    try { const data = await api('/chat/messages?limit=100'); messages = Array.isArray(data.messages) ? data.messages : Array.isArray(data) ? data : []; renderMessages(scroll); const status = overlay.querySelector('[data-chat-status]'); if (status) status.textContent = ''; }
    catch (error) { const status = overlay.querySelector('[data-chat-status]'); if (status) status.textContent = error.message || 'Não foi possível carregar o chat.'; }
    finally { loading = false; }
  }
  const readFile = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
  const audioDuration = (url) => new Promise((resolve) => { const audio = new Audio(url); audio.addEventListener('loadedmetadata', () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0), { once: true }); audio.addEventListener('error', () => resolve(0), { once: true }); });
  function renderPending() { const preview = overlay?.querySelector('[data-chat-preview]'); if (!preview) return; if (!pendingAttachment && !pendingAudio) { preview.innerHTML = ''; preview.hidden = true; return; } preview.hidden = false; const item = pendingAttachment || pendingAudio; const media = pendingAudio ? `<div class="chat-pending-audio"><div class="chat-audio-wave">${[6,12,18,9,22,14,8,20,11,17,7,23,13,9,19,12,21,8].map((height) => `<i style="height:${height}px"></i>`).join('')}</div><time>${formatDuration(pendingAudio.duration)}</time></div>` : String(item.type || '').startsWith('image/') ? `<img src="${esc(item.url)}" alt="Pré-visualização">` : String(item.type || '').startsWith('video/') ? `<video src="${esc(item.url)}" muted controls></video>` : `<span class="chat-pending-file-name">${esc(item.name)}</span>`; preview.innerHTML = `<div class="chat-pending-card">${media}<strong>${esc(item.name || 'Áudio')}</strong><button type="button" data-chat-clear-pending aria-label="Remover anexo">×</button></div>`; }
  const canReply = (message) => !!message && !message.deleted && String(message.authorRa || message.userRa || message.ra || '').replace(/\D/g, '') !== String(currentRa()).replace(/\D/g, '');
  const horizontalReply = (dx, dy) => Math.abs(dx) >= 52 && Math.abs(dx) > Math.abs(dy) * 1.5;
  function splitReply(text) { const raw = String(text || ''); const match = raw.match(/^> (.*)\n> (.*)\n\n([\s\S]*)$/); return match ? { name: match[1], excerpt: match[2], content: match[3] } : { name: '', excerpt: '', content: raw }; }
  const replyContent = (content, reply) => reply ? `> ${String(reply.name || 'Aluno').replace(/\n/g, ' ')}\n> ${String(reply.excerpt || 'Mensagem').replace(/\n/g, ' ')}\n\n${content}` : content;
  const replyExcerpt = (message) => { const text = splitReply(message?.content).content.trim(); if (text) return text.replace(/\s+/g, ' ').slice(0, 140); if (message?.audioUrl) return 'Áudio'; if (message?.attachmentUrl) return 'Anexo'; return 'Mensagem'; };
  function renderReplyPreview() { const preview = overlay?.querySelector('[data-chat-reply-preview]'); if (!preview) return; preview.hidden = !replyingTo; preview.innerHTML = replyingTo ? `<div><strong>Respondendo a ${esc(replyingTo.name)}</strong><span>${esc(replyingTo.excerpt)}</span></div><button type="button" data-chat-clear-reply aria-label="Cancelar resposta">×</button>` : ''; }
  function setReplyTo(message) { if (message && !canReply(message)) return; replyingTo = message ? { id: String(message.id), name: displayName({ ...(message.author || {}), name: message.author?.name || message.authorName, authorRa: message.authorRa }), excerpt: replyExcerpt(message) } : null; renderReplyPreview(); if (replyingTo) overlay?.querySelector('[name="content"]')?.focus(); }
  async function sendMessage(content = '', attachment = null, audio = null, replyTo = null) {
    if (!content.trim() && !attachment && !audio) return;
    const data = await api('/chat/messages', { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ content: replyContent(content.trim(), replyTo), attachment, audio, avatarUrl: profileAvatar(), replyTo: replyTo ? { id: replyTo.id, name: replyTo.name, content: replyTo.excerpt } : null }) });
    if (data.message) messages.push(data.message); else await loadMessages(true); renderMessages(true);
  }
  async function submitComposer() {
    const form = overlay?.querySelector('[data-chat-form]'); const input = form?.querySelector('[name="content"]'); const button = form?.querySelector('[data-chat-send]'); if (!input || !button) return;
    const content = input.value.trim(); if (!content && !pendingAttachment && !pendingAudio) return; button.disabled = true;
    try { await sendMessage(content, pendingAttachment, pendingAudio, replyingTo); input.value = ''; setReplyTo(null); pendingAttachment = null; pendingAudio = null; renderPending(); } catch (error) { const status = overlay.querySelector('[data-chat-status]'); if (status) status.textContent = error.message; } finally { button.disabled = false; input.focus(); }
  }
  async function handleFile(file) { if (!file) return; const status = overlay?.querySelector('[data-chat-status]'); try { if (file.size > 3 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 3 MB.'); pendingAttachment = { url: await readFile(file), name: file.name, type: file.type || 'application/octet-stream' }; pendingAudio = null; renderPending(); if (status) status.textContent = ''; } catch (error) { if (status) status.textContent = error.message; } }
  async function toggleRecording() {
    const button = overlay?.querySelector('[data-chat-record]'); if (!button) return;
    if (mediaRecorder?.state === 'recording') { mediaRecorder.stop(); button.classList.remove('recording'); button.innerHTML = lucide('mic', 18); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { alert('Seu navegador não permite gravação de áudio.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); audioChunks = []; mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => event.data.size && audioChunks.push(event.data);
      mediaRecorder.onstop = async () => { stream.getTracks().forEach((track) => track.stop()); try { const blob = new Blob(audioChunks, { type: 'audio/webm' }); if (blob.size > 3 * 1024 * 1024) throw new Error('O áudio deve ter no máximo 3 MB.'); const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }); const url = await readFile(file); pendingAudio = { url, name: file.name, type: file.type, duration: await audioDuration(url) }; pendingAttachment = null; renderPending(); } catch (error) { const status = overlay?.querySelector('[data-chat-status]'); if (status) status.textContent = error.message; } };
      mediaRecorder.start(); button.classList.add('recording'); button.innerHTML = lucide('mic', 18);
    } catch { alert('Não foi possível acessar o microfone.'); }
  }
  async function moderate(path, body, prompt) { if (prompt && !window.confirm(prompt)) return; try { await api(`/admin/chat/${path}`, { method: 'POST', headers: authHeaders(true), body: JSON.stringify(body) }); await loadMessages(); } catch (error) { const status = overlay?.querySelector('[data-chat-status]'); if (status) status.textContent = error.message; } }
  function renderChatRoom() {
    unmountVoiceRoom();
    disposeAnnouncements?.(); disposeAnnouncements = null; currentView = 'general';
    clearInterval(pollTimer);
    overlay.innerHTML = `<div class="chat-tab-panel community-chat-view"><header class="chat-tab-heading community-chat-heading"><button type="button" class="community-back-button" data-community-back aria-label="Voltar para Comunidade">${lucide('arrow-left', 20)}</button><div><span class="eyebrow">Canal da Comunidade</span><h1>geral</h1><p>Converse com outros alunos do SedX em um espaço público e moderado.</p></div></header><section class="chat-room"><div class="chat-room-header"><div class="chat-room-icon">${lucide('message-circle', 23)}</div><div><strong>geral</strong><span>Mensagens visíveis para todos os alunos logados</span></div><span class="chat-online-status"><i></i> online</span></div><div class="chat-messages" data-chat-messages role="log" aria-live="polite"><div class="chat-loading">Carregando conversa…</div></div><form class="chat-composer" data-chat-form><div class="chat-reply-preview" data-chat-reply-preview hidden></div><div class="chat-pending-preview data-chat-preview hidden></div><div class="chat-input-shell"><textarea name="content" rows="1" maxlength="4000" placeholder="Escreva uma mensagem para a comunidade…" aria-label="Mensagem"></textarea></div><button type="submit" class="chat-send-button" data-chat-send aria-label="Enviar mensagem">↑</button></form><p class="chat-status" data-chat-status role="status"></p></section></div>`;
    void loadMessages(true); pollTimer = setInterval(() => void loadMessages(false), POLL_MS);
  }
  function renderVoiceRoom() {
    if (!overlay?.isConnected) renderPage();
    unmountVoiceRoom();
    clearInterval(pollTimer); pollTimer = null;
    disposeAnnouncements?.(); disposeAnnouncements = null;
    currentView = 'voice';
    overlay.innerHTML = '<div class="voice-room-host" data-voice-room></div>';
    const root = overlay.querySelector('[data-voice-room]');
    const current = session() || {};
    if (root && window.SedxVoiceRoom?.mount) {
      voiceRoomCleanup = window.SedxVoiceRoom.mount(root, {
        user: { name: current.nome || current.name || 'Aluno', avatar: current.avatarUrl || current.avatar || current.foto || '' },
        onExit: () => selectChannel('channels'),
      });
    } else if (root) {
      root.innerHTML = '<p class="voice-room-unavailable" role="alert">A Sala de voz não pôde ser carregada. Atualize a página e tente novamente.</p>';
    }
  }

  function renderPage() {
    unmountVoiceRoom();
    clearInterval(pollTimer); pollTimer = null; disposeAnnouncements?.(); disposeAnnouncements = null; currentView = 'channels';
    const pageContent = document.querySelector('.page-content');
    if (!pageContent) return;
    if (!overlay || !overlay.isConnected) {
      overlay = document.createElement('div');
      pageContent.classList.add('sedx-chat-host');
      pageContent.appendChild(overlay);
    }
    overlay.className = 'sedx-platforms-overlay sedx-community-overlay';
    setNavActive(true);
    overlay.innerHTML = `<div class="community-page"><header class="community-heading"><div class="community-brand-mark">SED<span>X</span></div><div class="community-top-actions"><button type="button" class="community-icon-button" data-community-exit aria-label="Voltar">${lucide('arrow-left', 21)}</button><button type="button" class="community-icon-button" data-community-channel="announcements" aria-label="Abrir anúncios">${lucide('bell', 21)}</button><div class="community-user-mark">${profileAvatar() ? `<img src="${esc(profileAvatar())}" alt="Foto do perfil">` : esc(initials({name: session()?.nome}))}</div></div><div class="community-title-block"><h1>Comunidade</h1><p>Aprender juntos nos leva mais longe.</p></div></header><div class="community-tabs" role="tablist"><button type="button" class="active" role="tab" aria-selected="true">Canais</button></div><button type="button" class="community-welcome-card" data-community-channel="general"><span class="community-welcome-icon">${lucide('users-round', 28)}</span><span><strong>Seu espaço para trocar ideias</strong><small>Tire dúvidas, compartilhe materiais e conecte-se com outros estudantes.</small></span><b>${lucide('chevron-right', 20)}</b></button><section class="community-section"><div class="community-section-heading"><span>${lucide('folder', 17)} INFORMAÇÕES</span>${lucide('chevron-up', 18)}</div><button type="button" class="community-channel-card" data-community-channel="announcements"><span class="community-channel-icon">${lucide('megaphone', 20)}</span><span><strong>anúncios</strong><small>Novidades e comunicados do SEDX</small></span><b>${lucide('chevron-right', 19)}</b></button></section><section class="community-section"><div class="community-section-heading"><span>${lucide('folder', 17)} COMUNIDADE</span>${lucide('chevron-up', 18)}</div><button type="button" class="community-channel-card community-channel-primary" data-community-channel="general"><span class="community-channel-icon">${lucide('message-circle', 20)}</span><span><strong>geral</strong><small>Converse com todos os alunos</small></span>${messages.length ? `<em>${messages.length}</em>` : ''}<b>${lucide('chevron-right', 19)}</b></button></section><section class="community-section"><div class="community-section-heading"><span>${lucide('headphones', 17)} CANAIS DE VOZ</span>${lucide('chevron-up', 18)}</div><button type="button" class="community-channel-card community-channel-primary community-voice-channel" data-community-channel="voice"><span class="community-channel-icon">${lucide('headphones', 20)}</span><span><strong>Sala de voz</strong><small>Converse ao vivo com até 20 pessoas</small></span><b>${lucide('chevron-right', 19)}</b></button></section></div>`;
  }
  function renderAnnouncements() {
    renderPage(); currentView = 'announcements';
    overlay.innerHTML = `<div class="community-page community-announcements"><header class="community-chat-heading"><button type="button" class="community-back-button" data-community-back aria-label="Voltar para Comunidade">${lucide('arrow-left', 20)}</button><div><span class="eyebrow">Comunidade · Informações</span><h1>anúncios</h1><p>Novidades e comunicados do SEDX</p></div></header><div data-community-announcements></div></div>`;
    const target = overlay.querySelector('[data-community-announcements]');
    if (target && window.SedxAnnouncements) disposeAnnouncements = window.SedxAnnouncements.mount(target);
  }

  function selectChannel(channel, updateHistory = true) {
    if (!overlay?.isConnected) renderPage();
    if (!overlay) return;
    if (updateHistory) {
      history.pushState({ ...(history.state || {}), sedxCommunity: true }, '', channelRoute(channel));
    }
    if (channel === 'announcements') renderAnnouncements();
    else if (channel === 'general') renderChatRoom();
    else if (channel === 'voice') renderVoiceRoom();
    else renderPage();
  }
  function openTab({ updateHistory = true, channel } = {}) {
    if (!document.querySelector('.app-shell')) return;
    const params = new URLSearchParams(location.search);
    const legacyChat = params.get(TAB_PARAM) === TAB_VALUE;
    if (updateHistory && !isCommunityRoute()) {
      returnUrl = urlWithoutTab(); history.pushState({ ...(history.state || {}), sedxCommunity: true, sedxReturnUrl: returnUrl }, '', channelRoute(channel || 'channels'));
    } else if (!returnUrl) returnUrl = history.state?.sedxReturnUrl || '/dashboard';
    const view = channel || (isCommunityRoute() ? channelFromRoute() : params.get(CHANNEL_PARAM)) || 'channels';
    if (currentView !== view || !overlay?.isConnected) selectChannel(view, false);
    setNavActive(true);
  }
  function closeTab({ restoreUrl = true } = {}) {
    unmountVoiceRoom();
    clearInterval(pollTimer); pollTimer = null; disposeAnnouncements?.(); disposeAnnouncements = null; currentView = '';
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
    overlay?.remove(); overlay = null; document.querySelector('.page-content')?.classList.remove('sedx-chat-host'); setNavActive(false);
    if (restoreUrl && (isCommunityRoute() || new URLSearchParams(location.search).get(TAB_PARAM) === TAB_VALUE)) {
      history.replaceState({ ...(history.state || {}), sedxCommunity: false }, '', returnUrl || '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-sedx-platform-link]');
    if (link) { event.preventDefault(); openTab({ updateHistory: true }); document.querySelector('.side-rail.is-open .mobile-close')?.click(); return; }
    if (!overlay) return;
    const channel = event.target.closest('[data-community-channel]');
    if (channel && !channel.classList.contains('community-channel-disabled')) { selectChannel(channel.dataset.communityChannel); return; }
    if (event.target.closest('[data-community-back]')) { selectChannel('channels'); return; }
    if (event.target.closest('[data-community-exit]')) { closeTab(); return; }
    const reply = event.target.closest('[data-chat-reply]'); if (reply) { const target = messages.find((item) => String(item.id) === reply.dataset.chatReply); if (target) setReplyTo(target); return; }
    if (event.target.closest('[data-chat-clear-reply]')) { setReplyTo(null); return; }
    const edit = event.target.closest('[data-chat-edit]'); if (edit) { const message = messages.find((item) => String(item.id) === edit.dataset.chatEdit); const editParts = splitReply(message?.content); const next = window.prompt('Edite sua mensagem:', editParts.content || ''); if (next !== null && next.trim()) void api(`/chat/messages/${encodeURIComponent(edit.dataset.chatEdit)}`, { method: 'PUT', headers: authHeaders(true), body: JSON.stringify({ content: editParts.excerpt ? replyContent(next.trim(), { name: editParts.name, excerpt: editParts.excerpt }) : next.trim() }) }).then(() => loadMessages()).catch((error) => { const status = overlay.querySelector('[data-chat-status]'); if (status) status.textContent = error.message; }); return; }
    const del = event.target.closest('[data-chat-delete]'); if (del) { void moderate(`messages/${encodeURIComponent(del.dataset.chatDelete)}/delete`, {}, 'Excluir sua mensagem?'); return; }
    const remove = event.target.closest('[data-chat-remove]'); if (remove) { void moderate(`messages/${encodeURIComponent(remove.dataset.chatRemove)}/delete`, {}, 'Apagar esta mensagem como administrador?'); return; }
    const mute = event.target.closest('[data-chat-mute]'); if (mute) { const minutes = window.prompt('Por quantos minutos silenciar? Digite 0 para indeterminado.', '60'); if (minutes !== null) void moderate('mute', { userRa: mute.dataset.chatMute, durationMinutes: Number(minutes) || null }, 'Confirmar silêncio do aluno?'); }
    const ban = event.target.closest('[data-chat-ban]'); if (ban) { const reason = window.prompt('Motivo da proibição de entrada (opcional):', ''); if (reason !== null) void moderate('ban', { userRa: ban.dataset.chatBan, reason }, 'Proibir este aluno de entrar no Chat?'); }
    if (event.target.closest('[data-chat-record]')) void toggleRecording();
    const audioToggle = event.target.closest('[data-chat-audio-toggle]'); if (audioToggle) { const player = audioToggle.closest('[data-chat-audio-player]'); const audio = player?.querySelector('.chat-audio-native'); if (audio) { if (audio.paused) { void audio.play(); player.classList.add('is-playing'); audioToggle.textContent = '❚❚'; } else { audio.pause(); player.classList.remove('is-playing'); audioToggle.textContent = '▶'; } } return; }
    if (event.target.closest('[data-chat-clear-pending]')) { pendingAttachment = null; pendingAudio = null; renderPending(); return; }
  });
  document.addEventListener('touchstart', (event) => { const bubble = event.target.closest('[data-chat-reply-swipe]'); if (!bubble || !overlay?.contains(bubble)) return; const touch = event.touches[0]; swipeState = { bubble, id: bubble.dataset.chatReplySwipe, startX: touch.clientX, startY: touch.clientY, deltaX: 0 }; bubble.classList.add('is-swiping'); }, { passive: true });
  document.addEventListener('touchmove', (event) => { if (!swipeState) return; const touch = event.touches[0]; const dx = touch.clientX - swipeState.startX; const dy = touch.clientY - swipeState.startY; if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { swipeState.bubble.classList.remove('is-swiping'); swipeState = null; return; } swipeState.deltaX = Math.max(-90, Math.min(90, dx)); swipeState.deltaY = dy; swipeState.bubble.closest('.chat-message')?.classList.toggle('is-reply-ready', Math.abs(dx) >= 52); swipeState.bubble.style.transform = `translateX(${swipeState.deltaX}px)`; }, { passive: true });
  document.addEventListener('touchend', () => { if (!swipeState) return; const state = swipeState; state.bubble.classList.remove('is-swiping'); state.bubble.style.transform = ''; state.bubble.closest('.chat-message')?.classList.remove('is-reply-ready'); swipeState = null; if (horizontalReply(state.deltaX, state.deltaY || 0)) { const target = messages.find((item) => String(item.id) === state.id); if (target) setReplyTo(target); } }, { passive: true });
  document.addEventListener('submit', (event) => { if (event.target.matches('[data-chat-form]')) { event.preventDefault(); void submitComposer(); } });
  document.addEventListener('change', (event) => { if (event.target.matches('[data-chat-file]')) void handleFile(event.target.files?.[0]); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && overlay) closeTab(); });
  function syncTab() {
    injectNavLinks();
    if (isCommunityRoute() || new URLSearchParams(location.search).get(TAB_PARAM) === TAB_VALUE) openTab({ updateHistory: false });
    else if (overlay) closeTab({ restoreUrl: false });
  }
  window.addEventListener('sedx:open-announcements', () => openTab({ channel: 'announcements' }));
  window.addEventListener('popstate', syncTab);
  function boot() { syncTab(); const observer = new MutationObserver(syncTab); observer.observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
