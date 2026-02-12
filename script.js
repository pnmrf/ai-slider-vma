(function () {
    'use strict';

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
    var rightPanel = document.getElementById('right-panel');

    var opacitySlider = document.getElementById('opacity-slider');
    var opacityTrack = document.getElementById('opacity-track');
    var opacityFill = document.getElementById('opacity-fill');
    var opacityHandle = document.getElementById('opacity-handle');

    var stream = null;
    var currentSrc = null;
    var isCompareMode = false;
    var sliderX = 0.5;

    // Прозрачность: ползунок вверху = 0.10, внизу = 0.90
    // По умолчанию 0.45 (середина)
    var opacityValue = 0.45;

    // ===== Камера =====

    function startCamera() {
        navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        }).then(function (s) {
            stream = s;
            camera.srcObject = stream;
            camera.play();
        }).catch(function (err) {
            console.warn('Камера недоступна:', err);
        });
    }

    // ===== Ползунок прозрачности =====

    function updateOpacityUI() {
        // norm: 0 = верх (opacity 0.10), 1 = низ (opacity 0.90)
        var norm = (opacityValue - 0.10) / 0.80;
        norm = Math.max(0, Math.min(1, norm));

        // bottom в процентах: norm=0 -> bottom=100%, norm=1 -> bottom=0%
        var bottomPct = (1 - norm) * 100;

        opacityHandle.style.bottom = bottomPct + '%';
        opacityFill.style.height = bottomPct + '%';
    }

    function getOpacityFromTouch(e) {
        var clientY;
        if (e.touches && e.touches.length > 0) {
            clientY = e.touches[0].clientY;
        } else {
            clientY = e.clientY;
        }
        var rect = opacityTrack.getBoundingClientRect();
        // norm: 0 вверху, 1 внизу
        var norm = (clientY - rect.top) / rect.height;
        norm = Math.max(0, Math.min(1, norm));
        return 0.10 + norm * 0.80;
    }

    function onOpacityInput(e) {
        opacityValue = getOpacityFromTouch(e);
        updateOpacityUI();
        if (!isCompareMode && currentSrc) {
            overlayImg.style.opacity = opacityValue;
        }
    }

    opacitySlider.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        onOpacityInput(e);
    }, { passive: false });

    opacitySlider.addEventListener('touchmove', function (e) {
        e.preventDefault();
        e.stopPropagation();
        onOpacityInput(e);
    }, { passive: false });

    opacitySlider.addEventListener('mousedown', function (e) {
        e.stopPropagation();
        onOpacityInput(e);
        function onMove(ev) { onOpacityInput(ev); }
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

            // Снять выбор
            if (currentSrc === src) {
                currentSrc = null;
                overlayImg.style.opacity = '0';
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
            overlayImg.style.opacity = opacityValue;

            captureBtn.classList.remove('hidden');
            opacitySlider.classList.remove('hidden');
            updateOpacityUI();
        });
    });

    // ===== Съёмка =====

    captureBtn.addEventListener('click', function () {
        if (!currentSrc || isCompareMode) return;

        var vw = camera.videoWidth;
        var vh = camera.videoHeight;

        if (!vw || !vh) return;

        snapshotCanvas.width = vw;
        snapshotCanvas.height = vh;
        var ctx = snapshotCanvas.getContext('2d');
        ctx.drawImage(camera, 0, 0, vw, vh);

        snapshotImg.src = snapshotCanvas.toDataURL('image/jpeg', 0.92);

        enterCompareMode();
    });

    // ===== Режим сравнения =====

    function enterCompareMode() {
        isCompareMode = true;

        camera.classList.add('hidden');
        snapshotImg.classList.add('visible');

        overlayImg.style.opacity = '1';
        overlayImg.style.clipPath = '';

        gallery.classList.add('hidden');
        captureBtn.classList.add('hidden');
        opacitySlider.classList.add('hidden');
        rightPanel.style.display = 'none';

        slider.classList.remove('hidden');
        topBar.classList.remove('hidden');

        sliderX = 0.5;
        updateCompareSlider();
    }

    function exitCompareMode() {
        isCompareMode = false;

        snapshotImg.classList.remove('visible');
        snapshotImg.removeAttribute('src');

        slider.classList.add('hidden');
        topBar.classList.add('hidden');

        camera.classList.remove('hidden');
        rightPanel.style.display = '';

        overlayImg.style.opacity = opacityValue;
        overlayImg.style.clipPath = '';

        gallery.classList.remove('hidden');

        if (currentSrc) {
            captureBtn.classList.remove('hidden');
            opacitySlider.classList.remove('hidden');
            updateOpacityUI();
        }

        if (!stream) {
            startCamera();
        }
    }

    // ===== Слайдер сравнения =====

    function updateCompareSlider() {
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
        updateCompareSlider();
    }, { passive: false });

    slider.addEventListener('touchmove', function (e) {
        e.preventDefault();
        sliderX = getSliderXFromEvent(e);
        updateCompareSlider();
    }, { passive: false });

    slider.addEventListener('mousedown', function (e) {
        sliderX = getSliderXFromEvent(e);
        updateCompareSlider();
        function onMove(ev) {
            sliderX = getSliderXFromEvent(ev);
            updateCompareSlider();
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

        // Пробуем Web Share API
        if (navigator.share) {
            snapshotCanvas.toBlob(function (blob) {
                if (!blob) {
                    doDownload(dataUrl);
                    return;
                }
                var file = new File([blob], 'rakurs-' + Date.now() + '.jpg', { type: 'image/jpeg' });

                navigator.share({ files: [file] }).catch(function () {
                    doDownload(dataUrl);
                });
            }, 'image/jpeg', 0.92);
        } else {
            doDownload(dataUrl);
        }
    });

    function doDownload(dataUrl) {
        downloadLink.href = dataUrl;
        downloadLink.download = 'rakurs-' + Date.now() + '.jpg';
        downloadLink.click();
    }

    // ===== Запуск =====

    startCamera();

})();
