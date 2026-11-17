import AsyncStorage from '@react-native-async-storage/async-storage';

export const MOBILE_WORKER_URL = 'https://sdf-mobile.gabrielreplit56.workers.dev';
export const SESSION_KEY = 'sed_sessao';

type Session = Record<string, unknown> & {
  usuario?: string;
  nome?: string;
  apelido?: string;
  token?: string;
  token2?: string;
  cdUsuarioCurto?: string | number;
  codigoAluno?: string | number;
  cdAluno?: string | number;
  cdUsuario?: string | number;
  ra?: string | number;
};

export async function readSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}

export async function saveSession(session: Session) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

function messageOf(payload: unknown, status: number) {
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    for (const key of ['erro', 'error', 'message']) if (typeof data[key] === 'string') return data[key] as string;
  }
  return status === 401 || status === 403 ? 'Sua sessão expirou. Entre novamente.' : `Não foi possível consultar os dados (HTTP ${status}).`;
}

function studentCode(session: Session) {
  const value = session.cdUsuarioCurto ?? session.codigoAluno ?? session.cdAluno ?? session.ra;
  return String(value ?? session.usuario?.replace(/\D/g, '') ?? '').trim();
}

function applySessionHeaders(headers: Headers, session: Session | null) {
  if (!session) return;
  if (session.token2) headers.set('X-Token2', String(session.token2));
  if (session.token) headers.set('X-Token', String(session.token));
  if (session.usuario) headers.set('X-Usuario', String(session.usuario));
  const code = studentCode(session);
  if (code) headers.set('X-Cd-Usuario', code);
  const taskUser = session.apelido || session.nome;
  if (taskUser) headers.set('X-Task-User', String(taskUser));
}

export async function mobileApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await readSession();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  applySessionHeaders(headers, session);
  let response = await fetch(`${MOBILE_WORKER_URL}${path}`, { ...init, headers });
  if ((response.status === 401 || response.status === 403) && path !== '/login' && session?.token) {
    try {
      const renewed = await resumeSession(session);
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set('Accept', 'application/json');
      if (init.body && !retryHeaders.has('Content-Type')) retryHeaders.set('Content-Type', 'application/json');
      applySessionHeaders(retryHeaders, renewed);
      response = await fetch(`${MOBILE_WORKER_URL}${path}`, { ...init, headers: retryHeaders });
    } catch { /* mantém a resposta original para exibir uma mensagem clara */ }
  }
  const raw = await response.text();
  let payload: unknown = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
  if (!response.ok) throw new Error(messageOf(payload, response.status));
  return payload as T;
}

async function resumeSession(current: Session) {
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
  applySessionHeaders(headers, current);
  const response = await fetch(`${MOBILE_WORKER_URL}/resume`, {
    method: 'POST', headers,
    body: JSON.stringify({ token: current.token, usuario: current.usuario || '' }),
  });
  const raw = await response.text();
  let payload: unknown = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
  if (!response.ok) throw new Error(messageOf(payload, response.status));
  const next = { ...current, ...(payload as Record<string, unknown>), usuario: current.usuario || (payload as Session).usuario || '' } as Session;
  await saveSession(next);
  return next;
}

export async function login(usuario: string, senha: string) {
  await clearSession();
  const response = await fetch(`${MOBILE_WORKER_URL}/login`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, senha }),
  });
  const raw = await response.text();
  let payload: unknown = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
  if (!response.ok) throw new Error(messageOf(payload, response.status));
  const session = { ...(payload as Record<string, unknown>), usuario } as Session;
  await saveSession(session);
  return session;
}
