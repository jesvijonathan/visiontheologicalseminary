/* admin.js — VTS admin panel client. */
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let content = null;     // working copy of /api/content
  let dirty = false;

  function setDirty(v) {
    dirty = v;
    const btn = $('#save-btn');
    if (v) btn.textContent = 'Save changes *';
    else btn.textContent = 'Save changes';
  }

  function getPath(obj, path) {
    const parts = String(path).split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }
  function setPath(obj, path, value) {
    const parts = String(path).split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function status(msg, kind = 'info', timeout = 3000) {
    const bar = $('#status-bar');
    bar.textContent = msg;
    bar.className = 'status-bar ' + kind;
    bar.classList.remove('hidden');
    if (timeout) setTimeout(() => bar.classList.add('hidden'), timeout);
  }

  // ---------------- Auth ----------------
  async function checkAuth() {
    try {
      const r = await fetch('/api/me');
      const j = await r.json();
      return !!j.authed;
    } catch (e) { return false; }
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('#login-password').value;
    $('#login-error').textContent = '';
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        $('#login-error').textContent = j.error || 'Login failed';
        return;
      }
      await start();
    } catch (err) {
      $('#login-error').textContent = err.message;
    }
  });

  $('#logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
  });

  // ---------------- Tabs ----------------
  $$('#tabs button').forEach((b) => {
    b.addEventListener('click', () => {
      $$('#tabs button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const tab = b.dataset.tab;
      $$('[data-tab-panel]').forEach((p) => {
        p.classList.toggle('hidden', p.dataset.tabPanel !== tab);
      });
    });
  });

  // ---------------- Field binding (single inputs) ----------------
  function bindFields() {
    $$('[data-field]').forEach((el) => {
      const path = el.dataset.field;
      const cur = getPath(content, path);
      el.value = cur == null ? '' : String(cur);
      el.addEventListener('input', () => {
        setPath(content, path, el.value);
        setDirty(true);
      });
    });
  }

  // ---------------- PDF links display ----------------
  function bindCurrentLinks() {
    $$('[data-link]').forEach((a) => {
      const path = a.dataset.link;
      const v = getPath(content, path);
      if (v) {
        const href = isAbsolute(v) ? v : '/' + v.replace(/^\/+/, '');
        a.href = href;
        a.textContent = v;
      } else {
        a.textContent = '(none)';
        a.removeAttribute('href');
      }
    });
  }

  function isAbsolute(u) { return /^https?:\/\//i.test(u); }

  // ---------------- PDF uploads ----------------
  function bindUploads() {
    $$('input[type=file][data-upload]').forEach((inp) => {
      const path = inp.dataset.upload;
      const statusEl = inp.parentElement.querySelector('.upload-status');
      inp.addEventListener('change', async () => {
        const file = inp.files && inp.files[0];
        if (!file) return;
        statusEl.textContent = 'Uploading…';
        statusEl.className = 'upload-status';
        try {
          const url = await uploadFile(file);
          setPath(content, path, url);
          setDirty(true);
          bindCurrentLinks();
          statusEl.textContent = 'Uploaded. Click "Save changes" to publish.';
          statusEl.className = 'upload-status ok';
        } catch (err) {
          statusEl.textContent = err.message || 'Upload failed';
          statusEl.className = 'upload-status err';
        } finally {
          inp.value = '';
        }
      });
    });
  }

  async function uploadFile(file) {
    const { upload } = await import('https://esm.sh/@vercel/blob@0.23.4/client');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const result = await upload('uploads/' + Date.now() + '-' + safeName, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
      contentType: file.type || undefined
    });
    return result.url;
  }

  // ---------------- List editors ----------------
  function bindLists() {
    $$('[data-list]').forEach((container) => {
      const path = container.dataset.list;
      const fields = JSON.parse(container.dataset.fields);
      renderList(container, path, fields);
    });
  }

  function renderList(container, path, fields) {
    const arr = getPath(content, path);
    if (!Array.isArray(arr)) {
      setPath(content, path, []);
    }
    container.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'list-items';
    container.appendChild(list);

    const items = getPath(content, path);
    items.forEach((item, idx) => {
      list.appendChild(renderItem(path, fields, item, idx, () => renderList(container, path, fields)));
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-btn';
    addBtn.textContent = '+ Add item';
    addBtn.addEventListener('click', () => {
      const blank = {};
      fields.forEach((f) => { blank[f.key] = f.type === 'csv' ? [] : ''; });
      items.push(blank);
      setDirty(true);
      renderList(container, path, fields);
    });
    container.appendChild(addBtn);
  }

  function renderItem(listPath, fields, item, idx, rerender) {
    const wrap = document.createElement('div');
    wrap.className = 'list-item';

    fields.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'row';
      const lbl = document.createElement('label');
      lbl.textContent = f.label;
      row.appendChild(lbl);

      const cell = document.createElement('div');
      if (f.type === 'csv') {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = Array.isArray(item[f.key]) ? item[f.key].join(', ') : '';
        input.addEventListener('input', () => {
          item[f.key] = input.value.split(',').map((s) => s.trim()).filter((s) => s.length);
          setDirty(true);
        });
        cell.appendChild(input);
      } else if (f.type === 'image') {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = item[f.key] || '';
        input.placeholder = 'e.g. img/photo.jpg or https://…';
        input.addEventListener('input', () => {
          item[f.key] = input.value;
          setDirty(true);
          updatePreview();
        });
        cell.appendChild(input);

        const fileBtn = document.createElement('input');
        fileBtn.type = 'file';
        fileBtn.accept = 'image/*';
        fileBtn.style.marginTop = '0.4rem';
        const fileStatus = document.createElement('span');
        fileStatus.className = 'upload-status';
        fileBtn.addEventListener('change', async () => {
          const file = fileBtn.files && fileBtn.files[0];
          if (!file) return;
          fileStatus.textContent = 'Uploading…';
          try {
            const url = await uploadFile(file);
            item[f.key] = url;
            input.value = url;
            setDirty(true);
            updatePreview();
            fileStatus.textContent = 'Uploaded. Save to publish.';
            fileStatus.className = 'upload-status ok';
          } catch (err) {
            fileStatus.textContent = err.message || 'Upload failed';
            fileStatus.className = 'upload-status err';
          } finally {
            fileBtn.value = '';
          }
        });
        cell.appendChild(fileBtn);
        cell.appendChild(fileStatus);

        const img = document.createElement('img');
        img.className = 'image-preview';
        img.alt = '';
        cell.appendChild(img);
        function updatePreview() {
          const v = item[f.key];
          if (v) {
            img.src = isAbsolute(v) ? v : '/' + v.replace(/^\/+/, '');
            img.style.display = 'block';
          } else {
            img.style.display = 'none';
          }
        }
        updatePreview();
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = item[f.key] == null ? '' : String(item[f.key]);
        input.addEventListener('input', () => {
          item[f.key] = input.value;
          setDirty(true);
        });
        cell.appendChild(input);
      }

      row.appendChild(cell);
      wrap.appendChild(row);
    });

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = '↑';
    upBtn.title = 'Move up';
    upBtn.addEventListener('click', () => {
      const arr = getPath(content, listPath);
      if (idx === 0) return;
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      setDirty(true); rerender();
    });

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = '↓';
    downBtn.title = 'Move down';
    downBtn.addEventListener('click', () => {
      const arr = getPath(content, listPath);
      if (idx >= arr.length - 1) return;
      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
      setDirty(true); rerender();
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      if (!confirm('Delete this item?')) return;
      const arr = getPath(content, listPath);
      arr.splice(idx, 1);
      setDirty(true); rerender();
    });

    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(delBtn);
    wrap.appendChild(actions);

    return wrap;
  }

  // ---------------- Save ----------------
  $('#save-btn').addEventListener('click', async () => {
    try {
      const r = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content)
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        status('Save failed: ' + (j.error || r.status), 'err', 5000);
        return;
      }
      setDirty(false);
      status('Saved. Public pages now show the new content.', 'ok');
    } catch (err) {
      status('Save failed: ' + err.message, 'err', 5000);
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------------- Bootstrap ----------------
  async function loadContent() {
    const r = await fetch('/api/content', { cache: 'no-store' });
    content = await r.json();
  }

  async function start() {
    $('#login-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    await loadContent();
    bindFields();
    bindCurrentLinks();
    bindUploads();
    bindLists();
    setDirty(false);
  }

  (async function init() {
    const authed = await checkAuth();
    if (authed) {
      await start();
    } else {
      $('#login-view').classList.remove('hidden');
      $('#app-view').classList.add('hidden');
    }
  })();
})();
