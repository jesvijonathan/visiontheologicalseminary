// Shared auth helpers for the serverless API.
const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'vts_admin';
const ONE_WEEK = 60 * 60 * 24 * 7;

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET env var is missing or too short.');
  }
  return s;
}

function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = decodeURIComponent(pair.slice(idx + 1).trim());
    out[k] = v;
  });
  return out;
}

function issueCookie(res) {
  const token = jwt.sign({ role: 'admin' }, getSecret(), { expiresIn: ONE_WEEK });
  const cookie = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${ONE_WEEK}`
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

function clearCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

function isAuthed(req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    if (!token) return false;
    const payload = jwt.verify(token, getSecret());
    return payload && payload.role === 'admin';
  } catch (e) {
    return false;
  }
}

function requireAuth(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// Timing-safe string compare to avoid leaking password length via timing.
function safeEqual(a, b) {
  const crypto = require('crypto');
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

module.exports = { issueCookie, clearCookie, isAuthed, requireAuth, safeEqual, COOKIE_NAME };
