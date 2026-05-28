/* cms-loader.js — runs on every public page.
 *
 * Fetches /api/content and replaces marked DOM elements:
 *
 *  Single-value markers (any element):
 *    data-cms="text:contact.phoneLandline"   -> set textContent
 *    data-cms="html:fees.scheduleNote"       -> set innerHTML
 *    data-cms="href:pdfs.applicationForm"    -> set href
 *    data-cms="src:gallery.0.image"          -> set src
 *
 *  List markers (a container element):
 *    data-cms-list="faculty.fullTime"
 *    -> The container must include a <template data-cms-item> child.
 *       The template's HTML may use {{field}} placeholders, which are
 *       replaced for every item in the array. Attribute values are
 *       also scanned, so e.g. <img src="{{image}}"> works.
 *
 * Path syntax: dot/bracket notation (a.b.0.c).
 */
(function () {
  function getPath(obj, path) {
    if (!path) return undefined;
    const parts = String(path).split('.');
    let cur = obj;
    for (let i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function applySingle(el, content) {
    const spec = el.getAttribute('data-cms');
    if (!spec) return;
    const colon = spec.indexOf(':');
    if (colon === -1) return;
    const kind = spec.slice(0, colon).trim();
    const path = spec.slice(colon + 1).trim();
    const val = getPath(content, path);
    if (val == null) return;
    switch (kind) {
      case 'text':
        el.textContent = String(val);
        break;
      case 'html':
        el.innerHTML = String(val);
        break;
      case 'href':
        el.setAttribute('href', String(val));
        break;
      case 'src':
        el.setAttribute('src', String(val));
        break;
      default:
        // Unknown kind -> ignore.
        break;
    }
  }

  function fillTemplate(html, item) {
    return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (_m, key) {
      const v = getPath(item, key);
      return v == null ? '' : escapeHtml(String(v));
    });
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function applyList(container, content) {
    const path = container.getAttribute('data-cms-list');
    const arr = getPath(content, path);
    if (!Array.isArray(arr)) return;
    const tpl = container.querySelector('template[data-cms-item]');
    if (!tpl) return;
    const tplHtml = tpl.innerHTML;
    // Remove all existing rendered children except the template itself.
    Array.prototype.slice.call(container.children).forEach(function (child) {
      if (child !== tpl) container.removeChild(child);
    });
    const frag = document.createDocumentFragment();
    arr.forEach(function (item, idx) {
      const filled = fillTemplate(tplHtml, Object.assign({ _index: idx }, item));
      const wrapper = document.createElement('div');
      wrapper.innerHTML = filled;
      while (wrapper.firstChild) frag.appendChild(wrapper.firstChild);
    });
    container.appendChild(frag);
  }

  /* Sections — nested list of {title, items:[...]} groups.
   *
   *   <div data-cms-sections="courses.sections">
   *     <template data-cms-section>
   *       <h2>{{title}}</h2>
   *       <div class="row" data-cms-section-items></div>
   *     </template>
   *     <template data-cms-section-item>
   *       <div class="col"><h5>{{code}}</h5><p>{{title}}</p></div>
   *     </template>
   *   </div>
   */
  function applySections(container, content) {
    const path = container.getAttribute('data-cms-sections');
    const arr = getPath(content, path);
    if (!Array.isArray(arr)) return;
    const sectionTpl = container.querySelector('template[data-cms-section]');
    const itemTpl = container.querySelector('template[data-cms-section-item]');
    if (!sectionTpl) return;
    const sectionHtml = sectionTpl.innerHTML;
    const itemHtml = itemTpl ? itemTpl.innerHTML : '';
    // Remove all existing rendered children except the templates.
    Array.prototype.slice.call(container.children).forEach(function (child) {
      if (child !== sectionTpl && child !== itemTpl) container.removeChild(child);
    });
    const frag = document.createDocumentFragment();
    arr.forEach(function (section, sIdx) {
      const sectionFilled = fillTemplate(
        sectionHtml,
        Object.assign({ _index: sIdx }, section)
      );
      const wrapper = document.createElement('div');
      wrapper.innerHTML = sectionFilled;
      // Find the items slot inside the rendered section.
      const slot = wrapper.querySelector('[data-cms-section-items]');
      if (slot && itemHtml && Array.isArray(section.items)) {
        let itemsRendered = '';
        section.items.forEach(function (item, iIdx) {
          itemsRendered += fillTemplate(
            itemHtml,
            Object.assign({ _index: iIdx }, item)
          );
        });
        slot.innerHTML = itemsRendered;
      }
      while (wrapper.firstChild) frag.appendChild(wrapper.firstChild);
    });
    container.appendChild(frag);
  }

  function derive(content) {
    // Synthesize convenience fields so admin only edits the raw values.
    content.contact = content.contact || {};
    var c = content.contact;
    if (c.whatsappNumber) {
      var num = String(c.whatsappNumber).replace(/[^+\d]/g, '');
      c.whatsappUrl = 'https://wa.me/' + num + '?text=Enquiry';
    }
    if (c.primaryEmail) {
      c.primaryEmailMailto = 'mailto:' + c.primaryEmail;
    }
    if (c.primaryPhoneTel) {
      c.primaryPhoneTelHref = 'tel:' + String(c.primaryPhoneTel).replace(/[^+\d]/g, '');
    }
    return content;
  }

  function apply(content) {
    derive(content);
    document.querySelectorAll('[data-cms]').forEach(function (el) {
      applySingle(el, content);
    });
    document.querySelectorAll('[data-cms-list]').forEach(function (el) {
      applyList(el, content);
    });
    document.querySelectorAll('[data-cms-sections]').forEach(function (el) {
      applySections(el, content);
    });
  }

  function init() {
    fetch('/api/content', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (content) {
        if (content) apply(content);
      })
      .catch(function () { /* silent: keep static fallback content */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
