(function () {
    var KEY = 'altus_cart_items';

    function getItems() {
        try {
            var items = JSON.parse(localStorage.getItem(KEY) || '[]');
            return Array.isArray(items) ? items : [];
        } catch (e) {
            return [];
        }
    }

    function saveItems(items) {
        try {
            localStorage.setItem(KEY, JSON.stringify(items));
        } catch (e) {}
        renderBadge();
    }

    function getCount() {
        return getItems().reduce(function (sum, item) { return sum + item.qty; }, 0);
    }

    function getSubtotal() {
        return getItems().reduce(function (sum, item) { return sum + item.qty * item.price; }, 0);
    }

    function addItem(item) {
        var items = getItems();
        var existing = items.find(function (i) {
            return i.id === item.id && i.color === item.color && i.size === item.size;
        });
        if (existing) {
            existing.qty += item.qty;
        } else {
            items.push(item);
        }
        saveItems(items);
    }

    function updateQty(index, qty) {
        var items = getItems();
        if (!items[index]) return;
        items[index].qty = Math.max(1, qty);
        saveItems(items);
    }

    function removeItem(index) {
        var items = getItems();
        items.splice(index, 1);
        saveItems(items);
    }

    function renderBadge() {
        var n = getCount();
        document.querySelectorAll('[data-cart-count]').forEach(function (el) {
            el.textContent = n;
        });
        document.querySelectorAll('[data-cart-badge]').forEach(function (el) {
            el.textContent = n;
            el.classList.toggle('hidden', n === 0);
        });
    }

    window.AltusCart = {
        getItems: getItems,
        addItem: addItem,
        updateQty: updateQty,
        removeItem: removeItem,
        getCount: getCount,
        getSubtotal: getSubtotal,
        renderBadge: renderBadge
    };

    document.addEventListener('DOMContentLoaded', renderBadge);
})();
