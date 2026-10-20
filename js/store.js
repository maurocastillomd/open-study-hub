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
  return {...defaultState(), ...data.state};
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch {}
}
