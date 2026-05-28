const { requireAuth } = require('../lib/auth');
const { getContent, saveContent } = require('../lib/storage');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const content = await getContent();
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json(content);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    if (!requireAuth(req, res)) return;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Body must be a JSON object' });
    }
    // Size guard (1 MB).
    if (JSON.stringify(body).length > 1024 * 1024) {
      return res.status(413).json({ error: 'Content too large' });
    }

    try {
      await saveContent(body);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
};
