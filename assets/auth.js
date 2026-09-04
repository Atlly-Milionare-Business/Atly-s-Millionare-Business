(function () {
    var SESSION_KEY = 'altus_admin_session';
    var VALID_USERNAME = 'atlyliu2009@gmail.com';
    var VALID_PASSWORD = 'yelchington';

    function isAuthed() {
        try {
            return sessionStorage.getItem(SESSION_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function login(username, password) {
        if (username === VALID_USERNAME && password === VALID_PASSWORD) {
            try {
                sessionStorage.setItem(SESSION_KEY, '1');
            } catch (e) {}
            return true;
        }
        return false;
    }

    function logout() {
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch (e) {}
    }

    // Point every profile-icon link at the admin page if already signed in
    // this session, otherwise at the login page.
    function wireProfileLinks() {
        document.querySelectorAll('[data-profile-link]').forEach(function (el) {
            el.setAttribute('href', isAuthed() ? 'admin.html' : 'login.html');
        });
    }

    window.AltusAuth = {
        isAuthed: isAuthed,
        login: login,
        logout: logout,
        wireProfileLinks: wireProfileLinks
    };

    document.addEventListener('DOMContentLoaded', wireProfileLinks);
})();
