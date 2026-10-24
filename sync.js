'use strict';
/* Motu cloud sync (Firebase Auth + Firestore).
   Layout: users/{uid}                 -> { meta: <settings, templates, weights, steps...>, updatedAt }
           users/{uid}/sessions/{id}   -> one finished workout
   The workout in progress (S.active) stays on the device. */
(function () {
  const CONFIG = {
    apiKey: 'AIzaSyACpZwv7fqzyBoTTomceWdlD6I2bpEIY4Y',
    authDomain: 'motu-57231.firebaseapp.com',
    projectId: 'motu-57231',
    storageBucket: 'motu-57231.firebasestorage.app',
    messagingSenderId: '716446418246',
    appId: '1:716446418246:web:d3bbce40b33c52d768d147'
  };
  const META_KEYS = ['settings', 'templates', 'exTypes', 'exUnits', 'weights', 'steps'];
  const LOCAL_ONLY_SETTINGS = ['lastBackup'];

  const SY = window.MotuSync = { user: null, state: 'off', lastSync: null, error: '' };
  if (!window.firebase || !firebase.initializeApp) { SY.state = 'unavailable'; return; }

  firebase.initializeApp(CONFIG);
  const auth = firebase.auth(), db = firebase.firestore();
  try { db.enablePersistence({ synchronizeTabs: true }).catch(() => { }); } catch (e) { }

  let unsubMeta = null, unsubSess = null, pushT = null, ready = false;
  const synced = { sessions: {}, meta: null };   // what the cloud already has, as JSON strings

  const metaOf = () => {
    const m = {};
    for (const k of META_KEYS) m[k] = JSON.parse(JSON.stringify(S[k] ?? null));
    if (m.settings) for (const k of LOCAL_ONLY_SETTINGS) delete m.settings[k];
    return m;
  };
  const clean = s => JSON.parse(JSON.stringify(s));
  // key-order-independent JSON, so cloud copies compare equal to local ones
  const stable = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => (o[key] = x[key], o), {}) : x);
  // ids this device knew the cloud had, so a workout deleted on another device isn't brought back
  const ID_KEY = 'motu.syncedIds';
  const knownIds = uid => { try { const v = JSON.parse(localStorage.getItem(ID_KEY) || 'null'); return v && v.uid === uid ? new Set(v.ids) : new Set(); } catch (e) { return new Set(); } };
  const rememberIds = () => { try { if (SY.user) localStorage.setItem(ID_KEY, JSON.stringify({ uid: SY.user.uid, ids: Object.keys(synced.sessions) })); } catch (e) { } };
  // settings hold lists inside lists (weight checkpoints), which Firestore can't store, so meta travels as one JSON string
  const readMeta = d => { if (!d) return null; if (typeof d.metaJson === 'string') { try { return JSON.parse(d.metaJson); } catch (e) { return null; } } return d.meta || null; };
  const metaDoc = () => ({ metaJson: JSON.stringify(metaOf()), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  const sessKey = s => s.imported ? `imp|${s.date}|${s.name}` : null;
  const setState = (st, err) => { SY.state = st; SY.error = err || ''; paint(); };

  function paint() {
    const pill = document.querySelector('.syncpill');
    if (pill) { pill.className = 'syncpill ' + pillClass(); pill.innerHTML = pillText(); }
    const box = document.querySelector('#syncbox');
    if (box) box.innerHTML = syncBoxHTML();
  }
  const pillClass = () => SY.user ? (SY.state === 'synced' ? 'ok' : SY.state === 'error' ? 'bad' : 'wait') : 'off';
  const pillText = () => !SY.user ? 'Not synced' : SY.state === 'synced' ? 'Synced' : SY.state === 'error' ? 'Sync problem' : navigator.onLine === false ? 'Offline, will sync' : 'Syncing';

  /* ---------- first sign-in: merge this device with the cloud ---------- */
  async function firstMerge(uid) {
    setState('syncing');
    const userRef = db.collection('users').doc(uid);
    const [metaSnap, sessSnap] = await Promise.all([userRef.get(), userRef.collection('sessions').get()]);
    const cloudSessions = {}; sessSnap.forEach(d => { cloudSessions[d.id] = d.data(); });
    const cloudKeys = new Set(Object.values(cloudSessions).map(sessKey).filter(Boolean));

    // sessions: union by id; seeded history is matched by date + name so it never doubles up
    const merged = { ...cloudSessions }, known = knownIds(uid);
    for (const s of S.sessions) {
      if (merged[s.id]) continue;
      if (known.has(s.id)) continue;   // was in the cloud before, so it was deleted elsewhere
      const k = sessKey(s); if (k && cloudKeys.has(k)) continue;
      merged[s.id] = s;
    }
    // meta: cloud settings win; weigh-ins and steps are combined
    const cmRead = metaSnap.exists ? readMeta(metaSnap.data()) : null;
    if (cmRead) {
      const cm = cmRead, local = metaOf();
      const w = {}; for (const x of [...(local.weights || []), ...(cm.weights || [])]) w[x.date] = x;
      for (const k of META_KEYS) if (cm[k] != null) S[k] = cm[k];
      S.settings = { ...S.settings, ...cm.settings, lastBackup: S.settings.lastBackup };
      S.weights = Object.values(w).sort((a, b) => a.date < b.date ? -1 : 1);
      S.steps = { ...(local.steps || {}), ...(cm.steps || {}) };
    }
    S.sessions = Object.values(merged);
    if (S.fresh && (S.sessions.length || cmRead)) { delete S.fresh; const ob = document.querySelector('#onboard'); if (ob) { ob.hidden = true; ob.innerHTML = ''; document.body.classList.remove('noscroll'); } }
    localSave();

    // upload anything the cloud doesn't have yet
    const batch = db.batch(); let n = 0;
    for (const s of S.sessions) if (!cloudSessions[s.id]) { batch.set(userRef.collection('sessions').doc(s.id), clean(s)); n++; }
    batch.set(userRef, metaDoc());
    await batch.commit();
    for (const s of S.sessions) synced.sessions[s.id] = stable(clean(s));
    synced.meta = stable(metaOf());
    rememberIds();
    ready = true;
    SY.lastSync = new Date(); setState('synced');
    safeRender();
    return n;
  }

  /* ---------- live updates from other devices ---------- */
  function listen(uid) {
    const userRef = db.collection('users').doc(uid);
    unsubMeta = userRef.onSnapshot({ includeMetadataChanges: true }, snap => {
      if (!ready || !snap.exists || snap.metadata.hasPendingWrites) return;
      const cm = readMeta(snap.data()); if (!cm) return;
      const js = stable(cm); if (js === synced.meta) return;
      for (const k of META_KEYS) if (cm[k] != null) S[k] = cm[k];
      S.settings = { ...S.settings, ...cm.settings };
      synced.meta = stable(metaOf());
      localSave(); safeRender();
    }, err => setState('error', err.message));
    unsubSess = userRef.collection('sessions').onSnapshot({ includeMetadataChanges: true }, snap => {
      if (!ready) return;
      let changed = false;
      snap.docChanges().forEach(ch => {
        const id = ch.doc.id;
        if (ch.type === 'removed') {
          if (S.sessions.some(s => s.id === id)) { S.sessions = S.sessions.filter(s => s.id !== id); changed = true; }
          delete synced.sessions[id];
          return;
        }
        if (ch.doc.metadata.hasPendingWrites) return;
        const data = ch.doc.data(), js = stable(data);
        if (synced.sessions[id] === js) return;
        const i = S.sessions.findIndex(s => s.id === id);
        if (i >= 0) S.sessions[i] = data; else S.sessions.push(data);
        synced.sessions[id] = js; changed = true;
      });
      if (!snap.metadata.hasPendingWrites) { SY.lastSync = new Date(); if (SY.state !== 'error') setState(snap.metadata.fromCache ? 'syncing' : 'synced'); }
      rememberIds();
      if (changed) { localSave(); safeRender(); }
    }, err => setState('error', err.message));
  }

  /* ---------- push local changes ---------- */
  async function push() {
    if (!SY.user || !ready) return;
    const userRef = db.collection('users').doc(SY.user.uid);
    const batch = db.batch(); let n = 0;
    const now = {};
    for (const s of S.sessions) {
      const js = stable(clean(s)); now[s.id] = js;
      if (synced.sessions[s.id] !== js) { batch.set(userRef.collection('sessions').doc(s.id), clean(s)); synced.sessions[s.id] = js; n++; }
    }
    for (const id of Object.keys(synced.sessions)) if (!now[id]) { batch.delete(userRef.collection('sessions').doc(id)); delete synced.sessions[id]; n++; }
    const m = metaOf(), mjs = stable(m);
    if (mjs !== synced.meta) { batch.set(userRef, metaDoc()); synced.meta = mjs; n++; }
    if (!n) return;
    setState('syncing');
    rememberIds();
    batch.commit().then(() => { SY.lastSync = new Date(); setState('synced'); }).catch(err => setState('error', err.message));
  }
  const schedulePush = () => { clearTimeout(pushT); pushT = setTimeout(push, 800); };

  // wrap the app's save so every change also syncs
  const localSave = save;
  save = function () { localSave(); schedulePush(); };

  function safeRender() {
    // don't rebuild the screen under someone typing in a workout
    if (typeof tab !== 'undefined' && tab === 'workout' && S.active) return;
    const m = document.querySelector('#modal');
    if (m && !m.hidden) return;
    render();
  }

  /* ---------- auth ---------- */
  auth.onAuthStateChanged(async user => {
    if (unsubMeta) { unsubMeta(); unsubMeta = null; }
    if (unsubSess) { unsubSess(); unsubSess = null; }
    ready = false; synced.sessions = {}; synced.meta = null;
    SY.user = user || null;
    if (!user) { setState('off'); safeRender(); return; }
    try { await firstMerge(user.uid); listen(user.uid); }
    catch (err) { setState('error', err.message || String(err)); }
  });
  auth.getRedirectResult().catch(err => setState('error', friendly(err)));
  window.addEventListener('online', paint);
  window.addEventListener('offline', paint);

  function friendly(err) {
    const c = (err && err.code) || '';
    if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Email or password is wrong.';
    if (c.includes('email-already-in-use')) return 'That email already has an account. Sign in instead.';
    if (c.includes('weak-password')) return 'Use at least 6 characters for the password.';
    if (c.includes('invalid-email')) return 'That email looks wrong.';
    if (c.includes('unauthorized-domain')) return 'This site is not yet allowed in Firebase (Authorized domains).';
    if (c.includes('popup')) return 'The Google window was blocked or closed. Try email and password.';
    if (c.includes('network')) return 'No connection. Try again when you are online.';
    return (err && err.message) || 'Something went wrong.';
  }

  /* ---------- UI: settings box + home pill ---------- */
  function syncBoxHTML() {
    if (SY.user) {
      const t = SY.lastSync ? SY.lastSync.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
      return `<div class="syncok"><b>Synced as ${esc(SY.user.email || 'your account')}</b>
        <span class="muted sm">${SY.state === 'error' ? esc(SY.error) : SY.state === 'synced' ? 'Up to date' + (t ? ' · ' + t : '') : 'Syncing...'}</span></div>
        <p class="muted sm">Every workout, weigh-in and step count saves to your account and shows up on all your devices.</p>
        ${SY.state === 'error' ? '<button class="btn primary wide" data-act="syncRetry">Try again</button>' : ''}
        <button class="btn wide" data-act="syncOut">Sign out of this device</button>`;
    }
    return `<p class="muted sm">Sign in on each device and your workouts stay the same everywhere, backed up automatically.</p>
      <label class="lbl">Email<input class="field" id="syEmail" type="email" autocomplete="email" inputmode="email"></label>
      <label class="lbl">Password<input class="field" id="syPass" type="password" autocomplete="current-password"></label>
      ${SY.error ? `<p class="syerr">${esc(SY.error)}</p>` : ''}
      <div class="row2"><button class="btn primary" data-act="syncIn">Sign in</button><button class="btn" data-act="syncUp">Create account</button></div>
      <button class="btn wide" data-act="syncGoogle">Continue with Google</button>`;
  }
  const _settings = settingsModal;
  settingsModal = function () {
    _settings();
    const sheet = document.querySelector('#modal .sheet'); if (!sheet) return;
    const mh = sheet.querySelector('.mh');
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="sect">Account & sync</div><div id="syncbox" class="card syncard">${syncBoxHTML()}</div>`;
    mh.after(...wrap.childNodes);
  };
  const _home = viewHome;
  viewHome = function () {
    let h = _home();
    h = h.replace('</div><h1>', `<button class="syncpill ${pillClass()}" data-act="settings">${pillText()}</button></div><h1>`);
    if (SY.user) h = h.replace(/<button class="notice" data-act="export">[\s\S]*?<\/button>/, '');
    return h;
  };

  const creds = () => [($('#syEmail') || {}).value?.trim(), ($('#syPass') || {}).value];
  ACT.syncIn = async () => {
    const [e, p] = creds(); if (!e || !p) return toast('Enter your email and password');
    SY.error = ''; try { await auth.signInWithEmailAndPassword(e, p); toast('Signed in. Syncing your workouts'); } catch (err) { SY.error = friendly(err); paint(); }
  };
  ACT.syncUp = async () => {
    const [e, p] = creds(); if (!e || !p) return toast('Enter an email and a password');
    SY.error = ''; try { await auth.createUserWithEmailAndPassword(e, p); toast('Account created. Uploading your workouts'); } catch (err) { SY.error = friendly(err); paint(); }
  };
  ACT.syncGoogle = async () => {
    SY.error = '';
    const provider = new firebase.auth.GoogleAuthProvider();
    const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    try {
      if (standalone) await auth.signInWithRedirect(provider);
      else { await auth.signInWithPopup(provider); toast('Signed in. Syncing your workouts'); }
    } catch (err) { SY.error = friendly(err); paint(); }
  };
  ACT.syncRetry = async () => {
    if (!SY.user) return;
    if (unsubMeta) { unsubMeta(); unsubMeta = null; } if (unsubSess) { unsubSess(); unsubSess = null; }
    try { await firstMerge(SY.user.uid); listen(SY.user.uid); toast('Synced'); } catch (err) { setState('error', err.message || String(err)); }
  };
  ACT.syncOut = async () => {
    if (!(await ask('Sign out of this device? Your workouts stay safe in your account.', 'Sign out'))) return;
    await auth.signOut(); try { localStorage.removeItem(ID_KEY); } catch (e) { } toast('Signed out');
  };

  paint();
})();
