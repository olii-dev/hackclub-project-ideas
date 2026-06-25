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

function shuffleWithRand(list, rand) {
  const items = list.slice();
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
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

function pickFrame(category, rand) {
  const framesByCategory = {
    music: [
      {
        noun: 'beat lab',
        verb: 'compose',
        summary: 'A tiny music tool that helps you explore rhythms, patterns, and quick ideas without getting buried in complexity.',
        pitch: 'Build a playful music tool that lets you experiment fast, hear results immediately, and make something you can actually perform with or share.',
        learn: ['Audio event timing', 'Pattern design', 'Immediate feedback', 'UI controls'],
        steps: [
          'Create a simple timeline or pad grid that responds instantly to clicks.',
          'Wire in sound playback so every action produces an audible result.',
          'Add controls for tempo, pattern length, or instrument selection.',
          'Store favorite patterns so the user can come back to them later.',
          'Polish the interface with a clear visual rhythm and strong contrast.'
        ]
      },
      {
        noun: 'sampler board',
        verb: 'remix',
        summary: 'A remix playground for stitching short sounds, loops, or samples into something that feels like your own instrument.',
        pitch: 'Make a sample-mashing instrument that feels fun to tap, easy to tweak, and satisfying to show off to friends.',
        learn: ['Clip handling', 'Sequencing', 'Gesture design', 'Audio mixing'],
        steps: [
          'Load a small set of sample pads or loop slots into the UI.',
          'Add playback controls so clips can be triggered on demand.',
          'Let the user rearrange or mute parts to create new combinations.',
          'Add a save or export option for favorite mixes.',
          'Test it on mobile so tapping feels clean and responsive.'
        ]
      }
    ],
    games: [
      {
        noun: 'arcade loop',
        verb: 'dodge',
        summary: 'A fast game prototype with one satisfying mechanic that is easy to learn and surprisingly hard to master.',
        pitch: 'Build a small arcade game around a single funny or skill-based mechanic so the whole thing feels polished instead of bloated.',
        learn: ['Game loops', 'Collision logic', 'Balancing difficulty', 'Animation timing'],
        steps: [
          'Set up the main loop and the core player movement.',
          'Add one clear obstacle or enemy that creates tension.',
          'Track score, lives, or survival time to create a win condition.',
          'Tune speed and spacing until the game feels fair and punchy.',
          'Add sound or screen shake to make hits and victories satisfying.'
        ]
      },
      {
        noun: 'puzzle run',
        verb: 'solve',
        summary: 'A puzzle-forward game where the fun comes from figuring out a compact rule set and beating your own best time.',
        pitch: 'Make a puzzle game with a tight rule set, clean feedback, and enough challenge that people want to try one more run.',
        learn: ['State machines', 'Level design', 'Feedback design', 'Restart flows'],
        steps: [
          'Define the puzzle rule in one sentence and keep it extremely focused.',
          'Build one level and make sure the interaction is obvious.',
          'Add a restart button and quick fail feedback so trying again feels easy.',
          'Create two or three levels that teach the mechanic gradually.',
          'Refine the pacing so the challenge rises without getting confusing.'
        ]
      }
    ],
    tools: [
      {
        noun: 'workflow bot',
        verb: 'automate',
        summary: 'A practical helper that shaves time off a boring task by turning a repetitive workflow into one clean button or command.',
        pitch: 'Build a tiny utility that saves time every week, so the project feels immediately useful instead of just theoretical.',
        learn: ['File handling', 'Command design', 'Edge-case thinking', 'Automation'],
        steps: [
          'Choose one repetitive task and write down the exact steps by hand.',
          'Convert that flow into a single input or command the app can run.',
          'Add output formatting so the result is easy to read or reuse.',
          'Handle one obvious failure mode so the tool does not break on simple mistakes.',
          'Add a small quality-of-life feature that makes the tool feel thoughtful.'
        ]
      },
      {
        noun: 'dashboard',
        verb: 'organize',
        summary: 'A dashboard that turns scattered info into something readable, trackable, and a lot less annoying to manage.',
        pitch: 'Build a dashboard that makes a messy process feel under control, with clear summaries and fast access to the details.',
        learn: ['Data shaping', 'Filtering', 'Layout systems', 'Status design'],
        steps: [
          'Define the main data points the dashboard should show first.',
          'Create a strong top section with the most important summary numbers.',
          'Add filters or search so the user can narrow the view quickly.',
          'Show the detail rows or cards in a clean, scannable format.',
          'Make sure empty and error states still feel intentional.'
        ]
      }
    ],
    creative: [
      {
        noun: 'visual toy',
        verb: 'morph',
        summary: 'A visual playground for making shapes, motion, or color feel alive in a way that is more art than app.',
        pitch: 'Build a visual toy that rewards curiosity, lets people experiment freely, and makes something beautiful happen quickly.',
        learn: ['Animation timing', 'Canvas or SVG', 'Color systems', 'Interactive art'],
        steps: [
          'Pick one visual effect that can carry the whole project.',
          'Set up a simple input so the user can influence the visuals.',
          'Layer in motion, color changes, or randomness for personality.',
          'Add a reset or save button so experimenting feels safe.',
          'Tighten the spacing and motion until the whole thing feels intentional.'
        ]
      },
      {
        noun: 'style lab',
        verb: 'design',
        summary: 'A style experiment where the app itself becomes part of the creative output, not just the container around it.',
        pitch: 'Make a stylized interface or generator that feels expressive, memorable, and a little unexpected when people open it.',
        learn: ['Typography', 'Component systems', 'Motion', 'Visual hierarchy'],
        steps: [
          'Pick a visual mood and set up a tiny design system around it.',
          'Build the main interaction so the style changes in response to input.',
          'Make the layout responsive so the experiment still works on small screens.',
          'Add one surprising effect that gives the app a signature feel.',
          'Trim clutter so the style reads clearly at first glance.'
        ]
      }
    ]
  };

  const fallbackFrames = [
    {
      noun: 'studio',
      verb: 'build',
      summary: 'A compact project studio that turns a small idea into something tangible and fun to refine.',
      pitch: 'Build a project that feels personal, practical, and easy to explain, while still leaving room for creativity and polish.',
      learn: ['Planning', 'UI structure', 'Iteration', 'Polish'],
      steps: [
        'Define the smallest useful version of the project.',
        'Set up the main view and wire in the core interaction.',
        'Add one feature that makes the project feel uniquely yours.',
        'Make the data or state update cleanly as the user interacts.',
        'Polish the visuals and remove anything distracting.'
      ]
    },
    {
      noun: 'tracker',
      verb: 'track',
      summary: 'A focused tracker that helps keep something useful visible, organized, and easy to act on.',
      pitch: 'Make a tracker that turns a messy habit, goal, or collection into something clear enough to use every day.',
      learn: ['State management', 'Sorting', 'Persistence', 'User flows'],
      steps: [
        'Choose the one thing the tracker should help the user understand.',
        'Create the basic input and display loop first.',
        'Add a way to store or restore the items later.',
        'Surface totals, categories, or recent activity in a readable way.',
        'Refine the layout so it is fast to scan and simple to use.'
      ]
    },
    {
      noun: 'map',
      verb: 'explore',
      summary: 'A map-style project that turns a set of places, ideas, or events into something people can browse and discover.',
      pitch: 'Build something map-like so users can explore data spatially, zoom into details, and instantly see patterns.',
      learn: ['Geographic thinking', 'Filtering', 'Search', 'Annotation'],
      steps: [
        'Decide what the map should help people discover.',
        'Render the main visual regions or markers first.',
        'Add hover or click details so the data becomes explorable.',
        'Create filters that narrow the view without cluttering the screen.',
        'Make the interaction smooth enough that people want to keep clicking around.'
      ]
    }
  ];

  return (framesByCategory[category] || fallbackFrames)[Math.floor(rand() * (framesByCategory[category] || fallbackFrames).length)];
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

  return normalize(Array.from({ length: count }, (_, index) => {
    const frame = pickFrame(category, seededRandom(createSeed({ request, index, salt: 'frame' })));
    const adjective = choose(rand, ['Pocket', 'Neon', 'Tiny', 'Patchwork', 'Cosmic', 'Arcade', 'Jelly', 'Signal', 'Turbo', 'Orbit', 'Mossy', 'Crystal']);
    const noun = choose(rand, ['Studio', 'Tracker', 'Lab', 'Map', 'Bot', 'Board', 'Runner', 'Mixer', 'Vault', 'Builder', 'Deck', 'Workshop']);
    const focus = topic || categoryLabel;
    const targetWord = topic || focus || frame.noun;
    const title = topic
      ? `${adjective} ${topic.split(/\s+/)[0].replace(/[^a-z0-9]/gi, '') || noun}`
      : `${adjective} ${choose(rand, [frame.noun, noun])}`;
    const stack = buildStack(category, tools, seededRandom(createSeed({ request, index, salt: 'stack' })));
    const mergedLearn = shuffleWithRand([...frame.learn, choose(rand, ['Debugging', 'Accessibility', 'Deployment', 'Animation', 'Iteration'])], seededRandom(createSeed({ request, index, salt: 'learn' })));
    const frameSteps = shuffleWithRand(frame.steps, seededRandom(createSeed({ request, index, salt: 'steps' })));
    const prerequisites = ['A code editor and browser'];
    if (tools) prerequisites.push(`Basic familiarity with ${tools}`);
    if (extra) prerequisites.push(extra);
    if (prerequisites.length === 0) prerequisites.push('none');

    const summaryBase = topic
      ? `${frame.summary.replace(/a small idea/i, topic)} ${choose(rand, ['It leans into', 'It focuses on', 'It plays with'])} ${focus}.`
      : frame.summary;
    const pitchBase = topic
      ? `${frame.pitch} It is shaped around ${focus} so the result feels specific instead of generic.`
      : frame.pitch;
    const howItWorks = topic
      ? `The project centers on ${targetWord} and gives the builder one clear interaction to learn first, then a second layer of polish or control. Each part is set up so the idea feels focused, but still leaves room to customize the details and style.`
      : `The project centers on ${frame.noun} and gives the builder one clear interaction to learn first, then a second layer of polish or control. Each part is set up so the idea feels focused, but still leaves room to customize the details and style.`;

    return {
      title: title + (index > 0 ? ` ${index + 1}` : ''),
      difficulty: difficulty === 'any' ? choose(rand, ['Beginner', 'Intermediate', 'Advanced']) : difficulty,
      timeEstimate: time || choose(rand, ['a weekend', 'a single afternoon', '~4 hours', 'about a week']),
      stack,
      summary: summaryBase,
      pitch: pitchBase,
      whatYouLearn: mergedLearn.slice(0, choose(rand, [3, 4])),
      prerequisites,
      howItWorks,
      steps: frameSteps,
      fileStructure: [
        'project/',
        '  index.html',
        '  style.css',
        '  script.js',
        '  data/',
        '  assets/'
      ],
      stretchGoals: [
        choose(rand, ['Add sharing or export features', 'Polish the visuals and motion', 'Save user progress locally', 'Make it work on mobile', 'Add a second mode']),
        choose(rand, ['Improve keyboard navigation', 'Add saved settings', 'Make the data refresh live', 'Add search or filtering', 'Export a screenshot']),
        choose(rand, ['Ship a themed UI skin', 'Add sound or animation', 'Make it collaborative', 'Add history or undo', 'Support offline use']),
        choose(rand, ['Add analytics or logs', 'Let users remix the output', 'Create a cleaner empty state', 'Add a tutorial mode', 'Support dark mode'])
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
