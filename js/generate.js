import {SHAPES, DETAILS, cleanScene} from './scene.js';

// Turns an uploaded source (PDF, text or Markdown) into domains, lessons, questions and flashcards
// with the Claude API. The call goes straight from this page to Anthropic with the key the
// person saved in Settings. There is no server in between.

const API_URL = 'https://api.anthropic.com/v1/messages';
export const MAX_FILE_BYTES = 30 * 1024 * 1024; // the API accepts requests up to 32 MB

export const MODELS = [
  {id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (best quality)'},
  {id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (lower cost)'},
  {id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (lowest cost)'},
];
// Server-side refusal fallbacks are offered for these models on the Claude API.
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);

const visualKinds = ['steps', 'cycle', 'compare', 'layers'];
const num3 = {type: 'array', items: {type: 'number'}};
const obj = (properties) => ({type: 'object', additionalProperties: false, required: Object.keys(properties), properties});
const str = {type: 'string'};

export const PACK_SCHEMA = obj({
  domains: {type: 'array', items: obj({name: str, weight: {type: 'integer'}})},
  lessons: {type: 'array', items: obj({
    domain: str, title: str, summary: str,
    keyPoints: {type: 'array', items: str},
    visual: obj({
      kind: {type: 'string', enum: visualKinds}, caption: str, parts: {type: 'array', items: obj({label: str, detail: str})},
      // The lesson's own object, drawn by js/scene.js.
      scene: obj({
        object: str,
        azimuth: {type: 'number'},
        parts: {type: 'array', items: obj({
          shape: {type: 'string', enum: SHAPES}, at: num3, size: num3,
          axis: {type: 'string', enum: ['x', 'y', 'z']},
          tone: {type: 'string', enum: ['base', 'structure', 'subject']},
          detail: {type: 'string', enum: DETAILS},
          link: {type: 'integer'},
        })},
      }),
    }),
    body: {type: 'array', items: str},
  })},
  questions: {type: 'array', items: obj({domain: str, stem: str, choices: {type: 'array', items: str}, answer: {type: 'integer'}, explanation: str})},
  flashcards: {type: 'array', items: obj({domain: str, front: str, back: str})},
});

const STYLE_NOTES = {
  visual: 'The learner is visual. Make every lesson visual clear and specific, with 3 to 5 parts.',
  reading: 'The learner prefers reading. Give each lesson two or three well-written paragraphs.',
  practice: 'The learner learns by doing. Write more questions, including short applied scenarios.',
  mixed: 'Balance pictures, reading and practice.',
};

export function buildRequest({fileName, fileType, data, profile, existingDomains, model}) {
  const isPdf = fileType === 'application/pdf' || /\.pdf$/i.test(fileName);
  const document = isPdf
    ? {type: 'document', title: fileName, source: {type: 'base64', media_type: 'application/pdf', data}}
    : {type: 'document', title: fileName, source: {type: 'text', media_type: 'text/plain', data}};
  const system = [
    `You build study material for someone preparing for this exam or certification: ${profile.certification}.`,
    'Work only from the attached source. Do not add facts it does not support.',
    'Explain in plain language, short sentences, around a grade 8 reading level, without losing accuracy.',
    'Paraphrase. Never copy more than a short phrase from the source.',
    'Group the material into exam domains. Give each domain a weight from 1 to 5 for how much of the exam it likely covers, based on the source.',
    existingDomains.length ? `The hub already has these domains. Reuse a name exactly when the material fits it: ${existingDomains.join('; ')}.` : '',
    'Write 3 to 8 lessons. Each lesson has a one-sentence summary, 3 to 5 key points, 2 or 3 body paragraphs, and a visual.',
    'Visual kinds: steps (an ordered process, 2 to 6 parts), cycle (a repeating loop, 2 to 6 parts), compare (exactly two things side by side), layers (parts that build on each other, the first part being the base, 2 to 6 parts). Choose the kind that matches the idea. The hub draws each kind as a small machine, so keep part labels to one to three words.',
    'Each visual also has a scene: a real, recognisable physical object from the lesson\'s own subject, built from simple parts, that shows the idea. Use equipment, tools or instruments of the field (for a lesson on jump testing: a force plate with its cable and a readout; for sleep: a bed, a pillow and a sleep tracker). Never a generic diagram, chart or stack of slabs.',
    'Scene rules: world units, x and y across the bench from -100 to 100, z up from 0 to 140; the hub adds the bench under it. 8 to 30 parts. at is [x, y, z] of the bottom centre for box, screen, cylinder and dial, and the start of the centre line for rod. size is [width, depth, height] for box and screen, [diameter, diameter, height] for cylinder and dial, and [thickness, 0, length] for rod. axis matters only for rod. Every part rests on the bench or on another part. tone: base for supports, structure for frames, subject for the pieces the lesson is about. detail adds screws, a groove, knurl, ticks, vents or label lines. link is the index of the visual part (0 for the first) that this piece shows, or -1; every visual part has at least one linked piece. azimuth 30 to 60 turns the view.',
    'Write 10 to 25 multiple-choice questions. Each has exactly 4 choices, one correct answer given as its index from 0 to 3, and an explanation of why it is right.',
    'Write 10 to 30 flashcards with a short front and a one or two sentence back.',
    'Every lesson, question and flashcard names one of your domains exactly in its domain field.',
    STYLE_NOTES[profile.style] || STYLE_NOTES.mixed,
  ].filter(Boolean).join('\n');

  const body = {
    model,
    max_tokens: 32000,
    stream: true,
    system,
    output_config: {effort: 'medium', format: {type: 'json_schema', schema: PACK_SCHEMA}},
    messages: [{role: 'user', content: [document, {type: 'text', text: 'Build the study material from this source.'}]}],
  };
  const headers = {};
  if (FALLBACK_MODELS.has(model)) {
    body.fallbacks = 'default';
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  }
  return {body, headers};
}

function friendlyError(status, message) {
  if (status === 401 || status === 403) return 'Anthropic did not accept the API key. Check it in Settings.';
  if (status === 429) return 'Anthropic rate limit reached. Wait a minute and try again.';
  if (/credit balance|billing/i.test(message)) return 'Your Anthropic account is out of credits. Add credits at console.anthropic.com, then retry.';
  if (status === 413) return 'This file is too large for one request. Split it into smaller files.';
  if (status >= 500) return 'Anthropic is having trouble right now. Try again in a few minutes.';
  return `Anthropic could not process this file (HTTP ${status})${message ? `: ${message}` : '.'}`;
}

/** Sends the request and reads the streamed reply. Calls onProgress(charactersReceived). */
export async function streamMessage({apiKey, body, headers = {}, onProgress = () => {}, signal}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Required for calls made straight from a web page. The key is the visitor's own.
      'anthropic-dangerous-direct-browser-access': 'true',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = '';
    try { message = (await response.json())?.error?.message || ''; } catch {}
    throw new Error(friendlyError(response.status, message.slice(0, 200)));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let stopReason = null;
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, {stream: true});
    let cut;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const line = chunk.split('\n').find(l => l.startsWith('data:'));
      if (!line) continue;
      let event;
      try { event = JSON.parse(line.slice(5)); } catch { continue; }
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        text += event.delta.text;
        onProgress(text.length);
      } else if (event.type === 'message_delta' && event.delta?.stop_reason) {
        stopReason = event.delta.stop_reason;
      } else if (event.type === 'error') {
        throw new Error(friendlyError(500, event.error?.message || ''));
      }
    }
  }
  if (stopReason === 'refusal') throw new Error('The model declined to process this file.');
  if (stopReason === 'max_tokens') throw new Error('The source was too long to finish in one pass. Split it into smaller files (for example one chapter each).');
  return text;
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
const clean = s => String(s ?? '').trim();

/**
 * Merges generated material into the pack. Domains with the same name are combined.
 * Items are checked so a malformed reply can't break the hub.
 */
export function mergePack(pack, generated, sourceName, {replaceSample = true} = {}) {
  const base = !pack || (pack.sample && replaceSample)
    ? {title: 'My study hub', sample: false, domains: [], lessons: [], questions: [], flashcards: [], sources: []}
    : structuredClone(pack);
  const stamp = Date.now().toString(36);
  const byName = new Map(base.domains.map(d => [d.name.toLowerCase(), d]));
  const domainId = name => {
    const key = clean(name).toLowerCase();
    if (!key) return null;
    if (!byName.has(key)) {
      const d = {id: `d-${slug(name)}-${stamp}`, name: clean(name), weight: 2};
      byName.set(key, d);
      base.domains.push(d);
    }
    return byName.get(key).id;
  };
  for (const d of generated.domains || []) {
    const id = domainId(d.name);
    if (id) byName.get(clean(d.name).toLowerCase()).weight = Math.min(5, Math.max(1, Math.round(d.weight) || 2));
  }
  let n = 0;
  const id = prefix => `${prefix}-${stamp}-${n++}`;
  for (const l of generated.lessons || []) {
    const domain = domainId(l.domain);
    if (!domain || !clean(l.title)) continue;
    const parts = (l.visual?.parts || []).filter(p => clean(p.label)).slice(0, 6);
    base.lessons.push({
      id: id('l'), domain, source: sourceName, title: clean(l.title), summary: clean(l.summary),
      keyPoints: (l.keyPoints || []).map(clean).filter(Boolean),
      visual: {kind: visualKinds.includes(l.visual?.kind) ? l.visual.kind : 'steps', caption: clean(l.visual?.caption), parts, scene: cleanScene(l.visual?.scene, parts.length)},
      body: (l.body || []).map(clean).filter(Boolean),
    });
  }
  for (const q of generated.questions || []) {
    const domain = domainId(q.domain);
    const choices = (q.choices || []).map(clean).filter(Boolean);
    if (!domain || choices.length < 2 || !(q.answer >= 0 && q.answer < choices.length)) continue;
    base.questions.push({id: id('q'), domain, source: sourceName, stem: clean(q.stem), choices, answer: q.answer, explanation: clean(q.explanation)});
  }
  for (const f of generated.flashcards || []) {
    const domain = domainId(f.domain);
    if (!domain || !clean(f.front) || !clean(f.back)) continue;
    base.flashcards.push({id: id('f'), domain, source: sourceName, front: clean(f.front), back: clean(f.back)});
  }
  base.sources.push({name: sourceName, addedAt: new Date().toISOString()});
  return base;
}

export function readFileForRequest(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve(isPdf ? String(reader.result).split(',')[1] : String(reader.result));
    if (isPdf) reader.readAsDataURL(file); else reader.readAsText(file);
  });
}
