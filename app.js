'use strict';
/* Motu: a Push/Pull/Legs tracker. All data lives in this browser (localStorage).
   Back it up from Settings > Export. */

const APP_VERSION = '2.0.4';
const ENV = window.MOTU_ENV || {};
const KEY = ENV.key || 'motu.v1';
const OLD_KEYS = ENV.key ? [] : ['unstuck.v1', 'relentless.v1'];
const VERSION = 1;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);

/* ---------------- dates ---------------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const mondayOf = s => { const d = parseD(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const fmtDate = s => parseD(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtShort = s => parseD(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/* ---------------- state ---------------- */
const DEFAULT_SETTINGS = {
  startDate: SEED.startDate, weeklyTarget: 6, streakThreshold: 4,
  xpSession: 100, xpStairMin: 2, xpStepDay: 20, xpPR: 25, xpComeback: 100,
  goalWeight: 90, stepGoal: 10000, unit: 'kg', barKg: 20,
  milestones: [['2026-10-15', 104], ['2026-11-25', 100], ['2026-12-25', 97], ['2027-02-25', 90]],
  lastBackup: null, name: 'Awsaf', voice: 'kind', comebackSeen: null
};

function parseSets(str) {
  return str.trim().split(/\s+/).map(p => { const [w, r] = p.split('x'); return { w: +w || 0, r: +r || 0 }; }).filter(x => x.r > 0);
}

function buildSeed() {
  const s = {
    v: VERSION, seedV: 5, settings: { ...DEFAULT_SETTINGS },
    templates: SEED.templates.map(t => ({
      id: t.id, day: t.day, name: t.name, focus: t.focus,
      exercises: t.ex.map(a => ({ name: a[0], sets: a[1], repMin: a[2], repMax: a[3], rest: a[4], optional: !!a[5], note: a[6] || '' }))
    })),
    exTypes: { ...SEED.types }, sessions: [], weights: [], steps: {}, exUnits: {}, food: {}, active: null
  };
  // Sessions in the order they were trained, then dated from the Strong calendar
  const order = [{ t: 'd1', unlogged: true }, { t: null, unlogged: true, name: 'Extra workout' }];
  const hist = [...SEED.history].sort((x, y) => x.w - y.w || SEED.templates.find(t => t.id === x.t).day - SEED.templates.find(t => t.id === y.t).day);
  order.push({ t: null, unlogged: true, name: 'Extra workout' }, ...hist);
  order.forEach((h, k) => {
    const t = h.t ? SEED.templates.find(x => x.id === h.t) : null;
    const date = SEED.calendar[k] || addDays(SEED.startDate, k);
    const exercises = h.e ? h.e.map((str, i) => ({ name: (h.names && h.names[i]) || t.ex[i][0], sets: parseSets(str), note: '' })).filter(x => x.sets.length) : [];
    s.sessions.push({
      id: uid(), date, templateId: t ? t.id : null, name: t ? t.name : h.name, durationMin: null, exercises,
      stair: h.s ? { min: h.s[0], level: h.s[1], kcal: h.s[2] || 0 } : null, note: '', imported: true, unlogged: !!h.unlogged, xpBonus: 0
    });
  });
  SEED.weights.forEach(([w, kg]) => s.weights.push({ date: addDays(SEED.startDate, (w - 1) * 7), kg }));
  return s;
}

function migrate(s) {
  s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  s.templates = s.templates || [];
  s.exTypes = s.exTypes || {};
  s.sessions = s.sessions || [];
  s.weights = s.weights || [];
  s.steps = s.steps || {};
  s.exUnits = s.exUnits || {};
  s.profile = s.profile || null;
  s.food = s.food || {};
  if (s.active === undefined) s.active = null;
  if ((s.seedV || 1) < 5) { // re-date imported sessions from the Strong calendar, keep anything logged in the app
    s.sessions = buildSeed().sessions.concat(s.sessions.filter(x => !x.imported)); s.seedV = 5;
  }
  return s;
}

function buildFresh() {
  const s = buildSeed();
  s.sessions = []; s.weights = []; s.steps = {}; s.exUnits = {};
  s.settings = { ...s.settings, name: '', startDate: mondayOf(today()), milestones: [], goalWeight: 0, lastBackup: null, comebackSeen: null };
  s.fresh = true;
  return s;
}
function load() {
  try { const raw = localStorage.getItem(KEY) || OLD_KEYS.map(k => localStorage.getItem(k)).find(Boolean); if (raw) return migrate(JSON.parse(raw)); } catch (e) { }
  return buildFresh();
}
let S = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save. Storage may be full.'); }
}
let saveT = null;
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 300); }
save();
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }

/* ---------------- units ---------------- */
const LB = 2.20462;
const unit = () => S.settings.unit;
const trim = n => (Math.round(n * 100) / 100).toString();
function dispW(kg) { if (kg === '' || kg == null) return ''; return unit() === 'lb' ? trim(Math.round(kg * LB * 2) / 2) : trim(kg); }
function toKg(v) { if (isNaN(v)) return ''; return unit() === 'lb' ? v / LB : v; }
function dispWU(kg, u) { if (kg === '' || kg == null) return ''; return u === 'lb' ? trim(Math.round(kg * LB * 2) / 2) : trim(Math.round(kg * 100) / 100); }
function toKgU(v, u) { if (isNaN(v)) return ''; return u === 'lb' ? v / LB : v; }
const exUnit = name => (S.exUnits && S.exUnits[name]) || S.settings.unit;
function dispR(kg) { const v = unit() === 'lb' ? Math.round(kg * LB) : Math.round(kg * 2) / 2; return trim(v); }
const fmtSet = s => `${s.w > 0 ? dispW(s.w) : 'BW'} × ${s.r}`;
function fmtVol(kg) { const v = unit() === 'lb' ? kg * LB : kg; return Math.round(v).toLocaleString() + ' ' + unit(); }

/* ---------------- derived ---------------- */
const byDate = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startTs || 0) - (b.startTs || 0);
const sorted = () => [...S.sessions].sort(byDate);
const volume = sess => sess.exercises.reduce((v, e) => v + e.sets.reduce((a, x) => a + x.w * x.r, 0), 0);
const setCount = sess => sess.exercises.reduce((v, e) => v + e.sets.length, 0);
const e1rm = (w, r) => (w > 0 && r > 0) ? (r === 1 ? w : w * (1 + r / 30)) : 0;
const exType = name => S.exTypes[name] || (window.EXLIB && EXLIB[name] && EXLIB[name].type) || guessType(name);
function guessType(n) {
  n = n.toLowerCase();
  if (/barbell|ez-bar|deadlift|bench|squat(?!.*(hack|split))/.test(n)) return 'barbell';
  if (/dumbbell|db |split squat/.test(n)) return 'dumbbell';
  if (/cable|pulldown|face pull|pushdown/.test(n)) return 'cable';
  if (/push-up|pull-up|chin|dip|plank|hanging/.test(n)) return 'bodyweight';
  return 'machine';
}
function exHistory(name, excludeId) {
  const out = [];
  for (const s of sorted()) {
    if (s.id === excludeId) continue;
    const e = s.exercises.find(x => x.name === name);
    if (e && e.sets.length) out.push({ date: s.date, id: s.id, sets: e.sets });
  }
  return out;
}
const lastPerf = (name, ex) => { const h = exHistory(name, ex); return h[h.length - 1] || null; };
function bestE1(name, ex) { let b = 0; for (const h of exHistory(name, ex)) for (const x of h.sets) b = Math.max(b, e1rm(x.w, x.r)); return b; }
function allExerciseNames() {
  const set = new Set();
  S.templates.forEach(t => t.exercises.forEach(e => set.add(e.name)));
  S.sessions.forEach(s => s.exercises.forEach(e => set.add(e.name)));
  Object.keys(S.exTypes).forEach(n => set.add(n));
  return [...set].sort((a, b) => a.localeCompare(b));
}
const tmpl = id => S.templates.find(t => t.id === id);
function weekNo(date) { return Math.floor(daysBetween(mondayOf(S.settings.startDate), date) / 7) + 1; }

function weekStats() {
  const st = S.settings, start = mondayOf(st.startDate), n = Math.max(weekNo(today()), 1);
  const weeks = [];
  for (let i = 1; i <= n; i++) weeks.push({ no: i, start: addDays(start, (i - 1) * 7), sessions: [], days: new Set(), stairMin: 0, extra: 0 });
  for (const s of S.sessions) {
    const w = weekNo(s.date); if (w < 1 || w > n) continue;
    const W = weeks[w - 1]; W.sessions.push(s);
    const t = tmpl(s.templateId);
    if (t && t.day && !W.days.has(t.day)) W.days.add(t.day); else W.extra++;
    if (s.stair) W.stairMin += +s.stair.min || 0;
  }
  let streak = 0, best = 0, perfect = 0;
  weeks.forEach((W, i) => {
    const c = W.sessions.length, cur = i === n - 1; W.count = c; W.current = cur;
    if (c >= st.weeklyTarget) perfect++;
    if (c >= st.streakThreshold) { streak++; best = Math.max(best, streak); } else if (!cur) streak = 0;
    W.streak = streak;
    W.status = c >= st.weeklyTarget ? 'Perfect' : cur ? `${c}/${st.weeklyTarget} so far` : c >= st.streakThreshold ? 'Strong' : c > 0 ? 'Slipping' : 'Missed';
    W.cls = c >= st.weeklyTarget ? 'perfect' : cur ? 'live' : c >= st.streakThreshold ? 'strong' : c > 0 ? 'slipping' : 'missed';
    let steps = 0, logged = 0, hit = 0;
    for (let d = 0; d < 7; d++) { const v = S.steps[addDays(W.start, d)]; if (v != null) { steps += v; logged++; if (v >= st.stepGoal) hit++; } }
    W.stepAvg = logged ? Math.round(steps / logged) : null; W.stepHit = hit;
  });
  return { weeks, cur: n, streak, best, perfect };
}

function xpTotal() {
  const st = S.settings; let xp = 0;
  for (const s of S.sessions) xp += st.xpSession + (+(s.stair && s.stair.min) || 0) * st.xpStairMin + (s.xpBonus || 0);
  for (const k in S.steps) if (S.steps[k] >= st.stepGoal) xp += st.xpStepDay;
  return Math.round(xp);
}
const RANKS = [[1, 'Rookie'], [3, 'Bronze'], [5, 'Silver'], [7, 'Gold'], [10, 'Beast Mode'], [15, 'Unstoppable']];
const rankOf = lvl => RANKS.filter(r => lvl >= r[0]).pop()[1];
const nextRank = lvl => RANKS.find(r => r[0] > lvl);
const levelOf = xp => Math.floor(xp / 1000) + 1;

function latestWeight() { const w = [...S.weights].sort(byDate); return w[w.length - 1] || null; }
function nextTemplate() {
  const last = sorted().reverse().find(s => tmpl(s.templateId));
  const days = S.templates.filter(t => t.day).sort((a, b) => a.day - b.day);
  if (!days.length) return S.templates[0] || null;
  if (!last) return days[0];
  const d = tmpl(last.templateId).day;
  return days.find(t => t.day > d) || days[0];
}

/* progression: double progression on the rep range */
function incKg(name, u = unit()) {
  const t = exType(name);
  if (u === 'lb') return 5 / LB;
  return t === 'dumbbell' ? 2 : 2.5;
}
function suggestion(e, last, u = unit()) {
  if (!last) return { kind: 'new', text: `First time. Pick a weight you can move for ${e.repMin} to ${e.repMax} clean reps.` };
  const sets = last.sets, top = Math.max(...sets.map(s => s.w));
  const reps = sets.map(s => s.r).join(' / ');
  if (top <= 0) return { kind: 'hold', w: 0, r: Math.max(...sets.map(s => s.r)) + 1, text: `Last time: ${reps}. Beat it by one rep somewhere.` };
  const allTop = sets.length >= Math.min(e.sets || 3, 3) && sets.every(s => s.r >= e.repMax);
  if (allTop) {
    const nw = top + incKg(e.name, u);
    return { kind: 'up', w: nw, r: e.repMin, text: `Earned it. Go ${dispWU(nw, u)} ${u} for ${e.repMin}+ reps.` };
  }
  const minR = Math.min(...sets.filter(s => s.w === top).map(s => s.r));
  return { kind: 'hold', w: top, r: Math.min(minR + 1, e.repMax), text: `Stay at ${dispWU(top, u)} ${u}. Last: ${reps}. Every set to ${e.repMax}, then add weight.` };
}

/* ---------------- UI helpers ---------------- */
function toast(msg, ms = 2400) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms);
}
let modalClose = null;
function openModal(html, onClose) {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
  m.hidden = false; document.body.classList.add('noscroll');
  modalClose = onClose || null;
}
function closeModal() {
  const m = $('#modal'); m.hidden = true; m.innerHTML = ''; document.body.classList.remove('noscroll');
  const f = modalClose; modalClose = null; if (f) f();
}
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
let askResolve = null;
function settleAsk(v) { const r = askResolve; askResolve = null; if (r) r(v); }
function ask(msg, ok = 'Yes', danger = false) {
  return new Promise(res => {
    settleAsk(false); askResolve = res;
    openModal(`<p class="askmsg">${esc(msg)}</p><div class="row2"><button class="btn" data-act="askNo">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="askOk">${esc(ok)}</button></div>`, () => settleAsk(false));
  });
}
function askText(msg, val) {
  return new Promise(res => {
    settleAsk(null); askResolve = res;
    openModal(`<label class="lbl">${esc(msg)}<input class="field" id="askIn" value="${esc(val)}"></label><div class="row2"><button class="btn" data-act="askNo">Cancel</button><button class="btn primary" data-act="askOk">Save</button></div>`, () => settleAsk(null));
    setTimeout(() => { const i = $('#askIn'); if (i) { i.focus(); i.select(); } }, 60);
  });
}

function svgLine(series, opts = {}) {
  const W = 340, H = opts.h || 170, L = 34, R = 10, T = 12, B = 22;
  const all = series.flatMap(s => s.pts);
  if (!all.length) return `<div class="empty">No data yet</div>`;
  let xs = all.map(p => p.x), ys = all.map(p => p.y);
  if (opts.hline != null) ys.push(opts.hline);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 864e5; x1 += 864e5; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const pd = (y1 - y0) * 0.12 || 1; y0 -= pd; y1 += pd;
  const X = x => L + (x - x0) / (x1 - x0) * (W - L - R), Y = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  let g = '';
  for (let i = 0; i <= 3; i++) {
    const v = y0 + (y1 - y0) * i / 3, y = Y(v);
    g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 5}" y="${y + 3}" class="ax" text-anchor="end">${Math.round(v * 10) / 10}</text>`;
  }
  if (opts.hline != null) g += `<line x1="${L}" x2="${W - R}" y1="${Y(opts.hline)}" y2="${Y(opts.hline)}" class="goal"/><text x="${W - R}" y="${Y(opts.hline) - 4}" class="ax goalt" text-anchor="end">${opts.hlabel || ''}</text>`;
  const d0 = new Date(x0), d1 = new Date(x1);
  g += `<text x="${L}" y="${H - 5}" class="ax">${fmtShort(ymd(d0))}</text><text x="${W - R}" y="${H - 5}" class="ax" text-anchor="end">${fmtShort(ymd(d1))}</text>`;
  for (const s of series) {
    const pts = [...s.pts].sort((a, b) => a.x - b.x);
    if (s.dash) { g += pts.map(p => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3.5" class="ms"/>`).join(''); g += `<polyline points="${pts.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')}" class="dash"/>`; continue; }
    if (pts.length > 1) g += `<polyline points="${pts.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')}" class="ln" style="stroke:${s.color || 'var(--accent)'}"/>`;
    g += pts.map(p => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3" style="fill:${s.color || 'var(--accent)'}"/>`).join('');
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${g}</svg>`;
}
function svgBars(vals, labels, goal) {
  const W = 340, H = 140, L = 6, B = 18, T = 8, n = vals.length, bw = (W - L * 2) / n;
  const mx = Math.max(goal || 0, ...vals.map(v => v || 0)) * 1.1 || 1;
  let g = '';
  vals.forEach((v, i) => {
    const h = (v || 0) / mx * (H - B - T), x = L + i * bw + 3;
    const cls = v == null ? 'none' : v >= goal ? 'hit' : v >= goal * 0.7 ? 'near' : 'miss';
    g += `<rect x="${x}" y="${H - B - h}" width="${bw - 6}" height="${Math.max(h, v == null ? 0 : 2)}" rx="3" class="bar ${cls}"/>`;
    g += `<text x="${x + (bw - 6) / 2}" y="${H - 5}" class="ax" text-anchor="middle">${labels[i]}</text>`;
  });
  if (goal) { const y = H - B - goal / mx * (H - B - T); g += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="goal"/>`; }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${g}</svg>`;
}

/* ---------------- router ---------------- */
const TABS = ['home', 'workout', 'history', 'exercises', 'body'];
let tab = (location.hash || '#home').slice(1); if (!TABS.includes(tab)) tab = 'home';
function go(t) { tab = t; if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t); render(); window.scrollTo(0, 0); }
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (TABS.includes(t) && t !== tab) { tab = t; render(); } });

function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const v = $('#view');
  v.innerHTML = ({ home: viewHome, workout: viewWorkout, history: viewHistory, exercises: viewExercises, body: viewBody })[tab]();
  const pill = $('#resume');
  pill.hidden = !(S.active && tab !== 'workout');
  if (!pill.hidden) pill.innerHTML = `<span class="dot"></span>${esc(S.active.name)} in progress · <b id="pillTime">${elapsed()}</b>`;
}

function ringSVG(frac, color, size = 60, track = '#EEF1EC') {
  const r = 24, C = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return `<svg viewBox="0 0 60 60" style="width:${size}px;height:${size}px;transform:rotate(-90deg);flex:none" aria-hidden="true"><circle cx="30" cy="30" r="${r}" fill="none" stroke="${track}" stroke-width="7"/><circle cx="30" cy="30" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}"/></svg>`;
}

/* ---------------- HOME ---------------- */
const KIND0 = name => { const n = (name || '').toLowerCase(); return n.includes('push') ? 'push' : n.includes('pull') ? 'pull' : n.includes('leg') ? 'legs' : 'other'; };
const PAL = ['push', 'pull', 'legs', 'k3', 'k4', 'k5'];
const isPPL = () => S.templates.length > 0 && S.templates.every(t => KIND0(t.name) !== 'other');
const KIND = s => { if (isPPL()) return KIND0(s.name); const i = S.templates.findIndex(t => t.id === s.templateId); const j = i >= 0 ? i : S.templates.findIndex(t => t.name === s.name); return j >= 0 ? PAL[j % PAL.length] : 'other'; };
const legendHTML = () => isPPL() ? '<span><i class="day push"></i>Push</span><span><i class="day pull"></i>Pull</span><span><i class="day legs"></i>Legs</span>'
  : S.templates.map((t, i) => `<span><i class="day ${PAL[i % PAL.length]}"></i>${esc(t.name)}</span>`).join('');
const DLABEL = s => { const t = tmpl(s.templateId); return t && t.day ? 'D' + t.day : '+'; };
function sessionsByDay() { const m = {}; for (const s of sorted()) (m[s.date] = m[s.date] || []).push(s); return m; }

/* the Motu figure: a solid body that fades lighter as weight comes off, with the goal body showing through */
function hexMix(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function journey() {
  const w = [...S.weights].sort(byDate), first = w[0], last = w[w.length - 1], goal = S.settings.goalWeight;
  if (!first) return { p: 0, lost: 0, first: null, last: null };
  const span = first.kg - goal, lost = first.kg - last.kg;
  return { p: span > 0 ? Math.max(0, Math.min(1, lost / span)) : 0, lost, first, last };
}
/* one body that morphs from heavier (t=0) to fit (t=1); left half is drawn, right half mirrored */
const BODY = [
  ['M', [90, 62], [92, 62], [93, 62]],
  ['L', [89, 70], [92, 70], [93, 70]],
  ['C', [80, 72, 64, 74, 56, 82], [84, 72, 74, 74, 68, 79], [86, 72, 79, 74, 74, 80]],
  ['C', [48, 88, 44, 96, 44, 104], [60, 84, 58, 92, 59, 100], [67, 84, 65, 92, 66, 100]],
  ['L', [36, 138], [61, 136], [65, 134]],
  ['Q', [36, 147, 42, 147], [62, 144, 67, 144], [65, 141, 69, 141]],
  ['Q', [49, 147, 50, 139], [71, 144, 71, 137], [72, 141, 72, 134]],
  ['L', [58, 114], [72, 106], [73, 106]],
  ['Q', [59, 109, 63, 112], [73, 101, 76, 104], [74, 101, 77, 104]],
  ['C', [53, 122, 52, 146, 64, 153], [79, 116, 81, 124, 82, 130], [80, 114, 84, 121, 84, 127]],
  ['C', [68, 158, 72, 160, 75, 163], [81, 138, 82, 144, 84, 150], [78, 135, 75, 146, 79, 156]],
  ['L', [79, 177], [86, 175], [87, 176]],
  ['Q', [79, 181, 84, 181], [86, 179, 90, 179], [87, 180, 91, 180]],
  ['L', [95, 181], [95, 179], [95, 180]],
  ['Q', [99, 181, 99, 177], [98, 179, 98, 175], [98, 180, 98, 176]],
  ['L', [99, 166], [99, 152], [99, 157]],
  ['L', [100, 164], [100, 148], [100, 153]]
];
// women: [start (soft, straight waist), goal (snatched waist, fuller hips and glutes)]
const FEM = [
  ['M', [92, 62], [93, 62]],
  ['L', [91, 70], [93, 70]],
  ['C', [84, 72, 75, 74, 70, 80], [86, 72, 80, 73, 76, 79]],
  ['C', [63, 85, 61, 93, 62, 101], [69, 83, 68, 91, 68, 99]],
  ['L', [61, 133], [63, 131]],
  ['Q', [60, 141, 64, 141], [61, 138, 65, 138]],
  ['Q', [69, 141, 69, 134], [68, 138, 68, 131]],
  ['L', [70, 107], [72, 106]],
  ['Q', [71, 102, 74, 104], [74, 101, 77, 104]],
  ['C', [76, 112, 78, 120, 78, 127], [78, 112, 84, 116, 84, 125]],
  ['C', [78, 134, 77, 146, 78, 152], [84, 132, 72, 136, 72, 148]],
  ['C', [79, 160, 84, 168, 86, 176], [72, 159, 82, 167, 85, 176]],
  ['Q', [86, 180, 90, 180], [85, 180, 89, 180]],
  ['L', [95, 180], [95, 180]],
  ['Q', [98, 180, 98, 176], [98, 180, 98, 176]],
  ['L', [99, 156], [97, 157]],
  ['L', [100, 153], [100, 152]]
];
function bodyPath(t, female) {
  const segs = female ? FEM.map(([c, a, b]) => [c, a.map((v, i) => v + (b[i] - v) * t)]) : BODY.map(([c, h, f]) => [c, h.map((v, i) => v + (f[i] - v) * t)]);
  const n = v => Math.round(v * 10) / 10, end = s => s[1].slice(-2), mx = x => 200 - x;
  let d = segs.map(([c, p]) => c + p.map(n).join(' ')).join(' ');
  for (let i = segs.length - 1; i >= 1; i--) {
    const [c, p] = segs[i], prev = end(segs[i - 1]);
    let ctrl = [];
    if (c === 'C') ctrl = [p[2], p[3], p[0], p[1]];
    if (c === 'Q') ctrl = [p[0], p[1]];
    const pts = ctrl.concat(prev);
    d += ' ' + c + pts.map((v, k) => n(k % 2 === 0 ? mx(v) : v)).join(' ');
  }
  return d + 'Z';
}
const FIT_BODY = bodyPath(1);
const isFemale = () => !!(S.profile && S.profile.gender === 'woman');
function figureSVG(p, size = 112, label = '') {
  const now = hexMix('#E2531B', '#FFC9B0', p), fem = isFemale(), FIT = fem ? bodyPath(1, true) : FIT_BODY;
  const aria = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"';
  return `<svg class="fig" viewBox="0 0 200 200" width="${size}" height="${size}" style="width:${size}px;height:${size}px" ${aria}>
    <path d="${bodyPath(p, fem)}" fill="${now}" stroke="none"/>
    <path d="${FIT}" fill="#E2531B" fill-opacity="${p.toFixed(3)}" stroke="#FFFFFF" stroke-opacity="${((1 - p) * 0.85).toFixed(3)}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="100" cy="44" r="20" fill="#E2531B" stroke="none"/>
  </svg>`;
}
function strengthMode() {
  if (!S.profile || (S.profile.goals || []).includes('lose')) return false;
  const lw = latestWeight();
  return !(lw && S.settings.goalWeight && S.settings.goalWeight < lw.kg - 0.5);
}
function strengthWins() {
  const wins = [];
  for (const n of allExerciseNames()) {
    const hist = exHistory(n).filter(x => x.sets.some(s => s.w > 0)); if (hist.length < 2) continue;
    const top = x => Math.max(...x.sets.map(s => s.w));
    const firstTop = top(hist[0]), best = Math.max(...hist.map(top));
    if (best - firstTop > 0.5) wins.push([n, best - firstTop]);
  }
  return wins.sort((x, y) => y[1] - x[1]);
}
function strengthCard() {
  const total = S.sessions.length, mon = today().slice(0, 7), month = S.sessions.filter(s => s.date.startsWith(mon)).length, wins = strengthWins();
  return `<div class="card journey" data-act="tab" data-t="body"><div class="jrow">${figureSVG(1, 112, 'Your strong figure')}
    <div class="jtxt"><div class="jbig">${total} workout${total === 1 ? '' : 's'}</div>
      <div class="muted jsub">${total === 0 ? 'Your first workout starts the streak. Strength wins show up here.' : `${month} this month.${wins.length ? ' Getting stronger:' : ' Repeat an exercise and your strength wins show up here.'}`}</div>
      ${wins.slice(0, 2).map(([n, g]) => `<div class="swin"><b>+${dispR(g)} ${unit()}</b> ${esc(n)}</div>`).join('')}</div></div></div>`;
}
function weightCompare(kg) {
  const list = [[20, 'a full 20 kg airport suitcase'], [10, 'a 10 kg bag of rice'], [5, 'a 5 kg bag of rice'], [3, 'a big watermelon'], [1, 'a 1 kg bag of sugar']];
  const hit = list.find(x => kg >= x[0]);
  return hit ? `About ${hit[1]} you don't carry anymore.` : 'Every kilo starts with the first workout.';
}

function coachLine(ws) {
  const st = S.settings, W = ws.weeks[ws.cur - 1], c = W ? W.count : 0;
  const last = sorted().pop(); const gap = last ? daysBetween(last.date, today()) : null;
  const tough = st.voice === 'tough';
  if (S.active) return tough ? `You started ${esc(S.active.name)}. Finish what you started.` : `Your ${esc(S.active.name)} is still open. Pick up where you left off.`;
  if (gap != null && gap >= 5) return tough ? `${gap} days since your last session. Nobody cares why. Walk in today and the comeback bonus is yours.` : `It's been ${gap} days. That's okay. Your next workout earns the comeback bonus.`;
  if (c >= st.weeklyTarget) return tough ? `${c} for ${st.weeklyTarget}. Good. Now do it again next week.` : `${c} workouts this week. That's a perfect week. Rest is part of the plan too.`;
  if (c >= st.streakThreshold) return tough ? `Win week locked. Anything extra is you getting ahead.` : `That's a win week already. Anything extra is a bonus.`;
  if (c === 0) return tough ? `Week ${ws.cur} is open and the board says zero. Fix that.` : `New week, clean page. One workout gets you moving.`;
  const left = st.streakThreshold - c;
  return tough ? `${left} more for a win week. No negotiating with yourself.` : `${left} more makes this a win week. You've got this.`;
}

function viewHome() {
  const st = S.settings, ws = weekStats(), xp = xpTotal(), lvl = levelOf(xp), into = xp % 1000;
  const W = ws.weeks[ws.cur - 1], c = W ? W.count : 0, nt = nextTemplate();
  const J = journey(), td = today(), byDay = sessionsByDay();
  const tSteps = S.steps[td];
  const total = S.sessions.length, consistency = Math.round(total / (st.weeklyTarget * ws.cur) * 100);
  const backupDays = st.lastBackup ? daysBetween(st.lastBackup, td) : null;
  const nm = (st.name || '').trim();

  let h = `<div class="hello">
    <div><div class="brandrow">${figureSVG(1, 20)}<b>motu</b><span>· ${fmtDate(td)}</span></div><h1>${nm ? 'Hey ' + esc(nm) : 'Hey there'}</h1></div>
    <button class="avatar" data-act="settings" aria-label="Settings">${nm ? esc(nm[0].toUpperCase()) : ICON.gear}</button>
  </div>
  <p class="coach">${coachLine(ws)}</p>`;

  if (backupDays == null || backupDays >= 7) h += `<button class="notice" data-act="export">${backupDays == null ? 'No backup yet.' : `Last backup ${backupDays} days ago.`} Your workouts live only on this phone. Tap to save a backup to Files.</button>`;

  if (!S.profile && !S.fresh && S.sessions.length < 10 && !st.setupNudgeOff) h += `<div class="card setupnudge"><b>Make Motu yours</b><p class="muted">A few quick questions and you get a plan built for your goals.</p><div class="row2"><button class="btn" data-act="nudgeOff">Not now</button><button class="btn primary" data-act="setupRedo">Set up my plan</button></div></div>`;
  // journey
  if (strengthMode()) h += strengthCard();
  else if (J.first) {
    const nextM = st.milestones.find(m => m[1] < J.last.kg);
    const since = daysBetween(J.last.date, td);
    h += `<div class="card journey" data-act="tab" data-t="body">
      <div class="jrow">${figureSVG(J.p, 112, `About ${Math.round(J.p * 100)}% of the way to your goal body`)}
        <div class="jtxt"><div class="jbig">${J.lost > 0 ? trim(Math.round(J.lost * 10) / 10) + ' kg down' : trim(J.last.kg) + ' kg'}</div>
          <div class="muted jsub">${J.lost > 0 ? weightCompare(J.lost) : 'Your starting point. The goal body is already in there.'}</div>
          <div class="bar"><span style="width:${(J.p * 100).toFixed(1)}%"></span></div>
          <div class="jlabels"><span>${trim(J.first.kg)}</span><span>${nextM ? 'Next: ' + nextM[1] : ''}</span><span>${st.goalWeight} kg</span></div></div></div>
      ${since > 7 ? `<div class="nudge"><span>Last weigh-in was ${since} days ago. Step on the scale tomorrow morning.</span><span class="nbtn">Log</span></div>` : ''}
    </div>`;
  } else {
    h += `<div class="card journey" data-act="tab" data-t="body"><div class="jrow">${figureSVG(0, 112)}<div class="jtxt"><div class="jbig">Start here</div><div class="muted jsub">Log your starting weight and watch the goal body come through.</div><span class="nbtn">Log weight</span></div></div></div>`;
  }

  // this week
  const win = c >= st.streakThreshold;
  h += `<div class="card"><div class="card-h"><h3>This week</h3><span class="wk-status ${win ? 'won' : ''}">${win ? 'Win week' : `${c} of ${st.streakThreshold} for a win`}</span></div>
    <div class="wk">${[0, 1, 2, 3, 4, 5, 6].map(i => {
      const d = addDays(W.start, i), ss = byDay[d] || [], dn = 'MTWTFSS'[i];
      let chip;
      if (ss.length) chip = `<span class="wchip ${KIND(ss[0])}" title="${esc(ss.map(x => x.name).join(', '))}">${DLABEL(ss[0])}</span>`;
      else if (d === td) chip = `<span class="wchip todaychip">${nt && !S.active ? 'D' + (nt.day || '') : ''}</span>`;
      else chip = `<span class="wchip ${d > td ? 'future' : 'rest'}"></span>`;
      return `<div class="wcol"><span class="wday ${d === td ? 'now' : ''}">${dn}</span>${chip}</div>`;
    }).join('')}</div>
    <div class="legend">${legendHTML()}</div>
    <div class="muted sm">You don't need every day. ${st.streakThreshold} workouts makes it a win week.</div>
  </div>`;

  // today
  if (S.active) h += `<div class="todaycard"><div class="eyebrow">In progress</div><div class="tname">${esc(S.active.name)}</div><div class="tsub">${elapsed()} so far</div><button class="btn primary big" data-act="tab" data-t="workout">Resume workout</button></div>`;
  else if (nt) h += `<div class="todaycard"><div class="eyebrow">Today</div><div class="tname">${esc(nt.name)}</div><div class="tsub">${esc(nt.focus || '')}</div>
    <button class="btn primary big" data-act="start" data-id="${nt.id}">Start workout</button>
    <button class="quick" data-act="startQuick" data-id="${nt.id}">Short on time? Do the 30 min version</button></div>`;

  // steps
  const stp = tSteps ?? 0;
  h += `<div class="card basics">
    <button class="brow" data-act="editSteps">
      <span class="bring">${ringSVG(stp / st.stepGoal, 'var(--green)')}<span>${Math.round(Math.min(stp / st.stepGoal, 9.99) * 100)}%</span></span>
      <span class="bmain"><span class="btop"><b>${stp.toLocaleString()}</b> <span class="muted">of ${st.stepGoal.toLocaleString()} steps</span></span>
        <span class="muted sm">${tSteps == null ? 'Tap to log today\'s steps.' : stp >= st.stepGoal ? 'Goal hit. +' + st.xpStepDay + ' XP' : (st.stepGoal - stp).toLocaleString() + ' to go. A 20 minute walk is about 2,000.'}</span></span>
      <span class="badd">${ICON.edit}</span>
    </button>
  </div>`;

  // stats
  h += `<div class="grid3">
    <div class="stat"><b>${ws.streak} wk${ws.streak === 1 ? '' : 's'}</b><span>showing up</span></div>
    <div class="stat"><b>${total}</b><span>workouts</span></div>
    <div class="stat"><b>Lvl ${lvl}</b><span>${rankOf(lvl)}</span><div class="bar mini"><span style="width:${into / 10}%"></span></div></div>
  </div>`;

  // calendar
  const shown = ws.weeks.slice(-12).reverse();
  h += `<div class="card"><div class="card-h"><h3>Training calendar</h3><span class="muted sm">${consistency}% of target</span></div>
    <div class="cal"><div class="crow head"><span>Wk</span>${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span>${d}</span>`).join('')}<span>#</span></div>
    ${shown.map(Wk => `<div class="crow"><span>${Wk.no}</span>${[0, 1, 2, 3, 4, 5, 6].map(i => {
      const d = addDays(Wk.start, i), ss = byDay[d] || [];
      if (ss.length) { const s = ss[0]; return `<i class="day ${KIND(s)}${d === td ? ' today' : ''}" title="${fmtDate(d)} · ${esc(ss.map(x => x.name).join(', '))}">${DLABEL(s)}${ss.length > 1 ? '<sup>+</sup>' : ''}</i>`; }
      return `<i class="day ${d > td ? 'future' : 'rest'}${d === td ? ' today' : ''}" title="${fmtDate(d)}"></i>`;
    }).join('')}<span class="n ${Wk.cls}" title="${Wk.status}">${Wk.count}</span></div>`).join('')}
    </div>
    <div class="legend">${legendHTML()}<span class="muted">${st.streakThreshold}+ a week keeps the streak</span></div>
  </div>`;
  return h;
}

/* first open on a new device: a short setup */
/* first open on a new device: a short setup that builds a plan */
const OB_STEPS = ['name', 'gender', 'goals', 'honest', 'where', 'days', 'time', 'body', 'plan'];
const OB_GOALS = [['lose', 'Lose fat'], ['tone', 'Tone up'], ['glutes', 'Bigger, stronger glutes'], ['waist', 'Flatter stomach, smaller waist'], ['strong', 'Get stronger'], ['muscle', 'Build muscle']];
const OB_FREQ = [['never', 'Not at all right now'], ['month', 'A few times a month'], ['week12', '1 to 2 times a week'], ['week3', '3 or more times a week']];
let OB = null;
function obInit() { OB = { step: 0, planKey: null, d: { name: '', gender: '', goals: [], freq: '', last7: 0, where: '', days: 0, minutes: 45, unit: 'kg', hUnit: 'ft', hFt: '', hIn: '', hCm: '', now: '', goal: '' } }; }
function obSuggestDays(d) {
  if (pendingGift) return pendingGift.plan.days.length;
  if (d.last7 <= 1) return 3;
  if (d.last7 <= 3) return Math.min(d.last7 + 1, 4);
  return Math.min(d.last7, 6);
}
function obPlanKey(d) {
  if (OB.planKey) return OB.planKey;
  const g = d.goals, days = d.days || 3;
  if (g.includes('glutes') || (d.gender === 'woman' && (g.includes('tone') || g.includes('waist')))) return days <= 3 ? 'glute3' : 'glute4';
  if (days >= 5) return 'ppl6';
  if (days === 4) return 'ul4';
  return 'full3';
}
function obPlan(d) {
  if (pendingGift && !OB.planKey) return pendingGift.plan;
  const pr = PROGRAMS[obPlanKey(d)], max = d.minutes <= 30 ? 4 : d.minutes <= 45 ? 5 : 6;
  return { name: pr.name, days: pr.days.map(x => ({ ...cloneDay(x), ex: cloneDay(x).ex.slice(0, max) })) };
}
function onboard() {
  if (!S.fresh && !(OB && OB.redo)) return;
  if (!OB) obInit();
  const el = $('#onboard'); if (!el) return;
  const d = OB.d, step = OB_STEPS[OB.step], g = pendingGift;
  const opt = (k, v, l, on) => `<button class="obopt ${on ? 'on' : ''}" data-act="obPick" data-k="${k}" data-v="${v}">${l}</button>`;
  let body = '';
  if (step === 'name') body = `
    ${g ? `<div class="giftcard"><b>${g.from ? esc(g.from) + ' made a plan for you' : 'Someone made a plan for you'}</b>${g.note ? `<span>${esc(g.note)}</span>` : ''}<span class="muted sm">${esc(g.plan.name)} · ${g.plan.days.length} days</span></div>` : ''}
    <h1>${OB.redo ? "Let's build your plan" : g ? "Let's set you up" : 'Welcome to motu'}</h1><p class="obsub">Every motu has a comeback. A few quick questions and your plan is ready.</p>
    <label class="lbl">What should we call you?<input class="field" id="obName" data-in="ob" data-k="name" value="${esc(d.name)}" autocomplete="given-name" enterkeyhint="next"></label>`;
  if (step === 'gender') body = `<h1>Who's training?</h1><p class="obsub">This sets the starting mix of exercises.</p>
    <div class="obopts">${opt('gender', 'woman', 'Woman', d.gender === 'woman')}${opt('gender', 'man', 'Man', d.gender === 'man')}${opt('gender', 'other', 'Prefer not to say', d.gender === 'other')}</div>`;
  if (step === 'goals') body = `<h1>What do you want from this?</h1><p class="obsub">Pick as many as you like.</p>
    <div class="obopts">${OB_GOALS.map(([k, l]) => `<button class="obopt ${d.goals.includes(k) ? 'on' : ''}" data-act="obGoal" data-v="${k}">${l}</button>`).join('')}</div>
    ${d.goals.includes('waist') ? '<p class="obnote">Good to know: you can\'t burn fat from one spot. A smaller waist comes from stronger glutes and back, core work and showing up. Your plan is built around that.</p>' : ''}`;
  if (step === 'honest') body = `<h1>Be honest</h1><p class="obsub">No judgment. This just sets your starting point.</p>
    <div class="lbl">How often do you work out right now?</div>
    <div class="obopts">${OB_FREQ.map(([k, l]) => `<button class="obopt ${d.freq === k ? 'on' : ''}" data-act="obFreq" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="lbl">Gym visits in the last 7 days</div>
    <div class="obstep"><button data-act="obLast" data-m="-1" aria-label="Fewer">−</button><b>${d.last7}</b><button data-act="obLast" data-m="1" aria-label="More">+</button></div>`;
  if (step === 'where') body = `<h1>Where will you train?</h1><p class="obsub">You can switch any workout between gym and home later.</p>
    <div class="obopts">${opt('where', 'gym', 'At the gym', d.where === 'gym')}${opt('where', 'home', 'At home', d.where === 'home')}${opt('where', 'both', 'Both', d.where === 'both')}</div>`;
  if (step === 'days') {
    const sug = obSuggestDays(d);
    body = `<h1>How many days a week can you really commit to?</h1>
    <p class="obsub">${g ? `${esc(g.from || 'Your')} plan has ${sug} days.` : d.last7 <= 1 ? "Start with 3. Showing up beats a perfect plan." : `We suggest ${sug}. You can always add more.`}</p>
    <div class="obopts row">${[2, 3, 4, 5, 6].map(n => `<button class="obopt ${(d.days || sug) === n ? 'on' : ''}" data-act="obDays" data-v="${n}">${n}${n === sug ? '<small>suggested</small>' : ''}</button>`).join('')}</div>
    <p class="obnote">Hitting your number in a week counts as a win week. Missing a day never resets anything.</p>`;
  }
  if (step === 'time') body = `<h1>How long per workout?</h1><p class="obsub">Including warm-up and rest.</p>
    <div class="obopts row">${[30, 45, 60].map(n => `<button class="obopt ${d.minutes === n ? 'on' : ''}" data-act="obMin" data-v="${n}">${n} min</button>`).join('')}</div>`;
  if (step === 'body') body = `<h1>Your starting point</h1><p class="obsub">Only you see this.</p>
    <div class="seg">${['kg', 'lb'].map(u => `<button class="${d.unit === u ? 'on' : ''}" data-act="obUnitB" data-v="${u}">${u}</button>`).join('')}</div>
    <div class="row2"><label>Weight now (${d.unit})<input class="field" data-in="ob" data-k="now" inputmode="decimal" value="${esc(d.now)}"></label>
    <label>Goal weight (${d.unit})<input class="field" data-in="ob" data-k="goal" inputmode="decimal" value="${esc(d.goal)}" placeholder="optional"></label></div>
    <p class="muted sm">${d.goals.includes('lose') ? 'Your goal weight drives the body figure on your home screen.' : 'Leave the goal blank if you want to stay about the same weight and get stronger.'}</p>
    <div class="lbl">Height <span class="hseg">${['ft', 'cm'].map(u => `<button class="${d.hUnit === u ? 'on' : ''}" data-act="obHUnit" data-v="${u}">${u}</button>`).join('')}</span></div>
    ${d.hUnit === 'ft' ? `<div class="row2"><label>Feet<input class="field" data-in="ob" data-k="hFt" inputmode="numeric" value="${esc(d.hFt)}"></label><label>Inches<input class="field" data-in="ob" data-k="hIn" inputmode="numeric" value="${esc(d.hIn)}"></label></div>`
      : `<label class="lbl">Centimetres<input class="field" data-in="ob" data-k="hCm" inputmode="numeric" value="${esc(d.hCm)}"></label>`}`;
  if (step === 'plan') {
    const plan = obPlan(d);
    body = `<h1>${g && !OB.planKey ? esc(g.from || 'Your') + "'s plan for you" : 'Your plan'}</h1>
    <p class="obsub">${esc(plan.name)} · ${plan.days.length} workouts in rotation · ${d.days} a week makes a win week</p>
    <div class="obplan">${planPreview(plan)}</div>
    <div class="lbl">Want a different plan?</div>
    <div class="fchips">${g ? `<button class="fchip ${!OB.planKey ? 'on' : ''}" data-act="obPlanKey" data-v="">${esc(g.from || 'Gift')} plan</button>` : ''}${Object.entries(PROGRAMS).map(([k, pr]) => `<button class="fchip ${obPlanKey(d) === k && (OB.planKey || !g) ? 'on' : ''}" data-act="obPlanKey" data-v="${k}">${esc(pr.name)}</button>`).join('')}</div>
    <p class="muted sm">You can edit every exercise later under Train.</p>`;
  }
  const last = OB.step === OB_STEPS.length - 1;
  el.innerHTML = `<div class="ob">
    <div class="obtop">${OB.step > 0 ? `<button class="link" data-act="obBack">Back</button>` : '<span></span>'}<div class="obdots">${OB_STEPS.map((_, i) => `<i class="${i <= OB.step ? 'on' : ''}"></i>`).join('')}</div><span></span></div>
    ${OB.step === 0 ? `<div class="obfig">${figureSVG(0, 120)}</div>` : ''}
    ${body}
    <button class="btn primary big" data-act="${last ? 'obFinish' : 'obNext'}">${last ? 'Start my plan' : 'Next'}</button>
    ${OB.step === 0 ? (OB.redo ? '<button class="quick dark" data-act="obCancel">Not now</button>' : '<button class="quick dark" data-act="obSignIn">I already have an account</button>') : ''}
  </div>`;
  el.hidden = false; document.body.classList.add('noscroll');
  el.scrollTop = 0;
}
function closeOnboard() { const el = $('#onboard'); if (el) { el.hidden = true; el.innerHTML = ''; } document.body.classList.remove('noscroll'); }

/* welcome back: shown once after a gap of 5+ days */
function maybeComeback() {
  const last = sorted().pop(); if (!last || S.active) return;
  const gap = daysBetween(last.date, today());
  if (gap < 5 || S.settings.comebackSeen === last.id) return;
  const J = journey(), nt = nextTemplate(), nm = (S.settings.name || '').trim();
  const el = $('#comeback');
  el.innerHTML = `<div class="cb">
    <div class="cbfig">${figureSVG(J.p, 168, 'Your Motu figure')}</div>
    <h1>Welcome back${nm ? ', ' + esc(nm) : ''}.</h1>
    <p>You were away ${gap} days. Your ${S.sessions.length} workouts${J.lost > 0 ? ` and the ${trim(Math.round(J.lost * 10) / 10)} kg you lost` : ''} didn't go anywhere.</p>
    <div class="cbcard">
      <div><span class="ok">${ICON.check}</span><span><b>Your streak counts weeks, not days.</b> One workout this week keeps you moving.</span></div>
      <div><span class="star">${ICON.trophy}</span><span><b>Comeback bonus: +${S.settings.xpComeback} XP.</b> Coming back is the hardest rep of all.</span></div>
    </div>
    <div class="cbbtns">
      ${nt ? `<button class="btn primary big" data-act="cbQuick" data-id="${nt.id}">Ease back in · 30 min</button><button class="btn big2" data-act="cbFull" data-id="${nt.id}">Do the full ${esc(nt.name)}</button>` : ''}
      <button class="quick dark" data-act="cbLater">Not right now</button>
      <div class="cbtag">Every motu has a comeback.</div>
    </div></div>`;
  el.hidden = false; document.body.classList.add('noscroll');
}
function closeComeback() {
  const last = sorted().pop(); if (last) { S.settings.comebackSeen = last.id; save(); }
  $('#comeback').hidden = true; $('#comeback').innerHTML = ''; document.body.classList.remove('noscroll');
}

/* launch: the body shrinks all the way to the goal body, then settles back to where you are now */
function splash() {
  const el = $('#splash'); if (!el) return;
  let reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }
  const J = journey(), target = J.p, pct = Math.round(target * 100), strong = strengthMode();
  const fig = el.querySelector('.splfig'), line = el.querySelector('.splt');
  let done = false;
  const finish = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => { el.remove(); maybeComeback(); }, 380); };
  el.addEventListener('click', finish);
  const nm = (S.settings.name || '').trim(), fem = isFemale(), cutu = /^fabiha/i.test(nm);
  const strongLine = `Strong looks good on you${nm ? ', ' + nm : ''}.`;
  if (reduce || (strong && !fem)) {
    fig.innerHTML = figureSVG(strong ? 1 : target, 150);
    const msg = cutu ? 'Our app is motu, but you are a cutu.' : strong ? strongLine : '';
    if (msg) setTimeout(() => { line.style.opacity = 0; setTimeout(() => { line.textContent = msg; line.style.opacity = 1; }, 160); }, 500);
    setTimeout(finish, msg ? 2000 : 600); return;
  }
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const tween = (from, to, dur) => new Promise(res => {
    const t0 = performance.now();
    const step = now => {
      if (done) return res();
      const k = Math.min(1, (now - t0) / dur);
      fig.innerHTML = figureSVG(from + (to - from) * ease(k), 150);
      k < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const say = t => { line.style.opacity = 0; setTimeout(() => { line.textContent = t; line.style.opacity = 1; }, 160); };
  fig.innerHTML = figureSVG(0, 150);
  (async () => {
    await wait(250);
    if (cutu) { say('Our app is motu, but you are a cutu.'); await wait(1700); }
    say(fem ? 'Your goal body is already in there.' : 'The fit you is already in there.');
    await tween(0, 1, 1500);
    await wait(500);
    if (strong) { say(strongLine); await wait(1200); finish(); return; }
    say(J.first ? (target > 0 ? `You're ${pct}% of the way there.` : "Day one. Let's go.") : 'Every motu has a comeback.');
    await tween(1, target, 800);
    await wait(900);
    finish();
  })();
}

/* ---------------- WORKOUT ---------------- */
function viewWorkout() {
  if (S.active) return viewActive();
  const nt = nextTemplate(), ws = weekStats(), W = ws.weeks[ws.cur - 1];
  let h = `<div class="page-h"><h2>Workout</h2></div>`;
  const rot = S.templates.filter(t => t.day).sort((x, y) => x.day - y.day);
  h += `<div class="card plancard"><div class="card-h"><h3>${esc(S.planName || 'Your plan')}</h3><span class="muted sm">${rot.length} day rotation</span></div>
    <div class="muted sm">${rot.map(t => esc(t.name)).join(' · ')}</div>
    <button class="btn wide" data-act="pbOpen">Build, change or gift a plan</button></div>`;
  if (nt) h += `<div class="card next"><div class="eyebrow">Up next in the rotation</div><h3>${esc(nt.name)}</h3><div class="muted">${esc(nt.focus || '')}</div>
    <button class="btn primary wide" data-act="start" data-id="${nt.id}">Start workout</button></div>`;
  h += `<div class="sect">Templates</div>`;
  for (const t of [...S.templates].sort((a, b) => (a.day || 99) - (b.day || 99))) {
    const last = sorted().reverse().find(s => s.templateId === t.id);
    const doneWk = W && t.day && W.days.has(t.day);
    h += `<div class="card tpl">
      <div class="card-h"><h3>${esc(t.name)} ${doneWk ? '<span class="tag ok">done this week</span>' : ''}</h3><button class="link" data-act="editTpl" data-id="${t.id}">Edit</button></div>
      <div class="muted sm">${esc(t.focus || '')}${last ? ` · last ${fmtShort(last.date)}` : ''}</div>
      <ul class="tplx">${t.exercises.map(e => `<li>${e.sets} × ${esc(e.name)}${e.optional ? ' <span class="muted">(optional)</span>' : ''}</li>`).join('')}</ul>
      <button class="btn wide" data-act="start" data-id="${t.id}">Start</button>
    </div>`;
  }
  h += `<div class="row2"><button class="btn ghost" data-act="start" data-id="">Empty workout</button><button class="btn ghost" data-act="newTpl">New template</button></div>`;
  return h;
}

function startWorkout(id, fromSession, quick) {
  if (S.active) { toast('Finish or cancel the current workout first'); go('workout'); return; }
  const t = id ? tmpl(id) : null;
  let exercises;
  if (fromSession) exercises = fromSession.exercises.map(e => { const te = findTplEx(e.name); return mkEx({ ...(te || defEx(e.name)), sets: e.sets.length }); });
  else if (t && quick) exercises = t.exercises.filter(e => !e.optional).slice(0, 4).map(e => mkEx({ ...e, sets: 2 }));
  else exercises = t ? t.exercises.map(mkEx) : [];
  S.active = {
    id: uid(), editId: null, templateId: t ? t.id : (fromSession ? fromSession.templateId : null),
    name: t ? t.name + (quick ? ' · 30 min' : '') : (fromSession ? fromSession.name : 'Workout'), date: today(), startTs: Date.now(),
    exercises, stair: { min: '', level: '', kcal: '' }, note: '', mode: S.settings.defaultMode || 'gym'
  };
  if (S.active.mode === 'home') for (const x of S.active.exercises) if (x.home) x.name = x.home;
  save(); go('workout'); wake();
}
function defEx(name) { return { name, sets: 3, repMin: 8, repMax: 12, rest: 90, optional: false, note: '' }; }
function findTplEx(name) { for (const t of S.templates) { const e = t.exercises.find(x => x.name === name); if (e) return e; } return null; }
function swapEx(e, toHome) {
  if (!e.home) return 'none';
  const target = toHome ? e.home : e.gym;
  if (e.name === target) return 'same';
  if (e.sets.some(s => s.done)) return 'done';
  e.name = target; e.sets = e.sets.map(() => ({ w: '', r: '', done: false }));
  return 'ok';
}
function mkEx(e) {
  const gym = (window.gymOf && gymOf(e.name)) || e.name, home = (window.homeOf && homeOf(gym)) || null;
  return { name: e.name, gym, home: home && home !== gym ? home : null, repMin: e.repMin, repMax: e.repMax, rest: e.rest, optional: !!e.optional, tnote: e.note || '', note: '', planned: e.sets,
    sets: Array.from({ length: e.sets || 3 }, () => ({ w: '', r: '', done: false })) };
}

function elapsed() {
  if (!S.active) return '0:00';
  const s = Math.max(0, Math.floor((Date.now() - S.active.startTs) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
}

function viewActive() {
  const a = S.active;
  let h = `<div class="aw-head">
    <div class="aw-title"><input class="aw-name" data-in="aname" value="${esc(a.name)}" aria-label="Workout name">
      <div class="aw-meta"><span class="clock">${ICON.clock}<b id="elapsed">${a.editId ? 'editing' : elapsed()}</b></span><input type="date" class="datein" data-in="adate" value="${a.date}"></div>
      <div class="segrow"><div class="useg" role="group" aria-label="Gym or home for this workout">${[['gym', 'Gym'], ['home', 'Home']].map(([x, l]) => `<button class="${(a.mode || 'gym') === x ? 'on' : ''}" data-act="woPlace" data-p="${x}">${l}</button>`).join('')}</div>
      <div class="useg" role="group" aria-label="Weight unit for this workout">${['kg', 'lb'].map(x => `<button class="${S.settings.unit === x && a.exercises.every(e => exUnit(e.name) === x) ? 'on' : ''}" data-act="woUnit" data-u="${x}">${x}</button>`).join('')}</div></div></div>
    <button class="btn green" data-act="finish">${a.editId ? 'Save' : 'Finish'}</button>
  </div>`;
  a.exercises.forEach((e, i) => { h += exCard(e, i); });
  h += `<button class="btn ghost wide" data-act="addEx">+ Add exercise</button>`;
  const st = a.stair;
  h += `<div class="card"><div class="card-h"><h3>Stairmaster finisher</h3><span class="muted sm">+${S.settings.xpStairMin} XP/min</span></div>
    <div class="row3"><label>Minutes<input class="field" inputmode="decimal" data-in="stair" data-k="min" value="${esc(st.min)}"></label>
    <label>Level<input class="field" inputmode="decimal" data-in="stair" data-k="level" value="${esc(st.level)}"></label>
    <label>Calories<input class="field" inputmode="numeric" data-in="stair" data-k="kcal" value="${esc(st.kcal)}"></label></div></div>`;
  h += `<div class="card"><h3>Session note</h3><textarea class="field" rows="2" data-in="anote" placeholder="How did it feel? Sleep, food, anything worth remembering">${esc(a.note)}</textarea></div>`;
  h += `<button class="btn danger-text wide" data-act="cancelWorkout">${a.editId ? 'Discard changes' : 'Cancel workout'}</button>`;
  return h;
}

function exCard(e, i) {
  const a = S.active, last = lastPerf(e.name, a.editId), u = exUnit(e.name), sug = suggestion(e, last, u);
  const prior = bestE1(e.name, a.editId), type = exType(e.name);
  let running = prior;
  const rows = e.sets.map((s, j) => {
    const p = last ? last.sets[j] : null;
    let phW, phR;
    if (sug.kind === 'up') { phW = dispWU(sug.w, u); phR = sug.r; }
    else if (p) { phW = dispWU(p.w, u); phR = p.r; }
    else if (last) { const l = last.sets[last.sets.length - 1]; phW = dispWU(l.w, u); phR = l.r; }
    else { phW = ''; phR = e.repMin || ''; }
    let pr = false;
    if (s.done) { const v = e1rm(+s.w || 0, +s.r || 0); if (prior > 0 && v > running) { pr = true; running = v; } }
    return `<div class="set ${s.done ? 'done' : ''}">
      <span class="sn">${j + 1}</span>
      <button class="prev" data-act="copyPrev" data-i="${i}" data-j="${j}">${p ? (p.w > 0 ? dispWU(p.w, u) + ' ' + u : 'BW') + ' × ' + p.r : '-'}</button>
      <input class="in" inputmode="decimal" data-in="w" data-u="${u}" data-i="${i}" data-j="${j}" value="${s.w === '' ? '' : dispWU(s.w, u)}" placeholder="${phW}">
      <input class="in" inputmode="numeric" data-in="r" data-i="${i}" data-j="${j}" value="${s.r}" placeholder="${phR}">
      <button class="chk" data-act="check" data-i="${i}" data-j="${j}" aria-label="Complete set">${pr ? ICON.trophy : ICON.check}</button>
    </div>`;
  }).join('');
  const range = e.repMin ? `${e.repMin}-${e.repMax} reps` : '';
  return `<div class="card ex ${e.optional ? 'opt' : ''}">
    <div class="ex-h"><div><button class="exname" data-act="exInfo" data-name="${esc(e.name)}">${esc(e.name)}</button>
      <div class="muted sm">${range} · rest ${fmtRest(e.rest)}${e.optional ? ' · optional' : ''}${e.home && e.name === e.home ? ' · home version of ' + esc(e.gym) : ''}${e.tnote ? ' · ' + esc(e.tnote) : ''}</div></div>
      <div class="exh-r">${e.home ? `<button class="placebtn ${e.name === e.home ? 'home' : ''}" data-act="exPlace" data-i="${i}" aria-label="Switch to the ${e.name === e.home ? 'gym' : 'home'} version">${e.name === e.home ? 'Home' : 'Gym'} ${ICON.swap}</button>` : ''}<button class="icon sm" data-act="exMenu" data-i="${i}" aria-label="Exercise options">${ICON.dots}</button></div></div>
    <div class="sug ${sug.kind}">${sug.kind === 'up' ? ICON.up : ''}${esc(sug.text)}</div>
    ${last && Math.max(...last.sets.map(x => x.w)) > 0 ? (() => { const top = Math.max(...last.sets.map(x => x.w)); return `<div class="conv">Last top set: <b>${dispWU(top, 'kg')} kg</b> = <b>${dispWU(top, 'lb')} lb</b></div>`; })() : ''}
    ${e.showNote || e.note ? `<textarea class="field note" rows="1" data-in="exnote" data-i="${i}" placeholder="Note for this exercise">${esc(e.note)}</textarea>` : ''}
    <div class="set head"><span>Set</span><span>Previous</span><span><button class="unitbtn" data-act="exUnit" data-i="${i}" aria-label="Switch ${esc(e.name)} to ${u === 'kg' ? 'lb' : 'kg'}">${u} ${ICON.swap}</button></span><span>Reps</span><span></span></div>
    ${rows}
    <div class="ex-f"><button class="link" data-act="addSet" data-i="${i}">+ Add set</button>${e.sets.length ? `<button class="link muted" data-act="delSet" data-i="${i}">Remove last</button>` : ''}${type === 'barbell' ? `<button class="link muted" data-act="plates" data-i="${i}">Plates</button>` : ''}</div>
  </div>`;
}
const fmtRest = s => s >= 60 ? `${Math.floor(s / 60)}:${pad(s % 60)}` : `${s}s`;

/* finishing */
async function finishWorkout() {
  const a = S.active;
  const ex = a.exercises.map(e => ({ name: e.name, note: e.note || '', sets: e.sets.filter(s => s.done && +s.r > 0).map(s => ({ w: +s.w || 0, r: +s.r })) })).filter(e => e.sets.length);
  const loose = a.exercises.reduce((n, e) => n + e.sets.filter(s => !s.done && (s.w !== '' || s.r !== '')).length, 0);
  if (!ex.length) { if (await ask('No completed sets. Discard this workout?', 'Discard', true)) { S.active = null; save(); unwake(); stopRest(); go('workout'); } return; }
  if (loose && !(await ask(`${loose} set${loose > 1 ? 's have' : ' has'} numbers but no tick. Unticked sets are not saved. Finish anyway?`, 'Finish'))) return;

  const old = a.editId ? S.sessions.find(s => s.id === a.editId) : null;
  const prs = [];
  for (const e of ex) {
    const prior = bestE1(e.name, a.editId); if (prior <= 0) continue;
    let best = null; for (const s of e.sets) { const v = e1rm(s.w, s.r); if (v > prior && (!best || v > best.v)) best = { v, s }; }
    if (best) prs.push({ name: e.name, set: best.s, e1: best.v, prior });
  }
  const before = sorted().filter(s => s.id !== a.editId && s.date <= a.date);
  const lastBefore = before[before.length - 1];
  const comeback = lastBefore && daysBetween(lastBefore.date, a.date) >= 7;
  const imported = old && old.imported;
  const st = S.settings;
  const xpBonus = imported ? 0 : prs.length * st.xpPR + (comeback ? st.xpComeback : 0);
  const stairMin = parseFloat(a.stair.min);
  const sess = {
    id: a.editId || uid(), date: a.date, templateId: a.templateId, name: a.name.trim() || 'Workout',
    startTs: old ? old.startTs : a.startTs,
    durationMin: old ? old.durationMin : Math.max(1, Math.round((Date.now() - a.startTs) / 60000)),
    exercises: ex, stair: stairMin > 0 ? { min: stairMin, level: parseFloat(a.stair.level) || 0, kcal: parseFloat(a.stair.kcal) || 0 } : null,
    note: a.note || '', imported: !!imported, xpBonus, prs: prs.length
  };
  const xpB = xpTotal(), lvlB = levelOf(xpB);
  if (old) S.sessions[S.sessions.indexOf(old)] = sess; else S.sessions.push(sess);
  S.active = null; save(); unwake(); stopRest();
  const xpA = xpTotal(), lvlA = levelOf(xpA);
  go('history');
  if (!old) showSummary(sess, prs, comeback, xpA - xpB, lvlA > lvlB ? lvlA : null);
  else toast('Session updated');
}

function showSummary(sess, prs, comeback, xpGain, newLvl) {
  const ws = weekStats(), W = ws.weeks[weekNo(sess.date) - 1];
  const lines = ['Logged. Don\'t celebrate. Recover and come back.', 'That\'s one. The job is the next one.', 'Done. Now eat, sleep, repeat.', 'Good. Good is the minimum.'];
  openModal(`<div class="sum">
    <div class="sum-badge">${ICON.check}</div>
    <h2>${esc(sess.name)} complete</h2>
    <p class="muted">${lines[Math.floor(Math.random() * lines.length)]}</p>
    <div class="grid3">
      <div class="stat"><b>${sess.durationMin}m</b><span>time</span></div>
      <div class="stat"><b>${setCount(sess)}</b><span>sets</span></div>
      <div class="stat"><b>${fmtVol(volume(sess))}</b><span>volume</span></div>
    </div>
    <div class="xpgain">+${xpGain} XP${newLvl ? ` · <b>LEVEL ${newLvl}</b> (${rankOf(newLvl)})` : ''}</div>
    ${comeback ? `<div class="tag fire">Comeback bonus +${S.settings.xpComeback} XP</div>` : ''}
    ${W ? `<div class="muted">Week ${W.no}: ${W.count}/${S.settings.weeklyTarget} sessions</div>` : ''}
    ${prs.length ? `<div class="sect">New records</div>${prs.map(p => `<div class="prrow">${ICON.trophy}<div><b>${esc(p.name)}</b><div class="muted sm">${fmtSet(p.set)} · est. 1RM ${dispR(p.e1)} ${unit()} (was ${dispR(p.prior)})</div></div></div>`).join('')}` : ''}
    <button class="btn primary wide" data-act="close">Close</button>
  </div>`);
}

/* rest timer */
let rest = { end: 0, total: 0 };
let audio = null;
function ensureAudio() { try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { } }
function beep() {
  try {
    ensureAudio(); const t0 = audio.currentTime;
    [0, 0.22, 0.44].forEach(d => {
      const o = audio.createOscillator(), g = audio.createGain(); o.connect(g); g.connect(audio.destination); o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
      o.start(t0 + d); o.stop(t0 + d + 0.2);
    });
  } catch (e) { }
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { }
}
function startRest(sec) { rest = { end: Date.now() + sec * 1000, total: sec * 1000 }; tickRest(); }
function stopRest() { rest = { end: 0, total: 0 }; $('#restbar').hidden = true; }
function tickRest() {
  const bar = $('#restbar');
  if (!rest.end) { bar.hidden = true; return; }
  const left = rest.end - Date.now();
  if (left <= 0) { stopRest(); beep(); toast('Rest over. Next set.'); return; }
  const s = Math.ceil(left / 1000);
  bar.hidden = false;
  bar.innerHTML = `<div class="rfill" style="width:${(1 - left / rest.total) * 100}%"></div>
    <button data-act="restAdj" data-d="-15">−15</button><div class="rt"><small>Rest</small><b>${Math.floor(s / 60)}:${pad(s % 60)}</b></div>
    <button data-act="restAdj" data-d="15">+15</button><button data-act="restSkip" class="skip">Skip</button>`;
}
setInterval(() => {
  tickRest();
  if (S.active) { const el = $('#elapsed'); if (el && !S.active.editId) el.textContent = elapsed(); const p = $('#pillTime'); if (p) p.textContent = elapsed(); }
}, 500);

/* wake lock keeps the screen on mid-workout */
let wl = null;
async function wake() { try { if ('wakeLock' in navigator) wl = await navigator.wakeLock.request('screen'); } catch (e) { } }
function unwake() { try { wl && wl.release(); } catch (e) { } wl = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (S.active) wake(); render(); } });

/* ---------------- PLAN BUILDER + GIFT ---------------- */
let pbDraft = null, pendingGift = null;
const cloneDay = d => ({ name: d.name, focus: d.focus || '', ex: d.ex.map(x => ({ name: x.name, sets: x.sets, repMin: x.repMin, repMax: x.repMax, rest: x.rest, note: x.note || '', optional: !!x.optional })) });
function planFromTemplates() {
  const days = S.templates.filter(t => t.day).sort((x, y) => x.day - y.day);
  return { name: 'My plan', days: days.map(t => cloneDay({ name: t.name, focus: t.focus, ex: t.exercises })) };
}
function applyPlan(plan) {
  S.templates = plan.days.map((d, i) => ({ id: 'p' + uid(), day: i + 1, name: d.name || `Day ${i + 1}`, focus: d.focus || '',
    exercises: d.ex.filter(x => (x.name || '').trim()).map(x => ({ name: x.name.trim(), sets: +x.sets || 3, repMin: +x.repMin || 8, repMax: +x.repMax || 12, rest: +x.rest || 90, optional: !!x.optional, note: x.note || '' })) }));
  for (const t of S.templates) for (const x of t.exercises) if (!S.exTypes[x.name]) S.exTypes[x.name] = exType(x.name);
  S.planName = plan.name || '';
}
function exLibNames() { return [...new Set([...Object.keys(window.EXLIB || {}), ...allExerciseNames()])].sort((x, y) => x.localeCompare(y)); }
function openPlanBuilder(src) { pbDraft = JSON.parse(JSON.stringify(src || planFromTemplates())); renderPB(); }
function renderPB() {
  const keep = $('#modal .sheet') ? $('#modal .sheet').scrollTop : 0, d = pbDraft;
  const num = (di, xi, k, v, label) => `<label>${label}<input class="field" inputmode="numeric" data-in="pbe" data-d="${di}" data-x="${xi}" data-k="${k}" value="${esc(v)}"></label>`;
  openModal(`<div class="mh"><div><h2>Plan builder</h2><div class="muted">Each day becomes one workout in the rotation</div></div><button class="icon" data-act="close" aria-label="Close">${ICON.x}</button></div>
    <datalist id="exlib">${exLibNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="sect">Start from</div>
    <div class="fchips">${Object.entries(PROGRAMS).map(([k, pr]) => `<button class="fchip" data-act="pbLoad" data-k="${k}">${esc(pr.name)}</button>`).join('')}<button class="fchip" data-act="pbLoad" data-k="current">My current plan</button></div>
    <label class="lbl">Plan name<input class="field" data-in="pb" data-k="name" value="${esc(d.name || '')}"></label>
    ${d.days.map((day, di) => `<div class="pbday">
      <div class="pbday-h"><span class="pbn">Day ${di + 1}</span><input class="field" data-in="pbd" data-d="${di}" data-k="name" value="${esc(day.name)}" aria-label="Day ${di + 1} name">
        <span class="pbmove">${di > 0 ? `<button class="link" data-act="pbDayMove" data-d="${di}" data-m="-1">up</button>` : ''}${di < d.days.length - 1 ? `<button class="link" data-act="pbDayMove" data-d="${di}" data-m="1">down</button>` : ''}<button class="link danger-text" data-act="pbDayDel" data-d="${di}">remove</button></span></div>
      ${day.ex.map((x, xi) => `<div class="pbex">
        <input class="field" list="exlib" data-in="pbe" data-d="${di}" data-x="${xi}" data-k="name" value="${esc(x.name)}" placeholder="Exercise" aria-label="Exercise name">
        <div class="pbnums">${num(di, xi, 'sets', x.sets, 'Sets')}${num(di, xi, 'repMin', x.repMin, 'Min reps')}${num(di, xi, 'repMax', x.repMax, 'Max reps')}${num(di, xi, 'rest', x.rest, 'Rest (s)')}</div>
        <div class="pbfoot"><span class="muted sm" id="pbh-${di}-${xi}">${homeHint(x.name)}</span><span>${xi > 0 ? `<button class="link" data-act="pbExMove" data-d="${di}" data-x="${xi}" data-m="-1">up</button>` : ''}${xi < day.ex.length - 1 ? `<button class="link" data-act="pbExMove" data-d="${di}" data-x="${xi}" data-m="1">down</button>` : ''}<button class="link danger-text" data-act="pbExDel" data-d="${di}" data-x="${xi}">remove</button></span></div>
      </div>`).join('')}
      <button class="btn ghost wide" data-act="pbExAdd" data-d="${di}">+ Add exercise</button>
    </div>`).join('')}
    <button class="btn ghost wide" data-act="pbDayAdd">+ Add day</button>
    <div class="pbbar"><button class="btn primary" data-act="pbUse">Use this plan</button><button class="btn" data-act="pbGift">Send as a gift</button></div>`);
  const sh = $('#modal .sheet'); if (sh) sh.scrollTop = keep;
}
function homeHint(n) { const h = window.homeOf && homeOf((window.gymOf && gymOf(n)) || n); return h ? 'At home: ' + esc(h) : (n ? 'Same at home, or no home version' : ''); }

function b64e(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64d(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
function giftLink(plan, note) {
  const payload = { v: 1, from: (S.settings.name || '').trim(), note: note || '', name: plan.name || '',
    days: plan.days.map(d => ({ n: d.name, f: d.focus || '', x: d.ex.filter(x => (x.name || '').trim()).map(x => [x.name.trim(), +x.sets || 3, +x.repMin || 8, +x.repMax || 12, +x.rest || 90, x.note || '']) })) };
  return location.origin + location.pathname + '#gift=' + b64e(JSON.stringify(payload));
}
function readGift() {
  if (!location.hash.startsWith('#gift=')) return;
  try {
    const g = JSON.parse(b64d(location.hash.slice(6)));
    pendingGift = { from: g.from || '', note: g.note || '', plan: { name: g.name || 'Your plan', days: g.days.map(d => ({ name: d.n, focus: d.f || '', ex: d.x.map(x => ({ name: x[0], sets: x[1], repMin: x[2], repMax: x[3], rest: x[4], note: x[5] || '' })) })) } };
  } catch (e) { toast('That plan link looks broken. Ask for a new one.'); }
  history.replaceState(null, '', location.pathname + '#home');
}
function planPreview(plan) {
  return plan.days.map((d, i) => `<div class="pvday"><b>Day ${i + 1} · ${esc(d.name)}</b><span class="muted sm">${d.ex.map(x => esc(x.name)).join(' · ')}</span></div>`).join('');
}
function giftOffer() {
  if (!pendingGift || S.fresh) return;
  const g = pendingGift;
  openModal(`<div class="mh"><div><h2>${g.from ? esc(g.from) + ' made you a plan' : 'A plan for you'}</h2><div class="muted">${esc(g.plan.name)} · ${g.plan.days.length} days</div></div><button class="icon" data-act="close" aria-label="Close">${ICON.x}</button></div>
    ${g.note ? `<div class="giftnote">${esc(g.note)}</div>` : ''}
    ${planPreview(g.plan)}
    <p class="muted sm">Using it replaces your current workout rotation. Your history stays.</p>
    <div class="row2"><button class="btn" data-act="close">Not now</button><button class="btn primary" data-act="giftUse">Use this plan</button></div>`, () => { pendingGift = null; render(); });
}

/* ---------------- HISTORY ---------------- */
function viewHistory() {
  const list = sorted().reverse();
  if (!list.length) return `<div class="page-h"><h2>History</h2></div><div class="empty">Nothing logged yet.</div>`;
  let h = `<div class="page-h"><h2>History</h2><span class="muted sm">${list.length} sessions</span></div>`;
  let curW = null;
  for (const s of list) {
    const w = weekNo(s.date);
    if (w !== curW) {
      curW = w; const inW = list.filter(x => weekNo(x.date) === w);
      h += `<div class="sect">Week ${w} <span class="muted">· ${inW.length} sessions · ${fmtVol(inW.reduce((a, x) => a + volume(x), 0))}</span></div>`;
    }
    const prs = s.prs || 0;
    h += `<div class="card sess" data-act="openSess" data-id="${s.id}">
      <div class="card-h"><h3>${esc(s.name)}</h3><span class="muted sm">${fmtDate(s.date)}</span></div>
      <div class="chips">${s.unlogged && !s.exercises.length ? '<span>sets not logged</span>' : ''}${s.durationMin ? `<span>${ICON.clock}${s.durationMin}m</span>` : ''}${s.exercises.length ? `<span>${fmtVol(volume(s))}</span><span>${setCount(s)} sets</span>` : ''}${s.stair ? `<span>stairs ${s.stair.min}m</span>` : ''}${prs > 0 ? `<span class="gold">${ICON.trophy}${prs}</span>` : ''}</div>
      <ul class="bests">${s.exercises.map(e => { const b = e.sets.reduce((m, x) => e1rm(x.w, x.r) > e1rm(m.w, m.r) || (m.w === 0 && x.r > m.r) ? x : m, e.sets[0]); return `<li><span>${e.sets.length} × ${esc(e.name)}</span><span class="muted">${fmtSet(b)}</span></li>`; }).join('')}</ul>
    </div>`;
  }
  return h;
}

function openSession(id) {
  const s = S.sessions.find(x => x.id === id); if (!s) return;
  openModal(`<div class="mh"><div><h2>${esc(s.name)}</h2><div class="muted">${fmtDate(s.date)}${s.durationMin ? ' · ' + s.durationMin + ' min' : ''} · ${fmtVol(volume(s))}</div></div><button class="icon" data-act="close">${ICON.x}</button></div>
    ${s.exercises.map(e => `<div class="dex"><b>${esc(e.name)}</b>${e.sets.map((x, j) => `<div class="drow"><span>${j + 1}</span><span>${fmtSet(x)}</span><span class="muted">${x.w > 0 ? '1RM ~' + dispR(e1rm(x.w, x.r)) : ''}</span></div>`).join('')}${e.note ? `<div class="muted sm">${esc(e.note)}</div>` : ''}</div>`).join('')}
    ${s.stair ? `<div class="dex"><b>Stairmaster</b><div class="muted">${s.stair.min} min · level ${s.stair.level || '-'} · ${s.stair.kcal || '-'} kcal</div></div>` : ''}
    ${s.note ? `<div class="dex"><b>Note</b><div>${esc(s.note)}</div></div>` : ''}
    <div class="row3"><button class="btn" data-act="editSess" data-id="${s.id}">Edit</button><button class="btn" data-act="repeatSess" data-id="${s.id}">Repeat</button><button class="btn danger" data-act="delSess" data-id="${s.id}">Delete</button></div>`);
}

function editSession(id) {
  if (S.active) { toast('Finish the current workout first'); return; }
  const s = S.sessions.find(x => x.id === id); if (!s) return;
  S.active = {
    id: uid(), editId: s.id, templateId: s.templateId, name: s.name, date: s.date, startTs: s.startTs || Date.now(),
    exercises: s.exercises.map(e => { const te = findTplEx(e.name) || defEx(e.name); return { ...mkEx({ ...te, sets: 0 }), note: e.note || '', sets: e.sets.map(x => ({ w: x.w, r: x.r, done: true })) }; }),
    stair: s.stair ? { min: s.stair.min, level: s.stair.level || '', kcal: s.stair.kcal || '' } : { min: '', level: '', kcal: '' }, note: s.note || ''
  };
  save(); closeModal(); go('workout');
}

/* ---------------- EXERCISES ---------------- */
let exQuery = '';
function viewExercises() {
  const names = allExerciseNames().filter(n => n.toLowerCase().includes(exQuery.toLowerCase()));
  let h = `<div class="page-h"><h2>Exercises</h2></div>
    <input class="field search" data-in="exq" placeholder="Search exercises" value="${esc(exQuery)}">`;
  h += `<div id="exlist">${exListHTML(names)}</div>`;
  return h;
}
function exListHTML(names) {
  return names.map(n => {
    const hist = exHistory(n), b = bestE1(n), last = hist[hist.length - 1];
    return `<div class="card exrow" data-act="exInfo" data-name="${esc(n)}"><div><b>${esc(n)}</b><div class="muted sm">${exType(n)}${last ? ' · last ' + fmtShort(last.date) : ' · not logged yet'}</div></div>
      <div class="right">${b ? `<b>${dispR(b)}</b><div class="muted sm">est. 1RM</div>` : last ? `<b>${Math.max(...last.sets.map(s => s.r))}</b><div class="muted sm">top reps</div>` : ''}</div></div>`;
  }).join('') || `<div class="empty">No match. Add it from a workout.</div>`;
}

let exMetric = 'e1';
function openExercise(name) {
  const hist = exHistory(name), type = exType(name);
  const metricFn = { e1: sets => Math.max(...sets.map(s => e1rm(s.w, s.r))), top: sets => Math.max(...sets.map(s => s.w)), vol: sets => sets.reduce((a, s) => a + s.w * s.r, 0), reps: sets => Math.max(...sets.map(s => s.r)) };
  const conv = v => exMetric === 'reps' ? v : (unit() === 'lb' ? v * LB : v);
  const pts = hist.map(h => ({ x: parseD(h.date).getTime(), y: Math.round(conv(metricFn[exMetric](h.sets)) * 2) / 2 }));
  let bestE = null, heavy = null, mostR = null, bestV = null;
  for (const h of hist) for (const s of h.sets) {
    if (!bestE || e1rm(s.w, s.r) > e1rm(bestE.w, bestE.r)) bestE = { ...s, date: h.date };
    if (!heavy || s.w > heavy.w) heavy = { ...s, date: h.date };
    if (!mostR || s.r > mostR.r) mostR = { ...s, date: h.date };
  }
  for (const h of hist) { const v = metricFn.vol(h.sets); if (!bestV || v > bestV.v) bestV = { v, date: h.date }; }
  const te = findTplEx(name);
  openModal(`<div class="mh"><div><h2>${esc(name)}</h2><div class="muted">${hist.length} sessions${te ? ` · ${te.sets} × ${te.repMin}-${te.repMax}` : ''}</div></div><button class="icon" data-act="close">${ICON.x}</button></div>
    <div class="seg">${[['e1', 'Est. 1RM'], ['top', 'Top weight'], ['vol', 'Volume'], ['reps', 'Top reps']].map(([k, l]) => `<button class="${exMetric === k ? 'on' : ''}" data-act="exMetric" data-k="${k}" data-name="${esc(name)}">${l}</button>`).join('')}</div>
    ${svgLine([{ pts }])}
    ${hist.length ? `<div class="grid2 recs">
      ${bestE && bestE.w ? `<div class="stat"><b>${dispR(e1rm(bestE.w, bestE.r))}</b><span>best est. 1RM · ${fmtSet(bestE)}</span></div>` : ''}
      ${heavy && heavy.w ? `<div class="stat"><b>${dispW(heavy.w)}</b><span>heaviest ${unit()} · ${fmtShort(heavy.date)}</span></div>` : ''}
      <div class="stat"><b>${mostR.r}</b><span>most reps · ${fmtSet(mostR)}</span></div>
      <div class="stat"><b>${fmtVol(bestV.v)}</b><span>best session volume</span></div>
    </div>` : ''}
    <label class="lbl">Equipment (sets the weight jump and plate calculator)
      <select class="field" data-in="extype" data-name="${esc(name)}">${['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'].map(t => `<option ${t === type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <div class="sect">History</div>
    ${hist.slice().reverse().map(h => `<div class="drow2"><span class="muted">${fmtShort(h.date)}</span><span>${h.sets.map(fmtSet).join(', ')}</span></div>`).join('') || '<div class="empty">Not logged yet</div>'}
  `);
}

/* ---------------- BODY ---------------- */
function viewBody() {
  const st = S.settings, ws = weekStats();
  const w = [...S.weights].sort(byDate), lw = w[w.length - 1], first = w[0];
  let h = `<div class="page-h"><h2>Your progress</h2></div>`;
  if (lw && daysBetween(lw.date, today()) > 7) h += `<div class="nudge solo">Last weigh-in was ${daysBetween(lw.date, today())} days ago. Log one below, same morning, before food.</div>`;
  h += `<div class="card"><div class="card-h"><h3>Weigh-in</h3><span class="muted sm">same morning, before food</span></div>
    <div class="inline"><input type="date" class="field" id="wDate" value="${today()}"><input class="field" id="wKg" inputmode="decimal" placeholder="kg"><button class="btn primary" data-act="addWeight">Log</button></div></div>`;
  if (w.length) {
    const ms = st.milestones.map(([d, kg]) => ({ x: parseD(d).getTime(), y: kg }));
    const weeks = Math.max(daysBetween(first.date, lw.date) / 7, 0);
    const rate = weeks >= 1 ? (lw.kg - first.kg) / weeks : null;
    h += `<div class="card"><div class="card-h"><h3>Weight trend</h3><span class="muted sm">dots = your checkpoints</span></div>
      ${svgLine([{ pts: w.map(x => ({ x: parseD(x.date).getTime(), y: x.kg })) }, { pts: ms, dash: true }], { hline: st.goalWeight, hlabel: 'goal ' + st.goalWeight })}
      <div class="grid3 tight">
        <div class="stat"><b>${trim(lw.kg)}</b><span>latest kg</span></div>
        <div class="stat"><b class="good">${trim(first.kg - lw.kg)}</b><span>kg lost</span></div>
        <div class="stat"><b>${rate == null ? '-' : trim(Math.round(rate * 100) / 100)}</b><span>kg / week</span></div>
      </div>
      <div class="msl">${st.milestones.map(([d, kg]) => `<span class="${lw.kg <= kg ? 'hit' : daysBetween(d, today()) > 0 ? 'late' : ''}">${kg} kg · ${fmtShort(d)}</span>`).join('')}</div>
      <p class="muted sm">Judge the line over three weeks, never one weigh-in against the last. Water, salt and sleep move it daily.</p></div>`;
    h += `<details class="card"><summary>All weigh-ins (${w.length})</summary>${w.slice().reverse().map(x => `<div class="drow2"><span>${fmtDate(x.date)}</span><span><b>${trim(x.kg)}</b> kg <button class="link danger-text" data-act="delWeight" data-d="${x.date}">delete</button></span></div>`).join('')}</details>`;
  }
  // strength wins
  const wins = strengthWins();
  if (wins.length) h += `<div class="card"><div class="card-h"><h3>Wins the scale can't see</h3><span class="muted sm">since your first session</span></div>
    <div class="wins">${wins.slice(0, 6).map(([n, g]) => `<div><b>+${dispR(g)} ${unit()}</b><span>${esc(n)}</span></div>`).join('')}</div></div>`;
  // steps
  const d14 = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13));
  const W = ws.weeks[ws.cur - 1];
  const hitAll = Object.values(S.steps).filter(v => v >= st.stepGoal).length;
  h += `<div class="card"><div class="card-h"><h3>Steps</h3><span class="muted sm">goal ${st.stepGoal.toLocaleString()} a day</span></div>
    <div class="inline"><input type="date" class="field" id="sDate" value="${today()}"><input class="field" id="sVal" inputmode="numeric" placeholder="steps"><button class="btn primary" data-act="addSteps">Log</button></div>
    ${svgBars(d14.map(d => S.steps[d] ?? null), d14.map(d => parseD(d).toLocaleDateString(undefined, { weekday: 'narrow' })), st.stepGoal)}
    <div class="grid3 tight">
      <div class="stat"><b>${W && W.stepAvg != null ? W.stepAvg.toLocaleString() : '-'}</b><span>avg this week</span></div>
      <div class="stat"><b>${W ? W.stepHit : 0}/7</b><span>days at goal</span></div>
      <div class="stat"><b>${hitAll}</b><span>goal days total</span></div>
    </div></div>`;
  return h;
}

/* ---------------- modals: add exercise, menus, templates, settings, plates ---------------- */
function addExerciseModal(replaceIdx) {
  openModal(`<div class="mh"><h2>${replaceIdx != null ? 'Replace exercise' : 'Add exercise'}</h2><button class="icon" data-act="close">${ICON.x}</button></div>
    <input class="field search" id="addq" data-in="addq" placeholder="Search or type a new name" autocomplete="off">
    <div id="addlist">${addListHTML('', replaceIdx)}</div>`);
  setTimeout(() => { const i = $('#addq'); i && i.focus(); }, 50);
}
function addListHTML(q, replaceIdx) {
  const names = allExerciseNames().filter(n => n.toLowerCase().includes(q.toLowerCase()));
  const ri = replaceIdx != null ? ` data-r="${replaceIdx}"` : '';
  let h = names.map(n => `<button class="pick" data-act="pickEx" data-name="${esc(n)}"${ri}>${esc(n)}<span class="muted sm">${exType(n)}</span></button>`).join('');
  if (q.trim() && !names.some(n => n.toLowerCase() === q.trim().toLowerCase())) h = `<button class="pick new" data-act="pickEx" data-name="${esc(q.trim())}"${ri}>+ Create "${esc(q.trim())}"</button>` + h;
  return h;
}

function exMenu(i) {
  const e = S.active.exercises[i], n = S.active.exercises.length;
  openModal(`<div class="mh"><h2>${esc(e.name)}</h2><button class="icon" data-act="close">${ICON.x}</button></div>
    <div class="menu">
      <button data-act="exNote" data-i="${i}">${e.showNote || e.note ? 'Hide note' : 'Add note'}</button>
      <button data-act="exRest" data-i="${i}">Rest time: ${fmtRest(e.rest || 90)}</button>
      <button data-act="exRange" data-i="${i}">Rep range: ${e.repMin}-${e.repMax}</button>
      <button data-act="exReplace" data-i="${i}">Replace exercise</button>
      ${i > 0 ? `<button data-act="exMove" data-i="${i}" data-d="-1">Move up</button>` : ''}
      ${i < n - 1 ? `<button data-act="exMove" data-i="${i}" data-d="1">Move down</button>` : ''}
      <button class="danger-text" data-act="exRemove" data-i="${i}">Remove exercise</button>
    </div>`);
}

function platesModal(kg) {
  const isLb = unit() === 'lb';
  const bar = isLb ? 45 : S.settings.barKg;
  openModal(`<div class="mh"><h2>Plate calculator</h2><button class="icon" data-act="close">${ICON.x}</button></div>
    <p class="muted sm">Total on the bar including the bar itself, the way you log it.</p>
    <div class="row2"><label>Total (${unit()})<input class="field" id="plT" inputmode="decimal" data-in="plates" value="${kg ? dispW(kg) : ''}"></label>
    <label>Bar (${unit()})<input class="field" id="plB" inputmode="decimal" data-in="plates" value="${bar}"></label></div>
    <div id="plOut"></div>`);
  calcPlates();
}
function calcPlates() {
  const T = parseFloat($('#plT').value), B = parseFloat($('#plB').value), out = $('#plOut');
  if (isNaN(T) || isNaN(B)) { out.innerHTML = ''; return; }
  const plates = unit() === 'lb' ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25];
  let side = (T - B) / 2;
  if (side < 0) { out.innerHTML = `<div class="empty">Less than the bar.</div>`; return; }
  const used = []; for (const p of plates) while (side + 1e-9 >= p) { used.push(p); side -= p; }
  out.innerHTML = `<div class="sect">Each side</div><div class="plates">${used.map(p => `<span class="plate p${String(p).replace('.', '_')}">${p}</span>`).join('') || '<span class="muted">Empty bar</span>'}</div>
    ${side > 0.01 ? `<div class="muted sm">${trim(side * 2)} ${unit()} can't be made with standard plates.</div>` : ''}`;
}

let tplDraft = null;
function templateModal(id) {
  const t = id ? tmpl(id) : null;
  tplDraft = t ? JSON.parse(JSON.stringify(t)) : { id: 't' + uid(), day: 0, name: 'New template', focus: '', exercises: [] };
  renderTplModal(!t);
}
function renderTplModal(isNew) {
  const t = tplDraft;
  openModal(`<div class="mh"><h2>${isNew ? 'New template' : 'Edit template'}</h2><button class="icon" data-act="close">${ICON.x}</button></div>
    <label class="lbl">Name<input class="field" data-in="tpl" data-k="name" value="${esc(t.name)}"></label>
    <label class="lbl">Focus<input class="field" data-in="tpl" data-k="focus" value="${esc(t.focus)}"></label>
    <label class="lbl">Rotation slot (1-6, blank = outside the rotation)<input class="field" data-in="tpl" data-k="day" inputmode="numeric" value="${t.day || ''}"></label>
    <div class="sect">Exercises</div>
    <datalist id="exnames">${allExerciseNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    ${t.exercises.map((e, i) => `<div class="tpe">
      <input class="field" list="exnames" data-in="tpe" data-i="${i}" data-k="name" value="${esc(e.name)}">
      <div class="tpe-g">
        <label>Sets<input class="field" inputmode="numeric" data-in="tpe" data-i="${i}" data-k="sets" value="${e.sets}"></label>
        <label>Min reps<input class="field" inputmode="numeric" data-in="tpe" data-i="${i}" data-k="repMin" value="${e.repMin}"></label>
        <label>Max reps<input class="field" inputmode="numeric" data-in="tpe" data-i="${i}" data-k="repMax" value="${e.repMax}"></label>
        <label>Rest (s)<input class="field" inputmode="numeric" data-in="tpe" data-i="${i}" data-k="rest" value="${e.rest}"></label>
      </div>
      <div class="tpe-f"><label class="chkl"><input type="checkbox" data-in="tpe" data-i="${i}" data-k="optional" ${e.optional ? 'checked' : ''}> optional</label>
        <span><button class="link" data-act="tpeMove" data-i="${i}" data-d="-1">up</button><button class="link" data-act="tpeMove" data-i="${i}" data-d="1">down</button><button class="link danger-text" data-act="tpeDel" data-i="${i}">remove</button></span></div>
    </div>`).join('')}
    <button class="btn ghost wide" data-act="tpeAdd">+ Add exercise</button>
    <div class="row2"><button class="btn primary" data-act="tplSave">Save</button>${isNew ? '' : `<button class="btn danger" data-act="tplDel">Delete</button>`}</div>`);
}

function settingsModal() {
  const s = S.settings;
  const f = (k, label, mode = 'numeric') => `<label class="lbl">${label}<input class="field" data-in="set" data-k="${k}" inputmode="${mode}" value="${esc(s[k])}"></label>`;
  openModal(`<div class="mh"><h2>Settings</h2><button class="icon" data-act="close">${ICON.x}</button></div>
    <label class="lbl">Your name<input class="field" id="setName" data-in="setText" data-k="name" value="${esc(s.name || '')}" autocomplete="given-name"></label>
    <div class="lbl">Coach voice</div>
    <div class="seg">${[['kind', 'Kind'], ['tough', 'Tough']].map(([v, l]) => `<button class="${(s.voice || 'kind') === v ? 'on' : ''}" data-act="voice" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="lbl">Body figure</div>
    <div class="seg">${[['man', 'Man'], ['woman', 'Woman']].map(([v, l]) => `<button class="${(S.profile && S.profile.gender === 'woman' ? 'woman' : 'man') === v ? 'on' : ''}" data-act="figure" data-v="${v}">${l}</button>`).join('')}</div>
    <button class="btn wide" data-act="setupRedo">Answer the setup questions and get a new plan</button>
    <div class="lbl">Usually train at</div>
    <div class="seg">${[['gym', 'Gym'], ['home', 'Home']].map(([v, l]) => `<button class="${(s.defaultMode || 'gym') === v ? 'on' : ''}" data-act="place" data-p="${v}">${l}</button>`).join('')}</div>
    <div class="lbl">Units</div>
    <div class="seg">${['kg', 'lb'].map(u => `<button class="${s.unit === u ? 'on' : ''}" data-act="unit" data-u="${u}">${u}</button>`).join('')}</div>
    <p class="muted sm">Everything is stored in kg; this only changes what you see and type.</p>
    <label class="lbl">Program start (a Monday)<input class="field" type="date" data-in="set" data-k="startDate" value="${s.startDate}"></label>
    ${f('weeklyTarget', 'Weekly target (sessions)')}${f('streakThreshold', 'Sessions per week to keep the streak alive')}
    ${f('goalWeight', 'Goal weight (kg)', 'decimal')}${f('stepGoal', 'Daily step goal')}${f('barKg', 'Barbell weight (kg)', 'decimal')}
    <label class="lbl">Weight checkpoints (one per line: YYYY-MM-DD kg)<textarea class="field" rows="4" data-in="milestones">${s.milestones.map(m => m.join(' ')).join('\n')}</textarea></label>
    <div class="sect">XP rules</div>
    <div class="row2">${f('xpSession', 'Per session')}${f('xpStairMin', 'Per stair minute')}</div>
    <div class="row2">${f('xpStepDay', 'Per 10k step day')}${f('xpPR', 'Per new record')}</div>
    ${f('xpComeback', 'Comeback bonus (after 7+ days off)')}
    <div class="sect">Your data</div>
    <p class="muted sm">Stored only in this browser. Install to your home screen so iOS doesn't clear it, and export a backup every couple of weeks.${s.lastBackup ? ' Last backup: ' + fmtShort(s.lastBackup) + '.' : ''}</p>
    <div class="row2"><button class="btn" data-act="export">Export backup</button><button class="btn" data-act="import">Import backup</button></div>
    <button class="btn wide" data-act="csv">Export sets as CSV (for Sheets/Excel)</button>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <p class="muted sm center">Motu version ${APP_VERSION}</p>
    <button class="btn danger-text wide" data-act="wipeHistory">Clear workout history, keep my plan</button>
    <button class="btn danger-text wide" data-act="reset">Erase this device and start fresh</button>
  `, () => render());
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------------- events ---------------- */
const ACT = {
  tab: t => go(t.dataset.t),
  close: () => closeModal(),
  settings: () => settingsModal(),
  start: t => startWorkout(t.dataset.id),
  startQuick: t => startWorkout(t.dataset.id, null, true),
  obNext: () => {
    const d = OB.d, step = OB_STEPS[OB.step];
    if (step === 'name' && !d.name.trim()) { toast('Add your name'); const i = $('#obName'); if (i) i.focus(); return; }
    if (step === 'gender' && !d.gender) return toast('Pick one to continue');
    if (step === 'goals' && !d.goals.length) return toast('Pick at least one goal');
    if (step === 'honest' && !d.freq) return toast('Pick how often you work out now');
    if (step === 'where' && !d.where) return toast('Pick where you will train');
    if (step === 'days' && !d.days) d.days = obSuggestDays(d);
    if (step === 'body' && !(parseFloat(d.now) > 0)) return toast('Add your weight now');
    OB.step++; onboard();
  },
  obBack: () => { OB.step = Math.max(0, OB.step - 1); onboard(); },
  obPick: t => { OB.d[t.dataset.k] = t.dataset.v; onboard(); setTimeout(() => ACT.obNext(), 180); },
  obGoal: t => { const G = OB.d.goals, v = t.dataset.v; OB.d.goals = G.includes(v) ? G.filter(x => x !== v) : [...G, v]; onboard(); },
  obFreq: t => { OB.d.freq = t.dataset.v; onboard(); },
  obLast: t => { OB.d.last7 = Math.max(0, Math.min(7, OB.d.last7 + +t.dataset.m)); onboard(); },
  obDays: t => { OB.d.days = +t.dataset.v; onboard(); },
  obMin: t => { OB.d.minutes = +t.dataset.v; onboard(); },
  obUnitB: t => { OB.d.unit = t.dataset.v; onboard(); },
  obHUnit: t => { OB.d.hUnit = t.dataset.v; onboard(); },
  obPlanKey: t => { OB.planKey = t.dataset.v || null; onboard(); },
  obFinish: () => {
    const d = OB.d, k = v => d.unit === 'lb' ? Math.round(v / LB * 10) / 10 : v;
    const now = parseFloat(d.now), goal = parseFloat(d.goal);
    const heightCm = d.hUnit === 'cm' ? (parseFloat(d.hCm) || null) : ((parseFloat(d.hFt) || 0) * 30.48 + (parseFloat(d.hIn) || 0) * 2.54) || null;
    const plan = obPlan(d), days = d.days || obSuggestDays(d);
    applyPlan(plan);
    S.settings.name = d.name.trim(); S.settings.unit = d.unit;
    S.settings.weeklyTarget = days; S.settings.streakThreshold = Math.min(days, 4);
    S.settings.defaultMode = d.where === 'home' ? 'home' : 'gym';
    S.settings.goalWeight = goal > 0 ? k(goal) : k(now);
    if (OB.redo) { S.weights = S.weights.filter(w => w.date !== today()); S.weights.push({ date: today(), kg: k(now) }); S.weights.sort((a, b) => a.date.localeCompare(b.date)); }
    else S.weights = [{ date: today(), kg: k(now) }];
    S.profile = { gender: d.gender, goals: d.goals, freq: d.freq, last7: d.last7, where: d.where, days, minutes: d.minutes, heightCm: heightCm ? Math.round(heightCm) : null, giftFrom: pendingGift && !OB.planKey ? pendingGift.from : null, createdAt: today() };
    const redo = OB.redo; delete S.fresh; pendingGift = null; OB = null;
    save(); closeOnboard(); go('home');
    toast(redo ? 'Your new plan is ready. Your history stays.' : `Welcome, ${S.settings.name}. Your first workout is ready.`);
  },
  obCancel: () => { OB = null; closeOnboard(); },
  setupRedo: () => {
    closeModal(); obInit(); OB.redo = true;
    const d = OB.d, P = S.profile || {}, lw = latestWeight(), u = S.settings.unit || 'kg';
    d.name = S.settings.name || ''; d.unit = u; d.gender = P.gender || ''; d.goals = P.goals || [];
    if (lw) d.now = String(u === 'lb' ? Math.round(lw.kg * LB * 10) / 10 : lw.kg);
    onboard();
  },
  wipeHistory: async () => {
    const n = S.sessions.length;
    const acct = window.MotuSync && MotuSync.user ? ` from the account ${MotuSync.user.email}` : ' from this phone';
    if (!(await ask(`Make sure this is the right person's account. Delete all ${n} workouts${acct}, plus weigh-ins except the latest, steps and weight checkpoints? Your plan, name and settings stay. This can't be undone.`, 'Delete history', true))) return settingsModal();
    const lw = latestWeight();
    S.sessions = []; S.active = null; S.steps = {}; S.exUnits = {};
    S.weights = lw ? [{ date: lw.date, kg: lw.kg }] : [];
    S.settings.milestones = []; S.settings.startDate = mondayOf(today()); S.settings.comebackSeen = null;
    save(); closeModal(); go('home'); toast('History cleared. Fresh start.');
  },
  nudgeOff: () => { S.settings.setupNudgeOff = true; save(); render(); },
  figure: t => { S.profile = Object.assign({}, S.profile || {}, { gender: t.dataset.v }); save(); settingsModal(); render(); },
  obSignIn: () => { delete S.fresh; pendingGift = null; save(); closeOnboard(); settingsModal(); },
  editSteps: async () => {
    const v = await askText('Steps today', S.steps[today()] ?? '');
    if (v === null) return;
    const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
    if (isNaN(n)) delete S.steps[today()]; else S.steps[today()] = n;
    save(); render(); if (n >= S.settings.stepGoal) toast(`Goal hit. +${S.settings.xpStepDay} XP`);
  },
  cbQuick: t => { closeComeback(); startWorkout(t.dataset.id, null, true); },
  cbFull: t => { closeComeback(); startWorkout(t.dataset.id); },
  cbLater: () => closeComeback(),
  voice: t => { S.settings.voice = t.dataset.v; save(); settingsModal(); },
  finish: () => finishWorkout(),
  cancelWorkout: async () => {
    if (!(await ask(S.active.editId ? 'Discard your changes?' : 'Cancel this workout? Nothing will be saved.', 'Discard', true))) return;
    S.active = null; save(); unwake(); stopRest(); go(tab);
  },
  check: t => {
    ensureAudio();
    const i = +t.dataset.i, j = +t.dataset.j, e = S.active.exercises[i], s = e.sets[j];
    if (s.done) { s.done = false; save(); render(); return; }
    const row = t.closest('.set'), wi = row.querySelector('[data-in=w]'), ri = row.querySelector('[data-in=r]');
    if (s.w === '') { const v = parseFloat(wi.placeholder); s.w = isNaN(v) ? 0 : toKgU(v, wi.dataset.u || unit()); }
    if (s.r === '') { const v = parseInt(ri.placeholder, 10); if (isNaN(v)) { toast('Enter reps first'); ri.focus(); return; } s.r = v; }
    const prior = bestE1(e.name, S.active.editId);
    const doneBefore = e.sets.filter(x => x.done).reduce((m, x) => Math.max(m, e1rm(+x.w || 0, +x.r || 0)), 0);
    s.done = true; save(); render();
    const v = e1rm(+s.w || 0, +s.r || 0);
    if (prior > 0 && v > Math.max(prior, doneBefore)) toast(`New record: ${e.name}, est. 1RM ${dispR(v)} ${unit()}`, 3000);
    const remaining = e.sets.some(x => !x.done);
    startRest(remaining ? (e.rest || 90) : Math.min(e.rest || 90, 120));
  },
  pbOpen: () => openPlanBuilder(),
  pbLoad: t => { const k = t.dataset.k; pbDraft = k === 'current' ? planFromTemplates() : { name: PROGRAMS[k].name, days: PROGRAMS[k].days.map(cloneDay) }; renderPB(); },
  pbDayAdd: () => { pbDraft.days.push({ name: `Day ${pbDraft.days.length + 1}`, focus: '', ex: [] }); renderPB(); },
  pbDayDel: async t => { const i = +t.dataset.d; if (pbDraft.days[i].ex.length && !(await ask(`Remove ${pbDraft.days[i].name} and its exercises?`, 'Remove', true))) { renderPB(); return; } pbDraft.days.splice(i, 1); renderPB(); },
  pbDayMove: t => { const i = +t.dataset.d, m = +t.dataset.m, D = pbDraft.days; [D[i], D[i + m]] = [D[i + m], D[i]]; renderPB(); },
  pbExAdd: t => { pbDraft.days[+t.dataset.d].ex.push({ name: '', sets: 3, repMin: 8, repMax: 12, rest: 90, note: '' }); renderPB(); setTimeout(() => { const ins = $$('#modal .pbday')[+t.dataset.d].querySelectorAll('[data-k=name][data-x]'); const last = ins[ins.length - 1]; if (last) last.focus(); }, 30); },
  pbExDel: t => { pbDraft.days[+t.dataset.d].ex.splice(+t.dataset.x, 1); renderPB(); },
  pbExMove: t => { const X = pbDraft.days[+t.dataset.d].ex, i = +t.dataset.x, m = +t.dataset.m; [X[i], X[i + m]] = [X[i + m], X[i]]; renderPB(); },
  pbUse: async () => {
    if (!pbDraft.days.length || !pbDraft.days.some(d => d.ex.some(x => (x.name || '').trim()))) return toast('Add at least one exercise');
    if (!(await ask(`This replaces your current rotation (${S.planName || S.templates.map(t => t.name).slice(0, 3).join(", ")}) with "${pbDraft.name || "this plan"}". Your workout history stays. Building a plan for someone else? Tap Cancel and use Send as a gift.`, 'Replace my plan', true))) { renderPB(); return; }
    applyPlan(pbDraft); save(); closeModal(); go('workout'); toast('Plan saved. Your next workout is ready.');
  },
  pbGift: async () => {
    if (!pbDraft.days.some(d => d.ex.some(x => (x.name || '').trim()))) return toast('Add at least one exercise first');
    const draft = pbDraft;
    const note = await askText('Add a personal note (optional)', '');
    if (note === null) { pbDraft = draft; renderPB(); return; }
    const link = giftLink(draft, String(note).trim());
    pbDraft = draft;
    openModal(`<div class="mh"><div><h2>Your gift link</h2><div class="muted">Send it to her. It opens Motu with this plan ready.</div></div><button class="icon" data-act="close" aria-label="Close">${ICON.x}</button></div>
      <textarea class="field giftlink" id="giftLink" rows="4" readonly>${esc(link)}</textarea>
      <div class="row2"><button class="btn" data-act="giftCopy">Copy link</button><button class="btn primary" data-act="giftShare">Share</button></div>
      <button class="btn ghost wide" data-act="pbBack">Back to the plan</button>`);
  },
  pbBack: () => renderPB(),
  giftCopy: async () => { const el = $('#giftLink'); try { await navigator.clipboard.writeText(el.value); toast('Link copied'); } catch (e) { el.select(); toast('Select and copy the link'); } },
  giftShare: async () => { const url = $('#giftLink').value; try { await navigator.share({ title: 'Motu', text: `${(S.settings.name || 'I').trim()} made you a workout plan`, url }); } catch (e) { if (!(e && e.name === 'AbortError')) ACT.giftCopy(); } },
  giftUse: () => { const g = pendingGift; if (!g) return; applyPlan(g.plan); pendingGift = null; save(); closeModal(); go('workout'); toast(`${g.plan.name} is your plan now`); },
  exPlace: async t => {
    const e = S.active.exercises[+t.dataset.i], toHome = e.name !== e.home;
    if (e.sets.some(s => s.done)) { if (!(await ask(`You've finished sets of ${e.name}. Switching clears them. Switch anyway?`, 'Switch', true))) return; e.sets = e.sets.map(() => ({ w: '', r: '', done: false })); }
    swapEx(e, toHome); save(); render(); toast(toHome ? `Home version: ${e.name}` : `Back to ${e.name}`);
  },
  woPlace: t => {
    const mode = t.dataset.p, a = S.active; a.mode = mode; let kept = 0;
    for (const e of a.exercises) { if (swapEx(e, mode === 'home') === 'done') kept++; }
    save(); render();
    toast(mode === 'home' ? `Home workout${kept ? `. ${kept} exercise${kept > 1 ? 's' : ''} with finished sets stayed as they were` : ''}` : `Gym workout${kept ? `. ${kept} kept as they were` : ''}`);
  },
  place: t => { S.settings.defaultMode = t.dataset.p; save(); settingsModal(); },
  exUnit: t => {
    S.exUnits = S.exUnits || {};
    const e = S.active.exercises[+t.dataset.i], next = exUnit(e.name) === 'kg' ? 'lb' : 'kg';
    if (next === S.settings.unit) delete S.exUnits[e.name]; else S.exUnits[e.name] = next;
    save(); render(); toast(`${e.name} now in ${next}`);
  },
  woUnit: t => {
    S.exUnits = S.exUnits || {};
    const u = t.dataset.u; S.settings.unit = u;
    for (const e of S.active.exercises) delete S.exUnits[e.name];
    save(); render(); toast(`All weights in ${u}`);
  },
  copyPrev: t => {
    const i = +t.dataset.i, j = +t.dataset.j, e = S.active.exercises[i], last = lastPerf(e.name, S.active.editId);
    const p = last && last.sets[j]; if (!p) return;
    e.sets[j].w = p.w; e.sets[j].r = p.r; save(); render();
  },
  addSet: t => { const e = S.active.exercises[+t.dataset.i]; const l = e.sets[e.sets.length - 1]; e.sets.push({ w: l ? l.w : '', r: '', done: false }); save(); render(); },
  delSet: t => { const e = S.active.exercises[+t.dataset.i]; e.sets.pop(); save(); render(); },
  addEx: () => addExerciseModal(),
  pickEx: t => {
    const name = t.dataset.name; if (!S.exTypes[name]) S.exTypes[name] = guessType(name);
    const te = findTplEx(name) || defEx(name);
    if (t.dataset.r != null) { const i = +t.dataset.r; const old = S.active.exercises[i]; S.active.exercises[i] = { ...mkEx({ ...te, sets: old.sets.length || te.sets }) }; }
    else S.active.exercises.push(mkEx(te));
    save(); closeModal(); render();
  },
  exInfo: t => openExercise(t.dataset.name),
  exMetric: t => { exMetric = t.dataset.k; openExercise(t.dataset.name); },
  exMenu: t => exMenu(+t.dataset.i),
  exNote: t => { const e = S.active.exercises[+t.dataset.i]; e.showNote = !(e.showNote || e.note); if (!e.showNote) e.note = ''; save(); closeModal(); render(); },
  exRest: async t => { const e = S.active.exercises[+t.dataset.i]; const v = await askText('Rest between sets, in seconds', e.rest || 90); if (v && !isNaN(+v)) { e.rest = +v; save(); } render(); },
  exRange: async t => { const e = S.active.exercises[+t.dataset.i]; const v = await askText('Rep range, like 8-12', `${e.repMin}-${e.repMax}`); const m = v && String(v).match(/(\d+)\D+(\d+)/); if (m) { e.repMin = +m[1]; e.repMax = +m[2]; save(); } render(); },
  exReplace: t => addExerciseModal(+t.dataset.i),
  exMove: t => { const i = +t.dataset.i, d = +t.dataset.d, a = S.active.exercises; [a[i], a[i + d]] = [a[i + d], a[i]]; save(); closeModal(); render(); },
  exRemove: t => { S.active.exercises.splice(+t.dataset.i, 1); save(); closeModal(); render(); },
  plates: t => { const e = S.active.exercises[+t.dataset.i]; const s = e.sets.find(x => !x.done) || e.sets[e.sets.length - 1]; let kg = s && s.w !== '' ? s.w : null; if (kg == null) { const row = $$(`.ex`)[+t.dataset.i]; const ph = row && row.querySelector('[data-in=w]'); kg = ph && ph.placeholder ? toKgU(parseFloat(ph.placeholder), ph.dataset.u || unit()) : null; } platesModal(kg); },
  restAdj: t => { if (!rest.end) return; rest.end += +t.dataset.d * 1000; rest.total = Math.max(rest.total + +t.dataset.d * 1000, 1000); tickRest(); },
  restSkip: () => stopRest(),
  openSess: t => openSession(t.dataset.id),
  editSess: t => editSession(t.dataset.id),
  repeatSess: t => { const s = S.sessions.find(x => x.id === t.dataset.id); closeModal(); startWorkout(s.templateId && tmpl(s.templateId) ? s.templateId : '', tmpl(s.templateId) ? null : s); },
  delSess: async t => { const id = t.dataset.id; if (!(await ask('Delete this session for good?', 'Delete', true))) return; S.sessions = S.sessions.filter(x => x.id !== id); save(); render(); },
  saveStepsToday: () => { const v = parseInt($('#stepsToday').value, 10); if (isNaN(v)) { delete S.steps[today()]; } else S.steps[today()] = v; save(); render(); toast(v >= S.settings.stepGoal ? `Goal hit. +${S.settings.xpStepDay} XP` : 'Steps saved'); },
  addSteps: () => { const d = $('#sDate').value, v = parseInt($('#sVal').value, 10); if (!d || isNaN(v)) return toast('Pick a date and enter steps'); S.steps[d] = v; save(); render(); toast('Steps saved'); },
  addWeight: () => {
    const d = $('#wDate').value, v = parseFloat($('#wKg').value); if (!d || isNaN(v)) return toast('Pick a date and enter kg');
    S.weights = S.weights.filter(x => x.date !== d); S.weights.push({ date: d, kg: v }); save(); render(); toast('Weigh-in logged');
  },
  delWeight: async t => { const d = t.dataset.d; if (!(await ask('Delete this weigh-in?', 'Delete', true))) return; S.weights = S.weights.filter(x => x.date !== d); save(); render(); },
  editTpl: t => templateModal(t.dataset.id),
  newTpl: () => templateModal(null),
  tpeAdd: () => { tplDraft.exercises.push(defEx('')); renderTplModal(!tmpl(tplDraft.id)); },
  tpeDel: t => { tplDraft.exercises.splice(+t.dataset.i, 1); renderTplModal(!tmpl(tplDraft.id)); },
  tpeMove: t => { const i = +t.dataset.i, d = +t.dataset.d, a = tplDraft.exercises; if (i + d < 0 || i + d >= a.length) return; [a[i], a[i + d]] = [a[i + d], a[i]]; renderTplModal(!tmpl(tplDraft.id)); },
  tplSave: () => {
    tplDraft.exercises = tplDraft.exercises.filter(e => e.name.trim());
    tplDraft.exercises.forEach(e => { e.name = e.name.trim(); if (!S.exTypes[e.name]) S.exTypes[e.name] = guessType(e.name); });
    const i = S.templates.findIndex(t => t.id === tplDraft.id);
    if (i >= 0) S.templates[i] = tplDraft; else S.templates.push(tplDraft);
    save(); closeModal(); render(); toast('Template saved');
  },
  tplDel: async () => { const id = tplDraft.id; if (!(await ask('Delete this template? Past sessions stay.', 'Delete', true))) return; S.templates = S.templates.filter(t => t.id !== id); save(); render(); },
  unit: t => { S.settings.unit = t.dataset.u; save(); settingsModal(); },
  export: async () => {
    const name = `motu-backup-${today()}.json`, text = JSON.stringify({ ...S, active: null }, null, 1);
    let ok = false;
    // On iPhone, the share sheet is the reliable way to save a file from a home-screen app
    try {
      const file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Motu backup' }); ok = true; }
    } catch (e) { if (e && e.name === 'AbortError') { toast('Backup not saved'); return; } }
    if (!ok) download(name, text, 'application/json');
    S.settings.lastBackup = today(); save();
    toast(ok ? 'Backup saved' : 'Backup downloaded'); if (tab === 'home' && $('#modal').hidden) render();
  },
  import: () => $('#importFile').click(),
  csv: () => {
    const rows = [['date', 'week', 'workout', 'exercise', 'set', 'weight_kg', 'reps', 'est_1rm_kg', 'volume_kg']];
    for (const s of sorted()) s.exercises.forEach(e => e.sets.forEach((x, j) => rows.push([s.date, weekNo(s.date), s.name, e.name, j + 1, trim(x.w), x.r, trim(e1rm(x.w, x.r)), trim(x.w * x.r)])));
    download(`motu-sets-${today()}.csv`, rows.map(r => r.map(c => /[",]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(',')).join('\n'), 'text/csv');
  },
  reset: async () => { if (!(await ask('Erase everything on this device and start fresh? If you are signed in, your account keeps its copy. Export a backup first if unsure.', 'Erase', true))) return; S = buildFresh(); save(); go('home'); onboard(); },
  askOk: () => { const i = $('#askIn'); const v = i ? i.value : true; const r = askResolve; askResolve = null; closeModal(); if (r) r(v); },
  askNo: () => closeModal()
};

document.addEventListener('click', e => {
  const tb = e.target.closest('#tabs button'); if (tb) { go(tb.dataset.tab); return; }
  if (e.target.closest('#resume')) { go('workout'); return; }
  const t = e.target.closest('[data-act]'); if (!t) return;
  if (t.tagName === 'DETAILS' || e.target.closest('summary')) return;
  const f = ACT[t.dataset.act]; if (f) { e.preventDefault(); f(t, e); }
});

const IN = {
  ob: t => { OB.d[t.dataset.k] = t.value; },
  pb: t => { pbDraft[t.dataset.k] = t.value; },
  pbd: t => { pbDraft.days[+t.dataset.d][t.dataset.k] = t.value; },
  pbe: t => { const x = pbDraft.days[+t.dataset.d].ex[+t.dataset.x], k = t.dataset.k; x[k] = k === 'name' ? t.value : (parseInt(t.value, 10) || 0); if (k === 'name') { const h = document.getElementById(`pbh-${t.dataset.d}-${t.dataset.x}`); if (h) h.innerHTML = homeHint(t.value); } },
  w: t => { const s = S.active.exercises[t.dataset.i].sets[t.dataset.j]; const v = parseFloat(t.value); s.w = t.value.trim() === '' || isNaN(v) ? '' : toKgU(v, t.dataset.u || unit()); saveSoon(); },
  r: t => { const s = S.active.exercises[t.dataset.i].sets[t.dataset.j]; const v = parseInt(t.value, 10); s.r = isNaN(v) ? '' : v; saveSoon(); },
  aname: t => { S.active.name = t.value; saveSoon(); },
  adate: t => { if (t.value) { S.active.date = t.value; saveSoon(); } },
  anote: t => { S.active.note = t.value; saveSoon(); },
  exnote: t => { S.active.exercises[t.dataset.i].note = t.value; saveSoon(); },
  stair: t => { S.active.stair[t.dataset.k] = t.value; saveSoon(); },
  exq: t => { exQuery = t.value; $('#exlist').innerHTML = exListHTML(allExerciseNames().filter(n => n.toLowerCase().includes(exQuery.toLowerCase()))); },
  addq: t => { const first = $('#addlist .pick'); $('#addlist').innerHTML = addListHTML(t.value, first && first.dataset.r != null ? first.dataset.r : undefined); },
  extype: t => { S.exTypes[t.dataset.name] = t.value; save(); },
  plates: () => calcPlates(),
  tpl: t => { const k = t.dataset.k; tplDraft[k] = k === 'day' ? (parseInt(t.value, 10) || 0) : t.value; },
  tpe: t => { const e = tplDraft.exercises[t.dataset.i], k = t.dataset.k; e[k] = k === 'optional' ? t.checked : k === 'name' ? t.value : (parseInt(t.value, 10) || 0); },
  setText: t => { S.settings[t.dataset.k] = t.value; saveSoon(); },
  set: t => { const k = t.dataset.k; S.settings[k] = k === 'startDate' ? (t.value ? mondayOf(t.value) : S.settings.startDate) : (parseFloat(t.value) || 0); saveSoon(); },
  milestones: t => { S.settings.milestones = t.value.split('\n').map(l => l.trim().split(/\s+/)).filter(p => /^\d{4}-\d\d-\d\d$/.test(p[0]) && !isNaN(+p[1])).map(p => [p[0], +p[1]]); saveSoon(); }
};
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.in; if (k && IN[k]) IN[k](e.target); });
document.addEventListener('change', e => {
  if (e.target.dataset && (e.target.dataset.in === 'tpe' && e.target.type === 'checkbox')) IN.tpe(e.target);
  if (e.target.id === 'importFile') {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(async txt => {
      const d = JSON.parse(txt);
      if (!d || !Array.isArray(d.sessions)) throw new Error('bad');
      if (!(await ask(`Replace everything here with this backup (${d.sessions.length} sessions)?`, 'Replace', true))) return;
      S = migrate(d); save(); go('home'); toast('Backup restored');
    }).catch(() => toast('That file is not a Motu backup'));
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'obName') { e.preventDefault(); ACT.obNext(); return; }
  if (e.key === 'Enter' && e.target.matches('.set .in')) { e.preventDefault(); const ins = [...document.querySelectorAll('.set .in')]; const n = ins[ins.indexOf(e.target) + 1]; n ? n.focus() : e.target.blur(); }
  if (e.key === 'Enter' && e.target.id === 'stepsToday') ACT.saveStepsToday();
});

/* ---------------- icons ---------------- */
const ICON = {
  gear: '<svg viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  fire: '<svg viewBox="0 0 24 24" class="fill"><path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 11 10.5 11C10.5 7 12 2 12 2Z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7.5"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  dots: '<svg viewBox="0 0 24 24" class="fill"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  swap: '<svg viewBox="0 0 24 24"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>'
};

/* ---------------- boot ---------------- */
readGift();
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#gift=')) { readGift(); if (S.fresh) onboard(); else giftOffer(); } });
render();
if (S.active) wake();
splash();
onboard();
giftOffer();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
