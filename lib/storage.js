// Storage helpers backed by Vercel Blob.
// Content is stored as a single JSON blob at a fixed path.
const { put, list } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

const CONTENT_BLOB_PATH = 'cms/content.json';

let defaultContentCache;
function readDefaults() {
  if (!defaultContentCache) {
    const p = path.join(process.cwd(), 'data', 'default-content.json');
    defaultContentCache = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  // Always return a fresh deep copy.
  return JSON.parse(JSON.stringify(defaultContentCache));
}

async function findContentBlob() {
  try {
    const res = await list({ prefix: CONTENT_BLOB_PATH, limit: 1 });
    if (res && res.blobs && res.blobs.length) {
      // Pick the entry whose pathname matches exactly.
      const exact = res.blobs.find((b) => b.pathname === CONTENT_BLOB_PATH);
      return exact || res.blobs[0];
    }
  } catch (e) {
    // No token in dev mode, or transient — fall back to defaults.
  }
  return null;
}

async function getContent() {
  const blob = await findContentBlob();
  if (!blob) return readDefaults();
  try {
    const r = await fetch(blob.url, { cache: 'no-store' });
    if (!r.ok) return readDefaults();
    const txt = await r.text();
    return JSON.parse(txt);
  } catch (e) {
    return readDefaults();
  }
}

async function saveContent(obj) {
  const body = JSON.stringify(obj, null, 2);
  const result = await put(CONTENT_BLOB_PATH, body, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  });
  return result;
}

module.exports = { getContent, saveContent, readDefaults };
