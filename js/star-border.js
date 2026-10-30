/* ==========================================================================
   star-border.js — «горящая» рамка кнопки с marketingawards.ru
   Порт canvas-эффекта из бандла сайта (React-компонент StarBorder).
   Геометрия и математика сохранены: путь по скруглённому прямоугольнику,
   бегущий блик с градиентным хвостом, свечение головы, вспышка по клику,
   «лишний круг» по наведению, точки-искры.

   Использование:
     <a class="star-border" href="..." style="--star-border-radius:4px;--star-border-thickness:1px">
       <canvas class="star-border__light" aria-hidden="true"></canvas>
       <span>Заполнить</span>
     </a>
     <script src="star-border.js"></script>
     <script>StarBorder.initAll();</script>

   Или точечно: StarBorder.init(el, { duration: 4, thickness: 1, radius: 4, glow: .6 });
   ========================================================================== */

(function (global) {
    "use strict";

    var BLEED = 48;          // canvas выступает за кнопку на 48px с каждой стороны
    var LAP = 0.9;           // длительность «лишнего круга» при наведении, сек
    var TAU = Math.PI * 2;
    var WHITE = [255, 255, 255];

    var THEMES = {
        dark: { light: "#ffffff" },
        light: { light: "#18181b" }
    };

    var clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };
    var mod = function (v, m) { return ((v % m) + m) % m; };
    var easeInOut = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2; };
    var lerpColor = function (a, b, t) {
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    };
    var rgba = function (c, a) {
        return "rgba(" + Math.round(c[0]) + ", " + Math.round(c[1]) + ", " + Math.round(c[2]) + ", " + clamp(a, 0, 1).toFixed(3) + ")";
    };

    /* ---------- разбор цвета ---------- */
    var colorCtx = null;
    function parseColor(value) {
        if (!colorCtx) colorCtx = document.createElement("canvas").getContext("2d");
        if (!colorCtx) return WHITE;
        colorCtx.fillStyle = "#000000";
        colorCtx.fillStyle = value;
        var out = String(colorCtx.fillStyle);
        if (out.charAt(0) === "#") {
            var n = parseInt(out.slice(1, 7), 16);
            return [n >> 16 & 255, n >> 8 & 255, n & 255];
        }
        var m = out.match(/[\d.]+/g);
        return m ? [+m[0], +m[1], +m[2]] : WHITE;
    }

    /* ---------- путь по скруглённому прямоугольнику ---------- */
    function buildPath(w, h, radius) {
        var r = Math.max(0, Math.min(radius, w / 2, h / 2));
        var arc = Math.PI * r / 2;
        var straightW = Math.max(0, w - 2 * r);
        var straightH = Math.max(0, h - 2 * r);
        var segments = [
            { length: straightW, x: r, y: 0, dx: 1, dy: 0, angle: null },
            { length: arc, x: w - r, y: r, dx: 0, dy: 0, angle: -Math.PI / 2 },
            { length: straightH, x: w, y: r, dx: 0, dy: 1, angle: null },
            { length: arc, x: w - r, y: h - r, dx: 0, dy: 0, angle: 0 },
            { length: straightW, x: w - r, y: h, dx: -1, dy: 0, angle: null },
            { length: arc, x: r, y: h - r, dx: 0, dy: 0, angle: Math.PI / 2 },
            { length: straightH, x: 0, y: h - r, dx: 0, dy: -1, angle: null },
            { length: arc, x: r, y: r, dx: 0, dy: 0, angle: Math.PI }
        ];
        var total = 0;
        for (var i = 0; i < segments.length; i++) total += segments[i].length;
        return { r: r, segments: segments, total: Math.max(1, total) };
    }

    function pointAt(path, pos, out) {
        var left = mod(pos, path.total);
        for (var i = 0; i < path.segments.length; i++) {
            var s = path.segments[i];
            if (s.length > 0 && left <= s.length) {
                if (s.angle === null) {
                    out.x = s.x + s.dx * left;
                    out.y = s.y + s.dy * left;
                    out.nx = s.dy;
                    out.ny = -s.dx;
                } else {
                    var a = s.angle + left / path.r;
                    out.nx = Math.cos(a);
                    out.ny = Math.sin(a);
                    out.x = s.x + out.nx * path.r;
                    out.y = s.y + out.ny * path.r;
                }
                return out;
            }
            left -= s.length;
        }
        return out;
    }

    function nearestOnPath(path, px, py) {
        var best = Infinity, bestPos = 0, acc = 0;
        for (var i = 0; i < path.segments.length; i++) {
            var s = path.segments[i];
            if (s.length <= 0) continue;
            var d = 0, x = 0, y = 0;
            if (s.angle === null) {
                d = clamp((px - s.x) * s.dx + (py - s.y) * s.dy, 0, s.length);
                x = s.x + s.dx * d;
                y = s.y + s.dy * d;
            } else {
                var rel = mod(Math.atan2(py - s.y, px - s.x) - s.angle, TAU);
                if (rel > Math.PI / 2) rel = rel > Math.PI * 1.25 ? 0 : Math.PI / 2;
                d = rel * path.r;
                x = s.x + Math.cos(s.angle + rel) * path.r;
                y = s.y + Math.sin(s.angle + rel) * path.r;
            }
            var dist = (px - x) * (px - x) + (py - y) * (py - y);
            if (dist < best) { best = dist; bestPos = acc + d; }
            acc += s.length;
        }
        return bestPos;
    }

    /* ---------- одна кнопка ---------- */
    function init(el, options) {
        if (!el || el.__starBorder) return el && el.__starBorder;

        var canvas = el.querySelector(".star-border__light");
        if (!canvas) {
            canvas = document.createElement("canvas");
            canvas.className = "star-border__light";
            canvas.setAttribute("aria-hidden", "true");
            el.insertBefore(canvas, el.firstChild);
        }
        var ctx = canvas.getContext("2d");
        if (!ctx) return null;

        var opts = Object.assign({
            color: null,
            trailColor: null,
            duration: 4,
            thickness: 1,
            radius: 4,
            trailLength: .3,
            stars: 1,
            glow: .6,
            sparkle: false,
            direction: "clockwise",
            hover: "lap",
            clickPulse: true,
            paused: false,
            theme: "dark",
            respectReducedMotion: true
        }, options || {});

        var theme = THEMES[opts.theme] || THEMES.dark;
        var cfg = {
            light: opts.theme === "light",
            color: opts.color || theme.light,
            trailColor: opts.trailColor || opts.color || theme.light,
            duration: Math.max(.3, opts.duration),
            thickness: Math.max(.5, opts.thickness),
            radius: Math.max(0, opts.radius),
            trailLength: clamp(opts.trailLength, 0, 1),
            stars: clamp(Math.round(opts.stars), 1, 6),
            glow: clamp(opts.glow, 0, 1),
            sparkle: !!opts.sparkle,
            direction: opts.direction === "counterclockwise" ? -1 : 1,
            hover: opts.hover,
            clickPulse: opts.clickPulse,
            paused: opts.paused
        };

        var reduced = opts.respectReducedMotion &&
            !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

        var offscreen = document.createElement("canvas");
        var offCtx = offscreen.getContext("2d");

        var state = {
            width: 0, height: 0, dpr: 1,
            phase: 0, velocity: 0, motion: 0, lap: -1, time: 0,
            reveal: 0, boost: 0, flash: 0,
            hovered: false, focused: false, pointerX: 0, pointerY: 0, visible: true
        };

        var pulses = [];
        var sparks = [];
        var colors = { key: "", head: WHITE, tail: WHITE };
        var head = { x: 0, y: 0, nx: 0, ny: -1 };

        var raf = 0;
        var lastTime = performance.now();
        var alive = true;

        function metrics() {
            return buildPath(
                Math.max(1, state.width - cfg.thickness),
                Math.max(1, state.height - cfg.thickness),
                cfg.radius - cfg.thickness / 2
            );
        }

        function resize() {
            state.width = el.offsetWidth;
            state.height = el.offsetHeight;
            state.dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.max(1, Math.round((state.width + BLEED * 2) * state.dpr));
            canvas.height = Math.max(1, Math.round((state.height + BLEED * 2) * state.dpr));
            offscreen.width = canvas.width;
            offscreen.height = canvas.height;
            schedule();
        }

        function pointer(e) {
            var rect = el.getBoundingClientRect();
            return [
                (e.clientX - rect.left) * (rect.width ? state.width / rect.width : 1),
                (e.clientY - rect.top) * (rect.height ? state.height / rect.height : 1)
            ];
        }

        function line(x1, y1, x2, y2, width, style, target) {
            var c = target || ctx;
            c.lineWidth = width;
            c.strokeStyle = style;
            c.beginPath();
            c.moveTo(x1, y1);
            c.lineTo(x2, y2);
            c.stroke();
        }

        /* хвост блика: набор коротких отрезков вдоль пути с затуханием */
        function trail(path, from, length, dir, alpha, roundCap) {
            if (length < .5 || alpha <= 0) return;
            var steps = clamp(Math.ceil(length / 2), 2, 90);
            pointAt(path, from, head);
            var px = head.x, py = head.y;
            for (var i = 1; i <= steps; i++) {
                pointAt(path, from - dir * length * (i / steps), head);
                var t = 1 - (i - .5) / steps;
                var w = t * t * alpha;
                var col = lerpColor(colors.tail, colors.head, t);
                if (!cfg.light) col = lerpColor(col, WHITE, Math.pow(t, 6) * .65);
                ctx.lineCap = (roundCap && i === 1) ? "round" : "butt";
                line(px, py, head.x, head.y, 2 + 6 * cfg.glow, rgba(col, w * (cfg.light ? .1 : .2) * cfg.glow));
                line(px, py, head.x, head.y, cfg.thickness, rgba(col, w));
                px = head.x;
                py = head.y;
            }
        }

        /* свечение головы + искры */
        function headGlow(x, y, alpha, twinkle) {
            if (alpha <= 0) return;
            var radius = (12 + 40 * cfg.glow) * (cfg.light ? .6 : 1);
            var g = ctx.createRadialGradient(x, y, 0, x, y, radius);
            var peak = (cfg.light ? .08 : .4) * cfg.glow * alpha;
            g.addColorStop(0, rgba(colors.head, peak));
            g.addColorStop(.2, rgba(colors.head, peak * .4));
            g.addColorStop(.5, rgba(colors.head, peak * .1));
            g.addColorStop(1, rgba(colors.head, 0));
            ctx.fillStyle = g;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

            if (!cfg.sparkle) return;
            var r2 = (1 + cfg.thickness * .6) * (cfg.light ? .85 : 1);
            var g2 = ctx.createRadialGradient(x, y, 0, x, y, r2 * 2.2);
            g2.addColorStop(0, rgba(cfg.light ? colors.head : WHITE, alpha));
            g2.addColorStop(cfg.light ? .3 : .4, rgba(cfg.light ? colors.head : lerpColor(colors.head, WHITE, .5), alpha * .9));
            g2.addColorStop(cfg.light ? .55 : 1, rgba(colors.head, cfg.light ? alpha * .12 : 0));
            g2.addColorStop(1, rgba(colors.head, 0));
            ctx.fillStyle = g2;
            ctx.beginPath();
            ctx.arc(x, y, r2 * 2.2, 0, TAU);
            ctx.fill();

            var arm = (3 + 4 * cfg.glow + cfg.thickness * 1.5) * twinkle;
            var mid = cfg.light ? colors.head : WHITE;
            var lg = ctx.createLinearGradient(x - arm, y, x + arm, y);
            lg.addColorStop(0, rgba(colors.head, 0));
            lg.addColorStop(.5, rgba(mid, alpha * .95));
            lg.addColorStop(1, rgba(colors.head, 0));
            line(x - arm, y, x + arm, y, cfg.light ? .75 : 1, lg);

            var vg = ctx.createLinearGradient(x, y - arm, x, y + arm);
            vg.addColorStop(0, rgba(colors.head, 0));
            vg.addColorStop(.5, rgba(mid, alpha * .95));
            vg.addColorStop(1, rgba(colors.head, 0));
            line(x, y - arm, x, y + arm, cfg.light ? .75 : 1, vg);
        }

        function spawnSparks(x, y, nx, ny, motion) {
            if (sparks.length > 48) return;
            var speed = 3 + Math.random() * 10;
            var spread = (Math.random() - .5) * 8;
            sparks.push({
                x: x + nx * (Math.random() * 3 - 1),
                y: y + ny * (Math.random() * 3 - 1),
                vx: nx * speed - ny * spread - motion * -ny * .04,
                vy: ny * speed + nx * spread - motion * nx * .04,
                age: 0,
                life: .35 + Math.random() * .5,
                size: .45 + Math.random() * .7,
                seed: Math.random() * TAU
            });
        }

        function draw(path) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (state.width < 2 || state.height < 2) return;

            var offset = (BLEED + cfg.thickness / 2) * state.dpr;
            ctx.setTransform(state.dpr, 0, 0, state.dpr, offset, offset);
            ctx.globalCompositeOperation = cfg.light ? "source-over" : "lighter";
            ctx.lineCap = "butt";

            var total = path.total;
            var perStar = total / cfg.stars;
            var motionAbs = Math.abs(state.motion);
            var dir = state.motion >= 0 ? 1 : -1;
            var trailMax = cfg.trailLength * cfg.duration;
            var trailLen = Math.min(motionAbs * trailMax, perStar * .92, total * .6);
            var revealAlpha = state.reveal * (1 + .4 * state.boost + .6 * state.flash);

            var flashAlpha = state.flash * (cfg.light ? .18 : .32) + state.boost * state.reveal * (cfg.light ? .07 : .12);
            if (flashAlpha > .005) {
                ctx.lineWidth = cfg.thickness + 2 * cfg.glow;
                ctx.strokeStyle = rgba(colors.head, flashAlpha);
                ctx.beginPath();
                ctx.roundRect(0, 0, Math.max(1, state.width - cfg.thickness), Math.max(1, state.height - cfg.thickness), Math.max(0, path.r));
                ctx.stroke();
            }

            var fade = clamp(1 - motionAbs / Math.max(1, total / cfg.duration * .6), 0, 1) * Math.min(1, revealAlpha);
            var headLen = (10 + 14 * cfg.glow + cfg.thickness * 2) * fade;

            for (var i = 0; i < cfg.stars; i++) {
                var pos = state.phase + i * perStar;
                trail(path, pos, trailLen, dir, Math.min(1, revealAlpha));
                if (fade > .01) {
                    trail(path, pos, headLen, 1, fade, false);
                    trail(path, pos, headLen, -1, fade, false);
                }
            }

            pulses.forEach(function (p) {
                var a = Math.pow(1 - p.age / .65, 2);
                var dist = total / 2 * (1 - Math.pow(1 - Math.min(1, p.age / .5), 2));
                var len = Math.min(dist, total * .16);
                [1, -1].forEach(function (d) {
                    trail(path, p.origin + d * dist, len, d, a);
                    pointAt(path, p.origin + d * dist, head);
                    headGlow(head.x, head.y, a * .8, .8);
                });
            });

            for (var j = 0; j < cfg.stars; j++) {
                pointAt(path, state.phase + j * perStar, head);
                var twinkle = .82 + .18 * Math.sin(state.time * 6.1 + j * 2.3) * Math.sin(state.time * 2.7 + j);
                headGlow(head.x, head.y, Math.min(1.3, revealAlpha), twinkle);
            }

            sparks.forEach(function (s) {
                var life = 1 - s.age / s.life;
                var flick = .45 + .55 * Math.sin(state.time * 20 + s.seed);
                var a = life * flick * state.reveal * (cfg.light ? .35 : .9);
                if (a <= .01) return;
                ctx.fillStyle = rgba(cfg.light ? colors.head : lerpColor(colors.tail, WHITE, .6), a);
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size * (.6 + .4 * life), 0, TAU);
                ctx.fill();
            });
        }

        function frame(now) {
            raf = 0;
            if (!alive) return;

            var dt = Math.min(.05, Math.max(.001, (now - lastTime) / 1000));
            lastTime = now;
            state.time += dt;

            var key = cfg.color + "|" + cfg.trailColor;
            if (key !== colors.key) {
                colors.key = key;
                colors.head = parseColor(cfg.color);
                colors.tail = parseColor(cfg.trailColor);
            }

            var path = metrics();
            var total = path.total;
            var perStar = total / cfg.stars;
            var active = state.hovered || state.focused;
            var baseSpeed = (reduced || cfg.paused) ? 0 : cfg.direction * total / cfg.duration;

            if (cfg.paused) { state.velocity = 0; state.lap = -1; }

            var revealTarget = (cfg.hover === "reveal" && !active) ? 0 : 1;
            state.reveal += (revealTarget - state.reveal) * (1 - Math.exp(-dt / (revealTarget > state.reveal ? .16 : .45)));

            var boostTarget = (cfg.hover === "brighten" && active) ? 1 : 0;
            state.boost += (boostTarget - state.boost) * (1 - Math.exp(-dt / (boostTarget > state.boost ? .18 : .5)));

            state.flash *= Math.exp(-dt / .22);
            state.velocity += (baseSpeed - state.velocity) * (1 - Math.exp(-dt / .45));

            var extra = 0;
            if (state.lap >= 0) {
                var before = easeInOut(Math.min(1, state.lap / LAP));
                state.lap += dt;
                extra = (easeInOut(Math.min(1, state.lap / LAP)) - before) * total * cfg.direction;
                if (state.lap >= LAP) state.lap = -1;
            }

            state.motion = state.velocity + extra / dt;
            state.phase = mod(state.phase + state.velocity * dt + extra, total);

            for (var p = pulses.length - 1; p >= 0; p--) {
                pulses[p].age += dt;
                if (pulses[p].age >= .65) pulses.splice(p, 1);
            }
            for (var s = sparks.length - 1; s >= 0; s--) {
                var sp = sparks[s];
                sp.age += dt;
                sp.x += sp.vx * dt;
                sp.y += sp.vy * dt;
                sp.vx *= Math.exp(-dt * 2.2);
                sp.vy *= Math.exp(-dt * 2.2);
                if (sp.age >= sp.life) sparks.splice(s, 1);
            }

            draw(path);

            var settling = Math.abs(revealTarget - state.reveal) > .002 ||
                Math.abs(boostTarget - state.boost) > .002 ||
                state.flash > .01 || pulses.length > 0 || sparks.length > 0;
            var moving = Math.abs(state.motion) > .05 || state.velocity !== 0 || state.lap >= 0;
            var lit = state.reveal > .002 || revealTarget > 0;

            if (state.visible && (settling || (moving && lit) || state.hovered)) {
                raf = requestAnimationFrame(frame);
            }
        }

        function schedule() {
            if (raf || !alive || !state.visible) return;
            lastTime = performance.now();
            raf = requestAnimationFrame(frame);
        }

        /* ---------- события ---------- */
        function onEnter(e) {
            var pt = pointer(e);
            state.pointerX = pt[0];
            state.pointerY = pt[1];
            state.hovered = true;

            if (cfg.hover === "reveal" && state.reveal < .15) {
                var path = metrics();
                state.phase = nearestOnPath(path, state.pointerX - cfg.thickness / 2, state.pointerY - cfg.thickness / 2);
                state.velocity = 0;
            }
            if (cfg.hover === "lap" && state.lap < 0 && !reduced && !cfg.paused) state.lap = 0;
            schedule();
        }

        function onLeave() { state.hovered = false; schedule(); }

        function pulse(origin) {
            pulses.push({ origin: origin, age: 0 });
            if (pulses.length > 4) pulses.shift();
            state.flash = 1;
            schedule();
        }

        function onPointerDown(e) {
            if (e.button !== 0 && e.pointerType === "mouse") return;
            var pt = pointer(e);
            var path = metrics();
            pulse(nearestOnPath(path, pt[0] - cfg.thickness / 2, pt[1] - cfg.thickness / 2));
        }

        function onClick(e) {
            if (e.detail === 0) pulse(state.phase);   // активация с клавиатуры
        }

        function onFocus() {
            state.focused = el.matches(":focus-visible");
            if (state.focused && cfg.hover === "lap" && state.lap < 0 && !reduced && !cfg.paused) state.lap = 0;
            schedule();
        }

        function onBlur() { state.focused = false; schedule(); }

        el.addEventListener("pointerenter", onEnter);
        el.addEventListener("pointerleave", onLeave);
        el.addEventListener("pointerdown", onPointerDown);
        el.addEventListener("click", onClick);
        el.addEventListener("focus", onFocus);
        el.addEventListener("blur", onBlur);

        var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
        if (ro) ro.observe(el);

        var io = window.IntersectionObserver ? new IntersectionObserver(function (entries) {
            state.visible = entries.some(function (x) { return x.isIntersecting; });
            if (state.visible) schedule();
        }) : null;
        if (io) io.observe(el);

        resize();

        var api = {
            element: el,
            canvas: canvas,
            options: cfg,
            refresh: function () { resize(); },
            set: function (patch) { Object.assign(cfg, patch); schedule(); },
            pulse: function () { pulse(state.phase); },
            destroy: function () {
                alive = false;
                cancelAnimationFrame(raf);
                if (ro) ro.disconnect();
                if (io) io.disconnect();
                el.removeEventListener("pointerenter", onEnter);
                el.removeEventListener("pointerleave", onLeave);
                el.removeEventListener("pointerdown", onPointerDown);
                el.removeEventListener("click", onClick);
                el.removeEventListener("focus", onFocus);
                el.removeEventListener("blur", onBlur);
                delete el.__starBorder;
            }
        };
        el.__starBorder = api;
        return api;
    }

    function initAll(options) {
        var nodes = document.querySelectorAll(".star-border");
        var list = [];
        for (var i = 0; i < nodes.length; i++) list.push(init(nodes[i], options));
        return list;
    }

    global.StarBorder = { init: init, initAll: initAll, version: "1.0.0" };
})(window);
