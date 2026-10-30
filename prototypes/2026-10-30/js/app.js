(function () {
  // на мобильных группы номинаций свёрнуты — чтобы не было простыни текста
  if (window.innerWidth <= 900) {
    var groups = document.querySelectorAll('.nom-group');
    for (var i = 0; i < groups.length; i++) groups[i].removeAttribute('open');
  }

  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  if (!burger || !nav) return;

  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest('a') && window.innerWidth <= 900) {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });
})();
