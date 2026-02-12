(function () {
    'use strict';

    // Элементы
    const camera = document.getElementById('camera');
    const snapshotCanvas = document.getElementById('snapshot-canvas');
    const snapshotImg = document.getElementById('snapshot-img');
    const overlayImg = document.getElementById('overlay-img');
    const gallery = document.getElementById('gallery');
    const captureBtn = document.getElementById('capture-btn');
    const slider = document.getElementById('slider');
    const sliderLine = document.getElementById('slider-line');
    const sliderHandle = document.getElementById('slider-handle');
    const resetBtn = document.getElementById('reset-btn');
    const thumbs = document.querySelectorAll('.thumb');

    let stream = null;
    let currentSrc = null;
    let isCompareMode = false;
    let sliderX = 0.5; // 0..1

    // ===== Камера =====

    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });
            camera.srcObject = stream;
            camera.play();
        } catch (err) {
            console.warn('Камера недоступна:', err);
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(function (t) { t.stop(); });
            stream = null;
        }
        camera.srcObject = null;
    }

    // ===== Галерея =====

    thumbs.forEach(function (thumb) {
        thumb.addEventListener('click', function () {
            if (isCompareMode) return;

            var src = thumb.getAttribute('data-src');

            // Если уже выбрано это фото — снимаем выбор
            if (currentSrc === src) {
                currentSrc = null;
                overlayImg.className = '';
                overlayImg.removeAttribute('src');
                thumbs.forEach(function (t) { t.classList.remove('active'); });
                captureBtn.classList.add('hidden');
                return;
            }

            currentSrc = src;

            // Подсвечиваем активную миниатюру
            thumbs.forEach(function (t) { t.classList.remove('active'); });
            thumb.classList.add('active');

            // Показываем overlay
            overlayImg.src = src;
            overlayImg.className = 'preview';

            // Показываем кнопку съёмки
            captureBtn.classList.remove('hidden');
        });
    });

    // ===== Съёмка =====

    captureBtn.addEventListener('click', function () {
        if (!currentSrc || isCompareMode) return;

        // Делаем снимок
        var vw = camera.videoWidth;
        var vh = camera.videoHeight;
        snapshotCanvas.width = vw;
        snapshotCanvas.height = vh;
        var ctx = snapshotCanvas.getContext('2d');
        ctx.drawImage(camera, 0, 0, vw, vh);

        var dataUrl = snapshotCanvas.toDataURL('image/jpeg', 0.92);
        snapshotImg.src = dataUrl;

        // Переход в режим сравнения
        enterCompareMode();
    });

    // ===== Режим сравнения =====

    function enterCompareMode() {
        isCompareMode = true;

        // Скрываем камеру
        camera.classList.add('hidden');

        // Показываем снимок
        snapshotImg.classList.add('visible');

        // Overlay на полную непрозрачность
        overlayImg.className = 'compare';

        // Скрываем галерею и кнопку съёмки
        gallery.classList.add('hidden');
        captureBtn.classList.add('hidden');

        // Показываем слайдер и кнопку сброса
        slider.classList.remove('hidden');
        resetBtn.classList.remove('hidden');

        // Устанавливаем слайдер по центру
        sliderX = 0.5;
        updateSlider();
    }

    function exitCompareMode() {
        isCompareMode = false;

        // Убираем снимок
        snapshotImg.classList.remove('visible');
        snapshotImg.removeAttribute('src');

        // Скрываем слайдер и кнопку сброса
        slider.classList.add('hidden');
        resetBtn.classList.add('hidden');

        // Показываем камеру
        camera.classList.remove('hidden');

        // Overlay возвращаем в preview
        overlayImg.className = 'preview';
        overlayImg.style.clipPath = '';

        // Показываем галерею
        gallery.classList.remove('hidden');

        // Показываем кнопку съёмки (если есть выбранное фото)
        if (currentSrc) {
            captureBtn.classList.remove('hidden');
        }

        // Перезапускаем камеру если нужно
        if (!stream) {
            startCamera();
        }
    }

    // ===== Слайдер =====

    function updateSlider() {
        var pct = (sliderX * 100).toFixed(2) + '%';

        sliderLine.style.left = pct;
        sliderHandle.style.left = pct;

        overlayImg.style.clipPath = 'inset(0 ' + ((1 - sliderX) * 100).toFixed(2) + '% 0 0)';
    }

    function getSliderXFromEvent(e) {
        var clientX;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }
        var rect = slider.getBoundingClientRect();
        var x = (clientX - rect.left) / rect.width;
        return Math.max(0, Math.min(1, x));
    }

    slider.addEventListener('touchstart', function (e) {
        e.preventDefault();
        sliderX = getSliderXFromEvent(e);
        updateSlider();
    }, { passive: false });

    slider.addEventListener('touchmove', function (e) {
        e.preventDefault();
        sliderX = getSliderXFromEvent(e);
        updateSlider();
    }, { passive: false });

    slider.addEventListener('mousedown', function (e) {
        sliderX = getSliderXFromEvent(e);
        updateSlider();

        function onMove(ev) {
            sliderX = getSliderXFromEvent(ev);
            updateSlider();
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    // ===== Сброс =====

    resetBtn.addEventListener('click', function () {
        exitCompareMode();
    });

    // ===== Скрыть кнопку съёмки по умолчанию =====

    captureBtn.classList.add('hidden');

    // ===== Запуск =====

    startCamera();

})();
