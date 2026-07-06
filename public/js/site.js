// site.js — Video-/Interaktionsverhalten der Website
// (läuft auf allen Seiten, ersetzt das frühere Inline-Script der Startseite)
document.addEventListener('DOMContentLoaded', function () {
  var videos = Array.prototype.slice.call(document.querySelectorAll('video.bg-video'));

  function buttonFor(video) {
    var wrap = video.closest('.video-wrapper') || video.parentElement;
    return wrap ? wrap.querySelector('.mute-toggle') : null;
  }

  // Ton-Symbol nur zeigen, solange das Video stumm ist
  function syncButton(video) {
    var btn = buttonFor(video);
    if (btn) btn.style.display = video.muted ? 'flex' : 'none';
  }

  function muteAll() {
    videos.forEach(function (v) {
      v.muted = true;
      syncButton(v);
    });
  }

  videos.forEach(function (video) {
    var loopedOnce = false;
    syncButton(video);

    // Klick aufs Video (oder den Ton-Button) schaltet den Ton um;
    // alle anderen Videos werden dabei stumm.
    function toggleSound() {
      var wasMuted = video.muted;
      muteAll();
      if (wasMuted) {
        video.muted = false;
        loopedOnce = false;
        video.play();
      }
      syncButton(video);
    }

    video.addEventListener('click', toggleSound);
    var btn = buttonFor(video);
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleSound();
      });
    }

    // Nach einem kompletten Durchlauf mit Ton wieder stumm loopen (wie im Original)
    video.addEventListener('ended', function () {
      if (!loopedOnce) {
        loopedOnce = true;
        video.muted = true;
        syncButton(video);
      }
      video.currentTime = 0;
      video.play();
    });
  });

  // Click-to-Watch: Beim Klick auf ein Vorschau-Standbild/GIF soll das Video
  // sofort loslaufen — selbstgehostete Videos bekommen direkt Ton,
  // Vimeo-Player werden mit autoplay neu geladen (das Ausblenden des
  // Thumbnails übernimmt weiterhin die Webflow-Interaktion).
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
      syncButton(video);
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
