(function () {
    // Same Supabase project already used for Stripe checkout. The stock
    // table is public read/write via RLS — see stock-table.sql. The key
    // below is the public, client-safe anon key, not a secret.
    var SUPABASE_URL = 'https://jdwrivizhjtlbizyjmpl.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_J6ZVTn3A08l2H0jHUT4p2A_quON5Dv9';
    var REST_URL = SUPABASE_URL + '/rest/v1/stock';

    var HEADERS = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
    };

    // Fallback only used if the network/table is unreachable.
    var DEFAULTS = { 1: 10, 2: 10, 3: 10 };

    var cachePromise = null;

    async function fetchAll() {
        var res = await fetch(REST_URL + '?select=product_id,quantity', { headers: HEADERS });
        if (!res.ok) throw new Error('stock fetch failed: ' + res.status);
        var rows = await res.json();
        var stock = {};
        rows.forEach(function (row) { stock[row.product_id] = row.quantity; });
        return stock;
    }

    function getAll() {
        if (!cachePromise) {
            cachePromise = fetchAll().catch(function () {
                return Object.assign({}, DEFAULTS);
            });
        }
        return cachePromise;
    }

    async function getStock(id) {
        var stock = await getAll();
        var qty = stock[id];
        return typeof qty === 'number' && !isNaN(qty) ? qty : (DEFAULTS[id] || 0);
    }

    async function setStock(id, qty) {
        qty = Math.max(0, parseInt(qty, 10) || 0);
        var res = await fetch(REST_URL + '?product_id=eq.' + encodeURIComponent(id), {
            method: 'PATCH',
            headers: Object.assign({ 'Prefer': 'return=minimal' }, HEADERS),
            body: JSON.stringify({ quantity: qty, updated_at: new Date().toISOString() })
        });
        if (!res.ok) throw new Error('stock save failed: ' + res.status);

        var stock = await getAll();
        stock[id] = qty;
    }

    async function isSoldOut(id) {
        return (await getStock(id)) <= 0;
    }

    window.AltusInventory = {
        getAll: getAll,
        getStock: getStock,
        setStock: setStock,
        isSoldOut: isSoldOut
    };
})();
