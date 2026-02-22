import { GeminiService, Post } from './services/gemini.ts';
import './index.css';

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
interface User {
  name: string;
  email: string;
  pw: string;
  at: number;
}

const DB: {
  users: Record<string, User>;
  session: string | null;
} = {
  users: {},
  session: null,
};

interface AppState {
  ob: {
    plt: string | null;
    niche: string | null;
    cts: string[];
    freq: number | null;
  };
  obStep: number;
  calY: number;
  calM: number;
  cal: Record<string, Post>;
  done: Record<string, boolean>;
  edits: Record<string, { cap?: string; notes?: string }>;
  metrics: Array<{ date: string; views: number; likes: number; comments: number; saves: number }>;
  streak: number;
  best: number;
  openKey: string | null;
  aiInited: boolean;
}

const U: AppState = {
  ob: { plt: null, niche: null, cts: [], freq: null },
  obStep: 1,
  calY: new Date().getFullYear(),
  calM: new Date().getMonth(),
  cal: {},
  done: {},
  edits: {},
  metrics: [],
  streak: 0,
  best: 0,
  openKey: null,
  aiInited: false,
};

// ═══════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════
function dbLoad() {
  try {
    DB.users = JSON.parse(localStorage.getItem('st_users') || '{}');
    DB.session = localStorage.getItem('st_session') || null;
  } catch (e) {
    DB.users = {};
    DB.session = null;
  }
}

function dbSave() {
  localStorage.setItem('st_users', JSON.stringify(DB.users));
  if (DB.session) localStorage.setItem('st_session', DB.session);
  else localStorage.removeItem('st_session');
}

function uLoad() {
  if (!DB.session) return;
  try {
    const raw = localStorage.getItem('st_u_' + DB.session);
    if (!raw) return;
    const d = JSON.parse(raw);
    U.ob = d.ob || { plt: null, niche: null, cts: [], freq: null };
    U.cal = d.cal || {};
    U.done = d.done || {};
    U.edits = d.edits || {};
    U.metrics = d.metrics || [];
    U.obStep = d.obStep || 1;
    const now = new Date();
    U.calY = now.getFullYear();
    U.calM = now.getMonth();
  } catch (e) {}
}

function uSave() {
  if (!DB.session) return;
  localStorage.setItem('st_u_' + DB.session, JSON.stringify({
    ob: U.ob, cal: U.cal, done: U.done,
    edits: U.edits, metrics: U.metrics,
    obStep: U.obStep
  }));
}

function resetU() {
  U.ob = { plt: null, niche: null, cts: [], freq: null };
  U.obStep = 1;
  U.calY = new Date().getFullYear();
  U.calM = new Date().getMonth();
  U.cal = {};
  U.done = {};
  U.edits = {};
  U.metrics = [];
  U.streak = 0;
  U.best = 0;
  U.openKey = null;
  U.aiInited = false;
}

// ═══════════════════════════════════════════════════════
// UI UTILITIES
// ═══════════════════════════════════════════════════════
function showPage(name: string) {
  // Hide all pages first
  document.querySelectorAll('.pg').forEach(p => {
    p.classList.remove('active');
  });

  // Show the target page
  const el = document.getElementById('pg-' + name);
  if (el) {
    el.classList.add('active');
    // Scroll to top on page change
    window.scrollTo(0, 0);
  } else {
    console.error(`Page pg-${name} not found`);
  }
}

function showToast(msg: string) {
  const t = document.getElementById('toast')!;
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2800);
}

interface ModalOptions {
  title: string;
  desc: string;
  icon?: string;
  input?: string;
  confirmTxt?: string;
  cancelTxt?: string;
}

function openModal(opts: ModalOptions): Promise<string | boolean> {
  return new Promise((resolve) => {
    const ov = document.getElementById('modalOv')!;
    const title = document.getElementById('modalTitle')!;
    const desc = document.getElementById('modalDesc')!;
    const icon = document.getElementById('modalIcon')!;
    const input = document.getElementById('modalInput') as HTMLInputElement;
    const confirm = document.getElementById('modalConfirm')!;
    const cancel = document.getElementById('modalCancel')!;

    title.textContent = opts.title;
    desc.textContent = opts.desc;
    icon.textContent = opts.icon || '✦';
    
    if (opts.input !== undefined) {
      input.classList.remove('hidden');
      input.value = opts.input;
    } else {
      input.classList.add('hidden');
    }

    confirm.textContent = opts.confirmTxt || 'Confirm';
    cancel.textContent = opts.cancelTxt || 'Cancel';

    const cleanup = () => {
      ov.classList.remove('show');
      confirm.replaceWith(confirm.cloneNode(true));
      cancel.replaceWith(cancel.cloneNode(true));
    };

    document.getElementById('modalConfirm')!.addEventListener('click', () => {
      const val = opts.input !== undefined ? (document.getElementById('modalInput') as HTMLInputElement).value : true;
      cleanup();
      resolve(val);
    });

    document.getElementById('modalCancel')!.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    ov.classList.add('show');
  });
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ═══════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════
let authMode: 'login' | 'signup' = 'login';

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  const nameGrp = document.getElementById('nameGrp')!;
  const authBtn = document.getElementById('authBtn')!;
  const toggleTxt = document.getElementById('toggleTxt')!;
  const toggleLnk = document.getElementById('toggleAuthMode')!;

  if (authMode === 'signup') {
    nameGrp.style.display = 'block';
    authBtn.textContent = 'Create Account';
    toggleTxt.textContent = 'Already have an account?';
    toggleLnk.textContent = 'Sign in →';
  } else {
    nameGrp.style.display = 'none';
    authBtn.textContent = 'Sign in';
    toggleTxt.textContent = "Don't have an account?";
    toggleLnk.textContent = 'Create one →';
  }
}

async function handleAuth() {
  const email = (document.getElementById('emailIn') as HTMLInputElement).value.trim().toLowerCase();
  const pass = (document.getElementById('passIn') as HTMLInputElement).value;
  const authErr = document.getElementById('authErr')!;

  if (authMode === 'signup') {
    const name = (document.getElementById('nameIn') as HTMLInputElement).value.trim();
    if (!name || !email || pass.length < 6) {
      authErr.textContent = 'Please fill all fields correctly.';
      authErr.classList.add('show');
      return;
    }
    if (DB.users[email]) {
      authErr.textContent = 'User already exists.';
      authErr.classList.add('show');
      return;
    }
    DB.users[email] = { name, email, pw: pass, at: Date.now() };
    dbSave();
  } else {
    const u = DB.users[email];
    if (!u || u.pw !== pass) {
      authErr.textContent = 'Invalid credentials.';
      authErr.classList.add('show');
      return;
    }
  }
  doLogin(email);
}

function doLogin(email: string) {
  DB.session = email;
  dbSave();
  resetU();
  uLoad();
  updateNavUser();
  const onboarded = U.ob.plt && U.ob.niche && U.ob.cts.length > 0 && U.ob.freq;
  if (onboarded) {
    goto('dash');
  } else {
    U.obStep = 1;
    showPage('ob');
    renderOb();
  }
}

function updateNavUser() {
  if (!DB.session || !DB.users[DB.session]) return;
  const name = DB.users[DB.session].name;
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  ['sbAv1', 'sbAv2', 'sbAv3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = initials;
  });
  ['sbName1', 'sbName2', 'sbName3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = name;
  });
}

// ═══════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════
const PLATFORMS = [
  { v: 'instagram', label: 'Instagram', icon: '📸' },
  { v: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { v: 'youtube', label: 'YouTube', icon: '▶️' },
  { v: 'twitter', label: 'X (Twitter)', icon: '𝕏' },
  { v: 'pinterest', label: 'Pinterest', icon: '📌' },
  { v: 'threads', label: 'Threads', icon: '🧵' },
];

const NICHES = ['Lifestyle', 'Fitness', 'Tech', 'Finance', 'Travel', 'Fashion', 'Food', 'Education', 'Business', 'Marketing', 'Gaming', 'Health'];

const CONTENT_TYPES: Record<string, Array<{ v: string; i: string; s: string }>> = {
  instagram: [
    { v: 'Reels', i: '🎬', s: 'Short-form video' },
    { v: 'Carousel', i: '📊', s: 'Multi-slide posts' },
    { v: 'Static Post', i: '🖼️', s: 'Single image' },
  ],
  linkedin: [
    { v: 'Text Post', i: '✍️', s: 'Written updates' },
    { v: 'Carousel', i: '📊', s: 'Document slides' },
    { v: 'Poll', i: '📋', s: 'Audience question' },
  ],
  youtube: [
    { v: 'Shorts', i: '⚡', s: 'Under 60 seconds' },
    { v: 'Video', i: '🎬', s: 'Full-length content' },
  ],
  twitter: [
    { v: 'Text Post', i: '💬', s: 'Short update' },
    { v: 'Thread', i: '🧵', s: 'Multi-tweet story' },
  ],
  pinterest: [
    { v: 'Pin', i: '📌', s: 'Standard pin' },
    { v: 'Idea Pin', i: '💡', s: 'Multi-page story' },
  ],
  threads: [
    { v: 'Text Post', i: '💬', s: 'Short update' },
    { v: 'Thread', i: '🧵', s: 'Multi-post chain' },
  ],
};

function renderOb() {
  const s = U.obStep;
  ['ob-s1', 'ob-s2', 'ob-s3', 'ob-s4'].forEach((id, i) => {
    document.getElementById(id)!.style.display = (i + 1 === s) ? 'block' : 'none';
  });
  document.getElementById('obFill')!.style.width = (s / 4 * 100) + '%';
  document.getElementById('obBackBtn')!.style.visibility = s > 1 ? 'visible' : 'hidden';
  document.getElementById('obNextBtn')!.textContent = s < 4 ? 'Continue →' : 'Generate Calendar →';

  if (s === 1) buildPltGrid();
  if (s === 2) buildNicheGrid();
  if (s === 3) buildCTGrid();
  if (s === 4) {
    ['freq3', 'freq5', 'freq7'].forEach(id => {
      const el = document.getElementById(id)!;
      const v = parseInt(el.dataset.v!);
      if (U.ob.freq === v) el.classList.add('sel');
      else el.classList.remove('sel');
    });
  }
}

function buildPltGrid() {
  const g = document.getElementById('pltGrid')!;
  g.innerHTML = PLATFORMS.map(p =>
    `<div class="oc${U.ob.plt === p.v ? ' sel' : ''}" data-v="${p.v}">
      <div class="oc-icon">${p.icon}</div>
      <div class="oc-label">${p.label}</div>
    </div>`
  ).join('');
  g.querySelectorAll('.oc').forEach(el => el.addEventListener('click', (e) => {
    const v = (e.currentTarget as HTMLElement).dataset.v!;
    U.ob.plt = v;
    U.ob.cts = [];
    renderOb();
  }));
}

function buildNicheGrid() {
  const g = document.getElementById('nicheGrid')!;
  g.innerHTML = NICHES.map(n =>
    `<div class="oc${U.ob.niche === n ? ' sel' : ''}" data-v="${n}">
      <div class="oc-label">${n}</div>
    </div>`
  ).join('') + `<div class="oc" data-v="Custom"><div class="oc-label">Custom</div></div>`;
  
  g.querySelectorAll('.oc').forEach(el => el.addEventListener('click', (e) => {
    const v = (e.currentTarget as HTMLElement).dataset.v!;
    if (v === 'Custom') {
      document.getElementById('customRow')!.classList.add('show');
    } else {
      U.ob.niche = v;
      document.getElementById('customRow')!.classList.remove('show');
      renderOb();
    }
  }));
}

function buildCTGrid() {
  const plt = U.ob.plt || 'instagram';
  const types = CONTENT_TYPES[plt] || CONTENT_TYPES.instagram;
  const g = document.getElementById('ctGrid')!;
  g.innerHTML = types.map(t => {
    const isSel = U.ob.cts.includes(t.v);
    return `<div class="oc ct-card${isSel ? ' sel' : ''}" data-v="${t.v}">
      <div class="ct-check">${isSel ? '✓' : ''}</div>
      <div class="oc-icon">${t.i}</div><div class="oc-label">${t.v}</div><div class="oc-sub">${t.s}</div>
    </div>`;
  }).join('');
  g.querySelectorAll('.oc').forEach(el => el.addEventListener('click', (e) => {
    const v = (e.currentTarget as HTMLElement).dataset.v!;
    const idx = U.ob.cts.indexOf(v);
    if (idx >= 0) U.ob.cts.splice(idx, 1);
    else U.ob.cts.push(v);
    buildCTGrid();
  }));
}

async function startGeneration() {
  showPage('gen');
  try {
    const posts = await GeminiService.generateMonthlyPlan({
      platform: U.ob.plt!,
      niche: U.ob.niche!,
      contentTypes: U.ob.cts,
      frequency: U.ob.freq!,
      month: MONTHS[U.calM],
      year: U.calY
    });
    
    posts.forEach(p => {
      U.cal[p.key] = p;
    });
    
    uSave();
    goto('dash');
  } catch (e) {
    console.error(e);
    showToast("AI Generation failed. Please try again.");
    showPage('ob');
  }
}

// ═══════════════════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════════════════
function renderCal() {
  const y = U.calY, m = U.calM;
  document.getElementById('calMonthLbl')!.textContent = MONTHS[m] + ' ' + y;
  
  const grid = document.getElementById('calGrid')!;
  const firstDOW = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  
  let html = '';
  for (let i = 0; i < firstDOW; i++) html += '<div class="cal-cell other"></div>';
  
  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming: Post[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const post = U.cal[key];
    const isDone = U.done[key];
    const isToday = key === todayStr;
    
    if (post && !isDone && key >= todayStr) {
      upcoming.push(post);
    }

    html += `
      <div class="cal-cell ${post ? 'has-post' : ''} ${isToday ? 'today' : ''} ${isDone ? 'done' : ''}" data-key="${key}">
        <div class="cal-num">${d}</div>
        ${post ? `
          <div class="cal-content-area">
            <div class="cal-hook-txt">${post.hook}</div>
          </div>
          <div class="ct-tag" data-ct="${post.ct}">${post.ct}</div>
        ` : ''}
      </div>
    `;
  }
  
  grid.innerHTML = html;
  grid.querySelectorAll('.has-post').forEach(el => el.addEventListener('click', (e) => {
    openSP((e.currentTarget as HTMLElement).dataset.key!);
  }));

  // Render Upcoming
  const ucList = document.getElementById('ucList')!;
  ucList.innerHTML = upcoming.slice(0, 5).map(p => `
    <div class="uc-item" data-key="${p.key}">
      <div class="uc-date">${p.key.split('-')[2]} ${MONTHS[parseInt(p.key.split('-')[1]) - 1].slice(0, 3)}</div>
      <div class="uc-info">
        <div class="uc-hook">${p.hook}</div>
        <div class="ct-tag" data-ct="${p.ct}">${p.ct}</div>
      </div>
    </div>
  `).join('') || '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">No upcoming posts.</div>';
  ucList.querySelectorAll('.uc-item').forEach(el => el.addEventListener('click', (e) => {
    openSP((e.currentTarget as HTMLElement).dataset.key!);
  }));
}

function openSP(key: string) {
  const post = U.cal[key];
  if (!post) return;
  U.openKey = key;
  
  document.getElementById('spMeta')!.textContent = post.ct;
  document.getElementById('spTitle')!.textContent = post.hook;
  document.getElementById('spHook')!.textContent = post.hook;
  (document.getElementById('spCap') as HTMLTextAreaElement).value = U.edits[key]?.cap || post.cap;
  document.getElementById('spCTA')!.textContent = post.cta;
  document.getElementById('spTags')!.innerHTML = post.tags.map(t => `<span class="sp-tag">${t}</span>`).join('');
  
  const markBtn = document.getElementById('spMarkBtn')!;
  if (U.done[key]) {
    markBtn.textContent = '✓ Done';
    markBtn.classList.add('done');
  } else {
    markBtn.textContent = '🔥 Mark Done';
    markBtn.classList.remove('done');
  }

  document.getElementById('spOv')!.classList.add('on');
  document.getElementById('sp')!.classList.add('on');
}

function toggleDone() {
  if (!U.openKey) return;
  U.done[U.openKey] = !U.done[U.openKey];
  uSave();
  calcStreak();
  updateStats();
  renderCal();
  document.getElementById('spOv')!.classList.remove('on');
  document.getElementById('sp')!.classList.remove('on');
}

function calcStreak() {
  const today = new Date().toISOString().split('T')[0];
  const doneKeys = Object.keys(U.done).filter(k => U.done[k]).sort().reverse();
  
  let streak = 0;
  let current = new Date(today);
  
  for (const key of doneKeys) {
    const d = new Date(key);
    const diff = (current.getTime() - d.getTime()) / (1000 * 3600 * 24);
    if (diff <= 1) {
      streak++;
      current = d;
    } else break;
  }
  U.streak = streak;
  U.best = Math.max(U.best, streak);
}

function updateStats() {
  const planned = Object.keys(U.cal).length;
  const done = Object.keys(U.done).filter(k => U.done[k]).length;
  const pct = planned ? Math.round((done / planned) * 100) : 0;

  document.getElementById('streakVal')!.textContent = String(U.streak);
  document.getElementById('qPlanned')!.textContent = String(planned);
  document.getElementById('qDone')!.textContent = String(done);
  document.getElementById('qPct')!.textContent = pct + '%';
  document.getElementById('qBest')!.textContent = String(U.best);
  
  const bar = document.getElementById('streakBar')!;
  bar.style.width = Math.min(100, (U.streak / 7) * 100) + '%';
}

// ═══════════════════════════════════════════════════════
// AI ASSISTANT
// ═══════════════════════════════════════════════════════
async function sendAI() {
  const input = document.getElementById('aiIn') as HTMLInputElement;
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const msgs = document.getElementById('aiMsgs')!;
  msgs.innerHTML += `<div class="ai-msg u"><div class="ai-bub usr">${msg}</div></div>`;
  
  const typing = document.createElement('div');
  typing.className = 'ai-msg';
  typing.innerHTML = '<div class="ai-bub bot">Thinking...</div>';
  msgs.appendChild(typing);
  msgs.scrollTop = msgs.scrollHeight;

  try {
    const reply = await GeminiService.chat(msg, {
      plt: U.ob.plt,
      niche: U.ob.niche,
      cts: U.ob.cts,
      metrics: U.metrics
    });
    typing.remove();
    msgs.innerHTML += `<div class="ai-msg"><div class="ai-bub bot">${reply}</div></div>`;
  } catch (e) {
    typing.textContent = "Error connecting to AI.";
  }
  msgs.scrollTop = msgs.scrollHeight;
}

function renderAnalytics() {
  const main = document.getElementById('anMain')!;
  const totalDone = Object.keys(U.done).filter(k => U.done[k]).length;
  const totalPlanned = Object.keys(U.cal).length;
  const pct = totalPlanned ? Math.round((totalDone / totalPlanned) * 100) : 0;

  main.innerHTML = `
    <div class="an-header">
      <h1 class="an-title">Growth Analytics</h1>
      <p class="an-sub">Tracking your progress in the ${U.ob.niche} niche on ${U.ob.plt}.</p>
    </div>
    
    <div class="an-grid">
      <div class="an-card">
        <div class="an-card-lbl">Content Consistency</div>
        <div class="an-card-val">${pct}%</div>
        <div class="an-card-sub">Goal: 100% completion</div>
      </div>
      <div class="an-card">
        <div class="an-card-lbl">Total Posts Published</div>
        <div class="an-card-val">${totalDone}</div>
        <div class="an-card-sub">Across all platforms</div>
      </div>
      <div class="an-card">
        <div class="an-card-lbl">Active Streak</div>
        <div class="an-card-val">${U.streak}d</div>
        <div class="an-card-sub">Keep it up!</div>
      </div>
    </div>

    <div class="an-chart-box">
      <div class="an-chart-head">
        <div class="an-chart-title">Engagement Overview (Mock Data)</div>
      </div>
      <div class="an-chart-body" id="anChart">
        <!-- Chart will be rendered here -->
        <div style="height:200px;display:flex;align-items:flex-end;gap:12px;padding:20px 0;">
          ${[40, 65, 45, 80, 55, 90, 70].map(h => `<div style="flex:1;background:var(--accent);height:${h}%;border-radius:4px 4px 0 0;opacity:0.8;"></div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
      </div>
    </div>
  `;
}
// ═══════════════════════════════════════════════════════
function goto(page: string) {
  showPage(page);
  if (page === 'dash') {
    renderCal();
    calcStreak();
    updateStats();
  } else if (page === 'an') {
    renderAnalytics();
  } else if (page === 'ai' && !U.aiInited) {
    U.aiInited = true;
    document.getElementById('aiMsgs')!.innerHTML = '<div class="ai-msg"><div class="ai-bub bot">Hello! I am your SocialTrackr AI. How can I help you grow today?</div></div>';
    
    const chips = [
      { l: '✨ Improve a hook', m: 'Improve this hook: "' },
      { l: '✍️ Rewrite caption', m: 'Rewrite this caption: ' },
      { l: '🏷️ Hashtags', m: 'Give me 15 targeted hashtags for ' + U.ob.niche },
      { l: '💡 Content angles', m: 'Give me 3 content angles for ' + U.ob.niche },
    ];
    document.getElementById('aiChips')!.innerHTML = chips.map(c =>
      `<button class="ai-chip" data-msg="${c.m}">${c.l}</button>`
    ).join('');
    document.getElementById('aiChips')!.querySelectorAll('.ai-chip').forEach(el => el.addEventListener('click', (e) => {
      const msg = (e.currentTarget as HTMLElement).dataset.msg!;
      const input = document.getElementById('aiIn') as HTMLInputElement;
      input.value = msg;
      input.focus();
    }));
  }
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
function init() {
  dbLoad();
  
  // Event Listeners
  document.getElementById('authBtn')?.addEventListener('click', handleAuth);
  document.getElementById('googleAuthBtn')?.addEventListener('click', async () => {
    const email = 'google.user@gmail.com';
    if (!DB.users[email]) {
      const name = await openModal({
        title: 'Welcome!',
        desc: 'Please enter your name to continue with Google.',
        input: 'Google User',
        confirmTxt: 'Continue'
      });
      if (!name || typeof name !== 'string') return;
      DB.users[email] = { name, email, pw: '__google__', at: Date.now() };
      dbSave();
    }
    doLogin(email);
  });
  document.getElementById('toggleAuthMode')?.addEventListener('click', toggleAuthMode);
  document.getElementById('obNextBtn')?.addEventListener('click', () => {
    if (U.obStep < 4) {
      U.obStep++;
      renderOb();
    } else startGeneration();
  });
  document.getElementById('obBackBtn')?.addEventListener('click', () => {
    if (U.obStep > 1) {
      U.obStep--;
      renderOb();
    }
  });
  
  document.getElementById('freq3')?.addEventListener('click', () => { U.ob.freq = 3; renderOb(); });
  document.getElementById('freq5')?.addEventListener('click', () => { U.ob.freq = 5; renderOb(); });
  document.getElementById('freq7')?.addEventListener('click', () => { U.ob.freq = 7; renderOb(); });
  
  document.getElementById('navDash')?.addEventListener('click', () => goto('dash'));
  document.getElementById('navAn')?.addEventListener('click', () => goto('an'));
  document.getElementById('navAi')?.addEventListener('click', () => goto('ai'));
  document.getElementById('navDash2')?.addEventListener('click', () => goto('dash'));
  document.getElementById('navAn2')?.addEventListener('click', () => goto('an'));
  document.getElementById('navAi2')?.addEventListener('click', () => goto('ai'));
  document.getElementById('navDash3')?.addEventListener('click', () => goto('dash'));
  document.getElementById('navAn3')?.addEventListener('click', () => goto('an'));
  
  const signOut = () => {
    DB.session = null;
    dbSave();
    resetU();
    showPage('login');
  };
  document.getElementById('navSignOut')?.addEventListener('click', signOut);
  document.getElementById('navSignOut2')?.addEventListener('click', signOut);
  document.getElementById('navSignOut3')?.addEventListener('click', signOut);
  
  document.getElementById('aiIn')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendAI();
  });
  document.getElementById('btnSendAI')?.addEventListener('click', sendAI);
  
  document.getElementById('btnPrevMonth')?.addEventListener('click', () => {
    U.calM--;
    if (U.calM < 0) { U.calM = 11; U.calY--; }
    renderCal();
  });
  document.getElementById('btnNextMonth')?.addEventListener('click', () => {
    U.calM++;
    if (U.calM > 11) { U.calM = 0; U.calY++; }
    renderCal();
  });
  document.getElementById('btnRegen')?.addEventListener('click', async () => {
    const ok = await openModal({
      title: 'Regenerate Calendar?',
      desc: "This will replace all posts for this month. Your current edits will be lost.",
      confirmTxt: 'Regenerate',
      icon: '↻'
    });
    if (ok === true) {
      await startGeneration();
    }
  });
  
  document.getElementById('btnSaveSP')?.addEventListener('click', () => {
    if (!U.openKey) return;
    U.edits[U.openKey] = {
      cap: (document.getElementById('spCap') as HTMLTextAreaElement).value,
      notes: (document.getElementById('spNotes') as HTMLTextAreaElement).value,
    };
    uSave();
    showToast('✓ Saved');
    document.getElementById('spOv')!.classList.remove('on');
    document.getElementById('sp')!.classList.remove('on');
  });

  document.getElementById('btnAiHelp')?.addEventListener('click', () => {
    goto('ai');
    const post = U.cal[U.openKey!];
    const input = document.getElementById('aiIn') as HTMLInputElement;
    input.value = `Help me improve this ${post.ct} post about ${post.niche}: "${post.hook}"`;
    input.focus();
  });
  document.getElementById('spMarkBtn')?.addEventListener('click', toggleDone);
  document.getElementById('btnCloseSP')?.addEventListener('click', () => {
    document.getElementById('spOv')!.classList.remove('on');
    document.getElementById('sp')!.classList.remove('on');
  });
  document.getElementById('spOv')?.addEventListener('click', () => {
    document.getElementById('spOv')!.classList.remove('on');
    document.getElementById('sp')!.classList.remove('on');
  });

  // Initial Route
  if (DB.session) {
    uLoad();
    updateNavUser();
    const onboarded = U.ob.plt && U.ob.niche && U.ob.cts.length > 0 && U.ob.freq;
    if (onboarded) goto('dash');
    else {
      showPage('ob');
      renderOb();
    }
  } else {
    showPage('login');
  }

  // Hide loading
  const loader = document.getElementById('app-loading');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 300);
  }
}

// Run init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
