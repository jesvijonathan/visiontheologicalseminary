// Server-side helper for direct browser-to-Blob uploads.
// The browser asks this endpoint for a one-time upload token; the file
// never passes through the serverless function, which keeps us well below
// Vercel's 4.5 MB body limit and works for PDFs and images alike.
const { handleUpload } = require('@vercel/blob/client');
const { isAuthed } = require('../lib/auth');

// Allowed MIME types and size cap (10 MB).
const ALLOWED = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
];
const MAX_BYTES = 10 * 1024 * 1024;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname /*, clientPayload */) => {
        if (!isAuthed(req)) {
          throw new Error('Unauthorized');
        }
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ pathname })
        };
      },
      onUploadCompleted: async () => {
        // No-op; content.json is updated by a separate PUT /api/content call.
      }
    });

    return res.status(200).json(jsonResponse);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Upload failed' });
  }
};
