(() => {
  'use strict';

  const WORKER_URL = 'https://sedx-voice.gabrielreplit56.workers.dev';
  const ROOM_ID = 'sala-de-voz';
  const MAX_PEERS = 20;
  const ICE_SERVERS = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  const icons = {
    back: '<path d="m15 18-6-6 6-6"/><path d="M9 12h12"/>',
    voice: '<path d="M2 10v4"/><path d="M6 7v10"/><path d="M10 4v16"/><path d="M14 7v10"/><path d="M18 10v4"/><path d="M22 11v2"/>',
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2"/><path d="M12 19v3M8 22h8"/>',
    micOff: '<path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9V5a3 3 0 0 0-5.8-1"/><path d="M5 10v2a7 7 0 0 0 11.7 5.2M19 10v2a7 7 0 0 1-.3 2"/><path d="m2 2 20 20M12 19v3M8 22h8"/>',
    headphones: '<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="3" y="12" width="4" height="9" rx="2"/><rect x="17" y="12" width="4" height="9" rx="2"/>',
    headphonesOff: '<path d="M3 14v-3a9 9 0 0 1 15.4-6.36M21 14v-3a9 9 0 0 0-.52-3.03"/><path d="M3 12h4v9H5a2 2 0 0 1-2-2zM17 12h4v7a2 2 0 0 1-2 2h-2z"/><path d="m2 2 20 20"/>',
    screen: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M10 9l4 2-4 2z"/>',
    output: '<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="8" r="2"/><path d="M9 16a3 3 0 0 1 6 0v2H9z"/>',
    leave: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  };

  const icon = (name, size = 20) => `<svg class="voice-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const safeAvatarUrl = (value) => {
    try {
      const url = new URL(String(value || ''), window.location.href);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };
  const cleanName = (value) => String(value || 'Aluno').trim().replace(/\s+/g, ' ').slice(0, 40) || 'Aluno';
  const initials = (value) => cleanName(value).split(' ').filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'A';
  const displayName = (value) => {
    const parts = cleanName(value).split(' ').filter(Boolean);
    return parts.length > 1 ? `${parts[0]} ${parts[1].charAt(0)}.` : parts[0];
  };

  function mount(host, options = {}) {
    if (!host) return () => {};

    const user = options.user || {};
    const name = cleanName(user.name || user.nome || 'Aluno');
    const avatar = safeAvatarUrl(user.avatar || user.avatarUrl || user.photoURL || user.foto);
    const onExit = typeof options.onExit === 'function' ? options.onExit : () => {};
    const state = { connected: false, joined: false, muted: false, deaf: false, sharing: false, max: MAX_PEERS, roomFull: false, selectedSinkId: '' };
    const peers = new Map();
    const tiles = new Map();
    const audioElements = new Map();
    const listenerController = new AbortController();
    let disposed = false;
    let leaving = false;
    let socket = null;
    let localId = null;
    let micStream = null;
    let screenStream = null;
    let reconnectTimer = null;
    let pingTimer = null;
    let speakingTimer = null;
    let reconnectAttempts = 0;
    let audioContext = null;
    let analyser = null;
    let lastSpeaking = false;
    let messageTimer = null;

    host.innerHTML = `<main class="sedx-voice-screen" aria-label="Sala de voz">
      <header class="voice-topbar">
        <button type="button" class="voice-back" data-voice-action="back" aria-label="Voltar para os canais">${icon('back', 22)}</button>
        <div class="voice-room-title"><span class="voice-room-mark">${icon('voice', 19)}</span><strong>Sala de voz</strong></div>
        <span class="voice-brand" aria-label="SEDX">SED<span>X</span></span>
      </header>
      <div class="voice-connection-row">
        <span class="voice-status" data-voice-status><i></i><span data-voice-status-text>Conectando…</span></span>
        <span class="voice-count" data-voice-count>0/${MAX_PEERS}</span>
      </div>
      <section class="voice-stage" data-voice-stage aria-label="Participantes da chamada"></section>
      <section class="voice-people-card" aria-label="Pessoas na sala de voz">
        <span class="voice-people-icon">${icon('people', 22)}</span>
        <div class="voice-people-copy"><strong>Pessoas na sala de voz</strong><small data-voice-people-summary>Os membros entram tocando neste canal</small><div class="voice-people-list" data-voice-people-list></div></div>
      </section>
      <p class="voice-message" data-voice-message role="status" aria-live="polite"></p>
      <footer class="voice-controls" aria-label="Controles da chamada">
        <div class="voice-control-item"><button type="button" data-voice-action="mute" aria-label="Mutar microfone" aria-pressed="false">${icon('mic', 22)}</button><span>Mutar</span></div>
        <div class="voice-control-item"><button type="button" data-voice-action="audio" aria-label="Desativar áudio de saída" aria-pressed="false">${icon('headphones', 22)}</button><span>Áudio</span></div>
        <div class="voice-control-item"><button type="button" data-voice-action="screen" aria-label="Compartilhar tela" aria-pressed="false">${icon('screen', 22)}</button><span>Tela</span></div>
        <div class="voice-control-item voice-output-item"><button type="button" data-voice-action="output" aria-label="Selecionar saída de áudio" aria-haspopup="true" aria-expanded="false">${icon('output', 22)}</button><span>Saída</span>
          <div class="voice-output-menu" data-voice-output-menu hidden><strong>Saída de áudio</strong><div data-voice-output-devices></div><small data-voice-output-note></small></div>
        </div>
        <div class="voice-control-item"><button type="button" class="voice-leave-button" data-voice-action="leave" aria-label="Sair da sala">${icon('leave', 22)}</button><span>Sair</span></div>
      </footer>
      <div class="voice-audio-bin" data-voice-audio-bin aria-hidden="true"></div>
    </main>`;

    const screen = host.querySelector('.sedx-voice-screen');
    const stage = host.querySelector('[data-voice-stage]');
    const status = host.querySelector('[data-voice-status]');
    const statusText = host.querySelector('[data-voice-status-text]');
    const countLabel = host.querySelector('[data-voice-count]');
    const peopleSummary = host.querySelector('[data-voice-people-summary]');
    const peopleList = host.querySelector('[data-voice-people-list]');
    const messageNode = host.querySelector('[data-voice-message]');
    const audioBin = host.querySelector('[data-voice-audio-bin]');

    function setStatus(text, tone = '') {
      if (!statusText || !status) return;
      statusText.textContent = text;
      status.dataset.tone = tone;
    }

    function showMessage(text, tone = '') {
      if (!messageNode) return;
      messageNode.textContent = text || '';
      messageNode.dataset.tone = tone;
      if (messageTimer) clearTimeout(messageTimer);
      if (text && tone !== 'error') messageTimer = setTimeout(() => { if (messageNode) messageNode.textContent = ''; }, 5500);
    }

    function send(payload) {
      if (socket?.readyState !== window.WebSocket?.OPEN) return false;
      try { socket.send(JSON.stringify(payload)); return true; } catch { return false; }
    }

    function sendState(values) {
      send({ type: 'state', ...values });
    }

    function updateTile(id, info = {}, isLocal = false) {
      if (!stage) return null;
      let tile = tiles.get(id);
      if (!tile) {
        tile = document.createElement('article');
        tile.className = 'voice-tile';
        tile.dataset.voicePeerId = id;
        tile.innerHTML = `<video class="voice-tile-video" autoplay playsinline muted hidden></video><div class="voice-tile-avatar"></div><div class="voice-tile-name"><strong></strong><span class="voice-mic-indicator">${icon('mic', 15)}</span></div><span class="voice-tile-speaking" aria-hidden="true">Falando</span>`;
        stage.appendChild(tile);
        tiles.set(id, tile);
      }
      const display = displayName(info.name || name);
      const nameNode = tile.querySelector('.voice-tile-name strong');
      if (nameNode) nameNode.textContent = isLocal ? `${display} (você)` : display;
      tile.classList.toggle('is-muted', Boolean(info.muted));
      tile.classList.toggle('is-speaking', Boolean(info.speaking));
      tile.classList.toggle('is-sharing', Boolean(info.sharing));
      tile.dataset.local = isLocal ? 'true' : 'false';
      tile.setAttribute('aria-label', `${display}${info.muted ? ', microfone mutado' : ''}${info.speaking ? ', falando' : ''}`);
      const indicator = tile.querySelector('.voice-mic-indicator');
      if (indicator) {
        indicator.innerHTML = icon(info.muted ? 'micOff' : 'mic', 15);
        indicator.setAttribute('aria-label', info.muted ? 'Microfone mutado' : 'Microfone ativo');
      }
      const avatarNode = tile.querySelector('.voice-tile-avatar');
      const avatarUrl = safeAvatarUrl(info.avatar || (isLocal ? avatar : ''));
      if (avatarNode && avatarNode.dataset.src !== avatarUrl) {
        avatarNode.dataset.src = avatarUrl;
        avatarNode.replaceChildren();
        if (avatarUrl) {
          const image = document.createElement('img');
          image.src = avatarUrl;
          image.alt = '';
          image.referrerPolicy = 'no-referrer';
          image.onerror = () => { image.remove(); if (!avatarNode.childElementCount) avatarNode.textContent = initials(info.name || name); };
          avatarNode.appendChild(image);
        } else avatarNode.textContent = initials(info.name || name);
      }
      return tile;
    }

    function updateParticipants() {
      const people = [{ id: 'self', name, muted: state.muted, local: true }, ...Array.from(peers.values()).map((peer) => ({ id: peer.id, name: peer.info.name, muted: peer.info.muted, local: false }))];
      const count = state.joined ? people.length : 0;
      if (countLabel) countLabel.textContent = `${count}/${state.max}`;
      if (peopleSummary) peopleSummary.textContent = count > 1 ? `${count} pessoas conectadas · até ${state.max} participantes` : state.joined ? 'Você está na sala · convide os membros para entrar' : 'Os membros entram tocando neste canal';
      if (peopleList) {
        peopleList.replaceChildren();
        for (const person of people) {
          const chip = document.createElement('span');
          chip.className = `voice-person-chip${person.local ? ' is-local' : ''}${person.muted ? ' is-muted' : ''}`;
          chip.textContent = displayName(person.name);
          peopleList.appendChild(chip);
        }
      }
    }

    function updateControls() {
      const mute = host.querySelector('[data-voice-action="mute"]');
      const audio = host.querySelector('[data-voice-action="audio"]');
      const share = host.querySelector('[data-voice-action="screen"]');
      if (mute) {
        mute.classList.toggle('is-active', state.muted);
        mute.setAttribute('aria-pressed', String(state.muted));
        mute.setAttribute('aria-label', state.muted ? 'Ativar microfone' : 'Mutar microfone');
        mute.innerHTML = icon(state.muted ? 'micOff' : 'mic', 22);
      }
      if (audio) {
        audio.classList.toggle('is-active', state.deaf);
        audio.setAttribute('aria-pressed', String(state.deaf));
        audio.setAttribute('aria-label', state.deaf ? 'Ativar áudio de saída' : 'Desativar áudio de saída');
        audio.innerHTML = icon(state.deaf ? 'headphonesOff' : 'headphones', 22);
      }
      if (share) {
        share.classList.toggle('is-active', state.sharing);
        share.setAttribute('aria-pressed', String(state.sharing));
        share.setAttribute('aria-label', state.sharing ? 'Parar compartilhamento de tela' : 'Compartilhar tela');
      }
      updateTile('self', { name, avatar, muted: state.muted, speaking: lastSpeaking, sharing: state.sharing }, true);
      updateParticipants();
    }

    function ensurePeer(info) {
      if (!info?.id || info.id === localId) return null;
      let peer = peers.get(info.id);
      if (!peer) {
        peer = { id: info.id, info: { ...info, name: cleanName(info.name) }, pc: null, audioTransceiver: null, videoTransceiver: null, pendingCandidates: [], remoteAudio: null, remoteVideo: null, offerStarted: false };
        peers.set(info.id, peer);
      } else peer.info = { ...peer.info, ...info, name: cleanName(info.name || peer.info.name) };
      updateTile(peer.id, peer.info, false);
      updateParticipants();
      return peer;
    }

    function refreshPeer(peer) {
      if (peer) {
        updateTile(peer.id, peer.info, false);
        const audio = audioElements.get(peer.id);
        if (audio) audio.muted = state.deaf;
      }
      updateParticipants();
    }

    function createRemoteMedia(peer, event) {
      const track = event.track;
      if (!track) return;
      if (track.kind === 'audio') {
        let audio = audioElements.get(peer.id);
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audio.playsInline = true;
          audio.dataset.voiceRemoteAudio = peer.id;
          audio.muted = state.deaf;
          audioBin.appendChild(audio);
          audioElements.set(peer.id, audio);
        }
        audio.srcObject = new MediaStream([track]);
        if (state.selectedSinkId && typeof audio.setSinkId === 'function') void audio.setSinkId(state.selectedSinkId).catch(() => {});
        track.addEventListener('unmute', () => { void audio.play().catch(() => showMessage('Toque na tela para liberar a reprodução do áudio.', 'warning')); }, { once: true });
        void audio.play().catch(() => {});
        track.addEventListener('ended', () => { audio.pause(); audio.srcObject = null; });
      } else if (track.kind === 'video') {
        const tile = updateTile(peer.id, peer.info, false);
        const video = tile?.querySelector('.voice-tile-video');
        if (!video) return;
        peer.remoteVideo = video;
        video.srcObject = new MediaStream([track]);
        video.hidden = Boolean(track.muted);
        if (!video.hidden) tile.classList.add('has-video');
        track.addEventListener('unmute', () => { video.hidden = false; tile.classList.add('has-video'); });
        track.addEventListener('mute', () => { video.hidden = true; tile.classList.remove('has-video'); });
        track.addEventListener('ended', () => { video.hidden = true; tile.classList.remove('has-video'); video.srcObject = null; });
        void video.play().catch(() => {});
      }
    }

    async function flushCandidates(peer) {
      if (!peer?.pc?.remoteDescription) return;
      const pending = peer.pendingCandidates.splice(0);
      for (const candidate of pending) {
        try { await peer.pc.addIceCandidate(candidate); } catch { /* candidates de uma sessão encerrada são ignorados */ }
      }
    }

    async function createPeerConnection(peer, initiator) {
      if (!peer || peer.pc || disposed) return peer?.pc;
      if (!window.RTCPeerConnection) throw new Error('Este navegador não oferece suporte às chamadas WebRTC.');
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peer.pc = pc;
      try {
        peer.audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
        peer.videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
      } catch (error) {
        pc.close(); peer.pc = null;
        throw new Error('Este navegador não oferece suporte ao áudio/vídeo necessário para a chamada.');
      }
      const localAudioTrack = micStream?.getAudioTracks?.()[0];
      if (localAudioTrack) await peer.audioTransceiver.sender.replaceTrack(localAudioTrack).catch(() => {});
      const localScreenTrack = screenStream?.getVideoTracks?.()[0];
      if (localScreenTrack) await peer.videoTransceiver.sender.replaceTrack(localScreenTrack).catch(() => {});

      pc.onicecandidate = (event) => { if (event.candidate) send({ type: 'signal', to: peer.id, data: { candidate: event.candidate.toJSON() } }); };
      pc.ontrack = (event) => createRemoteMedia(peer, event);
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') showMessage(`Não foi possível conectar o áudio de ${displayName(peer.info.name)}. Verifique a rede e tente novamente.`, 'warning');
      };
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' && !peer.iceRestarted && !disposed) {
          peer.iceRestarted = true;
          void pc.restartIce?.();
          void negotiate(peer, true);
        }
      };

      if (initiator) await negotiate(peer, false);
      return pc;
    }

    async function negotiate(peer, iceRestart = false) {
      if (!peer?.pc || disposed || peer.negotiating) return;
      peer.negotiating = true;
      try {
        const offer = await peer.pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
        await peer.pc.setLocalDescription(offer);
        send({ type: 'signal', to: peer.id, data: { description: peer.pc.localDescription } });
        peer.offerStarted = true;
      } catch (error) {
        showMessage(`Não foi possível iniciar a conexão com ${displayName(peer.info.name)}.`, 'warning');
      } finally { peer.negotiating = false; }
    }

    async function handleSignal(message) {
      const peer = ensurePeer({ id: message.from, name: 'Aluno' });
      if (!peer) return;
      try {
        await createPeerConnection(peer, false);
        const data = message.data || {};
        if (data.description) {
          await peer.pc.setRemoteDescription(data.description);
          await flushCandidates(peer);
          if (data.description.type === 'offer') {
            const answer = await peer.pc.createAnswer();
            await peer.pc.setLocalDescription(answer);
            send({ type: 'signal', to: peer.id, data: { description: peer.pc.localDescription } });
          }
        } else if (data.candidate) {
          const candidate = new RTCIceCandidate(data.candidate);
          if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate);
          else peer.pendingCandidates.push(candidate);
        }
      } catch (error) {
        showMessage(`A conexão com ${displayName(peer.info.name)} foi interrompida.`, 'warning');
      }
    }

    async function handleSocketMessage(raw) {
      let message;
      try { message = JSON.parse(raw); } catch { return; }
      if (message.type === 'welcome') {
        localId = message.id;
        state.max = Math.min(MAX_PEERS, Number(message.max) || MAX_PEERS);
        state.joined = true;
        reconnectAttempts = 0;
        setStatus('Conectado', 'connected');
        updateControls();
        const existing = Array.isArray(message.peers) ? message.peers : [];
        for (const info of existing) {
          const peer = ensurePeer(info);
          if (peer) {
            try { await createPeerConnection(peer, true); }
            catch (error) { showMessage(error.message || 'Não foi possível iniciar o áudio.', 'error'); }
          }
        }
        if (existing.length === 0) showMessage('Você está na sala. Os outros alunos podem entrar tocando em “Sala de voz”.');
        sendState({ deaf: state.deaf, sharing: state.sharing, speaking: lastSpeaking });
      } else if (message.type === 'full') {
        state.roomFull = true;
        state.joined = false;
        state.max = Math.min(MAX_PEERS, Number(message.max) || MAX_PEERS);
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        try { socket?.close(1000, 'room full'); } catch { /* socket já fechado */ }
        clearPeers();
        releaseLocalCapture();
        for (const button of host.querySelectorAll('[data-voice-action="mute"], [data-voice-action="audio"], [data-voice-action="screen"], [data-voice-action="output"]')) button.disabled = true;
        setStatus('Sala cheia', 'error');
        showMessage(`A sala já atingiu o limite de ${state.max} participantes.`, 'error');
        updateParticipants();
      } else if (message.type === 'peer-joined') {
        const peer = ensurePeer(message.peer);
        if (peer) {
          try { await createPeerConnection(peer, false); }
          catch (error) { showMessage(error.message || 'Não foi possível conectar com este participante.', 'warning'); }
        }
      } else if (message.type === 'peer-left') {
        removePeer(message.id);
      } else if (message.type === 'peer-state') {
        const peer = ensurePeer(message.peer);
        refreshPeer(peer);
      } else if (message.type === 'signal') {
        await handleSignal(message);
      }
    }

    function removePeer(id) {
      const peer = peers.get(id);
      if (!peer) return;
      try { peer.pc?.close(); } catch { /* conexão já fechada */ }
      const audio = audioElements.get(id);
      if (audio) { audio.pause(); audio.srcObject = null; audio.remove(); audioElements.delete(id); }
      tiles.get(id)?.remove();
      tiles.delete(id);
      peers.delete(id);
      updateParticipants();
    }

    function clearPeers() { for (const id of Array.from(peers.keys())) removePeer(id); }

    function connectSocket() {
      if (disposed || state.roomFull || leaving) return;
      if (!window.WebSocket) { setStatus('Navegador incompatível', 'error'); showMessage('Este navegador não oferece suporte à conexão da sala de voz.', 'error'); return; }
      setStatus(reconnectAttempts ? 'Reconectando…' : 'Conectando…');
      try { socket = new WebSocket(`${WORKER_URL.replace(/^https:/, 'wss:')}/room/${ROOM_ID}/ws`); }
      catch { scheduleReconnect(); return; }
      socket.onopen = () => {
        if (disposed) { socket.close(); return; }
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => send({ type: 'ping' }), 25000);
        send({ type: 'join', name, avatar, muted: state.muted });
      };
      socket.onmessage = (event) => { void handleSocketMessage(event.data); };
      socket.onerror = () => { if (!disposed && !state.joined) setStatus('Conectando…'); };
      socket.onclose = (event) => {
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        if (disposed || leaving) return;
        if (event.code === 4000 || event.reason === 'full' || state.roomFull) {
          state.roomFull = true;
          setStatus('Sala cheia', 'error');
          return;
        }
        state.joined = false;
        state.connected = false;
        localId = null;
        clearPeers();
        updateParticipants();
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (disposed || leaving || state.roomFull || reconnectTimer) return;
      reconnectAttempts += 1;
      const delay = Math.min(15000, 900 * (2 ** Math.min(reconnectAttempts - 1, 4)));
      setStatus('Conexão instável · tentando novamente', 'warning');
      reconnectTimer = setTimeout(() => { reconnectTimer = null; connectSocket(); }, delay);
    }

    async function acquireMicrophone() {
      if (micStream) return true;
      if (!navigator.mediaDevices?.getUserMedia) {
        state.muted = true;
        return false;
      }
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        for (const track of micStream.getAudioTracks()) track.enabled = !state.muted;
        const track = micStream.getAudioTracks()[0];
        if (track) for (const peer of peers.values()) if (peer.audioTransceiver?.sender) await peer.audioTransceiver.sender.replaceTrack(track).catch(() => {});
        startSpeakingMeter();
        return true;
      } catch {
        state.muted = true;
        showMessage('Microfone não liberado. Você ainda pode ouvir a sala e ativá-lo depois.', 'warning');
        return false;
      }
    }

    function startSpeakingMeter() {
      if (!micStream || speakingTimer || !window.AudioContext && !window.webkitAudioContext) return;
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContextClass();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        audioContext.createMediaStreamSource(micStream).connect(analyser);
        void audioContext.resume?.();
        const samples = new Uint8Array(analyser.fftSize);
        speakingTimer = setInterval(() => {
          if (!analyser || state.muted || disposed) { setSpeaking(false); return; }
          analyser.getByteTimeDomainData(samples);
          let squareSum = 0;
          for (const sample of samples) { const value = (sample - 128) / 128; squareSum += value * value; }
          setSpeaking(Math.sqrt(squareSum / samples.length) > 0.035);
        }, 170);
      } catch { /* o indicador de voz é opcional; a chamada segue normalmente */ }
    }

    function setSpeaking(speaking) {
      const next = Boolean(speaking);
      if (lastSpeaking === next) return;
      lastSpeaking = next;
      updateTile('self', { name, avatar, muted: state.muted, speaking: next, sharing: state.sharing }, true);
      if (state.joined) sendState({ speaking: next });
    }

    async function toggleMute() {
      if (!micStream) {
        const acquired = await acquireMicrophone();
        if (!acquired) { updateControls(); return; }
      }
      state.muted = !state.muted;
      for (const track of micStream?.getAudioTracks?.() || []) track.enabled = !state.muted;
      if (state.muted) setSpeaking(false);
      updateControls();
      if (state.joined) sendState({ muted: state.muted });
    }

    function wakeRemoteAudio() {
      if (state.deaf) return;
      for (const audio of audioElements.values()) if (audio.paused) void audio.play().catch(() => {});
    }

    function toggleDeafen() {
      state.deaf = !state.deaf;
      for (const audio of audioElements.values()) {
        audio.muted = state.deaf;
        if (!state.deaf) void audio.play().catch(() => {});
      }
      updateControls();
      if (state.joined) sendState({ deaf: state.deaf });
    }

    async function stopScreenShare(announce = true) {
      if (!screenStream) return;
      const oldStream = screenStream;
      screenStream = null;
      state.sharing = false;
      for (const peer of peers.values()) {
        if (peer.videoTransceiver?.sender) await peer.videoTransceiver.sender.replaceTrack(null).catch(() => {});
      }
      oldStream.getTracks().forEach((track) => track.stop());
      const localTile = tiles.get('self');
      const video = localTile?.querySelector('.voice-tile-video');
      if (video) { video.srcObject = null; video.hidden = true; }
      localTile?.classList.remove('has-video', 'is-sharing');
      updateControls();
      if (announce && state.joined) sendState({ sharing: false });
    }

    function releaseLocalCapture() {
      if (speakingTimer) { clearInterval(speakingTimer); speakingTimer = null; }
      lastSpeaking = false;
      for (const track of micStream?.getTracks?.() || []) track.stop();
      for (const track of screenStream?.getTracks?.() || []) track.stop();
      micStream = null; screenStream = null;
      state.muted = true; state.sharing = false;
      if (audioContext) { void audioContext.close().catch(() => {}); audioContext = null; analyser = null; }
      const localVideo = tiles.get('self')?.querySelector('.voice-tile-video');
      if (localVideo) { localVideo.srcObject = null; localVideo.hidden = true; }
      tiles.get('self')?.classList.remove('has-video', 'is-sharing');
      updateControls();
    }

    async function startScreenShare() {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        showMessage('O compartilhamento de tela não está disponível neste navegador/dispositivo.', 'warning');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
        if (disposed || state.roomFull) { stream.getTracks().forEach((item) => item.stop()); return; }
        const track = stream.getVideoTracks()[0];
        if (!track) { stream.getTracks().forEach((item) => item.stop()); return; }
        screenStream = stream;
        state.sharing = true;
        for (const peer of peers.values()) {
          if (peer.videoTransceiver?.sender) await peer.videoTransceiver.sender.replaceTrack(track);
        }
        if (disposed || state.roomFull) { stream.getTracks().forEach((item) => item.stop()); return; }
        const tile = updateTile('self', { name, avatar, muted: state.muted, speaking: lastSpeaking, sharing: true }, true);
        const video = tile?.querySelector('.voice-tile-video');
        if (video) { video.srcObject = stream; video.hidden = false; void video.play().catch(() => {}); }
        tile?.classList.add('has-video', 'is-sharing');
        track.contentHint = 'motion';
        track.addEventListener('ended', () => { void stopScreenShare(); }, { once: true });
        updateControls();
        if (state.joined) sendState({ sharing: true });
      } catch (error) {
        if (error?.name !== 'NotAllowedError' && error?.name !== 'AbortError') showMessage('Não foi possível iniciar o compartilhamento de tela.', 'warning');
      }
    }

    async function toggleScreenShare() {
      if (screenStream) await stopScreenShare(); else await startScreenShare();
    }

    async function renderOutputMenu() {
      const menu = host.querySelector('[data-voice-output-menu]');
      const devicesNode = host.querySelector('[data-voice-output-devices]');
      const note = host.querySelector('[data-voice-output-note]');
      const trigger = host.querySelector('[data-voice-action="output"]');
      if (!menu || !devicesNode) return;
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      trigger?.setAttribute('aria-expanded', String(willOpen));
      if (!willOpen) return;
      devicesNode.replaceChildren();
      const supportsSink = Array.from(audioElements.values()).some((audio) => typeof audio.setSinkId === 'function') || 'setSinkId' in HTMLMediaElement.prototype;
      if (!supportsSink) {
        if (note) note.textContent = 'A saída de áudio é controlada pelo dispositivo ou navegador.';
        const item = document.createElement('button'); item.type = 'button'; item.className = 'voice-output-choice is-selected'; item.textContent = 'Saída padrão do dispositivo'; item.disabled = true; devicesNode.appendChild(item);
        return;
      }
      if (note) note.textContent = 'Escolha onde ouvir a chamada.';
      let outputs = [];
      try { outputs = (await navigator.mediaDevices?.enumerateDevices?.() || []).filter((device) => device.kind === 'audiooutput'); } catch { /* usa saída padrão */ }
      const choices = [{ deviceId: '', label: 'Padrão do dispositivo' }, ...outputs.filter((device) => device.deviceId && device.deviceId !== 'default').map((device) => ({ deviceId: device.deviceId, label: device.label || 'Saída de áudio' }))];
      choices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `voice-output-choice${choice.deviceId === state.selectedSinkId ? ' is-selected' : ''}`;
        button.dataset.voiceDeviceIndex = String(index);
        button.textContent = choice.label;
        if (choice.deviceId === state.selectedSinkId) button.insertAdjacentHTML('beforeend', icon('check', 16));
        devicesNode.appendChild(button);
      });
      menu._voiceChoices = choices;
    }

    async function chooseOutput(index) {
      const menu = host.querySelector('[data-voice-output-menu]');
      const choice = menu?._voiceChoices?.[Number(index)];
      if (!choice) return;
      state.selectedSinkId = choice.deviceId;
      const results = await Promise.all(Array.from(audioElements.values()).map(async (audio) => {
        if (typeof audio.setSinkId !== 'function') return false;
        try { await audio.setSinkId(choice.deviceId); return true; } catch { return false; }
      }));
      const note = host.querySelector('[data-voice-output-note]');
      if (note) note.textContent = results.some(Boolean) ? `Saída selecionada: ${choice.label}` : 'Não foi possível alterar a saída neste navegador.';
      await renderOutputMenu();
      showMessage(`Saída de áudio: ${choice.label}.`);
    }

    async function leaveAndExit() {
      if (leaving) return;
      leaving = true;
      teardown();
      onExit();
    }

    function handleClick(event) {
      const deviceButton = event.target.closest('[data-voice-device-index]');
      if (deviceButton) { void chooseOutput(deviceButton.dataset.voiceDeviceIndex); return; }
      const actionButton = event.target.closest('[data-voice-action]');
      if (!actionButton) {
        const menu = host.querySelector('[data-voice-output-menu]');
        if (menu && !event.target.closest('[data-voice-output-menu]')) {
          menu.hidden = true;
          host.querySelector('[data-voice-action="output"]')?.setAttribute('aria-expanded', 'false');
        }
        return;
      }
      const action = actionButton.dataset.voiceAction;
      if (action === 'back' || action === 'leave') { void leaveAndExit(); return; }
      if (action === 'mute') { void toggleMute(); return; }
      if (action === 'audio') { toggleDeafen(); return; }
      if (action === 'screen') { void toggleScreenShare(); return; }
      if (action === 'output') { void renderOutputMenu(); }
    }

    function teardown() {
      if (disposed) return;
      disposed = true;
      if (messageTimer) clearTimeout(messageTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (speakingTimer) clearInterval(speakingTimer);
      listenerController.abort();
      try { socket?.close(1000, 'left'); } catch { /* socket já fechado */ }
      for (const peer of peers.values()) { try { peer.pc?.close(); } catch { /* já fechada */ } }
      peers.clear();
      for (const audio of audioElements.values()) { audio.pause(); audio.srcObject = null; audio.remove(); }
      audioElements.clear();
      for (const track of [...(micStream?.getTracks?.() || []), ...(screenStream?.getTracks?.() || [])]) track.stop();
      micStream = null; screenStream = null;
      if (audioContext) void audioContext.close().catch(() => {});
      tiles.clear();
      if (host) host.replaceChildren();
    }

    host.addEventListener('pointerdown', wakeRemoteAudio, { signal: listenerController.signal });
    host.addEventListener('click', handleClick, { signal: listenerController.signal });
    updateControls();
    const initialTile = updateTile('self', { name, avatar, muted: false }, true);
    initialTile?.classList.add('is-local');
    updateParticipants();

    void (async () => {
      await acquireMicrophone();
      if (disposed) { micStream?.getTracks?.().forEach((track) => track.stop()); return; }
      updateControls();
      connectSocket();
    })();

    return teardown;
  }

  window.SedxVoiceRoom = Object.freeze({ mount });
})();
