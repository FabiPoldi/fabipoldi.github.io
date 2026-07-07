// site.js — Video-/Interaktionsverhalten der Website
document.addEventListener('DOMContentLoaded', function () {
  var videos = Array.prototype.slice.call(document.querySelectorAll('video.bg-video'));

  function wrapperFor(video) {
    return video.closest('.video-wrapper') || video.parentElement;
  }

  // Badge-Logik: stumm = X dauerhaft sichtbar; Ton an = Wellen, faden aus
  var badgeTimers = new WeakMap();
  function syncCursor(video) {
    var w = wrapperFor(video);
    if (!w) return;
    var unmuted = !video.muted;
    w.classList.toggle('fp-unmuted', unmuted);
    clearTimeout(badgeTimers.get(w));
    if (unmuted) {
      w.classList.add('fp-badge-show');
      badgeTimers.set(w, setTimeout(function () {
        w.classList.remove('fp-badge-show');
      }, 1600));
    } else {
      w.classList.remove('fp-badge-show');
    }
  }

  function muteAll() {
    videos.forEach(function (v) {
      v.muted = true;
      syncCursor(v);
    });
  }

  videos.forEach(function (video) {
    var loopedOnce = false;
    syncCursor(video);

    // Klick auf die Videofläche schaltet den Ton um; alle anderen werden stumm.
    function toggleSound() {
      var wasMuted = video.muted;
      muteAll();
      if (wasMuted) {
        video.muted = false;
        loopedOnce = false;
        video.play();
      }
      syncCursor(video);
    }

    var clickTarget = wrapperFor(video);
    if (clickTarget) clickTarget.addEventListener('click', toggleSound);

    // Nach einem kompletten Durchlauf mit Ton wieder stumm loopen (wie im Original)
    video.addEventListener('ended', function () {
      if (!loopedOnce) {
        loopedOnce = true;
        video.muted = true;
        syncCursor(video);
      }
      video.currentTime = 0;
      video.play();
    });
  });

  // Play-Pfeil mittig auf alle Vorschaubilder legen (Golf hat eigene Buttons)
  var PLAY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M10 6 L26 16 L10 26 Z"/></svg>';
  Array.prototype.slice.call(document.querySelectorAll('.video-thumbnail, .fp-play-main')).forEach(function (t) {
    if (t.querySelector && t.querySelector('.play-button')) return;
    var overlay = document.createElement('div');
    overlay.className = 'fp-play-overlay';
    overlay.innerHTML = PLAY_SVG;
    if (t.tagName === 'IMG') {
      var wrap = document.createElement('span');
      wrap.className = 'fp-thumb-wrap';
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
      wrap.appendChild(overlay);
    } else {
      t.appendChild(overlay);
    }
  });

  // Click-to-Watch: Klick aufs Vorschaubild spielt das Video sofort ab —
  // selbstgehostete Videos bekommen direkt Ton, Vimeo-Player werden mit
  // autoplay neu geladen (das Ausblenden übernimmt die Webflow-Interaktion).
  document.addEventListener('click', function (e) {
    var thumb = e.target.closest('.video-thumbnail');
    if (!thumb) return;
    var wrap = thumb.closest('.video-div') || thumb.parentElement;
    if (!wrap) return;
    thumb.style.display = 'none';
    // Falls das Vorschaubild in einem Overlay-Wrapper steckt: alles ausblenden
    var tw = thumb.closest('.fp-thumb-wrap');
    if (tw) tw.style.display = 'none';

    var video = wrap.querySelector('video.bg-video');
    if (video) {
      muteAll();
      video.muted = false;
      video.play();
      syncCursor(video);
      return;
    }

    var iframe = wrap.querySelector('.vimeo-video iframe');
    if (iframe && iframe.src) {
      try {
        var u = new URL(iframe.src);
        u.searchParams.set('autoplay', '1');
        u.searchParams.set('muted', '0');
        iframe.src = u.toString();
      } catch (err) { /* ungültige URL — nichts tun */ }
    }
  });

  // Großer Oracles-Loop: Klick tauscht das GIF an Ort und Stelle gegen den
  // laufenden Vimeo-Player (dnt=1: Vimeo ohne Tracking).
  Array.prototype.slice.call(document.querySelectorAll('.fp-play-main[data-vimeo-id]')).forEach(function (el) {
    el.addEventListener('click', function () {
      var id = el.getAttribute('data-vimeo-id');
      if (!id) return;
      var h = el.getBoundingClientRect().height;
      var iframe = document.createElement('iframe');
      iframe.src = 'https://player.vimeo.com/video/' + id + '?autoplay=1&muted=0&byline=0&portrait=0&title=0&dnt=1';
      iframe.setAttribute('allow', 'autoplay; fullscreen');
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('frameborder', '0');
      iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
      el.style.height = h + 'px';
      el.style.cursor = 'auto';
      el.innerHTML = '';
      el.appendChild(iframe);
      // Fläche ans echte Video-Seitenverhältnis anpassen (volle Breite,
      // bündig mit den GIFs darunter — keine schwarzen Balken)
      fetch('https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F' + id)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.width && d.height) {
            el.style.height = (el.clientWidth * d.height / d.width) + 'px';
          }
        })
        .catch(function () { /* Fallback: GIF-Höhe behalten */ });
    }, { once: true });
  });

  // Mobil: Loop-Videos (Oracles) übernehmen ihr echtes Seitenverhältnis
  function fitLoopAspect() {
    if (window.innerWidth >= 768) return;
    Array.prototype.slice.call(document.querySelectorAll('.grid-8 > .w-background-video, .grid-9 .fp-loop-link > .w-background-video, .grid-9 .fp-play-main > .w-background-video')).forEach(function (wrap) {
      var v = wrap.querySelector('video');
      if (!v) return;
      var apply = function () {
        if (v.videoWidth && v.videoHeight) wrap.style.aspectRatio = v.videoWidth + ' / ' + v.videoHeight;
      };
      if (v.readyState >= 1) apply();
      else v.addEventListener('loadedmetadata', apply, { once: true });
    });
  }
  fitLoopAspect();
  window.addEventListener('resize', fitLoopAspect);

  // Junk Jornal: beide Foto-Spalten so breit machen, dass sie oben UND
  // unten bündig abschließen (Spaltenbreiten ~ umgekehrt proportional zur
  // Summe der Bild-Seitenverhältnisse), Gesamtbreite bleibt gleich/zentriert.
  var junkGrids = Array.prototype.slice.call(document.querySelectorAll('.junk-grid.page'));

  function balanceJunk() {
    junkGrids.forEach(function (grid) {
      var cols = Array.prototype.slice.call(grid.children).filter(function (c) {
        return c.classList.contains('flex-fotos');
      });
      if (cols.length !== 2) return;
      var imgs = cols.map(function (c) {
        return Array.prototype.slice.call(c.querySelectorAll('img'));
      });
      if (imgs.some(function (list) {
        return list.length === 0 || list.some(function (im) { return !im.naturalWidth; });
      })) return;

      var ratioSum = imgs.map(function (list) {
        return list.reduce(function (s, im) { return s + im.naturalHeight / im.naturalWidth; }, 0);
      });
      var rowGap = parseFloat(getComputedStyle(cols[0]).rowGap) || 10;
      var gaps = imgs.map(function (list) { return rowGap * (list.length - 1); });
      var colGap = parseFloat(getComputedStyle(grid).columnGap) || 10;

      grid.style.gridTemplateColumns = '';
      if (window.innerWidth < 768) return; // mobil: einspaltig (CSS)
      var W = grid.clientWidth - colGap;
      if (W < 320) return;

      var w0 = (W * ratioSum[1] + gaps[1] - gaps[0]) / (ratioSum[0] + ratioSum[1]);
      grid.style.gridTemplateColumns = w0 + 'px ' + (W - w0) + 'px';
    });
  }

  if (junkGrids.length) {
    junkGrids.forEach(function (grid) {
      Array.prototype.slice.call(grid.querySelectorAll('img')).forEach(function (im) {
        im.loading = 'eager';
        if (im.complete) return;
        im.addEventListener('load', balanceJunk);
      });
    });
    balanceJunk();
    window.addEventListener('load', balanceJunk);
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(balanceJunk, 120);
    });
  }
});
