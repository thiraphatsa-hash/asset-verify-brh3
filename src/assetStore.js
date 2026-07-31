/**
 * Asset Verification — Supabase data layer (window.AssetStore)
 * pattern เดียวกับ supabase-web/src/supabaseStore.js ของ MCR Stock Count
 *
 * ต้องโหลดก่อนไฟล์นี้:
 *   1) supabase-js v2 UMD  → window.supabase
 *   2) config.js           → window.ASSET_CONFIG
 *
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
  function SITE() { return cfg().SITE || 'BRH3'; }

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
    // fallback: ถ้า DB trigger ไม่ทำงาน + ได้ session แล้ว สร้าง profile เอง (รออนุมัติ)
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
  async function fetchAll(table, orderCol, ascending) {
    const page = 1000;
    let from = 0;
    let all = [];
    for (;;) {
      const { data, error } = await getClient().from(table).select('*')
        .order(orderCol, { ascending: ascending !== false })
        .range(from, from + page - 1);
      fail(error);
      all = all.concat(data || []);
      if (!data || data.length < page) break;
      from += page;
    }
    return rowsToObjs(all);
  }

  // ── Master ─────────────────────────────────────────────────────────────────
  async function loadMaster() {
    return fetchAll('asset_master', 'inventory_number', true);
  }
  /**
   * นำเข้าทะเบียนใหม่: ลบของ site เดิมทั้งหมดแล้วใส่ชุดใหม่ (ทำเป็น 2 จังหวะ
   * เพราะไม่มี transaction ฝั่ง client — เรียกเฉพาะตอน admin ยืนยันแล้ว)
   * rows = [{inventoryNumber, assetType, ...}] (camelCase)
   */
  async function importMaster(rows, importedBy) {
    if (!rows || !rows.length) throw new Error('ไม่มีข้อมูลให้นำเข้า');
    const site = SITE();
    const { error: delError } = await getClient().from('asset_master')
      .delete().eq('site', site);
    fail(delError);
    const chunk = 400;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunk) {
      const part = rows.slice(i, i + chunk).map((r) => {
        const row = objToRow(r);
        row.site = site;
        row.imported_by = importedBy || '';
        return row;
      });
      const { error } = await getClient().from('asset_master')
        .upsert(part, { onConflict: 'inventory_number' });
      fail(error);
      inserted += part.length;
    }
    return { inserted };
  }

  // ── Verify log (append-only) ───────────────────────────────────────────────
  async function loadLogs() {
    return fetchAll('asset_verify_log', 'verified_at', true);
  }
  /**
   * บันทึกผลตรวจ 1 รายการ — idempotent ด้วย client_id:
   * ถ้าเคยบันทึกสำเร็จแล้ว (retry จากคิว offline) จะได้ duplicate → ถือว่าสำเร็จ
   */
  async function saveVerify(rec) {
    const row = objToRow(rec);
    row.site = row.site || SITE();
    const { data, error } = await getClient().from('asset_verify_log')
      .insert(row).select().maybeSingle();
    if (error) {
      if (error.code === '23505' || /duplicate key/i.test(error.message || '')) {
        return { duplicate: true };
      }
      throw new Error(error.message);
    }
    return rowToObj(data);
  }
  async function deleteLog(logId) {
    const { error } = await getClient().from('asset_verify_log')
      .delete().eq('log_id', logId);
    fail(error);
    return { success: true };
  }
  /** สมัครรับผลตรวจใหม่จากเครื่องอื่นแบบสด (Realtime) */
  function subscribeLogs(onInsert, onStatus) {
    const ch = getClient().channel('asset-verify-live')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'asset_verify_log' },
        (payload) => { try { onInsert(rowToObj(payload.new)); } catch (e) {} })
      .subscribe((status) => { if (onStatus) onStatus(status); });
    return ch;
  }

  // ── รูปถ่าย (Storage) ──────────────────────────────────────────────────────
  function base64ToBlob(base64, mime) {
    const clean = String(base64).split(',').pop();
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'image/jpeg' });
  }
  async function uploadPhoto(dataUrl, inventoryNumber) {
    const safe = String(inventoryNumber || 'ASSET').replace(/[^\w-]/g, '_');
    const path = SITE() + '/' + safe + '/' + Date.now() + '_' +
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
    sendPasswordReset, listProfiles, updateProfile,
    loadMaster, importMaster,
    loadLogs, saveVerify, deleteLog, subscribeLogs,
    uploadPhoto, photoUrls
  };
})();
window.AssetStore = AssetStore;
