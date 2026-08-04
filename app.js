/**
 * Asset Verification — UI logic
 * โครงสร้าง: หน้าหลัก (เลือกรอบตรวจ) → รายการทรัพย์สินของรอบ (ตาราง/การ์ด) → สรุปผล
 * ต้องโหลดหลัง: supabase-js, config.js, src/assetStore.js
 */
const App = (() => {
  'use strict';

  const APP_VERSION = 'v2.3.1';
  const CFG = window.ASSET_CONFIG || {};

  // รูปแบบรหัสทรัพย์สิน (derive จากข้อมูลจริง — ส่วนปีมีค่า "YY" ได้)
  const INV_RE = /RT-[A-Z0-9]{4}-[A-Z0-9]{2}-\d{4}/;

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
    alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>'
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
    queueItems: [],
    latest: new Map(),
    selection: new Set(),
    users: [],
    authMode: 'login',
    page: 'home',
    home: { q: '', status: '', sort: 'created' },
    ui: { type: 'FIXED', view: 'table', q: '', cat: '', staff: '', status: '', sort: 'inv' },
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
  function toast(msg, kind) {
    const box = document.createElement('div');
    box.className = 'toast' + (kind ? ' ' + kind : '');
    box.textContent = msg;
    el('toastContainer').appendChild(box);
    setTimeout(() => { box.remove(); }, 3600);
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
    zxing: { url: 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js', global: 'ZXing' }
  };
  const libLoading = {};
  function ensureLibrary(name) {
    const lib = LIBS[name];
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
    el('syncChip').classList.toggle('hidden', n === 0);
    const net = el('netChip');
    net.className = 'net-chip ' + (navigator.onLine ? 'online' : 'offline');
    net.title = navigator.onLine ? 'ออนไลน์' : 'ออฟไลน์ — บันทึกได้ ระบบจะส่งให้เมื่อกลับมาออนไลน์';
  }
  async function flushQueue() {
    if (state.flushing || !navigator.onLine || !state.queueItems.length) { updateSyncChip(); return; }
    state.flushing = true;
    updateSyncChip();
    let sent = 0;
    try {
      const items = state.queueItems.slice();
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        try {
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
          sent++;
        } catch (e) {
          it.lastError = e.message;
          try { await qPut(it); } catch (e2) {}
          break;   // เน็ตหลุด/สิทธิ์ไม่พอ — หยุดรอบนี้ไว้ retry ภายหลัง
        }
      }
    } finally {
      state.flushing = false;
      updateSyncChip();
      if (sent) { afterDataChange(); toast('ส่งผลตรวจค้างส่งแล้ว ' + sent + ' รายการ', 'success'); }
    }
  }
  function flushQueueNow() {
    if (!navigator.onLine) return toast('ยังออฟไลน์อยู่ — จะส่งให้อัตโนมัติเมื่อเน็ตกลับมา', 'warn');
    flushQueue();
  }

  // ── รวม log จริง + คิวรอส่ง → สถานะล่าสุดต่อรหัส ─────────────────────────────
  function queueToLog(it) {
    return {
      logId: 'pending-' + it.clientId, clientId: it.clientId, sessionId: it.sessionId,
      inventoryNumber: it.inventoryNumber, assetType: it.assetType,
      result: it.result, condition: it.condition, method: it.method,
      inspector: it.inspector, locationText: it.locationText, pieceNo: it.pieceNo || 1,
      moveToSite: it.moveToSite, moveDocNo: it.moveDocNo, moveDate: it.moveDate,
      note: it.note, unregistered: it.unregistered, unlistedDesc: it.unlistedDesc,
      verifiedAt: it.verifiedAt, photoPaths: [],
      photoCount: (it.photos || []).length, pending: true
    };
  }
  function queueOfSession(id) {
    return state.queueItems.filter((q) => q.sessionId === id).map(queueToLog);
  }
  function allLogs() {
    const id = state.activeSession ? state.activeSession.sessionId : null;
    return state.logs.concat(queueOfSession(id));
  }
  function rebuildIndex() {
    const map = new Map();
    const piecesSeen = new Map();      // inv → Set(pieceNo)
    allLogs().forEach((l) => {
      const cur = map.get(l.inventoryNumber);
      if (!cur || String(l.verifiedAt) >= String(cur.verifiedAt)) map.set(l.inventoryNumber, l);
      const set = piecesSeen.get(l.inventoryNumber) || new Set();
      set.add(Number(l.pieceNo) > 0 ? Number(l.pieceNo) : 1);
      piecesSeen.set(l.inventoryNumber, set);
    });
    // แนบจำนวนชิ้นที่บันทึกไว้ให้ record ล่าสุด เพื่อให้ตาราง/สรุปใช้ได้ทันที
    map.forEach((l, inv) => {
      const set = piecesSeen.get(inv);
      l.pieces = set ? set.size : 1;
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
  // ── RT code ที่ใช้ซ้ำหลายชิ้น ────────────────────────────────────────────────
  /** รวม record ของ RT code หนึ่ง แล้วสรุปเป็น "ชิ้น" (piece) ตาม pieceNo */
  function piecesOf(inv) {
    const rows = allLogs().filter((l) => l.inventoryNumber === inv);
    const byPiece = new Map();
    rows.forEach((l) => {
      const p = Number(l.pieceNo) > 0 ? Number(l.pieceNo) : 1;
      const cur = byPiece.get(p);
      if (!cur || String(l.verifiedAt) >= String(cur.verifiedAt)) byPiece.set(p, l);
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
            AssetStore.loadMaster(fresh.sessionId), AssetStore.loadLogs(fresh.sessionId)]);
          state.master = data[0];
          state.logs = data[1];
          cacheSet('avMaster_' + fresh.sessionId, state.master);
          cacheSet('avLogs_' + fresh.sessionId, state.logs);
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
      state.channel = AssetStore.subscribeLogs(id, (log) => {
        addLogLocal(log);
        cacheSet('avLogs_' + id, state.logs);
        afterDataChange();
      });
    } catch (e) {}
  }
  function afterDataChange() {
    rebuildIndex();
    renderFilterOptions();
    renderLocList();
    renderRoundBanner();
    renderList();
    renderSessions();
    if (state.page === 'dash') renderDash();
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
      const cur = latest.get(l.inventoryNumber);
      if (!cur || String(l.verifiedAt) >= String(cur.verifiedAt)) latest.set(l.inventoryNumber, l);
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
    state.master = cacheGet('avMaster_' + id) || [];
    state.logs = cacheGet('avLogs_' + id) || [];
    afterDataChange();
    go(target || 'list');
    try {
      busy('กำลังโหลดทะเบียนของรอบนี้...');
      const data = await Promise.all([AssetStore.loadMaster(id), AssetStore.loadLogs(id)]);
      state.master = data[0];
      state.logs = data[1];
      cacheSet('avMaster_' + id, state.master);
      cacheSet('avLogs_' + id, state.logs);
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
      try { localStorage.removeItem('avMaster_' + id); localStorage.removeItem('avLogs_' + id); } catch (e) {}
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
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    let hr = -1, invCol = -1;
    for (let r = 0; r < Math.min(rows.length, 20); r++) {
      const c = (rows[r] || []).findIndex((v) => normHead(v) === 'INVENTORY NUMBER');
      if (c >= 0) { hr = r; invCol = c; break; }
    }
    if (hr < 0) return null;
    const width = Math.max((rows[hr] || []).length, (rows[hr + 1] || []).length);
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
    const cols = isRental
      ? { material: col(['MATERIAL']), desc: col(['DESCRIPTION']),
          plant: col(['PLAN', 'PLANT']), sloc: col(['SLOC']) }
      : { assetClass: col(['ASSET CLASS']), assetNumber: col(['ASSET NUMBER']),
          subNumber: col(['SUB NUMB', 'SUB NUMBER']), desc: col(['DESCRIPTION']),
          serial: col(['SERIAL NUMBER']), staff: col(['STAFF - TEXT', 'STAFF-TEXT', 'STAFF TEXT']),
          site: col(['CURRENT SITE']) };
    // หา Site/Cost center จากหัวรายงาน (แถวบนก่อนหัวตาราง)
    let costCenter = '';
    for (let r = 0; r < hr; r++) {
      const line = (rows[r] || []).join(' ');
      const m = line.match(/R-[A-Z0-9]{3,6}-[A-Z0-9]+/i) ||
        line.match(/Site\/Cost center[.\s]*([A-Z0-9-]{3,})/i);
      if (m) { costCenter = (m[1] || m[0]).replace(/\.+$/, '').toUpperCase(); break; }
    }
    const items = [];
    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const inv = normalizeCode(row[invCol]);
      if (!inv) continue;
      const item = {
        inventoryNumber: inv,
        assetType: isRental ? 'RENTAL' : 'FIXED',
        categoryCode: inv.split('-')[1] || '',
        description: cell(row, cols.desc)
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
    return { type: isRental ? 'RENTAL' : 'FIXED', items: items, costCenter: costCenter };
  }
  async function readMasterFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      busy('กำลังอ่านไฟล์...');
      await ensureLibrary('xlsx');
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: 'array' });
      const byInv = new Map();
      let costCenter = '';
      const used = [];
      const skipped = [];
      wb.SheetNames.forEach((name) => {
        const parsed = parseSheet(wb.Sheets[name]);
        if (!parsed || parsed.skipped || !parsed.items.length) {
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
        used.push({ name: name, count: added, type: parsed.type });
      });
      const rows = Array.from(byInv.values());
      if (!rows.length) {
        throw new Error('ไม่พบทะเบียนทรัพย์สินในไฟล์ — ต้องมีชีทที่มีหัวคอลัมน์ "Inventory Number" ' +
          'คู่กับ "Asset Number" (Fixed Assets) หรือ "Material" (ของเช่า)');
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
        '<br>อ่านจากชีท: ' + used.map((u) => esc(u.name) + ' (' +
          (u.type === 'RENTAL' ? 'ของเช่า ' : 'Fixed ') + u.count + ')').join(' · ') +
        (skipped.length ? '<br><span class="hint-inline">ข้ามชีทที่ไม่ใช่ทะเบียน: ' +
          esc(skipped.join(', ')) + '</span>' : '') +
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
      el('uploadZoneText').textContent = 'แตะเพื่อเลือกไฟล์ทะเบียนทรัพย์สิน';
      toast(e.message, 'error');
    } finally {
      busyHide();
    }
  }
  function cancelImport() {
    state.importData = null;
    el('importPreview').classList.add('hidden');
    el('roundForm').classList.add('hidden');
    el('uploadZoneText').textContent = 'แตะเพื่อเลือกไฟล์ทะเบียนทรัพย์สิน';
    go('home');
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

    el('tabCountF').textContent = state.master.filter((a) => a.assetType === 'FIXED').length;
    el('tabCountR').textContent = state.master.filter((a) => a.assetType === 'RENTAL').length;
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
  function filteredAssets() {
    const ui = state.ui;
    let list = mastersOfType();
    if (ui.cat) list = list.filter((a) => (a.categoryCode || '') === ui.cat);
    if (ui.staff) {
      list = ui.staff === '__NONE__'
        ? list.filter((a) => !(a.staffText || '').trim())
        : list.filter((a) => (a.staffText || '').trim() === ui.staff);
    }
    if (ui.q) {
      const words = ui.q.toUpperCase().split(/\s+/).filter(Boolean);
      list = list.filter((a) => {
        const hay = [a.inventoryNumber, a.description, a.staffText, a.serialNumber,
          a.assetNumber, a.materialCode].join(' ').toUpperCase();
        return words.every((w) => hay.indexOf(w) >= 0);
      });
    }
    if (ui.status) {
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
  function statusCell(latest) {
    const cls = classify(latest);
    const n = latest && latest.pieces > 1 ? latest.pieces : 0;
    return '<span class="pill st-' + cls + '">' + esc(statusLabel(latest)) + '</span>' +
      (n ? '<span class="dup-badge" title="RT code นี้ถูกบันทึก ' + n + ' ชิ้น">× ' + n + '</span>' : '');
  }
  function verifyMeta(l) {
    if (!l) return '<span class="text-faint">—</span>';
    return '<span class="vmeta">' + esc(l.inspector || '') +
      '<small>' + esc(thaiDT(l.verifiedAt)) +
      ' · <b class="m-' + (l.method === 'SCAN' ? 'scan' : 'manual') + '">' + l.method + '</b>' +
      (l.pending ? ' · <b class="pending-sync">รอส่ง</b>' : '') + '</small></span>';
  }
  function renderList() {
    if (!state.activeSession) {
      el('assetTbody').innerHTML = '';
      el('cardWrap').innerHTML = '';
      return;
    }
    const list = filteredAssets();
    let done = 0;
    list.forEach((a) => {
      if (classify(state.latest.get(a.inventoryNumber)) !== 'pending') done++;
    });
    el('counter').textContent = 'ตรวจแล้ว ' + done + ' / ' + list.length;
    const isFixed = state.ui.type === 'FIXED';
    const tableMode = state.ui.view === 'table';
    el('tableWrap').classList.toggle('hidden', !tableMode);
    el('cardWrap').classList.toggle('hidden', tableMode);

    if (tableMode) {
      // ── โครงตารางยึดตามฟอร์มรายงานตรวจสอบทรัพย์สินต้นฉบับ (.xls) ──
      const allSel = list.length > 0 && list.every((a) => state.selection.has(a.inventoryNumber));
      const chk = state.canWrite ? '<th class="col-check" rowspan="2"><input type="checkbox" id="checkAll"' +
        (allSel ? ' checked' : '') + ' title="เลือกทั้งหมดที่กรองอยู่"></th>' : '';
      el('assetThead').innerHTML = isFixed
        ? '<tr>' + chk +
            '<th rowspan="2" class="c-lg">NO.</th>' +
            '<th rowspan="2" class="c-lg">Asset Class</th>' +
            '<th rowspan="2" class="c-lg">Asset Number</th>' +
            '<th rowspan="2" class="c-xl">Sub Numb</th>' +
            '<th rowspan="2" class="th-inv">Inventory Number</th>' +
            '<th rowspan="2" class="th-desc">Description</th>' +
            '<th rowspan="2" class="c-xl">Serial Number</th>' +
            '<th rowspan="2" class="c-md">Staff – Text</th>' +
            '<th rowspan="2" class="c-xl">Current Site</th>' +
            '<th colspan="2" class="yn-group">ผลการตรวจเช็ค</th>' +
            '<th colspan="3" class="c-lg">ย้ายออก</th>' +
            '<th rowspan="2" class="c-lg">หมายเหตุ</th>' +
            '<th rowspan="2" class="col-more"></th>' +
          '</tr><tr>' +
            '<th class="col-yn yn-yes">Yes</th><th class="col-yn yn-no">No</th>' +
            '<th class="c-lg">ส่งไป SITE</th><th class="c-lg">เลขที่ใบส่ง</th><th class="c-lg">วันที่ส่ง</th>' +
          '</tr>'
        : '<tr>' + chk +
            '<th rowspan="2" class="c-lg">NO.</th>' +
            '<th rowspan="2" class="c-md">Material</th>' +
            '<th rowspan="2" class="th-desc">Description</th>' +
            '<th rowspan="2" class="th-inv">Inventory Number</th>' +
            '<th rowspan="2" class="c-xl">Plan</th>' +
            '<th rowspan="2" class="c-xl">Sloc</th>' +
            '<th colspan="2" class="yn-group">ผลการตรวจเช็ค</th>' +
            '<th colspan="3" class="c-lg">ย้ายออก</th>' +
            '<th rowspan="2" class="c-lg">หมายเหตุ</th>' +
            '<th rowspan="2" class="col-more"></th>' +
          '</tr><tr>' +
            '<th class="col-yn yn-yes">Yes</th><th class="col-yn yn-no">No</th>' +
            '<th class="c-lg">ส่งไป SITE</th><th class="c-lg">เลขที่ใบส่ง</th><th class="c-lg">วันที่ส่ง</th>' +
          '</tr>';

      const cell = (v, cls) => '<td class="' + (cls || '') + '">' + esc(v || '—') + '</td>';
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
        const mv = cls === 'moved' ? latest : null;
        const info = latest
          ? '<small class="row-meta">' + esc(latest.inspector || '') + ' · ' +
            esc(thaiDT(latest.verifiedAt)) + (latest.pending ? ' · รอส่ง' : '') + '</small>'
          : '';
        return '<tr class="row-' + cls + (sel ? ' row-selected' : '') + '" data-inv="' + inv + '">' +
          (state.canWrite ? '<td class="col-check"><input type="checkbox" class="row-check" data-inv="' +
            inv + '"' + (sel ? ' checked' : '') + '></td>' : '') +
          '<td class="c-lg num">' + (i + 1) + '</td>' +
          (isFixed
            ? cell(a.assetClass, 'c-lg') + cell(a.assetNumber, 'c-lg mono') +
              cell(a.subNumber, 'c-xl') +
              '<td class="mono nowrap inv-cell">' + inv +
                '<span class="sm-status">' + statusCell(latest) + '</span></td>' +
              '<td class="col-desc">' + esc(a.description || '') + info + '</td>' +
              cell(a.serialNumber, 'c-xl') + cell((a.staffText || '').trim(), 'c-md') +
              cell(a.currentSite, 'c-xl')
            : cell(a.materialCode, 'c-md mono') +
              '<td class="col-desc">' + esc(a.description || '') + info + '</td>' +
              '<td class="mono nowrap inv-cell">' + inv +
                '<span class="sm-status">' + statusCell(latest) + '</span></td>' +
              cell(a.plant, 'c-xl') + cell(a.sloc, 'c-xl')) +
          ynYes + ynNo +
          cell(mv ? mv.moveToSite : '', 'c-lg') +
          cell(mv ? mv.moveDocNo : '', 'c-lg') +
          cell(mv && mv.moveDate ? thaiD(mv.moveDate) : '', 'c-lg') +
          cell(latest ? latest.note : '', 'c-lg note-cell') +
          '<td class="col-more"><button class="qbtn more" data-act="open" title="รายละเอียด / ย้ายออก / รูปถ่าย">' + icon('more') + '</button></td>' +
          '</tr>';
      }).join('') || '<tr><td colspan="16"><p class="empty-note">ไม่พบรายการตามเงื่อนไข</p></td></tr>';
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
            (latest.pending ? ' · <b class="pending-sync">รอส่ง</b>' : '') + '</div>' : '') +
          '</div>';
      }).join('') || '<p class="empty-note">ไม่พบรายการตามเงื่อนไข</p>';
    }
    updateBulkBar();
  }
  function setType(t) {
    state.ui.type = t;
    state.selection.clear();
    el('typeFIXED').classList.toggle('active', t === 'FIXED');
    el('typeRENTAL').classList.toggle('active', t === 'RENTAL');
    renderFilterOptions();
    renderList();
  }
  function setView(v) {
    state.ui.view = v;
    cacheSet('avView', v);
    el('viewTable').classList.toggle('active', v === 'table');
    el('viewCard').classList.toggle('active', v === 'card');
    renderList();
  }
  function setSearch(v) { state.ui.q = v.trim(); renderList(); }
  function setCat(v) { state.ui.cat = v; renderList(); }
  function setStaff(v) { state.ui.staff = v; renderList(); }
  function setSort(v) { state.ui.sort = v; renderList(); }
  function setStatus(v) {
    state.ui.status = v;
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
    if (location) cacheSet('avLastLocation', location);
    busy('กำลังบันทึก ' + invs.length + ' รายการ...');
    let n = 0;
    for (let i = 0; i < invs.length; i++) {
      const asset = state.master.find((a) => a.inventoryNumber === invs[i]);
      if (!asset) continue;
      const pieceNo = await resolvePiece(invs[i], { dupMode: dupMode });
      if (pieceNo === null) continue;
      await queueRecord({
        inventoryNumber: invs[i], assetType: asset.assetType, pieceNo: pieceNo,
        resultKey: resultKey, method: 'MANUAL', locationText: location
      });
      n++;
    }
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
      locationText: (el('bulkBarLocation').value || cacheGet('avLastLocation') || '').trim()
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
    if ((page === 'list' || page === 'dash') && !state.activeSession) {
      toast('เลือกรอบตรวจก่อน', 'warn');
      page = 'home';
    }
    state.page = page;
    ['home', 'upload', 'list', 'dash', 'manage'].forEach((p) => {
      const sec = el('page-' + p);
      if (sec) sec.classList.toggle('active', p === page);
      const nav = el('nav-' + p);
      if (nav) nav.classList.toggle('active', p === page);
    });
    el('backHome').classList.toggle('hidden', page === 'home');
    const s = state.activeSession;
    if ((page === 'list' || page === 'dash') && s) {
      el('topKicker').textContent = 'โครงการที่กำลังตรวจ';
      el('topTitle').textContent = s.site + (s.roundName ? ' · ' + s.roundName : '');
    } else if (page === 'upload') {
      el('topKicker').textContent = 'NEW ROUND';
      el('topTitle').textContent = 'สร้างรอบตรวจใหม่';
    } else {
      el('topKicker').textContent = 'ASSET INSPECTION';
      el('topTitle').textContent = 'ระบบตรวจนับทรัพย์สิน';
    }
    if (page === 'dash') renderDash();
    if (page === 'manage') renderManage();
    if (page === 'list') updateBulkBar(); else el('bulkBar').classList.add('hidden');
    window.scrollTo(0, 0);
  }

  // ── ฟอร์มบันทึกผลตรวจ ──────────────────────────────────────────────────────
  function renderHistory(inv) {
    const items = allLogs().filter((l) => l.inventoryNumber === inv)
      .sort((a, b) => String(b.verifiedAt).localeCompare(String(a.verifiedAt)));
    if (!items.length) { el('recHistory').innerHTML = ''; return; }
    const isAdmin = state.profile && state.profile.role === 'admin';
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
          '<a href="#" class="photo-link" data-path="' + esc(p) + '">' + icon('camera') + ' รูป ' + (i + 1) + '</a>').join('') +
        (l.pending ? '<span class="pending-sync">' + icon('clock') + ' รอส่ง' +
          (l.photoCount ? ' (' + l.photoCount + ' รูป)' : '') + '</span>' : '') +
        (isAdmin && !l.pending
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
    el('unlistedFields').classList.add('hidden');
    el('recForm').classList.toggle('hidden', !state.canWrite);
    el('recordModal').classList.remove('hidden');
    startGps();
  }
  function openUnlisted(code, method) {
    if (!state.canWrite) return;
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
    el('unlistedFields').classList.remove('hidden');
    el('unlInv').value = code || '';
    el('unlDesc').value = '';
    el('recForm').classList.remove('hidden');
    el('recordModal').classList.remove('hidden');
    startGps();
    if (!code) setTimeout(() => el('unlInv').focus(), 150);
  }
  function resetRecForm() {
    document.querySelectorAll('#resultSeg .seg').forEach((s) => s.classList.remove('active'));
    el('movedFields').classList.add('hidden');
    el('moveSite').value = '';
    el('moveDoc').value = '';
    el('moveDate').value = todayISO();
    el('recLocation').value = cacheGet('avLastLocation') || '';
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
  function startGps() {
    if (!state.rec) return;
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
      el('gpsLine').innerHTML = icon('pin') + ' ได้พิกัดแล้ว (±' + rec.gps.acc + ' ม.)';
      el('gpsLine').className = 'gps-line ok';
    }, () => {
      if (state.rec !== rec) return;
      el('gpsLine').innerHTML = icon('pin') + ' ไม่ได้พิกัด GPS (ข้ามได้ ไม่บังคับ)';
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
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
    if (location) cacheSet('avLastLocation', location);
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
    if (!state.profile || state.profile.role !== 'admin') return;
    if (!window.confirm('ลบรายการตรวจนี้ถาวร? (ใช้เฉพาะกรณีบันทึกผิดจริง)')) return;
    try {
      busy('กำลังลบ...');
      await AssetStore.deleteLog(logId);
      state.logs = state.logs.filter((l) => l.logId !== logId);
      state.logSummary = state.logSummary.filter((l) => l.logId !== logId);
      if (state.activeSession) cacheSet('avLogs_' + state.activeSession.sessionId, state.logs);
      afterDataChange();
      if (state.rec && state.rec.asset) renderHistory(state.rec.asset.inventoryNumber);
      toast('ลบแล้ว', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { busyHide(); }
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
    el('bulkLocation').value = cacheGet('avLastLocation') || '';
    el('bulkLast').textContent = '';
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
    const m = s.match(/^([A-Z0-9]{2})-?(\d{1,4})$/);
    if (!m) return {};
    const tail = m[1] + '-' + m[2].padStart(4, '0');
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
    if (location) cacheSet('avLastLocation', location);
    try {
      await queueRecord({
        inventoryNumber: code, assetType: asset.assetType, pieceNo: pieceNo,
        resultKey: state.bulk.resultKey, method: 'MANUAL', locationText: location
      });
    } catch (e) {
      return toast('บันทึกลงเครื่องไม่ได้: ' + e.message, 'error');
    }
    state.bulk.count++;
    afterDataChange();
    updateBulkView();
    el('bulkLast').innerHTML = icon('check') + ' ล่าสุด: <b class="mono">' + esc(code) + '</b>' +
      (pieceNo > 1 ? ' <b>ชิ้นที่ ' + pieceNo + '</b>' : '') +
      ' (' + RESULTS[state.bulk.resultKey].label + ') ' + thaiDT(new Date().toISOString());
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
      '</div>' +
      '<div class="dash-card wide"><h4>รายการตรวจล่าสุด</h4>' +
        (recent ? '<div class="table-wrap flat"><table class="asset-table mini"><thead><tr>' +
          '<th>รหัส</th><th>ชื่อทรัพย์สิน</th><th>ผล</th><th class="c-md">ผู้ตรวจ</th>' +
          '<th class="c-md">เวลา</th></tr></thead><tbody>' + recent + '</tbody></table></div>'
          : '<p class="hint">ยังไม่มีการตรวจในรอบนี้</p>') + '</div>' +
      dashList('pf', icon('square') + ' ยังไม่ตรวจ — Fixed Assets', pendF.map(pendingRow)) +
      dashList('pr', icon('square') + ' ยังไม่ตรวจ — ของเช่า', pendR.map(pendingRow)) +
      dashList('nf', icon('close') + ' ไม่พบ', notFound) +
      dashList('mv', icon('truck') + ' ย้ายออกไปไซต์อื่น', moved) +
      dashList('un', icon('plus') + ' ทรัพย์สินนอกทะเบียน', unl);
  }
  function toggleSection(id) {
    const b = el('coll-' + id);
    if (b) b.classList.toggle('hidden');
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
  const EXTRA_HEAD = ['จำนวนที่บันทึก (ชิ้น)', 'ผู้บันทึก', 'เวลาที่บันทึก', 'ตำแหน่งที่ตรวจ', 'วิธี'];
  const THIN = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

  function styleHeadCell(cell, fill) {
    cell.font = { name: 'Tahoma', size: 9, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill || 'FFEDF1F7' } };
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
      }

      // ══ ชีท 2: ทรัพย์สิน Fixed Assets (ฟอร์มเดิม + คอลัมน์เสริม) ══
      const fixedRows = state.master.filter((a) => a.assetType === 'FIXED').map((a, i) => {
        const y = reportCells(a);
        return [i + 1, a.assetClass || '', a.assetNumber || '', a.subNumber || '',
          a.inventoryNumber, a.description || '', a.serialNumber || '', a.staffText || '',
          a.currentSite || '', y.yes, y.no, y.site, y.doc, y.date, y.note,
          y.pieces, y.by, y.at, y.where, y.how];
      });
      buildFormSheet(wb, s, {
        sheetName: 'ทรัพย์สิน Fixed Assets',
        title: 'รายงานการตรวจสอบทรัพย์สิน Fixed Assets',
        widths: [5, 10, 13, 8, 19, 34, 15, 20, 15, 6, 6, 12, 13, 13, 30, 9, 20, 18, 18, 9],
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
          y.pieces, y.by, y.at, y.where, y.how];
      });
      buildFormSheet(wb, s, {
        sheetName: 'ทรัพย์สินของเช่า',
        title: 'รายงานการตรวจสอบทรัพย์สิน ของเช่า',
        widths: [5, 14, 34, 19, 8, 8, 6, 6, 12, 13, 13, 30, 9, 20, 18, 18, 9],
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
      const hist = wb.addWorksheet('ประวัติการตรวจทั้งหมด', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });
      const histHead = ['เวลาที่บันทึก', 'RT code', 'ชิ้นที่', 'ประเภท', 'ผล', 'วิธี', 'ผู้บันทึก',
        'ตำแหน่งที่ตรวจ', 'ส่งไป SITE', 'เลขที่ใบส่ง', 'วันที่ส่ง', 'GPS', 'หมายเหตุ',
        'นอกทะเบียน', 'คำอธิบายนอกทะเบียน', 'จำนวนรูป', 'สถานะส่ง'];
      [20, 19, 7, 12, 14, 9, 22, 20, 12, 13, 13, 20, 30, 10, 26, 9, 10]
        .forEach((w, i) => { hist.getColumn(i + 1).width = w; });
      histHead.forEach((h, i) => {
        const cell = hist.getCell(1, i + 1);
        cell.value = h;
        styleHeadCell(cell);
      });
      logsAll.slice().sort((a, b) => String(a.verifiedAt).localeCompare(String(b.verifiedAt)))
        .forEach((l, i) => {
          const row = [thaiDT(l.verifiedAt), l.inventoryNumber, Number(l.pieceNo) || 1,
            l.assetType === 'RENTAL' ? 'ของเช่า' : (l.assetType === 'UNLISTED' ? 'นอกทะเบียน' : 'Fixed'),
            statusLabel(l), l.method, l.inspector || '', l.locationText || '',
            l.moveToSite || '', l.moveDocNo || '', l.moveDate ? thaiD(l.moveDate) : '',
            l.gpsLat != null ? l.gpsLat + ',' + l.gpsLng : '', l.note || '',
            l.unregistered ? 'ใช่' : '', l.unlistedDesc || '',
            (l.photoPaths || []).length || l.photoCount || 0,
            l.pending ? 'รอส่ง' : 'ส่งแล้ว'];
          row.forEach((v, c) => {
            const cell = hist.getCell(2 + i, c + 1);
            cell.value = v === '' ? null : v;
            cell.font = { name: 'Tahoma', size: 9 };
            cell.border = BORDER;
          });
        });
      hist.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: histHead.length } };

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
      const row = ev.target.closest('.asset-row');
      if (row) openAsset(row.dataset.inv);
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
      if (link) { ev.preventDefault(); return viewPhoto(link.dataset.path); }
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
    applyTheme(cacheGet('avTheme') || 'porcelain');
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
    readMasterFile, confirmImport, cancelImport,
    setType, setView, setSearch, setCat, setStaff, setSort, setStatus,
    clearSelection, applySelection, quickSave, deleteSelectedHistory, setTheme,
    openAsset, closeRecord, chooseResult, saveRecord,
    addPhotos, removePhoto, viewPhoto, deleteLogEntry,
    openScanner, closeScanner, resumeScan, scanUnlisted, toggleTorch, scanFromPhoto,
    hideScanTips, dupChoose,
    openBulk, closeBulk, setBulkResult, bulkSubmit, pickChoose,
    toggleCatPicker, closeCatPicker, renderCatPicker, toggleCat, pickAllCats,
    formatBulkTail, insertYY, setBulkAuto,
    openUnlisted, exportExcel, toggleSection,
    setUserField, clearLocalCache
  };
})();
