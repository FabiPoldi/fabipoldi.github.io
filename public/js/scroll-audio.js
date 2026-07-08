// scroll-audio.js — Scroll-gesteuerter Ton für alle Wrapper-Videos der Startseite
// (Showreel + Teaser-Loops). Ein System für alles, erweiterbar auf beliebig viele
// Videos: jedes <video class="bg-video"> in einem .video-wrapper nimmt automatisch teil.
//
// Konzept:
//   - Erst stumm. Der erste Klick auf ein Video (oder aufs Showreel-GIF) schaltet den
//     Ton global frei ("Unlock") und fokussiert genau dieses Video.
//   - Danach steuert allein die Scroll-Position: Es ist immer höchstens EIN Video
//     hörbar — das präsenteste im Viewport. Beim Wegscrollen fadet es weich aus
//     (Reihenfolge der Kette: Lautstärke → Tiefpass → Reverb ganz am Ende), beim
//     Erreichen des nächsten fadet dieses weich ein. Schnelles Scrollen ⇒ schnellere,
//     langsames ⇒ gemütlichere Übergänge (adaptiv). Kleine Scroll-Bewegungen um ein
//     Video herum lassen den Ton stehen (Toleranzzone + Hysterese).
//   - Reverb kommt NUR im letzten Drittel des Ausfadens dazu und lässt den Schluss
//     natürlich ausklingen (der Hall-Schwanz läuft nach dem Cut aus) — beim Einfaden
//     gibt es keinen Reverb.
//   - Garantiert still: Unter der Hörschwelle wird das Element zusätzlich hart
//     gemutet — nichts "läuft im Hintergrund weiter".
//   - Klick auf ein Video, während Ton läuft: globaler Mute (X-Badges). Erneuter
//     Klick: Ton wieder an.
//   - Vimeo-Player und Loops blockieren sich gegenseitig (Duck/Pause).
(function () {
  'use strict';

  var wrappers = Array.prototype.slice.call(document.querySelectorAll('.video-wrapper'));
  var tracks = [];
  wrappers.forEach(function (w) {
    var v = w.querySelector('video.bg-video');
    if (v) tracks.push({ video: v, wrapper: w });
  });
  if (!tracks.length) return;

  // ------------------------------------------------------------------
  // Tuning — nach Gehör justieren
  // ------------------------------------------------------------------
  var FULL_VIS = 0.62;         // ab diesem sichtbaren Anteil: volle Lautstärke
  var GONE_VIS = 0.14;         // darunter: Ziel-Lautstärke 0
  var ELIGIBLE_VIS = 0.25;     // Mindest-Sichtbarkeit, um Fokus zu bekommen
  var FOCUS_MARGIN = 0.12;     // Hysterese: so viel besser muss ein Herausforderer sein
  var FOCUS_HOLD_MS = 180;     // ... und zwar so lange am Stück
  var TAU_UP = 0.55;           // Einfade-Trägheit (s)
  var TAU_DOWN_SLOW = 1.30;    // Ausfade-Trägheit bei langsamem Scrollen (s)
  var TAU_DOWN_FAST = 0.42;    // ... bei schnellem Scrollen (s)
  var VEL_FAST = 2600;         // px/s, ab der "schnell" voll erreicht ist
  var GAIN_CURVE = 1.7;        // Lautstärke-Kurve (equal-power-artig)
  var FILTER_MAX_HZ = 18000;
  var FILTER_MIN_HZ = 560;
  var FILTER_KNEE = 0.8;       // Filter arbeitet erst unterhalb dieses Pegels
  var REVERB_START = 0.5;      // Reverb-Send aktiv unterhalb dieses Pegels (nur beim Ausfaden)
  var WET_MAX = 0.24;          // maximaler Hall-Anteil — dezent
  var REVERB_IR_SEC = 2.4;     // Länge des Hall-Schwanzes
  var REVERB_IR_DECAY = 2.6;
  var RAMP = 0.09;             // setTargetAtTime-Zeitkonstante (Anti-Klick)
  var SILENCE_LEVEL = 0.015;   // darunter gilt ein Track als "aus"
  var HARD_MUTE_MS = 400;      // nach so viel Stille wird das Element hart gemutet
  var MUTE_FADE_SEC = 0.35;    // globaler Ton-an/aus-Fade
  var DUCK_SEC = 0.3;          // Duck, wenn Vimeo spielt
  var CLICK_FOCUS_MS = 1400;   // nach Klick gewinnt das geklickte Video den Fokus
  var PLAY_MARGIN = '420px';   // Videos starten/pausieren mit diesem Vorlauf
  var NAV_FADE_MS = 220;       // Fade-out vor internem Seitenwechsel

  var ctx = null, master = null, reverb = null;
  var ready = false;           // AudioContext + Graphen gebaut
  var soundOn = false;
  var focusIndex = -1;
  var challenger = { index: -1, since: 0 };
  var clickFocusUntil = 0, clickFocusIndex = -1;
  var duckLevel = 1, duckTarget = 1;
  var muteLevel = 0, muteTarget = 0;
  var lastScrollY = window.scrollY, lastVelTime = performance.now(), scrollVel = 0;
  var lastTick = performance.now();
  var badgeTimer = null;

  function clamp01(t) { return Math.max(0, Math.min(1, t)); }
  function smoothstep(t) { t = clamp01(t); return t * t * (3 - 2 * t); }

  function buildImpulse(context) {
    var rate = context.sampleRate;
    var pre = Math.floor(rate * 0.07); // 70 ms PreDelay
    var len = Math.max(1, Math.floor(rate * REVERB_IR_SEC)) + pre;
    var buf = context.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      for (var i = pre; i < len; i++) {
        var t = (i - pre) / (len - pre);
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, REVERB_IR_DECAY);
      }
    }
    return buf;
  }

  function ensureAudio() {
    if (ready) return true;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try { ctx = new Ctx({ latencyHint: 'playback' }); } catch (err) { ctx = new Ctx(); }

    // Master-Bus: globaler Fade + sanfter Limiter gegen Übersteuern bei Crossfades
    master = ctx.createGain();
    master.gain.value = 0;
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    master.connect(limiter);
    limiter.connect(ctx.destination);

    // Gemeinsamer Hall (ein Convolver für alle Tracks); Return wird
    // per Hochpass (kein Wummern) und Tiefpass (kein Zischeln) gezähmt
    reverb = ctx.createConvolver();
    reverb.buffer = buildImpulse(ctx);
    var reverbHP = ctx.createBiquadFilter();
    reverbHP.type = 'highpass';
    reverbHP.frequency.value = 90;
    var reverbLP = ctx.createBiquadFilter();
    reverbLP.type = 'lowpass';
    reverbLP.frequency.value = 9000;
    var reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 1;
    reverb.connect(reverbHP);
    reverbHP.connect(reverbLP);
    reverbLP.connect(reverbReturn);
    reverbReturn.connect(master);

    // Pro Track: Quelle → Lautstärke → Tiefpass → (trocken an Master)
    //                                        └→ Reverb-Send → Convolver (ganz hinten)
    tracks.forEach(function (t) {
      var source;
      try { source = ctx.createMediaElementSource(t.video); }
      catch (err) { t.dead = true; return; }
      t.vol = ctx.createGain();
      t.vol.gain.value = 0;
      t.filter = ctx.createBiquadFilter();
      t.filter.type = 'lowpass';
      t.filter.frequency.value = FILTER_MAX_HZ;
      t.filter.Q.value = 0;
      t.send = ctx.createGain();
      t.send.gain.value = 0;
      source.connect(t.vol);
      t.vol.connect(t.filter);
      t.filter.connect(master);
      t.filter.connect(t.send);
      t.send.connect(reverb);
      t.level = 0;             // geglätteter Pegel 0..1
      t.silentSince = 0;
      t.video.muted = true;    // Gate: WebAudio übernimmt erst, wenn hörbar
      t.video.volume = 1;
      t.wrapper.classList.add('fp-audio-ready');
    });
    tracks = tracks.filter(function (t) { return !t.dead; });

    // Convolver "vorwärmen": unhörbarer Impuls, damit der erste echte
    // Hall-Einsatz nicht knackt (TapeWriter-Trick)
    try {
      var osc = ctx.createOscillator();
      var warmGain = ctx.createGain();
      warmGain.gain.value = 0.00004;
      osc.connect(warmGain);
      warmGain.connect(reverb);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch (err) {}

    ready = true;
    return true;
  }

  // ------------------------------------------------------------------
  // Sichtbarkeit & Fokus
  // ------------------------------------------------------------------
  function visibleFraction(t) {
    var r = t.wrapper.getBoundingClientRect();
    if (!r.height) return 0;
    var vh = window.innerHeight || 1;
    var visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    return clamp01(visible / Math.min(r.height, vh));
  }

  function levelTargetFor(vis) {
    return smoothstep((vis - GONE_VIS) / (FULL_VIS - GONE_VIS));
  }

  function pickFocus(now, presences) {
    // Klick-Wunsch hat Vorrang
    if (now < clickFocusUntil && clickFocusIndex >= 0 && presences[clickFocusIndex] > 0.05) {
      challenger.index = -1;
      return clickFocusIndex;
    }
    var best = -1, bestP = 0;
    presences.forEach(function (p, i) {
      if (p >= ELIGIBLE_VIS && p > bestP) { bestP = p; best = i; }
    });
    if (focusIndex === -1) { challenger.index = -1; return best; }
    var currentP = presences[focusIndex] || 0;
    if (currentP < ELIGIBLE_VIS * 0.6) { challenger.index = -1; return best; } // Fokus verloren
    if (best !== focusIndex && bestP > currentP + FOCUS_MARGIN) {
      if (challenger.index !== best) { challenger.index = best; challenger.since = now; }
      if (now - challenger.since >= FOCUS_HOLD_MS) { challenger.index = -1; return best; }
    } else {
      challenger.index = -1;
    }
    return focusIndex;
  }

  // ------------------------------------------------------------------
  // Haupt-Loop
  // ------------------------------------------------------------------
  function tick() {
    requestAnimationFrame(tick);
    if (!ready) return;
    var now = performance.now();
    var dt = Math.min(0.1, (now - lastTick) / 1000) || 0.016;
    lastTick = now;

    // Scroll-Geschwindigkeit (geglättet) für adaptive Fades
    var y = window.scrollY;
    var dtv = Math.max(1, now - lastVelTime);
    var instVel = Math.abs(y - lastScrollY) / (dtv / 1000);
    scrollVel += (instVel - scrollVel) * (1 - Math.exp(-dt / 0.15));
    lastScrollY = y; lastVelTime = now;

    // globale Multiplikatoren
    duckLevel += (duckTarget - duckLevel) * (1 - Math.exp(-dt / DUCK_SEC));
    muteTarget = soundOn ? 1 : 0;
    muteLevel += (muteTarget - muteLevel) * (1 - Math.exp(-dt / MUTE_FADE_SEC));
    if (master) master.gain.setTargetAtTime(duckLevel * muteLevel, ctx.currentTime, RAMP);

    var presences = tracks.map(visibleFraction);
    focusIndex = pickFocus(now, presences);

    var speed = clamp01(scrollVel / VEL_FAST);
    var tauDown = TAU_DOWN_SLOW + (TAU_DOWN_FAST - TAU_DOWN_SLOW) * speed;

    tracks.forEach(function (t, i) {
      var target = (i === focusIndex) ? levelTargetFor(presences[i]) : 0;
      var fadingOut = target < t.level - 0.002;
      var tau = fadingOut ? tauDown : TAU_UP;
      if (fadingOut) {
        // Gemütliches Ausfaden gilt nur, solange das Video noch (teilweise)
        // sichtbar und fokussiert ist. Fokus verloren oder ganz aus dem Bild:
        // zügig weg. Und der letzte Rest wird immer beschleunigt beendet,
        // damit ein Song wirklich verschwindet statt ewig auszulaufen.
        if (i !== focusIndex) tau = Math.min(tau, 0.55);
        if (presences[i] <= 0.02) tau = Math.min(tau, 0.32);
        if (t.level < 0.06) tau = Math.min(tau, 0.22);
      }
      var prev = t.level;
      t.level += (target - t.level) * (1 - Math.exp(-dt / tau));

      // --- Hart-Stille-Garantie ---
      if (t.level < SILENCE_LEVEL && target <= 0) {
        t.level = Math.min(t.level, SILENCE_LEVEL);
        if (!t.silentSince) t.silentSince = now;
        if (now - t.silentSince > HARD_MUTE_MS && !t.video.muted) t.video.muted = true;
      } else {
        t.silentSince = 0;
        if (soundOn && t.video.muted && (target > 0 || t.level > SILENCE_LEVEL)) t.video.muted = false;
      }

      var audible = t.video.muted ? 0 : 1;
      var L = t.level * audible;

      // Lautstärke (Kette: zuerst!)
      var gainVal = Math.pow(clamp01(L), GAIN_CURVE);
      if (L <= SILENCE_LEVEL) gainVal = 0;
      if (Math.abs(gainVal - (t.lastGain || 0)) > 0.0008 || (gainVal === 0 && t.lastGain !== 0)) {
        t.vol.gain.setTargetAtTime(gainVal, ctx.currentTime, RAMP);
        t.lastGain = gainVal;
      }

      // Tiefpass: bleibt offen bis FILTER_KNEE, schließt dann mit Potenzkurve
      var f = clamp01(L / FILTER_KNEE);
      var cutoff = FILTER_MIN_HZ + (FILTER_MAX_HZ - FILTER_MIN_HZ) * Math.pow(f, 2.2);
      if (Math.abs(cutoff - (t.lastCutoff || 0)) > 25) {
        t.filter.frequency.setTargetAtTime(cutoff, ctx.currentTime, RAMP + 0.03);
        t.lastCutoff = cutoff;
      }

      // Reverb: NUR beim Ausfaden, erst unterhalb REVERB_START, Maximum kurz vor Schluss.
      // Der Send sitzt hinter Lautstärke+Filter — stirbt der Pegel, klingt nur noch der
      // Hall-Schwanz natürlich aus (kein stehender Hall).
      var wet = 0;
      if (fadingOut && L < REVERB_START && L > 0.01) {
        wet = WET_MAX * smoothstep((REVERB_START - L) / (REVERB_START - 0.06));
      }
      if (t.lastWet == null) t.lastWet = 0;
      var wetTau = wet > t.lastWet ? 0.22 : 0.55;
      t.lastWet += (wet - t.lastWet) * (1 - Math.exp(-dt / wetTau));
      if (Math.abs(t.lastWet - (t.lastWetWritten || 0)) > 0.004) {
        t.send.gain.setTargetAtTime(t.lastWet, ctx.currentTime, RAMP);
        t.lastWetWritten = t.lastWet;
      }
      if (t.lastWet > (t.peakWet || 0)) t.peakWet = t.lastWet;

      void prev;
    });
  }

  // ------------------------------------------------------------------
  // Bedienung: Klick = Unlock/Fokus bzw. globaler Mute-Toggle
  // ------------------------------------------------------------------
  function flashBadge(wrapper) {
    if (!wrapper) return;
    wrapper.classList.add('fp-badge-show');
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(function () { wrapper.classList.remove('fp-badge-show'); }, 1600);
  }

  function applyUI() {
    tracks.forEach(function (t) {
      t.wrapper.classList.toggle('fp-unmuted', soundOn);
      t.wrapper.classList.add('fp-played');
    });
  }

  function pauseVimeos() {
    Array.prototype.slice.call(document.querySelectorAll('iframe')).forEach(function (f) {
      if ((f.src || '').indexOf('player.vimeo.com') < 0) return;
      try { f.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*'); } catch (err) {}
    });
  }

  function enableSound(trackIndex) {
    if (!ensureAudio()) return;
    ctx.resume();
    soundOn = true;
    duckTarget = 1;
    pauseVimeos();
    if (trackIndex >= 0) {
      clickFocusIndex = trackIndex;
      clickFocusUntil = performance.now() + CLICK_FOCUS_MS;
      focusIndex = trackIndex;
      flashBadge(tracks[trackIndex].wrapper);
    }
    applyUI();
  }

  function disableSound() {
    soundOn = false;
    applyUI();
  }

  tracks.forEach(function (t, i) {
    t.wrapper.addEventListener('click', function () {
      if (!soundOn) enableSound(i);
      else disableSound();
    });
  });

  // API für site.js: Showreel-Thumbnail-Klick enthüllt das Hero-Video
  // und startet es direkt mit Ton (gleiche Geste = Autoplay erlaubt).
  window.fpAudio = {
    reveal: function (video) {
      var idx = tracks.findIndex(function (t) { return t.video === video; });
      video.play().catch(function () {});
      enableSound(idx);
    },
    muteAll: disableSound,
  };

  // ------------------------------------------------------------------
  // Wiedergabe-Management: Loops laufen nur in Viewport-Nähe (Performance);
  // das jeweils hörbare Video wird nie pausiert.
  // ------------------------------------------------------------------
  function setupPlayback() {
    if (!('IntersectionObserver' in window)) {
      tracks.forEach(function (t) { t.video.play().catch(function () {}); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var t = tracks.find(function (x) { return x.video === entry.target; });
        if (!t) return;
        if (entry.isIntersecting) {
          t.video.play().catch(function () {});
        } else if (!t.level || t.level < 0.05) {
          if (!t.video.paused && t.video.autoplay !== true) t.video.pause();
        }
      });
    }, { rootMargin: PLAY_MARGIN + ' 0px' });
    tracks.forEach(function (t) { io.observe(t.video); });
  }

  // ------------------------------------------------------------------
  // Vimeo: spielt ein Player, ducken die Loops; pausiert er, kommen sie wieder
  // ------------------------------------------------------------------
  window.addEventListener('message', function (e) {
    if (typeof e.data !== 'string' || String(e.origin).indexOf('vimeo.com') < 0) return;
    var d;
    try { d = JSON.parse(e.data); } catch (err) { return; }
    if (d.event === 'ready' && e.source) {
      try {
        e.source.postMessage(JSON.stringify({ method: 'addEventListener', value: 'play' }), '*');
        e.source.postMessage(JSON.stringify({ method: 'addEventListener', value: 'pause' }), '*');
      } catch (err) {}
    }
    if (d.event === 'play') duckTarget = 0;
    if (d.event === 'pause') duckTarget = 1;
  });

  // ------------------------------------------------------------------
  // Weicher Fade-out vor internen Seitenwechseln
  // ------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    if (!ready || !soundOn || muteLevel < 0.05) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;
    if (link.target && link.target !== '' && link.target !== '_self') return;
    var url;
    try { url = new URL(link.href, window.location.href); } catch (err) { return; }
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
    e.preventDefault();
    master.gain.setTargetAtTime(0, ctx.currentTime, NAV_FADE_MS / 1000 / 3);
    setTimeout(function () { window.location.href = link.href; }, NAV_FADE_MS);
  }, true);

  setupPlayback();
  requestAnimationFrame(tick);

  // Debug fürs Ohr-Tuning: __fpScrollAudio() in der Konsole
  window.__fpScrollAudio = function () {
    return {
      soundOn: soundOn,
      focus: focusIndex,
      vel: Math.round(scrollVel),
      duck: Math.round(duckLevel * 100) / 100,
      tracks: tracks.map(function (t, i) {
        return {
          i: i,
          vis: Math.round(visibleFraction(t) * 100) / 100,
          level: Math.round((t.level || 0) * 1000) / 1000,
          gain: t.vol ? Math.round(t.vol.gain.value * 1000) / 1000 : null,
          cutoff: t.filter ? Math.round(t.filter.frequency.value) : null,
          wet: Math.round((t.lastWet || 0) * 100) / 100,
          peakWet: Math.round((t.peakWet || 0) * 100) / 100,
          muted: t.video.muted,
          paused: t.video.paused,
        };
      }),
    };
  };
})();
