/* Leonida Platinum — GTA VI trophy guide & tracker.
   Loads app/data/trophies.json (same origin only), keeps progress in localStorage,
   renders the checklist, the guide pane, the roadmap and the missables page. */
const DATA_URL = 'data/trophies.json';
const STORE_KEY = 'leonida-platinum-progress-v1';

const KIND_LABELS = {
  story: 'Story', missable: 'Missable', collectible: 'Collectibles',
  activity: 'Activities', money: 'Money', online: 'Online',
  platinum: 'Platinum', completion: 'Completion',
};
const GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

let trophies = [];
let earned = new Set();
let selectedId = null;
let activeKind = 'all';
let activeGrade = 'all';
let searchText = '';
let spoilerOn = false;
let earnedOnly = false;
let activeView = 'checklist';

const $ = (sel) => document.querySelector(sel);

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed) ? parsed : parsed.earned;
    if (Array.isArray(ids)) earned = new Set(ids.filter((n) => Number.isInteger(n)));
  } catch (err) { earned = new Set(); }
}

function saveProgress() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ app: 'leonida-platinum', earned: [...earned].sort((a, b) => a - b) })); } catch (err) { /* storage full or blocked: progress just does not persist */ }
}

function trophyById(id) { return trophies.find((t) => t.id === id); }

function isSpoilerHidden(t) {
  return spoilerOn && t.kind === 'story' && !earned.has(t.id);
}

function visibleTrophies() {
  const q = searchText.trim().toLowerCase();
  return trophies.filter((t) => {
    if (activeKind === 'online') return false; // the official list has no online trophies
    if (activeKind === 'missable' && !t.missable) return false;
    if (activeKind !== 'all' && activeKind !== 'missable' && t.kind !== activeKind) return false;
    if (activeGrade !== 'all' && t.grade !== activeGrade) return false;
    if (earnedOnly && !earned.has(t.id)) return false;
    if (q) {
      const hay = (t.name + ' ' + t.description + ' ' + t.guide + ' ' + (KIND_LABELS[t.kind] || t.kind)).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function gradeCounts() {
  const out = {};
  for (const g of GRADE_ORDER) out[g] = { total: 0, earned: 0 };
  for (const t of trophies) {
    out[t.grade].total += 1;
    if (earned.has(t.id)) out[t.grade].earned += 1;
  }
  return out;
}

function renderProgress() {
  const total = trophies.length;
  const n = earned.size;
  const pct = total ? Math.round((n / total) * 100) : 0;
  $('#progressText').textContent = n + ' / ' + total + ' earned';
  $('#progressPct').textContent = pct + '%';
  const bar = $('#progressBar');
  bar.setAttribute('aria-valuenow', String(n));
  $('#progressFill').style.width = pct + '%';
  const gc = gradeCounts();
  $('#progressByGrade').textContent = GRADE_ORDER
    .map((g) => gc[g].earned + '/' + gc[g].total + ' ' + g)
    .join(' · ');
  const miss = trophies.filter((t) => t.missable).length;
  const missEarned = trophies.filter((t) => t.missable && earned.has(t.id)).length;
  $('#missableCount').textContent = missEarned + '/' + miss;
}

function kindTag(t) {
  // No kind tag when it would just repeat the grade (platinum) or the missable flag.
  if (t.kind === 'missable' || (KIND_LABELS[t.kind] || '').toLowerCase() === t.grade) return '';
  return '<span class="tag kind">' + escapeHtml(KIND_LABELS[t.kind] || t.kind) + '</span>';
}

function medalTag(t) {
  return '<span class="tag grade-' + t.grade + '">' + t.grade + '</span>';
}

function renderList() {
  const list = visibleTrophies();
  const ul = $('#trophyList');
  ul.innerHTML = '';
  $('#emptyNote').hidden = list.length !== 0;
  $('#listMeta').textContent = 'Showing ' + list.length + ' of ' + trophies.length + ' trophies'
    + (activeKind === 'online' ? ' — the official list has no online trophies, so this filter is empty by design.' : '')
    + (spoilerOn ? ' · Spoilers hidden for story trophies you have not earned yet.' : '');
  for (const t of list) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trophy-row' + (earned.has(t.id) ? ' earned' : '') + (selectedId === t.id ? ' selected' : '');
    btn.dataset.id = String(t.id);
    const hidden = isSpoilerHidden(t);
    const name = hidden ? 'Hidden story trophy' : t.name;
    const desc = hidden ? 'Earn this trophy to reveal its name and description.' : t.description;
    const target = t.target ? '<span class="t-target"><b>' + t.target + '</b>' + (t.kind === 'money' ? 'dollars' : 'to earn') + '</span>' : '<span class="t-target"></span>';
    btn.innerHTML = '<span class="check" aria-hidden="true">' + (earned.has(t.id) ? '✓' : '') + '</span>'
      + '<span class="' + (hidden ? 'spoiler-hidden' : '') + '"><span class="t-name">' + escapeHtml(name) + '</span>'
      + '<span class="t-desc">' + escapeHtml(desc) + '</span>'
      + '<span class="t-tags">' + medalTag(t)
      + kindTag(t)
      + (t.missable ? '<span class="tag missable">Missable</span>' : '')
      + '</span></span>' + target;
    btn.addEventListener('click', (ev) => {
      if (ev.target.closest('.check')) { toggleEarned(t.id); return; }
      selectTrophy(t.id);
    });
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toggleEarned(id) {
  if (earned.has(id)) earned.delete(id); else earned.add(id);
  saveProgress();
  renderProgress();
  renderList();
  if (selectedId === id) renderDetail();
}

function selectTrophy(id) {
  selectedId = id;
  renderList();
  renderDetail();
  if (window.innerWidth <= 900) $('#detailPane').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sourceLink(src) {
  if (src.url) return '<a href="' + escapeHtml(src.url) + '" target="_blank" rel="noopener">' + escapeHtml(src.label) + '</a>';
  return escapeHtml(src.label);
}

function renderDetail() {
  const pane = $('#detailPane');
  const t = selectedId === null ? null : trophyById(selectedId);
  if (!t) {
    pane.innerHTML = '<p class="detail-hint">Pick a trophy on the left to read its guide and sources here.</p>';
    return;
  }
  if (isSpoilerHidden(t)) {
    pane.innerHTML = '<p class="tag grade-' + t.grade + '">' + t.grade + '</p>'
      + '<h2>Hidden story trophy</h2>'
      + '<p class="detail-desc">This story trophy is hidden by your spoiler setting. Earn it in the game (or turn spoilers off) to reveal its name, description and guide.</p>'
      + '<div class="detail-actions"><button type="button" id="detailToggle">' + (earned.has(t.id) ? 'Mark as not earned' : 'Mark as earned') + '</button></div>';
    pane.querySelector('#detailToggle').addEventListener('click', () => toggleEarned(t.id));
    return;
  }
  const guideParas = t.guide.split(/\n+/).map((p) => '<p>' + escapeHtml(p) + '</p>').join('');
  pane.innerHTML = '<p>' + medalTag(t)
    + ' ' + kindTag(t)
    + (t.missable ? ' <span class="tag missable">Missable</span>' : '')
    + (t.target ? ' <span class="tag">Target: ' + t.target + '</span>' : '') + '</p>'
    + '<h2>' + escapeHtml(t.name) + '</h2>'
    + '<p class="detail-desc">Official description: “' + escapeHtml(t.description) + '”</p>'
    + (t.missable ? '<p class="missable-warning"><strong>Missable.</strong> This trophy names a single specific moment, setup or choice. Save before you attempt it and do it the first time the chance appears.</p>' : '')
    + '<div class="detail-guide">' + guideParas + '</div>'
    + '<div class="detail-actions"><button type="button" id="detailToggle">' + (earned.has(t.id) ? '✓ Earned — mark as not earned' : 'Mark as earned') + '</button></div>'
    + '<div class="sources"><h3>Sources</h3><ul>'
    + t.sources.map((s) => '<li>' + sourceLink(s) + '</li>').join('')
    + '</ul><p>Guide text is my own advice, drawn from the official description. Where the description does not pin down a place or a step, the guide says so instead of inventing one.</p></div>';
  pane.querySelector('#detailToggle').addEventListener('click', () => toggleEarned(t.id));
}

/* ---- roadmap & missables ---- */
const ROADMAP = [
  { title: 'Play the story — Chapters 1 to 4 and the finale', ids: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    text: 'Follow the story missions in order. The chapter trophies and the named-mission trophies all pop as you finish them, and the gold final-mission trophy closes the story. Do not rush past the missable moments in stage 2 while you are here.' },
  { title: 'Grab the missables while the story is live', ids: [29, 33, 34, 36, 37, 38, 39, 45, 47, 48, 49, 50, 51],
    text: '13 trophies hinge on a single moment, setup or choice. Save before each attempt and do it the first time the chance appears — the Missables page explains each one. Partner trophies need your partner present; the cryptic ones need you to notice the moment.' },
  { title: 'Finish the side-character strands', ids: [22, 23, 24, 25, 26, 27],
    text: 'Andy, Kenton, Billy, Randy and Tyrone each have a strand ending in a final mission, and 8 stranger strands across Leonida earn the silver Strangers & Freaks. Take their missions as they appear on the map; a strand only counts when its final mission is done.' },
  { title: 'Activities and skill grinds', ids: [15, 16, 17, 18, 19, 20, 21, 32, 40, 41, 43, 46, 55],
    text: 'The repeatable core: 250 stunts, 42 gold Shooting Range challenges, 14 drone-race locations, 20 different race wins, 50 challenges, 5 bank vaults, plus fishing, arcade, bowling and the Scooter Bros registrations. The Shooting Range golds are the longest grind — start them early.' },
  { title: 'Collectibles and exploring', ids: [28, 30, 31, 35, 42],
    text: '18 meditation spots, 3 card sets, WAiNK at 100 locations, 100 vehicles discovered, and every corner of Leonida explored. Pick up cards and WAiNK as you travel for missions so the clean-up trip at the end is short.' },
  { title: 'Money and properties', ids: [52, 53, 54],
    text: 'Launder $250,000 of Marked Bills through your contacts, spend $100,000 across all shops, and buy every garage property. Money flows from heists and robberies — launder after every big score and buy garages as soon as you can afford them.' },
  { title: 'The odd ones out', ids: [44],
    text: 'A cocktail with a view on Ocean Beach — a quiet moment trophy with no grind attached. Do it whenever you are passing the coast.' },
  { title: '100% Completion, then the platinum', ids: [14, 1],
    text: 'Check the in-game completion checklist and clear whatever it still lists — story, strands, collectibles and activities all feed it. When 100% pops, the platinum follows immediately.' },
];

function stageProgress(ids) {
  const done = ids.filter((id) => earned.has(id)).length;
  return done + '/' + ids.length + ' earned';
}

function renderRoadmap() {
  const ol = $('#roadmapList');
  ol.innerHTML = '';
  for (const stage of ROADMAP) {
    const li = document.createElement('li');
    const names = stage.ids.map((id) => {
      const t = trophyById(id);
      return t ? escapeHtml(t.name) : '';
    }).filter(Boolean).join(', ');
    li.innerHTML = '<h3>' + escapeHtml(stage.title) + '</h3>'
      + '<p>' + escapeHtml(stage.text) + '</p>'
      + '<p class="stage-trophies"><b>' + stageProgress(stage.ids) + '</b> — ' + names + '</p>';
    ol.appendChild(li);
  }
}

function renderMissables() {
  const ul = $('#missableList');
  ul.innerHTML = '';
  for (const t of trophies.filter((x) => x.missable)) {
    const li = document.createElement('li');
    const firstLine = t.guide.split('. ')[0] + '.';
    li.innerHTML = '<span class="t-name">' + (earned.has(t.id) ? '✓ ' : '') + escapeHtml(t.name) + '</span> '
      + medalTag(t)
      + '<span class="t-why">' + escapeHtml(firstLine) + '</span>';
    li.addEventListener('click', () => { switchView('checklist'); selectTrophy(t.id); });
    ul.appendChild(li);
  }
}

/* ---- views ---- */
function switchView(view) {
  activeView = view;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('.layout').hidden = view !== 'checklist';
  $('.toolbar').hidden = view !== 'checklist';
  $('#roadmapPage').hidden = view !== 'roadmap';
  $('#missablesPage').hidden = view !== 'missables';
  if (view === 'roadmap') renderRoadmap();
  if (view === 'missables') renderMissables();
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
}

/* ---- export / import / reset ---- */
function exportProgress() {
  const payload = JSON.stringify({ app: 'leonida-platinum', version: 1, earned: [...earned].sort((a, b) => a - b) }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gta6-trophy-progress.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const ids = Array.isArray(parsed) ? parsed : parsed.earned;
      if (!Array.isArray(ids)) throw new Error('no earned list');
      const valid = new Set(trophies.map((t) => t.id));
      const next = new Set(ids.filter((n) => Number.isInteger(n) && valid.has(n)));
      earned = next;
      saveProgress();
      renderProgress();
      renderList();
      renderDetail();
    } catch (err) {
      alert('That file is not a Leonida Platinum progress export.');
    }
  };
  reader.readAsText(file);
}

/* ---- boot ---- */
async function boot() {
  loadProgress();
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    trophies = Array.isArray(data) ? data : data.trophies;
  } catch (err) {
    $('#trophyList').innerHTML = '<li class="empty-note">Could not load data/trophies.json. Serve app/ from a static server (for example: python3 -m http.server) and reload.</li>';
    return;
  }
  trophies.sort((a, b) => a.id - b.id);
  renderProgress();
  renderList();
  renderRoadmap();
  renderMissables();

  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
  document.querySelectorAll('#kindChips .chip').forEach((b) => b.addEventListener('click', () => {
    activeKind = b.dataset.kind;
    document.querySelectorAll('#kindChips .chip').forEach((c) => c.classList.toggle('active', c === b));
    renderList();
  }));
  $('#gradeSelect').addEventListener('change', (ev) => { activeGrade = ev.target.value; renderList(); });
  $('#searchInput').addEventListener('input', (ev) => { searchText = ev.target.value; renderList(); });
  $('#spoilerToggle').addEventListener('change', (ev) => { spoilerOn = ev.target.checked; renderList(); renderDetail(); });
  $('#earnedOnlyToggle').addEventListener('change', (ev) => { earnedOnly = ev.target.checked; renderList(); });
  $('#exportBtn').addEventListener('click', exportProgress);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (ev) => { if (ev.target.files[0]) importProgress(ev.target.files[0]); ev.target.value = ''; });
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('Clear all earned trophies?')) { earned = new Set(); saveProgress(); renderProgress(); renderList(); renderDetail(); }
  });

  const hash = location.hash.replace('#', '');
  if (hash === 'roadmap' || hash === 'missables') switchView(hash);
  // Default selection: the first trophy, so the guide pane is never empty.
  if (trophies.length) selectTrophy(trophies[16].id); // The Shootist — a silver grind with a full guide
}

boot();
