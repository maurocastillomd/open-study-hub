// Search across lessons, questions and flashcards. Pure, so it is tested in Node.

const normal = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** A short piece of `text` around the first matching word, for the result list. */
function snippetOf(text, words, size = 120) {
  const plain = String(text ?? '');
  const low = normal(plain);
  const at = Math.min(...words.map(w => low.indexOf(w)).filter(i => i >= 0), Infinity);
  if (at === Infinity || plain.length <= size) return plain.slice(0, size);
  const start = Math.max(0, at - 40);
  return `${start > 0 ? '…' : ''}${plain.slice(start, start + size).trim()}…`;
}

/**
 * Every item whose text holds all the words in `query`. A word in the title counts
 * three times as much as one in the body, so the closest matches come first.
 */
export function searchPack(pack, query, limit = 40) {
  const words = normal(query).split(/\s+/).filter(w => w.length > 1);
  if (!words.length || !pack) return [];
  const items = [
    ...(pack.lessons || []).map(l => ({type: 'lesson', id: l.id, domain: l.domain, title: l.title,
      body: [l.summary, l.visual?.caption, ...(l.keyPoints || []), ...(l.body || []), ...(l.visual?.parts || []).flatMap(p => [p.label, p.detail])].filter(Boolean).join(' · ')})),
    ...(pack.questions || []).map(q => ({type: 'question', id: q.id, domain: q.domain, title: q.stem, body: [...q.choices, q.explanation].join(' · ')})),
    ...(pack.flashcards || []).map(c => ({type: 'card', id: c.id, domain: c.domain, title: c.front, body: c.back})),
  ];
  const results = [];
  for (const item of items) {
    const title = normal(item.title);
    const body = normal(item.body);
    let score = 0;
    let all = true;
    for (const w of words) {
      const inTitle = title.includes(w);
      const inBody = body.includes(w);
      if (!inTitle && !inBody) { all = false; break; }
      score += inTitle ? 3 : 1;
    }
    if (!all) continue;
    results.push({...item, score, snippet: snippetOf(item.body, words)});
  }
  const order = {lesson: 0, card: 1, question: 2};
  return results.sort((a, b) => b.score - a.score || order[a.type] - order[b.type]).slice(0, limit);
}
