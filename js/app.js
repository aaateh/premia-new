(function () {
  // «горящая» рамка кнопок из дизайн-системы
  if (window.StarBorder) {
    var buttons = document.querySelectorAll('.btn:not(.btn--ghost)');
    for (var b = 0; b < buttons.length; b++) {
      var el = buttons[b];
      el.classList.add('star-border');
      window.StarBorder.init(el, {
        radius: 4,
        thickness: 1,
        duration: 4,
        glow: .6,
        hover: 'lap',
        theme: el.closest('.section--soft') ? 'light' : 'dark'
      });
    }
  }

  // на мобильных группы номинаций свёрнуты — чтобы не было простыни текста
  if (window.innerWidth <= 900) {
    var groups = document.querySelectorAll('.nom-group');
    for (var i = 0; i < groups.length; i++) groups[i].removeAttribute('open');
  }

  // плавное раскрытие спойлеров без библиотек
  function enhanceDetails() {
    var items = document.querySelectorAll('details');
    for (var d = 0; d < items.length; d++) {
      (function (details) {
        var summary = details.querySelector('summary');
        if (!summary || details.dataset.motionReady) return;
        details.dataset.motionReady = '1';

        summary.addEventListener('click', function (event) {
          if (event.target.closest('a')) return;
          event.preventDefault();
          if (details.dataset.animating === '1') return;
          if (!details.animate) {
            details.open = !details.open;
            return;
          }

          var reduced = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (reduced) {
            details.open = !details.open;
            return;
          }

          details.dataset.animating = '1';
          var start = details.offsetHeight;
          details.style.overflow = 'hidden';

          function finish() {
            details.style.height = '';
            details.style.overflow = '';
            delete details.dataset.animating;
          }

          if (!details.open) {
            details.open = true;
            details.style.height = 'auto';
            var end = details.offsetHeight;
            details.style.height = start + 'px';
            var anim = details.animate([
              { height: start + 'px', opacity: .65 },
              { height: end + 'px', opacity: 1 }
            ], {
              duration: 280,
              easing: 'cubic-bezier(.22, 1, .36, 1)'
            });
            anim.onfinish = finish;
            anim.oncancel = finish;
          } else {
            var border = details.offsetHeight - details.clientHeight;
            var end = summary.offsetHeight + border;
            var anim = details.animate([
              { height: start + 'px', opacity: 1 },
              { height: end + 'px', opacity: .65 }
            ], {
              duration: 240,
              easing: 'cubic-bezier(.22, 1, .36, 1)'
            });
            anim.onfinish = function () {
              details.open = false;
              finish();
            };
            anim.oncancel = finish;
          }
        });
      })(items[d]);
    }
  }

  enhanceDetails();

  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  if (!burger || !nav) return;

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('menu-open', open);
  }

  burger.addEventListener('click', function () {
    setMenu(!nav.classList.contains('is-open'));
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest('a') && window.innerWidth <= 980) setMenu(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setMenu(false);
      burger.focus();
    }
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 980 && nav.classList.contains('is-open')) setMenu(false);
  });
})();
