/* ==========================================================================
   Scroll Burn — прожиг между секциями.
   Маски кромки считаются заранее (SVG-фильтр → PNG-альфа) и кэшируются.
   В кадре двигаются только готовая маска и цветной CSS-слой:
   фильтр и canvas не участвуют в скролле.
   ========================================================================== */

(() => {
  'use strict';

  const DEFAULTS = Object.freeze({
    direction: 'up',
    start: 0,
    end: -100,
    smoothing: 0.12,
    displacement: 220,
    frequencyX: 0.015,
    frequencyY: 0.02,
    octaves: 3,
    seed: 7
  });

  const cfg = { ...DEFAULTS };
  let requestTick = () => {};

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  // Ограничиваем размер кэша кромки, чтобы генерация не была тяжёлой.
  const MASK_MAX_WIDTH = 2400;
  const MASK_SCALE_MAX = 1;

  // Как в демо: одна кромка на все переходы, чётные/нечётные зеркалятся.
  const MASK_VARIANTS = 6;

  const geometryFromConfig = (config, sectionWidth) => {
    const pad = Math.max(300, config.displacement + 80);
    const solidPart = Math.max(160, config.displacement + 120);
    return {
      padX: pad,
      padY: pad,
      solidPart,
      bandHeight: pad + solidPart,
      bandWidth: Math.max(1, sectionWidth) + pad * 2,
      edge: Math.ceil(config.displacement / 2) + 6
    };
  };

  const buildMaskSvg = (config, geometry, mw, mh, scale) => {
    const frequencyX = config.frequencyX / scale;
    const frequencyY = config.frequencyY / scale;
    const displacement = config.displacement * scale;
    const preBlur = 1.8 * scale;
    const postBlur = 0.4 * scale;
    const sourceTop = geometry.padY * scale;
    const sourceHeight = geometry.solidPart * scale;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}">
      <defs>
        <filter id="f" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="${frequencyX} ${frequencyY}" numOctaves="${config.octaves}" seed="${config.seed}" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="${displacement}" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
          <feGaussianBlur in="displaced" stdDeviation="${preBlur}" result="presmooth"/>
          <feComponentTransfer in="presmooth" result="cut">
            <feFuncA type="discrete" tableValues="0 0 0 0 0 1 1 1 1 1"/>
          </feComponentTransfer>
          <feGaussianBlur in="cut" stdDeviation="${postBlur}"/>
        </filter>
      </defs>
      <rect x="0" y="${sourceTop}" width="${mw}" height="${sourceHeight}" fill="#FFFFFF" filter="url(#f)"/>
    </svg>`;
  };

  const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

  /* ------------------------------------------------------------------ */
  /* Общий кэш кромки                                                    */
  /* ------------------------------------------------------------------ */

  class MaskStore {
    constructor(config, burns) {
      this.config = config;
      this.burns = burns;
      this.timer = 0;
      this.token = 0;
      this.ready = false;
      this.masks = [];
      this.mw = 0;
      this.mh = 0;
    }

    start() {
      // Считаем маски после первого кадра, чтобы не задерживать загрузку.
      setTimeout(() => this.generate(), 400);
    }

    schedule(delay = 180, clear = false) {
      clearTimeout(this.timer);
      this.token++;
      this.ready = false;
      if (clear) this.burns.forEach((burn) => burn.clearMask());
      this.timer = setTimeout(() => this.generate(), delay);
    }

    async generate() {
      const token = ++this.token;
      const first = this.burns[0];
      const width = first
        ? first.el.clientWidth
        : (document.documentElement.clientWidth || window.innerWidth);
      const geometry = geometryFromConfig(this.config, width);
      const scale = Math.min(MASK_SCALE_MAX, MASK_MAX_WIDTH / geometry.bandWidth);
      const mw = Math.max(2, Math.round(geometry.bandWidth * scale));
      const mh = Math.max(2, Math.round(geometry.bandHeight * scale));
      const count = Math.min(MASK_VARIANTS, Math.max(1, this.burns.length));

      try {
        // Каждый вариант — свой seed шума, поэтому кромки не повторяются.
        const masks = await Promise.all(
          Array.from({ length: count }, async (_, index) => {
            const variant = { ...this.config, seed: this.config.seed + index * 17 };
            const svg = buildMaskSvg(variant, geometry, mw, mh, scale);
            const image = await loadImage('data:image/svg+xml;base64,' + btoa(svg));
            const canvas = document.createElement('canvas');
            canvas.width = mw;
            canvas.height = mh;
            canvas.getContext('2d').drawImage(image, 0, 0);
            return canvas;
          })
        );
        if (token !== this.token) return;

        this.masks = masks;
        this.mw = mw;
        this.mh = mh;
        this.ready = true;
        this.burns.forEach((burn) => {
          burn.setMask(masks[burn.index % masks.length], mw, mh, masks);
        });
        requestTick();
      } catch (error) {
        // Без кромки остаётся простой прямой прожиг — эффект не ломается.
        this.ready = false;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Прожиг                                                              */
  /* ------------------------------------------------------------------ */

  class Burn {
    constructor(el, index) {
      this.el = el;
      this.color = this.resolveColor(el);
      this.index = index;
      this.progress = -1;
      this.written = -1;
      this.solidVisible = false;
      this.bandVisible = false;
      this.maskReady = false;
      this.docTop = 0;
      this.height = 0;
      this.edge = 6;
      this.padX = 300;
      this.padY = 300;
      this.solidPart = 340;
      this.bandHeight = 640;
      this.maskSources = null;
      this.flowTime = 0;
      this.flowDone = false;
      this.build();
      this.measure();
    }

    // Цвет прожига = реальный фон следующей секции, а не «примерный» литерал.
    resolveColor(el) {
      const host = el.parentElement;
      const next = host ? host.nextElementSibling : null;
      if (next) {
        const bg = getComputedStyle(next).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      }
      if (el.dataset.color) return el.dataset.color;
      return getComputedStyle(document.body).backgroundColor || '#FFFFFF';
    }

    build() {
      // Простая заливка: растягивается по скроллу, без фильтра.
      const solid = document.createElement('div');
      solid.className = 'burn__solid';
      solid.style.background = this.color;
      solid.style.visibility = 'hidden';

      // Готовая canvas-кромка: при скролле только двигается.
      const band = document.createElement('div');
      band.className = 'burn__band';
      band.style.visibility = 'hidden';

      const bandInner = document.createElement('div');
      bandInner.className = 'burn__band-inner';

      const bandImage = document.createElement('div');
      bandImage.className = 'burn__band-image';

      bandInner.appendChild(bandImage);
      band.appendChild(bandInner);
      this.el.append(solid, band);

      this.solid = solid;
      this.band = band;
      this.bandInner = bandInner;
      this.bandImage = bandImage;
    }

    measure() {
      // Короткая секция = «экран» целиком: прожиг ровно по ней, без нахлёста
      // на соседнюю секцию. Высокая — только нижние 100svh.
      const host = this.el.parentElement;
      const viewport = window.innerHeight || 1;
      if (host) {
        const hostHeight = host.getBoundingClientRect().height;
        this.el.classList.toggle('burn--viewport', hostHeight > viewport);
      }

      const rect = this.el.getBoundingClientRect();
      this.height = rect.height;
      this.docTop = rect.top + (window.scrollY || window.pageYOffset || 0);
    }

    apply(config) {
      const geometry = geometryFromConfig(config, this.el.clientWidth);
      this.padX = geometry.padX;
      this.padY = geometry.padY;
      this.solidPart = geometry.solidPart;
      this.bandHeight = geometry.bandHeight;
      this.edge = geometry.edge;

      const solidStyle = this.solid.style;
      solidStyle.height = '100%';
      solidStyle.transformOrigin = config.direction === 'up' ? '50% 100%' : '50% 0%';
      if (config.direction === 'up') {
        solidStyle.top = 'auto';
        solidStyle.bottom = `${-this.edge}px`;
      } else {
        solidStyle.top = `${-this.edge}px`;
        solidStyle.bottom = 'auto';
      }

      const bandStyle = this.band.style;
      bandStyle.left = `${-this.padX}px`;
      bandStyle.width = `calc(100% + ${this.padX * 2}px)`;
      bandStyle.height = `${this.bandHeight}px`;

      // Разные экраны получают зеркальные варианты кромки, а режим «вниз» —
      // перевёрнутую по вертикали. Так один кэш даёт разные рисунки.
      const flipX = this.index % 2 ? -1 : 1;
      const flipY = config.direction === 'down' ? -1 : 1;
      this.bandInner.style.transform = `scale(${flipX}, ${flipY})`;

      this.written = -1;
    }

    setMask(maskCanvas, mw, mh, sources) {
      this.maskSources = sources || [maskCanvas];
      this.flowTime = 0;
      this.flowDone = false;
      /* Маска хранится как PNG-альфа, а цвет даёт CSS-слой: цвет
         гарантированно совпадает с фоном следующей секции. */
      if (!maskCanvas.__maskUrl) {
        maskCanvas.__maskUrl = maskCanvas.toDataURL('image/png');
      }
      const url = `url("${maskCanvas.__maskUrl}")`;
      const image = this.bandImage;
      image.style.background = this.color;
      image.style.webkitMaskImage = url;
      image.style.maskImage = url;
      image.style.webkitMaskSize = '100% 100%';
      image.style.maskSize = '100% 100%';
      image.style.webkitMaskRepeat = 'no-repeat';
      image.style.maskRepeat = 'no-repeat';
      image.style.webkitMaskPosition = '0 0';
      image.style.maskPosition = '0 0';
      image.style.maskMode = 'alpha';
      image.style.webkitMaskSourceType = 'alpha';
      this.maskReady = true;
    }

    // Живая кромка: готовые маски перетекают по прогрессу, плюс лёгкий
    // временной дрейф. Два drawImage на кадр, без SVG-фильтра в скролле.
    flow(next, time, reduced) {
      const sources = this.maskSources;
      if (!sources || !sources.length || !this.maskReady) return;
      if (!reduced && this.flowTime && time - this.flowTime < 33) return;
      this.flowTime = time;

      const n = sources.length;
      const pos = Math.min(n - 1, Math.max(0, next * (n - 1)));
      const i = Math.floor(pos);
      const j = Math.min(n - 1, i + 1);
      const base = pos - i;
      const wave = reduced ? 0 : Math.sin(time * 0.0009 + this.index * 1.7) * 0.14;
      const mix = Math.max(0, Math.min(1, base + wave));
      const dy = reduced ? 0 : Math.sin(time * 0.0007 + this.index) * 6;

      const canvas = this.canvas;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 1 - mix;
      ctx.drawImage(sources[i], 0, dy);
      if (j !== i) {
        ctx.globalAlpha = mix;
        ctx.drawImage(sources[j], 0, -dy);
      }
      ctx.globalAlpha = 1;

      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = this.color;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    clearMask() {
      this.maskReady = false;
      if (this.bandVisible) {
        this.band.style.visibility = 'hidden';
        this.bandVisible = false;
      }
    }

    update(config, viewportHeight, rectTop, reducedMotion) {
      const shortStart = this.el.classList.contains('burn--viewport')
        ? 0
        : Math.max(0, viewportHeight - this.height);
      const startPx = (config.start / 100) * viewportHeight + shortStart;
      const burnHeight = this.height || viewportHeight;
      const endPx = (config.end / 100) * burnHeight - (this.edge + config.displacement / 2 + 8);

      const begin = this.docTop > endPx + 1
        ? Math.min(startPx, this.docTop)
        : startPx;

      const denominator = (begin - endPx) || 1;
      const target = clamp((begin - rectTop) / denominator, 0, 1);

      let next;
      if (reducedMotion || config.smoothing <= 0) {
        next = target;
      } else if (this.progress < 0) {
        next = target;
      } else {
        next = this.progress + (target - this.progress) * Math.min(1, config.smoothing);
        if (Math.abs(target - next) < 0.0005) next = target;
      }
      this.progress = next;
      const settling = Math.abs(next - target) > 0.0005;

      const solidShow = next > 0.0005;
      if (solidShow !== this.solidVisible) {
        this.solidVisible = solidShow;
        this.solid.style.visibility = solidShow ? 'visible' : 'hidden';
      }

      const bandShow = solidShow && this.maskReady;
      if (bandShow !== this.bandVisible) {
        this.bandVisible = bandShow;
        this.band.style.visibility = bandShow ? 'visible' : 'hidden';
      }

      if (!solidShow) return settling;

      if (Math.abs(next - this.written) > 0.0002 || next === 0 || next === 1) {
        this.solid.style.transform = `translate3d(0, 0, 0) scaleY(${next.toFixed(4)})`;
        this.written = next;
      }

      if (!bandShow) return settling;

      const sectionHeight = this.height || viewportHeight;
      const edgeY = config.direction === 'up'
        ? sectionHeight * (1 - next) + this.edge
        : next * sectionHeight - this.edge;
      const bandY = config.direction === 'up'
        ? edgeY - this.padY
        : edgeY - this.solidPart;

      // Кэшированная маска: в кадре только сдвиг полосы, без canvas-перерисовки.
      this.band.style.transform = `translate3d(0, ${bandY.toFixed(2)}px, 0)`;

      return settling;
    }
  }

  const burnNodes = [...document.querySelectorAll('[data-burn]')];
  const burns = burnNodes.map((el, index) => new Burn(el, index));
  const maskStore = new MaskStore(cfg, burns);

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = reducedQuery.matches;
  reducedQuery.addEventListener?.('change', (event) => {
    reducedMotion = event.matches;
  });

  const scrollbar = document.getElementById('scrollbar');
  let scrolledClass = false;

  const applyAll = () => burns.forEach((burn) => burn.apply(cfg));

  const write = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    if (scrollbar) scrollbar.style.transform = `scaleX(${ratio.toFixed(4)})`;

    const scrolled = window.scrollY > 40;
    if (scrolled !== scrolledClass) {
      document.body.classList.toggle('is-scrolled', scrolled);
      scrolledClass = scrolled;
    }
  };

  let rafId = 0;
  let firePaused = false;
  let firePauseTimer = 0;

  const setFirePaused = (next) => {
    if (next === firePaused) return;
    firePaused = next;
    window.dispatchEvent(new CustomEvent('scrollburn:active', {
      detail: { active: next }
    }));
  };

  const holdFirePaused = () => {
    setFirePaused(true);
    clearTimeout(firePauseTimer);
    firePauseTimer = setTimeout(() => setFirePaused(false), 260);
  };

  const tick = () => {
    rafId = 0;
    const viewportHeight = window.innerHeight || 1;
    const y = window.scrollY || 0;
    let settling = false;
    burns.forEach((burn) => {
      if (burn.update(cfg, viewportHeight, burn.docTop - y, reducedMotion)) settling = true;
    });

    let transition = false;
    for (const burn of burns) {
      if (burn.progress > 0.001 && burn.progress < 0.999) {
        transition = true;
        break;
      }
    }
    if (transition) {
      holdFirePaused();
    } else {
      clearTimeout(firePauseTimer);
      setFirePaused(false);
    }

    write();
    if (settling) requestTick();
  };

  requestTick = () => {
    if (!rafId) rafId = requestAnimationFrame(tick);
  };

  applyAll();
  burns.forEach((burn) => burn.measure());
  maskStore.start();
  requestTick();

  window.addEventListener('scroll', requestTick, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else {
      requestTick();
    }
  });

  window.addEventListener('resize', () => {
    burns.forEach((burn) => burn.measure());
    applyAll();
    maskStore.schedule(200, true);
    requestTick();
  });

  window.addEventListener('load', () => {
    burns.forEach((burn) => burn.measure());
    requestTick();
  });

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      burns.forEach((burn) => burn.measure());
      requestTick();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Пульт                                                               */
  /* ------------------------------------------------------------------ */

  const lab = document.getElementById('lab');
  const panel = document.getElementById('labPanel');
  const toggle = document.getElementById('labToggle');
  const closeButton = document.getElementById('labClose');
  const resetButton = document.getElementById('labReset');

  // Пульт — необязательная часть демо. Без его разметки скрипт работает как есть.
  if (lab && panel && toggle && closeButton && resetButton) {
  const MASK_KEYS = new Set(['displacement', 'frequencyX', 'frequencyY', 'octaves', 'seed']);
  const inputs = [...document.querySelectorAll('input[data-key]')];
  const dirButtons = [...document.querySelectorAll('[data-dir]')];

  const formats = {
    smoothing: (v) => Number(v).toFixed(2),
    start: (v) => `${Math.round(v)}%`.replace('-', '−'),
    end: (v) => `${Math.round(v)}%`.replace('-', '−'),
    displacement: (v) => `${Math.round(v)} px`,
    frequencyX: (v) => Number(v).toFixed(3),
    frequencyY: (v) => Number(v).toFixed(3),
    octaves: (v) => String(Math.round(v)),
    seed: (v) => String(Math.round(v))
  };

  const syncOutputs = () => {
    document.querySelectorAll('[data-out]').forEach((output) => {
      const key = output.dataset.out;
      if (formats[key]) output.textContent = formats[key](cfg[key]);
    });
    dirButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.dir === cfg.direction));
    });
  };

  const syncInputs = () => {
    inputs.forEach((input) => {
      input.value = String(cfg[input.dataset.key]);
    });
    syncOutputs();
  };

  const openLab = (open) => {
    lab.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
    if (open) {
      panel.removeAttribute('inert');
    } else {
      panel.setAttribute('inert', '');
    }
  };

  toggle.addEventListener('click', () => {
    openLab(!lab.classList.contains('is-open'));
  });

  closeButton.addEventListener('click', () => {
    openLab(false);
    toggle.focus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lab.classList.contains('is-open')) {
      openLab(false);
      toggle.focus();
    }
  });

  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      const key = input.dataset.key;
      if (!(key in cfg)) return;
      cfg[key] = Number(input.value);
      syncOutputs();
      applyAll();
      requestTick();
      if (MASK_KEYS.has(key)) {
        // При смене размера кляксы геометрия полосы меняется — старую
        // кромку сразу убираем. Для seed/шума можно дождаться новой.
        maskStore.schedule(180, key === 'displacement');
      }
    });
  });

  dirButtons.forEach((button) => {
    button.addEventListener('click', () => {
      cfg.direction = button.dataset.dir;
      syncOutputs();
      applyAll();
      requestTick();
    });
  });

  resetButton.addEventListener('click', () => {
    Object.assign(cfg, DEFAULTS);
    syncInputs();
    applyAll();
    requestTick();
    maskStore.schedule(0, true);
  });

  syncInputs();
  }
})();
