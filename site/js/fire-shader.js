/* «Живой огонь» — WebGL-шейдер из демо theme-variant.framer.ai (Framer, Animated BG).
   Оригинал — один фрагментный шейдер: шум + закручивание, три цвета и параметры.
   Здесь сохранены те же значения: оранжевый низ, красные языки, чёрный верх.
   Композиция привязана к эталонному окну 816×442 и не меняется при других размерах.

   Разметка: <canvas data-fire-shader></canvas>
   Параметры (необязательно): data-speed, data-color1, data-color2, data-color3. */

(function () {
    'use strict';

    /* --- эталон из демо: 816×442, u_scale = 0.52 --- */
    var REF_HEIGHT = 442;
    var REF_SCALE = 0.52;
    var NOISE_BASE = 0.0005;
    var NOISE_K = 0.006;
    var REF_NOISE = NOISE_BASE + NOISE_K * REF_SCALE;

    var VERTEX_SRC = [
        'attribute vec2 a_position;',
        'void main() {',
        '    gl_Position = vec4(a_position, 0.0, 1.0);',
        '}'
    ].join('\n');

    var FRAGMENT_SRC = [
        '#ifdef GL_FRAGMENT_PRECISION_HIGH',
        'precision highp float;',
        '#else',
        'precision mediump float;',
        '#endif',
        '',
        'uniform float u_time;',
        'uniform float u_pixelRatio;',
        'uniform vec2 u_resolution;',
        '',
        'uniform float u_scale;',
        'uniform float u_rotation;',
        'uniform vec4 u_color1;',
        'uniform vec4 u_color2;',
        'uniform vec4 u_color3;',
        'uniform float u_proportion;',
        'uniform float u_softness;',
        'uniform float u_shape;',
        'uniform float u_shapeScale;',
        'uniform float u_distortion;',
        'uniform float u_swirl;',
        'uniform float u_swirlIterations;',
        '',
        '#define TWO_PI 6.28318530718',
        '#define PI 3.14159265358979323846',
        '',
        'vec2 rotate(vec2 uv, float th) {',
        '    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;',
        '}',
        '',
        'float random(vec2 st) {',
        '    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);',
        '}',
        '',
        'float noise(vec2 st) {',
        '    vec2 i = floor(st);',
        '    vec2 f = fract(st);',
        '    float a = random(i);',
        '    float b = random(i + vec2(1.0, 0.0));',
        '    float c = random(i + vec2(0.0, 1.0));',
        '    float d = random(i + vec2(1.0, 1.0));',
        '',
        '    vec2 u = f * f * (3.0 - 2.0 * f);',
        '',
        '    float x1 = mix(a, b, u.x);',
        '    float x2 = mix(c, d, u.x);',
        '    return mix(x1, x2, u.y);',
        '}',
        '',
        'vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {',
        '    vec3 color1 = c1.rgb * c1.a;',
        '    vec3 color2 = c2.rgb * c2.a;',
        '    vec3 color3 = c3.rgb * c3.a;',
        '',
        '    float r1 = smoothstep(.0 + .35 * edgesWidth, .7 - .35 * edgesWidth + .5 * edge_blur, mixer);',
        '    float r2 = smoothstep(.3 + .35 * edgesWidth, 1. - .35 * edgesWidth + edge_blur, mixer);',
        '',
        '    vec3 blended_color_2 = mix(color1, color2, r1);',
        '    float blended_opacity_2 = mix(c1.a, c2.a, r1);',
        '',
        '    vec3 c = mix(blended_color_2, color3, r2);',
        '    float o = mix(blended_opacity_2, c3.a, r2);',
        '    return vec4(c, o);',
        '}',
        '',
        'void main() {',
        '    vec2 uv = gl_FragCoord.xy / u_resolution.xy;',
        '    vec2 uv_original = uv;',
        '',
        '    float t = .5 * u_time;',
        '',
        '    float noise_scale = .0005 + .006 * u_scale;',
        '',
        '    uv -= .5;',
        '    uv *= (noise_scale * u_resolution);',
        '    uv = rotate(uv, u_rotation * .5 * PI);',
        '    uv /= u_pixelRatio;',
        '    uv += .5;',
        '',
        '    float n1 = noise(uv * 1. + t);',
        '    float n2 = noise(uv * 2. - t);',
        '    float angle = n1 * TWO_PI;',
        '    uv.x += 4. * u_distortion * n2 * cos(angle);',
        '    uv.y += 4. * u_distortion * n2 * sin(angle);',
        '',
        '    float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));',
        '    for (float i = 1.; i <= 30.; i++) {',
        '        if (i > iterations_number) { break; }',
        '        uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);',
        '        uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);',
        '    }',
        '',
        '    float proportion = clamp(u_proportion, 0., 1.);',
        '',
        '    float shape = 0.;',
        '    float mixer = 0.;',
        '    if (u_shape < .5) {',
        '      vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);',
        '      shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);',
        '      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);',
        '    } else if (u_shape < 1.5) {',
        '      vec2 stripes_shape_uv = uv * (.25 + 3. * u_shapeScale);',
        '      float f = fract(stripes_shape_uv.y);',
        '      shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);',
        '      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);',
        '    } else {',
        '      float sh = 1. - uv.y;',
        '      sh -= .5;',
        '      sh /= (noise_scale * u_resolution.y);',
        '      sh += .5;',
        '      float shape_scaling = .2 * (1. - u_shapeScale);',
        '      shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));',
        '      mixer = shape;',
        '    }',
        '',
        '    vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale);',
        '',
        '    gl_FragColor = vec4(color_mix.rgb, color_mix.a);',
        '}'
    ].join('\n');

    var DEFAULTS = {
        color1: '#FF9F21',
        color2: '#FF0303',
        color3: '#000000',
        rotation: 1.9896753472735356,
        proportion: 1,
        softness: 1,
        shape: 2,
        shapeScale: 0.12,
        distortion: 0.14,
        swirl: 0.18,
        swirlIterations: 20,
        speed: 1,
        stillTime: 16
    };

    function hexToRgba(hex) {
        var s = String(hex || '').replace('#', '').trim();
        if (s.length === 3) {
            s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
        }
        var n = parseInt(s, 16);
        if (!isFinite(n)) {
            return [0, 0, 0, 1];
        }
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
    }

    function compile(gl, type, src) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function createProgram(gl) {
        var vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
        var fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
        if (!vs || !fs) {
            return null;
        }
        var program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    function mount(canvas) {
        if (!canvas || canvas.fireShader) {
            return canvas ? canvas.fireShader || null : null;
        }

        var options = {};
        Object.keys(DEFAULTS).forEach(function (key) {
            options[key] = DEFAULTS[key];
        });
        if (canvas.dataset.speed) {
            options.speed = parseFloat(canvas.dataset.speed) || options.speed;
        }
        ['color1', 'color2', 'color3'].forEach(function (key) {
            if (canvas.dataset[key]) {
                options[key] = canvas.dataset[key];
            }
        });

        var gl = canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        });
        if (!gl) {
            canvas.classList.add('is-fire-off');
            return null;
        }

        var program = createProgram(gl);
        if (!program) {
            canvas.classList.add('is-fire-off');
            return null;
        }

        gl.useProgram(program);

        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        var positionLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        var uniforms = {};
        [
            'u_time', 'u_pixelRatio', 'u_resolution', 'u_scale', 'u_rotation',
            'u_color1', 'u_color2', 'u_color3', 'u_proportion', 'u_softness',
            'u_shape', 'u_shapeScale', 'u_distortion', 'u_swirl', 'u_swirlIterations'
        ].forEach(function (name) {
            uniforms[name] = gl.getUniformLocation(program, name);
        });

        var color1 = hexToRgba(options.color1);
        var color2 = hexToRgba(options.color2);
        var color3 = hexToRgba(options.color3);

        var reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        var speed = options.speed;
        var elapsed = 0;
        var startedAt = 0;
        var rafId = 0;
        var running = false;
        var userForced = false;
        var userPaused = false;
        var inView = true;
        var width = 1;
        var height = 1;
        var lost = false;

        function paint() {
            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.enableVertexAttribArray(positionLoc);
            gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

            /* Резолюция в CSS-пикселях, pixelRatio = 1: так композиция
               совпадает с оригиналом на экранах любой плотности. */
            var noise = REF_NOISE * (REF_HEIGHT / Math.max(height, 1));
            var scale = Math.min(Math.max((noise - NOISE_BASE) / NOISE_K, 0.02), 4);

            gl.uniform1f(uniforms.u_time, elapsed);
            gl.uniform1f(uniforms.u_pixelRatio, 1);
            gl.uniform2f(uniforms.u_resolution, width, height);
            gl.uniform1f(uniforms.u_scale, scale);
            gl.uniform1f(uniforms.u_rotation, options.rotation);
            gl.uniform4fv(uniforms.u_color1, color1);
            gl.uniform4fv(uniforms.u_color2, color2);
            gl.uniform4fv(uniforms.u_color3, color3);
            gl.uniform1f(uniforms.u_proportion, options.proportion);
            gl.uniform1f(uniforms.u_softness, options.softness);
            gl.uniform1f(uniforms.u_shape, options.shape);
            gl.uniform1f(uniforms.u_shapeScale, options.shapeScale);
            gl.uniform1f(uniforms.u_distortion, options.distortion);
            gl.uniform1f(uniforms.u_swirl, options.swirl);
            gl.uniform1f(uniforms.u_swirlIterations, options.swirlIterations);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        function resize() {
            var rect = canvas.getBoundingClientRect();
            width = Math.max(1, rect.width);
            height = Math.max(1, rect.height);

            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            var bw = Math.max(1, Math.round(width * dpr));
            var bh = Math.max(1, Math.round(height * dpr));
            var cap = 1600 * 1000;
            if (bw * bh > cap) {
                var k = Math.sqrt(cap / (bw * bh));
                bw = Math.max(1, Math.round(bw * k));
                bh = Math.max(1, Math.round(bh * k));
            }
            if (canvas.width !== bw || canvas.height !== bh) {
                canvas.width = bw;
                canvas.height = bh;
            }
            gl.viewport(0, 0, bw, bh);
            paint();
        }

        function tick(now) {
            if (!running) {
                return;
            }
            if (!startedAt) {
                startedAt = now - (elapsed / (speed || 1)) * 1000;
            }
            elapsed = ((now - startedAt) / 1000) * (speed || 1);
            paint();
            rafId = window.requestAnimationFrame(tick);
        }

        function start() {
            if (running || lost || !inView || document.hidden) {
                return;
            }
            running = true;
            startedAt = 0;
            rafId = window.requestAnimationFrame(tick);
            canvas.dispatchEvent(new CustomEvent('firestate', { bubbles: true, detail: { playing: true } }));
        }

        function pause() {
            if (!running) {
                return;
            }
            running = false;
            window.cancelAnimationFrame(rafId);
            rafId = 0;
            canvas.dispatchEvent(new CustomEvent('firestate', { bubbles: true, detail: { playing: false } }));
        }

        function sync() {
            if (!userPaused && inView && !document.hidden && (!reducedQuery.matches || userForced)) {
                start();
            } else {
                pause();
            }
        }

        var observer = null;
        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver(function (entries) {
                inView = entries[0].isIntersecting;
                sync();
            }, { threshold: 0 });
            observer.observe(canvas);
        }

        document.addEventListener('visibilitychange', sync);
        if (reducedQuery.addEventListener) {
            reducedQuery.addEventListener('change', sync);
        } else if (reducedQuery.addListener) {
            reducedQuery.addListener(sync);
        }

        var resizeObserver = null;
        if (typeof ResizeObserver === 'function') {
            resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(canvas);
        } else {
            window.addEventListener('resize', resize);
        }

        canvas.addEventListener('webglcontextlost', function (event) {
            event.preventDefault();
            lost = true;
            pause();
        });
        canvas.addEventListener('webglcontextrestored', function () {
            lost = false;
            resize();
            sync();
        });

        resize();

        if (reducedQuery.matches) {
            elapsed = options.stillTime;
            paint();
        } else {
            start();
        }

        var api = {
            play: function () {
                userForced = true;
                userPaused = false;
                start();
            },
            pause: function () {
                userPaused = true;
                pause();
            },
            isPlaying: function () {
                return running;
            },
            setSpeed: function (value) {
                speed = parseFloat(value) || 1;
            },
            seek: function (value) {
                elapsed = parseFloat(value) || 0;
                startedAt = 0;
                paint();
            },
            destroy: function () {
                pause();
                if (observer) {
                    observer.disconnect();
                }
                if (resizeObserver) {
                    resizeObserver.disconnect();
                }
                document.removeEventListener('visibilitychange', sync);
                window.removeEventListener('resize', resize);
                delete canvas.fireShader;
            }
        };

        canvas.fireShader = api;

        return api;
    }

    window.FireShader = { mount: mount };

    function init() {
        var nodes = document.querySelectorAll('[data-fire-shader]');
        for (var i = 0; i < nodes.length; i++) {
            mount(nodes[i]);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
