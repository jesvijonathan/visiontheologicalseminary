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
  if (!blob) return migrate(readDefaults());
  try {
    const r = await fetch(blob.url, { cache: 'no-store' });
    if (!r.ok) return migrate(readDefaults());
    const txt = await r.text();
    return migrate(JSON.parse(txt));
  } catch (e) {
    return migrate(readDefaults());
  }
}

// Convert any legacy `ata`/`nonAta`/`fullTime`/`partTime`/`visiting`/`librarian`
// arrays into the new `sections: [{title, items}]` shape so old saved blobs
// keep working after the schema upgrade.
function migrate(c) {
  if (!c || typeof c !== 'object') return c;
  migrateCoursesLike(c.courses, 'Courses');
  migrateCoursesLike(c.programmes, 'Programmes');
  migrateCoursesLike(c.fees, 'Fees');
  migrateFaculty(c.faculty);
  return c;
}

function migrateCoursesLike(node, label) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.sections)) return;
  const sections = [];
  if (Array.isArray(node.ata) && node.ata.length) {
    sections.push({ title: label + ' (ATA Degrees)', items: node.ata });
  }
  if (Array.isArray(node.nonAta) && node.nonAta.length) {
    sections.push({ title: label + ' (Non ATA Degrees)', items: node.nonAta });
  }
  if (sections.length) node.sections = sections;
  delete node.ata;
  delete node.nonAta;
}

function migrateFaculty(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.sections)) return;
  const map = [
    ['fullTime', 'Full Time'],
    ['partTime', 'Part Time'],
    ['visiting', 'Visiting'],
    ['librarian', 'Librarian']
  ];
  const sections = [];
  for (const [key, title] of map) {
    if (Array.isArray(node[key]) && node[key].length) {
      sections.push({ title, items: node[key] });
    }
    delete node[key];
  }
  if (sections.length) node.sections = sections;
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
