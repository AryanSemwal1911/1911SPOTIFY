/* ============================================================
   WAVIFY — script.js
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────
   MEDIA LIBRARY  ← Edit this array only
   ───────────────────────────────────────── */
const MEDIA = [
  // AUDIO examples
{
    title: "KODAK",
    artist: "King",
    type: "audio",
    cover: "./img/kodak.jpg",
    src: "./mp3/kodak.mp3"
  }},
  {
    title: "Talha",
    artist: "Talha Anjum",
    type: "audio",
    cover: "./img/talha.jpg",
    src: "./audio/talha.mp3"
  },
  {
    title: "Song One",
    artist: "Artist A",
    type: "audio",
    cover: "./img/song1.jpg",
    src: "./audio/song1.mp3"
  },
  // VIDEO examples
  {
    title: "Talha Live",
    artist: "Talha Anjum",
    type: "video",
    cover: "./img/talha.jpg",
    src: "./video/talha.mp4"
  },
  {
    title: "AUR – Official Video",
    artist: "AUR",
    type: "video",
    cover: "./img/shikayat.jpg",
    src: "./video/aur.mp4"
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
  muted: false,
  speed: 1,
  currentPage: 'home',
  // Persisted via localStorage
  recentlyPlayed: [],  // array of indices
  favorites: [],       // array of indices
  playCounts: {},      // index → count
  savedPositions: {},  // index → seconds
  recentSearches: []
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/* ─────────────────────────────────────────
   PERSIST HELPERS
   ───────────────────────────────────────── */
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('wavify') || '{}');
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
    localStorage.setItem('wavify', JSON.stringify({
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

const audio       = $('main-audio');
const video       = $('fp-video');
const miniPlayer  = $('mini-player');
const fullPlayer  = $('full-player');
const fpBg        = $('fp-bg');
const fpSeek      = $('fp-seek');
const fpVol       = $('fp-vol');
const fpCur       = $('fp-cur');
const fpDur       = $('fp-dur');
const miniBar     = $('mini-bar');

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

function placeholderBg(seed) {
  const colors = ['#1e3a5f','#3d1a5f','#1a3d2e','#5f1a1a','#3d3d1a','#1a3d5f'];
  return colors[seed % colors.length];
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
      <span class="card-type">${m.type === 'video' ? '▶ Video' : '♫ Audio'}</span>
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
      <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.8" ${isFav ? `fill="${getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()}"` : 'fill="none"'}/></svg>
    </button>`;
  li.querySelector('img').onerror = e => fallbackCover(e.target);
  li.addEventListener('click', e => {
    if (e.target.closest('.track-fav')) return;
    playMedia(idx);
  });
  li.querySelector('.track-fav').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFav(idx);
    renderAudioPage();
  });
  return li;
}

function buildVideoCard(idx) {
  const m = MEDIA[idx];
  const div = document.createElement('div');
  div.className = 'video-card';
  div.innerHTML = `
    <img class="video-thumb" src="${m.cover}" alt="${m.title}" loading="lazy" />
    <div class="video-info">
      <div class="video-title">${m.title}</div>
      <div class="video-artist">${m.artist}</div>
    </div>`;
  div.querySelector('img').onerror = e => fallbackCover(e.target);
  div.addEventListener('click', () => playMedia(idx));
  return div;
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
  if (state.currentIndex >= 0) {
    const prev = MEDIA[state.currentIndex];
    const el = prev.type === 'video' ? video : audio;
    if (!isNaN(el.currentTime)) {
      state.savedPositions[state.currentIndex] = el.currentTime;
    }
  }

  state.currentIndex = idx;

  // Update play counts & recently played
  state.playCounts[idx] = (state.playCounts[idx] || 0) + 1;
  state.recentlyPlayed = [idx, ...state.recentlyPlayed.filter(i => i !== idx)].slice(0, 20);

  if (m.type === 'video') {
    // Pause audio
    audio.pause();
    audio.src = '';
    video.src = m.src;
    video.volume = state.muted ? 0 : state.volume;
    video.playbackRate = state.speed;
    const saved = state.savedPositions[idx] || 0;
    video.addEventListener('loadedmetadata', () => {
      if (saved > 0) video.currentTime = saved;
    }, { once: true });
    video.play().catch(() => {});
    $('fp-pip').style.display = '';
    $('fp-fullscreen').style.display = '';
  } else {
    video.pause();
    video.src = '';
    audio.src = m.src;
    audio.volume = state.muted ? 0 : state.volume;
    audio.playbackRate = state.speed;
    const saved = state.savedPositions[idx] || 0;
    audio.addEventListener('loadedmetadata', () => {
      if (saved > 0) audio.currentTime = saved;
    }, { once: true });
    audio.play().catch(() => {});
    $('fp-pip').style.display = 'none';
    $('fp-fullscreen').style.display = 'none';
  }

  state.isPlaying = true;
  saveState();
  updatePlayerUI(m);
  openFullPlayer();
}

function currentMediaEl() {
  if (state.currentIndex < 0) return null;
  return MEDIA[state.currentIndex].type === 'video' ? video : audio;
}

function togglePlay() {
  const el = currentMediaEl();
  if (!el) return;
  if (state.isPlaying) {
    el.pause();
    state.isPlaying = false;
  } else {
    el.play().catch(() => {});
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
  const el = currentMediaEl();
  if (el && el.currentTime > 3) { el.currentTime = 0; return; }
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
  // Mini player
  $('mini-cover').src = m.cover;
  $('mini-cover').onerror = e => fallbackCover(e.target);
  $('mini-title').textContent = m.title;
  $('mini-artist').textContent = m.artist;
  miniPlayer.classList.remove('hidden');

  // Full player background
  fpBg.style.backgroundImage = `url(${m.cover})`;

  // Swap audio/video views
  const isVideo = m.type === 'video';
  $('fp-audio-view').classList.toggle('hidden', isVideo);
  $('fp-video-view').classList.toggle('hidden', !isVideo);

  if (!isVideo) {
    $('fp-cover').src = m.cover;
    $('fp-cover').onerror = e => fallbackCover(e.target);
    $('fp-title').textContent = m.title;
    $('fp-artist').textContent = m.artist;
  } else {
    $('fp-vtitle').textContent = m.title;
    $('fp-vartist').textContent = m.artist;
  }

  $('fp-label').textContent = isVideo ? 'Now Watching' : 'Now Playing';
  updatePlayIcons();
  updateFavIcon();
}

function updatePlayIcons() {
  const playing = state.isPlaying;
  const pauseIcon = `<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>`;
  const playIcon  = `<polygon points="5,3 19,12 5,21" fill="currentColor"/>`;
  $('fp-play-icon').innerHTML    = playing ? pauseIcon : playIcon;
  $('mini-play-icon').innerHTML  = playing ? pauseIcon : playIcon;
  miniPlayer.classList.toggle('paused', !playing);
}

function updateProgress() {
  const el = currentMediaEl();
  if (!el || isNaN(el.duration)) return;
  const pct = (el.currentTime / el.duration) * 100;
  fpSeek.value  = pct;
  miniBar.style.width = pct + '%';
  fpCur.textContent   = formatTime(el.currentTime);
  fpDur.textContent   = formatTime(el.duration);
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

  // Lazy render
  if (page === 'library')  renderLibrary();
  if (page === 'video')    renderVideoPage();
  if (page === 'audio')    renderAudioPage();
  if (page === 'home')     renderHome();
}

/* ─────────────────────────────────────────
   HOME PAGE
   ───────────────────────────────────────── */
function renderHome() {
  const hour = new Date().getHours();
  $('greeting').textContent = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  renderQuickGrid();
  renderHScroll('recently-played',   state.recentlyPlayed.slice(0, 10));
  renderHScroll('continue-listening', state.recentlyPlayed.filter(i => state.savedPositions[i] > 5).slice(0, 8));
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
  if (indices.length === 0) {
    // skeleton placeholders
    el.appendChild(buildSkeletonCards(4));
    return;
  }
  indices.forEach(idx => el.appendChild(buildCard(idx)));
}

function getRecommended(n) {
  // Simple recommendation: all indices not recently played, shuffled
  const recent = new Set(state.recentlyPlayed);
  const pool = [...MEDIA.keys()].filter(i => !recent.has(i));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

/* ─────────────────────────────────────────
   SEARCH PAGE
   ───────────────────────────────────────── */
const CATEGORIES = [
  { name: 'Audio',  color: '#1e3a5f' },
  { name: 'Video',  color: '#3d1a5f' },
  { name: 'Favourites', color: '#5f1a2e' },
  { name: 'Trending',   color: '#1a3d2e' }
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

  // Save search
  state.recentSearches = [q, ...state.recentSearches.filter(s => s !== q)].slice(0, 10);
  saveState();

  const qLow = q.toLowerCase();
  const filtered = [...MEDIA.keys()].filter(i => {
    const m = MEDIA[i];
    return m.title.toLowerCase().includes(qLow) ||
           m.artist.toLowerCase().includes(qLow) ||
           m.type.toLowerCase().includes(qLow);
  });

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
   LIBRARY PAGE
   ───────────────────────────────────────── */
let libFilter = 'all';
let libSort   = 'recent';
let libView   = 'grid';

function renderLibrary() {
  let indices = [...MEDIA.keys()];

  if (libFilter === 'audio') indices = indices.filter(i => MEDIA[i].type === 'audio');
  if (libFilter === 'video') indices = indices.filter(i => MEDIA[i].type === 'video');

  if (libSort === 'az')     indices.sort((a,b) => MEDIA[a].title.localeCompare(MEDIA[b].title));
  if (libSort === 'played') indices.sort((a,b) => {
    const ai = state.recentlyPlayed.indexOf(a);
    const bi = state.recentlyPlayed.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const grid = $('lib-grid');
  grid.innerHTML = '';
  grid.className = 'lib-grid' + (libView === 'list' ? ' list-view' : '');

  if (indices.length === 0) {
    grid.innerHTML = '<p style="color:var(--text3);padding:16px;grid-column:1/-1">Nothing here yet</p>';
    return;
  }
  indices.forEach(idx => grid.appendChild(buildCard(idx)));
}

/* ─────────────────────────────────────────
   VIDEO PAGE
   ───────────────────────────────────────── */
function renderVideoPage() {
  const videos = [...MEDIA.keys()].filter(i => MEDIA[i].type === 'video');
  const recent = state.recentlyPlayed.filter(i => MEDIA[i].type === 'video').slice(0, 6);

  renderHScroll('recent-videos', recent);

  const grid = $('video-grid');
  grid.innerHTML = '';
  videos.forEach(idx => grid.appendChild(buildVideoCard(idx)));
}

/* ─────────────────────────────────────────
   AUDIO PAGE
   ───────────────────────────────────────── */
function renderAudioPage() {
  const audios = [...MEDIA.keys()].filter(i => MEDIA[i].type === 'audio');

  // All Audio
  const all = $('all-tracks');
  all.innerHTML = '';
  audios.forEach(idx => all.appendChild(buildTrackItem(idx)));

  // Favourites
  const favEl = $('fav-tracks');
  favEl.innerHTML = '';
  const favs = state.favorites.filter(i => MEDIA[i] && MEDIA[i].type === 'audio');
  if (favs.length === 0) {
    favEl.innerHTML = '<p style="color:var(--text3);padding:16px">No favourites yet — tap ♥ on a track</p>';
  } else {
    favs.forEach(idx => favEl.appendChild(buildTrackItem(idx)));
  }

  // Most played
  const mostEl = $('most-tracks');
  mostEl.innerHTML = '';
  const sorted = [...audios].sort((a,b) => (state.playCounts[b]||0) - (state.playCounts[a]||0));
  if (sorted.filter(i => state.playCounts[i]).length === 0) {
    mostEl.innerHTML = '<p style="color:var(--text3);padding:16px">Play some tracks to see stats</p>';
  } else {
    sorted.forEach(idx => mostEl.appendChild(buildTrackItem(idx)));
  }

  // Artists
  const artistGrid = $('artist-grid');
  artistGrid.innerHTML = '';
  const artists = [...new Set(audios.map(i => MEDIA[i].artist))];
  artists.forEach(name => {
    const cover = MEDIA[audios.find(i => MEDIA[i].artist === name)].cover;
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

  // Full player close
  $('fp-close').addEventListener('click', closeFullPlayer);

  // Full player controls
  $('fp-play').addEventListener('click', togglePlay);
  $('fp-prev').addEventListener('click', playPrev);
  $('fp-next').addEventListener('click', playNext);
  $('fp-back10').addEventListener('click', () => { const el = currentMediaEl(); if (el) el.currentTime = Math.max(0, el.currentTime - 10); });
  $('fp-fwd10').addEventListener('click',  () => { const el = currentMediaEl(); if (el) el.currentTime = Math.min(el.duration, el.currentTime + 10); });

  // Seek
  fpSeek.addEventListener('input', () => {
    const el = currentMediaEl();
    if (el && isFinite(el.duration)) el.currentTime = (fpSeek.value / 100) * el.duration;
  });

  // Volume
  fpVol.addEventListener('input', () => {
    state.volume = fpVol.value / 100;
    const el = currentMediaEl();
    if (el) el.volume = state.volume;
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
    const el = currentMediaEl();
    if (el) el.playbackRate = state.speed;
    toast('Speed: ' + state.speed + '×');
  });

  // Fav
  $('fp-fav').addEventListener('click', () => {
    if (state.currentIndex >= 0) toggleFav(state.currentIndex);
  });

  // PiP
  $('fp-pip').addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch(e) { toast('PiP not supported'); }
  });

  // Fullscreen video
  $('fp-fullscreen').addEventListener('click', () => {
    try {
      const el = $('fp-video-view');
      if (document.fullscreenElement) document.exitFullscreen();
      else el.requestFullscreen().catch(() => toast('Fullscreen not supported'));
    } catch(e) {}
  });

  // Audio events
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('play',  () => { state.isPlaying = true;  updatePlayIcons(); });
  audio.addEventListener('pause', () => { state.isPlaying = false; updatePlayIcons(); });

  // Video events
  video.addEventListener('timeupdate', updateProgress);
  video.addEventListener('ended', onEnded);
  video.addEventListener('play',  () => { state.isPlaying = true;  updatePlayIcons(); });
  video.addEventListener('pause', () => { state.isPlaying = false; updatePlayIcons(); });

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

  // Video search
  const videoSearch = $('video-search');
  videoSearch.addEventListener('input', () => {
    const q = videoSearch.value.toLowerCase().trim();
    const grid = $('video-grid');
    grid.innerHTML = '';
    const videos = [...MEDIA.keys()].filter(i => {
      const m = MEDIA[i];
      return m.type === 'video' && (m.title.toLowerCase().includes(q) || m.artist.toLowerCase().includes(q));
    });
    videos.forEach(idx => grid.appendChild(buildVideoCard(idx)));
  });

  // Library filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      libFilter = btn.dataset.filter;
      renderLibrary();
    });
  });

  // Library sort
  $('lib-sort').addEventListener('change', e => {
    libSort = e.target.value;
    renderLibrary();
  });

  // Library view toggle
  $('grid-btn').addEventListener('click', () => {
    libView = 'grid';
    $('grid-btn').classList.add('active');
    $('list-btn').classList.remove('active');
    renderLibrary();
  });
  $('list-btn').addEventListener('click', () => {
    libView = 'list';
    $('list-btn').classList.add('active');
    $('grid-btn').classList.remove('active');
    renderLibrary();
  });

  // Audio page tabs
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
      case 'Space': e.preventDefault(); togglePlay(); break;
      case 'ArrowRight': { const el = currentMediaEl(); if(el) el.currentTime += 10; break; }
      case 'ArrowLeft':  { const el = currentMediaEl(); if(el) el.currentTime -= 10; break; }
      case 'ArrowUp':    state.volume = Math.min(1, state.volume + 0.1); if(currentMediaEl()) currentMediaEl().volume = state.volume; break;
      case 'ArrowDown':  state.volume = Math.max(0, state.volume - 0.1); if(currentMediaEl()) currentMediaEl().volume = state.volume; break;
      case 'KeyN':       playNext(); break;
      case 'KeyP':       playPrev(); break;
      case 'Escape':     closeFullPlayer(); break;
    }
  });

  // Swipe to close full player
  let touchStartY = 0;
  fullPlayer.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
  fullPlayer.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (dy > 80) closeFullPlayer();
  }, { passive: true });

  // Visibility change – save position
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.currentIndex >= 0) {
        const el = currentMediaEl();
        if (el && !isNaN(el.currentTime)) state.savedPositions[state.currentIndex] = el.currentTime;
        saveState();
      }
    }
  });
}

function onEnded() {
  if (state.repeat === 'one') {
    const el = currentMediaEl();
    if (el) { el.currentTime = 0; el.play().catch(()=>{}); }
  } else {
    playNext();
  }
}

/* ─────────────────────────────────────────
   INIT
   ───────────────────────────────────────── */
function init() {
  loadState();

  // Splash
  setTimeout(() => {
    $('splash').classList.add('fade-out');
    setTimeout(() => {
      $('splash').classList.add('hidden');
      $('app').classList.remove('hidden');
      wireEvents();
      renderSearchPage();
      renderHome();

      // Set volume
      audio.volume = state.volume;
      fpVol.value  = state.volume * 100;
    }, 500);
  }, 1200);

  // PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
