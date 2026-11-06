/* Панель настройки огня: две группы — «Вокруг кнопки» и «На кнопке».
   Ползунки меняют эффект на лету, внизу — текст с параметрами для копирования. */

(function () {
    'use strict';

    function init() {
        var panel = document.querySelector('[data-fb-panel]');
        var roots = Array.prototype.slice.call(document.querySelectorAll('[data-fire-button]'))
            .map(function (root) {
                return root.fireButton;
            })
            .filter(Boolean);
        if (!panel) {
            return;
        }

        if (!roots.length) {
            panel.hidden = true;
            return;
        }

        var api = roots[0];

        var inputs = Array.prototype.slice.call(panel.querySelectorAll('input[data-group][data-key]'));
        var textarea = panel.querySelector('[data-fb-output]');
        var status = panel.querySelector('[data-fb-status]');
        var defaults = api.getConfig();
        var tabs = Array.prototype.slice.call(panel.querySelectorAll('[data-fb-tab]'));
        var groups = Array.prototype.slice.call(panel.querySelectorAll('[data-fb-group]'));

        function selectTab(name) {
            tabs.forEach(function (tab) {
                tab.setAttribute('aria-selected', String(tab.dataset.fbTab === name));
            });
            groups.forEach(function (group) {
                group.hidden = group.dataset.fbGroup !== name;
            });
        }

        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                selectTab(tab.dataset.fbTab);
            });
        });

        function read() {
            var values = { flame: {}, ring: {} };
            inputs.forEach(function (input) {
                values[input.dataset.group][input.dataset.key] = parseFloat(input.value);
            });
            return values;
        }

        function format(value) {
            return String(Math.round(value * 100) / 100);
        }

        function render() {
            var values = read();

            inputs.forEach(function (input) {
                var out = panel.querySelector('output[data-out="' + input.dataset.group + '.' + input.dataset.key + '"]');
                if (out) {
                    out.textContent = format(input.value);
                }
            });

            var lines = [];
            ['flame', 'ring'].forEach(function (group) {
                Object.keys(values[group]).forEach(function (key) {
                    lines.push(group + '.' + key + '=' + format(values[group][key]));
                });
            });
            textarea.value = lines.join('\n');

            roots.forEach(function (instance) {
                instance.setConfig(values);
            });
        }

        inputs.forEach(function (input) {
            var group = input.dataset.group;
            var key = input.dataset.key;
            if (defaults[group] && defaults[group][key] !== undefined) {
                input.value = defaults[group][key];
            }
            input.addEventListener('input', render);
        });

        render();

        panel.querySelector('[data-fb-reset]').addEventListener('click', function () {
            inputs.forEach(function (input) {
                input.value = defaults[input.dataset.group][input.dataset.key];
            });
            render();
            status.textContent = 'Вернул исходные параметры';
        });

        panel.querySelector('[data-fb-copy]').addEventListener('click', function () {
            var text = textarea.value;

            function done() {
                status.textContent = 'Скопировано';
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, function () {
                    textarea.select();
                    document.execCommand('copy');
                    done();
                });
            } else {
                textarea.select();
                document.execCommand('copy');
                done();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
