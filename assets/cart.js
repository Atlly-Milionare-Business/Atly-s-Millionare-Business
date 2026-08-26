(function () {
    function getCount() {
        try {
            return parseInt(localStorage.getItem('altus_cart_count') || '0', 10) || 0;
        } catch (e) {
            return 0;
        }
    }

    function renderBadge() {
        var n = getCount();
        document.querySelectorAll('[data-cart-count]').forEach(function (el) {
            el.textContent = n;
        });
    }

    function add(qty) {
        var n = getCount() + qty;
        try {
            localStorage.setItem('altus_cart_count', String(n));
        } catch (e) {}
        renderBadge();
        return n;
    }

    window.AltusCart = { getCount: getCount, add: add, renderBadge: renderBadge };
    document.addEventListener('DOMContentLoaded', renderBadge);
})();
