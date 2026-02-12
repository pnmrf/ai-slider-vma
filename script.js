(function () {
    'use strict';

    // Элементы
    var camera = document.getElementById('camera');
    var snapshotCanvas = document.getElementById('snapshot-canvas');
    var snapshotImg = document.getElementById('snapshot-img');
    var overlayImg = document.getElementById('overlay-img');
    var gallery = document.getElementById('gallery');
    var captureBtn = document.getElementById('capture-btn');
    var slider = document.getElementById('slider');
    var sliderLine = document.getElementById('slider-line');
    var sliderHandle = document.getElementById('slider-handle');
    var topBar = document.getElementById('top-bar');
    var resetBtn = document.getElementById('reset-btn');
    var saveBtn = document.getElementById('save-btn');
    var downloadLink = document.getElementById('download-link');
    var thumbs = document.querySelectorAll('.thumb');

    // Ползунок прозрачности
    var opacitySlider = document.getElementById('opacity-slider');
    var opacityTrack = document.getElementById('opacity-track');
    var opacityFill = document.getElementById('opacity-fill');
    var opacityHandle = document.getElementById('opacity-handle');

    var stream = null;
    var currentSrc = null;
    var isCompareMode = false;
    var sliderX = 0.5;

    // Прозрачность: 0.10 (верх) .. 0.90 (низ)
    // opacityValue хранит реальную opacity overlay (0.10 .. 0.90)
    // По умолчанию середина = 0.45 (примерно)
    var OPACITY_MIN = 0.10;  // верх ползунка — максимальная прозрачность
    var OPACITY_MAX = 0.90;  // низ ползунка — минимальная прозрачность
    var opacityValue = 0.45;
    // normalised: 0 = верх (min opacity), 1 = низ (max opacity)
    // norm = (opacityValue - OPACITY_MIN) / (OPACITY_MAX - OPACITY_MIN)
    // opacityValue = OPACITY_MIN + norm * (OPACITY_MAX - OPACITY_MIN)

    function opacityToNorm(val) {
        return (val - OPACITY_MIN) / (OPACITY_MAX - OPACITY_MIN);
    }

    function normToOpacity(n) {
        return OPACITY_MIN + n * (OPACITY_MAX - OPACITY_MIN);
    }

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

    // ===== Применить прозрачность к overlay =====

    function applyOverlayOpacity() {
        if (!isCompareMode && overlayImg.classList.contains('preview')) {
            overlayImg.style.opacity = opacityValue;
        }
    }

    // ===== Обновление ползунка прозрачности =====

    function updateOpacitySlider() {
        var norm = opacityToNorm(opacityValue); // 0 = верх, 1 = низ
        var trackHeight = opacityTrack.offsetHeight;
        var pxFromBottom = (1 - norm) * trackHeight;
        // Но ползунок: верх = min opacity (0.10), низ = max opacity (0.90)
        // norm=0 -> handle вверху, norm=1 -> handle внизу
        // handle top offset = norm * trackHeight
        // fill height = (1 - norm) * 100%  — fill снизу показывает «сколько прозрачности»

        var pct = norm * 100;
        var fillPct = (1 - norm) * 100;

        opacityHandle.style.bottom = fillPct + '%';
        opacityFill.style.height = fillPct + '%';
    }

    // ===== Ползунок прозрачности — touch =====

    function getOpacityNormFromEvent(e) {
        var clientY;
        if (e.touches && e.touches.length > 0) {
            clientY = e.touches[0].clientY;
        } else {
            clientY = e.clientY;
        }
        var rect = opacityTrack.getBoundingClientRect();
        // top = 0 (min opacity = 0.10), bottom = 1 (max opacity = 0.90)
        var norm = (clientY - rect.top) / rect.height;
        return Math.max(0, Math.min(1, norm));
    }

    opacitySlider.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var norm = getOpacityNormFromEvent(e);
        opacityValue = normToOpacity(norm);
        updateOpacitySlider();
        applyOverlayOpacity();
    }, { passive: false });

    opacitySlider.addEventListener('touchmove', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var norm = getOpacityNormFromEvent(e);
        opacityValue = normToOpacity(norm);
        updateOpacitySlider();
        applyOverlayOpacity();
    }, { passive: false });

    opacitySlider.addEventListener('mousedown', function (e) {
        e.stopPropagation();
        var norm = getOpacityNormFromEvent(e);
        opacityValue = normToOpacity(norm);
        updateOpacitySlider();
        applyOverlayOpacity();

        function onMove(ev) {
            var n = getOpacityNormFromEvent(ev);
            opacityValue = normToOpacity(n);
            updateOpacitySlider();
            applyOverlayOpacity();
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    // ===== Галерея =====

    thumbs.forEach(function (thumb) {
        thumb.addEventListener('click', function () {
            if (isCompareMode) return;

            var src = thumb.getAttribute('data-src');

            if (currentSrc === src) {
                currentSrc = null;
                overlayImg.className = '';
                overlayImg.style.opacity = '';
                overlayImg.removeAttribute('src');
                thumbs.forEach(function (t) { t.classList.remove('active'); });
                captureBtn.classList.add('hidden');
                opacitySlider.classList.add('hidden');
                return;
            }

            currentSrc = src;

            thumbs.forEach(function (t) { t.classList.remove('active'); });
            thumb.classList.add('active');

            overlayImg.src = src;
            overlayImg.className = 'preview';
            overlayImg.style.opacity = opacityValue;

            captureBtn.classList.remove('hidden');
            opacitySlider.classList.remove('hidden');
            updateOpacitySlider();
        });
    });

    // ===== Съёмка =====

    captureBtn.addEventListener('click', function () {
        if (!currentSrc || isCompareMode) return;

        var vw = camera.videoWidth;
        var vh = camera.videoHeight;
        snapshotCanvas.width = vw;
        snapshotCanvas.height = vh;
        var ctx = snapshotCanvas.getContext('2d');
        ctx.drawImage(camera, 0, 0, vw, vh);

        var dataUrl = snapshotCanvas.toDataURL('image/jpeg', 0.92);
        snapshotImg.src = dataUrl;

        enterCompareMode();
    });

    // ===== Режим сравнения =====

    function enterCompareMode() {
        isCompareMode = true;

        camera.classList.add('hidden');
        snapshotImg.classList.add('visible');

        overlayImg.className = 'compare';
        overlayImg.style.opacity = '';

        gallery.classList.add('hidden');
        captureBtn.classList.add('hidden');
        opacitySlider.classList.add('hidden');

        slider.classList.remove('hidden');
        topBar.classList.remove('hidden');

        sliderX = 0.5;
        updateSlider();
    }

    function exitCompareMode() {
        isCompareMode = false;

        snapshotImg.classList.remove('visible');
        snapshotImg.removeAttribute('src');

        slider.classList.add('hidden');
        topBar.classList.add('hidden');

        camera.classList.remove('hidden');

        overlayImg.className = 'preview';
        overlayImg.style.opacity = opacityValue;
        overlayImg.style.clipPath = '';

        gallery.classList.remove('hidden');

        if (currentSrc) {
            captureBtn.classList.remove('hidden');
            opacitySlider.classList.remove('hidden');
            updateOpacitySlider();
        }

        if (!stream) {
            startCamera();
        }
    }

    // ===== Слайдер сравнения =====

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

    // ===== Сохранить =====

    saveBtn.addEventListener('click', function () {
        var dataUrl = snapshotCanvas.toDataURL('image/jpeg', 0.92);

        // Попытка через share API (мобильные браузеры)
        if (navigator.share && navigator.canShare) {
            snapshotCanvas.toBlob(function (blob) {
                var file = new File([blob], 'rakurs-' + Date.now() + '.jpg', { type: 'image/jpeg' });
                if (navigator.canShare({ files: [file] })) {
                    navigator.share({
                        files: [file],
                        title: 'Ракурс'
                    }).catch(function () {
                        // Если share отменён — fallback на скачивание
                        downloadFile(dataUrl);
                    });
                } else {
                    downloadFile(dataUrl);
                }
            }, 'image/jpeg', 0.92);
        } else {
            downloadFile(dataUrl);
        }
    });

    function downloadFile(dataUrl) {
        downloadLink.href = dataUrl;
        downloadLink.download = 'rakurs-' + Date.now() + '.jpg';
        downloadLink.click();
    }

    // ===== Инициализация =====

    captureBtn.classList.add('hidden');
    opacitySlider.classList.add('hidden');

    // Установить начальное значение ползунка
    updateOpacitySlider();

    startCamera();

})();
