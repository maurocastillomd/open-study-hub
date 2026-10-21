import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPlan, domainStrength, domainPriority, daysBetween, addDays} from '../js/planner.js';
import {review, dueCards} from '../js/cards.js';
import {mergePack, buildRequest, PACK_SCHEMA} from '../js/generate.js';
import {samplePack} from '../content/sample-pack.js';

const domains = [{id: 'a', name: 'A', weight: 3}, {id: 'b', name: 'B', weight: 1}];

test('date math crosses months and years', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(daysBetween('2026-10-20', '2026-11-01'), 12);
});

test('weak, heavy areas get more time', () => {
  const p = domainPriority(domains, {a: 0.3, b: 0.9});
  assert.ok(p.a > p.b);
  assert.ok(Math.abs(p.a + p.b - 1) < 1e-9);
});

test('focus days follow priority over the plan', () => {
  const plan = buildPlan({today: '2026-10-20', examDate: '2026-11-29', hoursPerDay: 2, style: 'visual', domains, strength: {a: 0.3, b: 0.9}});
  const count = plan.days.reduce((m, d) => ({...m, [d.focus]: (m[d.focus] || 0) + 1}), {});
  assert.ok(count.a > count.b * 2, JSON.stringify(count));
  assert.equal(plan.days[0].blocks.reduce((s, b) => s + b.minutes, 0), 120);
});

test('the final week shifts to practice and the last day tapers', () => {
  const plan = buildPlan({today: '2026-10-20', examDate: '2026-10-25', hoursPerDay: 1, style: 'reading', domains, strength: {}});
  assert.equal(plan.days[0].phase, 'review');
  const practice = plan.days[0].blocks.find(b => b.kind === 'practice').minutes;
  assert.ok(practice >= 30);
  assert.equal(plan.days.at(-1).phase, 'taper');
});

test('a past exam date still returns a usable day', () => {
  const plan = buildPlan({today: '2026-10-20', examDate: '2026-10-01', hoursPerDay: 1, domains, strength: {}});
  assert.equal(plan.days.length, 1);
});

test('strength uses the diagnostic and the last three tries only', () => {
  const s = domainStrength(samplePack, {answers: {q1: false}}, {q4: [{correct: false}, {correct: true}, {correct: true}, {correct: true}]});
  assert.equal(s.memory, 0);
  assert.equal(s.planning, 1);
  assert.equal(s.exam, null);
});

test('flashcards move up on recall and reset on a miss', () => {
  const up = review({box: 2}, true, '2026-10-20');
  assert.deepEqual([up.box, up.due], [3, '2026-10-27']);
  const down = review(up, false, '2026-10-20');
  assert.equal(down.box, 1);
  assert.equal(dueCards([{id: 'x'}], {x: down}, '2026-10-21').length, 1);
});

test('merging generated material replaces the sample and drops bad items', () => {
  const generated = {
    domains: [{name: 'Load monitoring', weight: 4}],
    lessons: [{domain: 'Load monitoring', title: 'T', summary: 'S', keyPoints: ['k'], visual: {kind: 'nonsense', caption: '', parts: [{label: 'x', detail: 'y'}]}, body: ['p']}],
    questions: [
      {domain: 'Load monitoring', stem: 'Q', choices: ['a', 'b', 'c', 'd'], answer: 2, explanation: 'e'},
      {domain: 'Load monitoring', stem: 'Bad', choices: ['a', 'b'], answer: 5, explanation: ''},
    ],
    flashcards: [{domain: 'New area', front: 'F', back: 'B'}],
  };
  const pack = mergePack(samplePack, generated, 'notes.pdf');
  assert.equal(pack.sample, false);
  assert.equal(pack.questions.length, 1);
  assert.equal(pack.lessons[0].visual.kind, 'steps');
  assert.deepEqual(pack.domains.map(d => [d.name, d.weight]), [['Load monitoring', 4], ['New area', 2]]);
  const again = mergePack(pack, generated, 'more.pdf');
  assert.equal(again.domains.length, 2, 'same-named domains are combined');
  assert.equal(again.sources.length, 2);
});

test('requests use structured output, and fallbacks only where offered', () => {
  const profile = {certification: 'Test cert', style: 'visual'};
  const opus = buildRequest({fileName: 'a.pdf', fileType: 'application/pdf', data: 'AAA', profile, existingDomains: [], model: 'claude-opus-5-5'});
  assert.equal(opus.body.output_config.format.schema, PACK_SCHEMA);
  assert.equal(opus.body.fallbacks, 'default');
  assert.equal(opus.body.messages[0].content[0].source.type, 'base64');
  const haiku = buildRequest({fileName: 'a.md', fileType: 'text/markdown', data: '# hi', profile, existingDomains: ['X'], model: 'claude-haiku-5-5'});
  assert.equal(haiku.body.fallbacks, undefined);
  assert.equal(haiku.body.messages[0].content[0].source.type, 'text');
  assert.match(haiku.body.system, /Reuse a name exactly/);
});

test('every picture kind draws for 2 to 6 parts with no broken numbers', async () => {
  const {figureFor} = await import('../js/figures.js');
  for (const kind of ['steps', 'cycle', 'compare', 'layers', 'unknown']) {
    for (let n = 2; n <= 6; n++) {
      const fig = figureFor({kind, parts: Array.from({length: n}, (_, i) => ({label: `P${i}`, detail: ''}))});
      for (let active = 0; active < (kind === 'compare' && n === 2 ? 2 : n); active++) {
        fig.snap(active);
        const svg = fig.body(active).join('');
        assert.ok(svg.length > 5000, `${kind} ${n}`);
        assert.ok(!/NaN|undefined|Infinity/.test(svg), `${kind} ${n} ${active}`);
        assert.equal((svg.match(/data-lit=""/g) || []).length, 1, `${kind} ${n} ${active}: exactly one lit part`);
        assert.match(fig.reading(active), /\S/);
      }
    }
  }
});

test('search finds lessons, questions and cards, best title matches first', async () => {
  const {searchPack} = await import('../js/search.js');
  const hits = searchPack(samplePack, 'spaced review');
  assert.ok(hits.length > 0);
  assert.ok(hits.every(h => ['lesson', 'question', 'card'].includes(h.type)));
  assert.equal(searchPack(samplePack, 'Retrieval')[0].type !== undefined, true);
  assert.equal(searchPack(samplePack, 'x').length, 0, 'one letter is too short');
  assert.equal(searchPack(samplePack, 'zebra unicorn').length, 0);
  const title = searchPack(samplePack, 'interleaving');
  assert.equal(title[0].id, 'f4', 'a flashcard titled with the word ranks above body-only matches');
});

test('a lesson object is checked, kept through merging, and lights only its linked pieces', async () => {
  const {cleanScene} = await import('../js/scene.js');
  const {figureFor} = await import('../js/figures.js');
  assert.equal(cleanScene({parts: [{shape: 'box', at: [0, 0, 0], size: [10, 10, 10]}]}, 2), null, 'too few parts');
  const scene = {object: 'Force plate', azimuth: 45, parts: [
    {shape: 'box', at: [0, 0, 0], size: [80, 60, 6], tone: 'structure', detail: 'screws', link: -1, axis: 'z'},
    {shape: 'box', at: [0, 0, 6], size: [60, 40, 4], tone: 'subject', detail: 'groove', link: 0, axis: 'z'},
    {shape: 'rod', at: [30, 0, 3], size: [3, 0, 40], tone: 'structure', detail: 'none', link: 1, axis: 'x'},
    {shape: 'screen', at: [80, 0, 0], size: [30, 20, 18], tone: 'subject', detail: 'none', link: 1, axis: 'z'},
    {shape: 'nonsense', at: [0, 0, 0], size: [1, 1, 1]},
    {shape: 'dial', at: [-60, 30, 0], size: [20, 20, 8], tone: 'subject', detail: 'none', link: 9, axis: 'z'},
  ]};
  const clean = cleanScene(scene, 2);
  assert.equal(clean.parts.length, 5, 'unknown shapes are dropped');
  assert.equal(clean.parts.at(-1).link, -1, 'links past the last part are cut');
  const fig = figureFor({kind: 'steps', parts: [{label: 'Plate'}, {label: 'Readout'}], scene});
  assert.equal(fig.title, 'Force plate');
  const svg = fig.body(1).join('');
  assert.ok(!/NaN|undefined/.test(svg));
  assert.equal((svg.match(/data-lit=""/g) || []).length, 2, 'both pieces linked to part 2 are lit');
  const generated = {domains: [{name: 'Testing', weight: 3}], lessons: [{domain: 'Testing', title: 'T', summary: 'S', keyPoints: [], body: [], visual: {kind: 'steps', caption: '', parts: [{label: 'a', detail: ''}, {label: 'b', detail: ''}], scene}}], questions: [], flashcards: []};
  assert.equal(mergePack(null, generated, 'x.pdf').lessons[0].visual.scene.object, 'Force plate');
});
