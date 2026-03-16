// app init and routing
const App = {
    init() {
        const token = localStorage.getItem('bernet_token');
        const user = api.getLocalUser();

        if (token && user) {
            // already logged in - redirect to chat
            if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/web/' || window.location.pathname === '/web') {
                window.location.href = '/web/chat.html';
                return;
            }
            this.initChat(token, user);
        } else {
            // not logged in - redirect to login
            if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/web/' && window.location.pathname !== '/web') {
                window.location.href = '/web/';
                return;
            }
            this.initLogin();
        }
    },

    initLogin() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const showRegister = document.getElementById('showRegister');
        const showLogin = document.getElementById('showLogin');

        if (showRegister) {
            showRegister.addEventListener('click', (e) => {
                e.preventDefault();
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
            });
        }
        if (showLogin) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                registerForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
            });
        }


        const loginSubmit = document.getElementById('loginSubmit');
        if (loginSubmit) {
            loginSubmit.addEventListener('click', () => this.handleLogin());

            document.querySelectorAll('#loginForm input').forEach(inp => {
                inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleLogin(); });
            });
        }


        const registerSubmit = document.getElementById('registerSubmit');
        if (registerSubmit) {
            registerSubmit.addEventListener('click', () => this.handleRegister());
            document.querySelectorAll('#registerForm input').forEach(inp => {
                inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleRegister(); });
            });
        }
    },

    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');
        const btn = document.getElementById('loginSubmit');

        if (!username || !password) {
            errorEl.textContent = 'Заполните все поля';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<div class="spinner spinner-sm"></div> Вход...';
        errorEl.textContent = '';

        try {
            const data = await api.login(username, password);
            // save password for key decryption
            sessionStorage.setItem('bernet_pw', password);
            window.location.href = '/web/chat.html';
        } catch (e) {
            errorEl.textContent = e.message || 'Ошибка входа';
            btn.disabled = false;
            btn.textContent = 'Войти';
        }
    },

    async handleRegister() {
        const username = document.getElementById('regUsername').value.trim();
        const password = document.getElementById('regPassword').value;
        const firstName = document.getElementById('regFirstName').value.trim();
        const lastName = document.getElementById('regLastName').value.trim();
        const errorEl = document.getElementById('registerError');
        const btn = document.getElementById('registerSubmit');

        if (!username || !password || !firstName) {
            errorEl.textContent = 'Заполните обязательные поля';
            return;
        }
        if (password.length < 4) {
            errorEl.textContent = 'Пароль минимум 4 символа';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<div class="spinner spinner-sm"></div> Регистрация...';
        errorEl.textContent = '';

        try {
            await api.register(username, password, firstName, lastName);
            // save password for key decryption
            sessionStorage.setItem('bernet_pw', password);
            window.location.href = '/web/chat.html';
        } catch (e) {
            errorEl.textContent = e.message || 'Ошибка регистрации';
            btn.disabled = false;
            btn.textContent = 'Создать аккаунт';
        }
    },

    async initChat(token, user) {
        // connect websocket
        ws.connect(token);

        // init encryption
        const pw = sessionStorage.getItem('bernet_pw');
        if (pw) {
            try {
                await Crypto.init(user.id, pw);
                console.log('[App] E2E encryption ready');
            } catch (e) {
                console.error('[App] Crypto init failed:', e);
            }
        } else {
            // no password in session - need to re-login
            console.warn('[App] No password in session — redirecting to login');
            api.clearToken();
            window.location.href = '/web/';
            return;
        }


        const userNameEl = document.getElementById('currentUserName');
        if (userNameEl) userNameEl.textContent = `${user.first_name || user.username}`;


        Chat.init(user);
    }
};

// start
document.addEventListener('DOMContentLoaded', () => App.init());
