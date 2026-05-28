const { issueCookie, safeEqual } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return res.status(500).json({ error: 'Server not configured: ADMIN_PASSWORD missing' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const password = body && body.password ? String(body.password) : '';

  if (!safeEqual(password, expected)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  try {
    issueCookie(res);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  return res.status(200).json({ ok: true });
};
