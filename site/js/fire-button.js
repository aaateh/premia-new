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
    var FLAME_TRAIL = 0.32;
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

    function makeTongue() {
        var w = 128;
        var h = 256;
        var sprite = document.createElement('canvas');
        sprite.width = w;
        sprite.height = h;
        var g = sprite.getContext('2d');
        var baseY = h - 8;
        var cx = w / 2;

        var grad = g.createLinearGradient(0, baseY, 0, 8);
        grad.addColorStop(0, 'rgba(255, 140, 30, 0)');
        grad.addColorStop(0.18, 'rgba(255, 140, 30, .22)');
        grad.addColorStop(0.46, 'rgba(255, 185, 70, .72)');
        grad.addColorStop(0.7, 'rgba(255, 90, 0, .24)');
        grad.addColorStop(0.9, 'rgba(255, 50, 0, .08)');
        grad.addColorStop(1, 'rgba(255, 40, 0, 0)');

        g.fillStyle = grad;
        g.shadowColor = 'rgba(255, 120, 30, .6)';
        g.shadowBlur = 4;
        g.beginPath();
        g.moveTo(cx, 8);
        g.bezierCurveTo(cx + 40, h * 0.4, cx + 50, baseY - 10, cx, baseY);
        g.bezierCurveTo(cx - 50, baseY - 10, cx - 40, h * 0.4, cx, 8);
        g.closePath();
        g.fill();

        return sprite;
    }

    var TONGUE = makeTongue();

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

        var ringCanvas = document.createElement('canvas');
        ringCanvas.className = 'fb-canvas fb-canvas--ring';
        ringCanvas.setAttribute('aria-hidden', 'true');
        canvas.parentNode.insertBefore(ringCanvas, canvas.nextSibling);
        var ringCtx = ringCanvas.getContext('2d');
        if (!ringCtx) {
            ringCanvas.remove();
            return;
        }
        ringCanvas.width = 1;
        ringCanvas.height = 1;

        var config = {
            flame: Object.assign({}, DEFAULTS.flame),
            ring: Object.assign({}, DEFAULTS.ring)
        };

        var self = null;
        var flameParticles = [];
        var ringParticles = [];
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
        var touchActive = false;
        var touchRing = false;
        var touchUntil = 0;
        var width = 1;
        var height = 1;
        var rendered = false;
        var shape = { w: 1, h: 1, r: 0 };

        function isVisible(el) {
            if (el.closest('details:not([open])')) {
                return false;
            }
            if (el.checkVisibility) {
                return el.checkVisibility({ checkVisibilityCSS: true });
            }
            return !!el.offsetWidth && !!el.offsetHeight;
        }

        function resize() {
            var rect = canvas.getBoundingClientRect();
            rendered = rect.width > 2 && rect.height > 2 && isVisible(button);
            if (!rendered) {
                target = 0;
                mode = 'flame';
            }
            width = Math.max(1, rect.width);
            height = Math.max(1, rect.height);
            var dpr = Math.min(window.devicePixelRatio || 1, finePointer.matches ? 1.5 : 1.25);
            var w = Math.round(width * dpr);
            var h = Math.round(height * dpr);
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
            if (ringCanvas.width !== w || ringCanvas.height !== h) {
                ringCanvas.width = w;
                ringCanvas.height = h;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ringCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

            shape.w = Math.max(1, width - MARGIN * 2);
            shape.h = Math.max(1, height - MARGIN * 2);
            var radius = parseFloat(getComputedStyle(button).borderTopLeftRadius);
            shape.r = Math.min(Math.max(radius || 0, 0), Math.min(shape.w, shape.h) / 2);
        }

        /* Точка на периметре скруглённого прямоугольника */
        function perimeterLength() {
            var w = shape.w;
            var h = shape.h;
            var r = shape.r;
            var straightX = Math.max(0, w - 2 * r);
            var straightY = Math.max(0, h - 2 * r);
            var arc = (Math.PI / 2) * r;
            return 2 * straightX + 2 * straightY + 4 * arc;
        }

        function pointAtDistance(distance) {
            var x = MARGIN;
            var y = MARGIN;
            var w = shape.w;
            var h = shape.h;
            var r = shape.r;
            var straightX = Math.max(0, w - 2 * r);
            var straightY = Math.max(0, h - 2 * r);
            var arc = (Math.PI / 2) * r;
            var total = 2 * straightX + 2 * straightY + 4 * arc;
            var t = ((distance % total) + total) % total;
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

        function perimeterAt(normalized) {
            return pointAtDistance(normalized * perimeterLength());
        }

        function perimeterPoint() {
            return pointAtDistance(Math.random() * perimeterLength());
        }

        /* Нормированный параметр ближайшей точки контура */
        function nearestParam(x, y) {
            var samples = 120;
            var bestT = 0;
            var bestD = Infinity;
            for (var i = 0; i < samples; i++) {
                var p = perimeterAt(i / samples);
                var dx = p.x - x;
                var dy = p.y - y;
                var d = dx * dx + dy * dy;
                if (d < bestD) {
                    bestD = d;
                    bestT = i / samples;
                }
            }
            var step = 1 / samples;
            for (var k = 0; k < 2; k++) {
                step *= 0.4;
                for (var j = -2; j <= 2; j++) {
                    var q = perimeterAt(bestT + j * step);
                    var qx = q.x - x;
                    var qy = q.y - y;
                    var qd = qx * qx + qy * qy;
                    if (qd < bestD) {
                        bestD = qd;
                        bestT += j * step;
                    }
                }
            }
            return ((bestT % 1) + 1) % 1;
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
            if (!rendered) {
                target = 0;
                mode = 'flame';
                return;
            }
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

            var nextMode = point.distance <= 0 ? 'ring' : 'flame';
            if (nextMode !== mode) {
                fadeParticles(mode === 'ring');
                mode = nextMode;
            }

            if (point.distance <= 0) {
                target = 0;
            } else {
                var proximity = Math.max(0, 1 - point.distance / config.flame.threshold);
                target = Math.pow(proximity, config.flame.fade);
            }

            if (target > 0 || mode === 'ring') {
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
                ringParticles.push({
                    x: point.x,
                    y: point.y,
                    vx: Math.cos(sparkAngle) * sparkSpeed,
                    vy: Math.sin(sparkAngle) * sparkSpeed,
                    angle: sparkAngle,
                    size: (0.5 + Math.random() * 1) * group.size,
                    alpha: 0.45 + Math.random() * 0.35,
                    phase: Math.random() * Math.PI * 2,
                    wobble: 0,
                    spark: true,
                    ring: true,
                    taper: 1,
                    rise: group.rise,
                    time: 0,
                    life: (0.22 + Math.random() * 0.26) * group.life
                });
                return;
            }

            var angle = Math.atan2(point.ny, point.nx) + (Math.random() - 0.5) * 0.45;
            var speed = (2 + Math.random() * 9) * group.speed;
            var offset = (Math.random() - 0.5) * 12;
            ringParticles.push({
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
                taper: 1,
                rise: group.rise,
                time: 0,
                life: (0.7 + Math.random() * 0.6) * group.life
            });
        }

        function spawnFlame() {
            var group = config.flame;
            if (Math.random() >= (group.sparks / 100) * 0.12) {
                return;
            }
            var spot = flameSmooth || flameTarget;
            if (!spot) {
                return;
            }
            var total = perimeterLength();
            var strip = Math.min(total * 0.44, 50 * (group.size / 1.75));
            var tx = -spot.ny;
            var ty = spot.nx;
            var along = (Math.random() - 0.5) * strip;
            var out = (18 + Math.random() * 52) * Math.max(0.45, group.stretch / 3);
            var angle = Math.atan2(spot.ny, spot.nx) + (Math.random() - 0.5) * 1.2;
            var speed = (40 + Math.random() * 70) * group.speed;
            flameParticles.push({
                x: spot.x + tx * along + spot.nx * out,
                y: spot.y + ty * along + spot.ny * out,
                vx: Math.cos(angle) * speed + tx * (Math.random() - 0.5) * 6,
                vy: Math.sin(angle) * speed + ty * (Math.random() - 0.5) * 6 - 4,
                angle: angle,
                size: (0.5 + Math.random() * 1) * group.size,
                alpha: 0.45 + Math.random() * 0.35,
                phase: Math.random() * Math.PI * 2,
                wobble: 0,
                spark: true,
                ring: false,
                taper: 1,
                rise: group.rise,
                time: 0,
                life: (0.22 + Math.random() * 0.26) * group.life
            });
        }

        function spawn() {
            if (mode === 'ring') {
                spawnRing();
            } else {
                spawnFlame();
            }
        }

        function updateList(list, dt, clock) {
            for (var i = list.length - 1; i >= 0; i--) {
                var p = list[i];
                p.time += dt;
                if (p.time >= p.life) {
                    list.splice(i, 1);
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

                if (!p.ring && !p.spark) {
                    p.angle = Math.atan2(p.vy, p.vx);
                }
            }
        }

        function update(dt) {
            var clock = performance.now() * 0.001;
            updateList(flameParticles, dt, clock);
            updateList(ringParticles, dt, clock);
        }

        function drawRingGlow(target) {
            var pulse = 0.94 + 0.06 * Math.sin(performance.now() * 0.0014);
            var fade = Math.pow(ringPower, 0.7) * config.ring.glow * pulse;
            var x = MARGIN;
            var y = MARGIN;
            var w = shape.w;
            var h = shape.h;
            var r = shape.r;

            target.save();
            target.beginPath();
            target.moveTo(x + r, y);
            target.arcTo(x + w, y, x + w, y + h, r);
            target.arcTo(x + w, y + h, x, y + h, r);
            target.arcTo(x, y + h, x, y, r);
            target.arcTo(x, y, x + w, y, r);
            target.closePath();
            target.lineWidth = 18;
            target.strokeStyle = 'rgba(255, 90, 10, ' + (0.20 * fade) + ')';
            target.shadowColor = 'rgba(255, 80, 0, ' + (0.55 * fade) + ')';
            target.shadowBlur = 22;
            target.stroke();
            target.lineWidth = 4;
            target.strokeStyle = 'rgba(255, 170, 60, ' + (0.32 * fade) + ')';
            target.shadowColor = 'rgba(255, 120, 20, ' + (0.4 * fade) + ')';
            target.shadowBlur = 10;
            target.stroke();
            target.restore();
        }

        function drawFlameGlow(target) {
            var fade = power * config.flame.glow;
            if (fade <= 0.01 || !flameSmooth) {
                return;
            }
            var total = perimeterLength();
            if (total <= 0) {
                return;
            }
            var sizeScale = config.flame.size / 1.75;
            var half = Math.min(total * 0.22, (50 * sizeScale) / 2) / total;
            var t0 = nearestParam(flameSmooth.x, flameSmooth.y);
            var a = perimeterAt(t0 - half);
            var b = perimeterAt(t0 + half);
            var steps = 18;

            target.save();
            target.beginPath();
            for (var i = 0; i <= steps; i++) {
                var p = perimeterAt(t0 - half + (i / steps) * half * 2);
                if (i === 0) {
                    target.moveTo(p.x, p.y);
                } else {
                    target.lineTo(p.x, p.y);
                }
            }
            target.lineCap = 'round';
            target.lineJoin = 'round';

            var outer = target.createLinearGradient(a.x, a.y, b.x, b.y);
            outer.addColorStop(0, 'rgba(255, 100, 20, 0)');
            outer.addColorStop(0.3, 'rgba(255, 100, 20, ' + (0.075 * fade) + ')');
            outer.addColorStop(0.7, 'rgba(255, 110, 25, ' + (0.075 * fade) + ')');
            outer.addColorStop(1, 'rgba(255, 100, 20, 0)');
            target.lineWidth = 9;
            target.strokeStyle = outer;
            target.shadowColor = 'rgba(255, 80, 0, ' + (0.26 * fade) + ')';
            target.shadowBlur = 15;
            target.stroke();

            var inner = target.createLinearGradient(a.x, a.y, b.x, b.y);
            inner.addColorStop(0, 'rgba(255, 190, 90, 0)');
            inner.addColorStop(0.35, 'rgba(255, 190, 90, ' + (0.13 * fade) + ')');
            inner.addColorStop(0.65, 'rgba(255, 190, 90, ' + (0.13 * fade) + ')');
            inner.addColorStop(1, 'rgba(255, 190, 90, 0)');
            target.lineWidth = 2;
            target.strokeStyle = inner;
            target.shadowColor = 'rgba(255, 140, 30, ' + (0.22 * fade) + ')';
            target.shadowBlur = 6;
            target.stroke();
            target.restore();
        }

        function flameNoise(t, seed) {
            return 0.5
                + 0.24 * Math.sin(t * 1.15 + seed * 1.7)
                + 0.16 * Math.sin(t * 2.31 + seed * 3.1)
                + 0.1 * Math.sin(t * 4.07 + seed * 5.3);
        }

        function drawProceduralFlame(now) {
            var group = config.flame;
            var total = perimeterLength();
            if (total <= 0 || !flameSmooth) {
                return;
            }

            var sizeScale = group.size / 1.75;
            var half = Math.min(total * 0.22, (50 * sizeScale) / 2) / total;
            var t0 = nearestParam(flameSmooth.x, flameSmooth.y);
            var count = Math.max(5, Math.min(11, Math.round(5 + group.density / 90)));
            var time = now * 0.001 * (0.2 + group.speed * 1.4);
            var lengthScale = Math.pow(group.stretch / 3, 1.25) * (0.75 + 0.25 * sizeScale);
            var alphaBase = Math.pow(power, 0.6) * group.alpha * 0.085;
            var lift = (group.rise / 30) * 0.9;

            for (var i = 0; i < count; i++) {
                var u = count === 1 ? 0 : i / (count - 1) - 0.5;
                var env = Math.pow(Math.cos(u * Math.PI), 0.7);
                var seed = i * 1.37 + 0.5;
                var sway = (flameNoise(time * 0.55 + 7, seed * 1.3) - 0.5) * (half * 2 / count) * 0.5;
                var p = perimeterAt(t0 + u * half * 2 + sway);
                var n1 = flameNoise(time, seed);
                var n2 = flameNoise(time * 0.83 + 11, seed * 1.7);
                var n3 = flameNoise(time * 1.21 + 23, seed * 2.3);

                /* Верх длиннее низа: низ идёт по кромке, а не прямой линией */
                var vertical = (1 - p.ny) * 0.5;
                var length = (22 + 88 * n1) * lengthScale * (0.8 + 0.26 * vertical) * (0.55 + 0.45 * env) + 12;
                var tongueWidth = (7 + 13 * n2) * sizeScale * (0.8 + 0.3 * vertical) * (0.75 + 0.25 * env);
                /* Основание чуть уходит под кромку, чтобы языки росли из неё */
                var base = -3 - (flameNoise(time * 0.7 + 3, seed * 2.1) - 0.5) * 6;

                /* Нормаль контура плюс подъём: бока загибаются вверх, низ остаётся у края */
                var dirX = p.nx;
                var dirY = p.ny - lift;
                var angle = Math.atan2(dirY, dirX) + (n3 - 0.5) * 0.6 + (flameNoise(time * 0.4, seed * 0.9) - 0.5) * 0.4;

                ctx.save();
                ctx.translate(p.x + p.nx * base, p.y + p.ny * base);
                ctx.rotate(angle + Math.PI / 2);

                /* Мягкое тело пламени: заполняет промежутки, даёт объём */
                ctx.globalAlpha = alphaBase * 0.3 * (0.5 + 0.5 * n1) * (0.3 + 0.7 * env);
                ctx.drawImage(TONGUE, -tongueWidth * 1.15, -length * 1.05, tongueWidth * 2.3, length * 1.12);

                /* Яркий язык */
                ctx.globalAlpha = alphaBase * (0.5 + 0.5 * n1) * (0.72 + 0.28 * vertical) * (0.3 + 0.7 * env);
                ctx.drawImage(TONGUE, -tongueWidth / 2, -length, tongueWidth, length);
                ctx.restore();
            }
        }

        function drawRingLayer() {
            ringCtx.globalCompositeOperation = 'destination-out';
            ringCtx.fillStyle = 'rgba(0, 0, 0, ' + TRAIL + ')';
            ringCtx.fillRect(0, 0, width, height);
            ringCtx.globalCompositeOperation = 'lighter';

            if (ringPower > 0.01) {
                drawRingGlow(ringCtx);
            }

            var alphaBase = Math.pow(ringPower, 0.6) * config.ring.alpha;

            for (var i = 0; i < ringParticles.length; i++) {
                var p = ringParticles[i];
                var k = p.time / p.life;
                var inK = Math.min(1, k / (p.spark ? 0.06 : 0.2));
                var fade = Math.pow(1 - k, 1.4) * inK * alphaBase;

                if (p.spark) {
                    var sparkSize = p.size * 3;
                    ringCtx.globalAlpha = p.alpha * fade;
                    ringCtx.drawImage(SPARK, p.x - sparkSize / 2, p.y - sparkSize / 2, sparkSize, sparkSize);
                    continue;
                }

                var size = p.size * (1 + k * 0.4) * 2;
                var sprite = k < 0.32 ? SPRITES.hot : (k < 0.7 ? SPRITES.warm : SPRITES.cool);
                ringCtx.save();
                ringCtx.translate(p.x, p.y);
                ringCtx.scale(config.ring.stretch, 1);
                ringCtx.globalAlpha = p.alpha * fade;
                ringCtx.drawImage(sprite, -size / 2, -size / 2, size, size);
                ringCtx.restore();
            }

            ringCtx.globalAlpha = 1;
            ringCtx.globalCompositeOperation = 'source-over';
        }

        function drawFlameLayer() {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0, 0, 0, ' + FLAME_TRAIL + ')';
            ctx.fillRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'lighter';

            if (power > 0.01) {
                drawFlameGlow(ctx);
                drawProceduralFlame(performance.now());
            }

            var alphaBase = Math.pow(power, 0.6) * config.flame.alpha;

            for (var i = 0; i < flameParticles.length; i++) {
                var p = flameParticles[i];
                var k = p.time / p.life;
                var inK = Math.min(1, k / (p.spark ? 0.06 : 0.2));
                var fade = Math.pow(1 - k, 1.4) * inK * alphaBase;

                if (p.spark) {
                    var sparkSize = p.size * 2.2;
                    ctx.globalAlpha = p.alpha * fade;
                    ctx.drawImage(SPARK, p.x - sparkSize / 2, p.y - sparkSize / 2, sparkSize, sparkSize);
                    continue;
                }

                var pWidth = p.size * 2.6 * (1 - k * 0.35) * (p.taper || 1);
                var pHeight = Math.min(pWidth * config.flame.stretch * (0.65 + k * 0.7), 130);
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle + Math.PI / 2);
                ctx.globalAlpha = p.alpha * fade;
                ctx.drawImage(TONGUE, -pWidth / 2, -pHeight, pWidth, pHeight);
                ctx.restore();
            }

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }

        function draw() {
            drawRingLayer();
            drawFlameLayer();
        }

        function frame(now) {
            rafId = 0;
            var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
            lastTime = now;

            followPointer(dt);

            if (touchActive) {
                if (now < touchUntil) {
                    target = touchRing ? 0 : 1;
                    mode = touchRing ? 'ring' : 'flame';
                } else {
                    touchActive = false;
                    target = 0;
                    mode = 'flame';
                    setLit(false);
                }
            }

            var flameEase = mode === 'ring' ? 8 : (target > 0 ? 8 : 2.2);
            power += (target - power) * Math.min(1, dt * flameEase);
            ringPower += ((mode === 'ring' ? 1 : 0) - ringPower) * Math.min(1, dt * 3.5);

            if (power < 0.004 && ringPower < 0.004 && flameParticles.length === 0 && ringParticles.length === 0) {
                running = false;
                ctx.clearRect(0, 0, width, height);
                ringCtx.clearRect(0, 0, width, height);
                return;
            }

            if (mode === 'ring' && ringPower > 0.01) {
                spawnAcc += config.ring.density * dt;
                while (spawnAcc >= 1) {
                    spawnAcc -= 1;
                    if (ringParticles.length < config.ring.max) {
                        spawnRing();
                    }
                }
            } else if (mode === 'flame' && target > 0 && power > 0.01) {
                var rate = config.flame.density * Math.max(0.4, power);
                spawnAcc += rate * dt;
                while (spawnAcc >= 1) {
                    spawnAcc -= 1;
                    if (flameParticles.length < config.flame.max) {
                        spawnFlame();
                    }
                }
            }

            update(dt);
            draw();

            /* Неактивный слой не должен оставлять следов */
            if (mode === 'ring' && power < 0.01) {
                ctx.clearRect(0, 0, width, height);
            }
            if (mode === 'flame' && ringPower < 0.01) {
                ringCtx.clearRect(0, 0, width, height);
            }

            rafId = requestAnimationFrame(frame);
        }

        function start() {
            if (running || reduceMotion.matches) {
                return;
            }
            running = true;
            lastTime = 0;
            rafId = requestAnimationFrame(frame);
        }

        function clear() {
            target = 0;
            mode = 'flame';
            touchActive = false;
            touchRing = false;
            setLit(false);
        }

        function onMove(event) {
            if (event.pointerType === 'touch') {
                return;
            }
            touchActive = false;
            setLit(false);
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

        function fadeParticles(ring) {
            var list = ring ? ringParticles : flameParticles;
            for (var i = 0; i < list.length; i++) {
                list[i].life = Math.min(list[i].life, list[i].time + 0.7);
            }
        }

        function setLit(on) {
            button.classList.toggle('is-lit', !!on);
        }

        function isButtonVisible() {
            var rect = button.getBoundingClientRect();
            return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
        }

        function onTouch(event) {
            if (reduceMotion.matches || !isButtonVisible()) {
                return;
            }
            var touch = event.touches && event.touches[0];
            if (!touch) {
                return;
            }
            var point = nearestPoint(touch.clientX, touch.clientY);

            if (self) {
                for (var i = 0; i < instances.length; i++) {
                    var other = instances[i];
                    if (other === self) {
                        continue;
                    }
                    if (other.distance(touch.clientX, touch.clientY) < point.distance) {
                        touchActive = false;
                        target = 0;
                        setLit(false);
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
            touchRing = point.distance <= 0;
            var nextMode = touchRing ? 'ring' : 'flame';
            if (nextMode !== mode) {
                fadeParticles(mode === 'ring');
                mode = nextMode;
            }
            setLit(touchRing);
            touchActive = true;
            touchUntil = performance.now() + 8000;
            start();
        }

        resize();
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('touchstart', onTouch, { passive: true });
        window.addEventListener('touchmove', onTouch, { passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', function () {
            resize();
            if (lastPointer) {
                locate(lastPointer.x, lastPointer.y);
            }
        });
        window.addEventListener('blur', clear);
        document.addEventListener('pointerleave', function (event) {
            if (event.pointerType === 'touch') {
                return;
            }
            clear();
        });

        if (typeof ResizeObserver === 'function') {
            new ResizeObserver(resize).observe(canvas);
        }

        var details = button.closest('details');
        if (details) {
            details.addEventListener('toggle', resize);
        }

        self = {
            distance: function (clientX, clientY) {
                return rendered ? nearestPoint(clientX, clientY).distance : Infinity;
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
            setConfig: setConfig,
            getState: function () {
                return {
                    mode: mode,
                    touchActive: touchActive,
                    touchRing: touchRing,
                    power: power,
                    ringPower: ringPower,
                    particles: flameParticles.length + ringParticles.length,
                    flameParticles: flameParticles.length,
                    ringParticles: ringParticles.length
                };
            }
        };
    }

    function init() {
        if (reduceMotion.matches) {
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
