/* Пауза CSS-анимаций у блоков вне экрана и во фоне вкладки.
   Подключается только на тестовой странице тарифов. */
(function () {
  var sections = document.querySelectorAll("#tickets, #manifesto");

  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        entries[i].target.classList.toggle("anim-paused", !entries[i].isIntersecting);
      }
    }, { rootMargin: "200px 0px" });

    for (var i = 0; i < sections.length; i++) io.observe(sections[i]);
  }

  document.body.classList.toggle("page-hidden", document.hidden);
  document.addEventListener("visibilitychange", function () {
    document.body.classList.toggle("page-hidden", document.hidden);
  });
})();
