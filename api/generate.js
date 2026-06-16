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
