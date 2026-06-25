import { promises as fs } from 'node:fs';
import path from 'node:path';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;
const requests = new Map();

const SYSTEM_PROMPT = [
  'You are a project-idea generator for teen coders (ages 13-18) in the spirit of Hack Club.',
  'Generate creative, approachable, genuinely fun project ideas that a motivated teenager could actually build.',
  'Vary the ideas every time. Avoid generic ideas like "to-do app" unless given a clever twist.',
  'Every idea must be DETAILED and in-depth, like a mentor writing a tiny project brief.',
  'Return ONLY valid minified JSON. No markdown, no commentary, no code fences.',
  'Schema: {"ideas":[{',
  '"title":string(catchy, specific, not generic),',
  '"difficulty":"Beginner"|"Intermediate"|"Advanced",',
  '"timeEstimate":string(e.g. "a weekend", "~4 hours"),',
  '"stack":string[3-6 concrete tools/libs/frameworks],',
  '"summary":string(1 punchy sentence shown on the card),',
  '"pitch":string(2-3 sentences: why this is worth building and what makes it fun/cool),',
  '"whatYouLearn":string[3-5 concrete skills/concepts the builder will pick up],',
  '"prerequisites":string[2-4 things to know or set up first; ok to say "none" for beginners],',
  '"howItWorks":string(3-5 sentences: a plain-English overview of how the finished thing works under the hood),',
  '"steps":string[5-8 detailed build steps, each a clear actionable sentence, in order],',
  '"fileStructure":string[4-10 lines showing a simple file/folder tree as plain text],',
  '"stretchGoals":string[3-5 ways to level it up once the basics work],',
  '"gotchas":string[2-4 common mistakes or tricky bits to watch out for],',
  '"showOff":string(1-2 sentences: where to share it, e.g. Hack Club Slack channel, GitHub, friends)]',
  ']}',
  'Keep titles under 60 chars. Be specific and concrete, never vague. Match the requested difficulty when given. Match the requested category when given.'
].join(' ');

const PROVIDERS = [
  {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    keyNames: ['GROQ_API_KEY', 'GROQ', 'groq']
  },
  {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash',
    keyNames: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI', 'gemini']
  },
  {
    name: 'mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-large-latest',
    keyNames: ['MISTRAL_API_KEY', 'MISTRAL', 'mistral']
  },
  {
    name: 'openrouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    keyNames: ['OPENROUTER_API_KEY', 'OPENROUTER', 'openrouter']
  },
  {
    name: 'openai',
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    keyNames: ['OPENAI_API_KEY', 'OPENAI', 'openai']
  }
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)
    ? origin || '*'
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  };
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = requests.get(ip);
  if (!entry || now > entry.reset) {
    requests.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'anon'
  );
}

function resolveKey(vault, env, keyNames) {
  for (const name of keyNames) {
    if (env[name]) return env[name];
  }
  if (vault) {
    for (const name of keyNames) {
      try {
        const k = vault.getKey(name);
        if (k) return k;
      } catch (e) {}
    }
  }
  return null;
}

async function loadKeyKingVault() {
  const master = process.env.KEYKING_MASTER_PASSWORD;
  if (!master) return null;
  const { KeyKing } = await import('keyking-sdk');
  const kk = new KeyKing(master);
  let vaultPath = process.env.KEYKING_VAULT_PATH || path.join(process.cwd(), 'api', 'vault.kk');
  const embedded = process.env.KEYKING_VAULT;
  if (embedded) {
    vaultPath = path.join('/tmp', 'kk-vault.bin');
    await fs.writeFile(vaultPath, embedded, 'utf8');
  }
  try {
    return await kk.loadVault(vaultPath);
  } catch (e) {
    console.error('KeyKing vault load failed:', e && e.message);
    return null;
  }
}

async function callProvider(provider, apiKey, userContent) {
  const body = {
    model: provider.model,
    temperature: 0.9,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent }
    ]
  };
  try {
    body.response_format = { type: 'json_object' };
  } catch (e) {}

  const res = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
      'HTTP-Referer': 'https://hackclub-project-ideas',
      'X-Title': 'Hack Club Project Ideas (fan-made)'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(provider.name + ' ' + res.status + ': ' + text.slice(0, 180));
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(provider.name + ' returned empty content');
  return content;
}

function extractIdeas(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    const match = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON found in model response');
    parsed = JSON.parse(match[0]);
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.ideas)) return parsed.ideas;
  throw new Error('Model response missing ideas array');
}

function normalize(ideas, requestedDifficulty) {
  if (!Array.isArray(ideas)) return [];
  return ideas
    .filter((i) => i && typeof i === 'object')
    .map((i) => ({
      title: String(i.title || 'Untitled idea').slice(0, 120),
      difficulty: String(i.difficulty || requestedDifficulty || 'Beginner'),
      timeEstimate: String(i.timeEstimate || i.time || '').slice(0, 60),
      stack: Array.isArray(i.stack)
        ? i.stack.map((s) => String(s)).slice(0, 6)
        : [],
      summary: String(i.summary || i.description || i.pitch || '').slice(0, 200),
      pitch: String(i.pitch || '').slice(0, 600),
      whatYouLearn: Array.isArray(i.whatYouLearn)
        ? i.whatYouLearn.map((s) => String(s)).slice(0, 8)
        : [],
      prerequisites: Array.isArray(i.prerequisites)
        ? i.prerequisites.map((s) => String(s)).slice(0, 6)
        : [],
      howItWorks: String(i.howItWorks || '').slice(0, 900),
      steps: Array.isArray(i.steps)
        ? i.steps.map((s) => String(s)).slice(0, 10)
        : [],
      fileStructure: Array.isArray(i.fileStructure)
        ? i.fileStructure.map((s) => String(s)).slice(0, 14)
        : [],
      stretchGoals: Array.isArray(i.stretchGoals)
        ? i.stretchGoals.map((s) => String(s)).slice(0, 6)
        : [],
      gotchas: Array.isArray(i.gotchas)
        ? i.gotchas.map((s) => String(s)).slice(0, 6)
        : [],
      showOff: String(i.showOff || '').slice(0, 300)
    }));
}

function createSeed(input) {
  const text = JSON.stringify(input || {});
  let seed = 0;
  for (let i = 0; i < text.length; i += 1) {
    seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  }
  return seed || 1;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function choose(rand, list) {
  return list[Math.floor(rand() * list.length) % list.length];
}

function unique(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function buildStack(category, tools, rand) {
  const stackMap = {
    web: ['HTML', 'CSS', 'JavaScript', 'LocalStorage'],
    games: ['HTML Canvas', 'JavaScript', 'requestAnimationFrame', 'Sound effects'],
    hardware: ['Arduino', 'Serial', 'JavaScript', 'Sensor data'],
    ai: ['JavaScript', 'Fetch', 'Prompt templates', 'API integration'],
    mobile: ['HTML', 'CSS', 'JavaScript', 'Responsive design'],
    tools: ['Node.js', 'File I/O', 'JavaScript', 'CLI design'],
    data: ['CSV', 'Chart rendering', 'JavaScript', 'Filtering'],
    creative: ['Canvas', 'SVG', 'CSS animations', 'JavaScript'],
    music: ['Web Audio API', 'JavaScript', 'MIDI', 'UI controls'],
    social: ['JavaScript', 'Forms', 'LocalStorage', 'Sharing'],
    education: ['JavaScript', 'Content structure', 'State', 'Accessibility'],
    science: ['Data visualization', 'JavaScript', 'Charts', 'Math'],
    climate: ['Maps', 'Data tracking', 'JavaScript', 'Charts'],
    robotics: ['Sensors', 'Control loops', 'JavaScript', 'Serial'],
    security: ['Input validation', 'Auth basics', 'JavaScript', 'Logging'],
    accessibility: ['Semantic HTML', 'ARIA', 'Keyboard nav', 'Contrast']
  };
  const stackExtras = {
    web: ['Alpine.js', 'Astro', 'Chart.js', 'IndexedDB'],
    games: ['Howler.js', 'PixiJS', 'Collision detection', 'Sprite sheets'],
    hardware: ['P5.js', 'MQTT', 'Bluetooth', 'Serial Plotter'],
    ai: ['OpenAI-compatible API', 'Prompt engineering', 'Embeddings', 'Streaming responses'],
    mobile: ['PWA', 'Touch gestures', 'Service workers', 'Offline storage'],
    tools: ['Commander.js', 'fs/promises', 'JSON', 'CLI flags'],
    data: ['D3.js', 'CSV parser', 'Filtering', 'Sorting'],
    creative: ['GSAP', 'SVG filters', 'Noise', 'Animation timelines'],
    music: ['Tone.js', 'MIDI output', 'Sequencing', 'Audio envelopes'],
    social: ['Web Share API', 'Notifications', 'Realtime updates', 'Profiles'],
    education: ['Quiz logic', 'Progress tracking', 'Markdown', 'Accessibility'],
    science: ['Scatter plots', 'Regression', 'Units', 'Trend lines'],
    climate: ['Maps', 'Forecast data', 'Carbon calculations', 'Heatmaps'],
    robotics: ['PID control', 'Sensor smoothing', 'Telemetry', 'Motor control'],
    security: ['Hashing', 'Rate limiting', 'Audit logs', 'Threat modeling'],
    accessibility: ['Screen reader testing', 'Focus management', 'High contrast', 'Keyboard support']
  };
  const base = stackMap[category] || ['HTML', 'CSS', 'JavaScript', 'LocalStorage'];
  const extras = stackExtras[category] || ['Local state', 'Forms', 'Routing', 'Responsive layout'];
  const pickedExtras = [choose(rand, extras), choose(rand, extras)].filter(Boolean);
  const merged = tools ? [...base.slice(0, 2), tools, ...pickedExtras, ...base.slice(2)] : [...base, ...pickedExtras];
  return unique(merged).slice(0, 6);
}

function buildSteps(target, stack) {
  return [
    `Pick one clear version of the ${target} idea and write a two-sentence spec.`,
    `Set up the main screen and wire in the core ${stack[0]} or ${stack[1]} pieces.`,
    'Add the primary input or interaction that makes the project feel alive.',
    'Connect the data flow so each change updates the UI immediately.',
    'Style the interface with a consistent color system and readable layout.',
    'Test the rough edges, trim anything unnecessary, and polish the experience.'
  ];
}

function buildFallbackIdeas(request) {
  const rand = seededRandom(createSeed(request));
  const count = Math.min(Math.max(parseInt(request.count, 10) || 6, 1), 10);
  const topic = String(request.topic || '').trim();
  const category = String(request.category || 'all');
  const difficulty = String(request.difficulty || 'any');
  const time = String(request.time || '').trim();
  const tools = String(request.tools || '').trim();
  const extra = String(request.extra || '').trim();
  const categoryLabel = category === 'all'
    ? choose(rand, ['maker', 'builder', 'creative', 'coding'])
    : category;
  const summaryOpeners = ['A', 'A clever', 'A playful', 'A focused', 'A lightweight'];
  const summaryHooks = ['twist', 'build', 'challenge', 'project', 'experiment'];
  const pitchAngles = [
    'make it feel personal from the first screen',
    'keep the core loop simple so you can finish fast',
    'leave room for polish, personality, and custom details',
    'turn a small idea into something you can actually show off'
  ];
  const projectVerbs = ['organize', 'track', 'remix', 'visualize', 'capture', 'discover', 'share', 'automate'];

  return normalize(Array.from({ length: count }, (_, index) => {
    const adjective = choose(rand, ['Pocket', 'Neon', 'Tiny', 'Patchwork', 'Cosmic', 'Arcade', 'Jelly', 'Signal', 'Turbo', 'Orbit']);
    const noun = choose(rand, ['Studio', 'Tracker', 'Lab', 'Map', 'Bot', 'Board', 'Runner', 'Mixer', 'Vault', 'Builder']);
    const hook = choose(rand, summaryHooks);
    const angle = choose(rand, pitchAngles);
    const verb = choose(rand, projectVerbs);
    const focus = topic || categoryLabel;
    const title = topic
      ? `${adjective} ${topic.split(/\s+/)[0].replace(/[^a-z0-9]/gi, '') || noun}`
      : `${adjective} ${noun}`;
    const stack = buildStack(category, tools, seededRandom(createSeed({ request, index, salt: 'stack' })));
    const summaryFocus = topic || `${focus} ${hook}`;
    const pitchFocus = topic || `${focus} ${verb}`;
    const prerequisites = ['A code editor and browser'];
    if (tools) prerequisites.push(`Basic familiarity with ${tools}`);
    if (extra) prerequisites.push(extra);
    if (prerequisites.length === 0) prerequisites.push('none');

    return {
      title: title + (index > 0 ? ` ${index + 1}` : ''),
      difficulty: difficulty === 'any' ? choose(rand, ['Beginner', 'Intermediate', 'Advanced']) : difficulty,
      timeEstimate: time || choose(rand, ['a weekend', 'a single afternoon', '~4 hours', 'about a week']),
      stack,
      summary: `${choose(rand, summaryOpeners)} ${summaryFocus} idea with a playful twist that's small enough to finish and interesting enough to show off.`,
      pitch: `Build a ${pitchFocus} project that feels custom to you and gives you something real to share with friends. ${angle}.`,
      whatYouLearn: [
        choose(rand, ['Project planning', 'UI structure and state', 'Debugging and iteration', 'Working with APIs or data']),
        choose(rand, ['Data modeling', 'Responsive design', 'User flows', 'Input handling']),
        choose(rand, ['Testing and refinement', 'State management', 'Accessibility', 'Deployment basics']),
        choose(rand, ['Animation', 'Error handling', 'File structure', 'Performance tuning'])
      ].filter((item, idx, arr) => arr.indexOf(item) === idx).slice(0, choose(rand, [3, 4])),
      prerequisites,
      howItWorks: `The app keeps a small set of ${focus} ideas and blends them with the details you picked, then it surfaces a build plan with a slightly different angle each time. The result is still concrete and usable, but each card feels like its own mini brief instead of a copy of the others.`,
      steps: buildSteps(topic || categoryLabel || 'project', stack),
      fileStructure: [
        'project/',
        '  index.html',
        '  style.css',
        '  script.js',
        '  data/',
        '  assets/'
      ],
      stretchGoals: [
        choose(rand, ['Add sharing or export features', 'Polish the visuals and motion', 'Save user progress locally', 'Make it work on mobile']),
        choose(rand, ['Add a second mode', 'Improve keyboard navigation', 'Add saved settings', 'Make the data refresh live']),
        choose(rand, ['Ship a themed UI skin', 'Add search or filtering', 'Export a screenshot', 'Add sound or animation']),
        choose(rand, ['Make it collaborative', 'Add history or undo', 'Support offline use', 'Add analytics or logs'])
      ].filter((item, idx, arr) => arr.indexOf(item) === idx).slice(0, choose(rand, [3, 4])),
      gotchas: [
        'Keep the first version tiny',
        'Test one flow at a time',
        'Do not overcomplicate the data model'
      ],
      showOff: 'Post it in Hack Club Slack, push it to GitHub, and demo it to a friend once it works.'
    };
  }), difficulty);
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const ip = getClientIp(req);
  if (rateLimited(ip)) {
    res.writeHead(429, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many requests. Slow down a touch.' }));
    return;
  }

  const payload = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const category = String(payload.category || 'all');
  const difficulty = String(payload.difficulty || 'any');
  const count = Math.min(Math.max(parseInt(payload.count, 10) || 6, 1), 10);
  const topic = String(payload.topic || '').trim().slice(0, 160);
  const time = String(payload.time || '').trim().slice(0, 60);
  const tools = String(payload.tools || '').trim().slice(0, 160);
  const extra = String(payload.extra || '').trim().slice(0, 200);

  let userContent = 'Generate ' + count + ' fresh, creative project ideas for a teenage coder.';
  if (topic) userContent += ' Theme/topic: "' + topic + '". Lean into this theme.';
  if (category && category !== 'all') userContent += ' Category: ' + category + '.';
  if (difficulty && difficulty !== 'any') userContent += ' Difficulty: ' + difficulty + '.';
  if (time) userContent += ' Time the builder has: ' + time + '. Make scope fit.';
  if (tools) userContent += ' Tech they already know: ' + tools + '. Prefer those tools in the stack.';
  if (extra) userContent += ' Extra constraint/wish: ' + extra + '.';
  userContent += ' Return JSON only.';

  let vault;
  try {
    vault = await loadKeyKingVault();
  } catch (e) {
    vault = null;
  }

  const errors = [];
  for (const provider of PROVIDERS) {
    const apiKey = resolveKey(vault, process.env, provider.keyNames);
    if (!apiKey) continue;
    try {
      const content = await callProvider(provider, apiKey, userContent);
      const ideas = normalize(extractIdeas(content), difficulty);
      if (ideas.length > 0) {
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ideas }));
        return;
      }
      errors.push(provider.name + ': no ideas parsed');
    } catch (e) {
      errors.push(provider.name + ': ' + (e && e.message));
    }
  }

  const fallbackIdeas = buildFallbackIdeas({ category, difficulty, count, topic, time, tools, extra });
  if (fallbackIdeas.length > 0) {
    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ideas: fallbackIdeas, source: 'fallback' }));
    return;
  }

  res.writeHead(502, { ...headers, 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      error: 'No AI provider available. Check that your KeyKing vault or provider keys are configured.',
      details: errors
    })
  );
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

export const config = {
  runtime: 'nodejs'
};
