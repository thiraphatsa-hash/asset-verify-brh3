/**
 * Asset Verification — UI logic
 * โครงสร้าง: หน้าหลัก (เลือกรอบตรวจ) → รายการทรัพย์สินของรอบ (ตาราง/การ์ด) → สรุปผล
 * ต้องโหลดหลัง: supabase-js, config.js, src/assetStore.js
 */
const App = (() => {
  'use strict';

  const APP_VERSION = 'v2.0.0';
  const CFG = window.ASSET_CONFIG || {};

  // รูปแบบรหัสทรัพย์สิน (derive จากข้อมูลจริง — ส่วนปีมีค่า "YY" ได้)
  const INV_RE = /RT-[A-Z0-9]{4}-[A-Z0-9]{2}-\d{4}/;

  const RESULTS = {
    FOUND_NORMAL:  { result: 'FOUND',     condition: 'NORMAL',  label: 'พบ · ปกติ',  cls: 'found' },
    FOUND_DAMAGED: { result: 'FOUND',     condition: 'DAMAGED', label: 'พบ · ชำรุด', cls: 'damaged' },
    NOT_FOUND:     { result: 'NOT_FOUND', condition: null,      label: 'ไม่พบ',      cls: 'notfound' },
    MOVED:         { result: 'MOVED',     condition: null,      label: 'ย้ายออก',    cls: 'moved' }
  };
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
    scan: { active: false, paused: false, stream: null, reader: null, timer: null, lastCode: '' },
    bulk: { cat: '', resultKey: 'FOUND_NORMAL', count: 0 },
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
      inspector: it.inspector, locationText: it.locationText,
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
    allLogs().forEach((l) => {
      const cur = map.get(l.inventoryNumber);
      if (!cur || String(l.verifiedAt) >= String(cur.verifiedAt)) map.set(l.inventoryNumber, l);
    });
    state.latest = map;
  }
  function addLogLocal(log) {
    if (!log || !log.logId) return;
    const active = state.activeSession ? state.activeSession.sessionId : null;
    if (log.sessionId && active && log.sessionId !== active) return;
    const dup = state.logs.some((l) => l.logId === log.logId ||
      (log.clientId && l.clientId === log.clientId));
    if (!dup) state.logs.push(log);
  }
  function classify(log) {
    if (!log) return 'pending';
    if (log.result === 'FOUND') return log.condition === 'DAMAGED' ? 'damaged' : 'found';
    if (log.result === 'NOT_FOUND') return 'notfound';
    if (log.result === 'MOVED') return 'moved';
    return 'pending';
  }
  function statusLabel(log) {
    const c = classify(log);
    if (c === 'pending') return 'ยังไม่ตรวจ';
    if (c === 'found') return 'พบ · ปกติ';
    if (c === 'damaged') return 'พบ · ชำรุด';
    if (c === 'notfound') return 'ไม่พบ';
    return 'ย้ายออก' + (log.moveToSite ? ' → ' + log.moveToSite : '');
  }

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
    btn.textContent = show ? '🙈' : '👁';
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
    let found = 0, damaged = 0, notfound = 0, moved = 0;
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
      else if (c === 'damaged') damaged++;
      else if (c === 'notfound') notfound++;
      else if (c === 'moved') moved++;
    });
    const total = s.assetCount || 0;
    const done = Math.min(seen.size, total || seen.size);
    return {
      total: total, done: done, pending: Math.max(total - done, 0),
      found: found, damaged: damaged, notfound: notfound, moved: moved,
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
        '<p class="sc-meta">📅 ' + esc(dates) + ' · 📦 ' + st.total + ' รายการ' +
          ' (Fixed ' + (s.fixedCount || 0) + ' · เช่า ' + (s.rentalCount || 0) + ')' +
          (s.inspectorName ? ' · 👤 ' + esc(s.inspectorName) : '') + '</p>' +
        '<div class="progress-line"><span>ตรวจแล้ว ' + st.done + ' / ' + st.total +
          '</span><span>' + st.pct + '%</span></div>' +
        '<div class="bar"><i class="' + (done ? 'ok' : '') + '" style="width:' + st.pct + '%"></i></div>' +
        '<div class="sc-chips">' +
          '<span class="stat-chip st-found">พบ ' + st.found + '</span>' +
          '<span class="stat-chip st-damaged">ชำรุด ' + st.damaged + '</span>' +
          '<span class="stat-chip st-notfound">ไม่พบ ' + st.notfound + '</span>' +
          '<span class="stat-chip st-moved">ย้ายออก ' + st.moved + '</span>' +
          '<span class="stat-chip st-pending">ค้าง ' + st.pending + '</span>' +
        '</div>' +
        '<div class="sc-actions">' +
          '<button class="primary-button" type="button" data-act="open">เปิดตรวจนับ</button>' +
          '<button class="outline-button" type="button" data-act="dash">Dashboard</button>' +
          (state.canWrite ? '<button class="danger-ghost" type="button" data-act="del" title="ลบรอบนี้">🗑</button>' : '') +
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
    const isRental = col(['MATERIAL']) >= 0;
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
      wb.SheetNames.forEach((name) => {
        const parsed = parseSheet(wb.Sheets[name]);
        if (!parsed) return;
        if (!costCenter && parsed.costCenter) costCenter = parsed.costCenter;
        parsed.items.forEach((it) => { byInv.set(it.inventoryNumber, it); });
      });
      const rows = Array.from(byInv.values());
      if (!rows.length) {
        throw new Error('ไม่พบข้อมูลทรัพย์สินในไฟล์ — ต้องมีหัวคอลัมน์ "Inventory Number"');
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
      el('uploadZoneText').textContent = '📄 ' + file.name;
      el('importPreview').innerHTML =
        'อ่านไฟล์สำเร็จ — <b>' + rows.length + '</b> รายการ ' +
        '(Fixed Assets <b>' + fixed + '</b> · ของเช่า <b>' + rental + '</b>)' +
        (cc ? '<br>Cost center ที่พบในไฟล์: <b>' + esc(cc) + '</b>' : '');
      el('importPreview').classList.remove('hidden');
      el('roundForm').classList.remove('hidden');
      el('roundSite').value = site;
      el('roundCostCenter').value = cc;
      if (!el('roundFrom').value) el('roundFrom').value = todayISO();
      if (!el('roundInspector').value) el('roundInspector').value = inspectorName();
    } catch (e) {
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
        const c = classify(state.latest.get(a.inventoryNumber));
        if (ui.status === 'found') return c === 'found' || c === 'damaged';
        return c === ui.status;
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
    return '<span class="pill st-' + cls + '">' + esc(statusLabel(latest)) + '</span>';
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
      const allSel = list.length > 0 && list.every((a) => state.selection.has(a.inventoryNumber));
      el('assetThead').innerHTML = '<tr>' +
        (state.canWrite ? '<th class="col-check"><input type="checkbox" id="checkAll"' +
          (allSel ? ' checked' : '') + ' title="เลือกทั้งหมดที่กรองอยู่"></th>' : '') +
        '<th>รหัสทรัพย์สิน</th><th>ชื่อทรัพย์สิน</th>' +
        (isFixed ? '<th class="col-hide-sm">ผู้รับผิดชอบ</th>' : '<th class="col-hide-sm">Material</th>') +
        '<th class="col-status">สถานะ</th><th class="col-hide-sm">ตรวจโดย</th>' +
        (state.canWrite ? '<th class="col-quick">บันทึกเร็ว</th>' : '') +
        '</tr>';
      el('assetTbody').innerHTML = list.map((a) => {
        const latest = state.latest.get(a.inventoryNumber);
        const cls = classify(latest);
        const inv = esc(a.inventoryNumber);
        const sel = state.selection.has(a.inventoryNumber);
        return '<tr class="row-' + cls + (sel ? ' row-selected' : '') + '" data-inv="' + inv + '">' +
          (state.canWrite ? '<td class="col-check"><input type="checkbox" class="row-check" data-inv="' +
            inv + '"' + (sel ? ' checked' : '') + '></td>' : '') +
          '<td class="mono nowrap">' + inv + '</td>' +
          '<td class="col-desc">' + esc(a.description || '') +
            (a.serialNumber ? '<small>S/N ' + esc(a.serialNumber) + '</small>' : '') +
            '<span class="sm-status">' + statusCell(latest) + '</span></td>' +
          '<td class="col-hide-sm">' + esc(isFixed
            ? ((a.staffText || '').trim() || '—') : (a.materialCode || '—')) + '</td>' +
          '<td class="col-status">' + statusCell(latest) + '</td>' +
          '<td class="col-hide-sm">' + verifyMeta(latest) + '</td>' +
          (state.canWrite ? '<td class="col-quick">' +
            '<button class="qbtn ok" data-act="FOUND_NORMAL" title="พบ · ปกติ">✓</button>' +
            '<button class="qbtn no" data-act="NOT_FOUND" title="ไม่พบ">✕</button>' +
            '<button class="qbtn more" data-act="open" title="รายละเอียด">⋯</button></td>' : '') +
          '</tr>';
      }).join('') || '<tr><td colspan="7"><p class="empty-note">ไม่พบรายการตามเงื่อนไข</p></td></tr>';
    } else {
      el('cardWrap').innerHTML = list.map((a) => {
        const latest = state.latest.get(a.inventoryNumber);
        const cls = classify(latest);
        const meta = [];
        if (isFixed) {
          if (a.staffText) meta.push('👤 ' + esc(a.staffText));
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
          (latest ? '<div class="asset-meta">🕓 ' + esc(thaiDT(latest.verifiedAt)) + ' · ' +
            esc(latest.inspector || '') + ' · ' + latest.method +
            (latest.locationText ? ' · 📌 ' + esc(latest.locationText) : '') +
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
  }
  async function applySelection(resultKey) {
    const invs = Array.from(state.selection);
    if (!invs.length) return;
    const rk = RESULTS[resultKey];
    const already = invs.filter((i) => state.latest.get(i));
    if (already.length) {
      const ok = window.confirm('ในรายการที่เลือกมี ' + already.length + ' รายการที่ตรวจไปแล้ว\n' +
        'ยืนยันบันทึกซ้ำเป็นรายการใหม่ต่อท้าย?');
      if (!ok) return;
    }
    const location = el('bulkBarLocation').value.trim();
    if (location) cacheSet('avLastLocation', location);
    busy('กำลังบันทึก ' + invs.length + ' รายการ...');
    let n = 0;
    for (let i = 0; i < invs.length; i++) {
      const asset = state.master.find((a) => a.inventoryNumber === invs[i]);
      if (!asset) continue;
      await queueRecord({
        inventoryNumber: invs[i], assetType: asset.assetType,
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
    const latest = state.latest.get(inv);
    if (latest) {
      const ok = window.confirm(inv + ' ตรวจแล้วโดย ' + (latest.inspector || '-') + '\n' +
        thaiDT(latest.verifiedAt) + ' (ผล: ' + statusLabel(latest) + ')\n\nบันทึกซ้ำเป็นรายการใหม่?');
      if (!ok) return;
    }
    await queueRecord({
      inventoryNumber: inv, assetType: asset.assetType, resultKey: resultKey, method: 'MANUAL',
      locationText: (el('bulkBarLocation').value || cacheGet('avLastLocation') || '').trim()
    });
    beep();
    afterDataChange();
    flushQueue();
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
        '<span>👤 ' + esc(l.inspector || '') + '</span>' +
        (l.locationText ? '<span>📌 ' + esc(l.locationText) + '</span>' : '') +
        (l.moveDocNo ? '<span>ใบส่ง ' + esc(l.moveDocNo) + '</span>' : '') +
        (l.moveDate ? '<span>ส่งวันที่ ' + esc(thaiD(l.moveDate)) + '</span>' : '') +
        (l.note ? '<span>📝 ' + esc(l.note) + '</span>' : '') +
        photos.map((p, i) =>
          '<a href="#" class="photo-link" data-path="' + esc(p) + '">📷 รูป ' + (i + 1) + '</a>').join('') +
        (l.pending ? '<span class="pending-sync">⏳ รอส่ง' +
          (l.photoCount ? ' (' + l.photoCount + ' รูป)' : '') + '</span>' : '') +
        (isAdmin && !l.pending
          ? '<button type="button" class="hist-del" data-log="' + esc(l.logId) + '" title="ลบรายการนี้">🗑</button>'
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
      el('recWarn').innerHTML = '⚠ ตรวจแล้วโดย <b>' + esc(latest.inspector || '-') + '</b> เมื่อ ' +
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
    el('gpsLine').textContent = '📍 กำลังหาพิกัด GPS...';
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
      el('gpsLine').textContent = '📍 เครื่องนี้ไม่รองรับ GPS (ข้ามได้ ไม่บังคับ)';
      return;
    }
    const rec = state.rec;
    navigator.geolocation.getCurrentPosition((pos) => {
      if (state.rec !== rec) return;
      rec.gps = {
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        acc: Math.round(pos.coords.accuracy || 0)
      };
      el('gpsLine').textContent = '📍 ได้พิกัดแล้ว (±' + rec.gps.acc + ' ม.)';
      el('gpsLine').className = 'gps-line ok';
    }, () => {
      if (state.rec !== rec) return;
      el('gpsLine').textContent = '📍 ไม่ได้พิกัด GPS (ข้ามได้ ไม่บังคับ)';
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
      '<button type="button" onclick="App.removePhoto(' + i + ')">✕</button></div>').join('');
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
    const latest = state.latest.get(inv);
    if (latest) {
      const okDup = window.confirm('รายการนี้ถูกตรวจแล้วโดย ' + (latest.inspector || '-') +
        ' เมื่อ ' + thaiDT(latest.verifiedAt) + '\nผล: ' + statusLabel(latest) +
        '\n\nยืนยันบันทึกซ้ำเป็นรายการใหม่ต่อท้าย?');
      if (!okDup) return;
    }
    const location = el('recLocation').value.trim();
    if (location) cacheSet('avLastLocation', location);
    try {
      await queueRecord({
        inventoryNumber: inv, assetType: assetType, resultKey: rec.resultKey,
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
  function setScanStatus(text) { el('scanStatus').textContent = text; }
  async function openScanner() {
    if (!state.canWrite) return;
    if (!state.activeSession) return toast('เลือกรอบตรวจก่อนเริ่มสแกน', 'warn');
    el('scannerModal').classList.remove('hidden');
    el('scanNotFound').classList.add('hidden');
    state.scan.active = true;
    state.scan.paused = false;
    setScanStatus('กำลังเปิดกล้อง...');
    try {
      if (!window.isSecureContext) {
        throw new Error('กล้องใช้ได้เฉพาะเมื่อเปิดผ่าน https');
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('เบราว์เซอร์นี้ไม่รองรับกล้อง');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      if (!state.scan.active) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      state.scan.stream = stream;
      const video = el('scanVideo');
      video.srcObject = stream;
      await video.play();
      if ('BarcodeDetector' in window) {
        let detector;
        try { detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39'] }); }
        catch (e) { detector = new window.BarcodeDetector(); }
        state.scan.timer = setInterval(async () => {
          if (!state.scan.active || state.scan.paused) return;
          try {
            const codes = await detector.detect(video);
            if (codes && codes.length) onScanDecode(codes[0].rawValue);
          } catch (e) {}
        }, 200);
      } else {
        await ensureLibrary('zxing');
        const hints = new Map();
        if (window.ZXing.DecodeHintType) hints.set(window.ZXing.DecodeHintType.TRY_HARDER, true);
        state.scan.reader = new window.ZXing.BrowserMultiFormatReader(hints);
        await state.scan.reader.decodeFromStream(stream, video, (result) => {
          if (result && state.scan.active && !state.scan.paused) onScanDecode(result.getText());
        });
      }
      setScanStatus('กล้องพร้อม — เล็ง QR Code ในกรอบ');
    } catch (e) {
      setScanStatus(/denied|permission/i.test(e.message)
        ? 'ไม่ได้รับอนุญาตใช้กล้อง — เปิดสิทธิ์กล้องในเบราว์เซอร์'
        : 'เปิดกล้องไม่ได้: ' + e.message);
    }
  }
  function onScanDecode(text) {
    if (!state.scan.active || state.scan.paused) return;
    state.scan.paused = true;
    beep();
    const code = normalizeCode(text);
    state.scan.lastCode = code || String(text || '').trim().slice(0, 60);
    if (!code) return showScanNotFound();
    const asset = state.master.find((a) => a.inventoryNumber === code);
    if (!asset) return showScanNotFound();
    setScanStatus('เจอ ' + code);
    openRecord(asset, 'SCAN', true);
  }
  function showScanNotFound() {
    el('nfCode').textContent = state.scan.lastCode;
    el('scanNotFound').classList.remove('hidden');
    setScanStatus('ไม่พบในทะเบียนรอบนี้');
  }
  function resumeScan() {
    if (!state.scan.active) return;
    el('scanNotFound').classList.add('hidden');
    setScanStatus('กล้องพร้อม — เล็ง QR Code ในกรอบ');
    setTimeout(() => { state.scan.paused = false; }, 700);
  }
  function scanUnlisted() {
    const code = state.scan.lastCode;
    closeScanner();
    openUnlisted(code, 'SCAN');
  }
  function closeScanner() {
    state.scan.active = false;
    state.scan.paused = false;
    if (state.scan.timer) { clearInterval(state.scan.timer); state.scan.timer = null; }
    if (state.scan.reader) { try { state.scan.reader.reset(); } catch (e) {} state.scan.reader = null; }
    if (state.scan.stream) {
      state.scan.stream.getTracks().forEach((tr) => tr.stop());
      state.scan.stream = null;
    }
    el('scanVideo').srcObject = null;
    el('scannerModal').classList.add('hidden');
  }

  // ── โหมดตรวจต่อเนื่อง ──────────────────────────────────────────────────────
  function openBulk() {
    if (!state.canWrite) return;
    if (!state.activeSession) return toast('เลือกรอบตรวจก่อน', 'warn');
    state.bulk.count = 0;
    const saved = cacheGet('avBulkResult');
    if (saved && RESULTS[saved] && saved !== 'MOVED') state.bulk.resultKey = saved;
    el('bulkSub').textContent = state.ui.type === 'RENTAL' ? 'ทรัพย์สินของเช่า' : 'ทรัพย์สิน Fixed Assets';
    const counts = {};
    mastersOfType().forEach((a) => {
      const c = a.categoryCode || '?';
      counts[c] = (counts[c] || 0) + 1;
    });
    const cats = Object.keys(counts).sort();
    if (!cats.length) return toast('ยังไม่มีทะเบียนของประเภทนี้', 'warn');
    el('bulkCat').innerHTML = cats.map((c) =>
      '<option value="' + esc(c) + '">RT-' + esc(c) + ' (' + counts[c] + ' รายการ)</option>').join('');
    const savedCat = cacheGet('avBulkCat_' + state.ui.type);
    state.bulk.cat = cats.indexOf(savedCat) >= 0 ? savedCat : cats[0];
    el('bulkCat').value = state.bulk.cat;
    el('bulkLocation').value = cacheGet('avLastLocation') || '';
    el('bulkLast').textContent = '';
    document.querySelectorAll('#bulkResultSeg .seg').forEach((s) => {
      s.classList.toggle('active', s.dataset.result === state.bulk.resultKey);
    });
    updateBulkView();
    el('bulkModal').classList.remove('hidden');
    setTimeout(() => el('bulkTail').focus(), 200);
  }
  function setBulkCat(v) {
    state.bulk.cat = v;
    state.bulk.count = 0;
    cacheSet('avBulkCat_' + state.ui.type, v);
    el('bulkTail').value = '';
    updateBulkView();
    el('bulkTail').focus();
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
    el('bulkPrefix').textContent = 'RT-' + state.bulk.cat + '-';
    const list = mastersOfType().filter((a) => a.categoryCode === state.bulk.cat);
    let done = 0;
    list.forEach((a) => {
      if (classify(state.latest.get(a.inventoryNumber)) !== 'pending') done++;
    });
    el('bulkCounter').textContent = 'ตรวจแล้ว ' + done + ' / ' + list.length +
      ' รายการในหมวดนี้' + (state.bulk.count ? ' · รอบนี้ ' + state.bulk.count + ' รายการ' : '');
  }
  function bulkCodeFromTail(raw) {
    let s = String(raw || '').toUpperCase().replace(/[–—]/g, '-').replace(/\s+/g, '');
    if (!s) return '';
    const full = s.match(INV_RE);
    if (full) return full[0];
    s = s.replace(/^-+/, '').replace(/-+$/, '');
    const m = s.match(/^([A-Z0-9]{2})-?(\d{1,4})$/);
    if (!m) return '';
    return 'RT-' + state.bulk.cat + '-' + m[1] + '-' + m[2].padStart(4, '0');
  }
  async function bulkSubmit() {
    const tailEl = el('bulkTail');
    const code = bulkCodeFromTail(tailEl.value);
    if (!code) return toast('รูปแบบไม่ถูกต้อง — กรอกส่วนท้าย เช่น 26-0001 หรือ 260001', 'warn');
    const asset = state.master.find((a) => a.inventoryNumber === code);
    if (!asset) {
      return toast('ไม่พบ ' + code + ' ในทะเบียนรอบนี้ — ตรวจเลขอีกครั้ง หรือใช้ "นอกทะเบียน"', 'error');
    }
    const latest = state.latest.get(code);
    if (latest) {
      const ok = window.confirm('⚠ ' + code + ' ถูกตรวจแล้วโดย ' + (latest.inspector || '-') +
        '\nเมื่อ ' + thaiDT(latest.verifiedAt) + ' (ผล: ' + statusLabel(latest) +
        ')\n\nยืนยันบันทึกซ้ำเป็นรายการใหม่?');
      if (!ok) { tailEl.value = ''; tailEl.focus(); return; }
    }
    const location = el('bulkLocation').value.trim();
    if (location) cacheSet('avLastLocation', location);
    try {
      await queueRecord({
        inventoryNumber: code, assetType: asset.assetType,
        resultKey: state.bulk.resultKey, method: 'MANUAL', locationText: location
      });
    } catch (e) {
      return toast('บันทึกลงเครื่องไม่ได้: ' + e.message, 'error');
    }
    state.bulk.count++;
    afterDataChange();
    updateBulkView();
    el('bulkLast').textContent = '✔ ล่าสุด: ' + code + ' (' + RESULTS[state.bulk.resultKey].label +
      ') ' + thaiDT(new Date().toISOString());
    beep();
    tailEl.value = '';
    tailEl.focus();
    flushQueue();
  }
  function closeBulk() {
    el('bulkModal').classList.add('hidden');
    updateSyncChip();
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  function typeStats(type) {
    const list = state.master.filter((a) => a.assetType === type);
    const st = { total: list.length, pending: 0, found: 0, damaged: 0, notfound: 0, moved: 0 };
    list.forEach((a) => { st[classify(state.latest.get(a.inventoryNumber))]++; });
    st.done = st.total - st.pending;
    return st;
  }
  function progressCard(title, st) {
    const pct = st.total ? Math.round(st.done * 100 / st.total) : 0;
    return '<div class="dash-card"><h4>' + title + '</h4>' +
      '<div class="progress-line"><span>ตรวจแล้ว ' + st.done + ' / ' + st.total +
      '</span><span>' + pct + '%</span></div>' +
      '<div class="bar"><i class="' + (pct >= 100 ? 'ok' : '') + '" style="width:' + pct + '%"></i></div>' +
      '<div class="stat-chips">' +
      '<span class="stat-chip st-found">พบปกติ ' + st.found + '</span>' +
      '<span class="stat-chip st-damaged">ชำรุด ' + st.damaged + '</span>' +
      '<span class="stat-chip st-notfound">ไม่พบ ' + st.notfound + '</span>' +
      '<span class="stat-chip st-moved">ย้ายออก ' + st.moved + '</span>' +
      '<span class="stat-chip st-pending">ยังไม่ตรวจ ' + st.pending + '</span>' +
      '</div></div>';
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
  function renderDash() {
    const s = state.activeSession;
    if (!s) { el('dashContent').innerHTML = '<p class="empty-note">เลือกรอบตรวจก่อน</p>'; return; }
    el('dashTitle').textContent = 'สรุปผล: ' + s.site + (s.roundName ? ' · ' + s.roundName : '');
    const fx = typeStats('FIXED');
    const rn = typeStats('RENTAL');
    const fixedList = state.master.filter((a) => a.assetType === 'FIXED');
    const rentalList = state.master.filter((a) => a.assetType === 'RENTAL');
    const byInspector = {};
    allLogs().forEach((l) => {
      const k = l.inspector || '(ไม่ระบุ)';
      byInspector[k] = (byInspector[k] || 0) + 1;
    });
    const inspectorRows = Object.keys(byInspector)
      .sort((a, b) => byInspector[b] - byInspector[a])
      .map((k) => '<div class="dash-list-item"><span>👤 ' + esc(k) + '</span><b>' +
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
    const damaged = [];
    state.master.forEach((a) => {
      const l = state.latest.get(a.inventoryNumber);
      const c = classify(l);
      if (c === 'notfound') notFound.push(issueRow(a, l));
      if (c === 'moved') moved.push(issueRow(a, l));
      if (c === 'damaged') damaged.push(issueRow(a, l));
    });
    const unl = allLogs().filter((l) => l.unregistered)
      .sort((a, b) => String(b.verifiedAt).localeCompare(String(a.verifiedAt)))
      .map((l) => '<div class="dash-list-item"><span class="mono">' + esc(l.inventoryNumber) +
        '</span><span>' + esc(l.unlistedDesc || '') + '</span><b>' + esc(l.inspector || '') +
        ' · ' + esc(thaiDT(l.verifiedAt)) + '</b></div>');

    el('dashContent').innerHTML =
      '<div class="dash-grid">' +
      progressCard('🏢 ทรัพย์สิน Fixed Assets', fx) +
      progressCard('🚚 ทรัพย์สินของเช่า', rn) +
      '<div class="dash-card"><h4>ตามหมวด — Fixed Assets</h4>' +
      groupBars(fixedList, (a) => 'RT-' + (a.categoryCode || '?')) + '</div>' +
      '<div class="dash-card"><h4>ตามหมวด — ของเช่า</h4>' +
      groupBars(rentalList, (a) => 'RT-' + (a.categoryCode || '?')) + '</div>' +
      '<div class="dash-card"><h4>ตามผู้รับผิดชอบ (Fixed Assets)</h4>' +
      groupBars(fixedList, (a) => (a.staffText || '').trim()) + '</div>' +
      '<div class="dash-card"><h4>ผลงานผู้ตรวจ (จำนวนครั้งที่บันทึก)</h4>' +
      (inspectorRows.join('') || '<p class="hint">ยังไม่มีการตรวจ</p>') + '</div>' +
      '</div>' +
      dashList('pf', '⬜ ยังไม่ตรวจ — Fixed Assets', pendF.map(pendingRow)) +
      dashList('pr', '⬜ ยังไม่ตรวจ — ของเช่า', pendR.map(pendingRow)) +
      dashList('dm', '🛠 ชำรุด', damaged) +
      dashList('nf', '❌ ไม่พบ', notFound) +
      dashList('mv', '🚚 ย้ายออกไปไซต์อื่น', moved) +
      dashList('un', '＋ ทรัพย์สินนอกทะเบียน', unl);
  }
  function toggleSection(id) {
    const b = el('coll-' + id);
    if (b) b.classList.toggle('hidden');
  }

  // ── Export Excel ───────────────────────────────────────────────────────────
  async function exportExcel() {
    const s = state.activeSession;
    if (!s) return toast('เลือกรอบตรวจก่อน', 'warn');
    try {
      busy('กำลังสร้างไฟล์ Excel...');
      await ensureLibrary('xlsx');
      const XLSX = window.XLSX;
      const latestCols = (a) => {
        const l = state.latest.get(a.inventoryNumber);
        const gps = l && l.gpsLat != null ? l.gpsLat + ',' + l.gpsLng : '';
        return [
          l ? statusLabel(l) : 'ยังไม่ตรวจ',
          l && l.condition === 'DAMAGED' ? 'ชำรุด' : (l && l.result === 'FOUND' ? 'ปกติ' : ''),
          l ? (l.inspector || '') : '', l ? thaiDT(l.verifiedAt) : '', l ? l.method : '',
          l ? (l.locationText || '') : '', l ? (l.moveToSite || '') : '',
          l ? (l.moveDocNo || '') : '', l && l.moveDate ? thaiD(l.moveDate) : '',
          gps, l ? (l.note || '') : '',
          l ? ((l.photoPaths || []).length || l.photoCount || 0) : 0
        ];
      };
      const tail = ['สถานะ', 'สภาพ', 'ผู้ตรวจ', 'เวลาตรวจ', 'วิธี', 'ตำแหน่ง',
        'ส่งไป SITE', 'เลขที่ใบส่ง', 'วันที่ส่ง', 'GPS', 'หมายเหตุ', 'จำนวนรูป'];
      const info = [
        ['รายงานผลการตรวจนับทรัพย์สิน'],
        ['โครงการ', s.site], ['ชื่อรอบ', s.roundName || ''], ['Cost center', s.costCenter || ''],
        ['วันที่ตรวจ', thaiD(s.countDateFrom) + (s.countDateTo ? ' – ' + thaiD(s.countDateTo) : '')],
        ['ผู้รับผิดชอบ', s.inspectorName || ''], ['หมายเหตุ', s.note || ''],
        ['ออกรายงานเมื่อ', thaiDT(new Date().toISOString())], ['ออกโดย', inspectorName()]
      ];
      const fixedRows = [['Inventory Number', 'Description', 'Asset Class', 'Asset Number',
        'Sub Numb', 'Serial Number', 'Staff – Text', 'Current Site'].concat(tail)];
      state.master.filter((a) => a.assetType === 'FIXED').forEach((a) => {
        fixedRows.push([a.inventoryNumber, a.description || '', a.assetClass || '',
          a.assetNumber || '', a.subNumber || '', a.serialNumber || '',
          a.staffText || '', a.currentSite || ''].concat(latestCols(a)));
      });
      const rentalRows = [['Inventory Number', 'Material', 'Description', 'Plant', 'Sloc'].concat(tail)];
      state.master.filter((a) => a.assetType === 'RENTAL').forEach((a) => {
        rentalRows.push([a.inventoryNumber, a.materialCode || '', a.description || '',
          a.plant || '', a.sloc || ''].concat(latestCols(a)));
      });
      const logRows = [['เวลาตรวจ', 'Inventory Number', 'ประเภท', 'ผล', 'สภาพ', 'วิธี', 'ผู้ตรวจ',
        'ตำแหน่ง', 'ส่งไป SITE', 'เลขที่ใบส่ง', 'วันที่ส่ง', 'GPS', 'หมายเหตุ', 'นอกทะเบียน',
        'คำอธิบายนอกทะเบียน', 'จำนวนรูป', 'สถานะส่ง']];
      allLogs().sort((a, b) => String(a.verifiedAt).localeCompare(String(b.verifiedAt)))
        .forEach((l) => {
          logRows.push([thaiDT(l.verifiedAt), l.inventoryNumber,
            l.assetType === 'RENTAL' ? 'ของเช่า' : (l.assetType === 'UNLISTED' ? 'นอกทะเบียน' : 'Fixed'),
            statusLabel(l), l.condition === 'DAMAGED' ? 'ชำรุด' : (l.result === 'FOUND' ? 'ปกติ' : ''),
            l.method, l.inspector || '', l.locationText || '', l.moveToSite || '', l.moveDocNo || '',
            l.moveDate ? thaiD(l.moveDate) : '',
            l.gpsLat != null ? l.gpsLat + ',' + l.gpsLng : '',
            l.note || '', l.unregistered ? 'ใช่' : '', l.unlistedDesc || '',
            (l.photoPaths || []).length || l.photoCount || 0,
            l.pending ? 'รอส่ง' : 'ส่งแล้ว']);
        });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'ข้อมูลรอบตรวจ');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fixedRows), 'Fixed Assets');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rentalRows), 'ของเช่า');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(logRows), 'ประวัติการตรวจทั้งหมด');
      const d = s.countDateFrom ? new Date(s.countDateFrom + 'T00:00:00') : new Date();
      XLSX.writeFile(wb, 'Asset_' + s.site + '_' + d.getDate() + '.' + (d.getMonth() + 1) +
        '.' + String(d.getFullYear() + 543).slice(-2) + '.xlsx');
    } catch (e) {
      toast('Export ไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      busyHide();
    }
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
      '<button class="primary-button" type="button" onclick="App.approveAccess(\'' + u.id + '\')">✓ อนุมัติ</button>' +
      '<button class="danger-ghost" type="button" onclick="App.rejectAccess(\'' + u.id + '\',\'' +
        esc(u.email || '') + '\')">✕ ปฏิเสธ</button>' +
      '</div>').join('');
    el('accessReqModal').classList.remove('hidden');
  }
  function closeAccessReq() { el('accessReqModal').classList.add('hidden'); }
  async function approveAccess(id) {
    try {
      busy('กำลังอนุมัติ...');
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
        '<small>' + esc(u.email || '') + (u.active ? '' : ' · ⏳ รออนุมัติ') + '</small></div>' +
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
          'onclick="App.deleteProfileAccount(\'' + u.id + '\',\'' + esc(u.email || '') + '\')">🗑</button>') +
        '</div>';
    }).join('') || '<p class="hint">ยังไม่มีบัญชี</p>';
  }
  async function setUserField(id, field, value) {
    try {
      const payload = { id: id };
      payload[field] = value;
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
      if (ev.target.closest('.row-check')) return;
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
      if (cb) toggleSelect(cb.dataset.inv, cb.checked);
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
    clearSelection, applySelection, quickSave,
    openAsset, closeRecord, chooseResult, saveRecord,
    addPhotos, removePhoto, viewPhoto, deleteLogEntry,
    openScanner, closeScanner, resumeScan, scanUnlisted,
    openBulk, closeBulk, setBulkCat, setBulkResult, bulkSubmit,
    openUnlisted, exportExcel, toggleSection,
    setUserField, clearLocalCache
  };
})();
