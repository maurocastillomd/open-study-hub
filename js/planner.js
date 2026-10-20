// Study planner. Pure functions only, so they run the same in the browser and in `node --test`.

const DAY = 86400000;

export function isoDate(d = new Date()) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Date(d.getTime() + n * DAY).toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / DAY);
}

// How each learning style splits a study day between new learning, flashcards and questions.
export const STYLE_MIX = {
  visual: {learn: 0.45, cards: 0.25, practice: 0.30},
  reading: {learn: 0.50, cards: 0.20, practice: 0.30},
  practice: {learn: 0.25, cards: 0.20, practice: 0.55},
  mixed: {learn: 0.35, cards: 0.25, practice: 0.40},
};

/**
 * Strength per domain from 0 (weak) to 1 (strong), or null when there is no evidence yet.
 * The diagnostic counts as the first attempts; recent practice answers count more over time.
 */
export function domainStrength(pack, diagnostic, answers = {}) {
  const byQuestion = new Map((pack?.questions || []).map(q => [q.id, q.domain]));
  const tally = {};
  const add = (domain, correct, weight) => {
    if (!domain) return;
    const t = tally[domain] || (tally[domain] = {right: 0, total: 0});
    t.right += correct ? weight : 0;
    t.total += weight;
  };
  for (const [qid, correct] of Object.entries(diagnostic?.answers || {})) add(byQuestion.get(qid), correct, 1);
  for (const [qid, attempts] of Object.entries(answers)) {
    // Only the last three attempts per question count, so old mistakes fade once fixed.
    for (const a of attempts.slice(-3)) add(byQuestion.get(qid), a.correct, 1);
  }
  const out = {};
  for (const d of pack?.domains || []) {
    const t = tally[d.id];
    out[d.id] = t && t.total ? t.right / t.total : null;
  }
  return out;
}

/** Share of study time each domain should get: exam weight times how much room there is to improve. */
export function domainPriority(domains, strength) {
  const raw = domains.map(d => {
    const s = strength[d.id];
    const need = s == null ? 1 : 1.5 - s; // unknown counts as a middling score
    return [d.id, Math.max(0.1, (d.weight || 1) * need)];
  });
  const sum = raw.reduce((a, [, v]) => a + v, 0) || 1;
  return Object.fromEntries(raw.map(([id, v]) => [id, v / sum]));
}

function phaseFor(daysLeft) {
  if (daysLeft <= 0) return 'exam';
  if (daysLeft === 1) return 'taper';
  if (daysLeft <= 7) return 'review';
  return 'build';
}

/**
 * A day-by-day plan from today until the exam (at most `maxDays` days are listed).
 * Each day gets a focus domain picked so that, over the plan, days match the domain priorities.
 */
export function buildPlan({today, examDate, hoursPerDay, style = 'mixed', domains = [], strength = {}, maxDays = 60}) {
  const daysLeft = Math.max(0, daysBetween(today, examDate));
  const minutes = Math.round(Math.max(0.25, Number(hoursPerDay) || 1) * 60);
  const priority = domainPriority(domains, strength);
  const ranked = [...domains].sort((a, b) => priority[b.id] - priority[a.id]);
  const assigned = Object.fromEntries(domains.map(d => [d.id, 0]));
  const days = [];
  const count = Math.min(Math.max(daysLeft, 1), maxDays);

  for (let i = 0; i < count; i++) {
    const date = addDays(today, i);
    const left = daysLeft - i;
    const phase = phaseFor(left);
    // Largest deficit wins: the domain furthest behind its fair share of days so far.
    let focus = null;
    let best = -Infinity;
    for (const d of domains) {
      const deficit = priority[d.id] * (i + 1) - assigned[d.id];
      if (deficit > best) { best = deficit; focus = d.id; }
    }
    if (focus) assigned[focus] += 1;

    let mix = {...(STYLE_MIX[style] || STYLE_MIX.mixed)};
    if (phase === 'review') mix = {learn: 0.15, cards: 0.30, practice: 0.55};
    const blocks = [];
    if (phase === 'taper' || phase === 'exam') {
      blocks.push({kind: 'cards', minutes: Math.min(30, minutes), domain: null, note: 'Light review of due cards. Rest well.'});
    } else {
      const learn = Math.round(minutes * mix.learn);
      const cards = Math.round(minutes * mix.cards);
      const practice = minutes - learn - cards;
      const second = ranked.find(d => d.id !== focus)?.id || null;
      if (learn >= 10) blocks.push({kind: 'learn', minutes: learn, domain: focus});
      if (cards >= 5) blocks.push({kind: 'cards', minutes: cards, domain: null});
      // Practice mixes the focus with the next weakest area: interleaving beats one topic at a time.
      if (practice >= 5) blocks.push({kind: 'practice', minutes: practice, domain: focus, mixWith: phase === 'review' ? null : second});
    }
    days.push({date, daysLeft: left, phase, focus, blocks});
  }
  return {today, examDate, daysLeft, minutesPerDay: minutes, priority, days};
}

/** Rough question count that fits a practice block: about 1.5 minutes per question with review. */
export const questionsFor = minutes => Math.max(5, Math.round(minutes / 1.5));
