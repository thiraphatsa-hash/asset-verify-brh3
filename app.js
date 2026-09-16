/**
 * Asset Verification — UI logic
 * โครงสร้าง: หน้าหลัก (เลือกรอบตรวจ) → รายการทรัพย์สินของรอบ (ตาราง/การ์ด) → สรุปผล
 * ต้องโหลดหลัง: supabase-js, config.js, src/assetStore.js
 */
const App = (() => {
  'use strict';

  const APP_VERSION = 'v2.9.7';
  const CFG = window.ASSET_CONFIG || {};

  // รูปแบบรหัสทรัพย์สิน (derive จากข้อมูลจริง — ส่วนปีมีค่า "YY" ได้)
  // เลขท้ายเป็นตัวเลข 4 หลัก หรือ ตัวอักษร 1 ตัว + เลข 3 หลัก (เช่น RT-PSFX-18-N102 ของ KL5-TEMP)
  // (?![A-Z0-9]) กันไม่ให้รหัสที่พิมพ์เกิน เช่น RT-AIRC-19-00024 ถูกตัดเหลือ RT-AIRC-19-0002 แล้วหลุดเข้าทะเบียน
  const INV_RE = /RT-[A-Z0-9]{4}-[A-Z0-9]{2}-(?:\d{4}|[A-Z]\d{3})(?![A-Z0-9])/;

  const RESULTS = {
    FOUND_NORMAL: { result: 'FOUND',     condition: 'NORMAL', label: 'พบ',      cls: 'found' },
    NOT_FOUND:    { result: 'NOT_FOUND', condition: null,     label: 'ไม่พบ',   cls: 'notfound' },
    MOVED:        { result: 'MOVED',     condition: null,     label: 'ย้ายออก', cls: 'moved' }
  };
  // ── ชุดไอคอน flat modern (วาดด้วย SVG ในไฟล์ ไม่พึ่ง CDN) ───────────────────
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.8V20h13V9.8"/><path d="M9.5 20v-6h5v6"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 15h18M9 9.5V20"/>',
    scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M4 12h16"/>',
    chart: '<path d="M3 20h18"/><path d="M6.5 20v-6M11.5 20V6M16.5 20v-9M21 20v-4"/>',
    settings: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="17" r="2"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>',
    logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="m15 8 4 4-4 4M19 12H9"/>',
    back: '<path d="M14 6l-6 6 6 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
    flash: '<path d="M12 3a5 5 0 0 1 5 5c0 1.9-1.1 2.9-1.7 4.1-.3.6-.4 1.2-.4 1.9H9.1c0-.7-.1-1.3-.4-1.9C8.1 10.9 7 9.9 7 8a5 5 0 0 1 5-5z"/><path d="M10 17.5h4M10.6 20.5h2.8"/>',
    download: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19h14"/>',
    upload: '<path d="M12 20V9M8 12l4-4 4 4"/><path d="M5 4h14"/>',
    trash: '<path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14"/><path d="M10 10v7M14 10v7"/>',
    camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.4"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.7"/><path d="m5 17 4.5-4.5 3 3L16 12l3 3.5"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    truck: '<path d="M3 6.5h11v10H3z"/><path d="M14 9.5h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
    bell: '<path d="M18 15V10a6 6 0 1 0-12 0v5l-2 3h16z"/><path d="M10 21h4"/>',
    more: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m4 4 16 16"/><path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 4M6.6 8A16.4 16.4 0 0 0 2.5 12S6 18.5 12 18.5c1.2 0 2.3-.2 3.3-.6"/>',
    building: '<path d="M4 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17"/><path d="M14 8h5a1 1 0 0 1 1 1v12"/><path d="M2.5 21h19"/><path d="M7 7h4M7 11h4M7 15h4M17 12h.01M17 16h.01"/>',
    note: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 17h4"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m8.5 13 2.5 2.5 4.5-5"/>',
    square: '<rect x="4.5" y="4.5" width="15" height="15" rx="2"/>',
    alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
    edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 6.5l3 3"/>',
    columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v4h4"/><path d="M12 7.5V12l3 2"/>',
    hash: '<path d="M5 9h14M5 15h14M10 4 8.5 20M15.5 4 14 20"/>'
  };
  function icon(name, cls) {
    const body = ICONS[name];
    if (!body) return '';
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + body + '</svg>';
  }
  // ── Dropdown ที่พิมพ์ค้นหาได้ (ครอบ <select> เดิม ไม่ต้องแก้โค้ดที่เรียกใช้) ──
  /**
   * ห่อ <select> ด้วยปุ่ม + ช่องค้นหา โดยยังใช้ค่า/เหตุการณ์ change ของ select เดิม
   * เรียก select.__combo.sync() ทุกครั้งที่เขียน options ใหม่
   */
  function enhanceSelect(select) {
    if (!select || select.__combo) return select ? select.__combo : null;
    const wrap = document.createElement('div');
    wrap.className = 'combo';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('combo-native');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'combo-btn';
    const panel = document.createElement('div');
    panel.className = 'combo-panel hidden';
    panel.innerHTML = '<label class="combo-search-box"><span data-icon="search"></span>' +
      '<input type="search" class="combo-search" placeholder="พิมพ์เพื่อค้นหา..." ' +
      'autocomplete="off" enterkeyhint="done"></label><div class="combo-list"></div>';
    wrap.appendChild(btn);
    wrap.appendChild(panel);
    hydrateIcons(panel);
    const search = panel.querySelector('.combo-search');
    const list = panel.querySelector('.combo-list');

    function sync() {
      const opt = select.options[select.selectedIndex];
      btn.innerHTML = '<span class="combo-label">' + esc(opt ? opt.textContent : '') + '</span>' +
        '<span class="combo-caret">▾</span>';
    }
    function renderList() {
      const q = search.value.trim().toLowerCase();
      const items = Array.from(select.options).filter((o) =>
        !q || o.textContent.toLowerCase().indexOf(q) >= 0);
      list.innerHTML = items.length
        ? items.map((o) => '<button type="button" class="combo-item' +
            (o.selected ? ' on' : '') + '" data-v="' + esc(o.value) + '">' +
            esc(o.textContent) + '</button>').join('')
        : '<p class="combo-empty">ไม่พบตัวเลือกที่ตรงกับคำค้น</p>';
    }
    function open() {
      document.querySelectorAll('.combo-panel').forEach((p) => p.classList.add('hidden'));
      panel.classList.remove('hidden');
      search.value = '';
      renderList();
      setTimeout(() => search.focus(), 30);
    }
    function close() { panel.classList.add('hidden'); }

    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (panel.classList.contains('hidden')) open(); else close();
    });
    search.addEventListener('input', renderList);
    search.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { close(); btn.focus(); }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const first = list.querySelector('.combo-item');
        if (first) first.click();
      }
    });
    list.addEventListener('click', (ev) => {
      const item = ev.target.closest('.combo-item');
      if (!item) return;
      const val = item.getAttribute('data-v') || '';
      // ตั้งค่าด้วย selectedIndex เชื่อถือได้กว่าการเซ็ต .value ตรงๆ
      const idx = Array.prototype.findIndex.call(select.options, (o) => o.value === val);
      if (idx >= 0) select.selectedIndex = idx; else select.value = val;
      sync();
      close();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    panel.addEventListener('click', (ev) => ev.stopPropagation());
    document.addEventListener('click', close);

    select.__combo = { sync: sync, close: close };
    sync();
    return select.__combo;
  }
  function syncCombo(id) {
    const sel = el(id);
    if (sel && sel.__combo) sel.__combo.sync();
  }
  function enhanceAllSelects() {
    document.querySelectorAll('select:not(.combo-native)').forEach(enhanceSelect);
  }
  /** เติมไอคอนให้ทุก element ที่มี data-icon ใน HTML คงที่ */
  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((n) => {
      if (n.getAttribute('data-icon-done')) return;
      n.innerHTML = icon(n.getAttribute('data-icon'));
      n.setAttribute('data-icon-done', '1');
    });
  }
  const THEMES = [
    { key: 'porcelain', label: 'Porcelain — ขาวสะอาด น้ำเงินกรมท่า' },
    { key: 'graphite',  label: 'Graphite — พื้นเข้ม ทอง' },
    { key: 'ink',       label: 'Ink & Serif — ครีม แดงเลือดหมู' },
    { key: 'organic',   label: 'Organic — ครีมทราย ดินเผา' }
  ];
  const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  const state = {
    profile: null,
    canWrite: false,
    sessions: [],
    logSummary: [],
    activeSession: null,
    master: [],
    logs: [],
    counts: [],
    queueItems: [],
    latest: new Map(),
    selection: new Set(),
    users: [],
    authMode: 'login',
    page: 'home',
    home: { q: '', status: '', sort: 'created' },
    ui: {
      type: 'FIXED', view: 'table', q: '', cat: '', staff: '', area: '', status: '', sort: 'inv',
      limit: 150,                                // แถวที่วาดอยู่ (= PAGE_SIZE) เพิ่มเองเมื่อเลื่อนถึงท้าย
      cols: { FIXED: null, RENTAL: null }        // null = อัตโนมัติตามขนาดจอ
    },
    act: { who: '', result: '', range: '', q: '', sort: 'new' },   // หน้าประวัติการบันทึก
    map: { who: '', range: '', area: '' },                         // ตัวกรองแผนที่ใน Dashboard
    geo: null,
    geoWatch: null,
    leaf: null,                                                    // Leaflet map instance
    count: { cat: '', n: 1 },
    areaPick: null,                                                // แผงเลือกพื้นที่จัดเก็บ
    rec: null,
    accessSeen: {},
    accessTimer: null,
    scan: {
      active: false, paused: false, busy: false, stream: null, reader: null, zxReader: null,
      detector: null, timer: null, lastCode: '', lastRaw: '', frames: 0, engine: '',
      startedAt: 0, tipsShown: false
    },
    bulk: { cats: [], resultKey: 'FOUND_NORMAL', count: 0, auto: true },
    importData: null,
    flushing: false,
    channel: null,
    pendTimer: null
  };

  // ── DOM / util ─────────────────────────────────────────────────────────────
  const el = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  /** onClick = แตะที่ข้อความแล้วเปิดหน้าที่เกี่ยวข้องได้ (ใช้กับคำเตือนที่ต้องไปตรวจสอบต่อ) */
  function toast(msg, kind, onClick, ms) {
    const box = document.createElement('div');
    box.className = 'toast' + (kind ? ' ' + kind : '') + (onClick ? ' tappable' : '');
    box.textContent = msg;
    if (onClick) {
      box.setAttribute('role', 'button');
      box.addEventListener('click', () => { box.remove(); try { onClick(); } catch (e) {} });
    }
    el('toastContainer').appendChild(box);
    setTimeout(() => { box.remove(); }, ms || 3600);
  }
  function busy(text) { el('busyText').textContent = text || 'กำลังดำเนินการ...'; el('busyOverlay').classList.remove('hidden'); }
  function busyHide() { el('busyOverlay').classList.add('hidden'); }
  function cacheSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function cacheGet(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function thaiDT(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getDate() + ' ' + TH_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function thaiD(iso) {
    if (!iso) return '';
    const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.getDate() + ' ' + TH_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543);
  }
  function normalizeCode(raw) {
    const s = String(raw || '').toUpperCase().replace(/[–—]/g, '-');
    const m = s.match(INV_RE);
    return m ? m[0] : '';
  }
  function inspectorName() {
    const p = state.profile || {};
    return p.fullName || p.email || 'ไม่ระบุ';
  }
  let beepCtx = null;
  function beep() {
    try {
      beepCtx = beepCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = beepCtx.createOscillator();
      const g = beepCtx.createGain();
      o.connect(g); g.connect(beepCtx.destination);
      o.frequency.value = 1250; g.gain.value = 0.08;
      o.start(); o.stop(beepCtx.currentTime + 0.12);
    } catch (e) {}
    if (navigator.vibrate) { try { navigator.vibrate(50); } catch (e) {} }
  }

  // ── โหลดไลบรารีตอนใช้จริง ──────────────────────────────────────────────────
  const LIBS = {
    xlsx: { url: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', global: 'XLSX' },
    exceljs: { url: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js', global: 'ExcelJS' },
    zxing: { url: 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js', global: 'ZXing' },
    leaflet: {
      url: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js', global: 'L',
      css: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'
    }
  };
  function ensureCss(url) {
    if (document.querySelector('link[data-lib="' + url + '"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-lib', url);
    document.head.appendChild(link);
  }
  const libLoading = {};
  function ensureLibrary(name) {
    const lib = LIBS[name];
    if (lib.css) ensureCss(lib.css);
    if (window[lib.global]) return Promise.resolve();
    if (libLoading[name]) return libLoading[name];
    libLoading[name] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = lib.url;
      s.onload = () => resolve();
      s.onerror = () => {
        delete libLoading[name];
        reject(new Error('โหลดไลบรารีไม่สำเร็จ (' + name + ') — ต้องต่ออินเทอร์เน็ตครั้งแรกที่ใช้'));
      };
      document.head.appendChild(s);
    });
    return libLoading[name];
  }

  // ── คิวออฟไลน์ (IndexedDB) ─────────────────────────────────────────────────
  let idb = null;
  function idbOpen() {
    return new Promise((resolve, reject) => {
      const rq = indexedDB.open('asset-verify', 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore('queue', { keyPath: 'clientId' }); };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error || new Error('เปิดฐานข้อมูลในเครื่องไม่ได้'));
    });
  }
  async function idbStore(mode) {
    if (!idb) idb = await idbOpen();
    return idb.transaction('queue', mode).objectStore('queue');
  }
  const reqP = (rq) => new Promise((resolve, reject) => {
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
  async function qAll() { return reqP((await idbStore('readonly')).getAll()) || []; }
  async function qPut(item) { return reqP((await idbStore('readwrite')).put(item)); }
  async function qDel(id) { return reqP((await idbStore('readwrite')).delete(id)); }
  async function loadQueue() {
    try { state.queueItems = (await qAll()) || []; }
    catch (e) { state.queueItems = []; }
    updateSyncChip();
  }
  function updateSyncChip() {
    const n = state.queueItems.length;
    el('syncCount').textContent = n;
    const chip = el('syncChip');
    chip.classList.toggle('hidden', n === 0);
    // ส่งไม่ผ่านด้วยสาเหตุถาวร (สิทธิ์/ระบบยังไม่พร้อม) = ชิปเปลี่ยนเป็นสีแดง ไม่ใช่แค่ "รอส่ง"
    const stuck = state.queueItems.some((q) => q.lastError && !isNetworkError(q.lastError));
    chip.classList.toggle('stuck', stuck);
    chip.title = stuck ? 'ส่งไม่สำเร็จ — แตะเพื่อดูสาเหตุ' : 'รายการที่รอส่ง';
    const net = el('netChip');
    net.className = 'net-chip ' + (navigator.onLine ? 'online' : 'offline');
    net.title = navigator.onLine ? 'ออนไลน์' : 'ออฟไลน์ — บันทึกได้ ระบบจะส่งให้เมื่อกลับมาออนไลน์';
  }
  async function flushQueue() {
    if (state.flushing || !navigator.onLine || !state.queueItems.length) { updateSyncChip(); return; }
    state.flushing = true;
    updateSyncChip();
    let sent = 0;
    let stuck = 0;              // ส่งไม่ผ่านด้วยสาเหตุถาวร (ไม่ใช่เน็ตหลุด)
    let stuckMsg = '';
    let needRefresh = false;    // มีแถวที่เซิร์ฟเวอร์บอกว่า "มีอยู่แล้ว" → ดึงของจริงมาทับ
    try {
      const items = state.queueItems.slice();
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        try {
          if (it.kind === 'count') {                 // ยอดนับตามหมวด (แนบรูป/พิกัดได้)
            const cPhotos = it.photos || [];
            for (let p = 0; p < cPhotos.length; p++) {
              if (!cPhotos[p].path) {
                cPhotos[p].path = await AssetStore.uploadPhoto(cPhotos[p].dataUrl, it.sessionId,
                  'count-' + (it.categoryCode || 'NA'));
                await qPut(it);   // จำความคืบหน้า — retry รอบหน้าไม่อัปโหลดรูปซ้ำ
              }
            }
            const savedCount = await AssetStore.saveCount({
              clientId: it.clientId, sessionId: it.sessionId, site: it.site,
              assetType: it.assetType, categoryCode: it.categoryCode, counted: it.counted,
              locationText: it.locationText || '', note: it.note || '',
              gpsLat: it.gpsLat == null ? null : it.gpsLat,
              gpsLng: it.gpsLng == null ? null : it.gpsLng,
              gpsAccuracy: it.gpsAccuracy == null ? null : it.gpsAccuracy,
              photoPaths: cPhotos.map((p) => p.path).filter(Boolean),
              inspector: it.inspector, countedAt: it.countedAt
            });
            await qDel(it.clientId);
            state.queueItems = state.queueItems.filter((q) => q.clientId !== it.clientId);
            if (savedCount && savedCount.countId) addCountLocal(savedCount);
            else { addCountLocal(sentCountFrom(it)); needRefresh = true; }
            sent++;
            continue;
          }
          const photos = it.photos || [];
          for (let p = 0; p < photos.length; p++) {
            if (!photos[p].path) {
              photos[p].path = await AssetStore.uploadPhoto(photos[p].dataUrl, it.sessionId, it.inventoryNumber);
              await qPut(it);   // จำความคืบหน้า — retry รอบหน้าไม่อัปโหลดรูปซ้ำ
            }
          }
          const saved = await AssetStore.saveVerify({
            clientId: it.clientId,
            sessionId: it.sessionId,
            inventoryNumber: it.inventoryNumber,
            assetType: it.assetType,
            site: it.site,
            result: it.result,
            condition: it.condition || null,
            method: it.method,
            inspector: it.inspector,
            pieceNo: it.pieceNo || 1,
            locationText: it.locationText || '',
            gpsLat: it.gpsLat == null ? null : it.gpsLat,
            gpsLng: it.gpsLng == null ? null : it.gpsLng,
            gpsAccuracy: it.gpsAccuracy == null ? null : it.gpsAccuracy,
            photoPaths: photos.map((p) => p.path).filter(Boolean),
            moveToSite: it.moveToSite || null,
            moveDocNo: it.moveDocNo || null,
            moveDate: it.moveDate || null,
            note: it.note || '',
            unregistered: Boolean(it.unregistered),
            unlistedDesc: it.unlistedDesc || null,
            verifiedAt: it.verifiedAt
          });
          await qDel(it.clientId);
          state.queueItems = state.queueItems.filter((q) => q.clientId !== it.clientId);
          if (saved && saved.logId) addLogLocal(saved);
          // เซิร์ฟเวอร์บอกว่ามีแถวนี้อยู่แล้ว แต่ดึงกลับมาไม่ได้ → คงผลไว้บนจอก่อน
          // (ถ้าปล่อยหาย ผู้ตรวจจะนึกว่าไม่ได้บันทึกแล้วเดินไปบันทึกซ้ำ)
          else { addLogLocal(sentLogFrom(it)); needRefresh = true; }
          sent++;
        } catch (e) {
          it.lastError = e.message;
          it.tries = (it.tries || 0) + 1;
          try { await qPut(it); } catch (e2) {}
          // เน็ตหลุด = หยุดทั้งรอบไว้ส่งใหม่ทีหลัง · error ถาวร (เช่นยังไม่ได้รัน SQL,
          // สิทธิ์ไม่พอ, ข้อมูลผิดรูป) = ข้ามตัวนี้ไปส่งตัวอื่นต่อ ไม่ให้ค้างทั้งคิว
          if (isNetworkError(e.message)) break;
          stuck++;
          if (!stuckMsg) stuckMsg = e.message;
        }
      }
    } finally {
      state.flushing = false;
      updateSyncChip();
      if (sent) { afterDataChange(); toast('ส่งผลตรวจค้างส่งแล้ว ' + sent + ' รายการ', 'success'); }
      // ห้ามเงียบ: ถ้าส่งไม่ผ่านเพราะสิทธิ์/ระบบยังไม่พร้อม ต้องรู้ทันทีตั้งแต่รายการแรก
      if (stuck) {
        afterDataChange();
        toast('ส่งไม่สำเร็จ ' + stuck + ' รายการ — ' + shortErr(stuckMsg) + ' (แตะเพื่อดูรายละเอียด)',
          'error', openQueuePanel, 9000);
      }
      if (needRefresh) refreshAll(true);
    }
  }
  /** แปลสาเหตุที่ส่งไม่ผ่านให้อ่านรู้เรื่องหน้างาน */
  function shortErr(msg) {
    const m = String(msg || '');
    if (/row-level security|permission denied|not authorized|violates row/i.test(m)) {
      return 'บัญชีไม่มีสิทธิ์บันทึกแล้ว — แจ้งผู้ดูแลระบบ';
    }
    if (/jwt|expired|invalid token|refresh_token/i.test(m)) return 'เซสชันหมดอายุ — ออกจากระบบแล้วเข้าใหม่';
    if (/ยังไม่ได้ติดตั้ง|รันไฟล์|does not exist|schema cache/i.test(m)) return 'ระบบยังติดตั้งไม่ครบ';
    return m.length > 55 ? m.slice(0, 55) + '…' : m;
  }
  /** แถวที่ถูกบันทึกไว้แล้วแต่เครื่องนี้ไม่ได้รับคำตอบ — ใช้แสดงบนจอชั่วคราวจนรีเฟรชได้ของจริง */
  function sentLogFrom(it) {
    const l = queueToLog(it);
    l.logId = 'sent-' + it.clientId;
    l.pending = false;
    l.photoPaths = (it.photos || []).map((p) => p.path).filter(Boolean);
    l.photoCount = l.photoPaths.length;
    return l;
  }
  function sentCountFrom(it) {
    return {
      countId: 'sent-' + it.clientId, clientId: it.clientId, sessionId: it.sessionId,
      site: it.site, assetType: it.assetType, categoryCode: it.categoryCode,
      counted: it.counted, locationText: it.locationText, note: it.note,
      inspector: it.inspector, countedAt: it.countedAt,
      gpsLat: it.gpsLat == null ? null : it.gpsLat,
      gpsLng: it.gpsLng == null ? null : it.gpsLng,
      gpsAccuracy: it.gpsAccuracy == null ? null : it.gpsAccuracy,
      photoPaths: (it.photos || []).map((p) => p.path).filter(Boolean)
    };
  }
  function isNetworkError(msg) {
    return /failed to fetch|networkerror|network request failed|timeout|load failed|offline/i
      .test(String(msg || ''));
  }
  function flushQueueNow() {
    openQueuePanel();
  }
  // ── รายการค้างส่ง: ดูสาเหตุที่ส่งไม่ผ่าน / ลองใหม่ / ทิ้งรายการที่ค้าง ────────
  function openQueuePanel() {
    renderQueuePanel();
    el('queueModal').classList.remove('hidden');
  }
  function closeQueuePanel() { el('queueModal').classList.add('hidden'); }
  function renderQueuePanel() {
    const items = state.queueItems.slice();
    el('queueSub').textContent = items.length
      ? 'ค้างอยู่ ' + items.length + ' รายการ' + (navigator.onLine ? '' : ' · ตอนนี้ออฟไลน์')
      : 'ส่งครบแล้ว ไม่มีรายการค้าง';
    el('queueList').innerHTML = items.length ? items.map((it) => {
      const what = it.kind === 'count'
        ? 'นับจำนวน ' + esc(catLabel(it.categoryCode)) + ' = ' + it.counted + ' ชิ้น'
        : esc(it.inventoryNumber) + ' · ' + esc(statusLabel(it));
      return '<div class="q-row' + (it.lastError ? ' bad' : '') + '">' +
        '<div><b>' + what + '</b>' +
        '<small>' + esc(thaiDT(it.verifiedAt || it.countedAt)) + ' · ' + esc(it.inspector || '') +
        ((it.photos || []).length ? ' · ' + it.photos.length + ' รูป' : '') + '</small>' +
        (it.lastError ? '<small class="q-err">' + icon('alert') + ' ' + esc(it.lastError) +
          (it.tries > 1 ? ' (ลองแล้ว ' + it.tries + ' ครั้ง)' : '') + '</small>' : '') +
        '</div>' +
        '<button class="qbtn del" type="button" title="ทิ้งรายการนี้" ' +
        'onclick="App.dropQueueItem(\'' + esc(it.clientId) + '\')">' + icon('trash') + '</button>' +
        '</div>';
    }).join('') : '<p class="hint">ไม่มีรายการค้างส่ง</p>';
    el('queueRetry').classList.toggle('hidden', !items.length);
    el('queueDropAll').classList.toggle('hidden', !items.length);
  }
  async function retryQueue() {
    if (!navigator.onLine) return toast('ยังออฟไลน์อยู่ — จะส่งให้อัตโนมัติเมื่อเน็ตกลับมา', 'warn');
    await flushQueue();
    renderQueuePanel();
    if (!state.queueItems.length) closeQueuePanel();
  }
  async function dropQueueItem(clientId) {
    const it = state.queueItems.find((q) => q.clientId === clientId);
    if (!it) return;
    const what = it.kind === 'count'
      ? 'ยอดนับ ' + catLabel(it.categoryCode) + ' = ' + it.counted + ' ชิ้น'
      : it.inventoryNumber;
    if (!window.confirm('ทิ้งรายการค้างส่งนี้ถาวร?\n\n' + what +
      '\n\nข้อมูลนี้จะหายไปเลย ถ้ายังต้องการให้บันทึกใหม่อีกครั้ง')) return;
    try { await qDel(clientId); } catch (e) {}
    state.queueItems = state.queueItems.filter((q) => q.clientId !== clientId);
    afterDataChange();
    renderQueuePanel();
    toast('ทิ้งรายการค้างส่งแล้ว', 'success');
  }
  async function dropAllQueue() {
    const n = state.queueItems.length;
    if (!n) return;
    if (!window.confirm('ทิ้งรายการค้างส่งทั้งหมด ' + n + ' รายการถาวร?\n\nข้อมูลที่ยังไม่ได้ส่งจะหายทั้งหมด')) return;
    const ids = state.queueItems.map((q) => q.clientId);
    for (let i = 0; i < ids.length; i++) { try { await qDel(ids[i]); } catch (e) {} }
    state.queueItems = [];
    afterDataChange();
    renderQueuePanel();
    toast('ล้างคิวค้างส่งแล้ว', 'success');
  }

  // ── รวม log จริง + คิวรอส่ง → สถานะล่าสุดต่อรหัส ─────────────────────────────
  function queueToLog(it) {
    return {
      logId: 'pending-' + it.clientId, clientId: it.clientId, sessionId: it.sessionId,
      inventoryNumber: it.inventoryNumber, assetType: it.assetType,
      result: it.result, condition: it.condition, method: it.method,
      inspector: it.inspector, locationText: it.locationText, pieceNo: it.pieceNo || 1,
      gpsLat: it.gpsLat == null ? null : it.gpsLat,
      gpsLng: it.gpsLng == null ? null : it.gpsLng,
      gpsAccuracy: it.gpsAccuracy == null ? null : it.gpsAccuracy,
      moveToSite: it.moveToSite, moveDocNo: it.moveDocNo, moveDate: it.moveDate,
      note: it.note, unregistered: it.unregistered, unlistedDesc: it.unlistedDesc,
      verifiedAt: it.verifiedAt, photoPaths: [],
      photoCount: (it.photos || []).length, pending: true
    };
  }
  function queueOfSession(id) {
    return state.queueItems
      .filter((q) => q.sessionId === id && q.kind !== 'count')
      .map(queueToLog);
  }
  /** ยอดนับที่ยังค้างส่ง — ให้หน้าจอเห็นยอดทันทีแม้ยังออฟไลน์ */
  function queueCountsOfSession(id) {
    return state.queueItems.filter((q) => q.sessionId === id && q.kind === 'count').map((it) => ({
      countId: 'pending-' + it.clientId, clientId: it.clientId, sessionId: it.sessionId,
      site: it.site, assetType: it.assetType, categoryCode: it.categoryCode,
      counted: it.counted, locationText: it.locationText, note: it.note,
      inspector: it.inspector, countedAt: it.countedAt, pending: true,
      gpsLat: it.gpsLat == null ? null : it.gpsLat,
      gpsLng: it.gpsLng == null ? null : it.gpsLng,
      gpsAccuracy: it.gpsAccuracy == null ? null : it.gpsAccuracy,
      photoPaths: [], photoCount: (it.photos || []).length
    }));
  }
  /** ยอดนับทั้งหมดของรอบที่เปิดอยู่ (ที่ส่งแล้ว + ที่ยังค้างส่ง) */
  function allCounts() {
    const id = state.activeSession ? state.activeSession.sessionId : null;
    if (!id) return [];
    return state.counts.concat(queueCountsOfSession(id));
  }
  function addCountLocal(row) {
    if (!row || !row.countId) return;
    const active = state.activeSession ? state.activeSession.sessionId : null;
    if (row.sessionId && active && row.sessionId !== active) return;
    const dup = state.counts.some((c) => c.countId === row.countId ||
      (row.clientId && c.clientId === row.clientId));
    if (!dup) state.counts.push(row);
  }
  function allLogs() {
    const id = state.activeSession ? state.activeSession.sessionId : null;
    return state.logs.concat(queueOfSession(id));
  }
  function rebuildIndex() {
    const map = new Map();
    const piecesSeen = new Map();      // inv → Set(pieceNo)
    const recSeen = new Map();         // inv → จำนวนครั้งที่ถูกบันทึกทั้งหมด
    const whoSeen = new Map();         // inv → Map(pieceNo → Set(คนที่บันทึกชิ้นนั้น))
    allLogs().forEach((l) => {
      if (isNewer(l, map.get(l.inventoryNumber))) map.set(l.inventoryNumber, l);
      const piece = Number(l.pieceNo) > 0 ? Number(l.pieceNo) : 1;
      const set = piecesSeen.get(l.inventoryNumber) || new Set();
      set.add(piece);
      piecesSeen.set(l.inventoryNumber, set);
      recSeen.set(l.inventoryNumber, (recSeen.get(l.inventoryNumber) || 0) + 1);
      const byPiece = whoSeen.get(l.inventoryNumber) || new Map();
      const who = byPiece.get(piece) || new Set();
      who.add(String(l.createdBy || l.inspector || ''));
      byPiece.set(piece, who);
      whoSeen.set(l.inventoryNumber, byPiece);
    });
    // แนบจำนวนชิ้น + จำนวนครั้งที่บันทึกให้ record ล่าสุด เพื่อให้ตาราง/ตัวกรองใช้ได้ทันที
    map.forEach((l, inv) => {
      const set = piecesSeen.get(inv);
      l.pieces = set ? set.size : 1;
      l.records = recSeen.get(inv) || 1;
      // ชิ้นเดียวกันถูกบันทึกโดยคนละคน = บันทึกทับกัน ต้องเตือน
      // ส่วนการกด "แก้ไขผลเดิม" ของตัวเอง เป็นการแก้ให้ถูก ไม่ใช่ของซ้ำ จึงไม่นับ
      let clash = false;
      (whoSeen.get(inv) || new Map()).forEach((who) => { if (who.size > 1) clash = true; });
      l.clash = clash;
    });
    state.latest = map;
    rebuildIdIndex();
  }
  /**
   * ดัชนีรหัสทุกแบบที่อาจอยู่ใน QR — สติกเกอร์ของจริงบางแบบเก็บแค่ **Asset Number**
   * (เช่น 301013807) ไม่ใช่ RT code จึงต้องจับคู่ได้ทั้ง RT code / Asset Number /
   * Material / Serial และเลขที่ตัดศูนย์นำหน้าออกแล้ว
   */
  function rebuildIdIndex() {
    const idx = new Map();
    const put = (key, inv) => {
      const k = String(key == null ? '' : key).trim().toUpperCase();
      if (k.length < 3) return;
      const list = idx.get(k) || [];
      if (list.indexOf(inv) < 0) list.push(inv);
      idx.set(k, list);
    };
    state.master.forEach((a) => {
      const inv = a.inventoryNumber;
      if (!inv) return;
      put(inv, inv);
      put(String(inv).replace(/-/g, ''), inv);
      [a.assetNumber, a.materialCode, a.serialNumber].forEach((v) => {
        if (v === undefined || v === null || v === '') return;
        const s = String(v).trim();
        put(s, inv);
        const nz = s.replace(/^0+/, '');
        if (nz && nz !== s) put(nz, inv);
      });
      if (a.assetNumber && a.subNumber !== undefined && a.subNumber !== '') {
        put(String(a.assetNumber).trim() + '-' + String(a.subNumber).trim(), inv);
      }
    });
    state.idIndex = idx;
  }
  /**
   * หาทรัพย์สินจากข้อความที่สแกนได้ — รองรับทั้ง RT code, Asset Number, Material,
   * Serial และ payload ยาวๆ (เช่น "Asset: 301013807 RT-DESK-26-0007" หรือ URL)
   * คืนรายการที่ตรง (ปกติ 1 รายการ · ถ้าเลขนั้นซ้ำหลายรายการจะให้ผู้ใช้เลือก)
   */
  function matchScanned(raw) {
    const text = String(raw || '').toUpperCase().replace(/[–—]/g, '-').trim();
    if (!text) return [];
    const idx = state.idIndex || new Map();
    const found = [];
    const lookup = (key) => {
      (idx.get(String(key).trim().toUpperCase()) || []).forEach((inv) => {
        if (found.indexOf(inv) < 0) found.push(inv);
      });
    };
    const rt = text.match(INV_RE);                 // 1) RT code เต็ม (ตรงๆ หรือฝังในข้อความ)
    if (rt) lookup(rt[0]);
    if (!found.length) lookup(text);               // 2) ทั้งก้อนตรงกับรหัสใดรหัสหนึ่ง
    if (!found.length) {                           // 3) ไล่ทีละคำ — QR เก็บหลายค่าหรือเป็น URL
      text.split(/[^A-Z0-9]+/).forEach((tok) => {
        if (tok.length < 4) return;
        lookup(tok);
        const nz = tok.replace(/^0+/, '');
        if (nz && nz !== tok) lookup(nz);
      });
    }
    return found
      .map((inv) => state.master.find((a) => a.inventoryNumber === inv))
      .filter(Boolean);
  }
  function addLogLocal(log) {
    if (!log || !log.logId) return;
    const active = state.activeSession ? state.activeSession.sessionId : null;
    if (log.sessionId && active && log.sessionId !== active) return;
    const dup = state.logs.some((l) => l.logId === log.logId ||
      (log.clientId && l.clientId === log.clientId));
    if (!dup) state.logs.push(log);
  }
  /** เอาผลตรวจที่ถูกลบจากเครื่องอื่นออก — คืน true ถ้าเครื่องนี้ถืออยู่จริง */
  function removeLogLocal(logId) {
    if (!logId) return false;
    const before = state.logs.length;
    state.logs = state.logs.filter((l) => String(l.logId) !== String(logId));
    state.logSummary = state.logSummary.filter((l) => String(l.logId) !== String(logId));
    return state.logs.length !== before;
  }
  // ── RT code ที่ใช้ซ้ำหลายชิ้น ────────────────────────────────────────────────
  /** รวม record ของ RT code หนึ่ง แล้วสรุปเป็น "ชิ้น" (piece) ตาม pieceNo */
  /**
   * ผลไหน "ใหม่กว่า" — ถ้าเวลาตรงกันเป๊ะ (สองเครื่องกดพร้อมกัน) ตัดสินด้วย logId
   * เพื่อให้ทุกเครื่องสรุปสถานะตรงกัน ไม่ขึ้นกับว่า realtime มาถึงเครื่องไหนก่อน
   */
  function isNewer(l, cur) {
    if (!cur) return true;
    const a = String(l.verifiedAt), b = String(cur.verifiedAt);
    return a !== b ? a > b : String(l.logId) > String(cur.logId);
  }
  function piecesOf(inv) {
    const rows = allLogs().filter((l) => l.inventoryNumber === inv);
    const byPiece = new Map();
    rows.forEach((l) => {
      const p = Number(l.pieceNo) > 0 ? Number(l.pieceNo) : 1;
      if (isNewer(l, byPiece.get(p))) byPiece.set(p, l);
    });
    return Array.from(byPiece.keys()).sort((a, b) => a - b).map((p) => byPiece.get(p));
  }
  function pieceCount(inv) {
    const l = state.latest.get(inv);
    return l && l.pieces ? l.pieces : 1;
  }
  function classify(log) {
    if (!log) return 'pending';
    if (log.result === 'FOUND') return 'found';
    if (log.result === 'NOT_FOUND') return 'notfound';
    if (log.result === 'MOVED') return 'moved';
    return 'pending';
  }
  function statusLabel(log) {
    const c = classify(log);
    if (c === 'pending') return 'ยังไม่ตรวจ';
    if (c === 'found') return 'พบ';
    if (c === 'notfound') return 'ไม่พบ';
    return 'ย้ายออก' + (log.moveToSite ? ' → ' + log.moveToSite : '');
  }
  // ── ธีมหน้าเว็บ (4 แบบตามไฟล์ต้นแบบ) ───────────────────────────────────────
  function applyTheme(key) {
    const t = THEMES.some((x) => x.key === key) ? key : 'porcelain';
    document.documentElement.setAttribute('data-theme', t);
    cacheSet('avTheme', t);
    const sel = el('themeSelect');
    if (sel) sel.value = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent').trim() || '#1B3A6B';
    }
  }
  function setTheme(key) { applyTheme(key); toast('เปลี่ยนธีมแล้ว', 'success'); }

  // ── Auth ───────────────────────────────────────────────────────────────────
  function setAuthMode(mode) {
    state.authMode = mode;
    document.querySelectorAll('.auth-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    el('passwordRow').classList.toggle('hidden', mode === 'forgot');
    el('authTitle').textContent = mode === 'signup' ? 'สมัครสมาชิก'
      : (mode === 'forgot' ? 'รีเซ็ตรหัสผ่าน' : 'เข้าสู่ระบบ');
    el('loginButton').textContent = mode === 'signup' ? 'สมัครสมาชิก'
      : (mode === 'forgot' ? 'ส่งลิงก์รีเซ็ตรหัสผ่าน' : 'เข้าสู่ระบบ');
    el('loginError').classList.add('hidden');
    el('loginInfo').classList.add('hidden');
  }
  /** สลับแสดง/ซ่อนรหัสผ่าน เพื่อเช็คว่าพิมพ์ถูกไหม */
  function togglePassword() {
    const input = el('loginPassword');
    const btn = el('pwToggle');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = icon(show ? 'eyeOff' : 'eye');
    btn.classList.toggle('on', show);
    input.focus();
  }
  function authErrorText(msg) {
    if (/Email not confirmed/i.test(msg)) {
      return 'อีเมลนี้ยังไม่ได้ยืนยัน — ให้ผู้ดูแลปิดสวิตช์ "Confirm email" ใน Supabase ' +
        '(Authentication → Sign In / Providers → Email) แล้วรันไฟล์ auth-tools.sql หนึ่งครั้ง จากนั้นลองใหม่';
    }
    if (/Invalid login credentials/i.test(msg)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (/Email logins are disabled/i.test(msg)) {
      return 'ระบบล็อกอินด้วยอีเมลถูกปิดอยู่ — เปิดสวิตช์ "Enable Email provider" ใน Supabase ก่อน';
    }
    if (/User already registered/i.test(msg)) return 'อีเมลนี้สมัครไว้แล้ว — ใช้แท็บ "เข้าสู่ระบบ" แทน';
    if (/after (\d+) seconds/i.test(msg)) {
      return 'ส่งคำขอถี่เกินไป — รอประมาณ 1 นาทีแล้วลองใหม่ (ถ้าเพิ่งกดสมัคร แปลว่าสมัครสำเร็จไปแล้ว)';
    }
    return msg;
  }
  async function submitAuth() {
    const email = el('loginEmail').value.trim();
    const password = el('loginPassword').value;
    const errBox = el('loginError');
    const infoBox = el('loginInfo');
    errBox.classList.add('hidden');
    infoBox.classList.add('hidden');
    if (!email) return;
    const btn = el('loginButton');
    btn.disabled = true;
    try {
      cacheSet('avEmail', email);
      if (state.authMode === 'forgot') {
        await AssetStore.sendPasswordReset(email);
        infoBox.textContent = 'ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว (เช็คใน Junk ด้วย)';
        infoBox.classList.remove('hidden');
      } else if (state.authMode === 'signup') {
        if (!password || password.length < 6) throw new Error('รหัสผ่านอย่างน้อย 6 ตัวอักษร');
        await AssetStore.signUp(email, password);
        infoBox.textContent = 'สมัครแล้ว — รอผู้ดูแล (admin) อนุมัติจึงเข้าใช้งานได้';
        infoBox.classList.remove('hidden');
        boot();
      } else {
        await AssetStore.signIn(email, password);
        boot();
      }
    } catch (e) {
      errBox.textContent = authErrorText(e.message || '');
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  }
  async function logout() {
    if (state.pendTimer) { clearInterval(state.pendTimer); state.pendTimer = null; }
    stopGeoWatch();
    await AssetStore.signOut();
    location.reload();
  }

  function showOnly(id) {
    ['appLoader', 'loginOverlay', 'pendingOverlay', 'app'].forEach((x) => {
      el(x).classList.toggle('hidden', x !== id);
    });
  }
  function showLogin(msg) {
    showOnly('loginOverlay');
    const saved = cacheGet('avEmail');
    if (saved && !el('loginEmail').value) el('loginEmail').value = saved;
    if (msg) {
      el('loginError').textContent = msg;
      el('loginError').classList.remove('hidden');
    }
  }
  function showPending() {
    showOnly('pendingOverlay');
    if (state.pendTimer) clearInterval(state.pendTimer);
    state.pendTimer = setInterval(async () => {
      try {
        const p = await AssetStore.getMyProfile();
        if (p && p.active) {
          clearInterval(state.pendTimer);
          state.pendTimer = null;
          toast('บัญชีได้รับอนุมัติแล้ว', 'success');
          boot();
        }
      } catch (e) {}
    }, 8000);
  }
  function showApp() {
    showOnly('app');
    const p = state.profile;
    state.canWrite = p.role === 'counter' || p.role === 'admin';
    el('topUser').textContent = inspectorName() + ' · ' +
      (p.role === 'admin' ? 'ผู้ดูแล' : (p.role === 'counter' ? 'ผู้ตรวจ' : 'ดูอย่างเดียว'));
    el('appVersion').textContent = APP_VERSION;
    el('nav-manage').classList.toggle('hidden', p.role !== 'admin');
    el('newRoundBtn').classList.toggle('hidden', !state.canWrite);
    el('appendBtn').classList.toggle('hidden', !state.canWrite);
    document.querySelector('.scan-fab').classList.toggle('hidden', !state.canWrite);
  }

  async function boot() {
    try {
      const session = await AssetStore.getSession();
      if (!session) return showLogin();
    } catch (e) {
      return showLogin(e.message);
    }
    let prof = null;
    try {
      prof = await AssetStore.getMyProfile();
      if (prof) cacheSet('avProfile', prof);
    } catch (e) {
      prof = cacheGet('avProfile');
      if (!prof) return showLogin('เชื่อมต่อไม่ได้: ' + e.message);
    }
    if (!prof) return showLogin();
    if (!prof.active) return showPending();
    state.profile = prof;
    showApp();
    await loadQueue();
    state.sessions = cacheGet('avSessions') || [];
    state.logSummary = cacheGet('avLogSummary') || [];
    renderSessions();
    go('home');
    refreshAll(true);
    if (prof.role === 'admin') startAccessWatch();
  }

  // ── โหลดข้อมูล ─────────────────────────────────────────────────────────────
  async function refreshAll(silent) {
    if (!state.profile) return;
    try {
      if (!silent) busy('กำลังโหลดข้อมูล...');
      const results = await Promise.all([AssetStore.listSessions(), AssetStore.loadLogsSummary()]);
      state.sessions = results[0];
      state.logSummary = results[1];
      cacheSet('avSessions', state.sessions);
      cacheSet('avLogSummary', state.logSummary);
      renderSessions();
      if (state.activeSession) {
        const fresh = state.sessions.find((s) => s.sessionId === state.activeSession.sessionId);
        if (!fresh) {
          state.activeSession = null;
          state.master = [];
          state.logs = [];
          go('home');
          toast('รอบตรวจนี้ถูกลบไปแล้ว', 'warn');
        } else {
          state.activeSession = fresh;
          const data = await Promise.all([
            AssetStore.loadMaster(fresh.sessionId), AssetStore.loadLogs(fresh.sessionId),
            AssetStore.loadCounts(fresh.sessionId)]);
          state.master = data[0];
          state.logs = data[1];
          state.counts = data[2] || [];
          cacheSet('avMaster_' + fresh.sessionId, state.master);
          cacheSet('avLogs_' + fresh.sessionId, state.logs);
          cacheSet('avCounts_' + fresh.sessionId, state.counts);
          afterDataChange();
        }
      }
      flushQueue();
      if (!silent) toast('อัปเดตข้อมูลแล้ว', 'success');
    } catch (e) {
      if (!silent) toast('โหลดข้อมูลไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      busyHide();
    }
  }
  function ensureRealtime() {
    const id = state.activeSession ? state.activeSession.sessionId : null;
    if (!id) return;
    if (state.channel) { AssetStore.unsubscribe(state.channel); state.channel = null; }
    try {
      state.channel = AssetStore.subscribeLogs(id, {
        onInsert: (log) => {
          warnIfClash(log);
          addLogLocal(log);
          cacheSet('avLogs_' + id, state.logs);
          afterDataChange();
          if (state.rec && state.rec.asset &&
              state.rec.asset.inventoryNumber === log.inventoryNumber) renderHistory(log.inventoryNumber);
        },
        // เครื่องอื่นลบผลตรวจทิ้ง — ถ้าไม่ตามลบด้วย จอสองเครื่องจะไม่ตรงกันจนกว่าจะรีเฟรช
        onDelete: (logId) => {
          if (!removeLogLocal(logId)) return;
          cacheSet('avLogs_' + id, state.logs);
          afterDataChange();
          if (state.rec && state.rec.asset) renderHistory(state.rec.asset.inventoryNumber);
        },
        onCount: (row) => {
          if (row.sessionId && row.sessionId !== id) return;
          addCountLocal(row);
          cacheSet('avCounts_' + id, state.counts);
          afterDataChange();
          const sheetOpen = !el('countModal').classList.contains('hidden');
          if (sheetOpen) updateCountView();
          if ((row.inspector || '') !== inspectorName() && sheetOpen && row.categoryCode === state.count.cat) {
            toast(row.inspector + ' เพิ่งนับ ' + catLabel(row.categoryCode) + ' ' + row.counted + ' ชิ้น' +
              (row.locationText ? ' ที่ ' + row.locationText : '') + ' — ยอดนี้ถูกบวกรวมแล้ว', 'warn', null, 7000);
          }
        },
        onCountDelete: (countId) => {
          if (!countId) return;
          const before = state.counts.length;
          state.counts = state.counts.filter((c) => String(c.countId) !== String(countId));
          if (state.counts.length === before) return;
          cacheSet('avCounts_' + id, state.counts);
          afterDataChange();
          if (!el('countModal').classList.contains('hidden')) updateCountView();
        }
      });
    } catch (e) {}
  }
  const CLASH_WINDOW = 15 * 60 * 1000;
  /**
   * เตือนเมื่อเพื่อนร่วมทีมบันทึก "ชิ้นเดียวกัน" กับที่เราเพิ่งบันทึกไป
   * ระบบเก็บทุกครั้งที่บันทึกไว้ครบ แต่สถานะที่แสดงจะยึดตามเวลาล่าสุด —
   * ถ้าไม่เตือน คนที่บันทึกก่อนจะไม่มีทางรู้ว่าผลของตัวเองถูกทับ
   */
  function warnIfClash(log) {
    if (!log || !state.profile || !log.inventoryNumber) return;
    const me = inspectorName();
    if (log.createdBy ? log.createdBy === state.profile.id : (log.inspector || '') === me) return;
    const at = new Date(log.verifiedAt).getTime();
    const mine = allLogs().filter((l) =>
      l.inventoryNumber === log.inventoryNumber &&
      (l.createdBy ? l.createdBy === state.profile.id : (l.inspector || '') === me) &&
      Math.abs(at - new Date(l.verifiedAt).getTime()) < CLASH_WINDOW);
    if (!mine.length) return;
    const last = mine.sort((a, b) => String(a.verifiedAt).localeCompare(String(b.verifiedAt))).pop();
    // คนละชิ้นของรหัสเดียวกัน = ตั้งใจให้เป็นคนละรายการอยู่แล้ว ไม่ต้องเตือน
    if ((Number(last.pieceNo) || 1) !== (Number(log.pieceNo) || 1)) return;
    const who = log.inspector || 'ผู้ตรวจคนอื่น';
    const known = state.master.some((a) => a.inventoryNumber === log.inventoryNumber);
    const open = known ? () => openAsset(log.inventoryNumber) : null;
    if (last.result === log.result && last.condition === log.condition) {
      toast(who + ' บันทึก ' + log.inventoryNumber + ' ซ้ำกับของคุณ (' + statusLabel(log) + ')',
        'warn', open, 8000);
    } else {
      toast(who + ' บันทึก ' + log.inventoryNumber + ' เป็น "' + statusLabel(log) +
        '" ทับผลของคุณ ("' + statusLabel(last) + '") — แตะเพื่อตรวจสอบ', 'error', open, 12000);
    }
  }
  function afterDataChange() {
    rebuildIndex();
    renderFilterOptions();
    renderLocList();
    renderAreaList();
    renderRoundBanner();
    renderList();
    renderSessions();
    if (state.page === 'dash') renderDash();
    if (state.page === 'activity') renderActivity();
    // โหมดต่อเนื่องเปิดค้างอยู่ = ให้ตัวนับและรายการล่าสุดขยับตามของที่เพื่อนบันทึกเข้ามาด้วย
    if (state.bulk.cats.length && !el('bulkModal').classList.contains('hidden')) updateBulkView();
    // หน้านับจำนวนเปิดค้างอยู่ก็ต้องรีเฟรชด้วย ไม่งั้นแถว "รอส่ง" ยังค้างอยู่หลังส่งขึ้นเซิร์ฟเวอร์แล้ว
    // (ปุ่มดูรูปในแถวเก่าจะชี้ไปที่รายการที่ไม่มีอยู่แล้ว กดแล้วไม่มีอะไรเกิดขึ้น)
    if (!el('countModal').classList.contains('hidden')) updateCountView();
    updateSyncChip();
  }

  // ── หน้าหลัก: รอบตรวจ ──────────────────────────────────────────────────────
  function sessionStats(s) {
    const id = s.sessionId;
    const seen = new Set();
    let found = 0, notfound = 0, moved = 0;
    const latest = new Map();
    const rows = state.logSummary.filter((l) => l.sessionId === id)
      .concat(queueOfSession(id));
    rows.forEach((l) => {
      if (l.unregistered) return;
      if (isNewer(l, latest.get(l.inventoryNumber))) latest.set(l.inventoryNumber, l);
    });
    latest.forEach((l) => {
      seen.add(l.inventoryNumber);
      const c = classify(l);
      if (c === 'found') found++;
      else if (c === 'notfound') notfound++;
      else if (c === 'moved') moved++;
    });
    const total = s.assetCount || 0;
    const done = Math.min(seen.size, total || seen.size);
    return {
      total: total, done: done, pending: Math.max(total - done, 0),
      found: found, notfound: notfound, moved: moved,
      pct: total ? Math.round(done * 100 / total) : 0
    };
  }
  function setHomeSearch(v) { state.home.q = v.trim(); renderSessions(); }
  function setHomeStatus(v) { state.home.status = v; renderSessions(); }
  function setHomeSort(v) { state.home.sort = v; renderSessions(); }
  function renderSessions() {
    let list = state.sessions.slice();
    const h = state.home;
    if (h.q) {
      const words = h.q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter((s) => {
        const hay = [s.site, s.roundName, s.inspectorName, s.createdBy, s.costCenter,
          thaiD(s.countDateFrom), s.note].join(' ').toLowerCase();
        return words.every((w) => hay.indexOf(w) >= 0);
      });
    }
    if (h.status) {
      list = list.filter((s) => {
        const st = sessionStats(s);
        return h.status === 'done' ? st.pct >= 100 : st.pct < 100;
      });
    }
    if (h.sort === 'site') list.sort((a, b) => String(a.site).localeCompare(String(b.site), 'th'));
    else if (h.sort === 'progress') list.sort((a, b) => sessionStats(a).pct - sessionStats(b).pct);
    else list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    el('homeCount').textContent = list.length + ' รอบ';
    if (!list.length) {
      el('sessionList').innerHTML = '<p class="empty-note">' +
        (state.sessions.length ? 'ไม่พบรอบตรวจตามเงื่อนไข'
          : 'ยังไม่มีรอบตรวจ — กด "＋ สร้างรอบตรวจ" เพื่ออัปโหลดไฟล์ทะเบียนทรัพย์สินรอบแรก') + '</p>';
      return;
    }
    el('sessionList').innerHTML = list.map((s) => {
      const st = sessionStats(s);
      const done = st.pct >= 100;
      const dates = s.countDateFrom
        ? thaiD(s.countDateFrom) + (s.countDateTo && s.countDateTo !== s.countDateFrom
          ? ' – ' + thaiD(s.countDateTo) : '')
        : thaiD(s.createdAt);
      return '<article class="session-card" data-id="' + esc(s.sessionId) + '">' +
        '<div class="sc-head">' +
          '<div><h3>' + esc(s.site || '-') + '</h3>' +
          '<p class="sc-sub">' + esc(s.roundName || 'รอบตรวจ') +
          (s.costCenter ? ' · ' + esc(s.costCenter) : '') + '</p></div>' +
          '<span class="pill ' + (done ? 'pill-ok' : 'pill-warn') + '">' +
          (done ? 'เสร็จสิ้น' : 'กำลังตรวจ') + '</span>' +
        '</div>' +
        '<p class="sc-meta">' + icon('calendar') + ' ' + esc(dates) + ' <span class="dot-sep">·</span> ' + icon('box') + ' ' + st.total + ' รายการ' +
          ' (Fixed ' + (s.fixedCount || 0) + ' · เช่า ' + (s.rentalCount || 0) + ')' +
          (s.inspectorName ? ' <span class="dot-sep">·</span> ' + icon('user') + ' ' + esc(s.inspectorName) : '') + '</p>' +
        '<div class="progress-line"><span>ตรวจแล้ว ' + st.done + ' / ' + st.total +
          '</span><span>' + st.pct + '%</span></div>' +
        '<div class="bar"><i class="' + (done ? 'ok' : '') + '" style="width:' + st.pct + '%"></i></div>' +
        '<div class="sc-chips">' +
          '<span class="stat-chip st-found">พบ ' + st.found + '</span>' +
          '<span class="stat-chip st-notfound">ไม่พบ ' + st.notfound + '</span>' +
          '<span class="stat-chip st-moved">ย้ายออก ' + st.moved + '</span>' +
          '<span class="stat-chip st-pending">ค้าง ' + st.pending + '</span>' +
        '</div>' +
        '<div class="sc-actions">' +
          '<button class="primary-button" type="button" data-act="open">เปิดตรวจนับ</button>' +
          '<button class="outline-button" type="button" data-act="dash">Dashboard</button>' +
          (state.canWrite ? '<button class="danger-ghost" type="button" data-act="del" title="ลบรอบนี้">' + icon('trash') + '</button>' : '') +
        '</div>' +
      '</article>';
    }).join('');
  }
  async function openSession(id, target) {
    const s = state.sessions.find((x) => x.sessionId === id);
    if (!s) return toast('ไม่พบรอบตรวจ', 'error');
    state.activeSession = s;
    state.selection.clear();
    resetLimit();
    state.master = cacheGet('avMaster_' + id) || [];
    state.logs = cacheGet('avLogs_' + id) || [];
    state.counts = cacheGet('avCounts_' + id) || [];
    startGeoWatch();                    // เก็บพิกัดล่าสุดไว้ให้ทุกวิธีบันทึกใช้ร่วมกัน
    afterDataChange();
    go(target || 'list');
    try {
      busy('กำลังโหลดทะเบียนของรอบนี้...');
      const data = await Promise.all([
        AssetStore.loadMaster(id), AssetStore.loadLogs(id), AssetStore.loadCounts(id)]);
      state.master = data[0];
      state.logs = data[1];
      state.counts = data[2] || [];
      cacheSet('avMaster_' + id, state.master);
      cacheSet('avLogs_' + id, state.logs);
      cacheSet('avCounts_' + id, state.counts);
      afterDataChange();
      ensureRealtime();
    } catch (e) {
      toast('โหลดข้อมูลรอบนี้ไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      busyHide();
    }
  }
  async function deleteSession(id) {
    const s = state.sessions.find((x) => x.sessionId === id);
    if (!s) return;
    const st = sessionStats(s);
    const msg = 'ลบรอบตรวจ "' + (s.site || '') + ' · ' + (s.roundName || '') + '" ถาวร?\n\n' +
      'จะลบทะเบียน ' + st.total + ' รายการ และผลตรวจ ' + st.done + ' รายการของรอบนี้ทั้งหมด\n' +
      'การลบนี้กู้คืนไม่ได้';
    if (!window.confirm(msg)) return;
    try {
      busy('กำลังลบรอบตรวจ...');
      await AssetStore.deleteSession(id);
      if (state.activeSession && state.activeSession.sessionId === id) {
        state.activeSession = null;
        state.master = [];
        state.logs = [];
        go('home');
      }
      try {
        localStorage.removeItem('avMaster_' + id);
        localStorage.removeItem('avLogs_' + id);
        localStorage.removeItem('avCounts_' + id);
      } catch (e) {}
      await refreshAll(true);
      toast('ลบรอบตรวจแล้ว', 'success');
    } catch (e) {
      toast('ลบไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      busyHide();
    }
  }

  // ── นำเข้าไฟล์ทะเบียน (สร้างรอบใหม่) ────────────────────────────────────────
  const normHead = (v) => String(v || '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toUpperCase();
  function parseSheet(ws) {
    const XLSX = window.XLSX;
    // blankrows: true ให้ index ของแถวตรงกับแถวจริงในไฟล์ จะได้บอกเลขแถวที่ข้ามได้ถูก
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true });
    const firstRow = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s.r : 0;
    let hr = -1, invCol = -1;
    for (let r = 0; r < Math.min(rows.length, 20); r++) {
      const c = (rows[r] || []).findIndex((v) => normHead(v) === 'INVENTORY NUMBER');
      if (c >= 0) { hr = r; invCol = c; break; }
    }
    if (hr < 0) return null;
    let width = Math.max((rows[hr] || []).length, (rows[hr + 1] || []).length);
    for (let r = hr + 1; r < Math.min(rows.length, hr + 12); r++) {
      width = Math.max(width, (rows[r] || []).length);
    }
    const labels = [];
    for (let c = 0; c < width; c++) {
      labels[c] = normHead((rows[hr] || [])[c]) || normHead((rows[hr + 1] || [])[c]) || '';
    }
    const col = (names) => {
      for (let i = 0; i < names.length; i++) {
        const idx = labels.indexOf(names[i]);
        if (idx >= 0) return idx;
      }
      return -1;
    };
    const cell = (row, idx) => (idx >= 0 ? String(row[idx] == null ? '' : row[idx]).trim() : '');
    // ชีทอื่นในไฟล์ที่ export ออกไป ("ประวัติการตรวจทั้งหมด" / "สรุปผล") ก็มีคอลัมน์
    // Inventory Number เหมือนกัน ถ้าอ่านมาด้วยจะทับทะเบียนจริงจนประเภทและรายละเอียดเพี้ยน
    // จึงรับเฉพาะชีทที่มีคอลัมน์เฉพาะของทะเบียนจริงเท่านั้น
    // ชีทประวัติมีแค่ Inventory Number กับคอลัมน์ผลตรวจ ไม่มีคอลัมน์ทะเบียนพวกนี้เลย
    const isRental = col(['MATERIAL']) >= 0 || col(['SLOC']) >= 0;
    const isFixedSheet = col(['ASSET NUMBER']) >= 0 || col(['ASSET CLASS']) >= 0 ||
      col(['SUB NUMB', 'SUB NUMBER']) >= 0 || col(['CURRENT SITE']) >= 0;
    if (!isRental && !isFixedSheet) return { skipped: true, items: [] };
    // บางไฟล์หัวตารางกับข้อมูลจริงสลับคอลัมน์กัน (เจอในไฟล์ VMS1: หัวเขียน
    // Inventory Number แล้ว Description แต่ข้อมูลใต้หัวเรียงสลับกัน) จึงยึด
    // "คอลัมน์ที่มีรหัส RT อยู่จริง" เป็นหลัก แล้วสลับคำอธิบายกลับให้ถูกคู่
    let swapped = false;
    let bestCol = -1;
    let bestHits = 0;
    for (let c = 0; c < width; c++) {
      let hits = 0;
      for (let r = hr + 1; r < Math.min(rows.length, hr + 31); r++) {
        if (normalizeCode((rows[r] || [])[c])) hits++;
      }
      if (hits > bestHits) { bestHits = hits; bestCol = c; }
    }
    const headInvCol = invCol;
    if (bestHits > 0 && bestCol >= 0 && bestCol !== invCol) {
      invCol = bestCol;
      swapped = true;
    }
    // พื้นที่จัดเก็บ: รองรับทั้งคอลัมน์ Location ที่เติมเอง และ Port ED - Text จาก SAP
    const locCol = col(['LOCATION', 'PORT ED - TEXT', 'PORT ED- TEXT', 'พื้นที่', 'พื้นที่จัดเก็บ',
      'สถานที่', 'สถานที่เก็บ', 'จุดเก็บ', 'STORAGE LOCATION']);
    const locCodeCol = col(['PORT ED', 'LOCATION CODE', 'รหัสพื้นที่']);
    const cols = isRental
      ? { material: col(['MATERIAL']), desc: col(['DESCRIPTION']),
          plant: col(['PLAN', 'PLANT']), sloc: col(['SLOC']) }
      : { assetClass: col(['ASSET CLASS']), assetNumber: col(['ASSET NUMBER']),
          subNumber: col(['SUB NUMB', 'SUB NUMBER']), desc: col(['DESCRIPTION']),
          serial: col(['SERIAL NUMBER']), staff: col(['STAFF - TEXT', 'STAFF-TEXT', 'STAFF TEXT']),
          site: col(['CURRENT SITE']) };
    // หัวตาราง Description ไปชี้คอลัมน์ที่จริงๆ เก็บรหัส → คำอธิบายอยู่ที่คอลัมน์ที่หัวบอกว่าเป็นรหัส
    if (swapped && cols.desc === invCol) cols.desc = headInvCol;
    // หา Site/Cost center จากหัวรายงาน (แถวบนก่อนหัวตาราง)
    let costCenter = '';
    for (let r = 0; r < hr; r++) {
      const line = (rows[r] || []).join(' ');
      const m = line.match(/R-[A-Z0-9]{3,6}-[A-Z0-9]+/i) ||
        line.match(/Site\/Cost center[.\s]*([A-Z0-9-]{3,})/i);
      if (m) { costCenter = (m[1] || m[0]).replace(/\.+$/, '').toUpperCase(); break; }
    }
    const items = [];
    const bad = [];                     // แถวที่หน้าตาเป็นรหัส RT แต่รูปแบบไม่ถูก → แจ้งผู้ใช้ ไม่ทิ้งเงียบ
    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const inv = normalizeCode(row[invCol]);
      if (!inv) {
        const raw = String(row[invCol] == null ? '' : row[invCol]).trim();
        if (/^RT[-–—\s]/i.test(raw)) bad.push({ code: raw, row: firstRow + r + 1 });
        continue;
      }
      const item = {
        inventoryNumber: inv,
        assetType: isRental ? 'RENTAL' : 'FIXED',
        categoryCode: inv.split('-')[1] || '',
        description: cell(row, cols.desc),
        location: cell(row, locCol),
        locationCode: cell(row, locCodeCol)
      };
      if (isRental) {
        item.materialCode = cell(row, cols.material);
        item.plant = cell(row, cols.plant);
        item.sloc = cell(row, cols.sloc);
      } else {
        item.assetClass = cell(row, cols.assetClass);
        item.assetNumber = cell(row, cols.assetNumber);
        item.subNumber = cell(row, cols.subNumber);
        item.serialNumber = cell(row, cols.serial);
        item.staffText = cell(row, cols.staff);
        item.currentSite = cell(row, cols.site);
      }
      items.push(item);
    }
    return {
      type: isRental ? 'RENTAL' : 'FIXED', items: items,
      costCenter: costCenter, swapped: swapped, bad: bad
    };
  }
  /** แถวที่ถูกข้ามเพราะรหัสรูปแบบผิด — บอกให้เห็นก่อนกดสร้าง ไม่ให้หายเงียบๆ อีก */
  function badRowsNote(bad) {
    if (!bad.length) return '';
    const show = bad.slice(0, 8).map((b) =>
      '<b class="mono">' + esc(b.code) + '</b> (' + esc(b.sheet) + ' แถว ' + b.row + ')');
    return '<br><span class="warn-inline">' + icon('alert') + ' ข้าม ' + bad.length +
      ' แถวที่รหัสรูปแบบไม่ถูกต้อง (ไม่ได้นำเข้า) — แก้ในไฟล์แล้วอัปโหลดใหม่ได้: ' + show.join(', ') +
      (bad.length > 8 ? ' และอีก ' + (bad.length - 8) + ' แถว' : '') + '</span>';
  }
  async function readMasterFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const appendTo = state.importAppend || null;      // มีค่า = เพิ่มเข้ารอบเดิม ไม่ใช่สร้างรอบใหม่
    try {
      busy('กำลังอ่านไฟล์...');
      await ensureLibrary('xlsx');
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: 'array' });
      const byInv = new Map();
      let costCenter = '';
      const used = [];
      const skipped = [];
      const bad = [];
      wb.SheetNames.forEach((name) => {
        const parsed = parseSheet(wb.Sheets[name]);
        if (!parsed || parsed.skipped) {
          skipped.push(name);
          return;
        }
        (parsed.bad || []).forEach((b) => { bad.push({ sheet: name, code: b.code, row: b.row }); });
        if (!parsed.items.length) {
          skipped.push(name);
          return;
        }
        if (!costCenter && parsed.costCenter) costCenter = parsed.costCenter;
        let added = 0;
        parsed.items.forEach((it) => {
          if (byInv.has(it.inventoryNumber)) return;   // ชีทแรกที่เจอชนะ ไม่ให้ทับกันเอง
          byInv.set(it.inventoryNumber, it);
          added++;
        });
        used.push({ name: name, count: added, type: parsed.type, swapped: parsed.swapped });
      });
      const rows = Array.from(byInv.values());
      if (!rows.length) {
        throw new Error('ไม่พบทะเบียนทรัพย์สินในไฟล์ — ต้องมีชีทที่มีหัวคอลัมน์ "Inventory Number" ' +
          'คู่กับ "Asset Number" (Fixed Assets) หรือ "Material" (ของเช่า)' +
          (bad.length ? ' · มีรหัสรูปแบบไม่ถูกต้อง ' + bad.length + ' แถว' : ''));
      }
      const sheetNote = '<br>อ่านจากชีท: ' + used.map((u) => esc(u.name) + ' (' +
          (u.type === 'RENTAL' ? 'ของเช่า ' : 'Fixed ') + u.count + ')').join(' · ') +
        (skipped.length ? '<br><span class="hint-inline">ข้ามชีทที่ไม่ใช่ทะเบียน: ' +
          esc(skipped.join(', ')) + '</span>' : '');

      if (appendTo) {
        // เพิ่มเฉพาะรหัสที่รอบนี้ยังไม่มี — ของเดิมและผลตรวจเดิมไม่ถูกแตะ
        const have = new Set(state.master.map((a) => a.inventoryNumber));
        const fresh = rows.filter((r) => !have.has(r.inventoryNumber));
        const fFixed = fresh.filter((r) => r.assetType === 'FIXED').length;
        state.importData = {
          rows: fresh, fileName: file.name, fixed: fFixed, rental: fresh.length - fFixed
        };
        el('uploadZoneText').innerHTML = icon('note') + ' ' + esc(file.name);
        el('importPreview').innerHTML =
          'อ่านไฟล์สำเร็จ — ' + rows.length + ' รายการ · มีในรอบนี้แล้ว <b>' +
          (rows.length - fresh.length) + '</b>' +
          '<br>จะเพิ่มใหม่ <b>' + fresh.length + '</b> รายการ (Fixed <b>' + fFixed +
          '</b> · ของเช่า <b>' + (fresh.length - fFixed) + '</b>)' +
          (fresh.length
            ? '<br><span class="hint-inline">เช่น ' + esc(fresh.slice(0, 6).map((r) => r.inventoryNumber)
              .join(', ')) + (fresh.length > 6 ? ' …' : '') + '</span>'
            : '<br><span class="hint-inline">ทุกรายการในไฟล์มีอยู่ในรอบนี้แล้ว ไม่มีอะไรต้องเพิ่ม</span>') +
          sheetNote + badRowsNote(bad);
        el('importPreview').classList.remove('hidden');
        el('roundForm').classList.add('hidden');
        el('appendForm').classList.toggle('hidden', !fresh.length);
        return;
      }

      const fixed = rows.filter((r) => r.assetType === 'FIXED').length;
      const rental = rows.length - fixed;
      // เดารหัสโครงการจากข้อมูลจริง
      let site = '';
      const cc = costCenter || (rows.find((r) => r.currentSite) || {}).currentSite || '';
      const m = String(cc).match(/^R-([A-Z0-9]+)-/i);
      if (m) site = m[1].toUpperCase();
      if (!site) {
        const plant = (rows.find((r) => r.plant) || {}).plant;
        if (plant) site = String(plant).toUpperCase();
      }
      if (!site) site = (CFG.SITE || '').toUpperCase();

      state.importData = { rows: rows, fileName: file.name, fixed: fixed, rental: rental };
      el('uploadZoneText').innerHTML = icon('note') + ' ' + esc(file.name);
      el('importPreview').innerHTML =
        'อ่านไฟล์สำเร็จ — <b>' + rows.length + '</b> รายการ ' +
        '(Fixed Assets <b>' + fixed + '</b> · ของเช่า <b>' + rental + '</b>)' +
        (cc ? '<br>Cost center ที่พบในไฟล์: <b>' + esc(cc) + '</b>' : '') +
        sheetNote + badRowsNote(bad) +
        (used.some((u) => u.swapped) ? '<br><span class="hint-inline">หมายเหตุ: ชีท ' +
          esc(used.filter((u) => u.swapped).map((u) => u.name).join(', ')) +
          ' หัวตารางสลับที่กับข้อมูลจริง ระบบจับคอลัมน์รหัส/คำอธิบายให้ถูกต้องแล้ว</span>' : '') +
        (rental === 0 ? '<br><span class="warn-inline">ไม่พบรายการ "ทรัพย์สินของเช่า" ในไฟล์นี้ — ' +
          'ตรวจว่าชีทของเช่ามีหัวคอลัมน์ Material และ Inventory Number ครบ</span>' : '');
      el('importPreview').classList.remove('hidden');
      el('roundForm').classList.remove('hidden');
      el('roundSite').value = site;
      el('roundCostCenter').value = cc;
      if (!el('roundFrom').value) el('roundFrom').value = todayISO();
      if (!el('roundInspector').value) el('roundInspector').value = inspectorName();
    } catch (e) {
      // อ่านไม่ผ่าน ต้องล้างผลของไฟล์ก่อนหน้าทิ้ง ไม่งั้นดูเหมือนอ่านไฟล์ใหม่สำเร็จ
      state.importData = null;
      el('importPreview').classList.add('hidden');
      el('roundForm').classList.add('hidden');
      el('appendForm').classList.add('hidden');
      el('uploadZoneText').textContent = 'แตะเพื่อเลือกไฟล์ทะเบียนทรัพย์สิน';
      toast(e.message, 'error');
    } finally {
      busyHide();
    }
  }
  function cancelImport() {
    const back = state.importAppend ? 'list' : 'home';   // มาจากในรอบ ก็กลับไปในรอบ
    state.importData = null;
    el('importPreview').classList.add('hidden');
    el('roundForm').classList.add('hidden');
    el('appendForm').classList.add('hidden');
    el('uploadZoneText').textContent = 'แตะเพื่อเลือกไฟล์ทะเบียนทรัพย์สิน';
    go(back);
  }
  const UPLOAD_HEAD = {
    kicker: 'NEW ROUND', title: 'สร้างรอบตรวจนับใหม่',
    hint: 'อัปโหลดไฟล์ทะเบียนทรัพย์สินของรอบนี้ (.xls / .xlsx) — ระบบอ่านชีท ' +
      '<strong>ทรัพย์สิน Fixed Assets</strong> และ <strong>ทรัพย์สินของเช่า</strong> อัตโนมัติจากหัวตารางจริง ' +
      'แต่ละรอบเก็บทะเบียนของตัวเอง ไม่กระทบรอบอื่น'
  };
  /** หน้าอัปโหลดใช้ร่วม 2 งาน: สร้างรอบใหม่ / เพิ่มรายการที่ตกหล่นเข้ารอบเดิม */
  function renderUploadHead() {
    const s = state.importAppend
      ? state.sessions.find((x) => x.sessionId === state.importAppend) || state.activeSession : null;
    el('uploadKicker').textContent = s ? 'ADD TO ROUND' : UPLOAD_HEAD.kicker;
    el('uploadTitle').textContent = s
      ? 'เพิ่มรายการเข้ารอบ ' + s.site + (s.roundName ? ' · ' + s.roundName : '') : UPLOAD_HEAD.title;
    el('uploadHint').innerHTML = s
      ? 'อัปโหลดไฟล์ทะเบียนเดิมซ้ำได้เลย — ระบบ<strong>เพิ่มเฉพาะรหัสที่รอบนี้ยังไม่มี</strong> ' +
        'ทะเบียนและผลตรวจที่บันทึกไปแล้วอยู่ครบ ไม่ถูกแก้ ใช้กับรายการที่ตกหล่นตอนสร้างรอบ'
      : UPLOAD_HEAD.hint;
    if (!state.importData) {
      el('uploadZoneText').textContent = s
        ? 'แตะเพื่อเลือกไฟล์ที่มีรายการตกหล่น' : 'แตะเพื่อเลือกไฟล์ทะเบียนทรัพย์สิน';
    }
  }
  function openAppendImport() {
    const s = state.activeSession;
    if (!s) return toast('เลือกรอบตรวจก่อน', 'warn');
    if (!state.canWrite) return toast('เฉพาะผู้ตรวจหรือผู้ดูแลเท่านั้นที่เพิ่มรายการเข้ารอบได้', 'warn');
    if (!navigator.onLine) return toast('ต้องต่ออินเทอร์เน็ตก่อน — การเพิ่มรายการเป็นการแก้ทะเบียนบนเซิร์ฟเวอร์', 'warn');
    state.importAppend = s.sessionId;
    state.importData = null;
    el('importPreview').classList.add('hidden');
    el('roundForm').classList.add('hidden');
    el('appendForm').classList.add('hidden');
    go('upload');
  }
  async function confirmAppend() {
    const sid = state.importAppend;
    const data = state.importData;
    const s = sid ? (state.sessions.find((x) => x.sessionId === sid) || state.activeSession) : null;
    if (!s || !data) return toast('ยังไม่ได้เลือกไฟล์', 'warn');
    if (!data.rows.length) return toast('ไม่มีรายการใหม่ให้เพิ่ม', 'warn');
    try {
      busy('กำลังเช็คทะเบียนล่าสุดของรอบ...');
      // ระหว่างเปิดหน้านี้ คนอื่นอาจเพิ่มไปก่อนแล้ว → เทียบกับบนเซิร์ฟเวอร์อีกรอบก่อนเขียน
      const current = await AssetStore.loadMaster(sid);
      const have = new Set(current.map((a) => a.inventoryNumber));
      const rows = data.rows.filter((r) => !have.has(r.inventoryNumber))
        .map((r) => Object.assign({ site: s.site }, r));
      let added = [];
      if (rows.length) {
        busy('กำลังเพิ่ม ' + rows.length + ' รายการเข้ารอบ...');
        added = (await AssetStore.addAssets(sid, rows, inspectorName())).rows || [];
      }
      // ตัวเลขบนการ์ดรอบมาจากคอลัมน์นับของรอบ ต้องขยับตามทะเบียนที่เพิ่มจริง
      const addedFixed = added.filter((a) => a.asset_type === 'FIXED').length;
      const curFixed = current.filter((a) => a.assetType === 'FIXED').length;
      const total = current.length + added.length;
      try {
        await AssetStore.updateSession(sid, {
          assetCount: total, fixedCount: curFixed + addedFixed,
          rentalCount: total - curFixed - addedFixed
        });
      } catch (e) { /* ทะเบียนเพิ่มสำเร็จแล้ว ตัวเลขบนการ์ดคลาดได้ชั่วคราว */ }
      state.importData = null;
      el('importPreview').classList.add('hidden');
      el('appendForm').classList.add('hidden');
      await refreshAll(true);
      const skippedByOthers = data.rows.length - added.length;
      toast('เพิ่มเข้ารอบแล้ว ' + added.length + ' รายการ' +
        (skippedByOthers > 0 ? ' (อีก ' + skippedByOthers + ' รายการมีคนเพิ่มไปก่อนแล้ว)' : ''), 'success');
      openSession(sid);
    } catch (e) {
      toast('เพิ่มรายการไม่สำเร็จ: ' + e.message, 'error', null, 7000);
    } finally {
      busyHide();
    }
  }
  async function confirmImport() {
    if (!state.importData) return toast('ยังไม่ได้เลือกไฟล์', 'warn');
    const site = el('roundSite').value.trim().toUpperCase();
    if (!site) return toast('กรอกรหัสโครงการ (Site) ก่อน', 'warn');
    const from = el('roundFrom').value;
    if (!from) return toast('เลือกวันที่เริ่มตรวจก่อน', 'warn');
    const data = state.importData;
    const dup = state.sessions.find((s) => s.site === site && s.countDateFrom === from);
    if (dup && !window.confirm('มีรอบตรวจของโครงการ ' + site + ' วันที่เดียวกันอยู่แล้ว\nยืนยันสร้างรอบใหม่อีกรอบ?')) return;
    try {
      busy('กำลังสร้างรอบตรวจ...');
      const session = await AssetStore.createSession({
        site: site,
        costCenter: el('roundCostCenter').value.trim(),
        roundName: el('roundName').value.trim() || null,
        countDateFrom: from,
        countDateTo: el('roundTo').value || null,
        inspectorName: el('roundInspector').value.trim(),
        note: el('roundNote').value.trim(),
        fileName: data.fileName,
        assetCount: data.rows.length,
        fixedCount: data.fixed,
        rentalCount: data.rental,
        status: 'Active',
        createdBy: inspectorName()
      });
      busy('กำลังนำเข้าทะเบียน ' + data.rows.length + ' รายการ...');
      const rows = data.rows.map((r) => Object.assign({ site: site }, r));
      try {
        await AssetStore.importAssets(session.sessionId, rows, inspectorName());
      } catch (e) {
        await AssetStore.deleteSession(session.sessionId);   // ไม่ให้เหลือรอบเปล่าค้างไว้
        throw e;
      }
      state.importData = null;
      el('importPreview').classList.add('hidden');
      el('roundForm').classList.add('hidden');
      el('uploadZoneText').textContent = 'แตะเพื่อเลือกไฟล์ทะเบียนทรัพย์สิน';
      ['roundName', 'roundNote', 'roundTo'].forEach((id) => { el(id).value = ''; });
      await refreshAll(true);
      toast('สร้างรอบตรวจแล้ว นำเข้า ' + data.rows.length + ' รายการ', 'success');
      openSession(session.sessionId);
    } catch (e) {
      toast('สร้างรอบไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      busyHide();
    }
  }

  // ── รายการทรัพย์สินในรอบ ───────────────────────────────────────────────────
  function renderRoundBanner() {
    const s = state.activeSession;
    const box = el('roundBanner');
    if (!s) { box.innerHTML = ''; return; }
    const st = sessionStats(s);
    const dates = s.countDateFrom
      ? thaiD(s.countDateFrom) + (s.countDateTo && s.countDateTo !== s.countDateFrom
        ? ' – ' + thaiD(s.countDateTo) : '') : '';
    box.innerHTML =
      '<div class="rb-main"><h2>' + esc(s.site || '') + '</h2>' +
      '<p>' + esc(s.roundName || 'รอบตรวจ') + (s.costCenter ? ' · ' + esc(s.costCenter) : '') +
      (dates ? ' · ' + esc(dates) : '') + '</p></div>' +
      '<div class="rb-progress"><div class="progress-line"><span>ตรวจแล้ว ' + st.done + ' / ' + st.total +
      '</span><span>' + st.pct + '%</span></div>' +
      '<div class="bar"><i class="' + (st.pct >= 100 ? 'ok' : '') + '" style="width:' + st.pct + '%"></i></div></div>';
  }
  function mastersOfType() {
    return state.master.filter((a) => a.assetType === state.ui.type);
  }
  function renderFilterOptions() {
    const list = mastersOfType();
    const sel = el('catFilter');
    const cur = state.ui.cat;
    const counts = {};
    list.forEach((a) => {
      const c = a.categoryCode || (a.inventoryNumber || '').split('-')[1] || '?';
      counts[c] = (counts[c] || 0) + 1;
    });
    const cats = Object.keys(counts).sort();
    let html = '<option value="">ทุกหมวด (' + list.length + ')</option>';
    cats.forEach((c) => {
      html += '<option value="' + esc(c) + '">RT-' + esc(c) + ' (' + counts[c] + ')</option>';
    });
    sel.innerHTML = html;
    sel.value = cats.indexOf(cur) >= 0 ? cur : '';
    state.ui.cat = sel.value;
    syncCombo('catFilter');

    const staffSel = el('staffFilter');
    const curStaff = state.ui.staff;
    const sc = {};
    let blank = 0;
    list.forEach((a) => {
      const s = (a.staffText || '').trim();
      if (!s) { blank++; return; }
      sc[s] = (sc[s] || 0) + 1;
    });
    const hasStaff = Object.keys(sc).length > 0;
    staffSel.classList.toggle('hidden', state.ui.type === 'RENTAL' && !hasStaff);
    let h2 = '<option value="">ผู้รับผิดชอบ: ทั้งหมด</option>';
    if (blank) h2 += '<option value="__NONE__">(ไม่ระบุ) — ' + blank + '</option>';
    Object.keys(sc).sort((a, b) => a.localeCompare(b, 'th')).forEach((s) => {
      h2 += '<option value="' + esc(s) + '">' + esc(s) + ' (' + sc[s] + ')</option>';
    });
    staffSel.innerHTML = h2;
    staffSel.value = curStaff && (curStaff === '__NONE__' || sc[curStaff]) ? curStaff : '';
    state.ui.staff = staffSel.value;
    syncCombo('staffFilter');

    // พื้นที่จัดเก็บ — ใช้จำกัดขอบเขตการตรวจของรอบใหญ่ (คลังกลาง)
    const areaSel = el('areaFilter');
    const curArea = state.ui.area;
    const ac = {};
    let noArea = 0;
    list.forEach((a) => {
      const v = (a.location || '').trim();
      if (!v) { noArea++; return; }
      ac[v] = (ac[v] || 0) + 1;
    });
    // เรียงตามรหัสพื้นที่ก่อน (Z001, Z002, ...) โซนที่ยังไม่มีรหัสไปต่อท้ายเรียงตามชื่อ
    const areas = Object.keys(ac).sort((a, b) =>
      (areaCodeOf(a) || 'zzzz~' + a).localeCompare(areaCodeOf(b) || 'zzzz~' + b, 'th'));
    let h3 = '<option value="">พื้นที่: ทั้งหมด (' + list.length + ')</option>';
    if (noArea) h3 += '<option value="__NONE__">(ไม่ระบุพื้นที่) — ' + noArea + '</option>';
    areas.forEach((v) => {
      h3 += '<option value="' + esc(v) + '">' + esc(areaLabel(v)) + ' (' + ac[v] + ')</option>';
    });
    areaSel.innerHTML = h3;
    areaSel.value = curArea && (curArea === '__NONE__' || ac[curArea]) ? curArea : '';
    state.ui.area = areaSel.value;
    syncCombo('areaFilter');

    el('tabCountF').textContent = state.master.filter((a) => a.assetType === 'FIXED').length;
    el('tabCountR').textContent = state.master.filter((a) => a.assetType === 'RENTAL').length;
  }
  // ── รหัสพื้นที่ (Port ED) ───────────────────────────────────────────────────
  // ทะเบียนเก็บทั้งรหัส (Port ED เช่น Z006) และชื่อโซน (Port ED - Text เช่น โกดัง 1)
  // หน้างานเรียกกันด้วยรหัส จึงแสดง "รหัส · ชื่อ" ทุกที่ที่โชว์ชื่อโซน
  // (ค่าที่บันทึกจริงยังเป็น "ชื่อโซน" ล้วนเหมือนเดิม — รหัสเป็นแค่ป้ายกำกับบนจอ)
  let areaCodeCache = { src: null, map: {} };
  function areaCodeMap() {
    if (areaCodeCache.src === state.master) return areaCodeCache.map;
    const tally = {};
    state.master.forEach((a) => {
      const name = (a.location || '').trim();
      const code = (a.locationCode || '').trim();
      if (!name || !code) return;
      if (!tally[name]) tally[name] = {};
      tally[name][code] = (tally[name][code] || 0) + 1;
    });
    const map = {};
    // ชื่อโซนเดียวอาจมีหลายรหัสปนกันในไฟล์ — ใช้รหัสที่พบมากที่สุดของโซนนั้น
    Object.keys(tally).forEach((name) => {
      map[name] = Object.keys(tally[name]).sort((a, b) => tally[name][b] - tally[name][a])[0];
    });
    areaCodeCache = { src: state.master, map: map };
    return map;
  }
  function areaCodeOf(name) {
    const s = String(name || '').trim();
    return s ? (areaCodeMap()[s] || '') : '';
  }
  /** ป้ายชื่อพื้นที่ที่แสดงบนจอ: "Z006 · โกดัง 1" (ไม่มีรหัสก็โชว์ชื่อเปล่า) */
  function areaLabel(name) {
    const s = String(name || '').trim();
    const code = areaCodeOf(s);
    return code ? code + ' · ' + s : s;
  }
  /** รายชื่อพื้นที่ที่รู้จักในรอบนี้ เรียง "ที่ใช้ล่าสุด" ขึ้นก่อนเสมอ */
  function knownAreas() {
    const out = [];
    const seen = {};
    const push = (v) => {
      const s = String(v || '').trim();
      if (s && !seen[s]) { seen[s] = 1; out.push(s); }
    };
    (cacheGet('avRecentAreas') || []).forEach(push);      // ที่เพิ่งใช้ไป
    const counts = {};
    state.master.forEach((a) => {
      const v = (a.location || '').trim();
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    Object.keys(counts).sort((a, b) => counts[b] - counts[a]).forEach(push);
    return out;
  }
  /** พื้นที่ล่าสุดที่ "คนที่ล็อกอินอยู่" เพิ่งบันทึกไว้ — ใช้เติมให้รายการถัดไปอัตโนมัติ */
  function lastAreaOfMine() {
    const me = inspectorName();
    const mine = allLogs()
      .filter((l) => (l.inspector || '') === me && (l.locationText || '').trim())
      .sort((a, b) => String(b.verifiedAt).localeCompare(String(a.verifiedAt)));
    if (mine.length) return mine[0].locationText.trim();
    return cacheGet('avLastLocation') || '';
  }
  function rememberArea(v) {
    const s = String(v || '').trim();
    if (!s) return;
    const prev = (cacheGet('avRecentAreas') || []).filter((x) => x !== s);
    prev.unshift(s);
    cacheSet('avRecentAreas', prev.slice(0, 12));
  }
  /** ตัวเลือกพื้นที่ = พื้นที่ที่เพิ่งใช้ + พื้นที่ในทะเบียน + ตำแหน่งที่เคยบันทึกไว้ */
  function renderAreaList() {
    const seen = {};
    const opts = [];
    knownAreas().forEach((v) => { if (!seen[v]) { seen[v] = 1; opts.push(v); } });
    allLogs().forEach((l) => {
      const v = (l.locationText || '').trim();
      if (v && !seen[v]) { seen[v] = 1; opts.push(v); }
    });
    el('areaList').innerHTML = opts.slice(0, 60)
      .map((v) => '<option value="' + esc(v) + '"></option>').join('');
  }
  function renderLocList() {
    const seen = {};
    const opts = [];
    allLogs().forEach((l) => {
      const v = (l.locationText || '').trim();
      if (v && !seen[v]) { seen[v] = 1; opts.push(v); }
    });
    el('locList').innerHTML = opts.slice(0, 40)
      .map((v) => '<option value="' + esc(v) + '"></option>').join('');
  }
  // ── เลือกพื้นที่จากรายการทั้งหมด ──────────────────────────────────────────────
  // datalist ของเบราว์เซอร์กรองตามข้อความที่อยู่ในช่อง พอระบบเติมค่าไว้ให้แล้วจึงเห็น
  // ตัวเลือกเดียว — ปุ่มหมุดข้างช่องเปิดแผงนี้เพื่อดู "พื้นที่ที่มีอยู่ทั้งหมด" ได้จริง
  /** ทุกพื้นที่ที่ระบบรู้จัก: ที่เพิ่งใช้ → ในทะเบียน (มากไปน้อย) → ที่เคยพิมพ์ตอนตรวจ */
  function areaRows() {
    const inReg = {};
    state.master.forEach((a) => {
      const v = (a.location || '').trim();
      if (v) inReg[v] = (inReg[v] || 0) + 1;
    });
    const logged = {};
    allLogs().forEach((l) => {
      const v = (l.locationText || '').trim();
      if (v) logged[v] = (logged[v] || 0) + 1;
    });
    const seen = {};
    const rows = [];
    const add = (raw, tag) => {
      const s = String(raw || '').trim();
      if (!s || seen[s]) return;
      seen[s] = 1;
      const bits = [];
      if (tag) bits.push(tag);
      if (inReg[s]) bits.push('ในทะเบียน ' + inReg[s] + ' ชิ้น');
      if (logged[s]) bits.push('บันทึกแล้ว ' + logged[s] + ' ครั้ง');
      rows.push({ value: s, sub: bits.join(' · ') || 'เคยพิมพ์ไว้เอง' });
    };
    (cacheGet('avRecentAreas') || []).forEach((v) => add(v, 'ใช้ล่าสุด'));
    // เรียงตามรหัสพื้นที่ให้ตรงกับตัวกรองด้านบน (ไม่มีรหัสไปต่อท้าย)
    Object.keys(inReg).sort((a, b) =>
      (areaCodeOf(a) || 'zzzz~' + a).localeCompare(areaCodeOf(b) || 'zzzz~' + b, 'th')).forEach((v) => add(v));
    Object.keys(logged).sort((a, b) => logged[b] - logged[a] || a.localeCompare(b, 'th')).forEach((v) => add(v));
    return rows;
  }
  /** ปุ่มลัด "ใช้พื้นที่ล่าสุดของคุณ" — เสนอไว้ข้างช่อง ไม่ใช่เติมค่าลงไปเงียบๆ */
  function showAreaSuggest(area) {
    const btn = el('recLocSuggest');
    if (!btn) return;
    const v = String(area || '').trim();
    btn.classList.toggle('hidden', !v);
    if (v) {
      btn.dataset.area = v;
      btn.textContent = 'ใช้พื้นที่ล่าสุดของคุณ: ' + v;
    }
  }
  function useLastArea() {
    const btn = el('recLocSuggest');
    if (!btn || !btn.dataset.area) return;
    el('recLocation').value = btn.dataset.area;
    btn.classList.add('hidden');
  }
  function openAreaPicker(targetId) {
    state.areaPick = { target: targetId, q: '' };
    el('areaPickSearch').value = '';
    renderAreaPick();
    el('areaModal').classList.remove('hidden');
  }
  function closeAreaPicker() {
    el('areaModal').classList.add('hidden');
    state.areaPick = null;
  }
  function setAreaPickSearch(v) {
    if (state.areaPick) state.areaPick.q = String(v || '');
    renderAreaPick();
  }
  function renderAreaPick() {
    const p = state.areaPick || { q: '', target: '' };
    const rows = areaRows();
    const q = p.q.trim();
    const ql = q.toLowerCase();
    // ค้นได้ทั้งชื่อโซนและรหัสพื้นที่ (พิมพ์ Z006 ก็เจอ "โกดัง 1")
    const shown = ql ? rows.filter((r) =>
      (r.value + ' ' + areaCodeOf(r.value)).toLowerCase().indexOf(ql) >= 0) : rows;
    const input = el(p.target);
    const cur = input ? input.value.trim() : '';
    el('areaPickSub').textContent = rows.length
      ? 'มีทั้งหมด ' + rows.length + ' พื้นที่' + (q ? ' · ตรงกับที่ค้นหา ' + shown.length : '')
      : 'ยังไม่มีพื้นที่ในระบบ — พิมพ์ชื่อใหม่ได้เลย';
    const row = (val, title, sub, cls) =>
      '<button class="area-row' + (cls ? ' ' + cls : '') + (val && val === cur ? ' on' : '') +
      '" type="button" data-area="' + esc(val) + '">' +
      icon(cls === 'new' ? 'plus' : (cls === 'clear' ? 'close' : 'pin')) +
      '<span><b>' + title + '</b><small>' + esc(sub) + '</small></span>' +
      (val && val === cur ? '<em class="area-cur">ใช้อยู่</em>' : '') + '</button>';
    // มีของเดิมที่ใกล้เคียงอยู่แล้ว → ดันตัวเลือก "สร้างใหม่" ไปไว้ท้ายสุด กันกดพลาดจนได้ชื่อซ้ำซ้อน
    const newRow = (q && !rows.some((r) => r.value.toLowerCase() === ql))
      ? row(q, 'ใช้ "' + esc(q) + '" เป็นพื้นที่ใหม่', 'ยังไม่มีในระบบ', 'new') : '';
    el('areaPickList').innerHTML =
      (shown.length ? '' : newRow) +
      shown.map((r) => row(r.value, esc(areaLabel(r.value)), r.sub)).join('') +
      (!shown.length && !newRow ? '<p class="hint">ยังไม่มีพื้นที่บันทึกไว้ในรอบนี้</p>' : '') +
      (shown.length ? newRow : '') +
      row('', 'ไม่ระบุพื้นที่', 'ล้างค่าในช่องนี้', 'clear');
  }
  function chooseArea(v) {
    const p = state.areaPick;
    if (!p) return;
    const input = el(p.target);
    if (input) {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeAreaPicker();
  }
  function filteredAssets() {
    const ui = state.ui;
    let list = mastersOfType();
    if (ui.cat) list = list.filter((a) => (a.categoryCode || '') === ui.cat);
    if (ui.staff) {
      list = ui.staff === '__NONE__'
        ? list.filter((a) => !(a.staffText || '').trim())
        : list.filter((a) => (a.staffText || '').trim() === ui.staff);
    }
    if (ui.area) {
      list = ui.area === '__NONE__'
        ? list.filter((a) => !(a.location || '').trim())
        : list.filter((a) => (a.location || '').trim() === ui.area);
    }
    if (ui.q) {
      const words = ui.q.toUpperCase().split(/\s+/).filter(Boolean);
      list = list.filter((a) => {
        const hay = [a.inventoryNumber, a.description, a.staffText, a.serialNumber,
          a.assetNumber, a.materialCode].join(' ').toUpperCase();
        return words.every((w) => hay.indexOf(w) >= 0);
      });
    }
    if (ui.status === 'dup') {
      // ซ้ำ = RT code เดียวพบหลายชิ้น หรือชิ้นเดียวกันมีคนอื่นบันทึกทับ (แก้ผลเดิมเองไม่นับ)
      list = list.filter((a) => isDup(state.latest.get(a.inventoryNumber)));
    } else if (ui.status) {
      list = list.filter((a) => {
        return classify(state.latest.get(a.inventoryNumber)) === ui.status;
      });
    }
    const sorted = list.slice();
    if (ui.sort === 'name') {
      sorted.sort((a, b) => String(a.description).localeCompare(String(b.description), 'th'));
    } else if (ui.sort === 'time') {
      sorted.sort((a, b) => {
        const la = state.latest.get(a.inventoryNumber);
        const lb = state.latest.get(b.inventoryNumber);
        return String(lb ? lb.verifiedAt : '').localeCompare(String(la ? la.verifiedAt : ''));
      });
    } else {
      sorted.sort((a, b) => String(a.inventoryNumber).localeCompare(String(b.inventoryNumber)));
    }
    return sorted;
  }
  /** ซ้ำ = พบหลายชิ้นในรหัสเดียว หรือชิ้นเดียวกันถูกบันทึกโดยคนละคน (ไม่รวมการแก้ผลเดิมของตัวเอง) */
  function isDup(l) {
    return Boolean(l && ((Number(l.pieces) || 1) > 1 || l.clash));
  }
  function statusCell(latest) {
    const cls = classify(latest);
    const n = latest && latest.pieces > 1 ? latest.pieces : 0;
    const rec = latest && !n && latest.clash ? (Number(latest.records) || 2) : 0;
    return '<span class="pill st-' + cls + '">' + esc(statusLabel(latest)) + '</span>' +
      (n ? '<span class="dup-badge" title="RT code นี้ถูกบันทึก ' + n + ' ชิ้น">× ' + n + '</span>' : '') +
      (rec ? '<span class="dup-badge rec" title="ชิ้นเดียวกันนี้มีคนอื่นบันทึกทับ (รวม ' + rec +
        ' ครั้ง) — เปิดดูประวัติได้">ซ้ำ ' + rec + '</span>' : '');
  }
  function verifyMeta(l) {
    if (!l) return '<span class="text-faint">—</span>';
    return '<span class="vmeta">' + esc(l.inspector || '') +
      '<small>' + esc(thaiDT(l.verifiedAt)) +
      ' · <b class="m-' + (l.method === 'SCAN' ? 'scan' : 'manual') + '">' + l.method + '</b>' +
      (l.pending ? ' · <b class="pending-sync">รอส่ง</b>' : '') + '</small></span>';
  }
  // ── นิยามคอลัมน์ของตาราง (เลือกแสดง/ซ่อนได้เอง) ─────────────────────────────
  // always: ปิดไม่ได้ (แกนหลักของฟอร์ม) · group 'move': คอลัมน์ในกลุ่ม "ย้ายออก"
  const COL_INV = {
    key: 'inv', label: 'Inventory Number', cls: 'th-inv', always: true,
    render: (c) => '<td class="mono nowrap inv-cell">' + esc(c.asset.inventoryNumber) +
      '<span class="sm-status">' + statusCell(c.latest) + '</span></td>'
  };
  const COL_DESC = {
    key: 'desc', label: 'Description', cls: 'th-desc', always: true,
    render: (c) => '<td class="col-desc">' + esc(c.asset.description || '') +
      (c.latest ? '<small class="row-meta">' + esc(c.latest.inspector || '') + ' · ' +
        esc(thaiDT(c.latest.verifiedAt)) + (c.latest.pending ? ' · รอส่ง' : '') + '</small>' : '') + '</td>'
  };
  const COL_LOC = {
    key: 'location', label: 'พื้นที่จัดเก็บ', cls: 'c-md',
    get: (c) => areaLabel(c.asset.location)
  };
  const COLS_TAIL = [
    { key: 'moveSite', label: 'ส่งไป SITE', cls: 'c-lg', group: 'move',
      get: (c) => (c.moved ? c.moved.moveToSite : '') },
    { key: 'moveDoc', label: 'เลขที่ใบส่ง', cls: 'c-lg', group: 'move',
      get: (c) => (c.moved ? c.moved.moveDocNo : '') },
    { key: 'moveDate', label: 'วันที่ส่ง', cls: 'c-lg', group: 'move',
      get: (c) => (c.moved && c.moved.moveDate ? thaiD(c.moved.moveDate) : '') },
    { key: 'note', label: 'หมายเหตุ', cls: 'c-lg note-cell',
      get: (c) => (c.latest ? c.latest.note : '') }
  ];
  const TABLE_COLS = {
    FIXED: [
      { key: 'no', label: 'NO.', cls: 'c-lg num', get: (c) => String(c.index + 1) },
      { key: 'assetClass', label: 'Asset Class', cls: 'c-lg', get: (c) => c.asset.assetClass },
      { key: 'assetNumber', label: 'Asset Number', cls: 'c-lg mono', get: (c) => c.asset.assetNumber },
      { key: 'subNumber', label: 'Sub Numb', cls: 'c-xl', get: (c) => c.asset.subNumber },
      COL_INV, COL_DESC,
      { key: 'serial', label: 'Serial Number', cls: 'c-xl', get: (c) => c.asset.serialNumber },
      { key: 'staff', label: 'Staff – Text', cls: 'c-md', get: (c) => (c.asset.staffText || '').trim() },
      { key: 'site', label: 'Current Site', cls: 'c-xl', get: (c) => c.asset.currentSite },
      COL_LOC
    ].concat(COLS_TAIL),
    RENTAL: [
      { key: 'no', label: 'NO.', cls: 'c-lg num', get: (c) => String(c.index + 1) },
      { key: 'material', label: 'Material', cls: 'c-md mono', get: (c) => c.asset.materialCode },
      COL_DESC, COL_INV,
      { key: 'plant', label: 'Plan', cls: 'c-xl', get: (c) => c.asset.plant },
      { key: 'sloc', label: 'Sloc', cls: 'c-xl', get: (c) => c.asset.sloc },
      COL_LOC
    ].concat(COLS_TAIL)
  };
  /** คอลัมน์ที่จะแสดงจริงของประเภทที่กำลังดู */
  function visibleCols(type) {
    const t = type || state.ui.type;
    const defs = TABLE_COLS[t] || TABLE_COLS.FIXED;
    const pick = state.ui.cols[t];
    if (!pick) return defs.slice();                  // อัตโนมัติ = แสดงทั้งหมด (ซ่อนตามจอด้วย CSS)
    return defs.filter((c) => c.always || pick.indexOf(c.key) >= 0);
  }
  function toggleColPicker(ev) {
    if (ev) ev.stopPropagation();
    const panel = el('colPanel');
    const willOpen = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !willOpen);
    el('colBtn').classList.toggle('open', willOpen);
    if (willOpen) {
      renderColPicker();
      setTimeout(() => panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
    }
  }
  function closeColPicker() {
    el('colPanel').classList.add('hidden');
    el('colBtn').classList.remove('open');
  }
  function renderColPicker() {
    const t = state.ui.type;
    const defs = TABLE_COLS[t] || TABLE_COLS.FIXED;
    const pick = state.ui.cols[t];
    const auto = !pick;
    el('colAutoNote').textContent = auto
      ? 'ตอนนี้เป็นโหมดอัตโนมัติ — แสดงทุกคอลัมน์และซ่อนคอลัมน์รองเองเมื่อจอแคบ'
      : 'เลือกเอง — คอลัมน์ที่ติ๊กไว้จะแสดงทุกขนาดจอ';
    el('colList').innerHTML = defs.map((c) => {
      const on = auto || c.always || pick.indexOf(c.key) >= 0;
      return '<button type="button" class="combo-item multi-item' + (on ? ' on' : '') +
        (c.always ? ' locked' : '') + '"' +
        (c.always ? ' disabled title="คอลัมน์หลัก ปิดไม่ได้"' :
          ' onclick="App.toggleCol(\'' + esc(c.key) + '\')"') + '>' +
        '<span class="multi-box">' + (on ? '✓' : '') + '</span>' +
        '<span>' + esc(c.label) + '</span>' +
        (c.always ? '<small>คงไว้เสมอ</small>' : '') + '</button>';
    }).join('');
  }
  function toggleCol(key) {
    const t = state.ui.type;
    const defs = TABLE_COLS[t] || TABLE_COLS.FIXED;
    let pick = state.ui.cols[t];
    if (!pick) pick = defs.filter((c) => !c.always).map((c) => c.key);   // เริ่มจาก "แสดงทั้งหมด"
    const i = pick.indexOf(key);
    if (i >= 0) pick.splice(i, 1); else pick.push(key);
    state.ui.cols[t] = pick;
    cacheSet('avCols_' + t, pick);
    renderColPicker();
    renderList();
  }
  function pickAllCols(on) {
    const t = state.ui.type;
    const defs = TABLE_COLS[t] || TABLE_COLS.FIXED;
    state.ui.cols[t] = on ? defs.filter((c) => !c.always).map((c) => c.key) : [];
    cacheSet('avCols_' + t, state.ui.cols[t]);
    renderColPicker();
    renderList();
  }
  function resetCols() {
    const t = state.ui.type;
    state.ui.cols[t] = null;
    try { localStorage.removeItem('avCols_' + t); } catch (e) {}
    renderColPicker();
    renderList();
  }
  /**
   * ของนอกทะเบียน (ผู้ตรวจเจอหน้างานแต่ไม่มีในทะเบียนรอบนี้) — ไม่มีแถวในทะเบียนให้แสดง
   * จึงรวมจาก log แทน: 1 รหัส = 1 การ์ด พร้อมทุกครั้งที่บันทึกของรหัสนั้น
   */
  function unlistedGroups() {
    const by = new Map();
    allLogs().filter((l) => l.unregistered).forEach((l) => {
      const key = (l.inventoryNumber || '').trim() || '(ไม่ระบุรหัส)';
      const g = by.get(key) || { inv: key, rows: [], latest: null, desc: '' };
      g.rows.push(l);
      if (isNewer(l, g.latest)) g.latest = l;
      if (!g.desc && (l.unlistedDesc || '').trim()) g.desc = l.unlistedDesc.trim();
      by.set(key, g);
    });
    let out = Array.from(by.values());
    const ui = state.ui;
    if (ui.area) {
      out = ui.area === '__NONE__'
        ? out.filter((g) => !(g.latest.locationText || '').trim())
        : out.filter((g) => (g.latest.locationText || '').trim() === ui.area);
    }
    if (ui.q) {
      const words = ui.q.toUpperCase().split(/\s+/).filter(Boolean);
      out = out.filter((g) => {
        const hay = [g.inv, g.desc, g.latest.inspector, g.latest.locationText, g.latest.note]
          .join(' ').toUpperCase();
        return words.every((w) => hay.indexOf(w) >= 0);
      });
    }
    out.sort((a, b) => (ui.sort === 'time'
      ? String(b.latest.verifiedAt).localeCompare(String(a.latest.verifiedAt))
      : String(a.inv).localeCompare(String(b.inv))));
    return out;
  }
  function renderUnlistedList() {
    const groups = unlistedGroups();
    const shown = groups.slice(0, state.ui.limit);
    const more = groups.length - shown.length;
    el('counter').textContent = 'นอกทะเบียน ' + groups.length + ' รหัส (' +
      groups.reduce((n, g) => n + g.rows.length, 0) + ' ครั้ง)';
    el('tableWrap').classList.add('hidden');
    el('cardWrap').classList.remove('hidden');
    el('cardWrap').innerHTML = shown.map((g) => {
      const latest = state.latest.get(g.inv) || g.latest;
      const cls = classify(latest);
      return '<div class="asset-row unl-row st-' + cls + '" data-unl="' + esc(g.inv) + '">' +
        '<div class="asset-row-top"><span class="asset-inv mono">' + esc(g.inv) + '</span>' +
          '<span class="type-badge t-unlisted">นอกทะเบียน</span>' + statusCell(latest) + '</div>' +
        '<div class="asset-desc">' + esc(g.desc || '(ไม่ได้ระบุรายละเอียด)') + '</div>' +
        '<div class="asset-meta">' + icon('clock') + ' ' + esc(thaiDT(latest.verifiedAt)) + ' · ' +
          esc(latest.inspector || '') + ' · ' + esc(latest.method || '') +
          (latest.locationText ? ' · ' + icon('pin') + ' ' + esc(latest.locationText) : '') +
          (g.rows.length > 1 ? ' · บันทึก ' + g.rows.length + ' ครั้ง' : '') +
          (latest.pending ? ' · <b class="pending-sync">รอส่ง</b>' : '') + '</div>' +
        (latest.note ? '<div class="asset-meta">' + icon('note') + ' ' + esc(latest.note) + '</div>' : '') +
        '<div class="asset-meta unl-actions">' +
          (photoCountOf(latest)
            ? '<button type="button" class="photo-chip" data-log="' + esc(latest.logId) + '">' +
              icon('camera') + ' ดูรูป (' + photoCountOf(latest) + ')</button>'
            : '') + gpsChip(latest) + '</div>' +
        '</div>';
    }).join('') + (more ? '<div id="moreRow" class="more-row">' + moreButton(shown.length, groups.length) + '</div>' : '')
      || '<p class="empty-note">ยังไม่มีการบันทึกของนอกทะเบียนในรอบนี้</p>';
    updateBulkBar();
  }
  /** เปิดดูรายละเอียดของนอกทะเบียน: ประวัติทุกครั้งที่บันทึก + บันทึกเพิ่มได้จากหน้าเดียวกัน */
  function openUnlistedDetail(code) {
    const g = unlistedGroups().find((x) => x.inv === code);
    openUnlisted(code === '(ไม่ระบุรหัส)' ? '' : code, 'MANUAL');
    if (!g) return;
    el('recTitle').textContent = g.inv;
    el('unlDesc').value = g.desc || '';
    el('recSub').textContent = 'ของนอกทะเบียน — บันทึกไว้แล้ว ' + g.rows.length + ' ครั้ง';
    renderHistory(g.inv);
  }
  function renderList() {
    if (!state.activeSession) {
      el('assetTbody').innerHTML = '';
      el('cardWrap').innerHTML = '';
      return;
    }
    if (state.ui.status === 'unlisted') return renderUnlistedList();
    const all = filteredAssets();
    let done = 0;
    all.forEach((a) => {
      if (classify(state.latest.get(a.inventoryNumber)) !== 'pending') done++;
    });
    el('counter').textContent = 'ตรวจแล้ว ' + done + ' / ' + all.length;
    // ทะเบียนใหญ่ (KL12 = 2,487 แถว) วาดทีเดียวหมดทำให้มือถือหน่วงทั้งจอ และวาดใหม่ทุกครั้ง
    // ที่มีการบันทึก → แสดงทีละหน้า แล้วต่อให้เองเมื่อเลื่อนถึงท้ายรายการ
    const list = all.slice(0, state.ui.limit);
    const more = all.length - list.length;
    const isFixed = state.ui.type === 'FIXED';
    const tableMode = state.ui.view === 'table';
    el('tableWrap').classList.toggle('hidden', !tableMode);
    el('cardWrap').classList.toggle('hidden', tableMode);

    if (tableMode) {
      // ── โครงตารางยึดตามฟอร์มรายงานตรวจสอบทรัพย์สินต้นฉบับ (.xls) ──
      // คอลัมน์ทั้งหมดนิยามไว้ที่ TABLE_COLS → เลือกเปิด/ปิดได้เอง (ปุ่ม "คอลัมน์")
      const allSel = all.length > 0 && all.every((a) => state.selection.has(a.inventoryNumber));
      const chk = state.canWrite ? '<th class="col-check" rowspan="2"><input type="checkbox" id="checkAll"' +
        (allSel ? ' checked' : '') + ' title="เลือกทั้งหมดที่กรองอยู่"></th>' : '';
      const cols = visibleCols();
      const auto = !state.ui.cols[state.ui.type];        // อัตโนมัติ = ซ่อนตามขนาดจอเหมือนเดิม
      const clsOf = (c) => (auto ? (c.cls || '') : (c.cls || '').replace(/\bc-(md|lg|xl)\b/g, '')).trim();
      const lead = cols.filter((c) => c.group !== 'move' && c.key !== 'note');
      const moves = cols.filter((c) => c.group === 'move');
      const noteCol = cols.find((c) => c.key === 'note');
      el('assetThead').innerHTML =
        '<tr>' + chk +
          lead.map((c) => '<th rowspan="2" class="' + clsOf(c) + '">' + esc(c.label) + '</th>').join('') +
          '<th colspan="2" class="yn-group">ผลการตรวจเช็ค</th>' +
          (moves.length ? '<th colspan="' + moves.length + '" class="' + (auto ? 'c-lg' : '') + '">ย้ายออก</th>' : '') +
          (noteCol ? '<th rowspan="2" class="' + clsOf(noteCol) + '">หมายเหตุ</th>' : '') +
          '<th rowspan="2" class="col-more"></th>' +
        '</tr><tr>' +
          '<th class="col-yn yn-yes">Yes</th><th class="col-yn yn-no">No</th>' +
          moves.map((c) => '<th class="' + clsOf(c) + '">' + esc(c.label) + '</th>').join('') +
        '</tr>';

      el('assetTbody').innerHTML = list.map((a, i) => {
        const latest = state.latest.get(a.inventoryNumber);
        const cls = classify(latest);
        const inv = esc(a.inventoryNumber);
        const sel = state.selection.has(a.inventoryNumber);
        const dis = state.canWrite ? '' : ' disabled';
        const ynYes = '<td class="col-yn yn-yes"><input type="checkbox" class="yn-box yes' +
          (cls === 'found' ? ' on' : '') + '" data-inv="' + inv + '" data-res="FOUND_NORMAL"' +
          (cls === 'found' ? ' checked' : '') + dis + ' title="พบ"></td>';
        const ynNo = '<td class="col-yn yn-no"><input type="checkbox" class="yn-box no' +
          (cls === 'notfound' ? ' on' : '') + '" data-inv="' + inv + '" data-res="NOT_FOUND"' +
          (cls === 'notfound' ? ' checked' : '') + dis + ' title="ไม่พบ"></td>';
        const ctx = { asset: a, latest: latest, index: i, moved: cls === 'moved' ? latest : null };
        const td = (c) => (c.render
          ? c.render(ctx, clsOf(c))
          : '<td class="' + clsOf(c) + '">' + esc(c.get(ctx) || '—') + '</td>');
        return '<tr class="row-' + cls + (sel ? ' row-selected' : '') + '" data-inv="' + inv + '">' +
          (state.canWrite ? '<td class="col-check"><input type="checkbox" class="row-check" data-inv="' +
            inv + '"' + (sel ? ' checked' : '') + '></td>' : '') +
          lead.map(td).join('') + ynYes + ynNo + moves.map(td).join('') +
          (noteCol ? td(noteCol) : '') +
          '<td class="col-more"><button class="qbtn more" data-act="open" title="รายละเอียด / ย้ายออก / รูปถ่าย">' + icon('more') + '</button></td>' +
          '</tr>';
      }).join('') + (more
        ? '<tr id="moreRow" class="more-row"><td colspan="16">' + moreButton(list.length, all.length) + '</td></tr>'
        : '') || '<tr><td colspan="16"><p class="empty-note">ไม่พบรายการตามเงื่อนไข</p></td></tr>';
    } else {
      el('cardWrap').innerHTML = list.map((a) => {
        const latest = state.latest.get(a.inventoryNumber);
        const cls = classify(latest);
        const meta = [];
        if (isFixed) {
          if (a.staffText) meta.push(icon('user') + ' ' + esc(a.staffText));
          if (a.serialNumber) meta.push('S/N ' + esc(a.serialNumber));
        } else {
          if (a.materialCode) meta.push('MAT ' + esc(a.materialCode));
          if (a.sloc) meta.push('Sloc ' + esc(a.sloc));
        }
        return '<div class="asset-row st-' + cls + '" data-inv="' + esc(a.inventoryNumber) + '">' +
          '<div class="asset-row-top"><span class="asset-inv mono">' + esc(a.inventoryNumber) + '</span>' +
          statusCell(latest) + '</div>' +
          '<div class="asset-desc">' + esc(a.description || '') + '</div>' +
          (meta.length ? '<div class="asset-meta">' + meta.join(' · ') + '</div>' : '') +
          (latest ? '<div class="asset-meta">' + icon('clock') + ' ' + esc(thaiDT(latest.verifiedAt)) + ' · ' +
            esc(latest.inspector || '') + ' · ' + latest.method +
            (latest.locationText ? ' · ' + icon('pin') + ' ' + esc(latest.locationText) : '') +
            (latest.pending ? ' · <b class="pending-sync">รอส่ง</b>' : '') +
            (photoCountOf(latest)
              ? ' <button type="button" class="photo-chip" data-log="' + esc(latest.logId) + '">' +
                icon('camera') + ' ดูรูป (' + photoCountOf(latest) + ')</button>'
              : '') + '</div>' : '') +
          '</div>';
      }).join('') + (more ? '<div id="moreRow" class="more-row">' + moreButton(list.length, all.length) + '</div>' : '')
        || '<p class="empty-note">ไม่พบรายการตามเงื่อนไข</p>';
    }
    updateBulkBar();
  }
  const PAGE_SIZE = 150;
  function moreButton(shown, total) {
    return '<button type="button" class="more-btn" onclick="App.showMore()">' +
      'แสดงเพิ่ม (ตอนนี้ ' + shown.toLocaleString() + ' จาก ' + total.toLocaleString() + ' รายการ)</button>';
  }
  /** เลื่อนใกล้ท้ายรายการ = ต่อให้เองอีกหน้า ไม่ต้องกดปุ่ม (ผูก listener ครั้งเดียวตอน init) */
  function checkMoreOnScroll() {
    const row = el('moreRow');
    if (!row) return;
    if (row.getBoundingClientRect().top < window.innerHeight + 600) showMore();
  }
  function showMore() {
    const total = filteredAssets().length;
    if (state.ui.limit >= total) return;
    state.ui.limit += PAGE_SIZE;
    renderList();
  }
  /** เปลี่ยนตัวกรอง/การเรียง = เริ่มนับหน้าใหม่ ไม่ค้างจำนวนแถวของชุดเดิม */
  function resetLimit() { state.ui.limit = PAGE_SIZE; }
  function setType(t) {
    state.ui.type = t;
    state.selection.clear();
    resetLimit();
    el('typeFIXED').classList.toggle('active', t === 'FIXED');
    el('typeRENTAL').classList.toggle('active', t === 'RENTAL');
    renderFilterOptions();
    renderList();
    if (!el('colPanel').classList.contains('hidden')) renderColPicker();
  }
  function setView(v) {
    state.ui.view = v;
    cacheSet('avView', v);
    resetLimit();
    el('viewTable').classList.toggle('active', v === 'table');
    el('viewCard').classList.toggle('active', v === 'card');
    renderList();
  }
  function setSearch(v) { state.ui.q = v.trim(); resetLimit(); renderList(); }
  function setCat(v) { state.ui.cat = v; resetLimit(); renderList(); }
  function setStaff(v) { state.ui.staff = v; resetLimit(); renderList(); }
  function setArea(v) { state.ui.area = v; resetLimit(); renderList(); }
  /**
   * เขียนพื้นที่จัดเก็บลงทะเบียนของรอบนี้ (ผู้ตรวจเติม/แก้เองได้หน้างาน)
   * ต้องออนไลน์ เพราะเป็นการแก้ "ทะเบียน" ไม่ใช่ผลตรวจ (ผลตรวจยังทำออฟไลน์ได้เหมือนเดิม)
   */
  /** เติมพื้นที่ให้เฉพาะรายการที่ทะเบียน "ยังไม่ได้ระบุ" (ไม่ไปทับของที่ระบุไว้แล้ว) */
  function fillAreaIfEmpty(invs, area) {
    if (!area || !navigator.onLine) return;
    const blanks = invs.filter((inv) => {
      const a = state.master.find((x) => x.inventoryNumber === inv);
      return a && !(a.location || '').trim();
    });
    if (blanks.length) applyAreaTo(blanks, area, true);
  }
  async function applyAreaTo(invs, area, quiet) {
    const s = state.activeSession;
    if (!s) return;
    if (!navigator.onLine) {
      if (!quiet) toast('แก้พื้นที่ต้องออนไลน์ — ผลตรวจยังบันทึกออฟไลน์ได้ตามปกติ', 'warn');
      return;
    }
    try {
      if (!quiet) busy('กำลังบันทึกพื้นที่...');
      const res = await AssetStore.setAssetLocation(s.sessionId, invs, area);
      state.master.forEach((a) => {
        if (invs.indexOf(a.inventoryNumber) >= 0) a.location = area;
      });
      cacheSet('avMaster_' + s.sessionId, state.master);
      rememberArea(area);
      afterDataChange();
      toast(area
        ? 'กำหนดพื้นที่ "' + area + '" ให้ ' + res.updated + ' รายการแล้ว'
        : 'ล้างพื้นที่ของ ' + res.updated + ' รายการแล้ว', 'success');
    } catch (e) {
      toast('บันทึกพื้นที่ไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      busyHide();
    }
  }
  /** กำหนดพื้นที่ให้ทุกรายการที่ติ๊กเลือกไว้ในตาราง */
  async function setSelectedArea() {
    if (!state.canWrite) return;
    const invs = Array.from(state.selection);
    if (!invs.length) return toast('ยังไม่ได้เลือกรายการ', 'warn');
    const known = knownAreas();
    const suggest = known[0] || '';
    const area = window.prompt('กำหนดพื้นที่จัดเก็บให้ ' + invs.length + ' รายการที่เลือก\n' +
      (known.length ? 'พื้นที่ที่มีอยู่: ' + known.slice(0, 8).join(' / ') + '\n' : '') +
      '(เว้นว่างแล้วกด OK = ล้างพื้นที่)', suggest);
    if (area === null) return;
    await applyAreaTo(invs, area.trim());
    clearSelection();
  }
  function setSort(v) { state.ui.sort = v; resetLimit(); renderList(); }
  function setStatus(v) {
    state.ui.status = v;
    resetLimit();
    // ของนอกทะเบียนไม่มีแถวในทะเบียนให้ทำงานเป็นชุด — ล้างรายการที่ติ๊กไว้กันสับสน
    if (v === 'unlisted') state.selection.clear();
    document.querySelectorAll('#statusChips .chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.status === v);
    });
    renderList();
  }

  // ── เลือกหลายรายการ + บันทึกเร็ว ───────────────────────────────────────────
  function toggleSelect(inv, on) {
    if (on) state.selection.add(inv); else state.selection.delete(inv);
    const row = document.querySelector('#assetTbody tr[data-inv="' + CSS.escape(inv) + '"]');
    if (row) row.classList.toggle('row-selected', on);
    updateBulkBar();
  }
  function selectAllFiltered(on) {
    const list = filteredAssets();
    list.forEach((a) => { if (on) state.selection.add(a.inventoryNumber); else state.selection.delete(a.inventoryNumber); });
    renderList();
  }
  function clearSelection() {
    state.selection.clear();
    renderList();
  }
  function updateBulkBar() {
    const n = state.selection.size;
    el('bulkBarCount').textContent = n;
    el('bulkBar').classList.toggle('hidden', n === 0 || !state.canWrite);
    const del = el('bulkDelete');
    if (del) del.classList.toggle('hidden', !state.profile || state.profile.role !== 'admin');
  }
  /** ลบประวัติการตรวจของทุกรายการที่เลือก (คืนสถานะเป็น "ยังไม่ตรวจ") */
  async function deleteSelectedHistory() {
    if (!state.profile || state.profile.role !== 'admin') {
      return toast('เฉพาะผู้ดูแลระบบเท่านั้นที่ลบประวัติได้', 'warn');
    }
    const invs = Array.from(state.selection);
    if (!invs.length) return;
    const withLogs = invs.filter((i) => state.latest.get(i));
    if (!withLogs.length) return toast('รายการที่เลือกยังไม่มีประวัติการตรวจ', 'warn');
    if (!window.confirm('ลบประวัติการตรวจของ ' + withLogs.length + ' รายการถาวร?\n\n' +
      'รายการเหล่านี้จะกลับเป็น "ยังไม่ตรวจ" — กู้คืนไม่ได้')) return;
    try {
      busy('กำลังลบประวัติ...');
      const s = state.activeSession;
      // ลบของที่ยังค้างในคิวเครื่องนี้ก่อน (ยังไม่ถูกส่งขึ้นเซิร์ฟเวอร์)
      const pending = state.queueItems.filter((q) =>
        q.sessionId === s.sessionId && withLogs.indexOf(q.inventoryNumber) >= 0);
      for (let i = 0; i < pending.length; i++) {
        try { await qDel(pending[i].clientId); } catch (e) {}
      }
      state.queueItems = state.queueItems.filter((q) => pending.indexOf(q) < 0);
      const res = await AssetStore.deleteLogsFor(s.sessionId, withLogs);
      state.logs = state.logs.filter((l) => withLogs.indexOf(l.inventoryNumber) < 0);
      state.logSummary = state.logSummary.filter((l) =>
        !(l.sessionId === s.sessionId && withLogs.indexOf(l.inventoryNumber) >= 0));
      cacheSet('avLogs_' + s.sessionId, state.logs);
      state.selection.clear();
      afterDataChange();
      toast('ลบประวัติแล้ว ' + (res.deleted + pending.length) + ' รายการ', 'success');
    } catch (e) {
      toast('ลบไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      busyHide();
    }
  }
  async function applySelection(resultKey) {
    const invs = Array.from(state.selection);
    if (!invs.length) return;
    const rk = RESULTS[resultKey];
    const already = invs.filter((i) => state.latest.get(i));
    let dupMode = null;
    if (already.length) {
      // เลือกครั้งเดียวใช้กับทั้งชุด (ถามทีละรายการจะช้าเกินไปตอนตรวจเป็นชุด)
      const first = already[0];
      const choice = await askDuplicate(first + (already.length > 1
        ? ' และอีก ' + (already.length - 1) + ' รายการ' : ''), state.latest.get(first));
      if (!choice) return;
      dupMode = choice;
    }
    const location = el('bulkBarLocation').value.trim();
    if (location) { cacheSet('avLastLocation', location); rememberArea(location); }
    busy('กำลังบันทึก ' + invs.length + ' รายการ...');
    let n = 0;
    for (let i = 0; i < invs.length; i++) {
      const asset = state.master.find((a) => a.inventoryNumber === invs[i]);
      if (!asset) continue;
      const pieceNo = await resolvePiece(invs[i], { dupMode: dupMode });
      if (pieceNo === null) continue;
      await queueRecord({
        inventoryNumber: invs[i], assetType: asset.assetType, pieceNo: pieceNo,
        resultKey: resultKey, method: 'MANUAL', locationText: location, gps: currentGeo()
      });
      n++;
    }
    fillAreaIfEmpty(invs, location);      // เติมพื้นที่ให้เฉพาะรายการที่ทะเบียนยังว่าง
    state.selection.clear();
    busyHide();
    afterDataChange();
    toast('บันทึก ' + n + ' รายการแล้ว (' + rk.label + ')', 'success');
    flushQueue();
  }
  async function quickSave(inv, resultKey) {
    const asset = state.master.find((a) => a.inventoryNumber === inv);
    if (!asset) return;
    const pieceNo = await resolvePiece(inv);
    if (pieceNo === null) { renderList(); return; }   // ยกเลิก — คืนสถานะช่องติ๊ก
    await queueRecord({
      inventoryNumber: inv, assetType: asset.assetType, resultKey: resultKey, method: 'MANUAL',
      pieceNo: pieceNo,
      locationText: (el('bulkBarLocation').value || cacheGet('avLastLocation') || '').trim(),
      gps: currentGeo()
    });
    beep();
    afterDataChange();
    flushQueue();
  }
  /**
   * ถามเมื่อ RT code นี้ถูกบันทึกไปแล้ว — คืน 'new' (พบอีกชิ้น) / 'edit' (แก้ผลเดิม) / null (ยกเลิก)
   * กรณีจริง: RT code เดียวกันถูกติดไว้กับของ 2–3 ชิ้นคนละที่
   */
  function askDuplicate(inv, latest) {
    return new Promise((resolve) => {
      const pieces = piecesOf(inv);
      el('dupTitle').textContent = inv;
      el('dupInfo').innerHTML =
        'ตรวจแล้วโดย <b>' + esc(latest.inspector || '-') + '</b> เมื่อ ' +
        esc(thaiDT(latest.verifiedAt)) + ' (ผล: ' + esc(statusLabel(latest)) + ')' +
        (pieces.length > 1 ? '<br>ขณะนี้บันทึกไว้แล้ว <b>' + pieces.length + ' ชิ้น</b>' : '') +
        '<div class="dup-pieces">' + pieces.map((p, i) =>
          '<span class="pill st-' + classify(p) + '">ชิ้นที่ ' + (i + 1) + ': ' +
          esc(statusLabel(p)) + '</span>').join('') + '</div>';
      el('dupNewLabel').textContent = 'พบอีกชิ้น — นับเป็นชิ้นที่ ' + (pieces.length + 1);
      const done = (val) => {
        el('dupModal').classList.add('hidden');
        state.dupResolve = null;
        resolve(val);
      };
      state.dupResolve = done;
      el('dupModal').classList.remove('hidden');
    });
  }
  function dupChoose(kind) { if (state.dupResolve) state.dupResolve(kind || null); }
  /**
   * ตัดสินใจเลขชิ้น (pieceNo) ของ record ที่กำลังจะบันทึก
   * คืน null = ผู้ใช้ยกเลิก
   */
  async function resolvePiece(inv, opts) {
    const latest = state.latest.get(inv);
    if (!latest) return 1;                       // ยังไม่เคยบันทึก = ชิ้นที่ 1
    if (opts && opts.dupMode === 'new') {
      return piecesOf(inv).length + 1;
    }
    if (opts && opts.dupMode === 'edit') {
      return Number(latest.pieceNo) > 0 ? Number(latest.pieceNo) : 1;
    }
    const choice = await askDuplicate(inv, latest);
    if (!choice) return null;
    return choice === 'new'
      ? piecesOf(inv).length + 1
      : (Number(latest.pieceNo) > 0 ? Number(latest.pieceNo) : 1);
  }
  /** สร้าง record ลงคิว (ทุกเส้นทางการบันทึกผ่านฟังก์ชันนี้) */
  async function queueRecord(opts) {
    const s = state.activeSession;
    if (!s) throw new Error('ยังไม่ได้เลือกรอบตรวจ');
    const rk = RESULTS[opts.resultKey];
    const item = {
      clientId: AssetStore.uuid(),
      sessionId: s.sessionId,
      site: s.site,
      pieceNo: opts.pieceNo || 1,
      inventoryNumber: opts.inventoryNumber,
      assetType: opts.assetType,
      result: rk.result,
      condition: rk.condition,
      method: opts.method || 'MANUAL',
      inspector: inspectorName(),
      locationText: opts.locationText || '',
      gpsLat: opts.gps ? opts.gps.lat : null,
      gpsLng: opts.gps ? opts.gps.lng : null,
      gpsAccuracy: opts.gps ? opts.gps.acc : null,
      moveToSite: opts.moveToSite || null,
      moveDocNo: opts.moveDocNo || null,
      moveDate: opts.moveDate || null,
      note: opts.note || '',
      unregistered: Boolean(opts.unregistered),
      unlistedDesc: opts.unlistedDesc || null,
      verifiedAt: new Date().toISOString(),
      photos: opts.photos || []
    };
    await qPut(item);
    state.queueItems.push(item);
    return item;
  }

  // ── นำทาง ──────────────────────────────────────────────────────────────────
  function go(page) {
    if ((page === 'list' || page === 'dash' || page === 'activity') && !state.activeSession) {
      toast('เลือกรอบตรวจก่อน', 'warn');
      page = 'home';
    }
    // ออกจากหน้าอัปโหลดระหว่างโหมดเพิ่มเข้ารอบ → ปุ่ม "สร้างรอบตรวจ" ครั้งหน้าต้องเป็นรอบใหม่จริง
    if (page !== 'upload' && state.importAppend) {
      state.importAppend = null;
      state.importData = null;
      el('importPreview').classList.add('hidden');
      el('appendForm').classList.add('hidden');
    }
    state.page = page;
    ['home', 'upload', 'list', 'dash', 'activity', 'manage'].forEach((p) => {
      const sec = el('page-' + p);
      if (sec) sec.classList.toggle('active', p === page);
      const nav = el('nav-' + p);
      if (nav) nav.classList.toggle('active', p === page);
    });
    // หน้าประวัติการบันทึกเป็นส่วนหนึ่งของงานในรอบ ให้ปุ่ม "รายการ" ยังสว่างอยู่
    if (page === 'activity' && el('nav-list')) el('nav-list').classList.add('active');
    el('backHome').classList.toggle('hidden', page === 'home');
    const s = state.activeSession;
    if ((page === 'list' || page === 'dash' || page === 'activity') && s) {
      el('topKicker').textContent = 'โครงการที่กำลังตรวจ';
      el('topTitle').textContent = s.site + (s.roundName ? ' · ' + s.roundName : '');
    } else if (page === 'upload') {
      el('topKicker').textContent = state.importAppend ? 'ADD TO ROUND' : 'NEW ROUND';
      el('topTitle').textContent = state.importAppend ? 'เพิ่มรายการเข้ารอบ' : 'สร้างรอบตรวจใหม่';
      renderUploadHead();
    } else {
      el('topKicker').textContent = 'ASSET INSPECTION';
      el('topTitle').textContent = 'ระบบตรวจนับทรัพย์สิน';
    }
    if (page === 'dash') renderDash();
    if (page === 'activity') renderActivity();
    if (page === 'manage') renderManage();
    if (page === 'list') updateBulkBar(); else el('bulkBar').classList.add('hidden');
    window.scrollTo(0, 0);
  }

  // ── ฟอร์มบันทึกผลตรวจ ──────────────────────────────────────────────────────
  /**
   * ปุ่มพิกัดของการบันทึกครั้งนั้น — กดแล้วเปิด Google Maps ตรงจุดที่ยืนตรวจจริง
   * ครั้งไหนไม่ได้พิกัด (ปิด GPS / ในอาคารลึก) บอกให้รู้ด้วย ไม่ปล่อยให้เดา
   */
  function gpsChip(l) {
    if (l.gpsLat == null || l.gpsLng == null) {
      return '<span class="gps-none" title="การบันทึกครั้งนี้ไม่ได้พิกัด GPS">' +
        icon('pin') + ' ไม่มีพิกัด</span>';
    }
    const lat = Number(l.gpsLat).toFixed(6);
    const lng = Number(l.gpsLng).toFixed(6);
    const acc = l.gpsAccuracy ? ' ±' + Math.round(l.gpsAccuracy) + ' ม.' : '';
    return '<a class="gps-link" target="_blank" rel="noopener" ' +
      'title="' + lat + ', ' + lng + acc + ' — เปิดใน Google Maps" ' +
      'href="https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng + '">' +
      icon('pin') + ' GPS' + acc + '</a>';
  }
  function renderHistory(inv) {
    const items = allLogs().filter((l) => l.inventoryNumber === inv)
      .sort((a, b) => String(b.verifiedAt).localeCompare(String(a.verifiedAt)));
    if (!items.length) { el('recHistory').innerHTML = ''; return; }
    let html = '<h4>ประวัติการตรวจ (' + items.length + ' ครั้ง)</h4>';
    items.forEach((l) => {
      const cls = classify(l);
      const photos = (l.photoPaths || []);
      html += '<div class="hist-row">' +
        '<span class="pill st-' + cls + '">' + esc(statusLabel(l)) + '</span>' +
        '<span class="mbadge m-' + (l.method === 'SCAN' ? 'scan' : 'manual') + '">' + l.method + '</span>' +
        '<span>' + esc(thaiDT(l.verifiedAt)) + '</span>' +
        '<span>' + icon('user') + ' ' + esc(l.inspector || '') + '</span>' +
        (l.locationText ? '<span>' + icon('pin') + ' ' + esc(l.locationText) + '</span>' : '') +
        (l.moveDocNo ? '<span>ใบส่ง ' + esc(l.moveDocNo) + '</span>' : '') +
        (l.moveDate ? '<span>ส่งวันที่ ' + esc(thaiD(l.moveDate)) + '</span>' : '') +
        (l.note ? '<span>' + icon('note') + ' ' + esc(l.note) + '</span>' : '') +
        photos.map((p, i) =>
          '<button type="button" class="photo-link" data-log="' + esc(l.logId) + '" data-i="' + i + '">' +
          icon('camera') + ' รูป ' + (i + 1) + '</button>').join('') +
        gpsChip(l) +
        (l.pending ? '<span class="pending-sync">' + icon('clock') + ' รอส่ง' +
          (l.photoCount ? ' (' + l.photoCount + ' รูป)' : '') + '</span>' : '') +
        (l.pending && l.photoCount
          ? '<button type="button" class="photo-link" data-log="' + esc(l.logId) + '" data-i="0">' +
            icon('camera') + ' ดูรูป (' + l.photoCount + ')</button>'
          : '') +
        (canEditLog(l)
          ? '<button type="button" class="hist-del" data-log="' + esc(l.logId) + '" title="ลบรายการนี้">' + icon('trash') + '</button>'
          : '') +
        '</div>';
    });
    el('recHistory').innerHTML = html;
  }
  function openRecord(asset, method, fromScanner) {
    state.rec = {
      mode: 'asset', asset: asset, method: method || 'MANUAL',
      fromScanner: Boolean(fromScanner), resultKey: null, photos: [], gps: null
    };
    el('recTitle').textContent = asset.inventoryNumber;
    const tb = el('recTypeBadge');
    tb.textContent = asset.assetType === 'RENTAL' ? 'ของเช่า' : 'Fixed Asset';
    tb.className = 'type-badge ' + (asset.assetType === 'RENTAL' ? 't-rental' : 't-fixed');
    el('recSub').textContent = asset.description || '';
    const info = [];
    if (asset.assetType === 'RENTAL') {
      if (asset.materialCode) info.push(['Material', asset.materialCode]);
      if (asset.plant) info.push(['Plant', asset.plant]);
      if (asset.sloc) info.push(['Sloc', asset.sloc]);
    } else {
      if (asset.assetClass) info.push(['Asset Class', asset.assetClass]);
      if (asset.assetNumber) info.push(['Asset Number', asset.assetNumber]);
      if (asset.serialNumber) info.push(['Serial', asset.serialNumber]);
      info.push(['ผู้รับผิดชอบ', (asset.staffText || '').trim() || '(ไม่ระบุ)']);
      if (asset.currentSite) info.push(['Site', asset.currentSite]);
    }
    el('recInfo').innerHTML = info.map((r) =>
      '<b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span>').join('');
    const latest = state.latest.get(asset.inventoryNumber);
    el('recWarn').classList.toggle('hidden', !latest);
    if (latest) {
      el('recWarn').innerHTML = icon('alert') + ' ตรวจแล้วโดย <b>' + esc(latest.inspector || '-') + '</b> เมื่อ ' +
        esc(thaiDT(latest.verifiedAt)) + ' (ผล: ' + esc(statusLabel(latest)) +
        ') — บันทึกซ้ำจะเพิ่มเป็นรายการใหม่ต่อท้าย ไม่ทับของเดิม';
    }
    renderHistory(asset.inventoryNumber);
    resetRecForm();
    // ช่องเดียวจบ: พื้นที่ในทะเบียน = ตำแหน่งที่ตรวจ
    //  • ทะเบียนระบุไว้แล้ว → โชว์ค่านั้น แก้ได้ถ้าไม่ตรงของจริง
    //  • ทะเบียนยังไม่ระบุ → ใส่ "พื้นที่ล่าสุดที่คนนี้เพิ่งบันทึก" ไว้ให้ ไม่ต้องพิมพ์ใหม่ทุกชิ้น
    // ทะเบียนยังไม่ระบุ = ปล่อยช่องว่างไว้ให้เห็นชัดว่า "ไม่มีพื้นที่" — ห้ามเติมค่าล่าสุดลงไปเอง
    // (เดิมเติมให้ทันที ทำให้แยกไม่ออกว่ารายการนี้มีพื้นที่จริงหรือเป็นค่าที่ระบบเดา
    //  แถมกดบันทึกแล้วค่านั้นถูกเขียนลงทะเบียนทั้งที่ผู้ใช้ไม่ได้ตั้งใจ)
    const areaNow = (asset.location || '').trim();
    const lastMine = lastAreaOfMine();
    el('recLocation').value = areaNow;
    el('recLocation').placeholder = areaNow ? '' : 'ยังไม่ระบุพื้นที่ — พิมพ์เอง หรือกดปุ่มหมุดเลือกจากรายการ';
    el('recLocLabel').textContent = areaNow
      ? 'พื้นที่ / ตำแหน่งที่ตรวจ (ทะเบียนระบุไว้ — แก้ได้ถ้าไม่ตรง)'
      : 'พื้นที่ / ตำแหน่งที่ตรวจ (ทะเบียนยังไม่ระบุ)';
    const codeNow = areaCodeOf(areaNow);
    el('recLocHint').textContent = areaNow
      ? (codeNow ? 'รหัสพื้นที่ ' + codeNow + ' · ' : '') + 'แก้แล้วบันทึก = อัปเดตพื้นที่ในทะเบียนให้ด้วย'
      : 'ทะเบียนรอบนี้ยังไม่ได้ระบุพื้นที่ของรายการนี้ — ระบุแล้วบันทึกจะเติมลงทะเบียนให้';
    showAreaSuggest(areaNow ? '' : lastMine);
    renderAreaList();
    el('unlistedFields').classList.add('hidden');
    el('recForm').classList.toggle('hidden', !state.canWrite);
    el('recordModal').classList.remove('hidden');
    startGps();
  }
  function openUnlisted(code, method) {
    if (!state.activeSession) return toast('เลือกรอบตรวจก่อน', 'warn');
    state.rec = {
      mode: 'unlisted', asset: null, method: method || 'MANUAL',
      fromScanner: false, resultKey: null, photos: [], gps: null
    };
    el('recTitle').textContent = 'ทรัพย์สินนอกทะเบียน';
    const tb = el('recTypeBadge');
    tb.textContent = 'นอกทะเบียน';
    tb.className = 'type-badge t-unlisted';
    el('recSub').textContent = 'ทรัพย์สินที่พบหน้างานแต่ไม่มีในทะเบียนรอบนี้';
    el('recInfo').innerHTML = '';
    el('recWarn').classList.add('hidden');
    el('recHistory').innerHTML = '';
    resetRecForm();
    el('recLocLabel').textContent = 'พื้นที่ / ตำแหน่งที่พบ';
    el('recLocHint').textContent = '';
    el('recLocation').value = '';
    el('recLocation').placeholder = 'พื้นที่ที่เจอของชิ้นนี้';
    showAreaSuggest(lastAreaOfMine());
    el('unlistedFields').classList.remove('hidden');
    el('unlInv').value = code || '';
    el('unlDesc').value = '';
    el('recForm').classList.toggle('hidden', !state.canWrite);   // ผู้ดูอย่างเดียวก็เปิดดูได้
    el('recordModal').classList.remove('hidden');
    if (state.canWrite) startGps();
    if (!code && state.canWrite) setTimeout(() => el('unlInv').focus(), 150);
  }
  function resetRecForm() {
    document.querySelectorAll('#resultSeg .seg').forEach((s) => s.classList.remove('active'));
    el('movedFields').classList.add('hidden');
    el('moveSite').value = '';
    el('moveDoc').value = '';
    el('moveDate').value = todayISO();
    el('recNote').value = '';
    el('photoStrip').innerHTML = '';
    el('gpsLine').innerHTML = icon('pin') + ' กำลังหาพิกัด GPS...';
    el('gpsLine').className = 'gps-line';
  }
  function chooseResult(key) {
    if (!state.rec) return;
    state.rec.resultKey = key;
    document.querySelectorAll('#resultSeg .seg').forEach((s) => {
      s.classList.toggle('active', s.dataset.result === key);
    });
    el('movedFields').classList.toggle('hidden', key !== 'MOVED');
  }
  // ── พิกัด GPS ที่เครื่องจับได้ล่าสุด ────────────────────────────────────────
  // เปิดค้างไว้ตอนทำงานในรอบตรวจ เพื่อให้ทุกวิธีบันทึก (ติ๊ก Yes/No · เลือกหลายรายการ ·
  // โหมดต่อเนื่อง) แนบพิกัดได้ทันทีโดยไม่ต้องรอ getCurrentPosition ทีละครั้ง
  const GEO_MAX_AGE = 5 * 60 * 1000;          // เก่ากว่า 5 นาทีถือว่าใช้ไม่ได้แล้ว
  function startGeoWatch() {
    if (state.geoWatch != null || !navigator.geolocation) return;
    try {
      state.geoWatch = navigator.geolocation.watchPosition((pos) => {
        state.geo = {
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy || 0), at: Date.now()
        };
      }, (err) => {
        // จำไว้ว่าถูกปิดสิทธิ์ เพื่อบอกวิธีเปิดใหม่ตอนผู้ใช้กดปุ่มขอพิกัด
        if (err && err.code === 1) state.geoDenied = true;
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    } catch (e) { state.geoWatch = null; }
  }
  function stopGeoWatch() {
    if (state.geoWatch == null) return;
    try { navigator.geolocation.clearWatch(state.geoWatch); } catch (e) {}
    state.geoWatch = null;
  }
  /** พิกัดล่าสุดถ้ายังสดพอ — ไม่หน่วงการบันทึกเลย */
  function currentGeo() {
    const g = state.geo;
    if (!g || Date.now() - g.at > GEO_MAX_AGE) return null;
    return { lat: g.lat, lng: g.lng, acc: g.acc };
  }
  function startGps() {
    if (!state.rec) return;
    const cached = currentGeo();
    if (cached) {                              // มีพิกัดอยู่แล้ว ใช้ไปก่อนระหว่างรอตัวแม่นกว่า
      state.rec.gps = cached;
      el('gpsLine').innerHTML = icon('pin') + ' ใช้พิกัดล่าสุด (±' + cached.acc + ' ม.) กำลังอัปเดต...';
      el('gpsLine').className = 'gps-line ok';
    }
    if (!navigator.geolocation) {
      el('gpsLine').innerHTML = icon('pin') + ' เครื่องนี้ไม่รองรับ GPS (ข้ามได้ ไม่บังคับ)';
      return;
    }
    const rec = state.rec;
    navigator.geolocation.getCurrentPosition((pos) => {
      if (state.rec !== rec) return;
      rec.gps = {
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        acc: Math.round(pos.coords.accuracy || 0)
      };
      state.geo = { lat: rec.gps.lat, lng: rec.gps.lng, acc: rec.gps.acc, at: Date.now() };
      el('gpsLine').innerHTML = icon('pin') + ' ได้พิกัดแล้ว (±' + rec.gps.acc + ' ม.)';
      el('gpsLine').className = 'gps-line ok';
    }, () => {
      if (state.rec !== rec) return;
      el('gpsLine').innerHTML = icon('pin') + ' ไม่ได้พิกัด GPS (ข้ามได้ ไม่บังคับ)';
    }, (err) => {
      if (state.rec !== rec) return;
      if (err && err.code === 1) state.geoDenied = true;
      el('gpsLine').innerHTML = icon('pin') + ' ไม่ได้พิกัด GPS — แตะปุ่มข้างๆ เพื่อลองใหม่ (ข้ามได้ ไม่บังคับ)';
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
  }
  /** ขอพิกัดครั้งเดียวแบบสดๆ (ไม่เอาค่าที่แคชไว้) — ใช้กับปุ่ม "ขอพิกัด" ที่ผู้ใช้กดเอง */
  function askGeo() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject({ code: 0 });
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy || 0)
        }),
        (err) => reject(err || { code: 2 }),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
  }
  /** บอกสาเหตุที่ขอพิกัดไม่ได้ พร้อมวิธีแก้ — กรณีปิดสิทธิ์ไปแล้วต้องเปิดจากเบราว์เซอร์เท่านั้น */
  function geoErrText(err) {
    const code = err && err.code;
    if (code === 0) return 'เครื่องนี้ไม่รองรับ GPS (ข้ามได้ ไม่บังคับ)';
    if (code === 1) {
      return 'สิทธิ์ตำแหน่งถูกปิดไว้ — iPhone: ตั้งค่า → Safari → ตำแหน่ง → "ถาม" ' +
        '· Android Chrome: แตะรูปกุญแจ/ไอคอนหน้า URL → สิทธิ์ → ตำแหน่ง → อนุญาต แล้วกดปุ่มนี้อีกครั้ง';
    }
    if (code === 3) return 'หาพิกัดไม่ทัน (สัญญาณอ่อน) — ออกไปที่โล่งแล้วกดอีกครั้ง';
    return 'ขอพิกัดไม่สำเร็จ — กดอีกครั้ง หรือเปิด GPS ของเครื่องก่อน';
  }
  /** ปุ่มขอพิกัดในฟอร์มบันทึกผลตรวจ */
  async function retryGps() {
    if (!state.rec) return;
    const line = el('gpsLine');
    line.className = 'gps-line';
    line.innerHTML = icon('pin') + ' กำลังขอพิกัดใหม่...';
    try {
      const g = await askGeo();
      state.rec.gps = g;
      state.geo = { lat: g.lat, lng: g.lng, acc: g.acc, at: Date.now() };
      state.geoDenied = false;
      startGeoWatch();                          // ได้สิทธิ์แล้ว เปิดตัวติดตามต่อให้วิธีอื่นใช้ด้วย
      line.className = 'gps-line ok';
      line.innerHTML = icon('pin') + ' ได้พิกัดแล้ว (±' + g.acc + ' ม.)';
    } catch (err) {
      if (err && err.code === 1) state.geoDenied = true;
      line.className = 'gps-line bad';
      line.innerHTML = icon('pin') + ' ' + esc(geoErrText(err));
    }
  }
  function resizeImage(file, maxDimension, quality) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        try {
          const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
          const width = Math.max(Math.round(image.naturalWidth * scale), 1);
          const height = Math.max(Math.round(image.naturalHeight * scale), 1);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d', { alpha: false });
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (error) { reject(error); }
        finally { URL.revokeObjectURL(objectUrl); }
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('เบราว์เซอร์อ่านรูปนี้ไม่ได้'));
      };
      image.src = objectUrl;
    });
  }
  async function addPhotos(event) {
    if (!state.rec) return;
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (state.rec.photos.length + files.length > 5) {
      return toast('แนบได้สูงสุด 5 รูปต่อการตรวจ 1 ครั้ง', 'warn');
    }
    busy('กำลังย่อรูป...');
    try {
      for (let i = 0; i < files.length; i++) {
        const dataUrl = await resizeImage(files[i], 1280, 0.82);
        state.rec.photos.push({ dataUrl: dataUrl });
      }
      renderPhotoStrip();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      busyHide();
    }
  }
  function renderPhotoStrip() {
    if (!state.rec) return;
    el('photoStrip').innerHTML = state.rec.photos.map((p, i) =>
      '<div class="photo-thumb"><img src="' + p.dataUrl + '" alt="">' +
      '<button type="button" onclick="App.removePhoto(' + i + ')">' + icon('close') +
      '</button></div>').join('');
  }
  function removePhoto(i) {
    if (!state.rec) return;
    state.rec.photos.splice(i, 1);
    renderPhotoStrip();
  }
  async function viewPhoto(path) {
    try {
      busy('กำลังเปิดรูป...');
      const urls = await AssetStore.photoUrls([path]);
      busyHide();
      if (urls[path]) window.open(urls[path], '_blank');
      else toast('เปิดรูปไม่ได้', 'error');
    } catch (e) { busyHide(); toast(e.message, 'error'); }
  }
  // ── ดูรูปที่ถ่ายไว้ (เปิดในแอปเลย ไม่ต้องเด้งแท็บใหม่) ──────────────────────
  /** จำนวนรูปของ record นั้น (ทั้งที่ส่งแล้วและที่ยังค้างส่งอยู่ในเครื่อง) */
  function photoCountOf(l) {
    return (l.photoPaths || []).length || l.photoCount || 0;
  }
  async function openPhotos(logId, startAt) {
    const l = allLogs().find((x) => String(x.logId) === String(logId));
    if (!l) return;
    let items = [];
    if (l.pending) {
      // ยังไม่ได้ส่งขึ้นเซิร์ฟเวอร์ — รูปอยู่ในคิวเป็น dataUrl
      const q = state.queueItems.find((x) => x.clientId === l.clientId);
      items = ((q && q.photos) || []).map((p) => p.dataUrl).filter(Boolean);
    } else {
      const paths = l.photoPaths || [];
      if (!paths.length) return toast('รายการนี้ไม่มีรูป', 'warn');
      try {
        busy('กำลังเปิดรูป...');
        const urls = await AssetStore.photoUrls(paths);
        items = paths.map((p) => urls[p]).filter(Boolean);
      } catch (e) {
        busyHide();
        return toast('เปิดรูปไม่ได้: ' + e.message, 'error');
      } finally { busyHide(); }
    }
    if (!items.length) return toast('เปิดรูปไม่ได้ (อาจถูกลบไปแล้ว)', 'warn');
    const asset = state.master.find((a) => a.inventoryNumber === l.inventoryNumber);
    state.photos = { items: items, i: Math.min(startAt || 0, items.length - 1), log: l };
    el('photoTitle').textContent = l.inventoryNumber;
    el('photoSub').textContent = (asset ? (asset.description || '') + ' · ' : '') +
      statusLabel(l) + ' · ' + (l.inspector || '') + ' · ' + thaiDT(l.verifiedAt) +
      (l.pending ? ' · ยังไม่ได้ส่ง' : '');
    renderPhotoView();
    el('photoModal').classList.remove('hidden');
  }
  function renderPhotoView() {
    const p = state.photos;
    if (!p) return;
    el('photoImg').src = p.items[p.i];
    el('photoCount').textContent = (p.i + 1) + ' / ' + p.items.length;
    el('photoPrev').classList.toggle('hidden', p.items.length < 2);
    el('photoNext').classList.toggle('hidden', p.items.length < 2);
    const open = el('photoOpen');
    open.href = p.items[p.i];
  }
  function photoNav(delta) {
    const p = state.photos;
    if (!p) return;
    p.i = (p.i + delta + p.items.length) % p.items.length;
    renderPhotoView();
  }
  function closePhotos() {
    state.photos = null;
    el('photoImg').src = '';
    el('photoModal').classList.add('hidden');
  }
  async function saveRecord() {
    const rec = state.rec;
    if (!rec || !state.canWrite) return;
    if (!rec.resultKey) return toast('เลือกผลการตรวจก่อน (พบ/ไม่พบ/ย้ายออก)', 'warn');
    let inv, assetType, unlistedDesc = null;
    if (rec.mode === 'unlisted') {
      inv = el('unlInv').value.trim().toUpperCase().replace(/\s+/g, '');
      if (!inv) return toast('กรอกรหัสทรัพย์สินตามป้ายจริงก่อน', 'warn');
      unlistedDesc = el('unlDesc').value.trim();
      assetType = 'UNLISTED';
    } else {
      inv = rec.asset.inventoryNumber;
      assetType = rec.asset.assetType;
    }
    const pieceNo = await resolvePiece(inv);
    if (pieceNo === null) return;
    const location = el('recLocation').value.trim();
    if (location) { cacheSet('avLastLocation', location); rememberArea(location); }
    // ช่องเดียวใช้ทั้งผลตรวจและทะเบียน — เขียนลงทะเบียนเมื่อค่าต่างจากเดิม
    const areaOld = rec.asset ? (rec.asset.location || '').trim() : '';
    try {
      await queueRecord({
        inventoryNumber: inv, assetType: assetType, resultKey: rec.resultKey, pieceNo: pieceNo,
        method: rec.method, locationText: location, gps: rec.gps,
        moveToSite: rec.resultKey === 'MOVED' ? el('moveSite').value.trim().toUpperCase() : null,
        moveDocNo: rec.resultKey === 'MOVED' ? el('moveDoc').value.trim() : null,
        moveDate: rec.resultKey === 'MOVED' ? (el('moveDate').value || null) : null,
        note: el('recNote').value.trim(),
        unregistered: rec.mode === 'unlisted',
        unlistedDesc: unlistedDesc,
        photos: rec.photos
      });
    } catch (e) {
      return toast('บันทึกลงเครื่องไม่ได้: ' + e.message, 'error');
    }
    if (rec.asset && location && location !== areaOld) {
      applyAreaTo([inv], location);      // ไม่ต้องรอ — ผลตรวจบันทึกไปแล้ว
    }
    afterDataChange();
    const fromScanner = rec.fromScanner;
    closeRecord();
    toast(navigator.onLine ? 'บันทึก ' + inv + ' แล้ว'
      : 'บันทึก ' + inv + ' แล้ว (ออฟไลน์ — รอส่ง)', 'success');
    flushQueue();
    if (fromScanner) resumeScan();
  }
  function closeRecord() {
    const wasScanner = state.rec && state.rec.fromScanner;
    state.rec = null;
    el('recordModal').classList.add('hidden');
    if (wasScanner) resumeScan();
  }
  function openAsset(inv) {
    const asset = state.master.find((a) => a.inventoryNumber === inv);
    if (asset) openRecord(asset, 'MANUAL', false);
  }
  async function deleteLogEntry(logId) {
    const row = allLogs().find((l) => String(l.logId) === String(logId));
    if (!row) return;
    if (!canEditLog(row)) {
      return toast('ลบได้เฉพาะรายการที่ตัวเองบันทึก (หรือให้ผู้ดูแลลบให้)', 'warn');
    }
    if (!window.confirm('ลบรายการตรวจนี้ถาวร? (ใช้เฉพาะกรณีบันทึกผิดจริง)\n\n' +
      row.inventoryNumber + ' · ' + statusLabel(row) + ' · ' + thaiDT(row.verifiedAt))) return;
    // ยังไม่ได้ส่งขึ้นเซิร์ฟเวอร์ = เอาออกจากคิวได้เลย
    if (row.pending) {
      const cid = row.clientId;
      try { await qDel(cid); } catch (e) {}
      state.queueItems = state.queueItems.filter((q) => q.clientId !== cid);
      afterDataChange();
      if (state.rec && state.rec.asset) renderHistory(state.rec.asset.inventoryNumber);
      return toast('ลบรายการที่ยังไม่ได้ส่งแล้ว', 'success');
    }
    try {
      busy('กำลังลบ...');
      await AssetStore.deleteLog(logId);
      state.logs = state.logs.filter((l) => l.logId !== logId);
      state.logSummary = state.logSummary.filter((l) => l.logId !== logId);
      if (state.activeSession) cacheSet('avLogs_' + state.activeSession.sessionId, state.logs);
      afterDataChange();
      if (state.rec && state.rec.asset) renderHistory(state.rec.asset.inventoryNumber);
      toast('ลบแล้ว', 'success');
    } catch (e) {
      toast(isNetworkError(e.message)
        ? 'ลบไม่ได้ตอนออฟไลน์ — ผลตรวจนี้ส่งขึ้นเซิร์ฟเวอร์ไปแล้ว ลองใหม่เมื่อเน็ตกลับมา'
        : e.message, 'error');
    } finally { busyHide(); }
  }

  // ── สแกน QR ────────────────────────────────────────────────────────────────
  // ตัวถอดรหัสหลักคือ jsQR (ไฟล์อยู่ในโปรเจกต์ ใช้ได้ทุกเบราว์เซอร์รวมทั้ง iPhone
  // และไม่ต้องมีเน็ต) · ถ้าเครื่องมี BarcodeDetector (Android Chrome) ใช้ควบคู่ไปด้วย
  // · ZXing เป็นตัวสำรองไว้อ่านบาร์โค้ดเส้น (Code128/39) เท่านั้น
  // แต่ละเฟรมสลับระยะซูม 3 ระดับ (เต็มภาพ → กลาง → ซูมเข้ากลางจอ) เลียนแบบกล้องของเครื่อง
  // ที่ไล่หา QR ทั้งภาพ ทำให้จับได้ทั้ง QR ใหญ่ใกล้ๆ และ QR เล็กไกลๆ
  const SCAN_SIZE = 720;
  // รอบการอ่านที่หมุนสลับไปทีละเฟรม — เห็นทั้งภาพก่อน แล้วค่อยซูมเข้าหากลางจอ
  // เพิ่มรอบ "ดันคอนทราสต์" ไว้ช่วยกรณีสติกเกอร์สะท้อนแสงหรือแสงน้อย
  const SCAN_PASSES = [
    { full: true },
    { zoom: 0.6 },
    { full: true, boost: true },
    { zoom: 0.38 },
    { zoom: 0.6, boost: true }
  ];
  function setScanStatus(text) { el('scanStatus').textContent = text; }
  /**
   * ดึงคอนทราสต์ภาพให้ชัดขึ้นก่อนถอดรหัส (ยืดช่วงเทาที่ใช้จริงให้เต็ม 0-255)
   * ช่วยกรณีแสงสะท้อนบนสติกเกอร์หรือถ่ายในที่มืด ซึ่งภาพจะเทาจนตัวถอดรหัสแยกไม่ออก
   */
  function boostContrast(img) {
    const d = img.data;
    let lo = 255;
    let hi = 0;
    for (let i = 0; i < d.length; i += 40) {          // สุ่มดูทุก 10 พิกเซลพอ
      const g = (d[i] * 306 + d[i + 1] * 601 + d[i + 2] * 117) >> 10;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    if (hi - lo < 12) return img;                     // ภาพเรียบเกินไป ยืดแล้วยิ่งเละ
    const scale = 255 / (hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      let g = (d[i] * 306 + d[i + 1] * 601 + d[i + 2] * 117) >> 10;
      g = (g - lo) * scale;
      g = g < 0 ? 0 : (g > 255 ? 255 : g);
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    return img;
  }
  /** อ่าน QR จาก ImageData ด้วย jsQR (ลองทั้งภาพปกติและภาพกลับสี) */
  function decodeQR(img) {
    if (!window.jsQR) return '';
    try {
      const r = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
      return r && r.data ? String(r.data) : '';
    } catch (e) { return ''; }
  }
  /** อ่านบาร์โค้ดเส้นด้วย ZXing (ใช้ API ระดับล่าง — decodeFromCanvas ไม่มีจริงใน build นี้) */
  function decodeBarcode1D(img) {
    const Z = window.ZXing;
    if (!Z || !Z.RGBLuminanceSource || !Z.BinaryBitmap || !Z.HybridBinarizer || !Z.MultiFormatReader) return '';
    try {
      const w = img.width;
      const h = img.height;
      const data = img.data;
      const lum = new Uint8ClampedArray(w * h);
      for (let i = 0, p = 0; p < lum.length; i += 4, p++) {
        lum[p] = (data[i] * 306 + data[i + 1] * 601 + data[i + 2] * 117) >> 10;
      }
      const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, w, h)));
      const reader = state.scan.zxReader;
      const res = reader.decode(bitmap);
      return res ? res.getText() : '';
    } catch (e) { return ''; }
  }
  /** เตรียม ZXing ไว้อ่านบาร์โค้ดเส้น — ล้มเหลวก็ไม่เป็นไร QR ยังอ่านได้ด้วย jsQR */
  async function prepareBarcode1D() {
    if (state.scan.zxReader) return;
    try {
      await ensureLibrary('zxing');
      const Z = window.ZXing;
      if (!Z || !Z.MultiFormatReader) return;
      const reader = new Z.MultiFormatReader();
      if (Z.DecodeHintType && Z.BarcodeFormat) {
        const hints = new Map();
        hints.set(Z.DecodeHintType.TRY_HARDER, true);
        hints.set(Z.DecodeHintType.POSSIBLE_FORMATS,
          [Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.ITF, Z.BarcodeFormat.EAN_13]);
        reader.setHints(hints);
      }
      state.scan.zxReader = reader;
    } catch (e) { /* ไม่มีเน็ต/โหลดไม่ได้ = ใช้ jsQR อย่างเดียว */ }
  }
  async function openScanner() {
    if (!state.canWrite) return;
    if (!state.activeSession) return toast('เลือกรอบตรวจก่อนเริ่มสแกน', 'warn');
    el('scannerModal').classList.remove('hidden');
    el('scanNotFound').classList.add('hidden');
    el('scanTips').classList.add('hidden');
    el('scanPhotoBtn').classList.remove('hidden');
    el('torchBtn').classList.add('hidden');
    state.scan.active = true;
    state.scan.paused = false;
    state.scan.busy = false;
    state.scan.frames = 0;
    state.scan.torchOn = false;
    state.scan.detector = null;
    state.scan.engine = '';
    state.scan.tipsShown = false;
    state.scan.startedAt = Date.now();
    setScanStatus('กำลังเปิดกล้อง...');
    try {
      if (!window.isSecureContext) throw new Error('กล้องใช้ได้เฉพาะเมื่อเปิดผ่าน https');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('เบราว์เซอร์นี้ไม่รองรับกล้อง');
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' },
            width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
      } catch (e) {
        // บางเครื่องไม่มีกล้องหลังหรือไม่ยอมรับ exact → ใช้กล้องไหนก็ได้
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false
        });
      }
      if (!state.scan.active) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      state.scan.stream = stream;
      const video = el('scanVideo');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      await new Promise((res) => {
        if (video.videoWidth) return res();
        video.onloadedmetadata = () => res();
        setTimeout(res, 1500);
      });
      setupTorch(stream);
      improveFocus(stream);
      await startDecodeLoop(video);
    } catch (e) {
      setScanStatus(/denied|permission|NotAllowed/i.test(e.message || e.name || '')
        ? 'ไม่ได้รับอนุญาตใช้กล้อง — เปิดสิทธิ์กล้องของเว็บนี้ในเบราว์เซอร์'
        : 'เปิดกล้องไม่ได้: ' + (e.message || e.name));
      // เปิดกล้องสดไม่ได้ก็ยังถ่ายรูปให้ระบบอ่านได้
      el('scanTips').classList.remove('hidden');
      state.scan.tipsShown = true;
    }
  }
  /** ไฟฉาย (Android Chrome รองรับ · iOS Safari ยังไม่รองรับ ปุ่มจะไม่ขึ้น) */
  function setupTorch(stream) {
    const track = stream.getVideoTracks()[0];
    state.scan.track = track;
    try {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps && caps.torch) {
        el('torchBtn').classList.remove('hidden');
        el('torchBtn').classList.remove('on');
      }
    } catch (e) {}
  }
  async function toggleTorch() {
    const track = state.scan.track;
    if (!track) return;
    const on = !state.scan.torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] });
      state.scan.torchOn = on;
      el('torchBtn').classList.toggle('on', on);
    } catch (e) {
      toast('เครื่องนี้เปิดไฟฉายจากเว็บไม่ได้', 'warn');
    }
  }
  function improveFocus(stream) {
    const track = stream.getVideoTracks()[0];
    try {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      const adv = [];
      if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) adv.push({ focusMode: 'continuous' });
      if (caps.zoom && caps.zoom.min <= 1.6 && caps.zoom.max >= 1.6) adv.push({ zoom: 1.6 });
      if (adv.length) track.applyConstraints({ advanced: adv });
    } catch (e) {}
  }
  async function startDecodeLoop(video) {
    const canvas = el('scanCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = SCAN_SIZE;
    canvas.height = SCAN_SIZE;

    if ('BarcodeDetector' in window) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const want = ['qr_code', 'code_128', 'code_39'].filter((f) => supported.indexOf(f) >= 0);
        if (want.length) state.scan.detector = new window.BarcodeDetector({ formats: want });
      } catch (e) { state.scan.detector = null; }
    }
    if (!window.jsQR && !state.scan.detector) {
      setScanStatus('ตัวอ่าน QR ยังไม่พร้อม — รีเฟรชหน้าเว็บหนึ่งครั้ง');
    }
    state.scan.engine = (state.scan.detector ? 'ตัวอ่านของเครื่อง' : '') +
      (state.scan.detector && window.jsQR ? '+' : '') + (window.jsQR ? 'jsQR' : '');
    prepareBarcode1D();                            // สำรองไว้อ่านบาร์โค้ดเส้น ไม่ต้องรอ
    setScanStatus('กล้องพร้อม — เล็ง QR ในกรอบ');

    state.scan.timer = setInterval(() => {
      if (!state.scan.active || state.scan.paused || state.scan.busy) return;
      state.scan.busy = true;
      scanOneFrame(video, canvas, ctx)
        .catch(() => {})
        .then(() => { state.scan.busy = false; });
    }, 130);
  }
  async function scanOneFrame(video, canvas, ctx) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const pass = SCAN_PASSES[state.scan.frames % SCAN_PASSES.length];
    if (pass.full) {
      // ทั้งเฟรมโดยไม่ตัดขอบ — QR ที่อยู่ริมจอก็ยังอ่านเจอ
      const scale = Math.min(SCAN_SIZE / vw, SCAN_SIZE / vh, 1);
      canvas.width = Math.max(2, Math.round(vw * scale));
      canvas.height = Math.max(2, Math.round(vh * scale));
      ctx.drawImage(video, 0, 0, vw, vh, 0, 0, canvas.width, canvas.height);
    } else {
      // ซูมดิจิทัลเข้าหากลางจอจากภาพความละเอียดเต็ม — จับ QR เล็กๆ ไกลๆ ได้
      const side = Math.round(Math.min(vw, vh) * pass.zoom);
      canvas.width = SCAN_SIZE;
      canvas.height = SCAN_SIZE;
      ctx.drawImage(video, Math.round((vw - side) / 2), Math.round((vh - side) / 2),
        side, side, 0, 0, SCAN_SIZE, SCAN_SIZE);
    }
    state.scan.frames++;
    if (state.scan.frames % 12 === 0) {
      setScanStatus('กำลังอ่าน... (' + vw + '×' + vh + ' · ' + state.scan.engine +
        ' · ' + state.scan.frames + ' เฟรม)');
    }
    showScanTips();
    if (state.scan.detector && !pass.boost) {
      try {
        const codes = await state.scan.detector.detect(canvas);
        if (codes && codes.length) return onScanDecode(codes[0].rawValue);
      } catch (e) { /* เฟรมนี้ไม่เจอ = ปกติ */ }
      if (!state.scan.active || state.scan.paused) return;
    }
    let img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (pass.boost) img = boostContrast(img);
    const qr = decodeQR(img);
    if (qr) return onScanDecode(qr);
    if (state.scan.zxReader && state.scan.frames % 4 === 0) {
      const bc = decodeBarcode1D(img);
      if (bc) return onScanDecode(bc);
    }
  }
  /** อ่านไม่ได้สักทีให้บอกวิธีแก้ (ระยะ/แสง/ถ่ายรูปแทน) แทนที่จะปล่อยให้เล็งไปเรื่อยๆ */
  function showScanTips() {
    if (state.scan.tipsShown) return;
    if (Date.now() - state.scan.startedAt < 8000) return;
    state.scan.tipsShown = true;
    el('scanTips').classList.remove('hidden');
  }
  function hideScanTips() { el('scanTips').classList.add('hidden'); }
  // ── ทางลัดเมื่อสแกนสดไม่ผ่าน: ถ่ายรูปด้วยกล้องของเครื่องแล้วให้ระบบอ่านจากรูป ──
  // กล้องของเครื่องโฟกัส/ปรับแสงเก่งกว่าภาพสดในเบราว์เซอร์ และได้ภาพความละเอียดเต็ม
  function loadImageFile(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file).catch(() => loadImageViaUrl(file));
    }
    return loadImageViaUrl(file);
  }
  function loadImageViaUrl(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดไฟล์รูปไม่ได้')); };
      im.src = url;
    });
  }
  /** ไล่อ่านรูปนิ่งหลายระยะที่ความละเอียดสูงกว่าภาพสด (รูปจากกล้องเครื่องคมกว่ามาก) */
  async function decodeStill(bmp) {
    const w = bmp.width || bmp.naturalWidth;
    const h = bmp.height || bmp.naturalHeight;
    if (!w || !h) return '';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const SIZE = 1100;
    const passes = [
      { full: true }, { zoom: 0.6 }, { full: true, boost: true },
      { zoom: 0.35 }, { zoom: 0.6, boost: true }
    ];
    for (let i = 0; i < passes.length; i++) {
      const p = passes[i];
      if (p.full) {
        const scale = Math.min(SIZE / w, SIZE / h, 1);
        canvas.width = Math.max(2, Math.round(w * scale));
        canvas.height = Math.max(2, Math.round(h * scale));
        ctx.drawImage(bmp, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
      } else {
        const side = Math.round(Math.min(w, h) * p.zoom);
        canvas.width = SIZE;
        canvas.height = SIZE;
        ctx.drawImage(bmp, Math.round((w - side) / 2), Math.round((h - side) / 2),
          side, side, 0, 0, SIZE, SIZE);
      }
      if (state.scan.detector && !p.boost) {
        try {
          const codes = await state.scan.detector.detect(canvas);
          if (codes && codes.length) return codes[0].rawValue;
        } catch (e) {}
      }
      let img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (p.boost) img = boostContrast(img);
      const qr = decodeQR(img);
      if (qr) return qr;
      if (state.scan.zxReader) {
        const bc = decodeBarcode1D(img);
        if (bc) return bc;
      }
    }
    return '';
  }
  async function scanFromPhoto(ev) {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';                          // เลือกรูปเดิมซ้ำได้
    if (!file) return;
    if (!state.scan.detector && !window.jsQR) return toast('ตัวอ่าน QR ยังไม่พร้อม — รีเฟรชหน้าเว็บ', 'error');
    setScanStatus('กำลังอ่านรูป...');
    state.scan.paused = true;
    try {
      const bmp = await loadImageFile(file);
      const text = await decodeStill(bmp);
      if (bmp.close) bmp.close();
      if (!text) {
        state.scan.paused = false;
        setScanStatus('อ่านรูปไม่ออก — ถ่ายใหม่ให้ QR ใหญ่เต็มกรอบและชัด');
        return toast('อ่าน QR จากรูปไม่ได้ — ถ่ายให้ QR ใหญ่ขึ้น ชัดขึ้น และไม่สะท้อนแสง', 'warn');
      }
      state.scan.paused = false;
      onScanDecode(text);
    } catch (e) {
      state.scan.paused = false;
      setScanStatus('อ่านรูปไม่ได้: ' + (e.message || e.name));
    }
  }
  async function onScanDecode(text) {
    if (!state.scan.active || state.scan.paused) return;
    state.scan.paused = true;
    beep();
    const raw = String(text || '').trim();
    state.scan.lastRaw = raw;
    state.scan.lastCode = normalizeCode(raw) || raw.slice(0, 60);
    const hits = matchScanned(raw);
    if (!hits.length) return showScanNotFound();
    let asset = hits[0];
    if (hits.length > 1) {
      // เลขนี้ตรงกับทรัพย์สินหลายรายการในทะเบียน (เช่น Asset Number เดียวกันหลาย Sub)
      const code = await pickCode(hits.map((h) => h.inventoryNumber));
      if (!code) return resumeScan();
      asset = hits.find((h) => h.inventoryNumber === code) || hits[0];
    }
    setScanStatus('เจอ ' + asset.inventoryNumber);
    openRecord(asset, 'SCAN', true);
    // QR ที่ไม่ได้เก็บ RT code ตรงๆ (เก็บ Asset Number) ให้บอกว่าจับคู่มาจากอะไร
    if (raw.toUpperCase().indexOf(asset.inventoryNumber) < 0) {
      toast('QR อ่านได้ "' + raw.slice(0, 30) + '" → ตรงกับ ' + asset.inventoryNumber, 'success');
    }
  }
  function showScanNotFound() {
    el('nfCode').textContent = state.scan.lastCode;
    el('nfRaw').textContent = state.scan.lastRaw || '(ว่าง)';
    el('scanNotFound').classList.remove('hidden');
    el('scanPhotoBtn').classList.add('hidden');     // กันปุ่มทับปุ่มในกล่องแจ้งเตือน
    el('scanTips').classList.add('hidden');
    setScanStatus('ไม่พบในทะเบียนรอบนี้');
  }
  function resumeScan() {
    if (!state.scan.active) return;
    el('scanNotFound').classList.add('hidden');
    el('scanPhotoBtn').classList.remove('hidden');
    setScanStatus('กล้องพร้อม — เล็ง QR Code ในกรอบ');
    setTimeout(() => { state.scan.paused = false; }, 700);
  }
  function scanUnlisted() {
    const code = state.scan.lastCode;
    closeScanner();
    openUnlisted(code, 'SCAN');
  }
  function closeScanner() {
    // ปิดกล้องระหว่างที่ยังถามว่าเลขนี้คือรายการไหน — ปิดกล่องคำถามไปด้วย
    if (state.pickResolve) state.pickResolve(null);
    state.scan.active = false;
    state.scan.paused = false;
    state.scan.busy = false;
    state.scan.detector = null;
    if (state.scan.timer) { clearInterval(state.scan.timer); state.scan.timer = null; }
    if (state.scan.reader) { try { state.scan.reader.reset(); } catch (e) {} state.scan.reader = null; }
    if (state.scan.torchOn && state.scan.track) {
      try { state.scan.track.applyConstraints({ advanced: [{ torch: false }] }); } catch (e) {}
    }
    state.scan.track = null;
    state.scan.torchOn = false;
    if (state.scan.stream) {
      state.scan.stream.getTracks().forEach((tr) => tr.stop());
      state.scan.stream = null;
    }
    el('scanVideo').srcObject = null;
    el('scannerModal').classList.add('hidden');
  }

  // ── โหมดตรวจต่อเนื่อง ──────────────────────────────────────────────────────
  /** หมวดทั้งหมดของประเภทที่กำลังตรวจ พร้อมจำนวนรายการ */
  function catCounts() {
    const counts = {};
    mastersOfType().forEach((a) => {
      const c = a.categoryCode || '?';
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }
  function openBulk() {
    if (!state.canWrite) return;
    if (!state.activeSession) return toast('เลือกรอบตรวจก่อน', 'warn');
    state.bulk.count = 0;
    const saved = cacheGet('avBulkResult');
    if (saved && RESULTS[saved] && saved !== 'MOVED') state.bulk.resultKey = saved;
    el('bulkSub').textContent = state.ui.type === 'RENTAL' ? 'ทรัพย์สินของเช่า' : 'ทรัพย์สิน Fixed Assets';
    const counts = catCounts();
    const cats = Object.keys(counts).sort();
    if (!cats.length) return toast('ยังไม่มีทะเบียนของประเภทนี้', 'warn');
    const savedCats = cacheGet('avBulkCats_' + state.ui.type) || [];
    state.bulk.cats = savedCats.filter((c) => cats.indexOf(c) >= 0);
    if (!state.bulk.cats.length) state.bulk.cats = [cats[0]];
    el('bulkCatSearch').value = '';
    renderCatPicker();
    el('bulkLocation').value = lastAreaOfMine();
    el('bulkLast').innerHTML = '';
    el('bulkTail').value = '';
    state.bulk.busy = false;
    const auto = cacheGet('avBulkAuto');
    state.bulk.auto = auto === null ? true : Boolean(auto);
    el('bulkAuto').checked = state.bulk.auto;
    document.querySelectorAll('#bulkResultSeg .seg').forEach((s) => {
      s.classList.toggle('active', s.dataset.result === state.bulk.resultKey);
    });
    updateBulkView();
    el('bulkModal').classList.remove('hidden');
    setTimeout(() => el('bulkTail').focus(), 200);
  }
  // ── เลือกหมวดหลายหมวดพร้อมกันในโหมดตรวจต่อเนื่อง ───────────────────────────
  function toggleCatPicker(ev) {
    if (ev) ev.stopPropagation();
    const panel = el('bulkCatPanel');
    const willOpen = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !willOpen);
    el('bulkCatBtn').classList.toggle('open', willOpen);
    if (willOpen) {
      el('bulkCatSearch').value = '';
      renderCatPicker();
      setTimeout(() => {
        el('bulkCatSearch').focus();
        panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 30);
    } else {
      el('bulkTail').focus();
    }
  }
  function closeCatPicker() {
    el('bulkCatPanel').classList.add('hidden');
    el('bulkCatBtn').classList.remove('open');
    el('bulkTail').focus();
  }
  function renderCatPicker() {
    const counts = catCounts();
    const q = (el('bulkCatSearch').value || '').trim().toUpperCase();
    const cats = Object.keys(counts).sort().filter((c) => !q || c.indexOf(q) >= 0);
    el('bulkCatList').innerHTML = cats.length ? cats.map((c) => {
      const on = state.bulk.cats.indexOf(c) >= 0;
      return '<button type="button" class="combo-item multi-item' + (on ? ' on' : '') +
        '" data-cat="' + esc(c) + '" onclick="App.toggleCat(\'' + esc(c) + '\')">' +
        '<span class="multi-box">' + (on ? '✓' : '') + '</span>' +
        '<span class="mono">RT-' + esc(c) + '</span>' +
        '<small>' + counts[c] + ' รายการ</small></button>';
    }).join('') : '<p class="combo-empty">ไม่พบหมวดที่ตรงกับคำค้น</p>';
    updateCatLabel();
  }
  function toggleCat(c) {
    const i = state.bulk.cats.indexOf(c);
    if (i >= 0) {
      if (state.bulk.cats.length === 1) {
        // เอาออกหมดไม่ได้ ต้องเหลืออย่างน้อย 1 หมวดไว้ทำ prefix
        toast('ต้องเลือกอย่างน้อย 1 หมวด — เลือกหมวดใหม่ก่อนแล้วค่อยเอาหมวดนี้ออก', 'warn');
        return;
      }
      state.bulk.cats.splice(i, 1);
    } else {
      state.bulk.cats.push(c);
    }
    cacheSet('avBulkCats_' + state.ui.type, state.bulk.cats);
    state.bulk.count = 0;
    renderCatPicker();
    updateBulkView();
  }
  function pickAllCats(on) {
    const cats = Object.keys(catCounts()).sort();
    state.bulk.cats = on ? cats : cats.slice(0, 1);
    cacheSet('avBulkCats_' + state.ui.type, state.bulk.cats);
    renderCatPicker();
    updateBulkView();
  }
  function updateCatLabel() {
    const n = state.bulk.cats.length;
    el('bulkCatLabel').textContent = n === 1
      ? 'RT-' + state.bulk.cats[0]
      : 'เลือกไว้ ' + n + ' หมวด';
    el('bulkCatChips').innerHTML = state.bulk.cats.slice().sort().map((c) =>
      '<span class="cat-chip mono">RT-' + esc(c) +
      '<button type="button" title="เอาออก" onclick="App.toggleCat(\'' + esc(c) + '\')">✕</button></span>'
    ).join('');
  }
  function setBulkResult(key) {
    state.bulk.resultKey = key;
    cacheSet('avBulkResult', key);
    document.querySelectorAll('#bulkResultSeg .seg').forEach((s) => {
      s.classList.toggle('active', s.dataset.result === key);
    });
    el('bulkTail').focus();
  }
  function updateBulkView() {
    const cats = state.bulk.cats;
    el('bulkPrefix').textContent = cats.length === 1 ? 'RT-' + cats[0] + '-' : 'RT-•••-';
    el('bulkPrefix').classList.toggle('multi', cats.length > 1);
    const list = mastersOfType().filter((a) => cats.indexOf(a.categoryCode) >= 0);
    let done = 0;
    list.forEach((a) => {
      if (classify(state.latest.get(a.inventoryNumber)) !== 'pending') done++;
    });
    el('bulkCounter').textContent = 'ตรวจแล้ว ' + done + ' / ' + list.length +
      (cats.length === 1 ? ' รายการในหมวดนี้' : ' รายการใน ' + cats.length + ' หมวดที่เลือก') +
      (state.bulk.count ? ' · รอบนี้ ' + state.bulk.count + ' รายการ' : '');
    updateCatLabel();
    updateTailHint();
    renderBulkRecent();
  }
  const hhmm = (iso) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  };
  /**
   * รายการที่เพิ่งบันทึกในหมวดที่เลือก — โหมดต่อเนื่องพิมพ์เร็วมาก พิมพ์ผิดตัวเดียว
   * ต้องเห็นและแก้ได้ตรงนั้นเลย ไม่ต้องปิดหน้าไปหาในตาราง
   */
  function bulkRecentLogs() {
    const cats = state.bulk.cats;
    if (!cats.length) return [];
    return allLogs()
      .filter((l) => cats.indexOf(catOf(l.inventoryNumber)) >= 0)
      .sort((a, b) => String(b.verifiedAt).localeCompare(String(a.verifiedAt)))
      .slice(0, 8);
  }
  function renderBulkRecent() {
    const rows = bulkRecentLogs();
    const me = inspectorName();
    el('bulkLast').innerHTML = rows.length
      ? '<p class="brec-head">' + icon('clock') + ' บันทึกล่าสุด — แตะที่เลขเพื่อใส่กลับในช่อง · ' +
        icon('trash') + ' ลบเพื่อบันทึกใหม่</p>' +
        rows.map((l) => {
          const cls = classify(l);
          return '<div class="brec">' +
            '<button type="button" class="brec-main" data-code="' + esc(l.inventoryNumber) + '">' +
              '<b class="mono">' + esc(l.inventoryNumber) + '</b>' +
              '<span class="pill st-' + cls + '">' + esc(statusLabel(l)) + '</span>' +
              '<small>' + esc(hhmm(l.verifiedAt)) +
                (Number(l.pieceNo) > 1 ? ' · ชิ้นที่ ' + l.pieceNo : '') +
                (l.inspector && l.inspector !== me ? ' · ' + esc(l.inspector) : '') +
                (l.pending ? ' · รอส่ง' : '') + '</small>' +
            '</button>' +
            (canEditLog(l)
              ? '<button type="button" class="brec-del" data-log="' + esc(l.logId) +
                '" title="ลบรายการนี้">' + icon('trash') + '</button>'
              : '') +
            '</div>';
        }).join('')
      : '<p class="hint">ยังไม่มีการบันทึกในหมวดที่เลือก</p>';
  }
  /** ใส่เลขท้ายของรหัสกลับลงช่องกรอก เพื่อบันทึกซ้ำ/แก้ผลได้ทันที */
  function bulkUseCode(code) {
    const tail = String(code || '').split('-').slice(2).join('-');
    if (!tail) return;
    el('bulkTail').value = tail;
    updateTailHint();
    el('bulkTail').focus();
  }
  async function bulkDeleteLog(logId) {
    const row = allLogs().find((l) => String(l.logId) === String(logId));
    if (!row) return;
    const code = row.inventoryNumber;
    await deleteLogEntry(logId);                    // ถามยืนยัน + เช็คสิทธิ์ในตัว
    updateBulkView();
    if (!allLogs().some((l) => String(l.logId) === String(logId))) bulkUseCode(code);
  }
  /**
   * แปลงเลขท้ายเป็น RT code — รองรับเลือกหลายหมวดพร้อมกัน
   * คืน { code } ถ้าชัดเจน · { candidates } ถ้ามีอยู่จริงหลายหมวด · {} ถ้ารูปแบบผิด
   */
  function bulkCodesFromTail(raw) {
    let s = String(raw || '').toUpperCase().replace(/[–—]/g, '-').replace(/\s+/g, '');
    if (!s) return {};
    const full = s.match(INV_RE);
    if (full) return { code: full[0] };            // วาง/สแกนรหัสเต็มมาเลย
    s = s.replace(/^-+/, '').replace(/-+$/, '');
    // เลขท้าย: ตัวเลข 1-4 หลัก (เติมศูนย์เป็น 4) หรือ ตัวอักษร + เลข 1-3 หลัก เช่น N102 / N12 → N012
    const m = s.match(/^([A-Z0-9]{2})-?([A-Z]\d{1,3}|\d{1,4})$/);
    if (!m) return {};
    const t = m[2];
    const tail = m[1] + '-' + (/^[A-Z]/.test(t) ? t[0] + t.slice(1).padStart(3, '0') : t.padStart(4, '0'));
    const all = state.bulk.cats.map((c) => 'RT-' + c + '-' + tail);
    // เลือกเฉพาะรหัสที่มีอยู่จริงในทะเบียนรอบนี้ — เหลือตัวเดียวก็ใช้ได้เลยไม่ต้องถาม
    const exist = all.filter((code) => state.master.some((a) => a.inventoryNumber === code));
    if (exist.length === 1) return { code: exist[0] };
    if (exist.length > 1) return { candidates: exist };
    return { code: all[0], missing: all };
  }
  /** ชื่อหมวดจาก RT code (RT-APRX-26-0001 → APRX) */
  function catOf(code) { return String(code || '').split('-')[1] || '?'; }
  /**
   * ถามว่าเลขท้ายนี้หมายถึงหมวดไหน (เมื่อมีอยู่จริงมากกว่า 1 หมวด)
   * ระบบไม่เลือกให้เอง — เรียงตามชื่อหมวดเสมอ ลำดับปุ่มจะได้ไม่สลับไปมา
   */
  function pickCode(candidates) {
    return new Promise((resolve) => {
      const list = candidates.slice().sort();
      state.pickKeys = list;
      el('pickSub').textContent = 'เลขท้ายนี้มีอยู่จริง ' + list.length +
        ' หมวด — ระบบไม่เดาให้ เลือกหมวดที่กำลังตรวจอยู่ (กดเลข 1-' + list.length + ' ก็ได้)';
      el('pickList').innerHTML = list.map((code, i) => {
        const a = state.master.find((x) => x.inventoryNumber === code);
        const l = state.latest.get(code);
        const pieces = piecesOf(code).length;
        return '<button class="dup-btn pick-btn" type="button" data-code="' + esc(code) + '">' +
          '<span class="pick-num">' + (i + 1) + '</span>' +
          '<span class="pick-body">' +
            '<b class="mono">' + esc(code) + '</b>' +
            '<small>' + esc(a && a.description ? a.description : '(ไม่มีคำอธิบาย)') + '</small>' +
            '<span class="pill st-' + (l ? classify(l) : 'pending') + '">' +
            (l ? esc(statusLabel(l)) + (pieces > 1 ? ' · ' + pieces + ' ชิ้น' : '') : 'ยังไม่ตรวจ') +
            '</span>' +
          '</span></button>';
      }).join('') + '<button class="outline-button" type="button" data-code="">ยกเลิก (Esc)</button>';
      state.pickResolve = (v) => {
        document.removeEventListener('keydown', onPickKey, true);
        el('pickModal').classList.add('hidden');
        state.pickResolve = null;
        state.pickKeys = null;
        resolve(v);
      };
      document.addEventListener('keydown', onPickKey, true);
      el('pickModal').classList.remove('hidden');
      try { el('bulkTail').blur(); } catch (e) {}   // กันเลขที่กดเลือกหลุดลงช่องกรอก
    });
  }
  /** กดเลข 1-9 เลือกหมวด · Esc ยกเลิก (ให้ตรวจต่อเนื่องได้เร็วโดยไม่ต้องละมือ) */
  function onPickKey(ev) {
    if (!state.pickResolve || !state.pickKeys) return;
    if (ev.key === 'Escape') { ev.preventDefault(); return pickChoose(null); }
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= state.pickKeys.length) {
      ev.preventDefault();
      pickChoose(state.pickKeys[n - 1]);
    }
  }
  function pickChoose(code) { if (state.pickResolve) state.pickResolve(code || null); }
  /** บอกล่วงหน้าว่าเลขที่พิมพ์อยู่จะไปลงหมวดไหน — ไม่ต้องรอกดบันทึกถึงจะรู้ */
  function updateTailHint() {
    const box = el('bulkMatch');
    if (!box) return;
    const raw = String(el('bulkTail').value || '').trim();
    box.className = 'bulk-match';
    if (!raw) { box.innerHTML = ''; return; }
    const hit = bulkCodesFromTail(raw);
    if (hit.candidates) {
      box.className = 'bulk-match warn';
      box.innerHTML = icon('alert') + ' เลขนี้มีอยู่ ' + hit.candidates.length + ' หมวด (' +
        esc(hit.candidates.slice().sort().map(catOf).join(', ')) + ') — กดบันทึกแล้วเลือกหมวดก่อน';
      return;
    }
    if (hit.missing) {
      box.className = 'bulk-match bad';
      box.innerHTML = icon('close') + ' ไม่พบเลขนี้ในหมวดที่เลือก (' +
        esc(hit.missing.map(catOf).join(', ')) + ')';
      return;
    }
    if (!hit.code) { box.innerHTML = ''; return; }
    const a = state.master.find((x) => x.inventoryNumber === hit.code);
    const l = state.latest.get(hit.code);
    box.className = 'bulk-match ok';
    box.innerHTML = icon('check') + ' จะบันทึกเป็น <b class="mono">' + esc(hit.code) + '</b>' +
      (a && a.description ? ' · ' + esc(a.description) : '') +
      (l ? ' · <b>ตรวจแล้ว (' + esc(statusLabel(l)) + ')</b>' : '');
  }
  /**
   * จัดรูปแบบช่องกรอกเลขท้ายให้เอง: พิมพ์ 262222 → แสดง 26-2222
   * (เก็บเฉพาะ A-Z 0-9 สูงสุด 6 ตัว แล้วแทรกขีดหลังตัวที่ 2)
   */
  let bulkAutoTimer = null;
  function formatBulkTail(input) {
    const raw = String(input.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    input.value = raw.length > 2 ? raw.slice(0, 2) + '-' + raw.slice(2) : raw;
    updateTailHint();
    clearTimeout(bulkAutoTimer);
    if (state.bulk.auto && raw.length === 6) {
      // ครบ 2+4 ตัวแล้วบันทึกให้เอง (แป้นตัวเลขบนมือถือไม่มีปุ่ม Enter)
      bulkAutoTimer = setTimeout(() => {
        if (!el('bulkModal').classList.contains('hidden')) bulkSubmit();
      }, 320);
    }
  }
  /** ใส่ปีเป็น YY (แป้นตัวเลขพิมพ์ตัวอักษรไม่ได้) */
  function insertYY() {
    const input = el('bulkTail');
    const raw = String(input.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    input.value = 'YY' + (raw.length > 2 ? '-' + raw.slice(2, 6) : '-');
    input.focus();
    const end = input.value.length;
    try { input.setSelectionRange(end, end); } catch (e) {}
  }
  /** ใส่ N หน้าเลข 3 หลัก (รหัสแบบ RT-PSFX-18-N102) — แป้นตัวเลขบนมือถือพิมพ์ตัวอักษรไม่ได้ */
  function insertN() {
    const input = el('bulkTail');
    const raw = String(input.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.length < 2) {
      toast('พิมพ์เลขปี 2 หลักก่อน (เช่น 18) แล้วค่อยกด "ใส่ N"', 'warn');
      input.focus();
      return;
    }
    input.value = raw.slice(0, 2) + 'N' + raw.slice(2).replace(/[A-Z]/g, '').slice(0, 3);
    formatBulkTail(input);                           // ใส่ขีด + อัปเดตคำใบ้ + บันทึกเองถ้าครบแล้ว
    input.focus();
    const end = input.value.length;
    try { input.setSelectionRange(end, end); } catch (e) {}
  }
  function setBulkAuto(on) {
    state.bulk.auto = Boolean(on);
    cacheSet('avBulkAuto', state.bulk.auto);
    el('bulkTail').focus();
  }
  /** กันบันทึกซ้อน: ระหว่างที่ยังถามหมวด/ถามจำนวนชิ้นอยู่ ห้ามเริ่มรอบใหม่ */
  async function bulkSubmit() {
    if (state.bulk.busy) return;
    state.bulk.busy = true;
    clearTimeout(bulkAutoTimer);
    try {
      await bulkSubmitOne();
    } finally {
      state.bulk.busy = false;
    }
  }
  async function bulkSubmitOne() {
    const tailEl = el('bulkTail');
    const hit = bulkCodesFromTail(tailEl.value);
    let code = hit.code;
    if (hit.candidates) {
      code = await pickCode(hit.candidates);       // เลขนี้มีอยู่หลายหมวด ให้เลือก
      if (!code) { tailEl.focus(); return; }
    }
    if (!code) return toast('รูปแบบไม่ถูกต้อง — กรอกส่วนท้าย เช่น 26-0001 หรือ 260001', 'warn');
    const asset = state.master.find((a) => a.inventoryNumber === code);
    if (!asset) {
      const tried = hit.missing && hit.missing.length > 1
        ? 'ไม่พบเลขนี้ในหมวดที่เลือก (' + hit.missing.map((c) => c.split('-')[1]).join(', ') + ')'
        : 'ไม่พบ ' + code + ' ในทะเบียนรอบนี้';
      return toast(tried + ' — ตรวจเลขอีกครั้ง หรือใช้ "นอกทะเบียน"', 'error');
    }
    const pieceNo = await resolvePiece(code);
    if (pieceNo === null) { tailEl.value = ''; updateTailHint(); tailEl.focus(); return; }
    const location = el('bulkLocation').value.trim();
    if (location) { cacheSet('avLastLocation', location); rememberArea(location); }
    try {
      await queueRecord({
        inventoryNumber: code, assetType: asset.assetType, pieceNo: pieceNo,
        resultKey: state.bulk.resultKey, method: 'MANUAL', locationText: location,
        gps: currentGeo()
      });
    } catch (e) {
      return toast('บันทึกลงเครื่องไม่ได้: ' + e.message, 'error');
    }
    fillAreaIfEmpty([code], location);    // โหมดต่อเนื่อง = ยืนอยู่โซนเดียว เติมให้ที่ยังว่าง
    state.bulk.count++;
    afterDataChange();
    updateBulkView();                     // รายการที่เพิ่งบันทึกจะขึ้นบนสุดของลิสต์เอง
    beep();
    tailEl.value = '';
    updateTailHint();
    tailEl.focus();
    flushQueue();
  }
  function closeBulk() {
    // ปิดกลางคันตอนกำลังถามหมวด/ถามจำนวนชิ้น — ปลดค้างให้เรียบร้อยก่อน
    if (state.pickResolve) state.pickResolve(null);
    if (state.dupResolve) state.dupResolve(null);
    state.bulk.busy = false;
    el('bulkModal').classList.add('hidden');
    updateSyncChip();
  }

  // ── โหมดนับจำนวน (ของที่ไม่ทราบ RT code) ───────────────────────────────────
  // เก็บแยกจากผลตรวจรายชิ้นโดยสิ้นเชิง — ไม่แตะสถานะของรหัสใดๆ
  // ใช้เทียบ "ทะเบียนมีกี่ชิ้น ↔ นับเจอจริงกี่ชิ้น" ในหมวดนั้น
  /** ชื่อหมวดที่แสดงผล — เติม RT- ให้เฉพาะรหัสหมวดจริง ไม่เติมให้หมวดที่พิมพ์เอง */
  function catLabel(cat) {
    const c = String(cat || '');
    return /^[A-Z0-9]{2,6}$/.test(c) ? 'RT-' + c : c;
  }
  /** สรุปรายหมวด: จำนวนในทะเบียน · ผลตรวจรายชิ้น · ยอดนับสะสม · ส่วนต่าง */
  function countSummary(type) {
    const t = type || state.ui.type;
    const map = {};
    const row = (c) => {
      if (!map[c]) {
        map[c] = { cat: c, total: 0, found: 0, notfound: 0, moved: 0, pending: 0, counted: 0, entries: 0 };
      }
      return map[c];
    };
    state.master.filter((a) => a.assetType === t).forEach((a) => {
      const g = row(a.categoryCode || '?');
      g.total++;
      g[classify(state.latest.get(a.inventoryNumber))]++;
    });
    allCounts().filter((c) => c.assetType === t).forEach((c) => {
      const g = row(c.categoryCode || '?');
      g.counted += Number(c.counted) || 0;
      g.entries++;
    });
    return Object.keys(map).sort().map((k) => map[k]);
  }
  function countEntriesOf(cat, type) {
    const t = type || state.ui.type;
    return allCounts()
      .filter((c) => c.assetType === t && c.categoryCode === cat)
      .sort((a, b) => String(b.countedAt).localeCompare(String(a.countedAt)));
  }
  function openCountSheet() {
    if (!state.canWrite) return;
    if (!state.activeSession) return toast('เลือกรอบตรวจก่อน', 'warn');
    const counts = catCounts();
    const cats = Object.keys(counts).sort();
    if (!cats.length) return toast('ยังไม่มีทะเบียนของประเภทนี้', 'warn');
    if (!state.count.cat || cats.indexOf(state.count.cat) < 0) state.count.cat = cats[0];
    el('countSub').textContent = state.ui.type === 'RENTAL' ? 'ทรัพย์สินของเช่า' : 'ทรัพย์สิน Fixed Assets';
    // หมวดที่เคยนับไว้แต่ไม่มีในทะเบียน (พิมพ์เอง) ให้ขึ้นในลิสต์ด้วย
    const extraCats = Array.from(new Set(allCounts()
      .filter((c) => c.assetType === state.ui.type && cats.indexOf(c.categoryCode) < 0)
      .map((c) => c.categoryCode))).sort();
    el('countCat').innerHTML = cats.map((c) =>
      '<option value="' + esc(c) + '">RT-' + esc(c) + ' — ทะเบียน ' + counts[c] + ' ชิ้น</option>').join('') +
      extraCats.map((c) =>
        '<option value="' + esc(c) + '">' + esc(c) + ' — นอกทะเบียน</option>').join('') +
      '<option value="__CUSTOM__">+ หมวดอื่น (พิมพ์เอง)</option>';
    el('countCat').value = state.count.cat;
    syncCombo('countCat');
    el('countCustomRow').classList.add('hidden');
    el('countCustom').value = '';
    el('countLocation').value = lastAreaOfMine();
    el('countNote').value = '';
    el('countN').value = '1';
    state.count.n = 1;
    state.count.photos = [];
    state.count.gps = currentGeo();            // มีพิกัดสดอยู่แล้วก็ใช้เลย ไม่ต้องกดขอ
    renderCountPhotos();
    renderCountGps();
    updateCountView();
    el('countModal').classList.remove('hidden');
  }
  function closeCount() {
    el('countModal').classList.add('hidden');
    updateSyncChip();
  }
  function setCountCat(v) {
    const custom = v === '__CUSTOM__';
    el('countCustomRow').classList.toggle('hidden', !custom);
    if (custom) {
      state.count.cat = el('countCustom').value.trim().toUpperCase();
      setTimeout(() => el('countCustom').focus(), 50);
    } else {
      state.count.cat = v;
    }
    updateCountView();
  }
  /** หมวดที่ไม่มีในทะเบียน — พิมพ์เองได้ (ของที่ไม่ทราบทั้งรหัสและหมวด) */
  function setCountCustom(v) {
    state.count.cat = String(v || '').trim().toUpperCase();
    updateCountView();
  }
  function adjustCount(delta) {
    const input = el('countN');
    const n = Math.max(0, (parseInt(input.value, 10) || 0) + delta);
    input.value = String(n);
    state.count.n = n;
  }
  function updateCountView() {
    const cat = state.count.cat;
    const g = countSummary().find((x) => x.cat === cat) ||
      { total: 0, counted: 0, found: 0, notfound: 0, pending: 0, moved: 0 };
    const diff = g.total - g.counted;
    el('countCompare').innerHTML =
      (cat && g.total === 0
        ? '<p class="warn-inline">หมวด "' + esc(cat) + '" ไม่มีในทะเบียนรอบนี้ — ' +
          'ยอดที่นับจะถูกเก็บเป็นของนอกทะเบียนไว้เทียบต่างหาก</p>'
        : '') +
      '<div class="cmp-grid">' +
        '<div class="cmp-cell"><b>' + g.total + '</b><small>ทะเบียนหมวดนี้</small></div>' +
        '<div class="cmp-cell ok"><b>' + g.counted + '</b><small>นับเจอสะสม</small></div>' +
        '<div class="cmp-cell ' + (diff > 0 ? 'bad' : (diff < 0 ? 'warn' : 'ok')) + '"><b>' +
          (diff > 0 ? diff : (diff < 0 ? '+' + Math.abs(diff) : 0)) + '</b><small>' +
          (diff > 0 ? 'ยังไม่เจอ' : (diff < 0 ? 'เกินทะเบียน' : 'ครบพอดี')) + '</small></div>' +
      '</div>' +
      '<p class="hint">ตรวจรายชิ้นในหมวดนี้แล้ว: พบ <b>' + g.found + '</b> · ไม่พบ <b>' + g.notfound +
      '</b> · ย้ายออก <b>' + g.moved + '</b> · ยังไม่ตรวจ <b>' + g.pending + '</b> ' +
      '(ยอดนับด้านบนเป็นคนละส่วนกัน ไม่กระทบผลรายชิ้น)</p>';
    const list = countEntriesOf(cat);
    el('countHistory').innerHTML = list.length
      ? list.map((c) => {
        const nPhoto = (c.photoPaths || []).length || c.photoCount || 0;
        const hasGps = c.gpsLat != null && c.gpsLng != null;
        return '<div class="count-row">' +
          '<div><b>' + (Number(c.counted) || 0) + ' ชิ้น</b>' +
          (c.locationText ? ' · ' + esc(c.locationText) : '') +
          (c.note ? ' · ' + esc(c.note) : '') +
          '<small>' + esc(thaiDT(c.countedAt)) + ' · ' + esc(c.inspector || '') +
          (c.pending ? ' · รอส่ง' : '') + '</small>' +
          (nPhoto || hasGps ? '<div class="count-tags">' +
            (nPhoto ? '<button type="button" class="chip mini" onclick="App.openCountPhotos(\'' +
              esc(c.countId) + '\')">' + icon('camera') + ' ' + nPhoto + ' รูป</button>' : '') +
            (hasGps ? '<a class="gps-link" target="_blank" rel="noopener" ' +
              'href="https://www.google.com/maps/search/?api=1&query=' +
              encodeURIComponent(c.gpsLat + ',' + c.gpsLng) + '">' + icon('pin') + ' ดูพิกัด' +
              (c.gpsAccuracy ? ' ±' + Math.round(c.gpsAccuracy) + ' ม.' : '') + '</a>' : '') +
            '</div>' : '') +
          '</div>' +
          (canEditCount(c) ? '<button class="qbtn del" type="button" title="ลบยอดนี้" ' +
            'onclick="App.deleteCountEntry(\'' + esc(c.countId) + '\')">' + icon('trash') + '</button>' : '') +
          '</div>';
      }).join('')
      : '<p class="hint">ยังไม่มีการนับในหมวดนี้</p>';
  }
  const COUNT_CLASH_WINDOW = 10 * 60 * 1000;
  /** ยอดล่าสุดของคนอื่น ในหมวดและพื้นที่เดียวกัน ภายใน 10 นาที (null = ไม่มี) */
  function recentCountClash(cat, location) {
    const me = inspectorName();
    const loc = String(location || '').trim().toLowerCase();
    const now = Date.now();
    return allCounts().filter((c) =>
      c.assetType === state.ui.type && c.categoryCode === cat &&
      (c.inspector || '') !== me &&
      String(c.locationText || '').trim().toLowerCase() === loc &&
      now - new Date(c.countedAt).getTime() < COUNT_CLASH_WINDOW)
      .sort((a, b) => String(a.countedAt).localeCompare(String(b.countedAt))).pop() || null;
  }
  // ── รูปถ่าย + พิกัดของยอดนับ (ใช้เป็นหลักฐานว่านับกองไหน ตรงไหน) ──────────
  async function addCountPhotos(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    state.count.photos = state.count.photos || [];
    if (state.count.photos.length + files.length > 5) {
      return toast('แนบได้สูงสุด 5 รูปต่อการนับ 1 ครั้ง', 'warn');
    }
    busy('กำลังย่อรูป...');
    try {
      for (let i = 0; i < files.length; i++) {
        const dataUrl = await resizeImage(files[i], 1280, 0.82);   // ขนาดเดียวกับรูปผลตรวจ
        state.count.photos.push({ dataUrl: dataUrl });
      }
      renderCountPhotos();
    } catch (e) {
      toast(e.message, 'error');
    } finally { busyHide(); }
  }
  function removeCountPhoto(i) {
    (state.count.photos || []).splice(i, 1);
    renderCountPhotos();
  }
  function renderCountPhotos() {
    const strip = el('countPhotoStrip');
    if (!strip) return;
    strip.innerHTML = (state.count.photos || []).map((p, i) =>
      '<div class="photo-thumb"><img src="' + p.dataUrl + '" alt="">' +
      '<button type="button" onclick="App.removeCountPhoto(' + i + ')">' + icon('close') +
      '</button></div>').join('');
  }
  function renderCountGps() {
    const line = el('countGpsLine');
    if (!line) return;
    const g = state.count.gps;
    line.className = 'gps-line' + (g ? ' ok' : '');
    line.innerHTML = icon('pin') + (g
      ? ' พิกัดพร้อมบันทึก (±' + g.acc + ' ม.)'
      : ' ยังไม่มีพิกัด — แตะปุ่มข้างๆ เพื่อขอตำแหน่ง (ข้ามได้ ไม่บังคับ)');
  }
  /** ปุ่มขอพิกัดของหน้านับจำนวน — กดได้เรื่อยๆ แม้เคยกดไม่อนุญาตไปแล้ว */
  async function grabCountGps() {
    const line = el('countGpsLine');
    line.className = 'gps-line';
    line.innerHTML = icon('pin') + ' กำลังขอพิกัด...';
    try {
      const g = await askGeo();
      state.count.gps = g;
      state.geo = { lat: g.lat, lng: g.lng, acc: g.acc, at: Date.now() };
      state.geoDenied = false;
      startGeoWatch();
      renderCountGps();
    } catch (err) {
      if (err && err.code === 1) state.geoDenied = true;
      line.className = 'gps-line bad';
      line.innerHTML = icon('pin') + ' ' + esc(geoErrText(err));
    }
  }
  /** เปิดดูรูปของยอดนับครั้งนั้น (ใช้ตัวดูรูปตัวเดียวกับผลตรวจรายชิ้น) */
  async function openCountPhotos(countId) {
    const c = allCounts().find((x) => String(x.countId) === String(countId));
    if (!c) return;
    let items = [];
    if (c.pending) {
      const q = state.queueItems.find((x) => x.clientId === c.clientId);
      items = ((q && q.photos) || []).map((p) => p.dataUrl).filter(Boolean);
    } else {
      const paths = c.photoPaths || [];
      if (!paths.length) return toast('การนับครั้งนี้ไม่มีรูป', 'warn');
      try {
        busy('กำลังเปิดรูป...');
        const urls = await AssetStore.photoUrls(paths);
        items = paths.map((p) => urls[p]).filter(Boolean);
      } catch (e) {
        return toast('เปิดรูปไม่ได้: ' + e.message, 'error');
      } finally { busyHide(); }
    }
    if (!items.length) return toast('เปิดรูปไม่ได้ (อาจถูกลบไปแล้ว)', 'warn');
    state.photos = { items: items, i: 0, log: null };
    el('photoTitle').textContent = catLabel(c.categoryCode) + ' · ' + (Number(c.counted) || 0) + ' ชิ้น';
    el('photoSub').textContent = (c.locationText ? c.locationText + ' · ' : '') +
      (c.inspector || '') + ' · ' + thaiDT(c.countedAt) + (c.pending ? ' · ยังไม่ได้ส่ง' : '');
    renderPhotoView();
    el('photoModal').classList.remove('hidden');
  }
  function canEditCount(c) {
    if (!state.profile) return false;
    if (state.profile.role === 'admin') return true;
    if (c.pending) return true;
    return Boolean(c.createdBy && c.createdBy === state.profile.id);
  }
  async function saveCountEntry() {
    const s = state.activeSession;
    if (!s) return toast('เลือกรอบตรวจก่อน', 'warn');
    // ช่องพิมพ์เองเปิดอยู่ = ใช้ค่าที่พิมพ์เสมอ (กันกรณี select ยังค้างค่าเดิม)
    const custom = !el('countCustomRow').classList.contains('hidden');
    const cat = custom ? el('countCustom').value.trim().toUpperCase() : el('countCat').value;
    const n = parseInt(el('countN').value, 10);
    if (!cat || cat === '__CUSTOM__') return toast('เลือกหมวด หรือพิมพ์ชื่อหมวดเองก่อน', 'warn');
    if (!(n > 0)) return toast('กรอกจำนวนที่นับได้ (มากกว่า 0)', 'warn');
    const location = el('countLocation').value.trim();
    if (location) cacheSet('avLastLocation', location);
    // ยอดนับเป็นการ "บวกสะสม" ถ้าเพื่อนเพิ่งนับกองเดียวกันไป การบันทึกต่อ = นับซ้ำ
    const clash = recentCountClash(cat, location);
    if (clash && !window.confirm(
      (clash.inspector || 'ผู้ตรวจคนอื่น') + ' เพิ่งนับหมวด ' + catLabel(cat) + ' ไป ' +
      clash.counted + ' ชิ้น' + (clash.locationText ? ' ที่ "' + clash.locationText + '"' : '') +
      ' เมื่อ ' + thaiDT(clash.countedAt) + '\n\n' +
      'ยอดของคุณจะถูกบวกเพิ่มจากยอดเดิม (ไม่ใช่แทนที่) — ถ้าเป็นกองเดียวกันจะกลายเป็นนับซ้ำ\n\n' +
      'ยืนยันบันทึกต่อ?')) return;
    const g = state.count.gps || currentGeo();
    const item = {
      kind: 'count', clientId: AssetStore.uuid(), sessionId: s.sessionId, site: s.site,
      assetType: state.ui.type, categoryCode: cat, counted: n,
      locationText: location, note: el('countNote').value.trim(),
      inspector: inspectorName(), countedAt: new Date().toISOString(),
      photos: (state.count.photos || []).map((p) => ({ dataUrl: p.dataUrl })),
      gpsLat: g ? g.lat : null, gpsLng: g ? g.lng : null, gpsAccuracy: g ? g.acc : null
    };
    try {
      await qPut(item);
    } catch (e) {
      return toast('บันทึกลงเครื่องไม่ได้: ' + e.message, 'error');
    }
    state.queueItems.push(item);
    beep();
    el('countN').value = '1';
    el('countNote').value = '';
    state.count.cat = cat;
    afterDataChange();
    updateCountView();
    toast('บันทึกยอดนับ ' + n + ' ชิ้น หมวด ' + catLabel(cat), 'success');
    flushQueue();
  }
  async function deleteCountEntry(id) {
    const all = allCounts();
    const row = all.find((c) => String(c.countId) === String(id));
    if (!row) return;
    if (!canEditCount(row)) return toast('ลบได้เฉพาะยอดที่ตัวเองบันทึก (หรือให้ผู้ดูแลลบให้)', 'warn');
    if (!window.confirm('ลบยอดนับ ' + row.counted + ' ชิ้น ของหมวด ' + catLabel(row.categoryCode) + '?')) return;
    try {
      if (String(id).indexOf('pending-') === 0) {
        const cid = String(id).slice('pending-'.length);
        await qDel(cid);
        state.queueItems = state.queueItems.filter((q) => q.clientId !== cid);
      } else {
        await AssetStore.deleteCount(id);
        state.counts = state.counts.filter((c) => c.countId !== id);
        if (state.activeSession) cacheSet('avCounts_' + state.activeSession.sessionId, state.counts);
      }
      afterDataChange();
      updateCountView();
      toast('ลบยอดนับแล้ว', 'success');
    } catch (e) {
      toast('ลบไม่สำเร็จ: ' + e.message, 'error');
    }
  }

  // ── หน้าประวัติการบันทึก (ตามหา/แก้รายการที่บันทึกผิด) ──────────────────────
  function canEditLog(l) {
    if (!state.profile) return false;
    if (state.profile.role === 'admin') return true;
    if (l.pending) return true;
    return Boolean(l.createdBy && l.createdBy === state.profile.id);
  }
  function actRows() {
    let rows = allLogs().slice();
    const a = state.act;
    if (a.who) rows = rows.filter((l) => (l.inspector || '') === a.who);
    if (a.result) {
      rows = rows.filter((l) => (a.result === 'FOUND' ? l.result === 'FOUND' : l.result === a.result));
    }
    if (a.range) {
      const now = Date.now();
      const span = a.range === 'today' ? 0 : Number(a.range);
      rows = rows.filter((l) => {
        const t = new Date(l.verifiedAt).getTime();
        if (a.range === 'today') return new Date(l.verifiedAt).toDateString() === new Date().toDateString();
        return now - t <= span * 86400000;
      });
    }
    if (a.q) {
      const q = a.q.trim().toUpperCase();
      rows = rows.filter((l) => (l.inventoryNumber || '').toUpperCase().indexOf(q) >= 0 ||
        (l.unlistedDesc || '').toUpperCase().indexOf(q) >= 0 ||
        (l.locationText || '').toUpperCase().indexOf(q) >= 0);
    }
    rows.sort((x, y) => (a.sort === 'old'
      ? String(x.verifiedAt).localeCompare(String(y.verifiedAt))
      : String(y.verifiedAt).localeCompare(String(x.verifiedAt))));
    return rows;
  }
  function renderActivity() {
    if (!state.activeSession) { el('actList').innerHTML = ''; return; }
    // ตัวเลือกผู้บันทึกจากข้อมูลจริง
    const people = Array.from(new Set(allLogs().map((l) => l.inspector).filter(Boolean))).sort();
    const sel = el('actWho');
    const cur = state.act.who;
    sel.innerHTML = '<option value="">ผู้บันทึก: ทุกคน</option>' +
      people.map((p) => '<option value="' + esc(p) + '">' + esc(p) + '</option>').join('');
    sel.value = people.indexOf(cur) >= 0 ? cur : '';
    if (sel.value !== cur) state.act.who = sel.value;
    syncCombo('actWho');
    const rows = actRows();
    el('actCount').textContent = rows.length + ' รายการ';
    const show = rows.slice(0, 300);
    el('actList').innerHTML = show.length ? show.map((l) => {
      const cls = classify(l);
      const asset = state.master.find((a) => a.inventoryNumber === l.inventoryNumber);
      const editable = canEditLog(l);
      return '<div class="act-row st-' + cls + '">' +
        '<div class="act-main">' +
          '<div class="act-top"><b class="mono">' + esc(l.inventoryNumber || '(นอกทะเบียน)') + '</b>' +
            statusCell(l) + (l.pieceNo > 1 ? '<span class="dup-badge">ชิ้นที่ ' + l.pieceNo + '</span>' : '') +
            (l.pending ? '<span class="pill st-pending">รอส่ง</span>' : '') + '</div>' +
          '<div class="act-desc">' + esc(asset ? (asset.description || '') : (l.unlistedDesc || '')) + '</div>' +
          '<div class="act-meta">' + icon('clock') + ' ' + esc(thaiDT(l.verifiedAt)) +
            ' · ' + icon('user') + ' ' + esc(l.inspector || '-') +
            ' · ' + esc(l.method || '') +
            (l.locationText ? ' · ' + icon('pin') + ' ' + esc(l.locationText) : '') +
            (l.note ? ' · ' + esc(l.note) : '') + '</div>' +
        '</div>' +
        '<div class="act-actions">' +
          (photoCountOf(l) ? '<button class="qbtn photo" type="button" title="ดูรูปที่ถ่ายไว้" ' +
            'onclick="App.openPhotos(\'' + esc(l.logId) + '\')">' + icon('camera') +
            '<b class="ph-n">' + photoCountOf(l) + '</b></button>' : '') +
          (asset ? '<button class="qbtn" type="button" title="เปิดแก้ไข/บันทึกใหม่" ' +
            'onclick="App.openAsset(\'' + esc(l.inventoryNumber) + '\')">' + icon('edit') + '</button>' : '') +
          (editable ? '<button class="qbtn del" type="button" title="ลบรายการที่บันทึกผิด" ' +
            'onclick="App.deleteLogEntry(\'' + esc(l.logId) + '\')">' + icon('trash') + '</button>' : '') +
        '</div>' +
      '</div>';
    }).join('') + (rows.length > show.length
      ? '<p class="hint">แสดง 300 รายการล่าสุดจากทั้งหมด ' + rows.length + ' — ใช้ตัวกรองเพื่อดูให้แคบลง</p>'
      : '')
      : '<p class="empty-note">ไม่พบการบันทึกตามเงื่อนไข</p>';
  }
  function setActWho(v) { state.act.who = v; renderActivity(); }
  function setActResult(v) { state.act.result = v; renderActivity(); }
  function setActRange(v) { state.act.range = v; renderActivity(); }
  function setActSort(v) { state.act.sort = v; renderActivity(); }
  function setActSearch(v) { state.act.q = v; renderActivity(); }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  function typeStats(type) {
    const list = state.master.filter((a) => a.assetType === type);
    const st = { total: list.length, pending: 0, found: 0, notfound: 0, moved: 0 };
    list.forEach((a) => { st[classify(state.latest.get(a.inventoryNumber))]++; });
    st.done = st.total - st.pending;
    return st;
  }
  function groupBars(list, keyFn) {
    const groups = {};
    list.forEach((a) => {
      const k = keyFn(a) || '(ไม่ระบุ)';
      groups[k] = groups[k] || { total: 0, done: 0 };
      groups[k].total++;
      if (classify(state.latest.get(a.inventoryNumber)) !== 'pending') groups[k].done++;
    });
    const keys = Object.keys(groups)
      .sort((a, b) => (groups[b].total - groups[b].done) - (groups[a].total - groups[a].done));
    if (!keys.length) return '<p class="hint">ไม่มีข้อมูล</p>';
    return keys.map((k) => {
      const g = groups[k];
      const pct = g.total ? Math.round(g.done * 100 / g.total) : 0;
      return '<div class="mini-bar-row"><span>' + esc(k) + '</span>' +
        '<div class="bar"><i class="' + (pct === 100 ? 'ok' : '') + '" style="width:' + pct +
        '%"></i></div><span>' + g.done + '/' + g.total + '</span></div>';
    }).join('');
  }
  function dashList(id, title, rows) {
    if (!rows.length) return '';
    return '<button class="collapse-head" type="button" data-coll="' + id + '">' +
      title + ' (' + rows.length + ') <span>▾</span></button>' +
      '<div id="coll-' + id + '" class="collapse-body hidden">' + rows.join('') + '</div>';
  }
  // ── ชิ้นส่วนกราฟ (วาดเองด้วย SVG/HTML ไม่ต้องโหลดไลบรารี) ────────────────────
  function donutSvg(parts, centerBig, centerSmall) {
    const total = parts.reduce((n, p) => n + p.value, 0) || 1;
    const R = 52, C = 2 * Math.PI * R;
    let offset = 0;
    const arcs = parts.filter((p) => p.value > 0).map((p) => {
      const len = (p.value / total) * C;
      const seg = '<circle class="donut-seg" cx="70" cy="70" r="' + R + '" fill="none" stroke="' +
        p.color + '" stroke-width="18" stroke-dasharray="' + len.toFixed(2) + ' ' +
        (C - len).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '"></circle>';
      offset += len;
      return seg;
    }).join('');
    return '<svg viewBox="0 0 140 140" class="donut" role="img">' +
      '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="var(--line-soft)" stroke-width="18"></circle>' +
      arcs +
      '<text x="70" y="66" class="donut-big">' + esc(centerBig) + '</text>' +
      '<text x="70" y="86" class="donut-small">' + esc(centerSmall) + '</text></svg>';
  }
  function legendRows(parts, total) {
    return '<div class="legend">' + parts.map((p) =>
      '<div class="legend-row"><span class="dot" style="background:' + p.color + '"></span>' +
      '<span class="legend-label">' + esc(p.label) + '</span>' +
      '<b class="mono">' + p.value + '</b>' +
      '<small>' + (total ? Math.round(p.value * 100 / total) : 0) + '%</small></div>').join('') + '</div>';
  }
  function dailyBars(logs) {
    const byDay = {};
    logs.forEach((l) => {
      const d = new Date(l.verifiedAt);
      if (isNaN(d.getTime())) return;
      const k = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
      byDay[k] = (byDay[k] || 0) + 1;
    });
    const keys = Object.keys(byDay).sort().slice(-14);
    if (!keys.length) return '<p class="hint">ยังไม่มีการตรวจในรอบนี้</p>';
    const max = Math.max.apply(null, keys.map((k) => byDay[k]));
    return '<div class="bar-chart">' + keys.map((k) => {
      const h = Math.max(Math.round(byDay[k] * 100 / max), 4);
      const d = new Date(k + 'T00:00:00');
      return '<div class="bar-col" title="' + esc(thaiD(k)) + ' — ' + byDay[k] + ' รายการ">' +
        '<span class="bar-val mono">' + byDay[k] + '</span>' +
        '<div class="bar-fill" style="height:' + h + '%"></div>' +
        '<span class="bar-lab">' + d.getDate() + '/' + (d.getMonth() + 1) + '</span></div>';
    }).join('') + '</div>';
  }
  function kpiCard(label, value, sub, tone) {
    return '<div class="kpi ' + (tone || '') + '">' +
      '<span class="kpi-label">' + esc(label) + '</span>' +
      '<span class="kpi-num mono">' + esc(String(value)) + '</span>' +
      '<span class="kpi-sub">' + sub + '</span></div>';
  }
  function renderDash() {
    const s = state.activeSession;
    if (!s) { el('dashContent').innerHTML = '<p class="empty-note">เลือกรอบตรวจก่อน</p>'; return; }
    el('dashTitle').textContent = 'สรุปผล: ' + s.site + (s.roundName ? ' · ' + s.roundName : '');
    const fx = typeStats('FIXED');
    const rn = typeStats('RENTAL');
    const fixedList = state.master.filter((a) => a.assetType === 'FIXED');
    const rentalList = state.master.filter((a) => a.assetType === 'RENTAL');
    const logs = allLogs();
    const all = {
      total: fx.total + rn.total, done: fx.done + rn.done, pending: fx.pending + rn.pending,
      found: fx.found + rn.found, notfound: fx.notfound + rn.notfound, moved: fx.moved + rn.moved
    };
    const pct = all.total ? Math.round(all.done * 100 / all.total) : 0;
    const unlistedLogs = logs.filter((l) => l.unregistered);
    const unlistedCodes = {};
    unlistedLogs.forEach((l) => { unlistedCodes[l.inventoryNumber] = true; });
    const extraCount = Object.keys(unlistedCodes).length;
    const parts = [
      { label: 'พบ', value: all.found, color: 'var(--ok)' },
      { label: 'ไม่พบ', value: all.notfound, color: 'var(--no)' },
      { label: 'ย้ายออก', value: all.moved, color: 'var(--mv)' },
      { label: 'ยังไม่ตรวจ', value: all.pending, color: 'var(--line)' }
    ];
    const recent = logs.slice().sort((a, b) => String(b.verifiedAt).localeCompare(String(a.verifiedAt)))
      .slice(0, 8).map((l) => {
        const a = state.master.find((m) => m.inventoryNumber === l.inventoryNumber);
        return '<tr><td class="mono nowrap">' + esc(l.inventoryNumber) + '</td>' +
          '<td>' + esc(a ? (a.description || '') : (l.unlistedDesc || 'นอกทะเบียน')) + '</td>' +
          '<td>' + statusCell(l) + '</td>' +
          '<td class="c-md">' + esc(l.inspector || '') + '</td>' +
          '<td class="c-md nowrap">' + esc(thaiDT(l.verifiedAt)) + '</td></tr>';
      }).join('');
    const byInspector = {};
    logs.forEach((l) => {
      const k = l.inspector || '(ไม่ระบุ)';
      byInspector[k] = (byInspector[k] || 0) + 1;
    });
    const inspectorRows = Object.keys(byInspector)
      .sort((a, b) => byInspector[b] - byInspector[a])
      .map((k) => '<div class="dash-list-item"><span>' + icon('user') + ' ' + esc(k) + '</span><b>' +
        byInspector[k] + ' ครั้ง</b></div>');
    const pendingRow = (a) => '<div class="dash-list-item" data-inv="' + esc(a.inventoryNumber) +
      '"><span class="mono">' + esc(a.inventoryNumber) + '</span><span>' +
      esc(a.description || '') + '</span></div>';
    const issueRow = (a, l) => '<div class="dash-list-item" data-inv="' + esc(a.inventoryNumber) +
      '"><span class="mono">' + esc(a.inventoryNumber) + '</span><span>' + esc(a.description || '') +
      '</span><b>' + esc(statusLabel(l)) + ' · ' + esc(l.inspector || '') + '</b></div>';
    const pendF = fixedList.filter((a) => classify(state.latest.get(a.inventoryNumber)) === 'pending');
    const pendR = rentalList.filter((a) => classify(state.latest.get(a.inventoryNumber)) === 'pending');
    const notFound = [];
    const moved = [];
    state.master.forEach((a) => {
      const l = state.latest.get(a.inventoryNumber);
      const c = classify(l);
      if (c === 'notfound') notFound.push(issueRow(a, l));
      if (c === 'moved') moved.push(issueRow(a, l));
    });
    const unl = unlistedLogs.slice()
      .sort((a, b) => String(b.verifiedAt).localeCompare(String(a.verifiedAt)))
      .map((l) => '<div class="dash-list-item"><span class="mono">' + esc(l.inventoryNumber) +
        '</span><span>' + esc(l.unlistedDesc || '') + '</span><b>' + esc(l.inspector || '') +
        ' · ' + esc(thaiDT(l.verifiedAt)) + '</b></div>');

    el('dashContent').innerHTML =
      '<div class="kpi-row">' +
        kpiCard('ทรัพย์สินทั้งหมด', all.total.toLocaleString(),
          'Fixed ' + fx.total + ' · ของเช่า ' + rn.total, '') +
        kpiCard('ตรวจแล้ว', all.done.toLocaleString(),
          '<b class="' + (pct >= 100 ? 'up' : '') + '">' + pct + '%</b> ของทั้งหมด · เหลือ ' +
          all.pending, 'tone-ok') +
        kpiCard('ไม่พบ', all.notfound.toLocaleString(),
          all.done ? Math.round(all.notfound * 100 / all.done) + '% ของที่ตรวจแล้ว' : 'ยังไม่มีข้อมูล',
          'tone-no') +
        kpiCard('ย้ายออก / พบเพิ่ม', all.moved + ' / ' + extraCount,
          'ย้ายไปไซต์อื่น ' + all.moved + ' · นอกทะเบียน ' + extraCount, 'tone-mv') +
      '</div>' +
      '<div class="dash-grid">' +
        '<div class="dash-card"><h4>สัดส่วนผลการตรวจ</h4>' +
          '<div class="donut-wrap">' + donutSvg(parts, pct + '%', 'ตรวจแล้ว') +
          legendRows(parts, all.total) + '</div></div>' +
        '<div class="dash-card"><h4>จำนวนที่ตรวจต่อวัน (14 วันล่าสุด)</h4>' +
          dailyBars(logs) + '</div>' +
        '<div class="dash-card"><h4>ความคืบหน้า — Fixed Assets</h4>' +
          '<div class="progress-line"><span>ตรวจแล้ว ' + fx.done + ' / ' + fx.total + '</span><span>' +
          (fx.total ? Math.round(fx.done * 100 / fx.total) : 0) + '%</span></div>' +
          '<div class="bar"><i style="width:' + (fx.total ? fx.done * 100 / fx.total : 0) + '%"></i></div>' +
          '<div class="stat-chips">' +
          '<span class="stat-chip st-found">พบ ' + fx.found + '</span>' +
          '<span class="stat-chip st-notfound">ไม่พบ ' + fx.notfound + '</span>' +
          '<span class="stat-chip st-moved">ย้ายออก ' + fx.moved + '</span>' +
          '<span class="stat-chip st-pending">ค้าง ' + fx.pending + '</span></div>' +
          '<h4 class="mt">ความคืบหน้า — ของเช่า</h4>' +
          '<div class="progress-line"><span>ตรวจแล้ว ' + rn.done + ' / ' + rn.total + '</span><span>' +
          (rn.total ? Math.round(rn.done * 100 / rn.total) : 0) + '%</span></div>' +
          '<div class="bar"><i style="width:' + (rn.total ? rn.done * 100 / rn.total : 0) + '%"></i></div>' +
          '<div class="stat-chips">' +
          '<span class="stat-chip st-found">พบ ' + rn.found + '</span>' +
          '<span class="stat-chip st-notfound">ไม่พบ ' + rn.notfound + '</span>' +
          '<span class="stat-chip st-moved">ย้ายออก ' + rn.moved + '</span>' +
          '<span class="stat-chip st-pending">ค้าง ' + rn.pending + '</span></div></div>' +
        '<div class="dash-card"><h4>ผลงานผู้ตรวจ</h4>' +
          (inspectorRows.join('') || '<p class="hint">ยังไม่มีการตรวจ</p>') + '</div>' +
        '<div class="dash-card"><h4>ตามหมวด — Fixed Assets</h4>' +
          groupBars(fixedList, (a) => 'RT-' + (a.categoryCode || '?')) + '</div>' +
        '<div class="dash-card"><h4>ตามหมวด — ของเช่า</h4>' +
          groupBars(rentalList, (a) => 'RT-' + (a.categoryCode || '?')) + '</div>' +
        '<div class="dash-card wide"><h4>ตามผู้รับผิดชอบ (Fixed Assets)</h4>' +
          groupBars(fixedList, (a) => (a.staffText || '').trim()) + '</div>' +
        (state.master.some((a) => (a.location || '').trim())
          ? '<div class="dash-card wide"><h4>' + icon('pin') + ' ตามพื้นที่จัดเก็บ</h4>' +
            groupBars(state.master, (a) => areaLabel(a.location) || '(ไม่ระบุพื้นที่)') + '</div>'
          : '') +
      '</div>' +
      '<div class="dash-card wide"><h4>รายการตรวจล่าสุด</h4>' +
        (recent ? '<div class="table-wrap flat"><table class="asset-table mini"><thead><tr>' +
          '<th>รหัส</th><th>ชื่อทรัพย์สิน</th><th>ผล</th><th class="c-md">ผู้ตรวจ</th>' +
          '<th class="c-md">เวลา</th></tr></thead><tbody>' + recent + '</tbody></table></div>'
          : '<p class="hint">ยังไม่มีการตรวจในรอบนี้</p>') + '</div>' +
      mapCard() +
      countCompareCard() +
      dashList('pf', icon('square') + ' ยังไม่ตรวจ — Fixed Assets', pendF.map(pendingRow)) +
      dashList('pr', icon('square') + ' ยังไม่ตรวจ — ของเช่า', pendR.map(pendingRow)) +
      dashList('nf', icon('close') + ' ไม่พบ', notFound) +
      dashList('mv', icon('truck') + ' ย้ายออกไปไซต์อื่น', moved) +
      dashList('un', icon('plus') + ' ทรัพย์สินนอกทะเบียน', unl);
    initMap();
  }
  function toggleSection(id) {
    const b = el('coll-' + id);
    if (b) b.classList.toggle('hidden');
  }

  // ── แผนที่จุดที่บันทึก (OpenStreetMap + Leaflet) ────────────────────────────
  const RESULT_PIN = {
    found: { color: '#2F7D5B', label: 'พบ' },
    notfound: { color: '#B0402F', label: 'ไม่พบ' },
    moved: { color: '#1B3A6B', label: 'ย้ายออก' }
  };
  function gpsLogs() {
    return allLogs().filter((l) => l.gpsLat != null && l.gpsLng != null &&
      !isNaN(Number(l.gpsLat)) && !isNaN(Number(l.gpsLng)));
  }
  /** ใช้ตัวกรองของแผนที่กับรายการที่มีพิกัด */
  function mapLogs() {
    const f = state.map;
    let rows = gpsLogs();
    if (f.who) rows = rows.filter((l) => (l.inspector || '') === f.who);
    if (f.range) {
      const now = Date.now();
      rows = rows.filter((l) => (f.range === 'today'
        ? new Date(l.verifiedAt).toDateString() === new Date().toDateString()
        : now - new Date(l.verifiedAt).getTime() <= Number(f.range) * 86400000));
    }
    if (f.area) {
      rows = rows.filter((l) => {
        const a = state.master.find((x) => x.inventoryNumber === l.inventoryNumber);
        const v = a ? (a.location || '').trim() : '';
        return f.area === '__NONE__' ? !v : v === f.area;
      });
    }
    return rows;
  }
  function mapCard() {
    const all = gpsLogs();
    const total = allLogs().length;
    const people = Array.from(new Set(gpsLogs().map((l) => l.inspector).filter(Boolean))).sort();
    const areas = Array.from(new Set(state.master.map((a) => (a.location || '').trim())
      .filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th'));
    const legend = Object.keys(RESULT_PIN).map((k) =>
      '<span class="map-leg"><i style="background:' + RESULT_PIN[k].color + '"></i>' +
      RESULT_PIN[k].label + '</span>').join('');
    return '<div class="dash-card wide"><h4>' + icon('pin') + ' แผนที่จุดที่บันทึก</h4>' +
      (all.length
        ? '<div class="map-tools">' +
            '<select id="mapWho" class="filter-select" onchange="App.setMapWho(this.value)">' +
              '<option value="">ผู้บันทึก: ทุกคน</option>' +
              people.map((p) => '<option value="' + esc(p) + '"' +
                (state.map.who === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('') +
            '</select>' +
            '<select id="mapRange" class="filter-select" onchange="App.setMapRange(this.value)">' +
              [['', 'ช่วงเวลา: ทั้งหมด'], ['today', 'วันนี้'], ['1', '24 ชั่วโมงล่าสุด'], ['7', '7 วันล่าสุด']]
                .map((o) => '<option value="' + o[0] + '"' +
                  (state.map.range === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') +
            '</select>' +
            (areas.length ? '<select id="mapArea" class="filter-select" onchange="App.setMapArea(this.value)">' +
              '<option value="">พื้นที่: ทั้งหมด</option>' +
              '<option value="__NONE__"' + (state.map.area === '__NONE__' ? ' selected' : '') +
                '>(ไม่ระบุพื้นที่)</option>' +
              areas.map((v) => '<option value="' + esc(v) + '"' +
                (state.map.area === v ? ' selected' : '') + '>' + esc(areaLabel(v)) + '</option>').join('') +
            '</select>' : '') +
            '<span id="mapCount" class="count-pill"></span>' +
          '</div>' +
          '<div id="gpsMap" class="gps-map"></div>' +
          '<div class="map-legend">' + legend +
            '<span class="hint">มีพิกัด ' + all.length + ' จาก ' + total + ' การบันทึก</span></div>'
        : '<p class="hint">ยังไม่มีการบันทึกที่มีพิกัด GPS ในรอบนี้ — ' +
          'พิกัดจะติดมาเองเมื่อผู้ตรวจอนุญาตให้เว็บใช้ตำแหน่ง (ทุกวิธีบันทึก)</p>') +
      '</div>';
  }
  /** สร้าง/รีเฟรชแผนที่หลังจาก Dashboard วาดเสร็จ (Leaflet โหลดจากเน็ตครั้งแรกครั้งเดียว) */
  async function initMap() {
    const box = el('gpsMap');
    if (!box) { state.leaf = null; return; }
    try {
      await ensureLibrary('leaflet');
    } catch (e) {
      box.innerHTML = '<p class="hint">เปิดแผนที่ไม่ได้ (ต้องต่ออินเทอร์เน็ตครั้งแรกที่ใช้)</p>';
      return;
    }
    if (state.leaf) { try { state.leaf.remove(); } catch (e) {} state.leaf = null; }
    const L = window.L;
    const map = L.map(box, { scrollWheelZoom: false });
    state.leaf = map;
    // ── ชั้นแผนที่: ถนน / ภาพดาวเทียม / ดาวเทียม+ชื่อสถานที่ ──
    const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; ผู้ร่วมสร้าง <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
    const sat = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: 'ภาพดาวเทียม: Esri, Maxar, Earthstar Geographics'
      });
    const labels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 });
    const satLabeled = L.layerGroup([
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19, attribution: 'ภาพดาวเทียม: Esri, Maxar, Earthstar Geographics'
        }), labels]);
    const bases = { 'แผนที่ถนน': street, 'ภาพดาวเทียม': sat, 'ดาวเทียม + ชื่อสถานที่': satLabeled };
    const savedBase = cacheGet('avMapBase');
    (bases[savedBase] || street).addTo(map);
    L.control.layers(bases, null, { position: 'topright' }).addTo(map);
    map.on('baselayerchange', (ev) => cacheSet('avMapBase', ev.name));
    drawMapMarkers();
  }
  function drawMapMarkers() {
    const map = state.leaf;
    if (!map || !window.L) return;
    const L = window.L;
    if (state.mapLayer) { try { map.removeLayer(state.mapLayer); } catch (e) {} }
    const rows = mapLogs();
    if (el('mapCount')) el('mapCount').textContent = rows.length + ' จุด';
    const group = L.layerGroup();
    const pts = [];
    rows.forEach((l) => {
      const cls = classify(l);
      const pin = RESULT_PIN[cls] || { color: '#6B7280' };
      const lat = Number(l.gpsLat);
      const lng = Number(l.gpsLng);
      pts.push([lat, lng]);
      const a = state.master.find((x) => x.inventoryNumber === l.inventoryNumber);
      const marker = L.circleMarker([lat, lng], {
        radius: 8, color: '#fff', weight: 2, fillColor: pin.color, fillOpacity: 0.95
      });
      marker.bindPopup(
        '<b class="mono">' + esc(l.inventoryNumber) + '</b><br>' +
        esc(a ? (a.description || '') : (l.unlistedDesc || 'นอกทะเบียน')) + '<br>' +
        '<b style="color:' + pin.color + '">' + esc(statusLabel(l)) + '</b>' +
        (Number(l.pieceNo) > 1 ? ' · ชิ้นที่ ' + l.pieceNo : '') + '<br>' +
        esc(l.inspector || '-') + '<br>' + esc(thaiDT(l.verifiedAt)) +
        (l.locationText ? '<br>📍 ' + esc(l.locationText) : '') +
        (a && (a.location || '').trim() ? '<br>พื้นที่ทะเบียน: ' + esc(a.location) : '') +
        (l.note ? '<br>' + esc(l.note) : '') +
        (l.gpsAccuracy ? '<br><small>ความแม่นยำ ±' + Math.round(l.gpsAccuracy) + ' ม.</small>' : '') +
        '<br>' +
        (photoCountOf(l)
          ? '<button type="button" class="pop-btn photo" onclick="App.openPhotos(\'' +
            esc(l.logId) + '\')">ดูรูป (' + photoCountOf(l) + ')</button>'
          : '') +
        '<a class="gmap-link" target="_blank" rel="noopener" ' +
          'href="https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng + '">' +
          'เปิดใน Google Maps ↗</a>'
      );
      group.addLayer(marker);
    });
    group.addTo(map);
    state.mapLayer = group;
    if (pts.length) {
      map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 18 });
    } else {
      map.setView([13.7563, 100.5018], 6);        // ไม่มีจุดตามตัวกรอง — ถอยมาดูภาพรวมประเทศ
    }
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 120);
  }
  function setMapWho(v) { state.map.who = v; drawMapMarkers(); }
  function setMapRange(v) { state.map.range = v; drawMapMarkers(); }
  function setMapArea(v) { state.map.area = v; drawMapMarkers(); }
  /** การ์ดเทียบยอด "ทะเบียน ↔ นับเจอจริง" รายหมวด (เฉพาะหมวดที่มีการนับ) */
  function countCompareCard() {
    const rows = [];
    ['FIXED', 'RENTAL'].forEach((t) => {
      countSummary(t).filter((g) => g.entries > 0).forEach((g) => {
        const diff = g.total - g.counted;
        rows.push('<tr><td class="mono nowrap">' + esc(catLabel(g.cat)) + '</td>' +
          '<td class="c-md">' + (t === 'RENTAL' ? 'ของเช่า' : 'Fixed') + '</td>' +
          '<td class="num">' + g.total + '</td>' +
          '<td class="num"><b>' + g.counted + '</b></td>' +
          '<td class="num"><b class="' + (diff > 0 ? 'txt-no' : (diff < 0 ? 'txt-dmg' : 'txt-ok')) + '">' +
            (diff > 0 ? diff : (diff < 0 ? '+' + Math.abs(diff) : '0')) + '</b></td>' +
          '<td class="c-md num">' + g.found + '</td>' +
          '<td class="c-md num">' + g.notfound + '</td>' +
          '<td class="c-md num">' + g.pending + '</td></tr>');
      });
    });
    if (!rows.length) return '';
    return '<div class="dash-card wide"><h4>' + icon('hash') +
      ' เทียบยอดนับจำนวน (ของที่ไม่ทราบ RT code)</h4>' +
      '<div class="table-wrap flat"><table class="asset-table mini"><thead><tr>' +
      '<th>หมวด</th><th class="c-md">ประเภท</th><th class="num">ทะเบียน</th>' +
      '<th class="num">นับเจอ</th><th class="num">ยังไม่เจอ</th>' +
      '<th class="c-md num">พบ (รายชิ้น)</th><th class="c-md num">ไม่พบ</th>' +
      '<th class="c-md num">ยังไม่ตรวจ</th>' +
      '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' +
      '<p class="hint">ยอดนับเป็นการนับรวมของหน้างานที่ไม่ทราบรหัส — แยกจากผลตรวจรายชิ้นโดยสิ้นเชิง</p></div>';
  }

  // ── Export Excel ───────────────────────────────────────────────────────────

  /** ข้อมูลผลตรวจล่าสุดของ RT code หนึ่ง สำหรับเติมลงชีทฟอร์ม */
  function reportCells(a) {
    const l = state.latest.get(a.inventoryNumber);
    const c = classify(l);
    return {
      yes: c === 'found' ? '✓' : '',
      no: c === 'notfound' ? '✓' : '',
      site: l && c === 'moved' ? (l.moveToSite || '') : '',
      doc: l && c === 'moved' ? (l.moveDocNo || '') : '',
      date: l && c === 'moved' && l.moveDate ? thaiD(l.moveDate) : '',
      note: l ? (l.note || '') : '',                       // เว้นว่างถ้าไม่ได้ระบุ
      pieces: l ? (l.pieces || 1) : '',
      by: l ? (l.inspector || '') : '',
      at: l ? thaiDT(l.verifiedAt) : '',
      where: l ? (l.locationText || '') : '',
      how: l ? l.method : ''
    };
  }
  const EXTRA_HEAD = ['พื้นที่จัดเก็บ', 'จำนวนที่บันทึก (ชิ้น)', 'ผู้บันทึก', 'เวลาที่บันทึก', 'ตำแหน่งที่ตรวจ', 'วิธี'];
  const THIN = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

  function styleHeadCell(cell, fill) {
    cell.font = { name: 'Tahoma', size: 9, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill || 'FFEDF1F7' } };
    return cell;
  }
  /** สร้างชีทฟอร์มรายงาน (โครงเดียวกับไฟล์ .xls ต้นฉบับ + คอลัมน์เสริมท้ายตาราง) */
  function buildFormSheet(wb, s, opts) {
    const ws = wb.addWorksheet(opts.sheetName, {
      views: [{ state: 'frozen', ySplit: 8 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    const W = opts.widths;
    W.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const lastCol = W.length;

    // หัวรายงาน 4 บรรทัดแบบฟอร์มเดิม
    const d = new Date();
    const from = s.countDateFrom ? new Date(s.countDateFrom + 'T00:00:00') : d;
    const to = s.countDateTo ? new Date(s.countDateTo + 'T00:00:00') : null;
    const days = from.getDate() + (to && to.getDate() !== from.getDate() ? ' - ' + to.getDate() : '');
    ws.mergeCells(1, 1, 1, lastCol);
    const title = ws.getCell(1, 1);
    title.value = opts.title;
    title.font = { name: 'Tahoma', size: 13, bold: true };
    title.alignment = { horizontal: 'center' };
    ws.getCell(2, 1).value = 'Site/Cost center......' + (s.costCenter || s.site || '') + '..........';
    ws.getCell(3, 1).value = 'วันที่…' + days + '.….. /…' +
      TH_MONTHS[from.getMonth()].replace(/\./g, '') + '.... /….' + (from.getFullYear() + 543) + '......';
    ws.getCell(4, 1).value = 'Run Date ' + pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' +
      d.getFullYear() + ' Time ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    [2, 3, 4].forEach((r) => { ws.getCell(r, 1).font = { name: 'Tahoma', size: 10 }; });

    // หัวตาราง 3 ชั้น (แถว 6-8)
    opts.head.forEach((h) => {
      ws.mergeCells(h.r1, h.c1, h.r2, h.c2);
      const cell = ws.getCell(h.r1, h.c1);
      cell.value = h.text;
      styleHeadCell(cell, h.fill);
    });
    for (let r = 6; r <= 8; r++) {
      for (let c = 1; c <= lastCol; c++) {
        const cell = ws.getCell(r, c);
        if (!cell.border) styleHeadCell(cell);
      }
    }
    ws.getRow(6).height = 16;
    ws.getRow(7).height = 16;
    ws.getRow(8).height = 26;

    // ข้อมูล
    opts.rows.forEach((values, i) => {
      const r = 9 + i;
      values.forEach((v, c) => {
        const cell = ws.getCell(r, c + 1);
        cell.value = v === '' ? null : v;
        cell.border = BORDER;
        cell.font = { name: 'Tahoma', size: 9 };
        cell.alignment = { vertical: 'middle', wrapText: c === opts.descCol };
      });
      // ช่อง Yes / No ให้เป็นเครื่องหมายถูกกลางช่อง สีเขียว/แดง
      [opts.yesCol, opts.noCol].forEach((c, k) => {
        const cell = ws.getCell(r, c + 1);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Tahoma', size: 12, bold: true,
          color: { argb: k === 0 ? 'FF1F7A4D' : 'FFB0402F' } };
      });
      const pcCell = ws.getCell(r, opts.pieceCol + 1);
      pcCell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (Number(pcCell.value) > 1) {
        pcCell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FFB45309' } };
        pcCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3D6' } };
      }
    });
    ws.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8 + opts.rows.length, column: lastCol } };
    return ws;
  }

  // ══ ผังภาพถ่ายดาวเทียม — ไฟล์ PNG แยก สำหรับแนบรายงานหน้างาน ═══════════════
  // พิกัด GPS เป็นองศา อ่านหน้างานไม่รู้เรื่อง จึงวางลงบนภาพถ่ายดาวเทียมจริง
  // แล้วทับด้วยเส้นตารางช่อง (A1, C4, …) เผื่อภาพดาวเทียมเก่ากว่าสภาพไซต์ปัจจุบัน
  const M_PER_DEG_LAT = 110540;
  const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/';
  const SAT_CREDIT = 'ภาพถ่ายดาวเทียม © Esri, Maxar, Earthstar Geographics';
  const SAT_MAX_Z = 19;           // Esri World Imagery มีภาพถึงระดับนี้เป็นส่วนใหญ่
  const SAT_TILE = 256;
  const SAT_MAX_UPSCALE = 4;      // ขยายเกินนี้ภาพจะแตกจนดูไม่ออก ยอมเห็นพื้นที่รอบข้างกว้างขึ้นแทน
  const SAT_MAX_TILES = 150;
  const LAYOUT_CELL_SIZES = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
  const LAYOUT_MAX_COLS = 18;
  const LAYOUT_MAX_ROWS = 26;
  const PIN_COLOR = { found: '#2E9E5B', moved: '#E08A1E', notfound: '#D24B3E', mixed: '#5B6B85' };
  const PIN_TEXT = { found: 'พบ', moved: 'ย้ายออก', notfound: 'ไม่พบ', mixed: 'ปนกัน' };
  const FONT = 'Tahoma, "Segoe UI", "Noto Sans Thai", sans-serif';
  const layoutColLetter = (i) => String.fromCharCode(65 + i);
  function layoutMedian(arr) {
    if (!arr.length) return 0;
    const a = arr.slice().sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  // พิกัด → พิกเซลของโลกทั้งใบที่ระดับซูม z (Web Mercator แบบเดียวกับ Google/Esri)
  const mercX = (lng, z) => (lng + 180) / 360 * Math.pow(2, z) * SAT_TILE;
  function mercY(lat, z) {
    const s = Math.sin(lat * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, z) * SAT_TILE;
  }

  /** บันทึกล่าสุดของแต่ละ "ชิ้น" ที่มีพิกัดใช้ได้จริง (1 ชิ้น = 1 จุดบนผัง) */
  function gpsLatestPieces(logsAll) {
    const map = new Map();
    logsAll.forEach((l) => {
      if (l.gpsLat == null || l.gpsLng == null) return;
      const lat = Number(l.gpsLat);
      const lng = Number(l.gpsLng);
      if (!isFinite(lat) || !isFinite(lng)) return;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      if (lat === 0 && lng === 0) return;
      const key = l.inventoryNumber + '#' + (Number(l.pieceNo) > 0 ? Number(l.pieceNo) : 1);
      const cur = map.get(key);
      if (!cur || isNewer(l, cur)) map.set(key, l);
    });
    return Array.from(map.values());
  }

  /** โมเดลผัง: ฉายพิกัดลงระนาบเมตร ตัดจุดหลงทาง แล้วเลือกขนาดช่องอัตโนมัติ */
  function buildLayoutModel(logsAll) {
    const pts = gpsLatestPieces(logsAll);
    if (!pts.length) return null;
    const lat0 = layoutMedian(pts.map((l) => Number(l.gpsLat)));
    const lng0 = layoutMedian(pts.map((l) => Number(l.gpsLng)));
    const mPerLng = 111320 * Math.cos(lat0 * Math.PI / 180) || 111320;
    const byInv = new Map();
    state.master.forEach((a) => { byInv.set(a.inventoryNumber, a); });
    const items = pts.map((l) => ({
      log: l, asset: byInv.get(l.inventoryNumber) || null,
      lat: Number(l.gpsLat), lng: Number(l.gpsLng),
      cx: (Number(l.gpsLng) - lng0) * mPerLng,
      cy: (Number(l.gpsLat) - lat0) * M_PER_DEG_LAT,
      acc: Number(l.gpsAccuracy) || 0,
      grp: classify(l)
    }));
    // จุดที่พิกัดเพี้ยน (จับดาวเทียมไม่ทัน) จะดึงผังให้กว้างจนอ่านไม่ออก → กันออกจากขอบเขตผัง
    const dist = items.map((it) => Math.sqrt(it.cx * it.cx + it.cy * it.cy));
    const limit = Math.max(150, layoutMedian(dist) * 4);
    items.forEach((it, i) => { it.far = dist[i] > limit; });
    const base = items.filter((it) => !it.far);
    const use = base.length ? base : items;
    if (!base.length) items.forEach((it) => { it.far = false; });
    const xs = use.map((it) => it.cx);
    const ys = use.map((it) => it.cy);
    const minX = Math.min.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const spanX = Math.max.apply(null, xs) - minX;
    const spanY = Math.max.apply(null, ys) - minY;
    // ช่องเล็กกว่า 5 ม. ไม่มีความหมาย เพราะ GPS มือถือคลาดเคลื่อนมากกว่านั้นอยู่แล้ว
    const sizes = LAYOUT_CELL_SIZES.filter((v) => v >= 5);
    let cell = sizes[sizes.length - 1];
    for (let i = 0; i < sizes.length; i++) {
      if (Math.floor(spanX / sizes[i]) + 1 <= LAYOUT_MAX_COLS &&
          Math.floor(spanY / sizes[i]) + 1 <= LAYOUT_MAX_ROWS) { cell = sizes[i]; break; }
    }
    const model = {
      items: items, cell: cell, lat0: lat0, lng0: lng0, mPerLng: mPerLng,
      minX: minX, minY: minY, spanX: spanX, spanY: spanY,
      cols: Math.min(LAYOUT_MAX_COLS, Math.floor(spanX / cell) + 1),
      rows: Math.min(LAYOUT_MAX_ROWS, Math.floor(spanY / cell) + 1),
      originLat: lat0 + minY / M_PER_DEG_LAT,      // มุมล่างซ้ายของผัง = ช่อง A แถวล่างสุด
      originLng: lng0 + minX / mPerLng,
      farCount: items.filter((it) => it.far).length,
      accAvg: Math.round(use.reduce((n, it) => n + it.acc, 0) / use.length)
    };
    items.forEach((it) => {
      it.ref = it.far ? 'นอกผัง' : layoutRefOf(model, it.lat, it.lng);
    });
    return model;
  }

  /** ช่องผังของพิกัดหนึ่ง ๆ เช่น "C4" */
  function layoutRefOf(model, lat, lng) {
    const X = (lng - model.lng0) * model.mPerLng - model.minX;
    const Y = (lat - model.lat0) * M_PER_DEG_LAT - model.minY;
    const ci = Math.floor(X / model.cell);
    const ri = Math.floor((model.spanY - Y) / model.cell);
    if (ci < 0 || ci >= model.cols || ri < 0 || ri >= model.rows) return 'นอกผัง';
    return layoutColLetter(ci) + (ri + 1);
  }
  /** พิกัดของเส้นตารางแนวตั้งเส้นที่ i และแนวนอนเส้นที่ j (นับจากมุมล่างซ้าย) */
  const gridLng = (m, i) => m.originLng + (i * m.cell) / m.mPerLng;
  const gridLat = (m, j) => m.originLat + (j * m.cell) / M_PER_DEG_LAT;

  function loadTileImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';        // ต้องมี ไม่งั้น canvas โดนล็อกจนบันทึกรูปไม่ได้
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);    // ไทล์ไหนโหลดไม่ได้ก็ปล่อยว่าง ไม่ล้มทั้งผัง
      img.src = url;
    });
  }

  /** รวมจุดที่อยู่ใกล้กันเกินกว่าจะวาดหมุดแยกได้ ให้เป็นหมุดเดียวที่มีหลายรายการ */
  function clusterPins(items, toPx, minGap) {
    const out = [];
    items.forEach((it) => {
      const p = toPx(it.lat, it.lng);
      let hit = null;
      for (let i = 0; i < out.length && !hit; i++) {
        if (Math.hypot(out[i].x - p[0], out[i].y - p[1]) < minGap) hit = out[i];
      }
      if (hit) {
        hit.items.push(it);
        hit.x = (hit.x * (hit.items.length - 1) + p[0]) / hit.items.length;
        hit.y = (hit.y * (hit.items.length - 1) + p[1]) / hit.items.length;
      } else {
        out.push({ x: p[0], y: p[1], items: [it] });
      }
    });
    out.forEach((c) => {
      const kinds = {};
      c.items.forEach((it) => { kinds[it.grp] = 1; });
      const keys = Object.keys(kinds);
      c.grp = keys.length === 1 ? keys[0] : 'mixed';
    });
    // เรียงแบบอ่านหนังสือ บนลงล่าง–ซ้ายไปขวา เพื่อให้เลขหมุดไล่ตามสายตา
    out.sort((a, b) => (Math.round(a.y / 60) - Math.round(b.y / 60)) || (a.x - b.x));
    return out;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  /** ป้ายตัวหนังสือบนภาพดาวเทียม ต้องมีพื้นทึบข้างหลังไม่งั้นอ่านไม่ออก */
  function mapChip(ctx, x, y, text, size, align) {
    ctx.font = '700 ' + size + 'px ' + FONT;
    const w = ctx.measureText(text).width + size * 0.7;
    const h = size * 1.55;
    const left = align === 'center' ? x - w / 2 : x;
    ctx.fillStyle = 'rgba(17,24,39,.72)';
    roundRect(ctx, left, y, w, h, h / 2.6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + w / 2, y + h / 2 + size * 0.05);
  }
  function fitText(ctx, text, max) {
    if (ctx.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  }

  async function exportLayoutImage() {
    const s = state.activeSession;
    if (!s) return toast('เลือกรอบตรวจก่อน', 'warn');
    const model = buildLayoutModel(allLogs());
    if (!model) {
      return toast('รอบนี้ยังไม่มีบันทึกที่ติดพิกัด GPS จึงยังวาดผังไม่ได้ — ' +
        'เปิดสิทธิ์ตำแหน่งบนมือถือก่อนบันทึก', 'warn', null, 6000);
    }
    try {
      busy('กำลังเตรียมผัง...');
      const PAD = 36;
      const HEAD_H = 138;
      const MAP_W = 1500;
      const MAP_H = 1180;
      const PANEL_W = 700;
      const GAP = 26;
      const FOOT_H = 92;

      // ── กรอบพื้นที่ที่จะแสดง: ขอบเขตผัง + เผื่อขอบ 12% ──
      const padX = Math.max(model.spanX * 0.12, model.cell * 0.6);
      const padY = Math.max(model.spanY * 0.12, model.cell * 0.6);
      const west = model.originLng - padX / model.mPerLng;
      const east = gridLng(model, model.cols) + padX / model.mPerLng;
      const south = model.originLat - padY / M_PER_DEG_LAT;
      const north = gridLat(model, model.rows) + padY / M_PER_DEG_LAT;

      let z = SAT_MAX_Z;
      for (; z > 2; z--) {
        if (Math.abs(mercX(east, z) - mercX(west, z)) <= MAP_W &&
            Math.abs(mercY(north, z) - mercY(south, z)) <= MAP_H) break;
      }
      const boxW = Math.abs(mercX(east, z) - mercX(west, z));
      const boxH = Math.abs(mercY(south, z) - mercY(north, z));
      const scale = Math.min(MAP_W / Math.max(boxW, 1), MAP_H / Math.max(boxH, 1), SAT_MAX_UPSCALE);
      const cxW = (mercX(west, z) + mercX(east, z)) / 2;
      const cyW = (mercY(north, z) + mercY(south, z)) / 2;
      const x0 = cxW - MAP_W / (2 * scale);
      const y0 = cyW - MAP_H / (2 * scale);
      const toPx = (lat, lng) => [(mercX(lng, z) - x0) * scale, (mercY(lat, z) - y0) * scale];

      // หมุดทุกจุดต้องอยู่บนภาพเสมอ — ตัดได้แค่ "รายชื่อ" ข้างภาพเมื่อยาวเกินไป
      const pins = clusterPins(model.items.filter((it) => !it.far), toPx, 46);
      const shown = pins.slice(0, 240);

      // ── ความสูงของแผงรายชื่อ กำหนดความสูงรูปทั้งใบ ──
      const nCol = shown.length > 90 ? 3 : (shown.length > 30 ? 2 : 1);
      const rowH = nCol === 1 ? 36 : (nCol === 2 ? 30 : 27);
      const perCol = Math.ceil(shown.length / nCol);
      const legendH = 236;
      const panelH = legendH + perCol * rowH + (pins.length > shown.length ? 40 : 0) + 24;

      const W = PAD * 2 + MAP_W + GAP + PANEL_W;
      const H = PAD * 2 + HEAD_H + Math.max(MAP_H, panelH) + FOOT_H;
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // ── ภาพถ่ายดาวเทียม ──
      const mx = PAD;
      const my = PAD + HEAD_H;
      const tx0 = Math.floor(x0 / SAT_TILE);
      const ty0 = Math.floor(y0 / SAT_TILE);
      const tx1 = Math.floor((x0 + MAP_W / scale) / SAT_TILE);
      const ty1 = Math.floor((y0 + MAP_H / scale) / SAT_TILE);
      const jobs = [];
      const nMax = Math.pow(2, z);
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (ty < 0 || ty >= nMax) continue;
          jobs.push({ tx: ((tx % nMax) + nMax) % nMax, ty: ty, dx: tx, dy: ty });
        }
      }
      if (jobs.length > SAT_MAX_TILES) jobs.length = SAT_MAX_TILES;
      ctx.save();
      ctx.beginPath();
      ctx.rect(mx, my, MAP_W, MAP_H);
      ctx.clip();
      ctx.fillStyle = '#20262e';
      ctx.fillRect(mx, my, MAP_W, MAP_H);
      let done = 0;
      let missing = 0;
      const step = 5;                        // โหลดทีละชุด กันเปิดพร้อมกันหลายสิบเส้น
      for (let i = 0; i < jobs.length; i += step) {
        busy('กำลังโหลดภาพถ่ายดาวเทียม ' + Math.min(i + step, jobs.length) + ' / ' + jobs.length + '...');
        const batch = jobs.slice(i, i + step);
        const imgs = await Promise.all(batch.map((j) =>
          loadTileImage(SAT_URL + z + '/' + j.ty + '/' + j.tx)));
        imgs.forEach((img, k) => {
          done++;
          if (!img) { missing++; return; }
          const j = batch[k];
          ctx.drawImage(img, mx + (j.dx * SAT_TILE - x0) * scale, my + (j.dy * SAT_TILE - y0) * scale,
            SAT_TILE * scale + 1, SAT_TILE * scale + 1);
        });
      }
      busy('กำลังวาดผัง...');
      // ลดความจัดของภาพลงนิด ให้เส้นตารางและหมุดเด่นขึ้น
      ctx.fillStyle = 'rgba(10,14,20,.18)';
      ctx.fillRect(mx, my, MAP_W, MAP_H);

      // ── เส้นตารางช่อง + ป้าย A.. / 1.. ──
      const gp = (lat, lng) => { const p = toPx(lat, lng); return [mx + p[0], my + p[1]]; };
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.setLineDash([7, 6]);
      for (let i = 0; i <= model.cols; i++) {
        const a = gp(model.originLat, gridLng(model, i));
        const b = gp(gridLat(model, model.rows), gridLng(model, i));
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      for (let j = 0; j <= model.rows; j++) {
        const a = gp(gridLat(model, j), model.originLng);
        const b = gp(gridLat(model, j), gridLng(model, model.cols));
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 2.5;
      const c0 = gp(gridLat(model, model.rows), model.originLng);
      const c1 = gp(model.originLat, gridLng(model, model.cols));
      ctx.strokeRect(c0[0], c0[1], c1[0] - c0[0], c1[1] - c0[1]);
      for (let i = 0; i < model.cols; i++) {
        const p = gp(gridLat(model, model.rows), gridLng(model, i + 0.5));
        mapChip(ctx, p[0], p[1] - 34, layoutColLetter(i), 20, 'center');
      }
      for (let j = 0; j < model.rows; j++) {
        const p = gp(gridLat(model, model.rows - j - 0.5), model.originLng);
        mapChip(ctx, p[0] - 56, p[1] - 15, String(j + 1), 20, 'center');
      }

      // ── หมุด ──
      pins.forEach((c, i) => {
        const x = mx + c.x;
        const y = my + c.y;
        ctx.beginPath();
        ctx.arc(x, y, 21, 0, Math.PI * 2);
        ctx.fillStyle = PIN_COLOR[c.grp] || PIN_COLOR.mixed;
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 ' + (i + 1 > 99 ? 16 : 21) + 'px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x, y + 1);
        if (c.items.length > 1) {                 // ป้ายจำนวนชิ้นที่ซ้อนอยู่ในหมุดเดียว
          ctx.beginPath();
          ctx.arc(x + 17, y - 17, 12, 0, Math.PI * 2);
          ctx.fillStyle = '#111827';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = '700 14px ' + FONT;
          ctx.fillText('×' + c.items.length, x + 17, y - 16);
        }
      });

      // ── แถบสเกล + ทิศเหนือ ──
      const mPerPx = 156543.03392 * Math.cos(model.lat0 * Math.PI / 180) / Math.pow(2, z) / scale;
      let barM = LAYOUT_CELL_SIZES[0];
      LAYOUT_CELL_SIZES.forEach((v) => {
        if (Math.abs(v / mPerPx - 190) < Math.abs(barM / mPerPx - 190)) barM = v;
      });
      const barPx = barM / mPerPx;
      const bx = mx + 26;
      const by = my + MAP_H - 44;
      ctx.fillStyle = 'rgba(17,24,39,.72)';
      roundRect(ctx, bx - 12, by - 26, barPx + 24, 52, 10);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, by + 8); ctx.lineTo(bx, by); ctx.lineTo(bx + barPx, by);
      ctx.lineTo(bx + barPx, by + 8);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 18px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(barM + ' เมตร', bx + barPx / 2, by - 4);
      const nx = mx + MAP_W - 52;
      const ny = my + 52;
      ctx.fillStyle = 'rgba(17,24,39,.72)';
      ctx.beginPath(); ctx.arc(nx, ny, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(nx, ny - 20); ctx.lineTo(nx + 10, ny + 6); ctx.lineTo(nx, ny + 1);
      ctx.lineTo(nx - 10, ny + 6); ctx.closePath(); ctx.fill();
      ctx.font = '700 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('N', nx, ny + 8);
      ctx.restore();
      ctx.strokeStyle = '#c9d2df';
      ctx.lineWidth = 1;
      ctx.strokeRect(mx + .5, my + .5, MAP_W - 1, MAP_H - 1);

      // ── หัวเรื่อง ──
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#111827';
      ctx.font = '700 40px ' + FONT;
      ctx.fillText('ผังจุดที่พบ · ' + s.site + (s.roundName ? ' · รอบ ' + s.roundName : ''), PAD, PAD + 46);
      ctx.fillStyle = '#4b5563';
      ctx.font = '400 21px ' + FONT;
      ctx.fillText('วันที่ตรวจ ' + thaiD(s.countDateFrom) +
        (s.countDateTo && s.countDateTo !== s.countDateFrom ? ' – ' + thaiD(s.countDateTo) : '') +
        '   ·   ออกรายงาน ' + thaiDT(new Date().toISOString()) + ' โดย ' + inspectorName(), PAD, PAD + 82);
      ctx.fillText('1 ช่อง = ' + model.cell + ' × ' + model.cell + ' ม.   ·   ผัง ' + model.cols + ' × ' +
        model.rows + ' ช่อง   ·   ทิศเหนืออยู่ด้านบน · แถว 1 อยู่บนสุด · คอลัมน์ A อยู่ซ้ายสุด',
        PAD, PAD + 114);

      // ── แผงรายชื่อข้างภาพ ──
      const px = PAD + MAP_W + GAP;
      let py = my;
      ctx.fillStyle = '#f6f8fb';
      roundRect(ctx, px, py, PANEL_W, Math.max(MAP_H, panelH), 14);
      ctx.fill();
      ctx.strokeStyle = '#dde3ec';
      ctx.lineWidth = 1;
      ctx.stroke();
      py += 40;
      ctx.fillStyle = '#111827';
      ctx.font = '700 26px ' + FONT;
      ctx.fillText('รายการที่พบในผัง', px + 26, py);
      py += 32;
      const onPlan = model.items.filter((it) => !it.far);
      ctx.fillStyle = '#4b5563';
      ctx.font = '400 18px ' + FONT;
      ctx.fillText('เลขในวงกลมบนภาพ = เลขในรายการนี้   ·   ' + onPlan.length + ' ชิ้น รวมเป็น ' +
        pins.length + ' จุด', px + 26, py);
      py += 24;
      ctx.fillText('★ = พบนอกทะเบียน   ·   ×N บนหมุด = จุดนั้นมีของซ้อนกันหลายชิ้น   ·   ' +
        '[C4] = ช่องผัง', px + 26, py);
      py += 34;
      const counts = { found: 0, moved: 0, notfound: 0 };
      onPlan.forEach((it) => { if (counts[it.grp] !== undefined) counts[it.grp]++; });
      ['found', 'moved', 'notfound'].forEach((k) => {
        ctx.beginPath();
        ctx.arc(px + 36, py, 11, 0, Math.PI * 2);
        ctx.fillStyle = PIN_COLOR[k];
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.font = '400 20px ' + FONT;
        ctx.fillText(PIN_TEXT[k] + '   ' + counts[k] + ' ชิ้น', px + 58, py + 7);
        py += 32;
      });
      ctx.strokeStyle = '#dde3ec';
      ctx.beginPath();
      ctx.moveTo(px + 26, py + 4); ctx.lineTo(px + PANEL_W - 26, py + 4); ctx.stroke();
      py += 34;

      const colW = (PANEL_W - 52 - (nCol - 1) * 10) / nCol;
      const maxCodes = nCol === 1 ? 2 : 1;
      shown.forEach((c, i) => {
        const col = Math.floor(i / perCol);
        const row = i - col * perCol;
        const rx = px + 26 + col * (colW + 10);
        const ry = py + row * rowH;
        ctx.beginPath();
        ctx.arc(rx + 13, ry - 6, 13, 0, Math.PI * 2);
        ctx.fillStyle = PIN_COLOR[c.grp] || PIN_COLOR.mixed;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 ' + (i + 1 > 99 ? 11 : (nCol === 1 ? 14 : 13)) + 'px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), rx + 13, ry - 1);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#111827';
        ctx.font = '400 ' + (nCol === 1 ? 19 : (nCol === 2 ? 16 : 15)) + 'px ' + FONT;
        const codes = c.items.map((it) =>
          (it.log.unregistered ? '★' : '') + it.log.inventoryNumber +
          (Number(it.log.pieceNo) > 1 ? '·' + Number(it.log.pieceNo) : ''));
        let line = codes.slice(0, maxCodes).join(', ');
        if (codes.length > maxCodes) line += ' +' + (codes.length - maxCodes);
        if (nCol === 1 && c.items.length === 1 && c.items[0].asset) {
          line += ' · ' + (c.items[0].asset.description || '');
        }
        line += '  [' + c.items[0].ref + ']';
        ctx.fillText(fitText(ctx, line, colW - 36), rx + 34, ry);
      });
      py += perCol * rowH;
      if (pins.length > shown.length) {
        ctx.fillStyle = '#7a6a45';
        ctx.font = '400 18px ' + FONT;
        ctx.fillText('หมุดที่ ' + (shown.length + 1) + '–' + pins.length +
          ' อยู่บนภาพแล้ว แต่ไม่ได้ลงรายชื่อที่นี่ — ดูครบในไฟล์ Excel', px + 26, py + 26);
      }

      // ── ท้ายรูป ──
      const fy = PAD + HEAD_H + Math.max(MAP_H, panelH) + 34;
      ctx.fillStyle = '#4b5563';
      ctx.font = '400 18px ' + FONT;
      ctx.fillText(SAT_CREDIT + '   ·   ' + (missing ? 'มีไทล์ภาพโหลดไม่ครบ ' + missing + ' ช่อง   ·   ' : '') +
        'ภาพถ่ายดาวเทียมอาจถ่ายไว้ก่อนสภาพไซต์ปัจจุบัน ให้ยึดเส้นตารางช่องเป็นหลัก', PAD, fy);
      ctx.fillText('ตำแหน่งมาจาก GPS ของโทรศัพท์ คลาดเคลื่อนราว ±' + Math.max(model.accAvg, 5) +
        ' ม. ใช้ช่วยหาของหน้างาน ไม่ใช่ค่าพิกัดงานสำรวจ' +
        (model.farCount ? '   ·   มี ' + model.farCount + ' ชิ้นพิกัดคลาดเคลื่อนมาก ไม่ได้ลงผัง' : ''),
        PAD, fy + 30);

      busy('กำลังบันทึกรูป...');
      const blob = await new Promise((res, rej) => {
        try { cv.toBlob((b) => (b ? res(b) : rej(new Error('สร้างรูปไม่สำเร็จ'))), 'image/png'); }
        catch (e) { rej(e); }
      });
      const d2 = s.countDateFrom ? new Date(s.countDateFrom + 'T00:00:00') : new Date();
      const name = 'Layout_' + s.site + '_' + d2.getDate() + '.' + (d2.getMonth() + 1) +
        '.' + String(d2.getFullYear() + 543).slice(-2) + '.png';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('สร้างไฟล์ ' + name + ' แล้ว (' + pins.length + ' จุด · ' + onPlan.length + ' ชิ้น)', 'success');
    } catch (e) {
      const msg = /tainted|SecurityError/i.test(String(e && e.name) + String(e && e.message))
        ? 'บันทึกรูปไม่ได้เพราะเซิร์ฟเวอร์ภาพดาวเทียมไม่ยอมให้ดึงมาประกอบ ลองใหม่อีกครั้ง'
        : (isNetworkError(e) ? 'ต้องต่ออินเทอร์เน็ตเพื่อโหลดภาพถ่ายดาวเทียม' : e.message);
      toast('สร้างผังไม่สำเร็จ: ' + msg, 'error', null, 7000);
    } finally {
      busyHide();
    }
  }

  async function exportExcel() {
    const s = state.activeSession;
    if (!s) return toast('เลือกรอบตรวจก่อน', 'warn');
    try {
      busy('กำลังสร้างไฟล์ Excel...');
      await ensureLibrary('exceljs');
      const wb = new window.ExcelJS.Workbook();
      wb.creator = inspectorName();
      wb.created = new Date();

      const st = { FIXED: typeStats('FIXED'), RENTAL: typeStats('RENTAL') };
      const logsAll = allLogs();
      const unlistedMap = {};
      logsAll.filter((l) => l.unregistered).forEach((l) => {
        const cur = unlistedMap[l.inventoryNumber];
        if (!cur || String(l.verifiedAt) > String(cur.verifiedAt)) unlistedMap[l.inventoryNumber] = l;
      });
      const unlistedList = Object.keys(unlistedMap).map((k) => unlistedMap[k]);
      // RT code ที่ถูกใช้ซ้ำหลายชิ้น
      const dupCodes = [];
      state.latest.forEach((l, inv) => { if (l.pieces > 1) dupCodes.push({ inv: inv, n: l.pieces }); });
      dupCodes.sort((a, b) => b.n - a.n);
      const extraPieces = dupCodes.reduce((n, d) => n + (d.n - 1), 0);

      // ══ ชีท 1: สรุปผล ══
      const sum = wb.addWorksheet('สรุปผล');
      sum.getColumn(1).width = 34;
      [16, 14, 12, 20, 26, 14].forEach((w, i) => { sum.getColumn(i + 2).width = w; });
      const put = (r, c, v, bold) => {
        const cell = sum.getCell(r, c);
        cell.value = v;
        cell.font = { name: 'Tahoma', size: bold ? 11 : 10, bold: !!bold };
        return cell;
      };
      put(1, 1, 'สรุปผลการตรวจนับทรัพย์สิน', true).font = { name: 'Tahoma', size: 14, bold: true };
      const info = [['โครงการ', s.site], ['ชื่อรอบ', s.roundName || ''],
        ['Cost center', s.costCenter || ''],
        ['วันที่ตรวจ', thaiD(s.countDateFrom) + (s.countDateTo ? ' – ' + thaiD(s.countDateTo) : '')],
        ['ผู้รับผิดชอบ', s.inspectorName || ''],
        ['ออกรายงานเมื่อ', thaiDT(new Date().toISOString())], ['ออกโดย', inspectorName()]];
      info.forEach((row, i) => { put(3 + i, 1, row[0], true); put(3 + i, 2, row[1]); });
      let r = 3 + info.length + 1;
      ['รายการ', 'Fixed Assets', 'ของเช่า', 'รวม'].forEach((h, i) => {
        const cell = put(r, 1 + i, h, true);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF1F7' } };
        cell.border = BORDER;
      });
      const sumRows = [
        ['ทรัพย์สินตามทะเบียน', st.FIXED.total, st.RENTAL.total],
        ['ตรวจแล้ว', st.FIXED.done, st.RENTAL.done],
        ['พบ', st.FIXED.found, st.RENTAL.found],
        ['ไม่พบ', st.FIXED.notfound, st.RENTAL.notfound],
        ['ย้ายออกไปไซต์อื่น', st.FIXED.moved, st.RENTAL.moved],
        ['ยังไม่ตรวจ', st.FIXED.pending, st.RENTAL.pending]
      ];
      sumRows.forEach((row, i) => {
        const rr = r + 1 + i;
        put(rr, 1, row[0]);
        put(rr, 2, row[1]);
        put(rr, 3, row[2]);
        put(rr, 4, row[1] + row[2], true);
        for (let c = 1; c <= 4; c++) {
          sum.getCell(rr, c).border = BORDER;
          if (c > 1) sum.getCell(rr, c).alignment = { horizontal: 'center' };
        }
      });
      r += sumRows.length + 2;
      put(r, 1, 'พบเพิ่มนอกทะเบียน (RT code)', true); put(r, 2, unlistedList.length);
      put(r + 1, 1, 'RT code ที่พบซ้ำมากกว่า 1 ชิ้น', true); put(r + 1, 2, dupCodes.length);
      put(r + 2, 1, 'จำนวนชิ้นส่วนเกินจากการใช้ RT code ซ้ำ', true); put(r + 2, 2, extraPieces);
      put(r + 3, 1, 'ความคืบหน้า', true);
      put(r + 3, 2, (st.FIXED.total + st.RENTAL.total
        ? Math.round((st.FIXED.done + st.RENTAL.done) * 100 / (st.FIXED.total + st.RENTAL.total)) : 0) + '%');
      r += 5;
      if (dupCodes.length) {
        put(r, 1, 'RT code ที่ใช้ซ้ำหลายชิ้น', true);
        r++;
        ['RT code', 'ชื่อทรัพย์สิน', 'จำนวนชิ้น'].forEach((h, i) => {
          const cell = put(r, 1 + i, h, true);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3D6' } };
          cell.border = BORDER;
        });
        dupCodes.forEach((dc, i) => {
          const a = state.master.find((m) => m.inventoryNumber === dc.inv);
          put(r + 1 + i, 1, dc.inv);
          put(r + 1 + i, 2, a ? (a.description || '') : '(นอกทะเบียน)');
          put(r + 1 + i, 3, dc.n);
        });
        r += dupCodes.length + 2;
      }
      if (unlistedList.length) {
        put(r, 1, 'รายการที่พบเพิ่มนอกทะเบียน', true);
        r++;
        ['RT code', 'คำอธิบาย', 'ผู้บันทึก', 'เวลาที่บันทึก', 'ตำแหน่ง', 'หมายเหตุ'].forEach((h, i) => {
          const cell = put(r, 1 + i, h, true);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF1F7' } };
          cell.border = BORDER;
        });
        unlistedList.forEach((l, i) => {
          put(r + 1 + i, 1, l.inventoryNumber);
          put(r + 1 + i, 2, l.unlistedDesc || '');
          put(r + 1 + i, 3, l.inspector || '');
          put(r + 1 + i, 4, thaiDT(l.verifiedAt));
          put(r + 1 + i, 5, l.locationText || '');
          put(r + 1 + i, 6, l.note || '');
        });
        r += unlistedList.length + 2;
      }
      // วิธีเปิดแผนที่ด้วยฟังก์ชันของ Excel เอง (ข้อมูลเตรียมไว้ให้พร้อมใช้แล้ว)
      const gpsCount = logsAll.filter((l) => l.gpsLat != null && l.gpsLng != null).length;
      put(r, 1, 'ดูแผนที่จุดที่ตรวจด้วย Excel', true).font = { name: 'Tahoma', size: 12, bold: true };
      [
        'ชีท "ประวัติการตรวจทั้งหมด" เป็นตาราง Excel ชื่อ AssetVerifyLog มีคอลัมน์ Latitude / Longitude ' +
          'เป็นตัวเลขพร้อมใช้ (มีพิกัด ' + gpsCount + ' รายการ)',
        '1) คลิกเซลล์ใดก็ได้ในตารางของชีทนั้น  2) เมนู Insert (แทรก) → 3D Map (แผนที่ 3 มิติ) → Open 3D Maps',
        '3) Excel จับคู่ Latitude/Longitude ให้เอง — เลือก Category เป็นคอลัมน์ "ผล" เพื่อให้สีหมุดแยกตามผลการตรวจ',
        'หมายเหตุ: ปุ่ม Insert → Maps (Filled Map) ใช้ได้กับ "ชื่อพื้นที่" เช่น จังหวัด/ประเทศ เท่านั้น ' +
          'ไม่รองรับพิกัด GPS จึงต้องใช้ 3D Map',
        'ถ้าต้องการเปิดทีละจุด: คอลัมน์ "เปิดใน Google Maps" ในชีทเดียวกันกดได้เลย'
      ].forEach((t, i) => { put(r + 1 + i, 1, t).alignment = { wrapText: false }; });

      // ══ ชีท 2: ทรัพย์สิน Fixed Assets (ฟอร์มเดิม + คอลัมน์เสริม) ══
      const fixedRows = state.master.filter((a) => a.assetType === 'FIXED').map((a, i) => {
        const y = reportCells(a);
        return [i + 1, a.assetClass || '', a.assetNumber || '', a.subNumber || '',
          a.inventoryNumber, a.description || '', a.serialNumber || '', a.staffText || '',
          a.currentSite || '', y.yes, y.no, y.site, y.doc, y.date, y.note,
          a.location || '', y.pieces, y.by, y.at, y.where, y.how];
      });
      buildFormSheet(wb, s, {
        sheetName: 'ทรัพย์สิน Fixed Assets',
        title: 'รายงานการตรวจสอบทรัพย์สิน Fixed Assets',
        widths: [5, 10, 13, 8, 19, 34, 15, 20, 15, 6, 6, 12, 13, 13, 30, 16, 9, 20, 18, 18, 9],
        descCol: 5, yesCol: 9, noCol: 10, pieceCol: 15,
        rows: fixedRows,
        head: [
          { r1: 6, c1: 1, r2: 8, c2: 1, text: 'NO.' },
          { r1: 7, c1: 2, r2: 8, c2: 2, text: 'Asset Class' },
          { r1: 7, c1: 3, r2: 8, c2: 3, text: 'Asset Number' },
          { r1: 7, c1: 4, r2: 8, c2: 4, text: 'Sub Numb' },
          { r1: 6, c1: 5, r2: 8, c2: 5, text: 'Inventory Number', fill: 'FFDCE6F3' },
          { r1: 6, c1: 6, r2: 8, c2: 6, text: 'Description', fill: 'FFDCE6F3' },
          { r1: 7, c1: 7, r2: 8, c2: 7, text: 'Serial Number' },
          { r1: 6, c1: 8, r2: 8, c2: 8, text: 'Staff – Text' },
          { r1: 6, c1: 9, r2: 8, c2: 9, text: 'Current Site' },
          { r1: 6, c1: 10, r2: 6, c2: 14, text: 'ผลการตรวจเช็ค' },
          { r1: 7, c1: 10, r2: 8, c2: 10, text: 'Yes', fill: 'FFE3F3EA' },
          { r1: 7, c1: 11, r2: 8, c2: 11, text: 'No', fill: 'FFFBE6E3' },
          { r1: 7, c1: 12, r2: 7, c2: 14, text: 'ย้ายออก' },
          { r1: 8, c1: 12, r2: 8, c2: 12, text: 'ส่งไป SITE' },
          { r1: 8, c1: 13, r2: 8, c2: 13, text: 'เลขที่ใบส่ง' },
          { r1: 8, c1: 14, r2: 8, c2: 14, text: 'วันที่ส่ง' },
          { r1: 6, c1: 15, r2: 8, c2: 15, text: 'หมายเหตุ' }
        ].concat(EXTRA_HEAD.map((t, i) => ({
          r1: 6, c1: 16 + i, r2: 8, c2: 16 + i, text: t, fill: 'FFF2F2F2'
        })))
      });

      // ══ ชีท 3: ทรัพย์สินของเช่า ══
      const rentalRows = state.master.filter((a) => a.assetType === 'RENTAL').map((a, i) => {
        const y = reportCells(a);
        return [i + 1, a.materialCode || '', a.description || '', a.inventoryNumber,
          a.plant || '', a.sloc || '', y.yes, y.no, y.site, y.doc, y.date, y.note,
          a.location || '', y.pieces, y.by, y.at, y.where, y.how];
      });
      buildFormSheet(wb, s, {
        sheetName: 'ทรัพย์สินของเช่า',
        title: 'รายงานการตรวจสอบทรัพย์สิน ของเช่า',
        widths: [5, 14, 34, 19, 8, 8, 6, 6, 12, 13, 13, 30, 16, 9, 20, 18, 18, 9],
        descCol: 2, yesCol: 6, noCol: 7, pieceCol: 12,
        rows: rentalRows,
        head: [
          { r1: 6, c1: 1, r2: 8, c2: 1, text: 'NO.' },
          { r1: 6, c1: 2, r2: 8, c2: 2, text: 'Material' },
          { r1: 6, c1: 3, r2: 8, c2: 3, text: 'Description', fill: 'FFDCE6F3' },
          { r1: 6, c1: 4, r2: 8, c2: 4, text: 'Inventory Number', fill: 'FFDCE6F3' },
          { r1: 7, c1: 5, r2: 8, c2: 5, text: 'Plan' },
          { r1: 7, c1: 6, r2: 8, c2: 6, text: 'Sloc' },
          { r1: 6, c1: 7, r2: 6, c2: 11, text: 'ผลการตรวจเช็ค' },
          { r1: 7, c1: 7, r2: 8, c2: 7, text: 'Yes', fill: 'FFE3F3EA' },
          { r1: 7, c1: 8, r2: 8, c2: 8, text: 'No', fill: 'FFFBE6E3' },
          { r1: 7, c1: 9, r2: 7, c2: 11, text: 'ย้ายออก' },
          { r1: 8, c1: 9, r2: 8, c2: 9, text: 'ส่งไป SITE' },
          { r1: 8, c1: 10, r2: 8, c2: 10, text: 'เลขที่ใบส่ง' },
          { r1: 8, c1: 11, r2: 8, c2: 11, text: 'วันที่ส่ง' },
          { r1: 6, c1: 12, r2: 8, c2: 12, text: 'หมายเหตุ' }
        ].concat(EXTRA_HEAD.map((t, i) => ({
          r1: 6, c1: 13 + i, r2: 8, c2: 13 + i, text: t, fill: 'FFF2F2F2'
        })))
      });

      // ══ ชีท 4: รูปถ่ายยืนยัน (ฝังรูปจริง โครงเดียวกับ MCR) ══
      await buildPhotoSheet(wb, logsAll);

      // ══ ชีท 5: ประวัติการตรวจทั้งหมด ══
      // เป็น "ตาราง Excel" จริง (AssetVerifyLog) และแยกพิกัดเป็น Latitude/Longitude ตัวเลข
      // เพื่อให้ใช้ฟังก์ชันแผนที่ของ Excel เอง (Insert → 3D Map) ได้ทันทีโดยไม่ต้องแต่งข้อมูลก่อน
      const hist = wb.addWorksheet('ประวัติการตรวจทั้งหมด', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });
      const histHead = ['เวลาที่บันทึก', 'RT code', 'ชิ้นที่', 'ประเภท', 'ผล', 'วิธี', 'ผู้บันทึก',
        'ตำแหน่งที่ตรวจ', 'ส่งไป SITE', 'เลขที่ใบส่ง', 'วันที่ส่ง', 'Latitude', 'Longitude',
        'ความแม่นยำ (ม.)', 'เปิดใน Google Maps', 'หมายเหตุ',
        'นอกทะเบียน', 'คำอธิบายนอกทะเบียน', 'จำนวนรูป', 'สถานะส่ง'];
      [20, 19, 7, 12, 14, 9, 22, 20, 12, 13, 13, 12, 12, 14, 18, 30, 10, 26, 9, 10]
        .forEach((w, i) => { hist.getColumn(i + 1).width = w; });
      const histRows = logsAll.slice()
        .sort((a, b) => String(a.verifiedAt).localeCompare(String(b.verifiedAt)))
        .map((l, i) => {
          const rr = 2 + i;
          const hasGps = l.gpsLat != null && l.gpsLng != null &&
            !isNaN(Number(l.gpsLat)) && !isNaN(Number(l.gpsLng));
          return [thaiDT(l.verifiedAt), l.inventoryNumber, Number(l.pieceNo) || 1,
            l.assetType === 'RENTAL' ? 'ของเช่า' : (l.assetType === 'UNLISTED' ? 'นอกทะเบียน' : 'Fixed'),
            statusLabel(l), l.method, l.inspector || '', l.locationText || '',
            l.moveToSite || '', l.moveDocNo || '', l.moveDate ? thaiD(l.moveDate) : '',
            hasGps ? Number(Number(l.gpsLat).toFixed(6)) : null,
            hasGps ? Number(Number(l.gpsLng).toFixed(6)) : null,
            hasGps && l.gpsAccuracy ? Math.round(l.gpsAccuracy) : null,
            // สูตรอ้างเซลล์พิกัดของแถวเดียวกัน — แก้พิกัดเมื่อไร ลิงก์เปลี่ยนตาม
            hasGps ? { formula: 'HYPERLINK("https://www.google.com/maps/search/?api=1&query="&L' +
              rr + '&","&M' + rr + ',"เปิดแผนที่")', result: 'เปิดแผนที่' } : null,
            l.note || null, l.unregistered ? 'ใช่' : null, l.unlistedDesc || null,
            (l.photoPaths || []).length || l.photoCount || 0,
            l.pending ? 'รอส่ง' : 'ส่งแล้ว'];
        });
      // เขียนเป็น "ตาราง Excel" ชื่อ AssetVerifyLog — Excel รู้ขอบเขตข้อมูลเอง
      // ทำให้ Insert → 3D Map / PivotTable หยิบไปใช้ได้ทันที
      let tableOk = false;
      try {
        hist.addTable({
          name: 'AssetVerifyLog', displayName: 'AssetVerifyLog',
          ref: 'A1', headerRow: true,
          style: { theme: 'TableStyleLight8', showRowStripes: true },
          columns: histHead.map((h) => ({ name: h, filterButton: true })),
          rows: histRows
        });
        tableOk = true;
      } catch (e) { tableOk = false; }
      if (!tableOk) {                       // ExcelJS รุ่นที่ไม่รองรับ table → เขียนแบบเดิม
        histHead.forEach((h, i) => { styleHeadCell(hist.getCell(1, i + 1)).value = h; });
        histRows.forEach((row, i) => {
          row.forEach((v, c) => { hist.getCell(2 + i, c + 1).value = v === '' ? null : v; });
        });
        hist.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: histHead.length } };
      }
      for (let i = 0; i <= histRows.length; i++) {
        const rr = 1 + i;
        for (let c = 1; c <= histHead.length; c++) {
          const cell = hist.getCell(rr, c);
          cell.font = rr === 1
            ? { name: 'Tahoma', size: 9, bold: true }
            : { name: 'Tahoma', size: 9 };
          cell.border = BORDER;
        }
        if (rr > 1) {
          hist.getCell(rr, 12).numFmt = '0.000000';
          hist.getCell(rr, 13).numFmt = '0.000000';
          hist.getCell(rr, 15).font = { name: 'Tahoma', size: 9, color: { argb: 'FF1B3A6B' }, underline: true };
        }
      }

      // ══ ชีท 6: นับจำนวนตามหมวด (เฉพาะเมื่อมีการนับ) ══
      const countsAll = allCounts();
      if (countsAll.length) {
        const cnt = wb.addWorksheet('นับจำนวนตามหมวด', { views: [{ state: 'frozen', ySplit: 1 }] });
        const cHead = ['หมวด', 'ประเภท', 'ทะเบียน (ชิ้น)', 'นับเจอ (ชิ้น)', 'ยังไม่เจอ',
          'พบ (รายชิ้น)', 'ไม่พบ', 'ย้ายออก', 'ยังไม่ตรวจ', 'จำนวนครั้งที่นับ'];
        [12, 12, 14, 14, 12, 14, 10, 10, 13, 15]
          .forEach((w, i) => { cnt.getColumn(i + 1).width = w; });
        cHead.forEach((h, i) => { styleHeadCell(cnt.getCell(1, i + 1)).value = h; });
        let cr = 2;
        ['FIXED', 'RENTAL'].forEach((t) => {
          countSummary(t).filter((g) => g.entries > 0).forEach((g) => {
            [[catLabel(g.cat), t === 'RENTAL' ? 'ของเช่า' : 'Fixed', g.total, g.counted,
              g.total - g.counted, g.found, g.notfound, g.moved, g.pending, g.entries]][0]
              .forEach((v, c) => {
                const cell = cnt.getCell(cr, c + 1);
                cell.value = v;
                cell.font = { name: 'Tahoma', size: 10, bold: c === 3 };
                cell.border = BORDER;
                if (c >= 2) cell.alignment = { horizontal: 'center' };
              });
            cr++;
          });
        });
        cr += 1;
        cnt.getCell(cr, 1).value = 'รายละเอียดการนับแต่ละครั้ง';
        cnt.getCell(cr, 1).font = { name: 'Tahoma', size: 11, bold: true };
        cr++;
        const dHead = ['เวลาที่นับ', 'หมวด', 'ประเภท', 'จำนวน (ชิ้น)', 'จุดที่นับ', 'ผู้นับ', 'หมายเหตุ',
          'Latitude', 'Longitude', 'ความแม่นยำ (ม.)', 'จำนวนรูป'];
        dHead.forEach((h, i) => { styleHeadCell(cnt.getCell(cr, i + 1)).value = h; });
        countsAll.slice().sort((a, b) => String(a.countedAt).localeCompare(String(b.countedAt)))
          .forEach((c, i) => {
            const cHasGps = c.gpsLat != null && c.gpsLng != null;
            [thaiDT(c.countedAt), catLabel(c.categoryCode),
              c.assetType === 'RENTAL' ? 'ของเช่า' : 'Fixed', Number(c.counted) || 0,
              c.locationText || '', c.inspector || '', c.note || '',
              cHasGps ? Number(Number(c.gpsLat).toFixed(6)) : null,
              cHasGps ? Number(Number(c.gpsLng).toFixed(6)) : null,
              cHasGps && c.gpsAccuracy ? Math.round(c.gpsAccuracy) : null,
              (c.photoPaths || []).length || c.photoCount || 0
            ].forEach((v, col) => {
              const cell = cnt.getCell(cr + 1 + i, col + 1);
              cell.value = v === '' ? null : v;
              cell.font = { name: 'Tahoma', size: 9 };
              cell.border = BORDER;
            });
          });
      }

      busy('กำลังบันทึกไฟล์...');
      const buf = await wb.xlsx.writeBuffer();
      const d2 = s.countDateFrom ? new Date(s.countDateFrom + 'T00:00:00') : new Date();
      const name = 'Asset_' + s.site + '_' + d2.getDate() + '.' + (d2.getMonth() + 1) +
        '.' + String(d2.getFullYear() + 543).slice(-2) + '.xlsx';
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('สร้างไฟล์ ' + name + ' แล้ว', 'success');
    } catch (e) {
      toast('Export ไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      busyHide();
    }
  }

  /** ชีทรูปถ่าย: ฝังรูปจริงลงไฟล์ (โครงเดียวกับชีท "รูปถ่ายยืนยัน" ของ MCR) */
  async function buildPhotoSheet(wb, logsAll) {
    // รูปที่ส่งขึ้นเซิร์ฟเวอร์แล้ว
    const items = [];
    logsAll.forEach((l) => {
      (l.photoPaths || []).forEach((p) => { items.push({ log: l, path: p }); });
    });
    // รูปที่ยังค้างในคิวเครื่องนี้ (ใช้ภาพในเครื่องได้เลย ไม่ต้องโหลด)
    state.queueItems.forEach((it) => {
      if (state.activeSession && it.sessionId !== state.activeSession.sessionId) return;
      (it.photos || []).forEach((p) => {
        if (p.dataUrl) items.push({ log: queueToLog(it), dataUrl: p.dataUrl });
      });
    });
    if (!items.length) return null;

    const ws = wb.addWorksheet('รูปถ่ายยืนยัน');
    [6, 19, 30, 14, 20, 18, 18, 52].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ['ลำดับ', 'RT code', 'ชื่อทรัพย์สิน', 'ผลตรวจ', 'ผู้บันทึก', 'เวลาที่บันทึก', 'ตำแหน่งที่ตรวจ', 'รูปถ่าย']
      .forEach((h, i) => { styleHeadCell(ws.getCell(1, i + 1)); ws.getCell(1, i + 1).value = h; });

    let row = 2;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      busy('กำลังใส่รูปภาพ ' + (i + 1) + ' / ' + items.length + '...');
      let base64 = null;
      if (it.dataUrl) {
        base64 = String(it.dataUrl).split(',').pop();
      } else {
        try { base64 = await AssetStore.downloadPhoto(it.path); }
        catch (e) { base64 = null; }
      }
      const asset = state.master.find((m) => m.inventoryNumber === it.log.inventoryNumber);
      const vals = [row - 1, it.log.inventoryNumber,
        asset ? (asset.description || '') : (it.log.unlistedDesc || '(นอกทะเบียน)'),
        statusLabel(it.log), it.log.inspector || '', thaiDT(it.log.verifiedAt),
        it.log.locationText || ''];
      vals.forEach((v, c) => {
        const cell = ws.getCell(row, c + 1);
        cell.value = v === '' ? null : v;
        cell.font = { name: 'Tahoma', size: 9 };
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = BORDER;
      });
      ws.getCell(row, 8).border = BORDER;
      if (base64) {
        try {
          const id = wb.addImage({ base64: base64, extension: 'jpeg' });
          ws.addImage(id, {
            tl: { col: 7.1, row: row - 1 + 0.1 },
            ext: { width: 360, height: 270 }
          });
          ws.getRow(row).height = 205;
        } catch (e) {
          ws.getCell(row, 8).value = 'ใส่รูปไม่สำเร็จ';
        }
      } else {
        ws.getCell(row, 8).value = 'โหลดรูปไม่สำเร็จ';
        ws.getRow(row).height = 20;
      }
      row++;
    }
    return ws;
  }

  // ── จัดการบัญชี ────────────────────────────────────────────────────────────
  async function loadUsers(silent, announce) {
    if (!state.profile || state.profile.role !== 'admin') return;
    try {
      state.users = await AssetStore.listProfiles();
      const pending = state.users.filter((u) => !u.active);
      [el('pendingBadge'), el('navReqBadge')].forEach((b) => {
        b.textContent = pending.length;
        b.classList.toggle('hidden', !pending.length);
      });
      if (!silent || state.page === 'manage') renderUsers();
      // แจ้งเตือนเฉพาะคำขอที่ยังไม่เคยเห็นในเซสชันนี้
      const fresh = pending.filter((u) => !state.accessSeen[u.id]);
      if (announce && fresh.length) {
        fresh.forEach((u) => { state.accessSeen[u.id] = true; });
        showAccessReq(pending);
        toast('มีคำขอใช้งานใหม่ ' + fresh.length + ' บัญชี', 'warn');
        beep();
      }
    } catch (e) {
      if (!silent) toast(e.message, 'error');
    }
  }
  function startAccessWatch() {
    if (state.accessTimer) clearInterval(state.accessTimer);
    if (!state.profile || state.profile.role !== 'admin') return;
    loadUsers(true, true);
    state.accessTimer = setInterval(() => {
      if (!document.hidden) loadUsers(true, true);
    }, 60000);
  }
  function showAccessReq(pending) {
    const list = pending || state.users.filter((u) => !u.active);
    if (!list.length) return closeAccessReq();
    el('accessReqSub').textContent = 'รออนุมัติ ' + list.length + ' บัญชี';
    el('accessReqList').innerHTML = list.map((u) =>
      '<div class="user-row pending-user">' +
      '<div class="user-main"><b>' + esc(u.fullName || u.email || '') + '</b>' +
      '<small>' + esc(u.email || '') + ' · สมัครเมื่อ ' + esc(thaiDT(u.createdAt)) + '</small></div>' +
      '<button class="primary-button" type="button" onclick="App.approveAccess(\'' + u.id + '\')">' + icon('check') + ' อนุมัติ</button>' +
      '<button class="danger-ghost" type="button" onclick="App.rejectAccess(\'' + u.id + '\',\'' +
        esc(u.email || '') + '\')">' + icon('close') + ' ปฏิเสธ</button>' +
      '</div>').join('');
    el('accessReqModal').classList.remove('hidden');
  }
  function closeAccessReq() { el('accessReqModal').classList.add('hidden'); }
  async function approveAccess(id) {
    try {
      busy('กำลังอนุมัติ...');
      // ยืนยันอีเมลให้ด้วย เผื่อโปรเจกต์เปิด "Confirm email" ไว้ (ไม่งั้น login ไม่ได้)
      await AssetStore.confirmUserEmail(id);
      await AssetStore.updateProfile({ id: id, role: 'counter', active: true });
      await loadUsers(true);
      const left = state.users.filter((u) => !u.active);
      if (left.length) showAccessReq(left); else closeAccessReq();
      toast('อนุมัติแล้ว — ผู้ใช้เข้าระบบได้ทันที', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { busyHide(); }
  }
  async function rejectAccess(id, email) {
    if (!window.confirm('ปฏิเสธและลบบัญชี ' + (email || '') + ' ถาวร?')) return;
    await removeUser(id);
    const left = state.users.filter((u) => !u.active);
    if (left.length) showAccessReq(left); else closeAccessReq();
  }
  async function removeUser(id) {
    try {
      busy('กำลังลบบัญชี...');
      await AssetStore.deleteUserAccount(id);
      delete state.accessSeen[id];
      await loadUsers(true);
      toast('ลบบัญชีแล้ว', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { busyHide(); }
  }
  async function deleteProfileAccount(id, email) {
    if (!window.confirm('ลบบัญชี ' + (email || '') + ' ถาวร?\n\n' +
      'ผลการตรวจที่บัญชีนี้เคยบันทึกไว้จะยังอยู่ครบ (เก็บชื่อผู้ตรวจเป็นข้อความ)')) return;
    removeUser(id);
  }
  function renderUsers() {
    const me = state.profile ? state.profile.id : '';
    el('usersList').innerHTML = state.users.map((u) => {
      const self = u.id === me;
      return '<div class="user-row' + (!u.active ? ' pending-user' : '') + '">' +
        '<div class="user-main"><b>' + esc(u.fullName || u.email || '') + '</b>' +
        '<small>' + esc(u.email || '') + (u.active ? '' : ' · รออนุมัติ') + '</small></div>' +
        '<input type="text" placeholder="ชื่อที่แสดง" value="' + esc(u.fullName || '') +
        '" onchange="App.setUserField(\'' + u.id + '\',\'fullName\',this.value)">' +
        '<select ' + (self ? 'disabled' : '') +
        ' onchange="App.setUserField(\'' + u.id + '\',\'role\',this.value)">' +
        ['viewer', 'counter', 'admin'].map((r) =>
          '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + r + '</option>').join('') +
        '</select>' +
        '<label class="user-active"><input type="checkbox" ' + (u.active ? 'checked' : '') +
        (self ? ' disabled' : '') +
        ' onchange="App.setUserField(\'' + u.id + '\',\'active\',this.checked)">ใช้งาน</label>' +
        (self ? '' : '<button class="danger-ghost" type="button" title="ลบบัญชีถาวร" ' +
          'onclick="App.deleteProfileAccount(\'' + u.id + '\',\'' + esc(u.email || '') +
          '\')">' + icon('trash') + '</button>') +
        '</div>';
    }).join('') || '<p class="hint">ยังไม่มีบัญชี</p>';
  }
  async function setUserField(id, field, value) {
    try {
      const payload = { id: id };
      payload[field] = value;
      // เปิดใช้งานบัญชี = ยืนยันอีเมลให้ด้วย กันติด "Email not confirmed" ตอน login
      if (field === 'active' && value) await AssetStore.confirmUserEmail(id);
      await AssetStore.updateProfile(payload);
      toast('บันทึกแล้ว', 'success');
      loadUsers(true);
    } catch (e) {
      toast(e.message, 'error');
      loadUsers(true);
    }
  }
  function renderManage() {
    loadUsers(true);
    const sel = el('themeSelect');
    if (sel && !sel.options.length) {
      sel.innerHTML = THEMES.map((t) =>
        '<option value="' + t.key + '">' + esc(t.label) + '</option>').join('');
    }
    if (sel) { sel.value = cacheGet('avTheme') || 'porcelain'; syncCombo('themeSelect'); }
    const totalAssets = state.sessions.reduce((n, s) => n + (s.assetCount || 0), 0);
    el('sysInfo').innerHTML =
      '<span>เวอร์ชัน: ' + APP_VERSION + '</span>' +
      '<span>รอบตรวจทั้งหมด: ' + state.sessions.length + ' รอบ · ทรัพย์สินรวม ' + totalAssets + ' รายการ</span>' +
      '<span>ผลตรวจทั้งระบบ: ' + state.logSummary.length + ' รายการ · รอส่งในเครื่องนี้: ' +
        state.queueItems.length + '</span>' +
      '<span><button class="outline-button" type="button" onclick="App.clearLocalCache()">ล้าง cache เครื่องนี้ (ไม่ลบคิวรอส่ง)</button></span>';
  }
  function clearLocalCache() {
    try {
      Object.keys(localStorage).forEach((k) => {
        if (/^av(Master_|Logs_|Sessions|LogSummary|Profile)/.test(k)) localStorage.removeItem(k);
      });
    } catch (e) {}
    location.reload();
  }

  // ── init ───────────────────────────────────────────────────────────────────
  function init() {
    el('sessionList').addEventListener('click', (ev) => {
      const card = ev.target.closest('.session-card');
      if (!card) return;
      const id = card.dataset.id;
      const btn = ev.target.closest('button[data-act]');
      const act = btn ? btn.dataset.act : 'open';
      if (act === 'del') return deleteSession(id);
      openSession(id, act === 'dash' ? 'dash' : 'list');
    });
    el('assetTbody').addEventListener('click', (ev) => {
      if (ev.target.closest('.row-check') || ev.target.closest('.yn-box')) return;
      const row = ev.target.closest('tr[data-inv]');
      if (!row) return;
      const inv = row.dataset.inv;
      const btn = ev.target.closest('.qbtn');
      if (btn) {
        const act = btn.dataset.act;
        if (act === 'open') return openAsset(inv);
        return quickSave(inv, act);
      }
      openAsset(inv);
    });
    el('assetTbody').addEventListener('change', (ev) => {
      const cb = ev.target.closest('.row-check');
      if (cb) return toggleSelect(cb.dataset.inv, cb.checked);
      // ช่อง Yes / No ในตาราง = บันทึกผลตรวจทันที (เหมือนติ๊กในฟอร์มกระดาษ)
      const yn = ev.target.closest('.yn-box');
      if (!yn) return;
      if (!yn.checked) { yn.checked = true; return; }   // ติ๊กออกไม่ได้ ใช้ ⋯ เพื่อแก้/ลบแทน
      quickSave(yn.dataset.inv, yn.dataset.res);
    });
    el('assetThead').addEventListener('change', (ev) => {
      if (ev.target.id === 'checkAll') selectAllFiltered(ev.target.checked);
    });
    el('cardWrap').addEventListener('click', (ev) => {
      const ph = ev.target.closest('.photo-chip');
      if (ph) { ev.stopPropagation(); return openPhotos(ph.dataset.log); }
      if (ev.target.closest('.gps-link')) return;      // ปล่อยให้ลิงก์เปิด Google Maps ตามปกติ
      const row = ev.target.closest('.asset-row');
      if (!row) return;
      if (row.dataset.unl) return openUnlistedDetail(row.dataset.unl);
      openAsset(row.dataset.inv);
    });
    el('dashContent').addEventListener('click', (ev) => {
      const coll = ev.target.closest('.collapse-head');
      if (coll) return toggleSection(coll.dataset.coll);
      const row = ev.target.closest('.dash-list-item');
      if (row && row.dataset.inv) openAsset(row.dataset.inv);
    });
    el('pickList').addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-code]');
      if (btn) pickChoose(btn.dataset.code);
    });
    el('bulkCatPanel').addEventListener('click', (ev) => ev.stopPropagation());
    el('recHistory').addEventListener('click', (ev) => {
      const link = ev.target.closest('.photo-link');
      if (link) {
        ev.preventDefault();
        return openPhotos(link.dataset.log, Number(link.dataset.i) || 0);
      }
      const del = ev.target.closest('.hist-del');
      if (del) deleteLogEntry(del.dataset.log);
    });
    window.addEventListener('online', () => { updateSyncChip(); flushQueue(); });
    window.addEventListener('offline', updateSyncChip);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.profile) { flushQueue(); refreshAll(true); }
    });
    setInterval(() => { if (state.profile) flushQueue(); }, 25000);
    setInterval(() => {
      if (state.profile && navigator.onLine && !document.hidden) refreshAll(true);
    }, 120000);
    let moreTick = 0;
    window.addEventListener('scroll', () => {
      const now = Date.now();
      if (now - moreTick < 150) return;      // เบาพอที่จะไม่หน่วงการเลื่อนบนมือถือ
      moreTick = now;
      checkMoreOnScroll();
    }, { passive: true });
    el('areaPickList').addEventListener('click', (ev) => {
      const row = ev.target.closest('.area-row');
      if (row) chooseArea(row.dataset.area || '');
    });
    el('bulkLast').addEventListener('click', (ev) => {
      const del = ev.target.closest('.brec-del');
      if (del) return bulkDeleteLog(del.dataset.log);
      const use = ev.target.closest('.brec-main');
      if (use) bulkUseCode(use.dataset.code);
    });
    // ปุ่มกากบาทล้างคำค้นหา — Safari บนมือถือไม่แสดงปุ่มล้างของตัวเองให้ ต้องทำเอง
    document.querySelectorAll('.search-box, .combo-search-box').forEach((box) => {
      const input = box.querySelector('input');
      const btn = box.querySelector('.search-clear');
      if (!input || !btn) return;
      const sync = () => btn.classList.toggle('hidden', !input.value);
      input.addEventListener('input', sync);
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));   // เรียก handler เดิมของช่องนั้น
        input.focus();
        sync();
      });
      sync();
    });
    el('colPanel').addEventListener('click', (ev) => ev.stopPropagation());
    el('actList').addEventListener('click', (ev) => ev.stopPropagation());
    applyTheme(cacheGet('avTheme') || 'porcelain');
    // คอลัมน์ที่ผู้ใช้เลือกไว้เอง (ต่อประเภททรัพย์สิน)
    ['FIXED', 'RENTAL'].forEach((t) => {
      const saved = cacheGet('avCols_' + t);
      if (Array.isArray(saved)) state.ui.cols[t] = saved;
    });
    hydrateIcons();
    enhanceAllSelects();
    const savedView = cacheGet('avView');
    if (savedView === 'card' || savedView === 'table') setView(savedView);
    boot();
  }
  document.addEventListener('DOMContentLoaded', init);

  return {
    setAuthMode, submitAuth, logout, togglePassword,
    showAccessReq, closeAccessReq, approveAccess, rejectAccess, deleteProfileAccount,
    go, refreshAll, flushQueueNow,
    setHomeSearch, setHomeStatus, setHomeSort, openSession, deleteSession,
    readMasterFile, confirmImport, cancelImport, openAppendImport, confirmAppend,
    setType, setView, setSearch, setCat, setStaff, setArea, setSort, setStatus, setSelectedArea,
    openAreaPicker, closeAreaPicker, setAreaPickSearch, showMore, useLastArea,
    openQueuePanel, closeQueuePanel, retryQueue, dropQueueItem, dropAllQueue, setCountCustom,
    setMapWho, setMapRange, setMapArea,
    toggleColPicker, closeColPicker, toggleCol, pickAllCols, resetCols,
    openCountSheet, closeCount, setCountCat, adjustCount, saveCountEntry, deleteCountEntry,
    addCountPhotos, removeCountPhoto, grabCountGps, openCountPhotos, retryGps,
    setActWho, setActResult, setActRange, setActSort, setActSearch,
    clearSelection, applySelection, quickSave, deleteSelectedHistory, setTheme,
    openAsset, closeRecord, chooseResult, saveRecord,
    addPhotos, removePhoto, viewPhoto, openPhotos, photoNav, closePhotos, deleteLogEntry,
    openScanner, closeScanner, resumeScan, scanUnlisted, toggleTorch, scanFromPhoto,
    hideScanTips, dupChoose,
    openBulk, closeBulk, setBulkResult, bulkSubmit, pickChoose,
    toggleCatPicker, closeCatPicker, renderCatPicker, toggleCat, pickAllCats,
    formatBulkTail, insertYY, insertN, setBulkAuto,
    openUnlisted, exportExcel, exportLayoutImage, toggleSection,
    setUserField, clearLocalCache
  };
})();
