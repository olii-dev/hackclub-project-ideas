const API_BASE = '';

const CATEGORIES = [
  { id: 'all', label: 'All categories' },
  { id: 'web', label: 'Web' },
  { id: 'games', label: 'Games' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'ai', label: 'AI / ML' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'tools', label: 'Tools' },
  { id: 'data', label: 'Data' },
  { id: 'creative', label: 'Creative' },
  { id: 'music', label: 'Music' },
  { id: 'social', label: 'Social' },
  { id: 'education', label: 'Education' },
  { id: 'science', label: 'Science' },
  { id: 'climate', label: 'Climate' },
  { id: 'robotics', label: 'Robotics' },
  { id: 'security', label: 'Security' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: '3d', label: '3D / VR' }
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
const FAV_KEY = 'hcpi-favorites';
const HISTORY_MAX = 12;

const LOADING_QUOTES = [
  'Cooking up fresh ideas…',
  'Wiring up some LEDs…',
  'Compiling your dreams…',
  'Brewing something cool…',
  'Soldering ideas together…',
  'Asking the code goblins…',
  'Drafting blueprints…',
  'Spinning up the idea engine…',
  'Turning coffee into code…',
  'Consulting the Hack Club oracle…',
  'Vibecoding your next project…',
  'Fetching pixels and dreams…',
  'Channeling teen energy…',
  'Debugging the muse…',
  'Planting seeds of inspiration…'
];

const SURPRISE_TOPICS = [
  'frogs', 'mushrooms', 'lighthouses', 'comets', 'tardigrades', 'kintsugi',
  'mirages', 'fireflies', 'pangolins', 'narwhals', 'sloths', 'hummingbirds',
  'porcupines', 'armadillos', 'axolotls', 'platypuses', 'cuttlefish',
  'octopuses', 'mantis shrimp', 'honeybees', 'jumping spiders', 'naked mole rats',
  'glaciers', 'volcanoes', 'fossils', 'auroras', 'monsoons', 'dunes',
  'coral reefs', 'tide pools', 'kelp forests', 'geysers', 'canyons',
  'stalactites', 'permafrost', 'moss', 'lichen', 'bamboo', 'banyan trees',
  'redwoods', 'cherry blossoms', 'venus flytraps', 'pitcher plants',
  'sunflowers', 'dandelions', 'thistles', 'orchids', 'ferns',
  'bigfoot', 'mothman', 'kraken', 'chupacabra', 'jersey devil',
  'loch ness', 'yeti', 'fairies', 'goblins', 'ghosts', 'witches',
  'werewolves', 'vampires', 'zombies', 'sirens', 'sphinx', 'griffins',
  'dragons', 'phoenixes', 'unicorns', 'mermaids', 'centaurs', 'golems',
  'synths', 'guitars', 'ukuleles', 'harmonicas', 'theremins', 'kalimbas',
  'bagpipes', 'sitar', 'steel drums', 'kazoo', 'music boxes', 'wind chimes',
  'gardens', 'greenhouses', 'terrariums', 'aquariums', 'vivariums',
  'planetariums', 'museums', 'libraries', 'archives', 'galleries',
  'observatories', 'labyrinths', 'clocktowers', 'windmills', 'waterwheels',
  'carnivals', 'festivals', 'parades', 'circuses', 'night markets',
  'flea markets', 'auctions', 'raffles', 'arcades', 'roller rinks',
  'board games', 'card games', 'dice games', 'marbles', 'kites',
  'jigsaw puzzles', 'rubik cubes', 'origami', 'kirigami', 'calligraphy',
  'bookbinding', 'letterpress', 'woodblock printing', 'enamel pins',
  'stickers', 'patches', 'zines', 'comic books', 'chapbooks',
  'polaroids', 'cassettes', 'vinyl', 'floppy disks', 'punch cards',
  'viewmasters', 'tamagotchi', 'viewfinders', 'typewriters', 'telegraphs',
  'chess', 'go', 'mahjong', 'backgammon', 'dominoes',
  'rickshaws', 'gondolas', 'trams', 'trolleys', 'funiculars',
  'dirigibles', 'gliders', 'hovercrafts', 'submarines', 'rowboats',
  'eclipses', 'meteor showers', 'constellations', 'nebulae',
  'black holes', 'pulsars', 'quasars', 'asteroids', 'moons',
  'crystals', 'geodes', 'obsidian', 'amber', ' jade', 'agates',
  'salt flats', 'hot springs', 'ice caves', 'glowworms', 'foxfire',
  'thunderstorms', 'monsoon rain', 'the smell of rain',
  'the last day of summer', 'a quiet lighthouse', 'friendly monsters',
  'haunted small towns', 'paper airplanes', 'cassette tapes',
  'vending machines', 'deep sea creatures', 'ancient libraries',
  'lost languages', 'whale song', 'desert nights', 'fairy rings',
  'street food', 'ancient mythology', 'pixel art', 'stargazing',
  'roller coasters', 'time travel', 'magic tricks', 'fermentation',
  'bioluminescence', 'spinning tops', 'wind-up toys', 'pocket watches',
  'dial-up modems', 'old radios', 'zoetropes', 'secret notes',
  'tiny radio stations', 'time capsules', 'messages in bottles',
  'pen pals', 'compliments hotline', 'gratitude wall',
  'weather machine', 'tiny ecosystem', 'constellation drawing',
  'mood into color', 'sticker scanner', 'kite telemetry',
  'bird feeder alerts', 'rain gauge', 'smart doorbell', 'plant selfies',
  'local transit map', 'neighbourhood dogs', 'fridge hum',
  'cassette click', 'fresh snow crunch', 'radio static',
  'vending machine glow', 'kitchen drum machine', 'heartbeat melody',
  'lo-fi beats', 'weather playlist', 'homework rap',
  'tiny robot town', 'cloud factory', 'never-stopping train',
  'empty planet lighthouse', 'rainbow forest', 'ice cream castle',
  'giant tree city', 'singing dunes', 'monster island',
  'space station garden', 'ghost subway', 'floating library',
  'moon bakery', 'undersea post office', 'future-self postcard',
  'quietest spot finder', 'water fountain map', 'moon phase tracker',
  'bird counter', 'garden habit tracker', 'piggy bank budget',
  'dragon pomodoro', 'adaptive study playlist', 'roast flashcards',
  'guilt-trip todo list', 'weird question journal',
  'cat stacking', 'jellyfish button game', 'boss monster game',
  'shopping cart racing', 'mushroom farming', 'cryptid dating sim',
  'after-hours library roguelike', 'gravity-flip platformer',
  'last-five-texts word game', 'constellation memory game',
  'typing storytelling', '8-bit village', 'recycling speed sort',
  'screen-time pet', 'hex map generator', 'physics dice roller',
  'auto character sheet', 'weird npc generator', 'custom loot table',
  'homebrew world wiki', 'painting palette picker',
  'glitch font', 'emoji sticker maker', 'fake concert posters',
  'meme caption helper', 'glitch art tool', 'ascii converter',
  'synthwave gradients', 'browser kaleidoscope', 'spirograph generator',
  'generative wallpaper', 'handwriting font converter',
  'fake movie titles', 'fake company logos', 'pirate error messages',
  'haiku cli', 'nice-things button', 'file renamer',
  'cat cursor chaser', 'movie hacker terminal', 'bird painting extension',
  'petal cursor trail', 'four-leaf clover finder',
  'first warm spring day', 'school bell sound', 'ice cream truck run',
  'lost mitten', 'new shoe squeak', 'alarm-beating wake up',
  'mail day feeling', 'first snow quiet', 'magic trick figuring',
  'stuck-level beating', 'cold breath seeing', 'weird rock finding',
  'pre-sunset sky', 'community cookbook', 'fridge recipe randomizer',
  'spice pairing guide', 'tea timer facts', 'coffee strength calc',
  'sourdough mood tracker', 'snack movie pairer', 'fake menus',
  'farm stand simulator', 'water cup counter',
  'garden gnome society', 'squirrel watch', 'cat newspaper',
  'paper airplane town', 'ghost spooking school', 'robot repair shop',
  'dragon librarian', 'tuesday-only island', 'raccoon bakery',
  'bird-letter post office', 'snail mail', 'cassette culture',
  'doodle bot', 'pocket greenhouse', 'tiny aquarium',
  'mood ring', 'wish jar', 'secret handshake', 'lucky coin',
  'pocket compass', 'message kite', 'dream catcher', 'worry doll',
  'fortune cookie', 'snow globe', 'music box', 'diorama',
  'pop-up book', 'shadow puppet', 'stained glass', 'tiled mosaic'
];

const el = (sel) => document.querySelector(sel);
const results = el('#results');
const generateBtn = el('#generateBtn');

function buildCategoryChips() {
  const sel = el('#categorySelect');
  CATEGORIES.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.label;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => {
    state.category = sel.value;
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
  note.textContent = LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)];
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
  const card = document.createElement('div');
  card.className = 'card';
  const diff = normalizeDifficulty(idea.difficulty);

  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'card-star' + (isFavorited(idea) ? ' active' : '');
  star.setAttribute('aria-label', 'Save idea');
  star.textContent = isFavorited(idea) ? '★' : '☆';
  star.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(idea);
    star.textContent = isFavorited(idea) ? '★' : '☆';
    star.classList.toggle('active', isFavorited(idea));
  });

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

  card.appendChild(star);
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

  const header = document.createElement('div');
  header.className = 'modal-header';

  const headLeft = document.createElement('div');
  headLeft.className = 'modal-head-left';
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
  headLeft.appendChild(eyebrow);
  headLeft.appendChild(h2);

  const headRight = document.createElement('div');
  headRight.className = 'modal-head-right';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'modal-copy';
  copy.textContent = 'Copy';
  copy.addEventListener('click', () => copyBrief(idea, copy));
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'modal-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';

  const starBtn = document.createElement('button');
  starBtn.type = 'button';
  starBtn.className = 'modal-star' + (isFavorited(idea) ? ' active' : '');
  starBtn.setAttribute('aria-label', 'Save idea');
  starBtn.textContent = isFavorited(idea) ? '★' : '☆';
  starBtn.addEventListener('click', () => {
    toggleFavorite(idea);
    starBtn.textContent = isFavorited(idea) ? '★' : '☆';
    starBtn.classList.toggle('active', isFavorited(idea));
  });

  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'modal-share';
  share.textContent = 'Share';
  share.addEventListener('click', () => shareIdea(idea, share));

  headRight.appendChild(starBtn);
  headRight.appendChild(share);
  headRight.appendChild(copy);
  headRight.appendChild(close);

  header.appendChild(headLeft);
  header.appendChild(headRight);
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'modal-body';

  if (idea.pitch) {
    const pitch = document.createElement('p');
    pitch.className = 'modal-pitch';
    pitch.textContent = idea.pitch;
    body.appendChild(pitch);
  }

  if (idea.stack && idea.stack.length) {
    body.appendChild(buildSection('🛠', 'Tools & tech', buildChips(idea.stack)));
  }

  if (idea.whatYouLearn && idea.whatYouLearn.length) {
    body.appendChild(buildSection('🎓', 'What you\'ll learn', buildChecklist(idea.whatYouLearn, 'learn')));
  }

  if (idea.prerequisites && idea.prerequisites.length) {
    const items = idea.prerequisites.filter((p) => p && p.toLowerCase() !== 'none');
    if (items.length) {
      body.appendChild(buildSection('📋', 'Before you start', buildBulletList(items, 'prereq')));
    }
  }

  if (idea.howItWorks) {
    body.appendChild(buildSection('⚙️', 'How it works', buildParagraph(idea.howItWorks, 'how')));
  }

  if (idea.gotchas && idea.gotchas.length) {
    body.appendChild(buildSection('⚠️', 'Watch out for', buildWarnList(idea.gotchas)));
  }

  card.appendChild(body);

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  close.focus();
}

function copyBrief(idea, btn) {
  const lines = [];
  lines.push(idea.title || 'Untitled idea');
  lines.push('');
  if (idea.difficulty) lines.push('Difficulty: ' + idea.difficulty);
  if (idea.timeEstimate) lines.push('Time: ' + idea.timeEstimate);
  if (idea.stack && idea.stack.length) lines.push('Tools: ' + idea.stack.join(', '));
  if (idea.pitch) { lines.push(''); lines.push(idea.pitch); }
  if (idea.whatYouLearn && idea.whatYouLearn.length) {
    lines.push(''); lines.push('What you\'ll learn:');
    idea.whatYouLearn.forEach((w) => lines.push('  - ' + w));
  }
  if (idea.prerequisites && idea.prerequisites.length) {
    const items = idea.prerequisites.filter((p) => p && p.toLowerCase() !== 'none');
    if (items.length) {
      lines.push(''); lines.push('Before you start:');
      items.forEach((p) => lines.push('  - ' + p));
    }
  }
  if (idea.howItWorks) { lines.push(''); lines.push('How it works:'); lines.push(idea.howItWorks); }
  if (idea.gotchas && idea.gotchas.length) {
    lines.push(''); lines.push('Watch out for:');
    idea.gotchas.forEach((g) => lines.push('  - ' + g));
  }
  lines.push('');
  lines.push('— from Hack Club Project Ideas (fan-made)');
  const text = lines.join('\n');
  try {
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
    }).catch(() => {
      fallbackCopy(text, btn);
    });
  } catch (e) {
    fallbackCopy(text, btn);
  }
}

function fallbackCopy(text, btn) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); btn.textContent = '✓ Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1600); } catch (e) {}
  document.body.removeChild(ta);
}

function buildSection(icon, title, contentEl) {
  const sec = document.createElement('div');
  sec.className = 'modal-section';
  const h4 = document.createElement('h4');
  const iconSpan = document.createElement('span');
  iconSpan.className = 'section-icon';
  iconSpan.textContent = icon;
  h4.appendChild(iconSpan);
  h4.appendChild(document.createTextNode(title));
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

function ideaKey(idea) {
  return String(idea.title || '').trim().toLowerCase().slice(0, 80);
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function isFavorited(idea) {
  const key = ideaKey(idea);
  if (!key) return false;
  return loadFavorites().some((f) => ideaKey(f) === key);
}

function toggleFavorite(idea) {
  const key = ideaKey(idea);
  if (!key) return;
  const favs = loadFavorites();
  const idx = favs.findIndex((f) => ideaKey(f) === key);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.unshift({
      title: idea.title,
      difficulty: idea.difficulty,
      timeEstimate: idea.timeEstimate,
      stack: idea.stack,
      summary: idea.summary,
      pitch: idea.pitch,
      whatYouLearn: idea.whatYouLearn,
      prerequisites: idea.prerequisites,
      howItWorks: idea.howItWorks,
      gotchas: idea.gotchas,
      savedAt: new Date().toISOString()
    });
  }
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  } catch (e) {}
}

function shareIdea(idea, btn) {
  try {
    const json = JSON.stringify(idea);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const url = window.location.origin + window.location.pathname + '#i=' + encoded;
    navigator.clipboard.writeText(url).then(() => {
      btn.textContent = '✓ Link copied';
      setTimeout(() => { btn.textContent = 'Share'; }, 2000);
    }).catch(() => {
      window.history.replaceState(null, '', '#i=' + encoded);
      btn.textContent = '✓ In URL bar';
      setTimeout(() => { btn.textContent = 'Share'; }, 2000);
    });
  } catch (e) {
    btn.textContent = '✗ Failed';
    setTimeout(() => { btn.textContent = 'Share'; }, 2000);
  }
}

function checkSharedIdea() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#i=')) return null;
  try {
    const encoded = hash.slice(3);
    const json = decodeURIComponent(escape(atob(encoded)));
    const idea = JSON.parse(json);
    if (idea && idea.title) return idea;
  } catch (e) {}
  return null;
}

function shuffleFilters(btn) {
  const cats = CATEGORIES.filter((c) => c.id !== 'all');
  const diffs = ['Beginner', 'Intermediate', 'Advanced'];
  const randomCat = cats[Math.floor(Math.random() * cats.length)];
  const randomDiff = diffs[Math.floor(Math.random() * diffs.length)];
  const currentTopic = el('#topicInput').value.trim();
  let randomTopic = currentTopic;
  let guard = 0;
  while (randomTopic === currentTopic && guard < 12) {
    randomTopic = SURPRISE_TOPICS[Math.floor(Math.random() * SURPRISE_TOPICS.length)];
    guard++;
  }

  el('#categorySelect').value = randomCat.id;
  el('#difficultySelect').value = randomDiff;
  el('#topicInput').value = randomTopic;
  state.category = randomCat.id;

  const fields = el('#filters');
  fields.classList.add('shook');
  setTimeout(() => fields.classList.remove('shook'), 420);

  if (btn) {
    btn.classList.add('spun');
    setTimeout(() => btn.classList.remove('spun'), 420);
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
  const favs = loadFavorites();
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

  if (favs.length > 0) {
    const savedGroup = document.createElement('div');
    savedGroup.className = 'history-group saved-group';

    const sgHead = document.createElement('div');
    sgHead.className = 'history-group-head saved-head';
    const sgMeta = document.createElement('span');
    sgMeta.className = 'history-meta';
    sgMeta.textContent = '★ Saved';
    sgHead.appendChild(sgMeta);
    const sgCount = document.createElement('span');
    sgCount.className = 'history-batch-count';
    sgCount.textContent = favs.length + ' starred idea' + (favs.length === 1 ? '' : 's');
    sgHead.appendChild(sgCount);

    const sgClear = document.createElement('button');
    sgClear.type = 'button';
    sgClear.className = 'clear-btn';
    sgClear.textContent = 'Clear stars';
    sgClear.addEventListener('click', () => {
      try { localStorage.removeItem(FAV_KEY); } catch (e) {}
      renderHistory();
    });
    sgHead.appendChild(sgClear);
    savedGroup.appendChild(sgHead);

    const sgGrid = document.createElement('div');
    sgGrid.className = 'grid';
    favs.forEach((idea) => sgGrid.appendChild(buildCard(idea)));
    savedGroup.appendChild(sgGrid);
    results.appendChild(savedGroup);
  }

  if (history.length === 0 && favs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML =
      '<div class="emoji">📭</div>' +
      '<h2>No history yet.</h2>' +
      '<p>Generate some ideas and they\'ll show up here. Tap the ☆ on any idea to save your favourites — they\'ll stick to the top.</p>';
    results.appendChild(empty);
    return;
  }

  if (history.length === 0) return;

  const batchesHead = document.createElement('div');
  batchesHead.className = 'history-subhead';
  batchesHead.textContent = 'Recent batches';
  results.appendChild(batchesHead);

  const clearWrap = document.createElement('div');
  clearWrap.className = 'clear-wrap';
  const count = document.createElement('span');
  count.className = 'history-count';
  count.textContent = history.length + ' batch' + (history.length === 1 ? '' : 'es');
  clearWrap.appendChild(count);
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'clear-btn';
  clear.textContent = 'Clear history';
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
el('#shuffleBtn').addEventListener('click', (e) => shuffleFilters(e.currentTarget));
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

const shared = checkSharedIdea();
if (shared) {
  renderEmpty();
  openModal(shared);
} else {
  renderEmpty();
}
