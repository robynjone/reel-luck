'use strict';
(() => {
  const movies = window.REEL_MOVIES || [];
  const $ = (id) => document.getElementById(id);
  const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The picker also works without browser storage. */ } };
  const validIds = new Set(movies.map(movie => movie.id));
  const state = {
    genre: 'all', runtime: 'all', era: 'all', noRepeat: true,
    history: Array.isArray(read('reel-luck-history', [])) ? read('reel-luck-history', []).filter(id => validIds.has(id)) : [],
    saved: new Set(Array.isArray(read('reel-luck-saved', [])) ? read('reel-luck-saved', []).filter(id => validIds.has(id)) : []),
    spins: Number(read('reel-luck-spins', 0)) || 0,
    slate: [], slateUsed: false, rotation: 0, spinning: false, selected: null, sound: false, collectionMode: 'all', detail: null,
  };
  const wheel = $('wheel');
  const ctx = wheel.getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let audioContext;
  let toastTimeout;
  const runtime = minutes => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
  const byId = id => movies.find(movie => movie.id === id);
  const random = length => {
    if (length < 1) return 0;
    const values = new Uint32Array(1);
    const ceiling = Math.floor(0x100000000 / length) * length;
    do { crypto.getRandomValues(values); } while (values[0] >= ceiling);
    return values[0] % length;
  };
  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
      const target = random(index + 1);
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy;
  }
  function filteredMovies() {
    return movies.filter(movie =>
      (state.genre === 'all' || movie.genres.includes(state.genre)) &&
      (state.runtime === 'all' || (state.runtime === 'long' ? movie.runtime >= 120 : movie.runtime < Number(state.runtime))) &&
      (state.era === 'all' || (state.era === 'classic' ? movie.year < 1980 : state.era === 'retro' ? movie.year >= 1980 && movie.year < 2000 : movie.year >= 2000))
    );
  }
  function eligibleMovies() {
    const alreadySpun = new Set(state.history);
    return filteredMovies().filter(movie => !state.noRepeat || !alreadySpun.has(movie.id));
  }
  function truncateTitle(title, width) {
    if (ctx.measureText(title).width <= width) return title;
    let result = title;
    while (result.length > 0 && ctx.measureText(result + '…').width > width) result = result.slice(0, -1);
    return result.trim() + '…';
  }
  function drawWheel() {
    const size = wheel.width;
    const center = size / 2;
    const radius = center - 4;
    ctx.clearRect(0, 0, size, size);
    const count = state.slate.length || 12;
    const step = Math.PI * 2 / count;
    const colors = ['#c2f0cc','#314941','#9bc2da','#283c45','#f2a76f','#3b493d','#c2f0cc','#35484d','#a7c5bf','#343f4b','#d4bd96','#2d443d'];
    for (let index = 0; index < count; index++) {
      const angle = -Math.PI / 2 + index * step;
      const colorIndex = Math.floor(index * 12 / count) % 12;
      ctx.beginPath(); ctx.moveTo(center, center); ctx.arc(center, center, radius, angle, angle + step); ctx.closePath();
      ctx.fillStyle = state.slate.length ? colors[colorIndex] : '#24363a'; ctx.fill();
      ctx.strokeStyle = '#111b24'; ctx.lineWidth = 4; ctx.stroke();
      if (state.slate[index]) {
        ctx.save(); ctx.translate(center, center); ctx.rotate(angle + step / 2);
        ctx.fillStyle = [0,2,4,6,8,10].includes(colorIndex) ? '#182e26' : '#dce7df';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.font = `600 ${count > 9 ? 28 : 31}px "DM Sans", Arial, sans-serif`;
        ctx.fillText(truncateTitle(state.slate[index].title, 334), radius - 54, 0);
        ctx.restore();
      }
    }
    ctx.beginPath(); ctx.arc(center, center, radius - 18, 0, Math.PI * 2); ctx.strokeStyle = '#111b2440'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(center, center, radius, 0, Math.PI * 2); ctx.strokeStyle = '#607366'; ctx.lineWidth = 4; ctx.stroke();
    wheel.setAttribute('aria-label', state.slate.length ? `Movie wheel: ${state.slate.map(movie => movie.title).join(', ')}.` : 'No films match your current mix.');
  }
  function updateCounts() {
    const eligible = eligibleMovies();
    const exhausted = eligible.length === 0 && filteredMovies().length > 0;
    $('eligible-count').textContent = eligible.length;
    $('total-count').textContent = movies.length;
    $('watchlist-count').textContent = state.saved.size;
    $('spin-number').textContent = String(state.spins + 1).padStart(3, '0');
    $('spin-button').disabled = state.spinning || !eligible.length;
    $('center-spin').disabled = state.spinning || !eligible.length;
    $('empty-wheel').hidden = !!state.slate.length;
    $('pool-empty').hidden = !!eligible.length;
    $('pool-empty-text').textContent = exhausted ? 'You’ve spun every film in this mix.' : 'No films match this mix.';
    $('pool-reset').textContent = exhausted ? 'Start fresh' : 'Reset filters';
    $('wheel-caption').textContent = eligible.length ? `${state.slate.length} film${state.slate.length === 1 ? '' : 's'} on the wheel. One very good decision.` : exhausted ? 'A fresh start brings every film back into the mix.' : 'Change your filters to find something great.';
    const last = byId(state.history[0]);
    $('last-spin-button').textContent = last ? `${last.title} · ${last.year}` : 'No plot twists yet.';
    $('last-spin-button').disabled = !last;
    $('clear-history').hidden = !state.history.length;
  }
  function buildSlate() {
    state.slate = shuffle(eligibleMovies()).slice(0, 12);
    state.slateUsed = false;
    state.rotation = 0;
    wheel.style.transform = 'rotate(0deg)';
    drawWheel(); updateCounts();
  }
  function setBusy(busy) {
    state.spinning = busy;
    $('wheel-stage').classList.toggle('spinning', busy);
    document.querySelectorAll('#mood-chips button, #runtime-select, #era-select, #no-repeat, #reset-filters, #clear-history').forEach(element => element.disabled = busy);
    $('spin-button').querySelector('span').textContent = busy ? 'Letting fate do its thing…' : 'Spin my next watch';
    updateCounts();
  }
  function tick() {
    if (!state.sound || !audioContext) return;
    try {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(760, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(320, audioContext.currentTime + .025);
      gain.gain.setValueAtTime(.025, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .035);
      oscillator.start(); oscillator.stop(audioContext.currentTime + .04);
    } catch { /* Sound is optional. */ }
  }
  async function spin() {
    if (state.spinning || !eligibleMovies().length) return;
    const eligibleIds = new Set(eligibleMovies().map(movie => movie.id));
    if (state.slateUsed || !state.slate.length || state.slate.some(movie => !eligibleIds.has(movie.id))) buildSlate();
    setBusy(true);
    if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
    const winnerIndex = random(state.slate.length);
    const winner = state.slate[winnerIndex];
    const step = 360 / state.slate.length;
    // Segment i is centered at -90 + (i + 0.5)*step. The pointer stays at -90.
    const landing = ((-(winnerIndex + .5) * step) % 360 + 360) % 360;
    const finish = 5 * 360 + landing;
    const duration = motion.matches ? 100 : 4600;
    const started = performance.now();
    let lastSegment = 0;
    $('spin-announcement').textContent = 'Spinning the movie wheel.';
    await new Promise(resolve => {
      const animate = now => {
        const progress = Math.min(1, Math.max(0, (now - started) / duration));
        const eased = 1 - Math.pow(1 - progress, 4);
        state.rotation = finish * eased;
        wheel.style.transform = `rotate(${state.rotation}deg)`;
        const currentSegment = Math.floor(state.rotation / step);
        if (currentSegment !== lastSegment) { tick(); lastSegment = currentSegment; }
        if (progress < 1) requestAnimationFrame(animate); else resolve();
      };
      requestAnimationFrame(animate);
    });
    state.selected = winner;
    state.slateUsed = true;
    state.history = [winner.id, ...state.history.filter(id => id !== winner.id)];
    state.spins++;
    write('reel-luck-history', state.history); write('reel-luck-spins', state.spins);
    renderResult(winner);
    setBusy(false);
    $('spin-announcement').textContent = `Your next watch is ${winner.title}, ${winner.year}, directed by ${winner.director}, ${runtime(winner.runtime)}.`;
    if (window.innerWidth <= 620) $('result-card').scrollIntoView({behavior: motion.matches ? 'instant' : 'smooth', block: 'center'});
  }
  function image(movie, lazy = true) {
    return `<img src="${escape(movie.poster)}" alt="${escape(movie.title)} poster" ${lazy ? 'loading="lazy"' : 'loading="eager"'} decoding="async" data-title="${escape(movie.title)}">`;
  }
  function actions(movie) {
    const saved = state.saved.has(movie.id);
    return `<div class="result-actions"><button class="save-button ${saved ? 'saved' : ''}" data-save="${escape(movie.id)}" aria-pressed="${saved}">${saved ? '✓ Saved' : '+ Watchlist'}</button><a class="letterboxd-link" href="${escape(movie.letterboxd)}" target="_blank" rel="noopener noreferrer">Letterboxd ↗</a></div>`;
  }
  function renderResult(movie) {
    $('result-placeholder').hidden = true; $('result-content').hidden = false;
    $('result-label').textContent = 'FATE HAS EXCELLENT TASTE';
    $('result-content').innerHTML = `<div class="result-movie">${image(movie, false)}<div><h2 id="result-title">${escape(movie.title)}</h2><p class="film-meta">${movie.year} <span aria-hidden="true">·</span> ${runtime(movie.runtime)} <span aria-hidden="true">·</span> ${escape(movie.director)}</p><p class="film-pitch">${escape(movie.pitch)}</p>${actions(movie)}</div></div>`;
    $('result-card').classList.remove('reveal');
    void $('result-card').offsetWidth;
    $('result-card').classList.add('revealed','reveal');
  }
  function filmCard(movie) {
    return `<button class="poster-card" data-film="${escape(movie.id)}" aria-label="View ${escape(movie.title)}, ${movie.year}"><span class="poster-wrap">${image(movie)}</span><span class="poster-title">${escape(movie.title)}</span><span class="poster-year">${movie.year}${state.saved.has(movie.id) ? ' · Saved ✓' : ''}</span></button>`;
  }
  function renderCollection() {
    const term = $('movie-search').value.trim().toLowerCase();
    const source = state.collectionMode === 'saved' ? movies.filter(movie => state.saved.has(movie.id)) : movies;
    const result = source.filter(movie => `${movie.title} ${movie.director} ${movie.year}`.toLowerCase().includes(term));
    $('movie-grid').innerHTML = result.map(filmCard).join('');
    $('dialog-count').textContent = `${result.length} film${result.length === 1 ? '' : 's'}`;
    $('dialog-empty').hidden = !!result.length;
    $('dialog-empty-title').textContent = term ? 'Nothing in this scene.' : 'Your watchlist is waiting.';
    $('dialog-empty-description').textContent = term ? 'Try another title, director, or year.' : 'Spin the wheel, then save the films that catch your eye.';
  }
  function openCollection(mode) {
    state.collectionMode = mode;
    $('dialog-title').textContent = mode === 'saved' ? 'Your watchlist.' : 'The collection.';
    $('dialog-eyebrow').textContent = mode === 'saved' ? 'GOOD FILMS, SAVED FOR LATER' : 'THE VERY GOOD FILM CLUB';
    $('movie-search').value = '';
    renderCollection(); $('collection-dialog').showModal();
  }
  function openFilm(movie) {
    if (!movie) return;
    state.detail = movie;
    $('film-detail-content').innerHTML = `<div class="film-detail">${image(movie, false)}<div><span class="film-genre">${escape(movie.genres.slice(0,3).join(' / '))}</span><h2 id="film-detail-title">${escape(movie.title)}</h2><p class="film-meta">${movie.year} · ${runtime(movie.runtime)}<br>Directed by ${escape(movie.director)}</p><p class="film-pitch">${escape(movie.pitch)}</p>${actions(movie)}</div></div>`;
    $('film-dialog').showModal();
  }
  function toast(message) {
    $('toast').textContent = message; $('toast').classList.add('show');
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('toast').classList.remove('show'), 2500);
  }
  function toggleSaved(id) {
    const movie = byId(id);
    if (!movie) return;
    if (state.saved.has(id)) { state.saved.delete(id); toast('Removed from your watchlist.'); }
    else { state.saved.add(id); toast(`${movie.title} saved for movie night.`); }
    write('reel-luck-saved', [...state.saved]);
    document.querySelectorAll('[data-save]').forEach(button => {
      const saved = state.saved.has(button.dataset.save);
      button.classList.toggle('saved', saved); button.setAttribute('aria-pressed', String(saved)); button.textContent = saved ? '✓ Saved' : '+ Watchlist';
    });
    updateCounts();
    if ($('collection-dialog').open) renderCollection();
  }
  function resetFilters() {
    if (state.spinning) return;
    state.genre = 'all'; state.runtime = 'all'; state.era = 'all';
    $('runtime-select').value = 'all'; $('era-select').value = 'all';
    document.querySelectorAll('[data-genre]').forEach(button => { button.classList.toggle('active', button.dataset.genre === 'all'); button.setAttribute('aria-pressed', String(button.dataset.genre === 'all')); });
    buildSlate();
  }
  function clearHistory() {
    if (state.spinning) return;
    state.history = []; write('reel-luck-history', []); buildSlate(); toast('A fresh reel. Every film is back in the mix.');
  }
  $('spin-button').addEventListener('click', spin); $('center-spin').addEventListener('click', spin);
  $('mood-chips').addEventListener('click', event => {
    const button = event.target.closest('[data-genre]');
    if (!button || state.spinning) return;
    state.genre = button.dataset.genre;
    document.querySelectorAll('[data-genre]').forEach(chip => { chip.classList.toggle('active', chip === button); chip.setAttribute('aria-pressed', String(chip === button)); });
    buildSlate();
  });
  $('runtime-select').addEventListener('change', event => { state.runtime = event.target.value; buildSlate(); });
  $('era-select').addEventListener('change', event => { state.era = event.target.value; buildSlate(); });
  $('no-repeat').addEventListener('change', event => { state.noRepeat = event.target.checked; buildSlate(); });
  $('reset-filters').addEventListener('click', resetFilters);
  $('pool-reset').addEventListener('click', () => filteredMovies().length ? clearHistory() : resetFilters());
  $('clear-history').addEventListener('click', clearHistory);
  $('browse-button').addEventListener('click', () => openCollection('all')); $('browse-bottom').addEventListener('click', () => openCollection('all'));
  $('watchlist-button').addEventListener('click', () => openCollection('saved'));
  $('movie-search').addEventListener('input', renderCollection);
  $('last-spin-button').addEventListener('click', () => openFilm(byId(state.history[0])));
  $('sound-button').addEventListener('click', () => {
    state.sound = !state.sound;
    if (state.sound && !audioContext) {
      try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); } catch { state.sound = false; toast('Audio is unavailable in this browser.'); }
    }
    $('sound-button').setAttribute('aria-pressed', String(state.sound));
    $('sound-button').setAttribute('aria-label', state.sound ? 'Mute spin sounds' : 'Enable spin sounds');
    $('sound-button').title = state.sound ? 'Mute spin sounds' : 'Enable spin sounds';
    $('sound-button').innerHTML = state.sound ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5zm5 3c3 2 3 6 0 8m3-11c5 4 5 10 0 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5zm5 4 5 6m0-6-5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  });
  document.addEventListener('click', event => {
    const close = event.target.closest('.close-dialog');
    if (close) close.closest('dialog').close();
    const save = event.target.closest('[data-save]');
    if (save) toggleSaved(save.dataset.save);
    const film = event.target.closest('[data-film]');
    if (film) openFilm(byId(film.dataset.film));
  });
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }));
  document.addEventListener('error', event => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement) || target.dataset.fallback) return;
    target.dataset.fallback = 'true';
    const title = escape(target.dataset.title || 'A very good film');
    target.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#263c35"/><circle cx="200" cy="230" r="100" fill="#c2f0cc" opacity=".13"/><text x="200" y="250" fill="#c2f0cc" font-family="Arial" font-size="72" text-anchor="middle">✳</text><foreignObject x="35" y="380" width="330" height="180"><div xmlns="http://www.w3.org/1999/xhtml" style="font:600 32px Arial;color:#f3f1e9;text-align:center;line-height:1.2">${title}</div></foreignObject></svg>`)}`;
  }, true);
  const featuredIds = ['parasite-2019','spirited-away','harakiri','12-angry-men','seven-samurai','high-and-low','the-godfather','the-shawshank-redemption'];
  const featured = featuredIds.map(byId).filter(Boolean);
  const shelf = [...featured, ...movies.filter(movie => !featuredIds.includes(movie.id))].slice(0, 8);
  $('poster-shelf').innerHTML = shelf.map(filmCard).join('');
  $('placeholder-posters').innerHTML = shelf.slice(0,3).map(movie => image(movie,false)).join('');
  buildSlate();
  if (document.fonts?.ready) document.fonts.ready.then(drawWheel).catch(() => {});
})();
