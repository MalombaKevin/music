// ================= Navigation =================
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  kwara: '<circle cx="8" cy="18" r="3"/><path d="M11 18V5l9-2v12"/><circle cx="17" cy="15" r="3"/>',
  dana: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
  discover: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
};
const NAV = [
  { href: 'index.html', label: 'Home', icon: 'home' },
  { href: 'kwara.html', label: 'Kwara', icon: 'kwara', img: 'images/kwara.jpg' },
  { href: 'dana.html', label: 'Dana', icon: 'dana', img: 'images/dana.jpg' },
  { href: 'discover.html', label: 'KWM', icon: 'discover', img: 'images/kevin.jpg', initials: 'KM' },
];

const page = location.pathname.split('/').pop() || 'index.html';
const svg = key =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg>`;

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
});

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
  if (!current) return;
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
if (location.protocol === 'file:' && (tracks.length || videoFrames.length)) {
  setTimeout(() => showToast('Open via a web server (e.g. Live Server) — YouTube blocks file:// pages'), 800);
}

// Load the YouTube IFrame API only where needed
if (tracks.length || videoFrames.length) {
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

// ================= Chat modal (KWM page) =================
const chatModal = document.querySelector('.chat-modal');
if (chatModal) {
  const GREETINGS = [
    'Hi there, I hope you are well 👋',   // English
    'Habari, natumaini uko salama 👋',    // Swahili
    'Misawa, ageno ni idhi maber 👋',     // Dholuo
    'Hi there, I hope you are well 👋',   // back to English (stays)
  ];
  const SLOT = 8000, TYPE = 3000, ERASE = 1000; // each greeting takes 8s
  const textEl = chatModal.querySelector('.bubble-text');
  const caret = chatModal.querySelector('.caret');
  const fab = document.querySelector('.chat-fab');
  let run = 0;

  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function typeGreetings(id) {
    for (let g = 0; g < GREETINGS.length; g++) {
      const chars = Array.from(GREETINGS[g]); // keeps the emoji intact
      for (let i = 1; i <= chars.length; i++) {
        if (id !== run) return;
        textEl.textContent = chars.slice(0, i).join('');
        await wait(TYPE / chars.length);
      }
      if (g === GREETINGS.length - 1) break; // final English greeting stays
      await wait(SLOT - TYPE - ERASE);
      for (let i = chars.length - 1; i >= 0; i--) {
        if (id !== run) return;
        textEl.textContent = chars.slice(0, i).join('');
        await wait(ERASE / chars.length);
      }
    }
    caret.hidden = true;
  }

  function openChat() {
    chatModal.hidden = false;
    requestAnimationFrame(() => chatModal.classList.add('open'));
    fab.classList.add('hide');
    chatModal.querySelector('.bubble-time').textContent =
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    textEl.textContent = '';
    caret.hidden = false;
    typeGreetings(++run);
    chatModal.querySelector('.chat-close').focus();
  }

  function closeChat() {
    run++; // stops the typing loop
    chatModal.classList.remove('open');
    fab.classList.remove('hide');
    setTimeout(() => { chatModal.hidden = true; }, 300);
    fab.focus();
  }

  document.querySelectorAll('[data-open-chat]').forEach(b => b.addEventListener('click', openChat));
  chatModal.querySelector('.chat-close').addEventListener('click', closeChat);
  chatModal.addEventListener('click', e => { if (e.target === chatModal) closeChat(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !chatModal.hidden) closeChat(); });
}
