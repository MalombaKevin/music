// ================= Laptop / desktop block =================
// Same rule as the CSS: a mouse/trackpad as the main pointer means laptop or desktop.
const deviceBlocked = matchMedia('(hover: hover) and (pointer: fine)').matches;
const deviceUrl = document.querySelector('.device-url');
if (deviceUrl) deviceUrl.textContent = location.host;

// ================= Navigation =================
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  kwara: '<circle cx="8" cy="18" r="3"/><path d="M11 18V5l9-2v12"/><circle cx="17" cy="15" r="3"/>',
  dana: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
  // radio broadcast: centre dot + signal waves that pulse outwards (animated in CSS)
  vibe: '<circle class="sig-dot" cx="12" cy="12" r="2" fill="currentColor"/>' +
        '<path class="sig sig-1" d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/>' +
        '<path class="sig sig-2" d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
};
const NAV = [
  { href: 'index.html', label: 'Home', icon: 'home' },
  { href: 'kwara.html', label: 'Kwara', icon: 'kwara', img: 'images/kwara.png' },
  { href: 'dana.html', label: 'Dana', icon: 'dana', img: 'images/dana.png' },
  { href: 'discover.html', label: 'Vibe', icon: 'vibe' },
];

// Works with and without ".html" in the URL (vercel.json has cleanUrls on)
let page = location.pathname.split('/').pop() || 'index.html';
if (!page.endsWith('.html')) page += '.html';
const svg = key =>
  `<svg class="ico-${key}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg>`;

// Artist items get a circular image (falls back to the initial if the image is missing)
const avatar = n =>
  `<span class="nav-av"><b>${n.initials || n.label[0]}</b><img src="${n.img}" alt="" onerror="this.remove()"></span>`;

// PC: top-right nav inside header
const topNav = document.querySelector('.header .nav');
if (topNav) {
  topNav.innerHTML = NAV.map(n =>
    `<a href="${n.href}" class="${n.href === page ? 'active' : ''}">${n.img ? avatar(n) : svg(n.icon)}<span>${n.label}</span></a>`
  ).join('');
}

// Tablet & mobile: floating bottom nav attached directly to <body> (so position:fixed is relative to the viewport)
const bottomNav = document.createElement('nav');
bottomNav.className = 'bottom-nav';
bottomNav.setAttribute('aria-label', 'Main');
bottomNav.innerHTML = NAV.map(n =>
  `<a href="${n.href}" class="${n.href === page ? 'active' : ''}">${n.img ? avatar(n) : svg(n.icon)}<span>${n.label}</span></a>`
).join('');
document.body.appendChild(bottomNav);

// ================= Toast =================
const toast = document.createElement('div');
toast.className = 'toast';
document.body.appendChild(toast);
let toastT;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => toast.classList.remove('show'), 2600);
}

// ================= Audio / Video toggle =================
const toggle = document.querySelector('.toggle');
if (toggle) {
  toggle.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tab = btn.dataset.tab;
    toggle.dataset.tab = tab;
    const btns = [...toggle.querySelectorAll('button')];
    toggle.style.setProperty('--i', btns.indexOf(btn));
    btns.forEach(b => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('show', p.id === tab));
  });
}

// ================= YouTube media (only one plays at a time) =================
const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';

const players = [];          // every YT player on the page (videos + the hidden audio player)
const tracks = [...document.querySelectorAll('.track')];
const videoFrames = [...document.querySelectorAll('iframe.yt-video')];
let audioPlayer = null;
let audioReady = false;
let current = null;
let tick = null;

const fmt = s => (isFinite(s) && s > 0) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00';

function pauseOthers(active) {
  players.forEach(p => {
    if (p === active) return;
    try { if (p.getPlayerState() === 1) p.pauseVideo(); } catch (_) { /* not ready yet */ }
  });
}

// Audio tracks: YouTube thumbnail as cover art + play button
tracks.forEach(track => {
  const btn = track.querySelector('.play');
  btn.style.backgroundImage = `url(https://i.ytimg.com/vi/${track.dataset.yt}/mqdefault.jpg)`;
  btn.innerHTML = ICON_PLAY;
  btn.addEventListener('click', () => playTrack(track));
  track.querySelector('h4').title = track.querySelector('h4').textContent; // full name on hover
  initSeek(track);
});

// Progress bar: seeking only works on the song started with its play button,
// so scrolling past the other songs can never move their bars by accident
let dragging = false;

function initSeek(track) {
  const bar = track.querySelector('.progress');
  bar.setAttribute('role', 'slider');
  bar.setAttribute('aria-label', 'Seek');
  bar.tabIndex = 0;
  const ratioAt = e => {
    const r = bar.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  const preview = ratio => { bar.querySelector('i').style.width = ratio * 100 + '%'; };
  const stop = () => { dragging = false; bar.classList.remove('dragging'); };

  bar.addEventListener('pointerdown', e => {
    if (current !== track) return; // not the active song → ignore
    dragging = true;
    bar.classList.add('dragging');
    bar.setPointerCapture(e.pointerId);
    preview(ratioAt(e));
  });
  bar.addEventListener('pointermove', e => { if (dragging) preview(ratioAt(e)); });
  bar.addEventListener('pointerup', e => {
    if (!dragging) return;
    stop();
    seekTo(ratioAt(e));
  });
  // a vertical swipe that turns into a page scroll cancels the seek
  bar.addEventListener('pointercancel', () => { stop(); updateProgress(); });

  bar.addEventListener('keydown', e => {
    if (current !== track || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    audioPlayer.seekTo(audioPlayer.getCurrentTime() + (e.key === 'ArrowRight' ? 5 : -5), true);
    updateProgress();
  });
}

function seekTo(ratio) {
  const d = audioPlayer.getDuration();
  if (d) audioPlayer.seekTo(ratio * d, true);
  updateProgress();
}

function playTrack(track) {
  if (!audioReady) return showToast('Player is loading…');
  if (current === track) {
    audioPlayer.getPlayerState() === 1 ? audioPlayer.pauseVideo() : audioPlayer.playVideo();
    return;
  }
  if (current) resetTrack(current);
  current = track;
  current.classList.add('playing');
  audioPlayer.loadVideoById(track.dataset.yt);
}

function resetTrack(track) {
  track.classList.remove('playing');
  track.querySelector('.play').innerHTML = ICON_PLAY;
  track.querySelector('.progress i').style.width = '0';
  track.querySelector('.time').textContent = '0:00';
}

function updateProgress() {
  if (!current || dragging) return;
  const t = audioPlayer.getCurrentTime();
  const d = audioPlayer.getDuration();
  current.querySelector('.progress i').style.width = d ? (t / d) * 100 + '%' : '0';
  current.querySelector('.time').textContent = `${fmt(t)} / ${fmt(d)}`;
}

function onAudioState(e) {
  if (!current) return;
  const btn = current.querySelector('.play');
  switch (e.data) {
    case 1: // playing
      pauseOthers(audioPlayer);
      btn.innerHTML = ICON_PAUSE;
      clearInterval(tick);
      tick = setInterval(updateProgress, 500);
      break;
    case 2: // paused
      btn.innerHTML = ICON_PLAY;
      clearInterval(tick);
      break;
    case 0: { // ended → next track
      clearInterval(tick);
      const next = current.nextElementSibling;
      resetTrack(current);
      current = null;
      if (next) playTrack(next);
      break;
    }
  }
}

// YouTube refuses to play embeds on pages opened as file:// (no Referer → "Error 153 / Watch on YouTube")
if (location.protocol === 'file:' && !deviceBlocked && (tracks.length || videoFrames.length)) {
  setTimeout(() => showToast('Open via a web server (e.g. Live Server) — YouTube blocks file:// pages'), 800);
}

// Load the YouTube IFrame API only where needed
if ((tracks.length || videoFrames.length) && !deviceBlocked) { // no player on blocked devices
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(s);
}

window.onYouTubeIframeAPIReady = () => {
  // Visible videos
  videoFrames.forEach(frame => {
    const p = new YT.Player(frame, {
      events: { onStateChange: e => { if (e.data === 1) pauseOthers(p); } },
    });
    players.push(p);
  });

  // Hidden player that turns YouTube videos into audio
  if (tracks.length) {
    const host = document.createElement('div');
    host.className = 'yt-hidden';
    host.innerHTML = '<div id="yt-audio"></div>';
    document.body.appendChild(host);

    audioPlayer = new YT.Player('yt-audio', {
      width: 200, height: 200,
      host: 'https://www.youtube-nocookie.com',
      playerVars: { controls: 0, playsinline: 1, rel: 0 },
      events: {
        onReady: () => { audioReady = true; },
        onStateChange: onAudioState,
        onError: () => {
          showToast('This track can’t be played');
          if (current) { resetTrack(current); current = null; }
        },
      },
    });
    players.push(audioPlayer);
  }
};

// ================= Full View (home video) =================
// The video box (player + our Minimize button) goes fullscreen, so the button can sit on top of the video.
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;

document.querySelectorAll('[data-fullview]').forEach(btn => {
  const frame = document.getElementById(btn.dataset.fullview);
  const box = frame.parentElement;
  const minBtn = box.querySelector('.vc-min');
  let hideT;

  btn.addEventListener('click', () => {
    const player = players.find(p => p.getIframe && p.getIframe() === frame);
    try { player.playVideo(); } catch (_) { /* player not ready yet */ }
    const enter = box.requestFullscreen || box.webkitRequestFullscreen;
    if (enter) {
      Promise.resolve(enter.call(box))
        .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
        .catch(() => {});
    } else {
      // iPhone Safari has no fullscreen for page elements → open the video on YouTube instead
      const id = frame.src.split('/embed/')[1].split('?')[0];
      window.open(`https://www.youtube.com/watch?v=${id}`, '_blank');
    }
  });

  if (!minBtn) return;
  const showMin = () => {
    if (fsElement() !== box) return;
    minBtn.classList.add('show');
    clearTimeout(hideT);
    hideT = setTimeout(() => minBtn.classList.remove('show'), 3000); // no taps for 3s → hide
  };

  // Taps inside the YouTube player can't be read directly; a tap moves focus into the player,
  // which blurs this page. Catch that, then hand focus back so the next tap is caught too.
  window.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement !== frame) return;
      showMin();
      frame.blur();
      window.focus();
    }, 0);
  });

  minBtn.addEventListener('click', () => {
    if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  });
  const onFsChange = () => { if (fsElement() !== box) { clearTimeout(hideT); minBtn.classList.remove('show'); } };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
});

// ================= View-source deterrent =================
// Blocks right-click and the common "view source / dev tools / save page" shortcuts.
// Note: this only deters casual visitors — browsers always let a determined user read the page code.
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  const k = e.code.replace('Key', '').toLowerCase(); // physical key, so Mac's Option doesn't change it
  const ctrl = e.ctrlKey || e.metaKey;
  const blocked =
    e.key === 'F12' ||
    (ctrl && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k)) || // dev tools (Windows/Linux)
    (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(k)) || // dev tools / source (Mac)
    (ctrl && !e.shiftKey && ['u', 's'].includes(k));             // view source, save page
  if (blocked) { e.preventDefault(); e.stopPropagation(); }
}, true);
