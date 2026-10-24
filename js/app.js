import {load, save, getApiKey, setApiKey, exportBackup, importBackup, reset, defaultState} from './store.js';
import {buildPlan, domainStrength, isoDate, addDays, daysBetween, questionsFor} from './planner.js';
import {review, dueCards, mastered} from './cards.js';
import {MODELS, MAX_FILE_BYTES, buildRequest, streamMessage, mergePack, readFileForRequest} from './generate.js';
import {samplePack} from '../content/sample-pack.js';
import {mountFigure} from './figures.js';
import {searchPack} from './search.js';

let state = load();
if (!state.pack) state.pack = structuredClone(samplePack);
let session = null; // the quiz or card round in progress (not saved)
let building = null; // source upload in progress
const app = document.getElementById('app');

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const today = () => isoDate();
const persist = () => save(state);
const domainName = id => state.pack.domains.find(d => d.id === id)?.name || 'All areas';
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pct = v => v == null ? '–' : `${Math.round(v * 100)}%`;
const fmtDate = iso => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
const STYLES = {
  visual: ['Visual', 'Pictures and diagrams first'],
  reading: ['Reading', 'Clear written explanations first'],
  practice: ['Practice', 'Questions and scenarios first'],
  mixed: ['Mixed', 'A balance of all three'],
};
const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  learn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22.5zM20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5a2.5 2.5 0 0 1 2.5 2.5z"/></svg>',
  practice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.5 2.5 2.5 5-5.5"/></svg>',
  sources: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M4.5 15v3A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-3"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M9.5 4.5v15"/></svg>',
  sun: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>',
  bookmarked: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="currentColor" stroke-width="1.8"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',
  learnBlock: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H3zM21 5.5A1.5 1.5 0 0 0 19.5 4H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z"/></svg>',
  cardsBlock: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/></svg>',
  practiceBlock: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4.5 4.5L19 7"/></svg>',
};

const resolvedTheme = () => state.settings.theme !== 'auto' ? state.settings.theme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

function strength() { return domainStrength(state.pack, state.diagnostic, state.progress.answers); }
function plan() {
  const p = state.profile;
  return buildPlan({today: today(), examDate: p.examDate, hoursPerDay: p.hoursPerDay, style: p.style, domains: state.pack.domains, strength: strength()});
}
function markStudied(kind, minutes = 0) {
  const d = state.progress.days[today()] || (state.progress.days[today()] = {done: [], minutes: 0});
  if (kind && !d.done.includes(kind)) d.done.push(kind);
  d.minutes += minutes;
  persist();
}
// ---------- bookmarks ----------
const bookmarks = () => state.progress.bookmarks || (state.progress.bookmarks = {});
const isMarked = (type, id) => Boolean(bookmarks()[`${type}:${id}`]);
function toggleBookmark(type, id) {
  const key = `${type}:${id}`;
  if (bookmarks()[key]) delete bookmarks()[key];
  else bookmarks()[key] = {type, id, at: new Date().toISOString()};
  persist();
}
const markButton = (type, id, label) => {
  const on = isMarked(type, id);
  return `<button class="icon-btn mark-btn${on ? ' on' : ''}" data-action="bookmark" data-type="${type}" data-id="${esc(id)}" aria-pressed="${on}" aria-label="${on ? 'Remove bookmark' : `Bookmark this ${label}`}" title="${on ? 'Remove bookmark' : 'Bookmark'}">${on ? ICONS.bookmarked : ICONS.bookmark}</button>`;
};

function streak() {
  let n = 0;
  let day = today();
  if (!state.progress.days[day]) day = addDays(day, -1);
  while (state.progress.days[day]) { n++; day = addDays(day, -1); }
  return n;
}

// ---------- shell ----------
const TABS = [['today', 'Today'], ['learn', 'Learn'], ['practice', 'Practice'], ['sources', 'Sources'], ['progress', 'Progress']];

let searchQuery = '';
function shell(active, content) {
  const p = state.profile;
  const dark = resolvedTheme() === 'dark';
  const hidden = Boolean(state.settings.sidebarHidden);
  const marks = Object.keys(bookmarks()).length;
  const left = Math.max(0, daysBetween(today(), p.examDate));
  return `<div class="layout${hidden ? ' side-hidden' : ''}">
    <aside class="sidebar" id="sidebar" ${hidden ? 'aria-hidden="true"' : ''}>
      <div class="brand">Study Hub</div>
      <div class="brand-sub">${esc(p.certification)}</div>
      <nav class="nav" aria-label="Main">
        ${TABS.map(([id, label]) => `<a href="#${id}" ${active === id ? 'aria-current="page"' : ''}>${ICONS[id]}<span>${label}</span></a>`).join('')}
      </nav>
      <div class="side-bottom">
        <button class="btn ghost" data-action="settings" style="justify-content:flex-start">${ICONS.gear} Settings</button>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="controls" role="group" aria-label="Display">
          <button class="icon-btn desk-only" data-action="toggle-sidebar" aria-controls="sidebar" aria-expanded="${!hidden}" aria-label="${hidden ? 'Show menu' : 'Hide menu'}" title="${hidden ? 'Show menu' : 'Hide menu'}">${ICONS.menu}</button>
          <span class="brand phone-only">Study Hub</span>
          <button class="icon-btn" data-action="toggle-theme" aria-pressed="${dark}" aria-label="${dark ? 'Switch to day mode' : 'Switch to night mode'}" title="${dark ? 'Day mode' : 'Night mode'}">${dark ? ICONS.sun : ICONS.moon}</button>
          <a class="icon-btn mark-link${active === 'bookmarks' ? ' current' : ''}" href="#bookmarks" aria-label="Open bookmarks${marks ? ` (${marks})` : ''}" title="Bookmarks">${ICONS.bookmark}${marks ? `<span class="count" aria-hidden="true">${marks}</span>` : ''}</a>
          <button class="icon-btn phone-only" data-action="settings" aria-label="Settings">${ICONS.gear}</button>
        </div>
        <label class="search">
          <span class="sr-only">Search lessons, questions and flashcards</span>
          ${ICONS.search}
          <input id="search" type="search" placeholder="Search lessons, questions and cards…" autocomplete="off" enterkeyhint="search" value="${esc(searchQuery)}">
        </label>
        <span class="meta eyebrow desk-only">${left ? `Exam in ${left} day${left === 1 ? '' : 's'}` : 'Exam day'}</span>
      </header>
      <main id="main" tabindex="-1">${content}</main>
    </div>
  </div>`;
}

// ---------- setup ----------
function setupView() {
  const p = state.profile || {};
  const min = today();
  return `<div class="setup">
    <p class="eyebrow">Free and private. Your progress stays in this browser.</p>
    <h1>${state.profile ? 'Your study profile' : 'Let\'s build your study plan'}</h1>
    <p class="lede">Five quick answers. The hub uses them to pace your plan and choose how lessons are shown.</p>
    <form id="setup-form">
      <label class="field">Your name
        <input name="name" required autocomplete="given-name" value="${esc(p.name)}" placeholder="First name">
      </label>
      <label class="field">Certification or exam
        <input name="certification" required value="${esc(p.certification)}" placeholder="For example: CSCS, PMP, Step 1">
      </label>
      <label class="field">Exam date
        <input name="examDate" type="date" required min="${min}" value="${esc(p.examDate || addDays(min, 42))}">
      </label>
      <label class="field">Hours you can study each day: <output id="hours-out">${p.hoursPerDay || 1.5}</output>
        <input name="hoursPerDay" type="range" min="0.5" max="6" step="0.5" value="${p.hoursPerDay || 1.5}">
        <span class="hint">Be realistic. A plan you can keep beats an ambitious one you drop.</span>
      </label>
      <fieldset style="border:0;padding:0;margin:0">
        <legend class="field" style="font-weight:600;font-size:14px;margin-bottom:8px">How do you learn best?</legend>
        <div class="styles">
          ${Object.entries(STYLES).map(([id, [label, hint]]) => `<label class="style-option"><input type="radio" name="style" value="${id}" ${(p.style || 'visual') === id ? 'checked' : ''} required><span><b>${label}</b><span class="small muted">${hint}</span></span></label>`).join('')}
        </div>
      </fieldset>
      <div class="row">
        <button class="btn primary" type="submit">${state.profile ? 'Save and update my plan' : 'Build my plan'}</button>
        ${state.profile ? '<a class="btn ghost" href="#today">Cancel</a>' : ''}
      </div>
    </form>
  </div>`;
}

function bindSetup() {
  const form = document.getElementById('setup-form');
  form.hoursPerDay.addEventListener('input', () => { document.getElementById('hours-out').textContent = form.hoursPerDay.value; });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const first = !state.profile;
    state.profile = {
      name: form.name.value.trim(), certification: form.certification.value.trim(),
      examDate: form.examDate.value, hoursPerDay: Number(form.hoursPerDay.value), style: form.style.value,
    };
    persist();
    location.hash = first ? '#diagnostic' : '#today';
    render();
  });
}

// ---------- today ----------
function todayView() {
  const p = state.profile;
  const pl = plan();
  const d = pl.days[0];
  const done = state.progress.days[today()]?.done || [];
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const due = dueCards(state.pack.flashcards, state.progress.cards, today()).length;
  const blockText = b => {
    if (b.kind === 'learn') return [`Learn: ${domainName(b.domain)}`, `${b.minutes} min of lessons`];
    if (b.kind === 'cards') return ['Flashcards', b.note || `${b.minutes} min · ${due} card${due === 1 ? '' : 's'} due`];
    const available = state.pack.questions.filter(q => [b.domain, b.mixWith].includes(q.domain)).length;
    return [`Practice: ${domainName(b.domain)}${b.mixWith ? ` + ${domainName(b.mixWith)}` : ''}`, `${Math.min(available, questionsFor(b.minutes))} questions · ${b.minutes} min`];
  };
  const examPassed = pl.daysLeft <= 0;
  return `
    <p class="eyebrow">${fmtDate(today())}</p>
    <h1>${hello}, ${esc(p.name)}.</h1>
    ${state.pack.sample ? `<p class="notice">You are using the sample lessons. <a href="#sources">Upload your own sources</a> and the hub rebuilds around them.</p>` : ''}
    <div class="grid-2" style="margin-top:20px">
      <section class="card hero">
        <div class="row between">
          <h2 style="margin:0">Today's plan</h2>
          <span class="badge">${d.phase === 'review' ? 'Final week: review' : d.phase === 'taper' ? 'Day before: rest' : examPassed ? 'Exam day' : 'Build phase'}</span>
        </div>
        <div style="margin-top:8px">
          ${d.blocks.map((b, i) => {
            const [title, sub] = blockText(b);
            const isDone = done.includes(b.kind);
            return `<div class="block ${isDone ? 'done' : ''}">
              <span class="dot" aria-hidden="true">${ICONS[`${b.kind}Block`]}</span>
              <div><div class="block-title">${esc(title)}</div><div class="small muted">${esc(sub)}</div></div>
              <button class="btn ${isDone ? 'ghost' : 'primary'}" data-action="start-block" data-i="${i}">${isDone ? 'Again' : 'Start'}</button>
            </div>`;
          }).join('')}
        </div>
      </section>
      <section class="card">
        <p class="eyebrow">${esc(p.certification)}</p>
        <div class="countdown"><span class="stat">${Math.max(0, pl.daysLeft)}</span><span class="muted">day${pl.daysLeft === 1 ? '' : 's'} to go</span></div>
        <p class="small muted">${fmtDate(p.examDate)} · ${esc(p.hoursPerDay)} h a day · ${esc((STYLES[p.style] || STYLES.mixed)[0])} learner</p>
        <div class="row" style="gap:18px;margin-top:10px">
          <div><div class="stat" style="font-size:26px">${streak()}</div><div class="small muted">day streak</div></div>
          <div><div class="stat" style="font-size:26px">${due}</div><div class="small muted">cards due</div></div>
        </div>
      </section>
    </div>
    ${state.diagnostic ? '' : `<section class="card" style="margin-top:18px">
      <h2 style="margin-top:0">Take the quick check first</h2>
      <p class="muted">A short quiz across every area. Your plan then gives more time to your weak spots.</p>
      <a class="btn primary" href="#diagnostic">Start the quick check</a>
    </section>`}
    <h2>Next 7 days</h2>
    <div class="week">${pl.days.slice(0, 7).map((day, i) => `<div class="${i === 0 ? 'today' : ''}">
      <strong>${new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {weekday: 'short'})}</strong>
      ${day.phase === 'taper' ? 'Rest and light review' : day.phase === 'exam' ? 'Exam' : esc(domainName(day.focus))}
    </div>`).join('')}</div>
    <h2>Where your time goes</h2>
    <p class="small muted">Areas with more exam weight and lower scores get more days.</p>
    <div class="stack">${[...state.pack.domains].sort((a, b) => pl.priority[b.id] - pl.priority[a.id]).map(dm => `
      <div><div class="row between small"><span>${esc(dm.name)}</span><span class="muted">${Math.round(pl.priority[dm.id] * 100)}% of study time</span></div>
      <div class="meter"><span style="width:${Math.round(pl.priority[dm.id] * 100)}%"></span></div></div>`).join('')}</div>`;
}

function startBlock(i) {
  const block = plan().days[0].blocks[i];
  if (block.kind === 'learn') {
    const lessons = state.pack.lessons.filter(l => l.domain === block.domain);
    const next = lessons.find(l => !state.progress.lessonsDone[l.id]) || lessons[0];
    markStudied(null);
    sessionStorage.setItem('studyhub.block', 'learn');
    location.hash = next ? `#learn/${next.id}` : '#learn';
  } else if (block.kind === 'cards') {
    startCards(null, 'cards');
  } else {
    startQuiz({domains: [block.domain, block.mixWith].filter(Boolean), count: questionsFor(block.minutes), block: 'practice'});
  }
}

// ---------- learn ----------
function learnView() {
  const done = state.progress.lessonsDone;
  const s = strength();
  return `<p class="eyebrow">${esc(state.pack.title)}</p><h1>Learn</h1>
    <p class="lede">${plural(state.pack.lessons.length, 'lesson')} across ${plural(state.pack.domains.length, 'area')}. Each one opens with a picture of its main idea.</p>
    ${state.pack.domains.map(dm => {
      const lessons = state.pack.lessons.filter(l => l.domain === dm.id);
      if (!lessons.length) return '';
      return `<h2>${esc(dm.name)} <span class="badge ${s[dm.id] != null && s[dm.id] < 0.6 ? 'warn' : ''}">${s[dm.id] == null ? 'not checked yet' : `${pct(s[dm.id])} correct`}</span></h2>
      <div class="grid-cards">${lessons.map(l => `<a class="lesson-link" href="#learn/${esc(l.id)}"><div class="card">
        <span class="eyebrow">${done[l.id] ? '✓ Done' : visualLabel(l.visual?.kind)}</span>
        <h3>${esc(l.title)}</h3><p class="small muted" style="margin:0">${esc(l.summary)}</p></div></a>`).join('')}</div>`;
    }).join('')}`;
}
const visualLabel = k => ({steps: 'Process', cycle: 'Cycle', compare: 'Comparison', layers: 'Layers'}[k] || 'Lesson');

// The lesson picture is a small machine drawn with the Anatomy kit (js/figures.js).
// Under it, a numbered list of the parts; the picked part is lit in the drawing.
function figureShell(l, idx, hideDetails) {
  const v = l.visual;
  if (!v?.parts?.length) return '';
  const parts = v.parts.slice(0, 6);
  return `<figure class="lesson-figure iso" data-theme="${resolvedTheme()}" data-reveal="${hideDetails ? 'one' : 'all'}">
    <div class="iso-plate">
      <div class="iso-plate-corners" aria-hidden="true">
        <span class="iso-plate-corner" data-corner="fig">Lesson ${idx + 1}</span>
        <span class="iso-plate-corner" data-corner="title" id="figure-title"></span>
        <span class="iso-plate-corner" data-corner="hint">Tap a part</span>
        <span class="iso-plate-corner" data-corner="readout" id="figure-readout"></span>
      </div>
      <div id="lesson-figure"></div>
    </div>
    <ol class="figure-parts" id="figure-parts">${parts.map((p, i) => `<li><button type="button" data-action="pick-part" data-i="${i}" aria-pressed="${i === 0}">
      <span class="num">${String(i + 1).padStart(2, '0')}</span><span><b>${esc(p.label)}</b><span class="detail">${esc(p.detail)}</span></span></button></li>`).join('')}</ol>
    ${v.caption ? `<figcaption class="small muted">${esc(v.caption)}</figcaption>` : ''}
  </figure>`;
}

let liveFigure = null;
function mountLessonFigure(l) {
  liveFigure?.destroy();
  liveFigure = null;
  const host = document.getElementById('lesson-figure');
  if (!host) return;
  const readout = document.getElementById('figure-readout');
  const buttons = [...document.querySelectorAll('[data-action="pick-part"]')];
  const show = i => {
    readout.textContent = `${liveFigure ? liveFigure.reading(i) : ''}`;
    buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
  };
  // A visual learner picks the parts in turn; everyone else sees a slow tour that stops on a tap.
  liveFigure = mountFigure(host, l.visual, {onSelect: show, tour: state.profile.style !== 'visual'});
  document.getElementById('figure-title').textContent = liveFigure.title;
  show(0);
}

function lessonView(id) {
  const l = state.pack.lessons.find(x => x.id === id);
  if (!l) return learnView();
  const style = state.profile.style;
  const list = state.pack.lessons;
  const idx = list.indexOf(l);
  const next = list[idx + 1];
  const visual = figureShell(l, idx, style === 'visual');
  const reading = `<div class="prose">${l.body.map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
  const points = `<h2>Key points</h2><ul class="points">${l.keyPoints.map(k => `<li>${esc(k)}</li>`).join('')}</ul>`;
  const related = state.pack.questions.filter(q => q.domain === l.domain).length;
  const order = style === 'reading' ? [reading, visual, points] : style === 'practice' ? [points, visual, reading] : [visual, reading, points];
  return `<a href="#learn" class="small">← All lessons</a>
    <p class="eyebrow" style="margin-top:18px">${esc(domainName(l.domain))} · Lesson ${idx + 1} of ${list.length}</p>
    <div class="title-row"><h1>${esc(l.title)}</h1>${markButton('lesson', l.id, 'lesson')}</div>
    <p class="lede">${esc(l.summary)}</p>
    ${order.join('')}
    <div class="row" style="margin-top:28px">
      <button class="btn primary" data-action="lesson-done" data-id="${esc(l.id)}">${state.progress.lessonsDone[l.id] ? '✓ Done' : 'Mark as done'}</button>
      ${related ? `<button class="btn" data-action="quiz-domain" data-domain="${l.domain}">Practice this area</button>` : ''}
      ${next ? `<a class="btn ghost" href="#learn/${esc(next.id)}">Next: ${esc(next.title)} →</a>` : ''}
    </div>
    ${l.source ? `<p class="small muted" style="margin-top:24px">Built from your source: ${esc(l.source)}</p>` : ''}`;
}

// ---------- practice ----------
function practiceView() {
  const s = strength();
  const due = dueCards(state.pack.flashcards, state.progress.cards, today()).length;
  const weakest = [...state.pack.domains].sort((a, b) => (s[a.id] ?? 0.5) - (s[b.id] ?? 0.5))[0];
  return `<h1>Practice</h1>
    <p class="lede">Questions show you what you know. Flashcards keep it there.</p>
    <div class="grid-cards">
      <div class="card"><h3>Weakest area first</h3><p class="small muted">${esc(weakest?.name || '')}</p><button class="btn primary" data-action="quiz-weak">Start 10 questions</button></div>
      <div class="card"><h3>Mixed set</h3><p class="small muted">Every area, shuffled together.</p><button class="btn" data-action="quiz-mixed">Start 15 questions</button></div>
      <div class="card"><h3>Flashcards</h3><p class="small muted">${due} due today · ${state.pack.flashcards.length} total</p><button class="btn" data-action="cards-due" ${due ? '' : 'disabled'}>Review due cards</button></div>
    </div>
    <h2>By area</h2>
    <div class="stack">${state.pack.domains.map(dm => {
      const nq = state.pack.questions.filter(q => q.domain === dm.id).length;
      const nc = state.pack.flashcards.filter(c => c.domain === dm.id).length;
      return `<div class="card row between" style="padding:14px 18px"><div><b>${esc(dm.name)}</b><div class="small muted">${nq} questions · ${nc} cards · ${s[dm.id] == null ? 'not checked yet' : `${pct(s[dm.id])} correct`}</div></div>
        <div class="row"><button class="btn" data-action="quiz-domain" data-domain="${esc(dm.id)}" ${nq ? '' : 'disabled'}>Questions</button><button class="btn" data-action="cards-domain" data-domain="${esc(dm.id)}" ${nc ? '' : 'disabled'}>Cards</button></div></div>`;
    }).join('')}</div>
    <p class="small muted" style="margin-top:20px"><a href="#diagnostic">Retake the quick check</a> to reset where your plan puts the most time.</p>`;
}

function pickQuestions(domains, count) {
  const pool = state.pack.questions.filter(q => !domains.length || domains.includes(q.domain));
  // Unseen and previously missed questions come first.
  const score = q => {
    const a = state.progress.answers[q.id];
    if (!a) return 0;
    return a[a.length - 1].correct ? 2 : 1;
  };
  return shuffle(pool).sort((a, b) => score(a) - score(b)).slice(0, count).map(q => q.id);
}

function startQuiz({domains = [], count = 10, block = null, diagnostic = false, ids: chosen = null}) {
  const ids = chosen || (diagnostic ? diagnosticQuestions() : pickQuestions(domains, count));
  if (!ids.length) { alert('There are no questions for this area yet.'); return; }
  // Answer order is shuffled each round so the right answer's position teaches nothing.
  const order = Object.fromEntries(ids.map(id => [id, shuffle(state.pack.questions.find(q => q.id === id).choices.map((_, i) => i))]));
  session = {type: 'quiz', ids, order, i: 0, picked: null, right: 0, block, diagnostic, startedAt: Date.now(), results: {}};
  location.hash = diagnostic ? '#diagnostic/run' : '#practice/run';
  render();
}

function diagnosticQuestions() {
  // Two questions per area, at most 12, so the check takes about ten minutes.
  const perDomain = Math.max(1, Math.min(3, Math.floor(12 / Math.max(1, state.pack.domains.length))));
  return state.pack.domains.flatMap(d => shuffle(state.pack.questions.filter(q => q.domain === d.id)).slice(0, perDomain).map(q => q.id)).slice(0, 12);
}

function quizView() {
  if (!session || session.type !== 'quiz') return session === null && location.hash.startsWith('#diagnostic') ? diagnosticIntro() : practiceView();
  const q = state.pack.questions.find(x => x.id === session.ids[session.i]);
  const answered = session.picked != null;
  const total = session.ids.length;
  return `<div class="row between"><p class="eyebrow">${session.diagnostic ? 'Quick check' : 'Practice'} · ${esc(domainName(q.domain))}</p>
      <span class="row">${session.diagnostic ? '' : markButton('question', q.id, 'question')}<button class="btn ghost" data-action="end-session">End</button></span></div>
    <div class="progress-line"><span style="width:${(session.i / total) * 100}%"></span></div>
    <p class="small muted">Question ${session.i + 1} of ${total}</p>
    <div class="question">${esc(q.stem)}</div>
    <div class="choices">${session.order[q.id].map((i, pos) => {
      const cls = answered ? (i === q.answer ? 'right' : i === session.picked ? 'wrong' : '') : '';
      return `<button class="choice ${cls}" data-action="pick" data-i="${i}" ${answered ? 'disabled' : ''}><span class="letter">${'ABCDEF'[pos]}</span><span>${esc(q.choices[i])}</span></button>`;
    }).join('')}</div>
    ${answered ? `<div class="feedback ${session.picked === q.answer ? '' : 'bad'}">
      <b>${session.picked === q.answer ? 'Correct.' : `Not quite. The answer is ${'ABCDEF'[session.order[q.id].indexOf(q.answer)]}.`}</b> ${esc(q.explanation)}</div>
      <div class="row" style="margin-top:16px"><button class="btn primary" data-action="next-q" autofocus>${session.i + 1 < total ? 'Next question' : 'See results'}</button></div>` : ''}`;
}

function pick(i) {
  const q = state.pack.questions.find(x => x.id === session.ids[session.i]);
  session.picked = i;
  const correct = i === q.answer;
  if (correct) session.right++;
  session.results[q.id] = correct;
  if (!session.diagnostic) {
    (state.progress.answers[q.id] || (state.progress.answers[q.id] = [])).push({at: today(), correct});
    persist();
  }
  render();
}

function nextQuestion() {
  session.i++;
  session.picked = null;
  if (session.i >= session.ids.length) return finishQuiz();
  render();
}

function finishQuiz() {
  const minutes = Math.round((Date.now() - session.startedAt) / 60000);
  if (session.diagnostic) state.diagnostic = {takenAt: today(), answers: session.results};
  markStudied(session.block, minutes);
  session = {type: 'result', right: session.right, total: session.ids.length, diagnostic: session.diagnostic, results: session.results};
  render();
}

function resultView() {
  const r = session;
  const s = strength();
  const byDomain = {};
  for (const [qid, ok] of Object.entries(r.results)) {
    const d = state.pack.questions.find(q => q.id === qid)?.domain;
    const t = byDomain[d] || (byDomain[d] = {right: 0, total: 0});
    t.total++; if (ok) t.right++;
  }
  return `<p class="eyebrow">${r.diagnostic ? 'Quick check complete' : 'Round complete'}</p>
    <h1>${r.right} of ${r.total} correct</h1>
    ${r.diagnostic ? '<p class="lede">Your plan now gives more time to the areas below that scored lowest.</p>' : ''}
    <div class="card"><div class="bars">${Object.entries(byDomain).map(([d, t]) => `
      <div class="bar-row"><span>${esc(domainName(d))}</span><div class="bar-track"><span class="now" style="width:${(t.right / t.total) * 100}%"></span></div><b>${t.right}/${t.total}</b></div>`).join('')}</div></div>
    <div class="row" style="margin-top:20px"><a class="btn primary" href="#today" data-action="clear-session">${r.diagnostic ? 'See my plan' : 'Back to today'}</a>
      ${r.diagnostic ? '' : '<a class="btn" href="#practice" data-action="clear-session">More practice</a>'}</div>`;
}

function diagnosticIntro() {
  const n = diagnosticQuestions().length;
  return `<p class="eyebrow">Step 2 of 2</p><h1>Quick check</h1>
    <p class="lede">${n} questions across every area. There is no score to pass. It only shows the hub where to spend your time.</p>
    ${state.pack.sample ? '<p class="notice">These questions come from the sample lessons. After you upload your own sources, retake the check from Practice.</p>' : ''}
    <div class="row"><button class="btn primary" data-action="start-diagnostic">Start the quick check</button><a class="btn ghost" href="#today">Skip for now</a></div>`;
}

// ---------- flashcards ----------
function startCards(domain, block = null, only = null) {
  let cards = only ? state.pack.flashcards.filter(c => only.includes(c.id)) : dueCards(state.pack.flashcards, state.progress.cards, today(), domain);
  if (!cards.length && domain) cards = state.pack.flashcards.filter(c => c.domain === domain);
  if (!cards.length) { alert('No cards are due. Nice work.'); markStudied(block); render(); return; }
  session = {type: 'cards', ids: shuffle(cards).slice(0, 40).map(c => c.id), i: 0, flipped: false, knew: 0, block, startedAt: Date.now()};
  location.hash = '#practice/cards';
  render();
}

function cardsView() {
  if (!session || session.type !== 'cards') return practiceView();
  if (session.i >= session.ids.length) {
    return `<p class="eyebrow">Cards complete</p><h1>${session.knew} of ${session.ids.length} recalled</h1>
      <p class="lede">Cards you missed come back tomorrow. Cards you knew come back later each time.</p>
      <div class="row"><a class="btn primary" href="#today" data-action="clear-session">Back to today</a></div>`;
  }
  const c = state.pack.flashcards.find(x => x.id === session.ids[session.i]);
  return `<div class="row between"><p class="eyebrow">Flashcards · ${esc(domainName(c.domain))}</p><span class="row">${markButton('card', c.id, 'flashcard')}<button class="btn ghost" data-action="end-session">End</button></span></div>
    <div class="progress-line"><span style="width:${(session.i / session.ids.length) * 100}%"></span></div>
    <button class="card flashcard" data-action="flip" style="width:100%" aria-label="${session.flipped ? 'Card answer' : 'Show the answer'}">
      <div><div>${esc(c.front)}</div>${session.flipped ? `<div class="back-text">${esc(c.back)}</div>` : '<div class="small muted" style="margin-top:14px">Recall it, then tap to check</div>'}</div>
    </button>
    ${session.flipped ? `<div class="row" style="margin-top:16px;justify-content:center">
      <button class="btn" data-action="card-grade" data-knew="0">Not yet</button>
      <button class="btn primary" data-action="card-grade" data-knew="1">I knew it</button></div>` : ''}`;
}

function gradeCard(knew) {
  const id = session.ids[session.i];
  state.progress.cards[id] = review(state.progress.cards[id], knew, today());
  if (knew) session.knew++;
  session.i++;
  session.flipped = false;
  if (session.i >= session.ids.length) markStudied(session.block, Math.round((Date.now() - session.startedAt) / 60000));
  persist();
  render();
}

// ---------- sources ----------
function sourcesView() {
  const key = getApiKey();
  const pack = state.pack;
  return `<h1>Sources</h1>
    <p class="lede">Upload your study guide, notes or textbook chapters. The hub reads them and builds lessons, questions and flashcards, then re-plans your days.</p>
    ${key ? '' : `<p class="notice">Building from sources needs your own Anthropic API key. <button class="btn" data-action="settings" style="min-height:34px;padding:4px 12px;margin-left:6px">Add it in Settings</button></p>`}
    <section class="card" style="margin-top:16px">
      <div class="drop" id="drop">
        <p><b>Drop PDF, text or Markdown files here</b></p>
        <p class="small muted">Up to 30 MB each. Long books work best split into chapters.</p>
        <label class="btn">Choose files<input type="file" id="file-input" accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown" multiple class="sr-only"></label>
      </div>
      <ul class="file-list" id="queue">${(building?.files || []).map((f, i) => `<li><span>${esc(f.name)}</span><span class="muted">${esc(building.status[i] || 'Waiting')}</span></li>`).join('')}</ul>
      ${pack.sample ? `<label class="row small" style="margin-top:14px"><input type="checkbox" id="replace-sample" checked> Replace the sample lessons with my material</label>` : ''}
      <div class="row" style="margin-top:14px">
        <button class="btn primary" data-action="build" ${building?.running || !building?.files?.length || !key ? 'disabled' : ''}>${building?.running ? 'Building…' : 'Build my hub from these files'}</button>
        ${building?.running ? '<button class="btn ghost" data-action="cancel-build">Stop</button>' : ''}
      </div>
      <p class="small muted" style="margin-top:12px">Files go straight from this browser to Anthropic with your key, using ${esc(MODELS.find(m => m.id === state.settings.model)?.label || state.settings.model)}. Use material you have the right to study from. Each file costs a small amount of API credit.</p>
    </section>
    <h2>In your hub now</h2>
    <p>${plural(pack.domains.length, 'area')} · ${plural(pack.lessons.length, 'lesson')} · ${plural(pack.questions.length, 'question')} · ${plural(pack.flashcards.length, 'flashcard')}</p>
    ${pack.sources.length ? `<ul class="file-list">${pack.sources.map(s => `<li><span>${esc(s.name)}</span><span class="muted">${new Date(s.addedAt).toLocaleDateString()}</span></li>`).join('')}</ul>` : `<p class="muted small">${pack.sample ? 'Sample lessons only.' : 'No sources yet.'}</p>`}`;
}

function bindSources() {
  const input = document.getElementById('file-input');
  const drop = document.getElementById('drop');
  const accept = files => {
    if (building?.running) return;
    const ok = [...files].filter(f => /\.(pdf|txt|md|markdown)$/i.test(f.name) || ['application/pdf', 'text/plain', 'text/markdown'].includes(f.type));
    const tooBig = ok.filter(f => f.size > MAX_FILE_BYTES);
    if (tooBig.length) alert(`These files are over 30 MB. Split them first: ${tooBig.map(f => f.name).join(', ')}`);
    const files2 = ok.filter(f => f.size <= MAX_FILE_BYTES);
    building = {files: files2, status: files2.map(() => 'Ready'), running: false};
    render();
  };
  input?.addEventListener('change', () => accept(input.files));
  drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop?.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop?.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); accept(e.dataTransfer.files); });
}

async function buildFromSources() {
  const apiKey = getApiKey();
  if (!apiKey || !building?.files.length) return;
  const replaceSample = document.getElementById('replace-sample')?.checked ?? false;
  building.running = true;
  building.controller = new AbortController();
  let added = 0;
  render();
  for (let i = 0; i < building.files.length; i++) {
    const file = building.files[i];
    const setStatus = s => { building.status[i] = s; const li = document.querySelectorAll('#queue li')[i]; if (li) li.lastElementChild.textContent = s; };
    try {
      setStatus('Reading file…');
      const data = await readFileForRequest(file);
      const {body, headers} = buildRequest({
        fileName: file.name, fileType: file.type, data, profile: state.profile,
        existingDomains: state.pack.sample && replaceSample ? [] : state.pack.domains.map(d => d.name), model: state.settings.model,
      });
      setStatus('Sending to Claude…');
      const text = await streamMessage({apiKey, body, headers, signal: building.controller.signal,
        onProgress: n => setStatus(`Writing lessons… ${Math.round(n / 1000)}k characters`)});
      const generated = JSON.parse(text);
      state.pack = mergePack(state.pack, generated, file.name, {replaceSample});
      persist();
      added++;
      setStatus(`Done: ${plural(generated.lessons?.length || 0, 'lesson')}, ${plural(generated.questions?.length || 0, 'question')}, ${plural(generated.flashcards?.length || 0, 'card')}`);
    } catch (err) {
      setStatus(err.name === 'AbortError' ? 'Stopped' : `Failed: ${err.message}`);
      if (err.name === 'AbortError') break;
    }
  }
  building.running = false;
  if (added && state.diagnostic && Object.keys(state.diagnostic.answers).every(id => !state.pack.questions.some(q => q.id === id))) {
    state.diagnostic = null; // the old check was about the sample lessons
    persist();
  }
  render();
}

// ---------- progress ----------
function progressView() {
  const s = strength();
  const diag = state.diagnostic ? domainStrength(state.pack, state.diagnostic, {}) : {};
  const answers = Object.values(state.progress.answers).flat();
  const right = answers.filter(a => a.correct).length;
  const lessonsDone = Object.keys(state.progress.lessonsDone).filter(id => state.pack.lessons.some(l => l.id === id)).length;
  const studyDays = Object.keys(state.progress.days).length;
  const totalMinutes = Object.values(state.progress.days).reduce((a, d) => a + (d.minutes || 0), 0);
  return `<h1>Progress</h1>
    <div class="grid-cards">
      <div class="card"><div class="stat">${answers.length ? pct(right / answers.length) : '–'}</div><div class="small muted">of ${answers.length} practice answers correct</div></div>
      <div class="card"><div class="stat">${lessonsDone}/${state.pack.lessons.length}</div><div class="small muted">lessons done</div></div>
      <div class="card"><div class="stat">${mastered(state.progress.cards)}/${state.pack.flashcards.length}</div><div class="small muted">cards in long-term review</div></div>
      <div class="card"><div class="stat">${studyDays}</div><div class="small muted">study days · ${streak()} in a row · about ${Math.round(totalMinutes / 60 * 10) / 10} h timed</div></div>
    </div>
    <h2>Score by area</h2>
    <div class="legend"><span><i></i>Now</span>${state.diagnostic ? '<span><i class="then"></i>Quick check</span>' : ''}</div>
    <div class="card" style="margin-top:10px"><div class="bars">${state.pack.domains.map(d => `
      <div class="bar-row"><span>${esc(d.name)}</span>
        <div class="bar-track" role="img" aria-label="${esc(d.name)}: now ${pct(s[d.id])}${diag[d.id] != null ? `, quick check ${pct(diag[d.id])}` : ''}">
          <span class="now" style="width:${(s[d.id] ?? 0) * 100}%"></span>${diag[d.id] != null ? `<span class="then" style="left:calc(${diag[d.id] * 100}% - 1.5px)"></span>` : ''}</div>
        <b>${pct(s[d.id])}</b></div>`).join('')}</div>
      <p class="small muted" style="margin:14px 0 0">"Now" counts your quick check plus your last three tries at each practice question. Areas under 60% get more study days.</p></div>
    <h2>Keep a backup</h2>
    <p class="muted small">Progress lives only in this browser. Download a backup now and then, or to move to another device.</p>
    <div class="row"><button class="btn" data-action="export">Download backup</button>
      <label class="btn">Restore a backup<input type="file" accept="application/json,.json" class="sr-only" id="import-input"></label></div>`;
}

// ---------- settings ----------
function openSettings() {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet';
  const key = getApiKey();
  dlg.innerHTML = `<form method="dialog" class="sheet-body" id="settings-form">
    <div class="row between"><h2>Settings</h2><button class="icon-btn" value="close" aria-label="Close">✕</button></div>
    <h3>Profile</h3>
    <p class="small muted" style="margin:0">${esc(state.profile.name)} · ${esc(state.profile.certification)} · exam ${fmtDate(state.profile.examDate)} · ${esc(state.profile.hoursPerDay)} h a day · ${esc((STYLES[state.profile.style] || STYLES.mixed)[0])}</p>
    <a class="btn" href="#setup" data-action="close-settings">Edit profile and exam date</a>
    <h3>Anthropic API key</h3>
    <label class="field">Key for building lessons from your sources
      <input type="password" name="apiKey" autocomplete="off" spellcheck="false" placeholder="${key ? `Saved: ••••${esc(key.slice(-4))}` : 'sk-ant-…'}">
      <span class="hint">Create one at console.anthropic.com. It is stored only in this browser and sent only to Anthropic. Don't save it on a shared computer.</span>
    </label>
    <div class="row"><button class="btn" type="button" data-action="save-key">Save key</button>${key ? '<button class="btn ghost danger" type="button" data-action="remove-key">Remove key</button>' : ''}</div>
    <label class="field">Model
      <select name="model">${MODELS.map(m => `<option value="${m.id}" ${state.settings.model === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
    </label>
    <h3>Appearance</h3>
    <label class="field">Theme
      <select name="theme">${[['auto', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${state.settings.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </label>
    <h3>Start over</h3>
    <div class="row"><button class="btn ghost danger" type="button" data-action="reset">Erase everything in this browser</button></div>
  </form>`;
  document.body.append(dlg);
  const form = dlg.querySelector('form');
  form.model.addEventListener('change', () => { state.settings.model = form.model.value; persist(); });
  form.theme.addEventListener('change', () => { state.settings.theme = form.theme.value; persist(); render(); });
  dlg.addEventListener('click', e => {
    const a = e.target.closest('[data-action]')?.dataset.action;
    if (a === 'save-key') {
      const v = form.apiKey.value.trim();
      if (!/^sk-ant-/.test(v)) { alert('That does not look like an Anthropic API key. It starts with sk-ant-.'); return; }
      setApiKey(v); dlg.close(); render();
    } else if (a === 'remove-key') { setApiKey(''); dlg.close(); render(); }
    else if (a === 'close-settings') dlg.close();
    else if (a === 'reset' && confirm('Erase your profile, progress and uploaded material from this browser? Download a backup first if you want to keep anything.')) {
      reset(); setApiKey(''); state = defaultState(); state.pack = structuredClone(samplePack); dlg.close(); location.hash = ''; render();
    }
  });
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}

// ---------- search ----------
const TYPE_LABEL = {lesson: 'Lesson', question: 'Question', card: 'Flashcard'};
const hrefOf = r => r.type === 'lesson' ? `#learn/${r.id}` : null;
function resultRow(r, extra = '') {
  const open = r.type === 'lesson'
    ? `<a class="result-title" href="${esc(hrefOf(r))}">${esc(r.title)}</a>`
    : `<button class="result-title link-btn" data-action="${r.type === 'question' ? 'quiz-one' : 'cards-one'}" data-id="${esc(r.id)}">${esc(r.title)}</button>`;
  return `<li class="result"><div><span class="eyebrow">${TYPE_LABEL[r.type]} · ${esc(domainName(r.domain))}</span>${open}
    ${r.snippet ? `<p class="small muted">${esc(r.snippet)}</p>` : ''}</div>${extra || markButton(r.type, r.id, TYPE_LABEL[r.type].toLowerCase())}</li>`;
}
function searchResults(q) {
  if (q.trim().length < 2) return '<p class="muted">Type at least two letters.</p>';
  const results = searchPack(state.pack, q);
  if (!results.length) return `<p class="muted">Nothing matches “${esc(q)}”. Try a shorter or different word.</p>`;
  return `<p class="small muted">${plural(results.length, 'result')}</p><ul class="results">${results.map(r => resultRow(r)).join('')}</ul>`;
}
const searchView = q => `<p class="eyebrow">Search</p><h1>${q ? `“${esc(q)}”` : 'Search your hub'}</h1><div id="search-results">${searchResults(q)}</div>`;

// ---------- bookmarks ----------
function bookmarksView() {
  const list = Object.values(bookmarks()).sort((a, b) => b.at.localeCompare(a.at));
  const find = m => m.type === 'lesson' ? state.pack.lessons.find(x => x.id === m.id)
    : m.type === 'question' ? state.pack.questions.find(x => x.id === m.id) : state.pack.flashcards.find(x => x.id === m.id);
  const rows = list.map(m => {
    const item = find(m);
    if (!item) return '';
    const title = m.type === 'lesson' ? item.title : m.type === 'question' ? item.stem : item.front;
    const snippet = m.type === 'lesson' ? item.summary : m.type === 'card' ? item.back : '';
    return resultRow({type: m.type, id: m.id, domain: item.domain, title, snippet});
  }).join('');
  return `<p class="eyebrow">Saved for later</p><h1>Bookmarks</h1>
    ${rows ? `<ul class="results">${rows}</ul>` : `<p class="lede">Nothing saved yet. Tap the bookmark on any lesson, question or flashcard to keep it here.</p>`}`;
}

// The search box updates results as you type without reloading the page around it.
function bindSearch(route) {
  const input = document.getElementById('search');
  if (!input) return;
  if (route === 'search') { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  input.addEventListener('input', () => {
    searchQuery = input.value;
    const target = `#search/${encodeURIComponent(searchQuery)}`;
    if (!location.hash.startsWith('#search')) { location.hash = target; return; }
    history.replaceState(null, '', target);
    const box = document.getElementById('search-results');
    if (box) box.innerHTML = searchResults(searchQuery);
    const h1 = document.querySelector('#main h1');
    if (h1) h1.textContent = searchQuery ? `“${searchQuery}”` : 'Search your hub';
  });
}

// ---------- router ----------
function render() {
  applyTheme();
  const hash = location.hash.slice(1) || 'today';
  const [route, arg] = hash.split('/');
  if (!state.profile || route === 'setup') {
    app.innerHTML = setupView();
    bindSetup();
    return;
  }
  let view;
  let tab = route;
  if (session?.type === 'result') { view = resultView(); tab = session.diagnostic ? 'today' : 'practice'; }
  else if (route === 'learn' && arg) view = lessonView(arg);
  else if (route === 'learn') view = learnView();
  else if (route === 'practice' && arg === 'cards') view = cardsView();
  else if (route === 'practice' && arg === 'run') view = quizView();
  else if (route === 'practice') view = practiceView();
  else if (route === 'diagnostic') { view = arg === 'run' && session ? quizView() : diagnosticIntro(); tab = 'today'; }
  else if (route === 'sources') view = sourcesView();
  else if (route === 'progress') view = progressView();
  else if (route === 'search') { searchQuery = decodeURIComponent(arg || ''); view = searchView(searchQuery); tab = 'search'; }
  else if (route === 'bookmarks') { view = bookmarksView(); tab = 'bookmarks'; }
  else { view = todayView(); tab = 'today'; }
  if (route !== 'search') searchQuery = '';
  app.innerHTML = shell(tab, view);
  if (route === 'sources') bindSources();
  bindSearch(route);
  if (route === 'learn' && arg) mountLessonFigure(state.pack.lessons.find(x => x.id === arg));
  else { liveFigure?.destroy(); liveFigure = null; }
  document.getElementById('import-input')?.addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const restored = importBackup(await f.text());
      if (confirm('Replace everything in this browser with this backup?')) { state = restored; persist(); render(); }
    } catch (err) { alert(err.message); }
  });
}

app.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const {action} = el.dataset;
  const actions = {
    'settings': openSettings,
    'start-block': () => startBlock(Number(el.dataset.i)),
    'start-diagnostic': () => startQuiz({diagnostic: true}),
    'quiz-weak': () => { const s = strength(); const d = [...state.pack.domains].sort((a, b) => (s[a.id] ?? 0.5) - (s[b.id] ?? 0.5))[0]; startQuiz({domains: [d.id], count: 10, block: 'practice'}); },
    'quiz-mixed': () => startQuiz({count: 15, block: 'practice'}),
    'quiz-domain': () => startQuiz({domains: [el.dataset.domain], count: 10, block: 'practice'}),
    'cards-due': () => startCards(null, 'cards'),
    'cards-domain': () => startCards(el.dataset.domain, 'cards'),
    'pick': () => pick(Number(el.dataset.i)),
    'next-q': nextQuestion,
    'flip': () => { session.flipped = !session.flipped; render(); },
    'card-grade': () => gradeCard(el.dataset.knew === '1'),
    'end-session': () => { if (session?.type === 'quiz' && session.i > 0) finishQuiz(); else { session = null; location.hash = '#practice'; render(); } },
    'clear-session': () => { session = null; },
    'pick-part': () => liveFigure?.select(Number(el.dataset.i)),
    'toggle-sidebar': () => { state.settings.sidebarHidden = !state.settings.sidebarHidden; persist(); render(); },
    'toggle-theme': () => { state.settings.theme = resolvedTheme() === 'dark' ? 'light' : 'dark'; persist(); render(); },
    'bookmark': () => {
      toggleBookmark(el.dataset.type, el.dataset.id);
      // Redraw in place so a figure or a round in progress isn't restarted.
      document.querySelectorAll(`[data-action="bookmark"][data-type="${el.dataset.type}"][data-id="${CSS.escape(el.dataset.id)}"]`).forEach(b => { b.outerHTML = markButton(el.dataset.type, el.dataset.id, TYPE_LABEL[el.dataset.type].toLowerCase()); });
      const link = document.querySelector('.mark-link');
      const n = Object.keys(bookmarks()).length;
      if (link) { link.innerHTML = ICONS.bookmark + (n ? `<span class="count" aria-hidden="true">${n}</span>` : ''); link.setAttribute('aria-label', `Open bookmarks${n ? ` (${n})` : ''}`); }
      if (location.hash.startsWith('#bookmarks')) render();
    },
    'quiz-one': () => startQuiz({ids: [el.dataset.id], block: 'practice'}),
    'cards-one': () => startCards(null, 'cards', [el.dataset.id]),
    'lesson-done': () => {
      state.progress.lessonsDone[el.dataset.id] = today();
      if (sessionStorage.getItem('studyhub.block') === 'learn') { markStudied('learn'); sessionStorage.removeItem('studyhub.block'); } else persist();
      render();
    },
    'build': buildFromSources,
    'cancel-build': () => building?.controller?.abort(),
    'export': () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(exportBackup(state));
      a.download = `study-hub-backup-${today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  };
  if (actions[action]) actions[action]();
});

window.addEventListener('hashchange', () => {
  // Leaving a finished round clears it. Leaving one mid-way keeps answers already saved.
  if (session && !/^#(practice\/(run|cards)|diagnostic\/run)/.test(location.hash)) session = null;
  render();
  if (!location.hash.startsWith('#search')) document.getElementById('main')?.focus?.({preventScroll: true});
  window.scrollTo(0, 0);
});
// Press / anywhere to jump to search, as in the personal hub.
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/^(input|textarea|select)$/i.test(document.activeElement?.tagName || '')) { const s = document.getElementById('search'); if (s) { e.preventDefault(); s.focus(); } }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => state.settings.theme === 'auto' && state.profile && render());
window.addEventListener('beforeunload', e => { if (building?.running) { e.preventDefault(); e.returnValue = ''; } });

render();
