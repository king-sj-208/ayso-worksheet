/* AYSO Field Worksheet: Google Drive upload.
 * Shared by the worksheet page and its background worker (sw.js), so PDFs
 * waiting on the device can be sent from either one.
 *
 * Uses the Google Drive "drive.file" permission: the app can only see the
 * folder and files it creates itself, nothing else in the user's Drive.
 */
(function (root) {
  'use strict';
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name';
  const FOLDER_MIME = 'application/vnd.google-apps.folder';

  /* ---- the device's own storage (same database the page uses) ---- */
  function openDb(){
    return new Promise((res, rej) => {
      const r = indexedDB.open('ayso-field-worksheet', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('pending', {keyPath: 'id', autoIncrement: true}); r.result.createObjectStore('kv'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function tx(store, mode, fn){
    const db = await openDb();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode), q = fn(t.objectStore(store));
      t.oncomplete = () => { db.close(); res(q ? q.result : undefined); };
      t.onerror = () => { db.close(); rej(t.error); };
      t.onabort = () => { db.close(); rej(t.error); };
    });
  }
  const kvGet = k => tx('kv', 'readonly', st => st.get(k));
  const kvSet = (k, v) => tx('kv', 'readwrite', st => st.put(v, k));

  /* ---- Google Drive calls ---- */
  async function api(token, url, opt = {}){
    let r;
    try { r = await fetch(url, Object.assign({}, opt, {headers: Object.assign({}, opt.headers || {}, {Authorization: 'Bearer ' + token})})); }
    catch (e) { const x = new Error('Google Drive could not be reached.'); x.network = true; throw x; }
    if (r.ok) return r.json();
    const j = await r.json().catch(() => null), msg = j && j.error && j.error.message || ('error ' + r.status);
    const x = new Error('Google Drive reported a problem: ' + msg);
    if (r.status === 401) { x.auth = true; x.message = 'Google sign-in has expired.'; }
    if (r.status === 404) x.notFound = true;
    if (r.status === 429 || r.status >= 500 || (r.status === 403 && /rate|quota/i.test(msg))) x.network = true;
    throw x;
  }
  const q = s => encodeURIComponent(s);
  const lit = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  /* Finds (or creates) the folder, e.g. "Referee Assessments". */
  async function ensureFolder(token, auth){
    if (auth.folderId) {
      try {
        const f = await api(token, `${API}/files/${q(auth.folderId)}?fields=id,trashed`);
        if (!f.trashed) return f.id;
      } catch (e) { if (!e.notFound) throw e; }
    }
    const name = auth.folderName || 'Referee Assessments';
    const found = await api(token, `${API}/files?spaces=drive&fields=files(id)&q=${q(`name='${lit(name)}' and mimeType='${FOLDER_MIME}' and trashed=false`)}`);
    if (found.files && found.files.length) return found.files[0].id;
    const made = await api(token, `${API}/files?fields=id`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, mimeType: FOLDER_MIME})});
    return made.id;
  }

  /* Uploads one PDF. A PDF already sent (e.g. after a dropped connection) is not sent again. */
  async function upload(token, folderId, item){
    const uid = item.uid || ('item-' + item.id + '-' + item.created);
    const dup = await api(token, `${API}/files?spaces=drive&fields=files(id)&q=${q(`'${lit(folderId)}' in parents and appProperties has { key='aysoUid' and value='${lit(uid)}' } and trashed=false`)}`);
    if (dup.files && dup.files.length) return dup.files[0].id;
    const b = 'ayso' + Math.random().toString(36).slice(2);
    const meta = {name: item.name, parents: [folderId], mimeType: 'application/pdf', appProperties: {aysoUid: uid}};
    const body = new Blob([
      `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/pdf\r\n\r\n`,
      item.data, `\r\n--${b}--`
    ]);
    return (await api(token, UPLOAD, {method: 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + b}, body})).id;
  }

  const tokenOk = a => !!(a && a.token && a.exp && Date.now() < a.exp - 60000);

  /* Sends every PDF waiting on the device. Returns {sent, needAuth, notConnected}.
     Only one upload run happens at a time, whether started by the page or the worker. */
  async function flush(){
    const run = async () => {
      const ids = await tx('pending', 'readonly', st => st.getAllKeys());
      if (!ids.length) return {sent: 0};
      let auth = await kvGet('gauth');
      if (!auth || !auth.email) return {sent: 0, notConnected: true};
      if (!tokenOk(auth)) return {sent: 0, needAuth: true};
      let sent = 0;
      try {
        const folderId = await ensureFolder(auth.token, auth);
        if (folderId !== auth.folderId) { auth = Object.assign({}, await kvGet('gauth'), {folderId}); await kvSet('gauth', auth); }
        for (const id of ids) {
          const it = await tx('pending', 'readonly', st => st.get(id));
          if (!it) continue;
          await upload(auth.token, folderId, it);
          await tx('pending', 'readwrite', st => st.delete(id));
          sent++;
        }
      } catch (e) {
        if (e.auth) {
          const a = await kvGet('gauth'); if (a) { a.exp = 0; await kvSet('gauth', a); }
          return {sent, needAuth: true};
        }
        e.sent = sent; throw e;
      }
      return {sent};
    };
    const locks = root.navigator && root.navigator.locks;
    return locks ? locks.request('ayso-drive-upload', run) : run();
  }

  root.AYSODrive = {API, api, kvGet, kvSet, ensureFolder, flush, tokenOk};
})(self);
