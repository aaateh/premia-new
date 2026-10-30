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
