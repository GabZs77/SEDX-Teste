const { put } = require('@vercel/blob');

const ALLOWED_ORIGINS = new Set(['https://sed-gg.vercel.app']);

function applyCors(req, res) {
  const origin = String(req.headers.origin || '');
  const allowed = ALLOWED_ORIGINS.has(origin) || /^https:\/\/sed-[a-z0-9-]+-hackersroblox66-gmailcoms-projects\.vercel\.app$/i.test(origin);
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : 'https://sed-gg.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type, X-Token, X-Token2, X-Usuario');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');
}

function fail(res, status, message) {
  return res.status(status).json({ erro: message });
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return fail(res, 405, 'Método não permitido.');
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fail(res, 503, 'Blob do Vercel não configurado.');

  const ra = String(req.headers['x-usuario'] || '').replace(/\D/g, '').slice(0, 24);
  const token2 = String(req.headers['x-token2'] || '').trim();
  if (!ra || !token2) return fail(res, 401, 'Sessão ausente.');

  const photo = typeof req.body?.photo === 'string' ? req.body.photo.trim() : '';
  const match = photo.match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return fail(res, 400, 'Envie uma foto válida.');
  const encoded = match[2];
  if (encoded.length > 430000) return fail(res, 413, 'A foto deve ter no máximo 300 KB.');

  const contentType = `image/${match[1].toLowerCase()}`;
  const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const pathname = `profile-avatars/${ra}-${Date.now()}.${extension}`;
  const result = await put(pathname, Buffer.from(encoded, 'base64'), { access: 'public', addRandomSuffix: true, contentType });
  return res.status(200).json({ ok: true, url: result.url });
};

module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };
