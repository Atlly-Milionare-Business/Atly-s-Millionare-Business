(function () {
    var KEY = 'altus_stock';

    // Starting stock, used only until the admin sets real numbers.
    var DEFAULTS = { 1: 10, 2: 10, 3: 10 };

    function getAll() {
        try {
            var stock = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (stock && typeof stock === 'object') return stock;
        } catch (e) {}
        return Object.assign({}, DEFAULTS);
    }

    function saveAll(stock) {
        try {
            localStorage.setItem(KEY, JSON.stringify(stock));
        } catch (e) {}
    }

    function getStock(id) {
        var stock = getAll();
        var qty = stock[id];
        return typeof qty === 'number' && !isNaN(qty) ? qty : (DEFAULTS[id] || 0);
    }

    function setStock(id, qty) {
        var stock = getAll();
        stock[id] = Math.max(0, parseInt(qty, 10) || 0);
        saveAll(stock);
    }

    function isSoldOut(id) {
        return getStock(id) <= 0;
    }

    window.AltusInventory = {
        getAll: getAll,
        getStock: getStock,
        setStock: setStock,
        isSoldOut: isSoldOut
    };
})();
