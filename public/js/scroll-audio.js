// scroll-audio.js — Scroll-gesteuerte Lautstaerke/Filter/Reverb fuer die Loop-Videos
// unter den Poster+Stills-Grids (Say Wuff, Milky Chance, Luz, ...). Ersetzt fuer genau
// diese Videos das Klick-Mute/Unmute-System aus site.js: der Ton ist automatisch da,
// gesteuert allein durch die Scroll-Position. Ein einziger erster Klick/Tap/Tastendruck
// irgendwo auf der Seite schaltet den AudioContext frei (Browser-Autoplay-Policy laesst
// sich nicht umgehen) - danach uebernimmt ausschliesslich das Scrollen.
//
// Kurvenform + Signalkette sind an TapeWriters "Far Away"-Preset angelehnt (Potenzkurven
// fuer Filter-Sweeps, Lowpass+Reverb-Send als "Distanz"-Eindruck) - eigenstaendig neu
// geschrieben, ohne jede Code-/Architektur-Uebernahme (kein Store, keine Keyframes).
(function () {
  'use strict';

  var TEASER_SELECTOR = '.code-embed.w-embed:not(.show-reel) video.bg-video';
  var teaserVideos = Array.prototype.slice.call(document.querySelectorAll(TEASER_SELECTOR));
  if (!teaserVideos.length) return;

  // ---------------------------------------------------------------------
  // Tuning-Konstanten - nach Gehoer feinjustieren. Bewusst zurueckhaltend
  // gewaehlt: der Effekt soll kaum auffallen, nur "aufgeraeumt smooth" wirken.
  // ---------------------------------------------------------------------
  var CENTER_ZONE = 0.20;        // +/-20% der Viewport-Hoehe um die Mitte: trocken, voll
  var MIN_CUTOFF_HZ = 500;       // Tiefpass-Grenzfrequenz ganz am Rand des Sichtfelds
  var MAX_CUTOFF_HZ = 21000;     // praktisch "kein Filter" in der Center-Zone
  var MIN_VOLUME_DB = -16;       // leiseste Lautstaerke ganz am Rand des Sichtfelds
  var MAX_REVERB_MIX = 0.22;     // Hall-Anteil ganz am Rand des Sichtfelds (dezent!)
  var PARAM_RAMP_SEC = 0.12;     // AudioParam setTargetAtTime Zeitkonstante (Declick)
  var SMOOTH_HALFLIFE_MS = 180;  // Traegheit der Positions-Nachfuehrung (Zipper-Schutz)
  var DUCK_OUT_SEC = 0.35;       // Ausblenden, wenn Showreel/Vimeo Ton bekommt
  var DUCK_IN_SEC = 0.7;         // Wiedereinblenden danach (etwas sanfter)
  var NAV_FADE_MS = 220;         // Fade-out-Dauer vor internem Seitenwechsel

  var ctx = null;
  var unlocked = false;
  var nodes = []; // { video, wrapper, filter, gain, reverbSend, smoothedT }
  var sharedReverb = null;
  var duckTarget = 1; // 1 = normal, 0 = geduckt (anderes Video/Vimeo spielt mit Ton)
  var duckLevel = 1;
  var rafId = null;

  function buildImpulseResponse(context, seconds, decay) {
    var rate = context.sampleRate;
    var length = Math.max(1, Math.floor(rate * seconds));
    var impulse = context.createBuffer(2, length, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = impulse.getChannelData(ch);
      for (var i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  function smootherstep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function dbToGain(db) { return Math.pow(10, db / 20); }

  function ensureContext() {
    if (ctx) return ctx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    sharedReverb = { convolver: ctx.createConvolver(), returnGain: ctx.createGain() };
    sharedReverb.convolver.buffer = buildImpulseResponse(ctx, 2.4, 3.4);
    sharedReverb.returnGain.gain.value = 1;
    sharedReverb.convolver.connect(sharedReverb.returnGain);
    sharedReverb.returnGain.connect(ctx.destination);
    return ctx;
  }

  function buildGraph(video) {
    var wrapper = video.closest('.video-wrapper') || video.parentElement;
    var source;
    try {
      source = ctx.createMediaElementSource(video);
    } catch (err) {
      return null; // bereits verbunden - ueberspringen
    }
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = MAX_CUTOFF_HZ;
    filter.Q.value = 0.3;

    var gain = ctx.createGain();
    gain.gain.value = 0; // startet bei 0, erster tick() setzt den echten Zielwert

    var reverbSend = ctx.createGain();
    reverbSend.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(reverbSend);
    reverbSend.connect(sharedReverb.convolver);

    return { video: video, wrapper: wrapper, filter: filter, gain: gain, reverbSend: reverbSend, smoothedT: 1 };
  }

  function computeRawT(wrapper) {
    var rect = wrapper.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    var elCenter = rect.top + rect.height / 2;
    var offset = Math.abs(elCenter - vh / 2);
    var zoneHalf = vh * CENTER_ZONE;
    if (offset <= zoneHalf) return 0;
    var fadeSpan = Math.max(1, (vh / 2 + rect.height / 2) - zoneHalf);
    return Math.min(1, (offset - zoneHalf) / fadeSpan);
  }

  function applyParams(node, t, duck) {
    var eased = smootherstep(t);
    var cutoff = MAX_CUTOFF_HZ - eased * (MAX_CUTOFF_HZ - MIN_CUTOFF_HZ);
    var volDb = eased * MIN_VOLUME_DB;
    var reverb = eased * MAX_REVERB_MIX;
    var now = ctx.currentTime;
    node.filter.frequency.setTargetAtTime(cutoff, now, PARAM_RAMP_SEC);
    node.gain.gain.setTargetAtTime(dbToGain(volDb) * duck, now, PARAM_RAMP_SEC);
    node.reverbSend.gain.setTargetAtTime(reverb * duck, now, PARAM_RAMP_SEC);
  }

  function tick() {
    rafId = requestAnimationFrame(tick);
    var alpha = 1 - Math.exp(-16 / SMOOTH_HALFLIFE_MS);
    duckLevel += (duckTarget - duckLevel) * alpha;
    nodes.forEach(function (node) {
      var target = computeRawT(node.wrapper);
      node.smoothedT += (target - node.smoothedT) * alpha;
      applyParams(node, node.smoothedT, duckLevel);
    });
  }

  function duck() { duckTarget = 0; }
  function unduck() { duckTarget = 1; }

  // --- Ducken, wenn das Showreel oder ein Vimeo-Player Ton bekommt ---------
  function watchHeroShowreel() {
    var hero = document.querySelector('.code-embed.show-reel.w-embed video.bg-video');
    if (!hero) return;
    var isLoud = function () { return !hero.muted && !hero.paused; };
    hero.addEventListener('play', function () { if (isLoud()) duck(); });
    hero.addEventListener('volumechange', function () { isLoud() ? duck() : unduck(); });
    hero.addEventListener('pause', unduck);
    hero.addEventListener('ended', unduck);
  }
  function watchVimeo() {
    window.addEventListener('message', function (e) {
      if (typeof e.data !== 'string' || String(e.origin).indexOf('vimeo.com') < 0) return;
      var d;
      try { d = JSON.parse(e.data); } catch (err) { return; }
      if (d.event === 'ready' && e.source) {
        try {
          e.source.postMessage(JSON.stringify({ method: 'addEventListener', value: 'play' }), '*');
          e.source.postMessage(JSON.stringify({ method: 'addEventListener', value: 'pause' }), '*');
        } catch (err) { /* ignore */ }
      }
      if (d.event === 'play') duck();
      if (d.event === 'pause') unduck();
    });
  }

  // --- Sanfter Fade-out vor internen Seitenwechseln -------------------------
  function watchInternalNav() {
    document.addEventListener('click', function (e) {
      if (!unlocked || !nodes.length) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var link = e.target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;
      if (link.target && link.target !== '' && link.target !== '_self') return;
      var url;
      try { url = new URL(link.href, window.location.href); } catch (err) { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // gleiche Seite (z. B. Anker)

      e.preventDefault();
      var now = ctx.currentTime;
      nodes.forEach(function (node) {
        node.gain.gain.setTargetAtTime(0, now, NAV_FADE_MS / 1000 / 3);
        node.reverbSend.gain.setTargetAtTime(0, now, NAV_FADE_MS / 1000 / 3);
      });
      setTimeout(function () { window.location.href = link.href; }, NAV_FADE_MS);
    }, true);
  }

  // --- UI: erstes Loop-Video zeigt nur den Play-Pfeil (kein Badge), bis --
  // --- entsperrt ist; danach verschwinden Pfeil+Badge bei allen. --------
  teaserVideos.forEach(function (video, i) {
    var wrapper = video.closest('.video-wrapper');
    if (!wrapper) return;
    if (i === 0) wrapper.classList.add('fp-scroll-audio-hide-badge');
  });

  function unlock() {
    if (unlocked) return;
    var context = ensureContext();
    if (!context) return;
    unlocked = true;
    context.resume().then(function () {
      teaserVideos.forEach(function (video) {
        video.muted = false;
        var node = buildGraph(video);
        if (node) {
          nodes.push(node);
          if (node.wrapper) node.wrapper.classList.add('fp-scroll-audio-unlocked');
        }
        video.play().catch(function () {});
      });
      if (rafId == null) tick();
    });
  }

  document.addEventListener('click', unlock, { once: true, passive: true });
  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('keydown', unlock, { once: true });

  watchHeroShowreel();
  watchVimeo();
  watchInternalNav();

  // Kleines Debug-Hilfsmittel fuers Ohr-Tuning: in der Devtools-Konsole
  // `__fpScrollAudio()` aufrufen, um die aktuellen Werte pro Loop-Video zu sehen.
  window.__fpScrollAudio = function () {
    return nodes.map(function (n) {
      return {
        cutoffHz: Math.round(n.filter.frequency.value),
        volumeDb: Math.round(20 * Math.log10(Math.max(1e-6, n.gain.gain.value)) * 10) / 10,
        reverbMix: Math.round(n.reverbSend.gain.value * 100) / 100,
        t: Math.round(n.smoothedT * 100) / 100,
        duck: Math.round(duckLevel * 100) / 100,
      };
    });
  };
})();
