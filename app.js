/**
 * Asset Verification — UI logic (โครงเดียวกับ supabase-web/app.js ของ MCR)
 * ต้องโหลดหลัง: supabase-js, config.js, src/assetStore.js
 */
const App = (() => {
  'use strict';

  const APP_VERSION = 'v1.0.0';
  const CFG = window.ASSET_CONFIG || {};
  const SITE = CFG.SITE || 'BRH3';

  // ── รูปแบบรหัสทรัพย์สิน (derive จากข้อมูลจริง 306 รายการ — ส่วนปีมี "YY" ได้) ──
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
    master: [],
    logs: [],
    queueItems: [],
    latest: new Map(),
    users: [],
    authMode: 'login',
    activeTab: 'fixed',
    ui: {
      F: { q: '', cat: '', staff: '', status: '', sort: 'inv' },
      R: { q: '', cat: '', status: '', sort: 'inv' }
    },
    rec: null,               // ฟอร์มบันทึกที่เปิดอยู่
    scan: { active: false, paused: false, stream: null, reader: null, timer: null, lastCode: '' },
    bulk: { type: 'FIXED', cat: '', resultKey: 'FOUND_NORMAL', count: 0 },
    importData: null,
    flushing: false,
    realtimeOn: false,
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
    setTimeout(() => { box.remove(); }, 3800);
  }
  function busy(text) { el('busyText').textContent = text || 'กำลังดำเนินการ...'; el('busyOverlay').classList.remove('hidden'); }
  function busyHide() { el('busyOverlay').classList.add('hidden'); }
  function cacheSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function cacheGet(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
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
    if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) {} }
  }

  // ── โหลดไลบรารีตอนใช้จริง (ประหยัดเน็ตหน้างาน) ─────────────────────────────
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

  // ── คิว offline (IndexedDB — เก็บทั้ง record และรูป กันข้อมูลหายตอนเน็ตหลุด) ──
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
              photos[p].path = await AssetStore.uploadPhoto(photos[p].dataUrl, it.inventoryNumber);
              await qPut(it);   // จำความคืบหน้า — retry รอบหน้าไม่อัปโหลดรูปซ้ำ
            }
          }
          const saved = await AssetStore.saveVerify({
            clientId: it.clientId,
            inventoryNumber: it.inventoryNumber,
            assetType: it.assetType,
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

  // ── รวม log จริง + คิวรอส่ง แล้วหา "สถานะล่าสุด" ต่อรหัส ─────────────────────
  function queueToLog(it) {
    return {
      logId: 'pending-' + it.clientId, clientId: it.clientId,
      inventoryNumber: it.inventoryNumber, assetType: it.assetType,
      result: it.result, condition: it.condition, method: it.method,
      inspector: it.inspector, locationText: it.locationText,
      moveToSite: it.moveToSite, moveDocNo: it.moveDocNo, moveDate: it.moveDate,
      note: it.note, unregistered: it.unregistered, unlistedDesc: it.unlistedDesc,
      verifiedAt: it.verifiedAt, photoPaths: [],
      photoCount: (it.photos || []).length, pending: true
    };
  }
  function allLogs() { return state.logs.concat(state.queueItems.map(queueToLog)); }
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
      errBox.textContent = /Invalid login credentials/i.test(e.message)
        ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : e.message;
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
    el('topTitle').textContent = CFG.APP_TITLE || 'ตรวจนับทรัพย์สิน';
    el('nav-manage').classList.toggle('hidden', p.role !== 'admin');
    document.querySelectorAll('.tool-buttons').forEach((n) => {
      n.classList.toggle('hidden', !state.canWrite);
    });
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
      prof = cacheGet('avProfile');   // ออฟไลน์: ใช้ profile ล่าสุดที่เคยโหลดได้
      if (!prof) return showLogin('เชื่อมต่อไม่ได้: ' + e.message);
    }
    if (!prof) return showLogin();
    if (!prof.active) return showPending();
    state.profile = prof;
    showApp();
    await loadQueue();
    state.master = cacheGet('avMaster') || [];
    state.logs = cacheGet('avLogs') || [];
    afterDataChange();
    refreshAll(true);
    if (prof.role === 'admin') loadUsers(true);
  }

  // ── โหลด/รีเฟรชข้อมูล + Realtime ───────────────────────────────────────────
  async function refreshAll(silent) {
    if (!state.profile) return;
    try {
      if (!silent) busy('กำลังโหลดข้อมูลล่าสุด...');
      const results = await Promise.all([AssetStore.loadMaster(), AssetStore.loadLogs()]);
      state.master = results[0];
      state.logs = results[1];
      cacheSet('avMaster', state.master);
      cacheSet('avLogs', state.logs);
      afterDataChange();
      ensureRealtime();
      flushQueue();
      if (!silent) toast('อัปเดตข้อมูลแล้ว', 'success');
    } catch (e) {
      if (!silent) toast('โหลดข้อมูลไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      busyHide();
    }
  }
  function ensureRealtime() {
    if (state.realtimeOn) return;
    try {
      AssetStore.subscribeLogs((log) => {
        addLogLocal(log);
        cacheSet('avLogs', state.logs);
        afterDataChange();
      });
      state.realtimeOn = true;
    } catch (e) {}
  }
  function afterDataChange() {
    rebuildIndex();
    renderFilterOptions();
    renderLocList();
    renderList('F');
    renderList('R');
    if (state.activeTab === 'dash') renderDash();
    updateSyncChip();
  }

  // ── ตัวกรอง + รายการ ───────────────────────────────────────────────────────
  function typeOf(t) { return t === 'F' ? 'FIXED' : 'RENTAL'; }
  function mastersOf(t) {
    const type = typeOf(t);
    return state.master.filter((a) => a.assetType === type);
  }
  function renderFilterOptions() {
    ['F', 'R'].forEach((t) => {
      const sel = el('cat' + t);
      const cur = state.ui[t].cat;
      const counts = {};
      mastersOf(t).forEach((a) => {
        const c = a.categoryCode || (a.inventoryNumber || '').split('-')[1] || '?';
        counts[c] = (counts[c] || 0) + 1;
      });
      const cats = Object.keys(counts).sort();
      let html = '<option value="">ทุกหมวด (' + mastersOf(t).length + ')</option>';
      cats.forEach((c) => {
        html += '<option value="' + esc(c) + '">RT-' + esc(c) + ' (' + counts[c] + ')</option>';
      });
      sel.innerHTML = html;
      sel.value = cats.indexOf(cur) >= 0 ? cur : '';
      state.ui[t].cat = sel.value;
    });
    // ผู้รับผิดชอบ (เฉพาะ Fixed — ข้อมูลจริงว่าง 80% จึงต้องมี "(ไม่ระบุ)")
    const staffSel = el('staffF');
    const cur = state.ui.F.staff;
    const counts = {};
    let blank = 0;
    mastersOf('F').forEach((a) => {
      const s = (a.staffText || '').trim();
      if (!s) { blank++; return; }
      counts[s] = (counts[s] || 0) + 1;
    });
    let html = '<option value="">ผู้รับผิดชอบ: ทั้งหมด</option>';
    if (blank) html += '<option value="__NONE__">(ไม่ระบุ) — ' + blank + '</option>';
    Object.keys(counts).sort((a, b) => a.localeCompare(b, 'th')).forEach((s) => {
      html += '<option value="' + esc(s) + '">' + esc(s) + ' (' + counts[s] + ')</option>';
    });
    staffSel.innerHTML = html;
    staffSel.value = cur && (cur === '__NONE__' || counts[cur]) ? cur : '';
    state.ui.F.staff = staffSel.value;
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
  function filteredAssets(t) {
    const ui = state.ui[t];
    let list = mastersOf(t);
    if (ui.cat) list = list.filter((a) => (a.categoryCode || '') === ui.cat);
    if (t === 'F' && ui.staff) {
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
  function renderList(t) {
    const list = filteredAssets(t);
    let done = 0;
    const html = list.map((a) => {
      const latest = state.latest.get(a.inventoryNumber);
      const cls = classify(latest);
      if (cls !== 'pending') done++;
      const meta = [];
      if (t === 'F') {
        if (a.staffText) meta.push('👤 ' + esc(a.staffText));
        if (a.serialNumber) meta.push('S/N ' + esc(a.serialNumber));
      } else {
        if (a.materialCode) meta.push('MAT ' + esc(a.materialCode));
        if (a.sloc) meta.push('Sloc ' + esc(a.sloc));
      }
      let verifyLine = '';
      if (latest) {
        verifyLine = '<div class="asset-meta">🕓 ' + esc(thaiDT(latest.verifiedAt)) +
          ' · ' + esc(latest.inspector || '') +
          ' <span class="method-badge ' + (latest.method === 'SCAN' ? 'm-scan' : 'm-manual') + '">' +
          latest.method + '</span>' +
          (latest.locationText ? ' · 📌 ' + esc(latest.locationText) : '') +
          (latest.pending ? ' <span class="pending-sync">⏳ รอส่ง</span>' : '') +
          '</div>';
      }
      return '<div class="asset-row st-' + cls + '" data-inv="' + esc(a.inventoryNumber) + '">' +
        '<div class="asset-row-top"><span class="asset-inv mono">' + esc(a.inventoryNumber) + '</span>' +
        '<span class="status-badge st-' + cls + '">' + esc(statusLabel(latest)) + '</span></div>' +
        '<div class="asset-desc">' + esc(a.description || '') + '</div>' +
        (meta.length ? '<div class="asset-meta">' + meta.join(' · ') + '</div>' : '') +
        verifyLine + '</div>';
    }).join('');
    el('list' + t).innerHTML = html ||
      '<p class="empty-note">ไม่พบรายการตามเงื่อนไข' +
      (state.master.length ? '' : ' — ยังไม่ได้นำเข้าทะเบียน (แท็บ จัดการ)') + '</p>';
    el('counter' + t).textContent = 'ตรวจแล้ว ' + done + ' / ' + list.length;
  }
  function setSearch(t, v) { state.ui[t].q = v.trim(); renderList(t); }
  function setCat(t, v) { state.ui[t].cat = v; renderList(t); }
  function setStaff(v) { state.ui.F.staff = v; renderList('F'); }
  function setSort(t, v) { state.ui[t].sort = v; renderList(t); }
  function setStatus(t, v) {
    state.ui[t].status = v;
    document.querySelectorAll('#statusChips' + t + ' .chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.status === v);
    });
    renderList(t);
  }

  // ── นำทาง ──────────────────────────────────────────────────────────────────
  function go(tab) {
    state.activeTab = tab;
    ['fixed', 'rental', 'dash', 'manage'].forEach((p) => {
      const page = el('page-' + p);
      if (page) page.classList.toggle('active', p === tab);
      const nav = el('nav-' + p);
      if (nav) nav.classList.toggle('active', p === tab);
    });
    if (tab === 'dash') renderDash();
    if (tab === 'manage') renderManage();
    window.scrollTo(0, 0);
  }

  // ── ฟอร์มบันทึกผลตรวจ ──────────────────────────────────────────────────────
  function latestWarnHtml(latest) {
    return '⚠ รายการนี้ถูกตรวจแล้วโดย <b>' + esc(latest.inspector || '-') + '</b> เมื่อ ' +
      esc(thaiDT(latest.verifiedAt)) + ' (ผล: ' + esc(statusLabel(latest)) +
      ') — การบันทึกซ้ำจะเพิ่มเป็นรายการใหม่ต่อท้าย ไม่ทับของเดิม';
  }
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
        '<span class="status-badge st-' + cls + '">' + esc(statusLabel(l)) + '</span>' +
        '<span class="method-badge ' + (l.method === 'SCAN' ? 'm-scan' : 'm-manual') + '">' + l.method + '</span>' +
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
          ? '<button type="button" class="hist-del" data-log="' + esc(l.logId) + '" title="ลบรายการนี้ (admin)">🗑</button>'
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
    if (latest) el('recWarn').innerHTML = latestWarnHtml(latest);
    renderHistory(asset.inventoryNumber);
    resetRecForm();
    el('unlistedFields').classList.add('hidden');
    el('recForm').classList.toggle('hidden', !state.canWrite);
    el('recordModal').classList.remove('hidden');
    startGps();
  }
  function openUnlisted(code, method) {
    if (!state.canWrite) return;
    state.rec = {
      mode: 'unlisted', asset: null, method: method || 'MANUAL',
      fromScanner: false, resultKey: null, photos: [], gps: null
    };
    el('recTitle').textContent = 'ทรัพย์สินนอกทะเบียน';
    const tb = el('recTypeBadge');
    tb.textContent = 'นอกทะเบียน';
    tb.className = 'type-badge t-unlisted';
    el('recSub').textContent = 'บันทึกทรัพย์สินที่พบหน้างานแต่ไม่มีในไฟล์ทะเบียน';
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
    const t = new Date();
    el('moveDate').value = t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
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
        const dataUrl = await resizeImage(files[i], 1280, 0.82);   // ~150-300KB เร็วบนเน็ตหน้างาน
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
    const rk = RESULTS[rec.resultKey];
    const location = el('recLocation').value.trim();
    if (location) cacheSet('avLastLocation', location);
    const item = {
      clientId: AssetStore.uuid(),
      inventoryNumber: inv,
      assetType: assetType,
      result: rk.result,
      condition: rk.condition,
      method: rec.method,
      inspector: inspectorName(),
      locationText: location,
      gpsLat: rec.gps ? rec.gps.lat : null,
      gpsLng: rec.gps ? rec.gps.lng : null,
      gpsAccuracy: rec.gps ? rec.gps.acc : null,
      moveToSite: rec.resultKey === 'MOVED' ? el('moveSite').value.trim().toUpperCase() : null,
      moveDocNo: rec.resultKey === 'MOVED' ? el('moveDoc').value.trim() : null,
      moveDate: rec.resultKey === 'MOVED' ? (el('moveDate').value || null) : null,
      note: el('recNote').value.trim(),
      unregistered: rec.mode === 'unlisted',
      unlistedDesc: unlistedDesc,
      verifiedAt: new Date().toISOString(),
      photos: rec.photos
    };
    try { await qPut(item); } catch (e) {
      return toast('บันทึกลงเครื่องไม่ได้: ' + e.message, 'error');
    }
    state.queueItems.push(item);
    afterDataChange();
    const fromScanner = rec.fromScanner;
    closeRecord();
    toast(navigator.onLine
      ? 'บันทึก ' + inv + ' แล้ว'
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
      cacheSet('avLogs', state.logs);
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
    el('scannerModal').classList.remove('hidden');
    el('scanNotFound').classList.add('hidden');
    state.scan.active = true;
    state.scan.paused = false;
    setScanStatus('กำลังเปิดกล้อง...');
    try {
      if (!window.isSecureContext) {
        throw new Error('กล้องใช้ได้เฉพาะเมื่อเปิดผ่าน https (หลัง deploy ขึ้น Cloudflare)');
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
        ? 'ไม่ได้รับอนุญาตใช้กล้อง — เปิดสิทธิ์กล้องใน Settings ของเบราว์เซอร์'
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
    setScanStatus('ไม่พบในทะเบียน');
  }
  function resumeScan() {
    if (!state.scan.active) return;
    el('scanNotFound').classList.add('hidden');
    setScanStatus('กล้องพร้อม — เล็ง QR Code ในกรอบ');
    setTimeout(() => { state.scan.paused = false; }, 700);   // กันสแกนรหัสเดิมซ้ำทันที
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

  // ── โหมดตรวจต่อเนื่อง (Bulk) ───────────────────────────────────────────────
  function openBulk(type) {
    if (!state.canWrite) return;
    state.bulk.type = type;
    state.bulk.count = 0;
    const saved = cacheGet('avBulkResult');
    if (saved && RESULTS[saved] && saved !== 'MOVED') state.bulk.resultKey = saved;
    el('bulkSub').textContent = type === 'RENTAL' ? 'ทรัพย์สินของเช่า' : 'ทรัพย์สิน Fixed Assets';
    const t = type === 'RENTAL' ? 'R' : 'F';
    const counts = {};
    mastersOf(t).forEach((a) => {
      const c = a.categoryCode || '?';
      counts[c] = (counts[c] || 0) + 1;
    });
    const cats = Object.keys(counts).sort();
    if (!cats.length) return toast('ยังไม่มีทะเบียนของประเภทนี้', 'warn');
    el('bulkCat').innerHTML = cats.map((c) =>
      '<option value="' + esc(c) + '">RT-' + esc(c) + ' (' + counts[c] + ' รายการ)</option>').join('');
    const savedCat = cacheGet('avBulkCat_' + type);
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
    cacheSet('avBulkCat_' + state.bulk.type, v);
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
    const list = state.master.filter((a) =>
      a.assetType === state.bulk.type && a.categoryCode === state.bulk.cat);
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
    if (full) return full[0];   // ผู้ใช้วาง/สแกนรหัสเต็ม
    s = s.replace(/^-+/, '').replace(/-+$/, '');
    const m = s.match(/^([A-Z0-9]{2})-?(\d{1,4})$/);
    if (!m) return '';
    return 'RT-' + state.bulk.cat + '-' + m[1] + '-' + m[2].padStart(4, '0');
  }
  async function bulkSubmit() {
    const tailEl = el('bulkTail');
    const code = bulkCodeFromTail(tailEl.value);
    if (!code) {
      return toast('รูปแบบไม่ถูกต้อง — กรอกส่วนท้าย เช่น 26-0001 หรือ 260001', 'warn');
    }
    const asset = state.master.find((a) => a.inventoryNumber === code);
    if (!asset) {
      return toast('ไม่พบ ' + code + ' ในทะเบียน — ตรวจเลขอีกครั้ง หรือใช้ปุ่ม "นอกทะเบียน"', 'error');
    }
    const latest = state.latest.get(code);
    if (latest) {
      const ok = window.confirm('⚠ ' + code + ' ถูกตรวจแล้วโดย ' + (latest.inspector || '-') +
        '\nเมื่อ ' + thaiDT(latest.verifiedAt) + ' (ผล: ' + statusLabel(latest) +
        ')\n\nยืนยันบันทึกซ้ำเป็นรายการใหม่?');
      if (!ok) { tailEl.value = ''; tailEl.focus(); return; }
    }
    const rk = RESULTS[state.bulk.resultKey];
    const location = el('bulkLocation').value.trim();
    if (location) cacheSet('avLastLocation', location);
    const item = {
      clientId: AssetStore.uuid(),
      inventoryNumber: code,
      assetType: asset.assetType,
      result: rk.result,
      condition: rk.condition,
      method: 'MANUAL',
      inspector: inspectorName(),
      locationText: location,
      gpsLat: null, gpsLng: null, gpsAccuracy: null,
      moveToSite: null, moveDocNo: null, moveDate: null,
      note: '', unregistered: false, unlistedDesc: null,
      verifiedAt: new Date().toISOString(),
      photos: []
    };
    try { await qPut(item); } catch (e) {
      return toast('บันทึกลงเครื่องไม่ได้: ' + e.message, 'error');
    }
    state.queueItems.push(item);
    state.bulk.count++;
    afterDataChange();
    updateBulkView();
    el('bulkLast').textContent = '✔ ล่าสุด: ' + code + ' (' + rk.label + ') ' + thaiDT(item.verifiedAt);
    beep();
    tailEl.value = '';
    tailEl.focus();
    flushQueue();
  }
  function closeBulk() {
    el('bulkModal').classList.add('hidden');
    updateSyncChip();
  }

  // ── Dashboard + Export ─────────────────────────────────────────────────────
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
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="stat-chips">' +
      '<span class="stat-chip status-badge st-found">พบปกติ ' + st.found + '</span>' +
      '<span class="stat-chip status-badge st-damaged">ชำรุด ' + st.damaged + '</span>' +
      '<span class="stat-chip status-badge st-notfound">ไม่พบ ' + st.notfound + '</span>' +
      '<span class="stat-chip status-badge st-moved">ย้ายออก ' + st.moved + '</span>' +
      '<span class="stat-chip status-badge st-pending">ยังไม่ตรวจ ' + st.pending + '</span>' +
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
    return Object.keys(groups)
      .sort((a, b) => (groups[b].total - groups[b].done) - (groups[a].total - groups[a].done))
      .map((k) => {
        const g = groups[k];
        const pct = g.total ? Math.round(g.done * 100 / g.total) : 0;
        return '<div class="mini-bar-row"><span>' + esc(k) + '</span>' +
          '<div class="bar"><i class="' + (pct === 100 ? '' : 'warn') + '" style="width:' + pct +
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
    const fx = typeStats('FIXED');
    const rn = typeStats('RENTAL');
    const fixedList = state.master.filter((a) => a.assetType === 'FIXED');
    const rentalList = state.master.filter((a) => a.assetType === 'RENTAL');
    // ผลงานผู้ตรวจ
    const byInspector = {};
    allLogs().forEach((l) => {
      const k = l.inspector || '(ไม่ระบุ)';
      byInspector[k] = (byInspector[k] || 0) + 1;
    });
    const inspectorRows = Object.keys(byInspector)
      .sort((a, b) => byInspector[b] - byInspector[a])
      .map((k) => '<div class="dash-list-item"><span>👤 ' + esc(k) + '</span><b>' +
        byInspector[k] + ' ครั้ง</b></div>');
    // รายการค้าง / มีปัญหา
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
      dashList('nf', '❌ ไม่พบ', notFound) +
      dashList('mv', '🚚 ย้ายออกไปไซต์อื่น', moved) +
      dashList('un', '➕ ทรัพย์สินนอกทะเบียน', unl);
  }
  function toggleSection(id) {
    const b = el('coll-' + id);
    if (b) b.classList.toggle('hidden');
  }
  async function exportExcel() {
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
          l ? (l.inspector || '') : '',
          l ? thaiDT(l.verifiedAt) : '',
          l ? l.method : '',
          l ? (l.locationText || '') : '',
          l ? (l.moveToSite || '') : '',
          l ? (l.moveDocNo || '') : '',
          l && l.moveDate ? thaiD(l.moveDate) : '',
          gps,
          l ? (l.note || '') : '',
          l ? ((l.photoPaths || []).length || l.photoCount || 0) : 0
        ];
      };
      const tail = ['สถานะ', 'สภาพ', 'ผู้ตรวจ', 'เวลาตรวจ', 'วิธี', 'ตำแหน่ง',
        'ส่งไป SITE', 'เลขที่ใบส่ง', 'วันที่ส่ง', 'GPS', 'หมายเหตุ', 'จำนวนรูป'];
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
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fixedRows), 'Fixed Assets');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rentalRows), 'ของเช่า');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(logRows), 'ประวัติการตรวจทั้งหมด');
      const d = new Date();
      XLSX.writeFile(wb, 'Asset_Verify_' + SITE + '_' + d.getDate() + '.' + (d.getMonth() + 1) +
        '.' + String(d.getFullYear()).slice(-2) + '.xlsx');
    } catch (e) {
      toast('Export ไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      busyHide();
    }
  }

  // ── นำเข้าทะเบียน (อ่าน .xls จริงด้วย SheetJS ฝั่งเบราว์เซอร์) ────────────────
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
    return { type: isRental ? 'RENTAL' : 'FIXED', items: items };
  }
  async function importMasterFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      busy('กำลังอ่านไฟล์...');
      await ensureLibrary('xlsx');
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: 'array' });
      const byInv = new Map();
      let fixed = 0, rental = 0, dups = 0;
      wb.SheetNames.forEach((name) => {
        const parsed = parseSheet(wb.Sheets[name]);
        if (!parsed) return;
        parsed.items.forEach((it) => {
          if (byInv.has(it.inventoryNumber)) dups++;
          byInv.set(it.inventoryNumber, it);
        });
      });
      const rows = Array.from(byInv.values());
      rows.forEach((it) => { if (it.assetType === 'RENTAL') rental++; else fixed++; });
      if (!rows.length) {
        throw new Error('ไม่พบข้อมูลทรัพย์สินในไฟล์ — ต้องมีหัวคอลัมน์ "Inventory Number"');
      }
      state.importData = rows;
      el('importPreview').innerHTML =
        'ไฟล์: <b>' + esc(file.name) + '</b><br>' +
        'ทรัพย์สิน Fixed Assets: <b>' + fixed + '</b> รายการ · ของเช่า: <b>' + rental +
        '</b> รายการ · รวม <b>' + rows.length + '</b> รายการ' +
        (dups ? '<br>⚠ พบรหัสซ้ำในไฟล์ ' + dups + ' รายการ (ใช้แถวล่าสุด)' : '') +
        '<br><br>⚠ การนำเข้าจะ<b>แทนที่ทะเบียนเดิมทั้งชุด</b>ของ ' + esc(SITE) +
        ' (ประวัติผลตรวจไม่หาย)';
      el('importPreview').classList.remove('hidden');
      el('importActions').classList.remove('hidden');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      busyHide();
    }
  }
  function cancelImport() {
    state.importData = null;
    el('importPreview').classList.add('hidden');
    el('importActions').classList.add('hidden');
  }
  async function confirmImport() {
    if (!state.importData) return;
    try {
      busy('กำลังนำเข้าทะเบียน ' + state.importData.length + ' รายการ...');
      const res = await AssetStore.importMaster(state.importData, inspectorName());
      cancelImport();
      toast('นำเข้าแล้ว ' + res.inserted + ' รายการ', 'success');
      await refreshAll(true);
      renderManage();
    } catch (e) {
      toast('นำเข้าไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      busyHide();
    }
  }

  // ── จัดการบัญชี + ข้อมูลระบบ ────────────────────────────────────────────────
  async function loadUsers(silent) {
    if (!state.profile || state.profile.role !== 'admin') return;
    try {
      state.users = await AssetStore.listProfiles();
      const pending = state.users.filter((u) => !u.active).length;
      el('pendingBadge').textContent = pending;
      el('pendingBadge').classList.toggle('hidden', !pending);
      if (!silent || state.activeTab === 'manage') renderUsers();
    } catch (e) {
      if (!silent) toast(e.message, 'error');
    }
  }
  function renderUsers() {
    const me = state.profile ? state.profile.id : '';
    el('usersList').innerHTML = state.users.map((u) => {
      const self = u.id === me;
      return '<div class="user-row' + (!u.active ? ' pending-user' : '') + '">' +
        '<div class="user-main"><b>' + esc(u.fullName || u.email || '') + '</b>' +
        '<small>' + esc(u.email || '') + (u.active ? '' : ' · ⏳ รออนุมัติ') + '</small></div>' +
        '<input type="text" placeholder="ชื่อที่แสดง" value="' + esc(u.fullName || '') +
        '" style="width:120px" onchange="App.setUserField(\'' + u.id + '\',\'fullName\',this.value)">' +
        '<select ' + (self ? 'disabled' : '') +
        ' onchange="App.setUserField(\'' + u.id + '\',\'role\',this.value)">' +
        ['viewer', 'counter', 'admin'].map((r) =>
          '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + r + '</option>').join('') +
        '</select>' +
        '<label class="user-active"><input type="checkbox" ' + (u.active ? 'checked' : '') +
        (self ? ' disabled' : '') +
        ' onchange="App.setUserField(\'' + u.id + '\',\'active\',this.checked)">ใช้งาน</label>' +
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
    const fx = state.master.filter((a) => a.assetType === 'FIXED').length;
    const rn = state.master.filter((a) => a.assetType === 'RENTAL').length;
    el('sysInfo').innerHTML =
      '<span>เวอร์ชัน: ' + APP_VERSION + ' · โครงการ: ' + esc(SITE) + '</span>' +
      '<span>ทะเบียน: Fixed ' + fx + ' + ของเช่า ' + rn + ' = ' + state.master.length + ' รายการ</span>' +
      '<span>บันทึกผลตรวจ: ' + state.logs.length + ' รายการ · รอส่ง: ' + state.queueItems.length + '</span>' +
      '<span><button class="outline-button" type="button" onclick="App.clearLocalCache()" ' +
      'style="padding:8px 12px;margin-top:6px">ล้าง cache เครื่องนี้ (ไม่ลบคิวรอส่ง)</button></span>';
  }
  function clearLocalCache() {
    ['avMaster', 'avLogs', 'avProfile'].forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    location.reload();
  }

  // ── init ───────────────────────────────────────────────────────────────────
  function init() {
    ['listF', 'listR'].forEach((id) => {
      el(id).addEventListener('click', (ev) => {
        const row = ev.target.closest('.asset-row');
        if (row) openAsset(row.dataset.inv);
      });
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
    setInterval(() => {           // เผื่อ Realtime หลุด — sync สำรองทุก 2 นาที
      if (state.profile && navigator.onLine && !document.hidden) refreshAll(true);
    }, 120000);
    boot();
  }
  document.addEventListener('DOMContentLoaded', init);

  return {
    setAuthMode, submitAuth, logout,
    go, refreshAll, flushQueueNow,
    setSearch, setCat, setStaff, setSort, setStatus,
    openAsset, closeRecord, chooseResult, saveRecord,
    addPhotos, removePhoto, viewPhoto, deleteLogEntry,
    openScanner, closeScanner, resumeScan, scanUnlisted,
    openBulk, closeBulk, setBulkCat, setBulkResult, bulkSubmit,
    openUnlisted, exportExcel, toggleSection,
    importMasterFile, confirmImport, cancelImport,
    setUserField, clearLocalCache
  };
})();
