(function () {
    var previewEl = null;

    function ensurePreview() {
        if (previewEl) return previewEl;
        previewEl = document.createElement('video');
        previewEl.muted = true;
        previewEl.loop = true;
        previewEl.playsInline = true;
        previewEl.preload = 'auto';
        previewEl.style.cssText = 'position:fixed;z-index:9999;width:280px;height:210px;max-width:40vw;' +
            'object-fit:cover;border:2px solid #000;box-shadow:0 8px 24px rgba(0,0,0,0.35);' +
            'pointer-events:none;display:none;background:#000;';
        previewEl.addEventListener('error', function () {
            console.error('video-preview: failed to load', previewEl.currentSrc);
        });
        document.body.appendChild(previewEl);
        return previewEl;
    }

    function positionPreview(x, y) {
        var vid = ensurePreview();
        var vw = window.innerWidth, vh = window.innerHeight;
        var w = vid.offsetWidth || 280, h = vid.offsetHeight || 160;
        var left = x + 16, top = y + 16;
        if (left + w > vw) left = x - w - 16;
        if (top + h > vh) top = y - h - 16;
        vid.style.left = left + 'px';
        vid.style.top = top + 'px';
    }

    function initVideoPreviews() {
        document.querySelectorAll('[data-video-preview]').forEach(function (el) {
            if (el.dataset.videoPreviewBound) return;
            el.dataset.videoPreviewBound = 'true';
            var src = el.getAttribute('data-video-preview');

            el.addEventListener('mouseenter', function (e) {
                var vid = ensurePreview();
                if (vid.getAttribute('src') !== src) {
                    vid.setAttribute('src', src);
                    vid.load();
                }
                vid.style.display = 'block';
                try { vid.currentTime = 0; } catch (err) {}
                vid.play().catch(function () {});
                positionPreview(e.clientX, e.clientY);
            });
            el.addEventListener('mousemove', function (e) {
                positionPreview(e.clientX, e.clientY);
            });
            el.addEventListener('mouseleave', function () {
                if (previewEl) {
                    previewEl.style.display = 'none';
                    previewEl.pause();
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVideoPreviews);
    } else {
        initVideoPreviews();
    }
})();
