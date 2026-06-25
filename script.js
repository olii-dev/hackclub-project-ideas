import { inject } from '@vercel/analytics';

// Initialize Vercel Web Analytics
inject({
  mode: 'production',
});

const API_BASE = '';

const CATEGORIES = [
  { id: 'all', label: 'All', color: '#8492a6' },
  { id: 'web', label: 'Web', color: '#338eda' },
  { id: 'games', label: 'Games', color: '#a633d6' },
  { id: 'hardware', label: 'Hardware', color: '#ff8c37' },
  { id: 'ai', label: 'AI / ML', color: '#33d6a6' },
  { id: 'mobile', label: 'Mobile', color: '#5bc0de' },
  { id: 'tools', label: 'Tools', color: '#f1c40f' },
  { id: 'data', label: 'Data', color: '#ec3750' },
  { id: 'creative', label: 'Creative', color: '#ff8c37' },
  { id: 'music', label: 'Music', color: '#a633d6' },
  { id: 'social', label: 'Social', color: '#338eda' },
  { id: 'education', label: 'Education', color: '#33d6a6' },
  { id: 'science', label: 'Science', color: '#5bc0de' },
  { id: 'climate', label: 'Climate', color: '#33d6a6' },
  { id: 'robotics', label: 'Robotics', color: '#ff8c37' },
  { id: 'security', label: 'Security', color: '#ec3750' },
  { id: 'accessibility', label: 'Accessibility', color: '#f1c40f' },
  { id: '3d', label: '3D / VR', color: '#a633d6' }
];

const DIFFICULTY_LABEL = {
  Beginner: 'Beginner',
  Intermediate: 'Intermediate',
  Advanced: 'Advanced'
};

const state = {
  category: 'all',
  loading: false,
  ideas: [],
  view: 'main'
};

const COOLDOWN_MS = 4000;
const HISTORY_KEY = 'hcpi-history';
const HISTORY_MAX = 12;

const el = (sel) => document.querySelector(sel);
const results = el('#results');
const generateBtn = el('#generateBtn');

function buildCategoryChips() {
  const catRow = el('#categoryRow');
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.dataset.id = cat.id;
    btn.dataset.cat = cat.id !== 'all' ? '1' : '';
    btn.setAttribute('aria-pressed', String(cat.id === state.category));
    const dot = document.createElement('span');
    dot.className = 'chip-dot';
    dot.style.background = cat.color;
    const label = document.createElement('span');
    label.textContent = cat.label;
    btn.appendChild(dot);
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      state.category = cat.id;
      catRow.querySelectorAll('.chip').forEach((c) => {
        c.setAttribute('aria-pressed', String(c.dataset.id === cat.id));
      });
    });
    catRow.appendChild(btn);
  });
}

function toggleAdvanced() {
  const adv = el('#advanced');
  const toggle = el('#advToggle');
  const open = adv.hasAttribute('hidden');
  if (open) {
    adv.removeAttribute('hidden');
  } else {
    adv.setAttribute('hidden', '');
  }
  toggle.setAttribute('aria-expanded', String(open));
}

function gatherRequest() {
  const difficulty = el('#difficultySelect').value;
  const count = parseInt(el('#countSelect').value, 10) || 6;
  const topic = el('#topicInput').value.trim();
  const time = el('#timeSelect').value.trim();
  const tools = el('#toolsInput').value.trim();
  const extra = el('#extraInput').value.trim();
  return {
    category: state.category,
    difficulty,
    count,
    topic,
    time,
    tools,
    extra
  };
}

function renderEmpty() {
  results.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'empty';
  wrap.innerHTML =
    '<div class="emoji">⚡</div>' +
    '<h2>Let\'s find your next build.</h2>' +
    '<p>Type a topic, pick a category, and hit <strong>Generate fresh ideas</strong> to get a batch of project ideas tailored to you.</p>' +
    '<p class="hint">Tip: open "More options" to set time, tech you know, and constraints.</p>';
  results.appendChild(wrap);
}

function renderSkeletons(n) {
  results.innerHTML = '';
  const note = document.createElement('p');
  note.className = 'loading-note';
  note.textContent = 'Cooking up fresh ideas…';
  results.appendChild(note);
  const grid = document.createElement('div');
  grid.className = 'skeleton-grid';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'skeleton';
    grid.appendChild(s);
  }
  results.appendChild(grid);
}

function renderError(message) {
  results.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'error';
  box.innerHTML =
    '<h2>Something went sideways.</h2>' +
    '<p>' + escapeHtml(message) + '</p>';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'retry';
  btn.textContent = 'Try again';
  btn.addEventListener('click', generate);
  box.appendChild(btn);
  results.appendChild(box);
}

function renderIdeas(ideas) {
  results.innerHTML = '';
  if (!ideas || ideas.length === 0) {
    renderEmpty();
    return;
  }
  const head = document.createElement('div');
  head.className = 'results-head';
  const h2 = document.createElement('h2');
  h2.textContent = ideas.length + ' fresh idea' + (ideas.length === 1 ? '' : 's');
  head.appendChild(h2);
  const regen = document.createElement('button');
  regen.type = 'button';
  regen.className = 'regen';
  regen.textContent = '↻ Generate again';
  regen.addEventListener('click', generate);
  head.appendChild(regen);
  results.appendChild(head);

  const grid = document.createElement('div');
  grid.className = 'grid';
  ideas.forEach((idea) => grid.appendChild(buildCard(idea)));
  results.appendChild(grid);
}

function buildCard(idea) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  const diff = normalizeDifficulty(idea.difficulty);

  const top = document.createElement('div');
  top.className = 'card-top';
  const diffEl = document.createElement('span');
  diffEl.className = 'diff ' + diff;
  diffEl.textContent = DIFFICULTY_LABEL[diff] || 'Idea';
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = idea.timeEstimate ? '⏱ ' + idea.timeEstimate : '';
  top.appendChild(diffEl);
  top.appendChild(time);

  const title = document.createElement('h3');
  title.textContent = idea.title || 'Untitled idea';

  const desc = document.createElement('p');
  desc.textContent = idea.summary || idea.description || '';

  const stack = document.createElement('div');
  stack.className = 'stack';
  (idea.stack || []).slice(0, 5).forEach((t) => {
    const s = document.createElement('span');
    s.textContent = t;
    stack.appendChild(s);
  });

  card.appendChild(top);
  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(stack);
  card.addEventListener('click', () => openModal(idea));
  return card;
}

function normalizeDifficulty(d) {
  const v = String(d || '').toLowerCase();
  if (v.indexOf('adv') === 0) return 'Advanced';
  if (v.indexOf('int') === 0) return 'Intermediate';
  return 'Beginner';
}

function openModal(idea) {
  const modal = el('#modal');
  const card = el('#modalCard');
  const diff = normalizeDifficulty(idea.difficulty);
  card.innerHTML = '';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'modal-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'modal-eyebrow';
  const diffEl = document.createElement('span');
  diffEl.className = 'diff ' + diff;
  diffEl.textContent = DIFFICULTY_LABEL[diff] || 'Idea';
  eyebrow.appendChild(diffEl);
  if (idea.timeEstimate) {
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = '⏱ ' + idea.timeEstimate;
    eyebrow.appendChild(time);
  }

  const h2 = document.createElement('h2');
  h2.textContent = idea.title || 'Untitled idea';

  card.appendChild(close);
  card.appendChild(eyebrow);
  card.appendChild(h2);

  if (idea.pitch) {
    const pitch = document.createElement('p');
    pitch.className = 'modal-pitch';
    pitch.textContent = idea.pitch;
    card.appendChild(pitch);
  }

  const meta = document.createElement('div');
  meta.className = 'modal-meta';
  if (idea.timeEstimate) {
    meta.appendChild(metaItem('⏱', idea.timeEstimate));
  }
  if (idea.difficulty) {
    meta.appendChild(metaItem('🎯', DIFFICULTY_LABEL[diff] || idea.difficulty));
  }
  if (idea.stack && idea.stack.length) {
    meta.appendChild(metaItem('🛠', idea.stack.slice(0, 4).join(', ')));
  }
  if (meta.childNodes.length) card.appendChild(meta);

  if (idea.stack && idea.stack.length) {
    card.appendChild(buildSection('Suggested tools & tech', buildChips(idea.stack)));
  }

  if (idea.whatYouLearn && idea.whatYouLearn.length) {
    card.appendChild(buildSection('What you\'ll learn', buildChecklist(idea.whatYouLearn, 'learn')));
  }

  if (idea.prerequisites && idea.prerequisites.length) {
    const items = idea.prerequisites.filter((p) => p && p.toLowerCase() !== 'none');
    if (items.length) {
      card.appendChild(buildSection('Before you start', buildBulletList(items, 'prereq')));
    }
  }

  if (idea.howItWorks) {
    card.appendChild(buildSection('How it works', buildParagraph(idea.howItWorks, 'how')));
  }

  if (idea.gotchas && idea.gotchas.length) {
    card.appendChild(buildSection('Watch out for', buildWarnList(idea.gotchas)));
  }

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  close.focus();
}

function metaItem(icon, text) {
  const item = document.createElement('div');
  item.className = 'meta-item';
  const ic = document.createElement('span');
  ic.className = 'meta-icon';
  ic.textContent = icon;
  const tx = document.createElement('span');
  tx.textContent = text;
  item.appendChild(ic);
  item.appendChild(tx);
  return item;
}

function buildSection(title, contentEl) {
  const sec = document.createElement('div');
  sec.className = 'modal-section';
  const h4 = document.createElement('h4');
  h4.textContent = title;
  sec.appendChild(h4);
  sec.appendChild(contentEl);
  return sec;
}

function buildChips(items) {
  const st = document.createElement('div');
  st.className = 'stack';
  items.forEach((t) => {
    const s = document.createElement('span');
    s.textContent = t;
    st.appendChild(s);
  });
  return st;
}

function buildChecklist(items, variant) {
  const ul = document.createElement('ul');
  ul.className = 'rich-list checklist ' + variant;
  items.forEach((it) => {
    const li = document.createElement('li');
    li.textContent = it;
    ul.appendChild(li);
  });
  return ul;
}

function buildBulletList(items, variant) {
  const ul = document.createElement('ul');
  ul.className = 'rich-list bullets ' + variant;
  items.forEach((it) => {
    const li = document.createElement('li');
    li.textContent = it;
    ul.appendChild(li);
  });
  return ul;
}

function buildWarnList(items) {
  const ul = document.createElement('ul');
  ul.className = 'rich-list warn';
  items.forEach((it) => {
    const li = document.createElement('li');
    li.textContent = it;
    ul.appendChild(li);
  });
  return ul;
}

function buildParagraph(text, variant) {
  const p = document.createElement('p');
  p.className = 'rich-p ' + variant;
  p.textContent = text;
  return p;
}

function closeModal() {
  const modal = el('#modal');
  modal.hidden = true;
  document.body.style.overflow = '';
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function generate() {
  if (state.loading) return;
  state.loading = true;
  generateBtn.disabled = true;
  const req = gatherRequest();
  renderSkeletons(req.count);
  try {
    const res = await fetch(API_BASE + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (res.status === 429) {
      throw new Error('Too many requests — give it a few seconds and try again.');
    }
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 200); } catch (e) {}
      throw new Error('The ideas service had a problem (' + res.status + '). ' + detail);
    }
    const data = await res.json();
    const ideas = Array.isArray(data) ? data : data.ideas;
    state.ideas = Array.isArray(ideas) ? ideas : [];
    saveToHistory(state.ideas, req);
    renderIdeas(state.ideas);
  } catch (err) {
    renderError(err && err.message ? err.message : 'Network error.');
  } finally {
    state.loading = false;
    setTimeout(() => { generateBtn.disabled = false; }, COOLDOWN_MS);
  }
}

function saveToHistory(ideas, req) {
  if (!ideas || !ideas.length) return;
  const catLabel = (CATEGORIES.find((c) => c.id === req.category) || {}).label || 'All';
  const batch = {
    id: Date.now(),
    time: new Date().toISOString(),
    topic: req.topic || '',
    category: catLabel,
    difficulty: req.difficulty === 'any' ? '' : req.difficulty,
    ideas: ideas.map((i) => ({
      title: i.title,
      difficulty: i.difficulty,
      timeEstimate: i.timeEstimate,
      stack: i.stack,
      summary: i.summary,
      pitch: i.pitch,
      whatYouLearn: i.whatYouLearn,
      prerequisites: i.prerequisites,
      howItWorks: i.howItWorks,
      gotchas: i.gotchas
    }))
  };
  const history = loadHistory();
  history.unshift(batch);
  if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {}
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function renderHistory() {
  state.view = 'history';
  const history = loadHistory();
  results.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'results-head';
  const h2 = document.createElement('h2');
  h2.textContent = 'Your idea history';
  head.appendChild(h2);
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'regen';
  back.textContent = '← Back to generate';
  back.addEventListener('click', () => {
    state.view = 'main';
    renderIdeas(state.ideas);
  });
  head.appendChild(back);
  results.appendChild(head);

  if (history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML =
      '<div class="emoji">📭</div>' +
      '<h2>No history yet.</h2>' +
      '<p>Generate some ideas and they\'ll show up here so you can revisit them later.</p>';
    results.appendChild(empty);
    return;
  }

  const clearWrap = document.createElement('div');
  clearWrap.className = 'clear-wrap';
  const count = document.createElement('span');
  count.className = 'history-count';
  count.textContent = history.length + ' batch' + (history.length === 1 ? '' : 'es') + ' saved';
  clearWrap.appendChild(count);
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'clear-btn';
  clear.textContent = 'Clear all';
  clear.addEventListener('click', () => {
    try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
    renderHistory();
  });
  clearWrap.appendChild(clear);
  results.appendChild(clearWrap);

  history.forEach((batch) => {
    const group = document.createElement('div');
    group.className = 'history-group';

    const gh = document.createElement('div');
    gh.className = 'history-group-head';
    const meta = document.createElement('span');
    meta.className = 'history-meta';
    const parts = [];
    parts.push(formatTime(batch.time));
    if (batch.topic) parts.push('“' + batch.topic + '”');
    if (batch.category && batch.category !== 'All') parts.push(batch.category);
    if (batch.difficulty) parts.push(batch.difficulty);
    meta.textContent = parts.join(' · ');
    gh.appendChild(meta);
    const count2 = document.createElement('span');
    count2.className = 'history-batch-count';
    count2.textContent = batch.ideas.length + ' ideas';
    gh.appendChild(count2);
    group.appendChild(gh);

    const grid = document.createElement('div');
    grid.className = 'grid';
    batch.ideas.forEach((idea) => grid.appendChild(buildCard(idea)));
    group.appendChild(grid);
    results.appendChild(group);
  });
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}

generateBtn.addEventListener('click', generate);
el('#advToggle').addEventListener('click', toggleAdvanced);
el('#historyBtn').addEventListener('click', () => {
  if (state.view === 'history') {
    state.view = 'main';
    renderIdeas(state.ideas);
  } else {
    renderHistory();
  }
});
el('#modalBackdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
el('#topicInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); generate(); }
});

buildCategoryChips();
renderEmpty();
