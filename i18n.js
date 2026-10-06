(function (host, factory) {
  'use strict';
  const api = factory(host);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (host) host.SymmetryI18n = api;
})(typeof window === 'undefined' ? null : window, function (host) {
  'use strict';
  const STORAGE_KEY = 'symmetry-lab-language';
  const messages = new Map(), patterns = [], fragments = new Map(), catalogs = new Set();
  const han = /[\u3400-\u9fff]/;
  let language = 'zh', observer = null, started = false, queued = false;
  const textSources = new WeakMap(), attributeSources = new WeakMap(), pending = new Set();
  const attributes = ['aria-label', 'aria-description', 'title', 'alt', 'placeholder', 'label'];
  if (host) {
    try { if (host.localStorage.getItem(STORAGE_KEY) === 'en') language = 'en'; } catch (_) { /* Local files and restricted browsers still support session switching. */ }
    host.document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  }

  function register(name, catalog) {
    if (catalogs.has(name)) return;
    catalogs.add(name);
    Object.entries(catalog.messages || {}).forEach(([source, english]) => {
      if (!source || typeof english !== 'string' || messages.has(source)) return;
      messages.set(source, english);
      if (!han.test(source)) return;
      const first = source[0];
      if (!fragments.has(first)) fragments.set(first, []);
      fragments.get(first).push([source, english]);
    });
    fragments.forEach(list => list.sort((a, b) => b[0].length - a[0].length));
    (catalog.patterns || []).forEach(p => patterns.push({ regex: new RegExp(p.regex, p.flags || ''), replacement: p.replacement }));
    if (started) apply();
  }

  function translateFragments(source) {
    let result = '', position = 0;
    while (position < source.length) {
      const candidates = fragments.get(source[position]);
      const match = candidates && candidates.find(([key]) => source.startsWith(key, position));
      if (match) { result += match[1]; position += match[0].length; }
      else { result += source[position]; position++; }
    }
    return result;
  }

  function englishPunctuation(text) {
    return text.replace(/，/g, ', ').replace(/。/g, '. ').replace(/；/g, '; ').replace(/：/g, ': ').replace(/、/g, ', ').replace(/（/g, ' (').replace(/）/g, ')').replace(/？/g, '?').replace(/！/g, '!');
  }
  function t(value, requestedLanguage = language) {
    if (value == null) return '';
    const source = String(value);
    if (requestedLanguage !== 'en') return source;
    if (messages.has(source)) return englishPunctuation(messages.get(source));
    const trimmed = source.trim();
    if (messages.has(trimmed)) return englishPunctuation(source.slice(0, source.indexOf(trimmed)) + messages.get(trimmed) + source.slice(source.indexOf(trimmed) + trimmed.length));
    const normalized = trimmed.replace(/\s+/g, ' ');
    if (messages.has(normalized)) return englishPunctuation(messages.get(normalized));
    if (!han.test(source)) return englishPunctuation(source);
    let result = source;
    for (const p of patterns) { p.regex.lastIndex = 0; result = result.replace(p.regex, p.replacement); }
    result = translateFragments(result);
    return englishPunctuation(result);
  }

  function ignored(element) { return element && (element.closest('[data-i18n-ignore]') || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(element.tagName)); }
  function canonicalRecord(records, key, current) {
    let record = records.get(key);
    if (!record || current !== record.last) { record = { source: current, last: current }; records.set(key, record); }
    return record;
  }
  function translateText(node) {
    if (!node.parentElement || ignored(node.parentElement)) return;
    const record = canonicalRecord(textSources, node, node.nodeValue);
    const translated = t(record.source);
    record.last = translated;
    if (node.nodeValue !== translated) node.nodeValue = translated;
  }
  function translateAttributes(element) {
    if (ignored(element)) return;
    let records = attributeSources.get(element);
    if (!records) { records = new Map(); attributeSources.set(element, records); }
    attributes.forEach(name => {
      if (!element.hasAttribute(name)) { records.delete(name); return; }
      const current = element.getAttribute(name), record = canonicalRecord(records, name, current);
      record.last = t(record.source);
      if (current !== record.last) element.setAttribute(name, record.last);
    });
  }
  function visit(root) {
    if (root.nodeType === 3) { translateText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) { if (ignored(root)) return; translateAttributes(root); }
    const walker = host.document.createTreeWalker(root, 5);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateText(node);
      else translateAttributes(node);
    }
  }
  function observe() {
    observer.observe(host.document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
  }
  function buttons() {
    host.document.querySelectorAll('[data-language-toggle]').forEach(button => {
      button.textContent = language === 'en' ? '中文' : 'English';
      button.setAttribute('lang', language === 'en' ? 'zh-CN' : 'en');
      button.setAttribute('aria-label', language === 'en' ? 'Switch to Chinese' : '切换到英文');
      button.setAttribute('title', language === 'en' ? 'Switch to Chinese' : '切换到英文');
    });
  }
  function apply() {
    if (!host || !started) return;
    observer.disconnect();
    visit(host.document.documentElement);
    buttons();
    observe();
  }
  function setLanguage(next, options = {}) {
    if (!['zh', 'en'].includes(next)) return false;
    language = next;
    if (!host) return true;
    host.document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    if (options.persist !== false) { try { host.localStorage.setItem(STORAGE_KEY, language); } catch (_) { /* In-memory preference remains usable. */ } }
    apply();
    host.document.dispatchEvent(new host.CustomEvent('symmetry-language-change', { detail: { language } }));
    return true;
  }
  function start() {
    if (started) return;
    started = true;
    function collect(records) {
      records.forEach(record => {
        if (record.type === 'childList') record.addedNodes.forEach(node => pending.add(node));
        else pending.add(record.target);
      });
    }
    observer = new host.MutationObserver(records => {
      collect(records);
      if (queued || !pending.size) return;
      queued = true;
      host.queueMicrotask(() => {
        queued = false;
        // Other module observers can render new content in the same delivery
        // cycle. Drain those records before disconnecting for our own writes.
        collect(observer.takeRecords());
        observer.disconnect();
        pending.forEach(node => { if (node.isConnected) visit(node); });
        pending.clear();
        observe();
      });
    });
    host.document.addEventListener('click', event => {
      if (event.target.closest('[data-language-toggle]')) setLanguage(language === 'en' ? 'zh' : 'en');
    });
    host.addEventListener('storage', event => {
      if (event.key === STORAGE_KEY && ['zh', 'en'].includes(event.newValue)) setLanguage(event.newValue, { persist: false });
    });
    setLanguage(language, { persist: false });
  }
  if (host) {
    if (host.document.readyState === 'loading') host.document.addEventListener('DOMContentLoaded', start, { once: true });
    else host.queueMicrotask(start);
  }
  return { t, register, setLanguage, getLanguage: () => language, apply, stats: () => ({ catalogs: catalogs.size, messages: messages.size, patterns: patterns.length }) };
});
