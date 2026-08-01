/**
 * Asset Verification — Supabase data layer (window.AssetStore)
 * pattern เดียวกับ supabase-web/src/supabaseStore.js ของ MCR Stock Count
 *
 * ต้องโหลดก่อนไฟล์นี้:
 *   1) supabase-js v2 UMD  → window.supabase
 *   2) config.js           → window.ASSET_CONFIG
 *
 * โครงข้อมูล: asset_sessions (รอบตรวจ) → asset_master (ทะเบียนของรอบนั้น)
 *              → asset_verify_log (ผลตรวจ append-only)
 * การ map ชื่อ: DB เป็น snake_case ↔ แอปใช้ camelCase (แปลงอัตโนมัติ)
 */
const AssetStore = (function () {
  let client = null;

  function cfg() { return window.ASSET_CONFIG || {}; }
  function getClient() {
    if (client) return client;
    const c = cfg();
    if (!c.SUPABASE_URL || !c.SUPABASE_ANON_KEY ||
        /YOUR-PROJECT-REF|YOUR-ANON-KEY/.test(c.SUPABASE_URL + c.SUPABASE_ANON_KEY)) {
      throw new Error('ยังไม่ได้ตั้งค่า config.js (SUPABASE_URL / SUPABASE_ANON_KEY)');
    }
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('ยังไม่ได้โหลด supabase-js (window.supabase)');
    }
    client = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return client;
  }
  function BUCKET() { return cfg().STORAGE_BUCKET || 'asset-files'; }

  // ── snake_case ↔ camelCase ─────────────────────────────────────────────────
  const toCamel = (s) => String(s).replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());
  const toSnake = (s) => String(s).replace(/[A-Z]/g, (ch) => '_' + ch.toLowerCase());
  function rowToObj(row) {
    if (!row) return row;
    const out = {};
    Object.keys(row).forEach((k) => { out[toCamel(k)] = row[k]; });
    return out;
  }
  const rowsToObjs = (rows) => (rows || []).map(rowToObj);
  function objToRow(obj) {
    const out = {};
    Object.keys(obj || {}).forEach((k) => {
      if (obj[k] === undefined) return;
      out[toSnake(k)] = obj[k];
    });
    return out;
  }
  function fail(error) { if (error) throw new Error(error.message || String(error)); }
  const uuid = () => (window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));

  // ── Auth ───────────────────────────────────────────────────────────────────
  async function signIn(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    fail(error);
    return data.user;
  }
  async function signOut() { try { await getClient().auth.signOut(); } catch (e) {} }
  async function getSession() {
    const { data } = await getClient().auth.getSession();
    return data ? data.session : null;
  }
  async function currentUser() {
    const { data, error } = await getClient().auth.getUser();
    if (error) throw new Error(error.message);
    return data ? data.user : null;
  }
  async function signUp(email, password) {
    const { data, error } = await getClient().auth.signUp({ email, password });
    fail(error);
    if (data && data.session && data.user) {
      try {
        await getClient().from('profiles').upsert(
          { id: data.user.id, email: data.user.email, role: 'viewer', active: false },
          { onConflict: 'id', ignoreDuplicates: true });
      } catch (e) {}
    }
    return data.user;
  }
  async function sendPasswordReset(email) {
    const redirect = location.href.replace(/[^/?#]*(?:[?#].*)?$/, 'reset.html');
    const { error } = await getClient().auth.resetPasswordForEmail(email, { redirectTo: redirect });
    fail(error);
    return { success: true };
  }
  async function getMyProfile() {
    const { data: u } = await getClient().auth.getUser();
    if (!u || !u.user) return null;
    const { data, error } = await getClient().from('profiles').select('*')
      .eq('id', u.user.id).maybeSingle();
    fail(error);
    return data ? rowToObj(data)
      : { id: u.user.id, email: u.user.email, role: 'viewer', active: false };
  }
  async function listProfiles() {
    const { data, error } = await getClient().from('profiles').select('*')
      .order('created_at', { ascending: true });
    fail(error);
    return rowsToObjs(data);
  }
  /**
   * ยืนยันอีเมลแทนผู้ใช้ (เรียกตอน admin อนุมัติบัญชี)
   * best-effort: ถ้ายังไม่ได้ติดตั้งฟังก์ชัน ก็ไม่ให้การอนุมัติล้มเหลว
   */
  async function confirmUserEmail(id) {
    if (!id) return { skipped: true };
    const { error } = await getClient().rpc('admin_confirm_email', { target: id });
    if (error) return { skipped: true, message: error.message };
    return { success: true };
  }
  /** ลบบัญชีถาวรผ่าน RPC admin_delete_user (ตรวจสิทธิ์ admin ฝั่ง DB) */
  async function deleteUserAccount(id) {
    if (!id) throw new Error('ไม่พบบัญชี');
    const { error } = await getClient().rpc('admin_delete_user', { target: id });
    if (error) {
      if (/could not find|does not exist|schema cache/i.test(error.message || '')) {
        throw new Error('ยังไม่ได้ติดตั้งฟังก์ชันลบบัญชี — รันไฟล์ auth-tools.sql ใน Supabase SQL Editor ก่อน');
      }
      throw new Error(error.message);
    }
    return { success: true };
  }
  async function updateProfile(payload) {
    if (!payload || !payload.id) throw new Error('ไม่พบบัญชี');
    const patch = {};
    if (payload.role !== undefined) patch.role = payload.role;
    if (payload.active !== undefined) patch.active = Boolean(payload.active);
    if (payload.fullName !== undefined) patch.full_name = payload.fullName;
    const { data, error } = await getClient().from('profiles').update(patch)
      .eq('id', payload.id).select().maybeSingle();
    fail(error);
    return rowToObj(data);
  }

  // ── ดึงข้อมูลทั้งตาราง (เกิน 1000 แถวก็ครบ — วนทีละหน้า) ─────────────────────
  async function fetchPaged(table, cols, orderCol, ascending, filter) {
    const page = 1000;
    let from = 0;
    let all = [];
    for (;;) {
      let q = getClient().from(table).select(cols || '*');
      if (filter) q = filter(q);
      const { data, error } = await q
        .order(orderCol, { ascending: ascending !== false })
        .range(from, from + page - 1);
      fail(error);
      all = all.concat(data || []);
      if (!data || data.length < page) break;
      from += page;
    }
    return rowsToObjs(all);
  }

  // ── รอบการตรวจนับ ──────────────────────────────────────────────────────────
  async function listSessions() {
    return fetchPaged('asset_sessions', '*', 'created_at', false);
  }
  async function createSession(payload) {
    const row = objToRow(payload);
    const { data, error } = await getClient().from('asset_sessions')
      .insert(row).select().maybeSingle();
    if (error) {
      if (/relation .*asset_sessions.* does not exist|schema cache/i.test(error.message || '')) {
        throw new Error('ยังไม่ได้ติดตั้งระบบรอบตรวจ — รันไฟล์ asset-rounds.sql ใน Supabase SQL Editor ก่อน');
      }
      throw new Error(error.message);
    }
    return rowToObj(data);
  }
  async function updateSession(sessionId, patch) {
    const { data, error } = await getClient().from('asset_sessions')
      .update(objToRow(patch)).eq('session_id', sessionId).select().maybeSingle();
    fail(error);
    return rowToObj(data);
  }
  async function deleteSession(sessionId) {
    // FK เป็น on delete cascade → ทะเบียนและผลตรวจของรอบนี้ถูกลบตามอัตโนมัติ
    const { error } = await getClient().from('asset_sessions')
      .delete().eq('session_id', sessionId);
    fail(error);
    return { success: true };
  }

  // ── ทะเบียนทรัพย์สินของรอบ ─────────────────────────────────────────────────
  async function loadMaster(sessionId) {
    if (!sessionId) return [];
    return fetchPaged('asset_master', '*', 'inventory_number', true,
      (q) => q.eq('session_id', sessionId));
  }
  /** นำเข้าทะเบียนของรอบใหม่ (rows = camelCase) */
  async function importAssets(sessionId, rows, importedBy) {
    if (!sessionId) throw new Error('ไม่พบรอบตรวจ');
    if (!rows || !rows.length) throw new Error('ไม่มีข้อมูลให้นำเข้า');
    const chunk = 400;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunk) {
      const part = rows.slice(i, i + chunk).map((r) => {
        const row = objToRow(r);
        row.session_id = sessionId;
        row.imported_by = importedBy || '';
        return row;
      });
      const { error } = await getClient().from('asset_master').insert(part);
      fail(error);
      inserted += part.length;
    }
    return { inserted };
  }

  // ── ผลตรวจ (append-only) ───────────────────────────────────────────────────
  async function loadLogs(sessionId) {
    if (!sessionId) return [];
    return fetchPaged('asset_verify_log', '*', 'verified_at', true,
      (q) => q.eq('session_id', sessionId));
  }
  /** โหลดผลตรวจแบบย่อของทุกรอบ (ใช้คำนวณความคืบหน้าในหน้าแรก) */
  async function loadLogsSummary() {
    return fetchPaged('asset_verify_log',
      'log_id, session_id, inventory_number, result, condition, verified_at, inspector, unregistered',
      'verified_at', true);
  }
  async function saveVerify(rec) {
    const row = objToRow(rec);
    let res = await getClient().from('asset_verify_log').insert(row).select().maybeSingle();
    // ยังไม่ได้รัน asset-duplicates.sql → ตัดคอลัมน์ piece_no ออกแล้วลองใหม่ ไม่ให้บันทึกพัง
    if (res.error && /piece_no/.test(res.error.message || '')) {
      const legacy = Object.assign({}, row);
      delete legacy.piece_no;
      res = await getClient().from('asset_verify_log').insert(legacy).select().maybeSingle();
    }
    if (res.error) {
      if (res.error.code === '23505' || /duplicate key/i.test(res.error.message || '')) {
        return { duplicate: true };
      }
      throw new Error(res.error.message);
    }
    return rowToObj(res.data);
  }
  /** โหลดรูปจาก Storage เป็น base64 (ใช้ตอนฝังรูปลงไฟล์ Excel) */
  async function downloadPhoto(path) {
    const { data, error } = await getClient().storage.from(BUCKET()).download(path);
    fail(error);
    const buf = await data.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  async function deleteLog(logId) {
    const { error } = await getClient().from('asset_verify_log')
      .delete().eq('log_id', logId);
    fail(error);
    return { success: true };
  }
  /** ลบประวัติการตรวจของหลายรหัสในรอบเดียว (ใช้กับการเลือกหลายรายการ) */
  async function deleteLogsFor(sessionId, inventoryNumbers) {
    const list = (inventoryNumbers || []).filter(Boolean);
    if (!sessionId || !list.length) return { deleted: 0 };
    let deleted = 0;
    const chunk = 100;
    for (let i = 0; i < list.length; i += chunk) {
      const part = list.slice(i, i + chunk);
      const { data, error } = await getClient().from('asset_verify_log')
        .delete().eq('session_id', sessionId).in('inventory_number', part).select('log_id');
      fail(error);
      deleted += (data || []).length;
    }
    return { deleted: deleted };
  }
  /** รับผลตรวจใหม่จากเครื่องอื่นแบบสด เฉพาะรอบที่กำลังเปิดอยู่ */
  function subscribeLogs(sessionId, onInsert, onStatus) {
    const ch = getClient().channel('asset-verify-' + (sessionId || 'all'))
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'asset_verify_log',
          filter: sessionId ? 'session_id=eq.' + sessionId : undefined },
        (payload) => { try { onInsert(rowToObj(payload.new)); } catch (e) {} })
      .subscribe((status) => { if (onStatus) onStatus(status); });
    return ch;
  }
  function unsubscribe(ch) {
    try { if (ch) getClient().removeChannel(ch); } catch (e) {}
  }

  // ── รูปถ่าย (Storage) ──────────────────────────────────────────────────────
  function base64ToBlob(base64, mime) {
    const clean = String(base64).split(',').pop();
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'image/jpeg' });
  }
  async function uploadPhoto(dataUrl, sessionId, inventoryNumber) {
    const safe = String(inventoryNumber || 'ASSET').replace(/[^\w-]/g, '_');
    const path = (sessionId || 'no-session') + '/' + safe + '/' + Date.now() + '_' +
      Math.random().toString(36).slice(2, 8) + '.jpg';
    const { error } = await getClient().storage.from(BUCKET())
      .upload(path, base64ToBlob(dataUrl, 'image/jpeg'),
        { contentType: 'image/jpeg', upsert: true });
    fail(error);
    return path;
  }
  async function photoUrls(paths) {
    const list = (paths || []).filter(Boolean);
    if (!list.length) return {};
    const { data, error } = await getClient().storage.from(BUCKET())
      .createSignedUrls(list, 3600);
    if (error) return {};
    const map = {};
    (data || []).forEach((d) => { if (d && d.path && d.signedUrl) map[d.path] = d.signedUrl; });
    return map;
  }

  return {
    getClient, uuid,
    signIn, signOut, signUp, getSession, currentUser, getMyProfile,
    sendPasswordReset, listProfiles, updateProfile, deleteUserAccount, confirmUserEmail,
    listSessions, createSession, updateSession, deleteSession,
    loadMaster, importAssets,
    loadLogs, loadLogsSummary, saveVerify, deleteLog, deleteLogsFor, subscribeLogs, unsubscribe,
    uploadPhoto, photoUrls, downloadPhoto
  };
})();
window.AssetStore = AssetStore;
