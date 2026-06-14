
/* ============================================================
   1911 — script.js  (audio-only build)
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────
   MEDIA LIBRARY  ← Sirf audio entries yahan add karo
   ───────────────────────────────────────── */
const MEDIA = [
  {
    title: "KODAK",
    artist: "King",
    type: "audio",
    cover: "./img/Kodak.jpg",
    src: "./mp3/Kodak.mp3"
  },
  {
    title: "Bandish",
    artist: "Talha",
    type: "audio",
    cover: "./img/Bandish.jpg",
    src: "./mp3/Bandish.mp3"
  },
  {
    title: "Luka Chippi",
    artist: "Seedhe Maut",
    type: "audio",
    cover: "./img/Luka Chippi.jpg",
    src: "./mp3/Luka Chippi.mp3"
  }
];

/* ─────────────────────────────────────────
   STATE
   ───────────────────────────────────────── */
const state = {
  currentIndex: -1,
  isPlaying: false,
  shuffle: false,
  repeat: 'none',      // 'none' | 'all' | 'one'
  volume: 1,
  speed: 1,
  currentPage: 'home',
  recentlyPlayed: [],
  favorites: [],
  playCounts: {},
  savedPositions: {},
  recentSearches: []
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/* ─────────────────────────────────────────
   PERSIST HELPERS
   ───────────────────────────────────────── */
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('1911') || '{}');
    state.recentlyPlayed = s.recentlyPlayed || [];
    state.favorites       = s.favorites       || [];
    state.playCounts      = s.playCounts      || {};
    state.savedPositions  = s.savedPositions  || {};
    state.recentSearches  = s.recentSearches  || [];
    state.volume          = s.volume !== undefined ? s.volume : 1;
    state.currentIndex    = s.currentIndex !== undefined ? s.currentIndex : -1;
  } catch(e) {}
}

function saveState() {
  try {
    localStorage.setItem('1911', JSON.stringify({
      recentlyPlayed: state.recentlyPlayed,
      favorites:      state.favorites,
      playCounts:     state.playCounts,
      savedPositions: state.savedPositions,
      recentSearches: state.recentSearches,
      volume:         state.volume,
      currentIndex:   state.currentIndex
    }));
  } catch(e) {}
}

/* ─────────────────────────────────────────
   DOM REFS
   ───────────────────────────────────────── */
const $ = id => document.getElementById(id);

const audio      = $('main-audio');
const miniPlayer = $('mini-player');
const fullPlayer = $('full-player');
const fpBg       = $('fp-bg');
const fpSeek     = $('fp-seek');
const fpVol      = $('fp-vol');
const fpCur      = $('fp-cur');
const fpDur      = $('fp-dur');
const miniBar    = $('mini-bar');

/* ─────────────────────────────────────────
   UTILITIES
   ───────────────────────────────────────── */
function formatTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function fallbackCover(el) {
  el.src = 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#222"/>
      <circle cx="100" cy="100" r="40" fill="none" stroke="#444" stroke-width="6"/>
      <circle cx="100" cy="100" r="12" fill="#444"/>
      <line x1="100" y1="60" x2="100" y2="40" stroke="#444" stroke-width="4"/>
    </svg>`);
}

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ─────────────────────────────────────────
   CARD / TRACK BUILDERS
   ───────────────────────────────────────── */
function buildCard(idx) {
  const m = MEDIA[idx];
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-cover">
      <img src="${m.cover}" alt="${m.title}" loading="lazy" />
      <div class="card-cover-play">
        <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" fill="#000"/></svg>
      </div>
    </div>
    <div class="card-title">${m.title}</div>
    <div class="card-artist">${m.artist}</div>`;
  card.querySelector('img').onerror = e => fallbackCover(e.target);
  card.addEventListener('click', () => playMedia(idx));
  return card;
}

function buildTrackItem(idx) {
  const m = MEDIA[idx];
  const isFav = state.favorites.includes(idx);
  const isPlaying = state.currentIndex === idx && state.isPlaying;
  const li = document.createElement('div');
  li.className = 'track-item' + (isPlaying ? ' playing' : '');
  li.dataset.idx = idx;
  li.innerHTML = `
    <img class="track-thumb" src="${m.cover}" alt="${m.title}" loading="lazy" />
    <div class="track-meta">
      <div class="track-title">${m.title}</div>
      <div class="track-artist">${m.artist}</div>
    </div>
    <button class="track-fav${isFav ? ' active' : ''}" aria-label="Favourite" data-idx="${idx}">
      <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.8" ${isFav ? 'fill="#1db954"' : 'fill="none"'}/></svg>
    </button>`;
  li.querySelector('img').onerror = e => fallbackCover(e.target);
  li.addEventListener('click', e => {
    if (e.target.closest('.track-fav')) return;
    playMedia(idx);
  });
  li.querySelector('.track-fav').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFav(idx);
    renderSongsPage();
  });
  return li;
}

function buildSkeletonCards(n) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const div = document.createElement('div');
    div.className = 'skeleton-card';
    div.innerHTML = `
      <div class="skeleton skeleton-cover"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-sub"></div>`;
    frag.appendChild(div);
  }
  return frag;
}

/* ─────────────────────────────────────────
   PLAYBACK ENGINE
   ───────────────────────────────────────── */
function playMedia(idx) {
  if (idx < 0 || idx >= MEDIA.length) return;
  const m = MEDIA[idx];

  // Save position of previous
  if (state.currentIndex >= 0 && !isNaN(audio.currentTime)) {
    state.savedPositions[state.currentIndex] = audio.currentTime;
  }

  state.currentIndex = idx;

  // Update play counts & recently played
  state.playCounts[idx] = (state.playCounts[idx] || 0) + 1;
  state.recentlyPlayed = [idx, ...state.recentlyPlayed.filter(i => i !== idx)].slice(0, 20);

  audio.src = m.src;
  audio.volume = state.volume;
  audio.playbackRate = state.speed;
  const saved = state.savedPositions[idx] || 0;
  audio.addEventListener('loadedmetadata', () => {
    if (saved > 0) audio.currentTime = saved;
  }, { once: true });
  audio.play().catch(() => {});

  state.isPlaying = true;
  saveState();
  updatePlayerUI(m);
  openFullPlayer();
}

function togglePlay() {
  if (!audio) return;
  if (state.isPlaying) {
    audio.pause();
    state.isPlaying = false;
  } else {
    audio.play().catch(() => {});
    state.isPlaying = true;
  }
  updatePlayIcons();
}

function playNext() {
  if (MEDIA.length === 0) return;
  let next;
  if (state.repeat === 'one') {
    next = state.currentIndex;
  } else if (state.shuffle) {
    do { next = Math.floor(Math.random() * MEDIA.length); } while (next === state.currentIndex && MEDIA.length > 1);
  } else {
    next = (state.currentIndex + 1) % MEDIA.length;
  }
  playMedia(next);
}

function playPrev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const prev = (state.currentIndex - 1 + MEDIA.length) % MEDIA.length;
  playMedia(prev);
}

function toggleFav(idx) {
  if (state.favorites.includes(idx)) {
    state.favorites = state.favorites.filter(i => i !== idx);
    toast('Removed from Favourites');
  } else {
    state.favorites.push(idx);
    toast('Added to Favourites ♥');
  }
  saveState();
  updateFavIcon();
}

function updateFavIcon() {
  const btn = $('fp-fav');
  const isFav = state.favorites.includes(state.currentIndex);
  btn.classList.toggle('active', isFav);
}

/* ─────────────────────────────────────────
   UI UPDATES
   ───────────────────────────────────────── */
function updatePlayerUI(m) {
  $('mini-cover').src = m.cover;
  $('mini-cover').onerror = e => fallbackCover(e.target);
  $('mini-title').textContent = m.title;
  $('mini-artist').textContent = m.artist;
  miniPlayer.classList.remove('hidden');

  fpBg.style.backgroundImage = `url(${m.cover})`;
  $('fp-cover').src = m.cover;
  $('fp-cover').onerror = e => fallbackCover(e.target);
  $('fp-title').textContent = m.title;
  $('fp-artist').textContent = m.artist;
  $('fp-label').textContent = 'Now Playing';

  updatePlayIcons();
  updateFavIcon();
}

function updatePlayIcons() {
  const playing = state.isPlaying;
  const pauseIcon = `<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>`;
  const playIcon  = `<polygon points="5,3 19,12 5,21" fill="currentColor"/>`;
  $('fp-play-icon').innerHTML   = playing ? pauseIcon : playIcon;
  $('mini-play-icon').innerHTML = playing ? pauseIcon : playIcon;
  miniPlayer.classList.toggle('paused', !playing);
}

function updateProgress() {
  if (isNaN(audio.duration)) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  fpSeek.value = pct;
  miniBar.style.width = pct + '%';
  fpCur.textContent  = formatTime(audio.currentTime);
  fpDur.textContent  = formatTime(audio.duration);
}

/* ─────────────────────────────────────────
   FULL PLAYER OPEN / CLOSE
   ───────────────────────────────────────── */
function openFullPlayer() {
  fullPlayer.classList.remove('hidden');
  requestAnimationFrame(() => fullPlayer.classList.add('open'));
}

function closeFullPlayer() {
  fullPlayer.classList.remove('open');
  setTimeout(() => fullPlayer.classList.add('hidden'), 380);
}

/* ─────────────────────────────────────────
   NAVIGATION
   ───────────────────────────────────────── */
function navigateTo(page) {
  if (state.currentPage === page) return;
  state.currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const pageEl = $(`page-${page}`);
  const navEl  = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (pageEl) pageEl.classList.add('active');
  if (navEl)  navEl.classList.add('active');

  if (page === 'songs')  renderSongsPage();
  if (page === 'home')   renderHome();
}

/* ─────────────────────────────────────────
   HOME PAGE
   ───────────────────────────────────────── */
function renderHome() {
  const hour = new Date().getHours();
  $('greeting').textContent = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  renderQuickGrid();
  renderHScroll('recently-played',    state.recentlyPlayed.slice(0, 10));
  renderHScroll('continue-listening', state.recentlyPlayed.filter(i => (state.savedPositions[i] || 0) > 5).slice(0, 8));
  renderHScroll('recommended',        getRecommended(8));
  renderHScroll('trending',           [...MEDIA.keys()].sort((a,b) => (state.playCounts[b]||0) - (state.playCounts[a]||0)).slice(0, 10));
}

function renderQuickGrid() {
  const el = $('quick-grid');
  el.innerHTML = '';
  const items = state.recentlyPlayed.slice(0, 6);
  if (items.length === 0) {
    el.innerHTML = '<p style="padding:8px 4px;color:var(--text3);font-size:13px;grid-column:1/-1">No recent plays yet</p>';
    return;
  }
  items.forEach(idx => {
    const m = MEDIA[idx];
    if (!m) return;
    const div = document.createElement('div');
    div.className = 'quick-card';
    div.innerHTML = `
      <img src="${m.cover}" alt="${m.title}" />
      <span class="quick-card-title">${m.title}</span>`;
    div.querySelector('img').onerror = e => fallbackCover(e.target);
    div.addEventListener('click', () => playMedia(idx));
    el.appendChild(div);
  });
}

function renderHScroll(containerId, indices) {
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = '';
  // Filter out invalid indices
  const valid = indices.filter(i => i >= 0 && i < MEDIA.length);
  if (valid.length === 0) {
    el.appendChild(buildSkeletonCards(4));
    return;
  }
  valid.forEach(idx => el.appendChild(buildCard(idx)));
}

function getRecommended(n) {
  const recent = new Set(state.recentlyPlayed);
  const pool = [...MEDIA.keys()].filter(i => !recent.has(i));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // If all songs already played, just return all shuffled
  if (pool.length === 0) return [...MEDIA.keys()].sort(() => Math.random() - 0.5).slice(0, n);
  return pool.slice(0, n);
}

/* ─────────────────────────────────────────
   SEARCH PAGE
   ───────────────────────────────────────── */
const CATEGORIES = [
  { name: 'Favourites', color: '#5f1a2e' },
  { name: 'Trending',   color: '#1a3d2e' },
  { name: 'Most Played', color: '#1e3a5f' },
  { name: 'All Songs',  color: '#3d1a5f' }
];

function renderSearchPage() {
  const catGrid = $('cat-grid');
  catGrid.innerHTML = '';
  CATEGORIES.forEach(c => {
    const div = document.createElement('div');
    div.className = 'cat-card';
    div.style.background = c.color;
    div.textContent = c.name;
    div.addEventListener('click', () => {
      $('search-input').value = c.name.toLowerCase();
      doSearch(c.name.toLowerCase());
    });
    catGrid.appendChild(div);
  });
  renderRecentSearches();
}

function renderRecentSearches() {
  const ul = $('recent-list');
  ul.innerHTML = '';
  state.recentSearches.slice(0, 5).forEach(q => {
    const li = document.createElement('li');
    li.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg> ${q}`;
    li.addEventListener('click', () => {
      $('search-input').value = q;
      doSearch(q);
    });
    ul.appendChild(li);
  });
}

function doSearch(q) {
  const grid = $('results-grid');
  const searchRecent = $('search-recent');
  const cats = $('search-categories');
  const results = $('search-results');

  if (!q) {
    results.classList.add('hidden');
    searchRecent.classList.remove('hidden');
    cats.classList.remove('hidden');
    return;
  }

  state.recentSearches = [q, ...state.recentSearches.filter(s => s !== q)].slice(0, 10);
  saveState();

  const qLow = q.toLowerCase();

  // Special category searches
  let filtered;
  if (qLow === 'favourites') {
    filtered = state.favorites.filter(i => MEDIA[i]);
  } else if (qLow === 'trending' || qLow === 'most played') {
    filtered = [...MEDIA.keys()].sort((a,b) => (state.playCounts[b]||0) - (state.playCounts[a]||0));
  } else if (qLow === 'all songs') {
    filtered = [...MEDIA.keys()];
  } else {
    filtered = [...MEDIA.keys()].filter(i => {
      const m = MEDIA[i];
      return m.title.toLowerCase().includes(qLow) || m.artist.toLowerCase().includes(qLow);
    });
  }

  grid.innerHTML = '';
  results.classList.remove('hidden');
  searchRecent.classList.add('hidden');
  cats.classList.add('hidden');

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="color:var(--text3);padding:16px;grid-column:1/-1">No results found</p>';
    return;
  }
  filtered.forEach(idx => grid.appendChild(buildCard(idx)));
}

/* ─────────────────────────────────────────
   SONGS PAGE
   ───────────────────────────────────────── */
function renderSongsPage() {
  const audios = [...MEDIA.keys()];

  // All Songs
  const all = $('all-tracks');
  all.innerHTML = '';
  audios.forEach(idx => all.appendChild(buildTrackItem(idx)));

  // Favourites
  const favEl = $('fav-tracks');
  favEl.innerHTML = '';
  const favs = state.favorites.filter(i => MEDIA[i]);
  if (favs.length === 0) {
    favEl.innerHTML = '<p style="color:var(--text3);padding:16px">No favourites yet — tap ♥ on a track</p>';
  } else {
    favs.forEach(idx => favEl.appendChild(buildTrackItem(idx)));
  }

  // Most Played
  const mostEl = $('most-tracks');
  mostEl.innerHTML = '';
  const sorted = [...audios].sort((a,b) => (state.playCounts[b]||0) - (state.playCounts[a]||0));
  if (!sorted.some(i => state.playCounts[i])) {
    mostEl.innerHTML = '<p style="color:var(--text3);padding:16px">Play some tracks to see stats</p>';
  } else {
    sorted.forEach(idx => mostEl.appendChild(buildTrackItem(idx)));
  }

  // Artists
  const artistGrid = $('artist-grid');
  artistGrid.innerHTML = '';
  const artists = [...new Set(audios.map(i => MEDIA[i].artist))];
  artists.forEach(name => {
    const firstIdx = audios.find(i => MEDIA[i].artist === name);
    const cover = MEDIA[firstIdx].cover;
    const div = document.createElement('div');
    div.className = 'artist-card';
    div.innerHTML = `
      <div class="artist-avatar"><img src="${cover}" alt="${name}" loading="lazy" /></div>
      <span class="artist-name">${name}</span>`;
    div.querySelector('img').onerror = e => fallbackCover(e.target);
    div.addEventListener('click', () => {
      navigateTo('search');
      $('search-input').value = name;
      doSearch(name);
    });
    artistGrid.appendChild(div);
  });
}

/* ─────────────────────────────────────────
   EVENT WIRING
   ───────────────────────────────────────── */
function wireEvents() {
  // Nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Mini player → open full player
  miniPlayer.addEventListener('click', e => {
    if (e.target.closest('.mini-controls')) return;
    if (state.currentIndex >= 0) openFullPlayer();
  });

  // Mini controls
  $('mini-play').addEventListener('click', e => { e.stopPropagation(); togglePlay(); });
  $('mini-prev').addEventListener('click', e => { e.stopPropagation(); playPrev(); });
  $('mini-next').addEventListener('click', e => { e.stopPropagation(); playNext(); });

  // Full player
  $('fp-close').addEventListener('click', closeFullPlayer);
  $('fp-play').addEventListener('click', togglePlay);
  $('fp-prev').addEventListener('click', playPrev);
  $('fp-next').addEventListener('click', playNext);

  // Seek
  fpSeek.addEventListener('input', () => {
    if (isFinite(audio.duration)) audio.currentTime = (fpSeek.value / 100) * audio.duration;
  });

  // Volume
  fpVol.addEventListener('input', () => {
    state.volume = fpVol.value / 100;
    audio.volume = state.volume;
    saveState();
  });

  // Shuffle
  $('fp-shuffle').addEventListener('click', () => {
    state.shuffle = !state.shuffle;
    $('fp-shuffle').classList.toggle('active', state.shuffle);
    toast(state.shuffle ? 'Shuffle on' : 'Shuffle off');
  });

  // Repeat
  $('fp-repeat').addEventListener('click', () => {
    const modes = ['none', 'all', 'one'];
    state.repeat = modes[(modes.indexOf(state.repeat) + 1) % modes.length];
    $('fp-repeat').classList.toggle('active', state.repeat !== 'none');
    const labels = { none: 'Repeat off', all: 'Repeat all', one: 'Repeat one' };
    toast(labels[state.repeat]);
  });

  // Speed
  $('fp-speed').addEventListener('click', () => {
    const idx = SPEEDS.indexOf(state.speed);
    state.speed = SPEEDS[(idx + 1) % SPEEDS.length];
    $('fp-speed').textContent = state.speed + '×';
    audio.playbackRate = state.speed;
    toast('Speed: ' + state.speed + '×');
  });

  // Fav
  $('fp-fav').addEventListener('click', () => {
    if (state.currentIndex >= 0) toggleFav(state.currentIndex);
  });

  // Audio events
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('play',  () => { state.isPlaying = true;  updatePlayIcons(); });
  audio.addEventListener('pause', () => { state.isPlaying = false; updatePlayIcons(); });

  // Search
  const searchInput = $('search-input');
  let searchDebounce;
  searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim();
    $('search-clear').classList.toggle('hidden', !val);
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => doSearch(val), 200);
  });
  $('search-clear').addEventListener('click', () => {
    searchInput.value = '';
    $('search-clear').classList.add('hidden');
    doSearch('');
  });

  // Songs page tabs
  document.querySelectorAll('.audio-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.audio-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.audio-tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      $(btn.dataset.tab).classList.add('active');
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    switch(e.code) {
      case 'Space':      e.preventDefault(); togglePlay(); break;
      case 'ArrowRight': audio.currentTime = Math.min(audio.duration, audio.currentTime + 10); break;
      case 'ArrowLeft':  audio.currentTime = Math.max(0, audio.currentTime - 10); break;
      case 'ArrowUp':    state.volume = Math.min(1, state.volume + 0.1); audio.volume = state.volume; break;
      case 'ArrowDown':  state.volume = Math.max(0, state.volume - 0.1); audio.volume = state.volume; break;
      case 'KeyN':       playNext(); break;
      case 'KeyP':       playPrev(); break;
      case 'Escape':     closeFullPlayer(); break;
    }
  });

  // Swipe down to close full player
  let touchStartY = 0;
  fullPlayer.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
  fullPlayer.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientY - touchStartY > 80) closeFullPlayer();
  }, { passive: true });

  // Save position on hide
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.currentIndex >= 0 && !isNaN(audio.currentTime)) {
      state.savedPositions[state.currentIndex] = audio.currentTime;
      saveState();
    }
  });
}

function onEnded() {
  if (state.repeat === 'one') {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else {
    playNext();
  }
}

/* ─────────────────────────────────────────
   INIT
   ───────────────────────────────────────── */
function init() {
  loadState();

  setTimeout(() => {
    $('splash').classList.add('fade-out');
    setTimeout(() => {
      $('splash').classList.add('hidden');
      $('app').classList.remove('hidden');
      wireEvents();
      renderSearchPage();
      renderHome();
      renderSongsPage();

      audio.volume = state.volume;
      fpVol.value  = state.volume * 100;
    }, 500);
  }, 1200);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
