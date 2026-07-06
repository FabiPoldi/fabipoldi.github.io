// site.js — Video-/Interaktionsverhalten der Website
document.addEventListener('DOMContentLoaded', function () {
  var videos = Array.prototype.slice.call(document.querySelectorAll('video.bg-video'));

  function wrapperFor(video) {
    return video.closest('.video-wrapper') || video.parentElement;
  }

  // Der Mauszeiger kommuniziert den Ton-Zustand (Lautsprecher mit Wellen / mit X)
  function syncCursor(video) {
    var w = wrapperFor(video);
    if (w) w.classList.toggle('fp-unmuted', !video.muted);
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

  // Click-to-Watch: Klick aufs Vorschaubild spielt das Video sofort ab —
  // selbstgehostete Videos bekommen direkt Ton, Vimeo-Player werden mit
  // autoplay neu geladen (das Ausblenden übernimmt die Webflow-Interaktion).
  document.addEventListener('click', function (e) {
    var thumb = e.target.closest('.video-thumbnail');
    if (!thumb) return;
    var wrap = thumb.closest('.video-div') || thumb.parentElement;
    if (!wrap) return;
    thumb.style.display = 'none';

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
    }, { once: true });
  });

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
      var W = grid.clientWidth - colGap;
      if (W < 320) return; // mobil: Original-Layout lassen

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
