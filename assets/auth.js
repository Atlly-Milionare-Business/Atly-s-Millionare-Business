(function () {
    // Same Supabase project used elsewhere on the site. Real Supabase Auth —
    // replaces the old hardcoded-password check, which shipped a real
    // password in plaintext to every visitor's browser.
    var SUPABASE_URL = 'https://jdwrivizhjtlbizyjmpl.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_J6ZVTn3A08l2H0jHUT4p2A_quON5Dv9';

    var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    async function getSession() {
        var res = await client.auth.getSession();
        return res.data.session || null;
    }

    async function isAuthed() {
        return !!(await getSession());
    }

    async function getAccessToken() {
        var session = await getSession();
        return session ? session.access_token : null;
    }

    async function login(email, password) {
        var res = await client.auth.signInWithPassword({ email: email, password: password });
        return !res.error;
    }

    async function logout() {
        await client.auth.signOut();
    }

    // Point every profile-icon link at the admin page if already signed in,
    // otherwise at the login page.
    async function wireProfileLinks() {
        var authed = await isAuthed();
        document.querySelectorAll('[data-profile-link]').forEach(function (el) {
            el.setAttribute('href', authed ? 'admin.html' : 'login.html');
        });
    }

    window.AltusAuth = {
        client: client,
        isAuthed: isAuthed,
        getAccessToken: getAccessToken,
        login: login,
        logout: logout,
        wireProfileLinks: wireProfileLinks
    };

    document.addEventListener('DOMContentLoaded', wireProfileLinks);
})();
