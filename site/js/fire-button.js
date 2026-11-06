/* Кнопка с огнём.
   Курсор ближе threshold px, но не на кнопке — локальное пламя у ближайшего края,
   тянется к курсору. Курсор на кнопке — мягкий огонь по всему периметру.
   У каждого режима свои настройки: config.flame и config.ring.
   Плавность: мягкое появление, затухающий след кадра и турбулентность частиц.
   Работает только на устройствах с мышью. */

(function () {
    'use strict';

    var MARGIN = 140;
    var TRAIL = 0.12;
    var instances = [];
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    var DEFAULTS = {
        flame: {
            speed: 0.2,
            life: 0.55,
            density: 600,
            size: 1.75,
            sparks: 40,
            glow: 1.5,
            rise: 30,
            threshold: 500,
            fade: 0.6,
            max: 600,
            stretch: 3,
            alpha: 1.5
        },
        ring: {
            speed: 0.4,
            life: 2,
            density: 700,
            size: 1.1,
            sparks: 11,
            glow: 1.4,
            rise: 30,
            max: 460,
            alpha: 1.5,
            stretch: 1.3
        }
    };

    function makeSprite(core, mid) {
        var size = 64;
        var sprite = document.createElement('canvas');
        sprite.width = size;
        sprite.height = size;
        var g = sprite.getContext('2d');
        var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, core);
        grad.addColorStop(0.32, mid);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
        return sprite;
    }

    var SPRITES = {
        hot: makeSprite('rgba(255, 252, 230, 1)', 'rgba(255, 186, 66, .85)'),
        warm: makeSprite('rgba(255, 214, 120, 1)', 'rgba(255, 94, 0, .8)'),
        cool: makeSprite('rgba(255, 120, 30, 1)', 'rgba(178, 18, 0, .7)')
    };

    var SPARK = makeSprite('rgba(255, 250, 225, 1)', 'rgba(255, 170, 60, .9)');

    function setup(root) {
        var canvas = root.querySelector('.fb-canvas');
        var button = root.querySelector('.shiny-btn');
        if (!canvas || !button) {
            return;
        }

        var ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        var config = {
            flame: Object.assign({}, DEFAULTS.flame),
            ring: Object.assign({}, DEFAULTS.ring)
        };

        var self = null;
        var particles = [];
        var mode = 'flame';
        var flameTarget = null;
        var flameSmooth = null;
        var target = 0;
        var power = 0;
        var ringPower = 0;
        var spawnAcc = 0;
        var running = false;
        var rafId = 0;
        var lastTime = 0;
        var lastPointer = null;
        var width = 1;
        var height = 1;
        var shape = { w: 1, h: 1, r: 0 };

        function resize() {
            var rect = canvas.getBoundingClientRect();
            width = Math.max(1, rect.width);
            height = Math.max(1, rect.height);
            var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            var w = Math.round(width * dpr);
            var h = Math.round(height * dpr);
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            shape.w = Math.max(1, width - MARGIN * 2);
            shape.h = Math.max(1, height - MARGIN * 2);
            var radius = parseFloat(getComputedStyle(button).borderTopLeftRadius);
            shape.r = Math.min(Math.max(radius || 0, 0), Math.min(shape.w, shape.h) / 2);
        }

        /* Точка на периметре скруглённого прямоугольника */
        function perimeterPoint() {
            var x = MARGIN;
            var y = MARGIN;
            var w = shape.w;
            var h = shape.h;
            var r = shape.r;
            var straightX = Math.max(0, w - 2 * r);
            var straightY = Math.max(0, h - 2 * r);
            var arc = (Math.PI / 2) * r;
            var total = 2 * straightX + 2 * straightY + 4 * arc;
            var t = Math.random() * total;
            var px;
            var py;
            var nx;
            var ny;
            var offset = 0;

            if (t < straightX) {
                px = x + r + t;
                py = y;
                nx = 0;
                ny = -1;
            } else {
                offset += straightX;
                if (t < offset + arc) {
                    var a1 = -Math.PI / 2 + (t - offset) / r;
                    px = x + w - r + r * Math.cos(a1);
                    py = y + r + r * Math.sin(a1);
                    nx = Math.cos(a1);
                    ny = Math.sin(a1);
                } else {
                    offset += arc;
                    if (t < offset + straightY) {
                        px = x + w;
                        py = y + r + (t - offset);
                        nx = 1;
                        ny = 0;
                    } else {
                        offset += straightY;
                        if (t < offset + arc) {
                            var a2 = (t - offset) / r;
                            px = x + w - r + r * Math.cos(a2);
                            py = y + h - r + r * Math.sin(a2);
                            nx = Math.cos(a2);
                            ny = Math.sin(a2);
                        } else {
                            offset += arc;
                            if (t < offset + straightX) {
                                px = x + w - r - (t - offset);
                                py = y + h;
                                nx = 0;
                                ny = 1;
                            } else {
                                offset += straightX;
                                if (t < offset + arc) {
                                    var a3 = Math.PI / 2 + (t - offset) / r;
                                    px = x + r + r * Math.cos(a3);
                                    py = y + h - r + r * Math.sin(a3);
                                    nx = Math.cos(a3);
                                    ny = Math.sin(a3);
                                } else {
                                    offset += arc;
                                    if (t < offset + straightY) {
                                        px = x;
                                        py = y + h - r - (t - offset);
                                        nx = -1;
                                        ny = 0;
                                    } else {
                                        offset += straightY;
                                        var a4 = Math.PI + (t - offset) / r;
                                        px = x + r + r * Math.cos(a4);
                                        py = y + r + r * Math.sin(a4);
                                        nx = Math.cos(a4);
                                        ny = Math.sin(a4);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return {
                x: px + nx * 1.5,
                y: py + ny * 1.5,
                nx: nx,
                ny: ny
            };
        }

        /* Ближайшая точка периметра к курсору и расстояние до кнопки */
        function nearestPoint(clientX, clientY) {
            var box = button.getBoundingClientRect();
            var px = MARGIN + (clientX - box.left);
            var py = MARGIN + (clientY - box.top);
            var r = shape.r;
            var left = MARGIN + r;
            var right = MARGIN + shape.w - r;
            var top = MARGIN + r;
            var bottom = MARGIN + shape.h - r;
            var cx = Math.min(Math.max(px, left), right);
            var cy = Math.min(Math.max(py, top), bottom);
            var dx = px - cx;
            var dy = py - cy;
            var len = Math.sqrt(dx * dx + dy * dy);
            var nx = 0;
            var ny = -1;

            if (len > 0.001) {
                nx = dx / len;
                ny = dy / len;
            } else {
                var dl = px - MARGIN;
                var dr = MARGIN + shape.w - px;
                var dt = py - MARGIN;
                var db = MARGIN + shape.h - py;
                var min = Math.min(dl, dr, dt, db);
                if (min === dl) {
                    nx = -1;
                    ny = 0;
                } else if (min === dr) {
                    nx = 1;
                    ny = 0;
                } else if (min === dt) {
                    nx = 0;
                    ny = -1;
                } else {
                    nx = 0;
                    ny = 1;
                }
            }

            return {
                distance: len - r,
                x: cx + nx * r + nx * 1.5,
                y: cy + ny * r + ny * 1.5,
                nx: nx,
                ny: ny
            };
        }

        function locate(clientX, clientY) {
            lastPointer = { x: clientX, y: clientY };
            var point = nearestPoint(clientX, clientY);

            if (self) {
                for (var i = 0; i < instances.length; i++) {
                    var other = instances[i];
                    if (other === self) {
                        continue;
                    }
                    if (other.distance(clientX, clientY) < point.distance) {
                        target = 0;
                        mode = 'flame';
                        return;
                    }
                }
            }

            flameTarget = point;

            if (!flameSmooth) {
                flameSmooth = {
                    x: point.x,
                    y: point.y,
                    nx: point.nx,
                    ny: point.ny
                };
            }

            if (point.distance <= 0) {
                mode = 'ring';
                target = 1;
            } else {
                mode = 'flame';
                var proximity = Math.max(0, 1 - point.distance / config.flame.threshold);
                target = Math.pow(proximity, config.flame.fade);
            }

            if (target > 0) {
                start();
            }
        }

        function followPointer(dt) {
            if (!flameTarget || !flameSmooth) {
                return;
            }
            var k = Math.min(1, dt * 12);
            flameSmooth.x += (flameTarget.x - flameSmooth.x) * k;
            flameSmooth.y += (flameTarget.y - flameSmooth.y) * k;
            flameSmooth.nx += (flameTarget.nx - flameSmooth.nx) * k;
            flameSmooth.ny += (flameTarget.ny - flameSmooth.ny) * k;
            var len = Math.sqrt(flameSmooth.nx * flameSmooth.nx + flameSmooth.ny * flameSmooth.ny) || 1;
            flameSmooth.nx /= len;
            flameSmooth.ny /= len;
        }

        function spawnRing() {
            var group = config.ring;
            var point = perimeterPoint();
            var spark = Math.random() < group.sparks / 100;

            if (spark) {
                var sparkAngle = Math.atan2(point.ny, point.nx) + (Math.random() - 0.5) * 1.2;
                var sparkSpeed = (60 + Math.random() * 90) * group.speed;
                particles.push({
                    x: point.x,
                    y: point.y,
                    vx: Math.cos(sparkAngle) * sparkSpeed,
                    vy: Math.sin(sparkAngle) * sparkSpeed,
                    angle: sparkAngle,
                    size: (1.2 + Math.random() * 2) * group.size,
                    alpha: 0.6 + Math.random() * 0.3,
                    phase: Math.random() * Math.PI * 2,
                    wobble: 0,
                    spark: true,
                    ring: true,
                    rise: group.rise,
                    time: 0,
                    life: (0.3 + Math.random() * 0.3) * group.life
                });
                return;
            }

            var angle = Math.atan2(point.ny, point.nx) + (Math.random() - 0.5) * 0.45;
            var speed = (2 + Math.random() * 9) * group.speed;
            var offset = (Math.random() - 0.5) * 12;
            particles.push({
                x: point.x - point.ny * offset + point.nx * Math.random() * 3,
                y: point.y + point.nx * offset + point.ny * Math.random() * 3,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                angle: angle,
                size: (5 + Math.random() * 5) * group.size,
                alpha: 0.14 + Math.random() * 0.12,
                phase: Math.random() * Math.PI * 2,
                wobble: 1.5 + Math.random() * 3,
                spark: false,
                ring: true,
                rise: group.rise,
                time: 0,
                life: (0.7 + Math.random() * 0.6) * group.life
            });
        }

        function spawnFlame() {
            var source = flameSmooth || flameTarget;
            if (!source) {
                return;
            }
            var group = config.flame;
            var tx = -source.ny;
            var ty = source.nx;
            var spark = Math.random() < group.sparks / 100;
            var clock = performance.now() * 0.001;
            var wave = Math.sin(clock * 0.8 + source.x * 0.01) * 0.15;
            var angle = Math.atan2(source.ny, source.nx) + (Math.random() - 0.5) * (spark ? 1.2 : 0.9) + wave;
            var baseSpeed = spark ? 60 + Math.random() * 90 : 30 + Math.random() * 60;
            var speed = baseSpeed * group.speed;
            var offset = (Math.random() - 0.5) * (spark ? 16 : 26);
            particles.push({
                x: source.x + tx * offset + source.nx * Math.random() * 3,
                y: source.y + ty * offset + source.ny * Math.random() * 3,
                vx: Math.cos(angle) * speed + tx * (Math.random() - 0.5) * 14,
                vy: Math.sin(angle) * speed + ty * (Math.random() - 0.5) * 14 - 4,
                angle: angle,
                size: (spark ? 1.2 + Math.random() * 2 : 5 + Math.random() * 7) * group.size,
                alpha: spark ? 0.6 + Math.random() * 0.3 : 0.28 + Math.random() * 0.18,
                phase: Math.random() * Math.PI * 2,
                wobble: spark ? 0 : 4 + Math.random() * 8,
                spark: spark,
                ring: false,
                rise: group.rise,
                time: 0,
                life: (spark ? 0.3 + Math.random() * 0.3 : 0.35 + Math.random() * 0.5) * group.life
            });
        }

        function spawn() {
            if (mode === 'ring') {
                spawnRing();
            } else {
                spawnFlame();
            }
        }

        function update(dt) {
            var clock = performance.now() * 0.001;
            for (var i = particles.length - 1; i >= 0; i--) {
                var p = particles[i];
                p.time += dt;
                if (p.time >= p.life) {
                    particles.splice(i, 1);
                    continue;
                }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vx *= 1 - 2.0 * dt;
                p.vy = p.vy * (1 - 2.0 * dt) - p.rise * dt;

                if (p.wobble) {
                    var wave = Math.sin(clock * 1.6 + p.x * 0.012 + p.y * 0.008);
                    var cross = Math.cos(clock * 1.2 + p.y * 0.011);
                    p.vx += wave * p.wobble * dt;
                    p.vy += cross * p.wobble * dt * 0.7;
                }
            }
        }

        function drawRingGlow() {
            var pulse = 0.94 + 0.06 * Math.sin(performance.now() * 0.0014);
            var fade = Math.pow(ringPower, 0.7) * config.ring.glow * pulse;
            var x = MARGIN;
            var y = MARGIN;
            var w = shape.w;
            var h = shape.h;
            var r = shape.r;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
            ctx.lineWidth = 18;
            ctx.strokeStyle = 'rgba(255, 90, 10, ' + (0.20 * fade) + ')';
            ctx.shadowColor = 'rgba(255, 80, 0, ' + (0.55 * fade) + ')';
            ctx.shadowBlur = 22;
            ctx.stroke();
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(255, 170, 60, ' + (0.32 * fade) + ')';
            ctx.shadowColor = 'rgba(255, 120, 20, ' + (0.4 * fade) + ')';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.restore();
        }

        function drawFlameGlow() {
            var source = flameSmooth || flameTarget;
            if (!source) {
                return;
            }
            var fade = power * (1 - ringPower) * config.flame.glow;
            if (fade <= 0.01) {
                return;
            }
            var pulse = 0.95 + 0.05 * Math.sin(performance.now() * 0.0012);
            var glow = 36 + 26 * power;
            var g = ctx.createRadialGradient(source.x, source.y, 0, source.x, source.y, glow);
            g.addColorStop(0, 'rgba(255, 190, 110, ' + (0.30 * fade * pulse) + ')');
            g.addColorStop(0.45, 'rgba(255, 105, 25, ' + (0.15 * fade * pulse) + ')');
            g.addColorStop(1, 'rgba(255, 80, 0, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(source.x - glow, source.y - glow, glow * 2, glow * 2);
        }

        function draw() {
            /* Мягкий след: не стираем кадр полностью, а гасим предыдущий */
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0, 0, 0, ' + TRAIL + ')';
            ctx.fillRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'lighter';

            if (ringPower > 0.01) {
                drawRingGlow();
            }
            if (mode === 'flame') {
                drawFlameGlow();
            }

            var baseFade = Math.pow(power, 0.6);
            var flameAlpha = baseFade * config.flame.alpha;
            var ringAlpha = baseFade * config.ring.alpha;

            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                var k = p.time / p.life;
                var inK = Math.min(1, k / (p.spark ? 0.06 : 0.2));
                var fade = Math.pow(1 - k, 1.4) * inK * (p.ring ? ringAlpha : flameAlpha);

                if (p.spark) {
                    var sparkSize = p.size * 3;
                    ctx.globalAlpha = p.alpha * fade;
                    ctx.drawImage(SPARK, p.x - sparkSize / 2, p.y - sparkSize / 2, sparkSize, sparkSize);
                    continue;
                }

                var size = p.size * (1 + k * (p.ring ? 0.4 : 0.6)) * 2;
                var sprite = k < 0.32 ? SPRITES.hot : (k < 0.7 ? SPRITES.warm : SPRITES.cool);
                ctx.save();
                ctx.translate(p.x, p.y);
                if (p.ring) {
                    ctx.scale(config.ring.stretch, 1);
                } else {
                    ctx.rotate(p.angle);
                    ctx.scale(config.flame.stretch, 1);
                }
                ctx.globalAlpha = p.alpha * fade;
                ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
                ctx.restore();
            }

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }

        function frame(now) {
            rafId = 0;
            var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
            lastTime = now;

            followPointer(dt);

            var ease = mode === 'ring' ? 3.5 : 8;
            power += (target - power) * Math.min(1, dt * ease);
            ringPower += ((mode === 'ring' ? 1 : 0) - ringPower) * Math.min(1, dt * 3.5);

            if (power < 0.004 && ringPower < 0.004 && particles.length === 0) {
                running = false;
                ctx.clearRect(0, 0, width, height);
                return;
            }

            if (power > 0.01) {
                var group = mode === 'ring' ? config.ring : config.flame;
                var rate = mode === 'ring' ? group.density : group.density * Math.max(0.4, power);
                spawnAcc += rate * dt;
                while (spawnAcc >= 1) {
                    spawnAcc -= 1;
                    if (particles.length < group.max) {
                        spawn();
                    }
                }
            }

            update(dt);
            draw();
            rafId = requestAnimationFrame(frame);
        }

        function start() {
            if (running || !finePointer.matches || reduceMotion.matches) {
                return;
            }
            running = true;
            lastTime = 0;
            rafId = requestAnimationFrame(frame);
        }

        function clear() {
            target = 0;
            mode = 'flame';
        }

        function onMove(event) {
            if (event.pointerType === 'touch') {
                return;
            }
            locate(event.clientX, event.clientY);
        }

        function onScroll() {
            if (lastPointer) {
                locate(lastPointer.x, lastPointer.y);
            }
        }

        function setConfig(next) {
            if (!next) {
                return;
            }
            ['flame', 'ring'].forEach(function (group) {
                var values = next[group];
                if (!values) {
                    return;
                }
                Object.keys(values).forEach(function (key) {
                    var value = Number(values[key]);
                    if (key in config[group] && isFinite(value)) {
                        config[group][key] = value;
                    }
                });
            });
            if (lastPointer) {
                locate(lastPointer.x, lastPointer.y);
            }
        }

        resize();
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', function () {
            resize();
            if (lastPointer) {
                locate(lastPointer.x, lastPointer.y);
            }
        });
        window.addEventListener('blur', clear);
        document.addEventListener('pointerleave', clear);

        if (typeof ResizeObserver === 'function') {
            new ResizeObserver(resize).observe(canvas);
        }

        self = {
            distance: function (clientX, clientY) {
                return nearestPoint(clientX, clientY).distance;
            },
            locate: locate
        };
        instances.push(self);

        root.fireButton = {
            getConfig: function () {
                return {
                    flame: Object.assign({}, config.flame),
                    ring: Object.assign({}, config.ring)
                };
            },
            setConfig: setConfig
        };
    }

    function init() {
        if (!finePointer.matches || reduceMotion.matches) {
            return;
        }
        var roots = document.querySelectorAll('[data-fire-button]');
        for (var i = 0; i < roots.length; i++) {
            setup(roots[i]);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
