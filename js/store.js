// Everything lives in this browser's localStorage. Nothing is sent anywhere except
// the source files you choose to send to Anthropic when you build lessons from them.

const KEY = 'studyhub.v1';
const API_KEY = 'studyhub.anthropicKey'; // kept apart so backups never include it

export const defaultState = () => ({
  version: 1,
  profile: null, // {name, certification, examDate, hoursPerDay, style}
  pack: null, // the study content: {title, sample, domains, lessons, questions, flashcards, sources}
  diagnostic: null, // {takenAt, answers: {questionId: true|false}}
  progress: {answers: {}, cards: {}, lessonsDone: {}, days: {}},
  settings: {model: 'claude-opus-5-5', theme: 'auto'},
});

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

export function load() {
  const raw = safeGet(KEY);
  if (!raw) return defaultState();
  try {
    const saved = JSON.parse(raw);
    const base = defaultState();
    return {...base, ...saved, progress: {...base.progress, ...saved.progress}, settings: {...base.settings, ...saved.settings}};
  } catch {
    return defaultState();
  }
}

export function save(state) {
  if (!safeSet(KEY, JSON.stringify(state))) {
    alert('Your browser would not save progress. Storage may be full or blocked (private window).');
  }
}

export const getApiKey = () => (safeGet(API_KEY) || '').trim();
export const setApiKey = key => (key ? safeSet(API_KEY, key.trim()) : (() => { try { localStorage.removeItem(API_KEY); } catch {} })());

export function exportBackup(state) {
  return new Blob([JSON.stringify({app: 'open-study-hub', exportedAt: new Date().toISOString(), state}, null, 2)], {type: 'application/json'});
}

export function importBackup(text) {
  const data = JSON.parse(text);
  if (data?.app !== 'open-study-hub' || !data.state) throw new Error('This file is not a Study Hub backup.');
  return sanitizeState({...defaultState(), ...data.state});
}

// A backup is a file someone could hand you, so nothing in it is trusted. Every id must be plain
// letters, digits, - or _, every setting must be one the app offers, and text must be text.
// Anything else is dropped before the hub ever shows it.
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const text = (v, max = 4000) => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, max) : '');
const list = v => (Array.isArray(v) ? v : []);
const dict = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export function sanitizePack(pack) {
  if (!pack || typeof pack !== 'object') return null;
  const domains = list(pack.domains).filter(d => ID.test(d?.id)).map(d => ({id: d.id, name: text(d.name, 120), weight: Math.min(5, Math.max(1, Math.round(+d.weight) || 2))}));
  const known = new Set(domains.map(d => d.id));
  const inDomain = x => ID.test(x?.id) && known.has(x.domain);
  const part = p => ({label: text(p?.label, 120), detail: text(p?.detail, 400)});
  return {
    title: text(pack.title, 120) || 'My study hub',
    sample: Boolean(pack.sample),
    domains,
    lessons: list(pack.lessons).filter(inDomain).map(l => ({
      id: l.id, domain: l.domain, source: text(l.source, 200), title: text(l.title, 200), summary: text(l.summary, 600),
      keyPoints: list(l.keyPoints).map(k => text(k, 600)), body: list(l.body).map(b => text(b)),
      visual: {kind: text(l.visual?.kind, 20), caption: text(l.visual?.caption, 300), parts: list(l.visual?.parts).slice(0, 6).map(part), scene: l.visual?.scene && typeof l.visual.scene === 'object' ? l.visual.scene : null},
    })),
    questions: list(pack.questions).filter(inDomain).map(q => ({
      id: q.id, domain: q.domain, source: text(q.source, 200), stem: text(q.stem, 1000), choices: list(q.choices).slice(0, 6).map(c => text(c, 400)),
      answer: Number.isInteger(q.answer) ? q.answer : 0, explanation: text(q.explanation, 1500),
    })).filter(q => q.choices.length >= 2 && q.answer < q.choices.length),
    flashcards: list(pack.flashcards).filter(inDomain).map(c => ({id: c.id, domain: c.domain, source: text(c.source, 200), front: text(c.front, 400), back: text(c.back, 1000)})),
    sources: list(pack.sources).map(x => ({name: text(x?.name, 200), addedAt: text(x?.addedAt, 40)})),
  };
}

export function sanitizeState(state) {
  const base = defaultState();
  const p = dict(state.profile);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.examDate) ? p.examDate : null;
  const profile = date ? {
    name: text(p.name, 80), certification: text(p.certification, 120), examDate: date,
    hoursPerDay: Math.min(12, Math.max(0.25, +p.hoursPerDay || 1)), style: ['visual', 'reading', 'practice', 'mixed'].includes(p.style) ? p.style : 'mixed',
  } : null;
  const s = dict(state.settings);
  const settings = {
    model: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'].includes(s.model) ? s.model : base.settings.model,
    theme: ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto',
    sidebarHidden: Boolean(s.sidebarHidden),
  };
  const pr = dict(state.progress);
  const keep = (obj, test) => Object.fromEntries(Object.entries(dict(obj)).filter(([k]) => test(k)));
  const progress = {
    answers: Object.fromEntries(Object.entries(keep(pr.answers, k => ID.test(k))).map(([k, v]) => [k, list(v).map(a => ({at: text(a?.at, 10), correct: Boolean(a?.correct)}))])),
    cards: Object.fromEntries(Object.entries(keep(pr.cards, k => ID.test(k))).map(([k, v]) => [k, {box: Math.min(5, Math.max(0, +v?.box || 0)), due: text(v?.due, 10), seen: +v?.seen || 0}])),
    lessonsDone: keep(pr.lessonsDone, k => ID.test(k)),
    days: keep(pr.days, k => /^\d{4}-\d{2}-\d{2}$/.test(k)),
    bookmarks: Object.fromEntries(Object.entries(dict(pr.bookmarks)).filter(([, m]) => ['lesson', 'question', 'card'].includes(m?.type) && ID.test(m?.id)).map(([, m]) => [`${m.type}:${m.id}`, {type: m.type, id: m.id, at: text(m.at, 40)}])),
  };
  const d = dict(state.diagnostic);
  const diagnostic = state.diagnostic ? {takenAt: text(d.takenAt, 10), answers: Object.fromEntries(Object.entries(keep(d.answers, k => ID.test(k))).map(([k, v]) => [k, Boolean(v)]))} : null;
  return {version: 1, profile, pack: sanitizePack(state.pack), diagnostic, progress, settings};
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch {}
}
