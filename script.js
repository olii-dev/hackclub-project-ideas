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
  { id: 'creative', label: 'Creative', color: '#ff8c37' }
];

const DIFFICULTY_LABEL = {
  Beginner: 'Beginner',
  Intermediate: 'Intermediate',
  Advanced: 'Advanced'
};

const state = {
  category: 'all',
  loading: false,
  ideas: []
};

const COOLDOWN_MS = 4000;

const el = (sel) => document.querySelector(sel);
const results = el('#results');
const generateBtn = el('#generateBtn');

function buildChips() {
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
  desc.textContent = idea.description || '';

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

  const desc = document.createElement('p');
  desc.className = 'modal-desc';
  desc.textContent = idea.description || '';

  card.appendChild(close);
  card.appendChild(eyebrow);
  card.appendChild(h2);
  card.appendChild(desc);

  if (idea.stack && idea.stack.length) {
    const sec = document.createElement('div');
    sec.className = 'modal-section';
    const h4 = document.createElement('h4');
    h4.textContent = 'Suggested tools & tech';
    sec.appendChild(h4);
    const st = document.createElement('div');
    st.className = 'stack';
    idea.stack.forEach((t) => {
      const s = document.createElement('span');
      s.textContent = t;
      st.appendChild(s);
    });
    sec.appendChild(st);
    card.appendChild(sec);
  }

  if (idea.steps && idea.steps.length) {
    const sec = document.createElement('div');
    sec.className = 'modal-section';
    const h4 = document.createElement('h4');
    h4.textContent = 'How to build it';
    sec.appendChild(h4);
    const ol = document.createElement('ol');
    ol.className = 'steps';
    idea.steps.forEach((step) => {
      const li = document.createElement('li');
      li.textContent = step;
      ol.appendChild(li);
    });
    sec.appendChild(ol);
    card.appendChild(sec);
  }

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  close.focus();
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
    renderIdeas(state.ideas);
  } catch (err) {
    renderError(err && err.message ? err.message : 'Network error.');
  } finally {
    state.loading = false;
    setTimeout(() => { generateBtn.disabled = false; }, COOLDOWN_MS);
  }
}

generateBtn.addEventListener('click', generate);
el('#advToggle').addEventListener('click', toggleAdvanced);
el('#modalBackdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
el('#topicInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); generate(); }
});

buildChips();
renderEmpty();
