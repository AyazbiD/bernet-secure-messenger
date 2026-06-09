// bernet app - init & routing
const App = {
    // PIN state
    _pinMode: null,     // 'enter' or 'create'
    _pinValue: '',
    _pinConfirm: '',
    _pinStage: 'first', // 'first' or 'second' (for create mode)
    _pinUserId: null,
    _pinPassword: null,  // temp password for key migration

    // check auth & route
    init() {
        const token = localStorage.getItem('bernet_token');
        const user = api.getLocalUser();

        if (token && user) {
            // Already logged in — redirect to chat if on login page
            if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/web/' || window.location.pathname === '/web') {
                window.location.href = '/web/chat.html';
                return;
            }
            this.initChat(token, user);
        } else {
            // Not logged in — redirect to login
            if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/web/' && window.location.pathname !== '/web') {
                window.location.href = '/web/';
                return;
            }
            this.initLogin();
        }
    },

    // init login
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

        // Login submit
        const loginSubmit = document.getElementById('loginSubmit');
        if (loginSubmit) {
            loginSubmit.addEventListener('click', () => this.handleLogin());
            // Enter key
            document.querySelectorAll('#loginForm input').forEach(inp => {
                inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleLogin(); });
            });
        }

        // Register submit
        const registerSubmit = document.getElementById('registerSubmit');
        if (registerSubmit) {
            registerSubmit.addEventListener('click', () => this.handleRegister());
            document.querySelectorAll('#registerForm input').forEach(inp => {
                inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleRegister(); });
            });
        }

        // PIN numpad event listeners
        this.initPinListeners();
    },

    // handle login
    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');
        const btn = document.getElementById('loginSubmit');

        if (!username || !password) {
            errorEl.textContent = I18n.t('pin_too_short') !== 'pin_too_short' ? 'Заполните все поля' : 'Fill all fields';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<div class="spinner spinner-sm"></div> ...';
        errorEl.textContent = '';

        try {
            const data = await api.login(username, password);
            // Store password temporarily for crypto
            this._pinPassword = password;
            this._pinUserId = `${data.user.id}_${data.user.username}`;
            
            // Check if user has keys stored with PIN
            const hasKeys = Crypto.hasKeys(this._pinUserId);
            
            // Show PIN screen
            this.showPinScreen(hasKeys ? 'enter' : 'create');
        } catch (e) {
            errorEl.textContent = e.message || 'Ошибка входа';
            btn.disabled = false;
            btn.textContent = I18n.t('auth_login_btn') || 'Войти';
        }
    },

    // handle register
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
        btn.innerHTML = '<div class="spinner spinner-sm"></div> ...';
        errorEl.textContent = '';

        try {
            const data = await api.register(username, password, firstName, lastName);
            this._pinPassword = password;
            this._pinUserId = `${data.user.id}_${data.user.username}`;
            
            // New user — show PIN creation screen
            this.showPinScreen('create');
        } catch (e) {
            errorEl.textContent = e.message || 'Ошибка регистрации';
            btn.disabled = false;
            btn.textContent = I18n.t('auth_register_btn') || 'Создать аккаунт';
        }
    },

    // pin screen logic

    // show pin screen
    showPinScreen(mode) {
        this._pinMode = mode;
        this._pinValue = '';
        this._pinConfirm = '';
        this._pinStage = 'first';

        // Hide auth forms (but keep auth-page visible for pin-screen)
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const authSettings = document.querySelector('.auth-settings');
        const pinScreen = document.getElementById('pinScreen');

        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (authSettings) authSettings.style.display = 'none';
        if (pinScreen) pinScreen.classList.add('active');

        this.updatePinUI();
    },

    // init pin listeners
    initPinListeners() {
        // Number buttons
        document.querySelectorAll('.numpad-btn[data-num]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.onPinDigit(btn.getAttribute('data-num'));
            });
        });

        // Backspace
        const backspace = document.getElementById('pinBackspace');
        if (backspace) {
            backspace.addEventListener('click', () => this.onPinBackspace());
        }

        // Confirm
        const confirm = document.getElementById('pinConfirm');
        if (confirm) {
            confirm.addEventListener('click', () => this.onPinConfirm());
        }

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            const pinScreen = document.getElementById('pinScreen');
            if (!pinScreen || !pinScreen.classList.contains('active')) return;

            if (e.key >= '0' && e.key <= '9') {
                this.onPinDigit(e.key);
            } else if (e.key === 'Backspace') {
                this.onPinBackspace();
            } else if (e.key === 'Enter') {
                this.onPinConfirm();
            }
        });
    },

    // pin digit
    onPinDigit(digit) {
        const currentPin = this._pinStage === 'first' ? this._pinValue : this._pinConfirm;
        if (currentPin.length >= 4) return;

        if (this._pinStage === 'first') {
            this._pinValue += digit;
        } else {
            this._pinConfirm += digit;
        }

        // Clear error
        const errorEl = document.getElementById('pinError');
        if (errorEl) errorEl.textContent = '';

        this.updatePinDots();

        // Auto-submit when 4 digits reached
        const newLen = (this._pinStage === 'first' ? this._pinValue : this._pinConfirm).length;
        if (newLen === 4) {
            setTimeout(() => this.onPinConfirm(), 200);
        }
    },

    // backspace
    onPinBackspace() {
        if (this._pinStage === 'first') {
            this._pinValue = this._pinValue.slice(0, -1);
        } else {
            this._pinConfirm = this._pinConfirm.slice(0, -1);
        }
        this.updatePinDots();
    },

    // confirm pin
    async onPinConfirm() {
        const errorEl = document.getElementById('pinError');

        if (this._pinMode === 'create') {
            if (this._pinStage === 'first') {
                // Validate length
                if (this._pinValue.length < 4) {
                    if (errorEl) errorEl.textContent = I18n.t('pin_too_short');
                    this.shakeDots();
                    this._pinValue = '';
                    this.updatePinDots();
                    return;
                }
                // Move to confirm stage
                this._pinStage = 'second';
                this.updatePinUI();
                return;
            } else {
                // Confirm stage — check match
                if (this._pinValue !== this._pinConfirm) {
                    if (errorEl) errorEl.textContent = I18n.t('pin_mismatch');
                    this.shakeDots();
                    this._pinConfirm = '';
                    this._pinValue = '';
                    this._pinStage = 'first';
                    this.updatePinUI();
                    return;
                }

                // Generate keys and save with PIN
                if (errorEl) errorEl.textContent = I18n.t('pin_generating');
                try {
                    await Crypto.init(this._pinUserId, this._pinValue);
                    console.log('[App] E2E encryption initialized with PIN');
                    sessionStorage.setItem('bernet_pin', this._pinValue);
                    this._pinPassword = null;
                    window.location.href = '/web/chat.html';
                } catch (e) {
                    console.error('[App] Crypto init failed:', e);
                    if (errorEl) errorEl.textContent = e.message || 'Error';
                }
            }
        } else {
            // Enter mode — try to decrypt with PIN
            if (this._pinValue.length < 4) {
                if (errorEl) errorEl.textContent = I18n.t('pin_too_short');
                this.shakeDots();
                this._pinValue = '';
                this.updatePinDots();
                return;
            }

            try {
                const ok = await Crypto.loadKeysFromStorage(this._pinUserId, this._pinValue);
                if (ok) {
                    console.log('[App] Keys decrypted with PIN');
                    sessionStorage.setItem('bernet_pin', this._pinValue);
                    this._pinPassword = null;
                    window.location.href = '/web/chat.html';
                } else {
                    // Wrong PIN — show error and "create new" link
                    this._showPinResetOption(errorEl);
                }
            } catch (e) {
                console.error('[App] PIN decrypt failed:', e);
                this._showPinResetOption(errorEl);
            }
        }
    },

    // wrong pin error
    _showPinResetOption(errorEl) {
        this.shakeDots();
        this._pinValue = '';
        this.updatePinDots();

        if (errorEl) {
            errorEl.innerHTML = I18n.t('pin_wrong') +
                '<br><a href="#" id="pinResetLink" style="color:var(--accent);text-decoration:underline;font-size:13px;">' +
                (I18n.t('pin_create') || 'Создать новый PIN') + '</a>';

            // Wait for DOM update, then attach click handler
            setTimeout(() => {
                const link = document.getElementById('pinResetLink');
                if (link) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        // Remove old keys (encrypted with password)
                        localStorage.removeItem(`bernet_keys_${this._pinUserId}`);
                        // Switch to create mode
                        this._pinMode = 'create';
                        this._pinValue = '';
                        this._pinConfirm = '';
                        this._pinStage = 'first';
                        if (errorEl) errorEl.textContent = '';
                        this.updatePinUI();
                    });
                }
            }, 0);
        }
    },

    // update pin ui
    updatePinUI() {
        const titleEl = document.getElementById('pinTitle');
        const subtitleEl = document.getElementById('pinSubtitle');
        const errorEl = document.getElementById('pinError');

        if (this._pinMode === 'create') {
            if (this._pinStage === 'first') {
                if (titleEl) titleEl.textContent = '🔑 ' + I18n.t('pin_create');
                if (subtitleEl) subtitleEl.textContent = I18n.t('pin_new_keys_info');
            } else {
                if (titleEl) titleEl.textContent = I18n.t('pin_confirm');
                if (subtitleEl) subtitleEl.textContent = I18n.t('pin_repeat_digits');
            }
        } else {
            if (titleEl) titleEl.textContent = '🔒 ' + I18n.t('pin_enter');
            if (subtitleEl) subtitleEl.textContent = I18n.t('pin_protects_key');
        }
        if (errorEl) errorEl.textContent = '';

        this.updatePinDots();
    },

    // update pin dots
    updatePinDots() {
        const pin = this._pinStage === 'first' ? this._pinValue : this._pinConfirm;
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`pinDot${i}`);
            if (dot) {
                dot.classList.toggle('filled', i < pin.length);
            }
        }
    },

    // shake dots
    shakeDots() {
        const dotsEl = document.getElementById('pinDots');
        if (dotsEl) {
            dotsEl.classList.add('shake');
            setTimeout(() => dotsEl.classList.remove('shake'), 400);
        }
    },

    // init chat
    async initChat(token, user) {
        // Connect WebSocket
        ws.connect(token);

        // Initialize E2E encryption with PIN
        const pin = sessionStorage.getItem('bernet_pin');
        if (pin) {
            try {
                await Crypto.init(`${user.id}_${user.username}`, pin);
                console.log('[App] E2E encryption ready');
            } catch (e) {
                console.error('[App] Crypto init failed:', e);
            }
        } else {
            // No PIN in session — force re-login
            console.warn('[App] No PIN in session — redirecting to login');
            api.clearToken();
            window.location.href = '/web/';
            return;
        }

        // Set sidebar user info
        const userNameEl = document.getElementById('currentUserName');
        if (userNameEl) userNameEl.textContent = `${user.first_name || user.username}`;

        // Init chat module
        Chat.init(user);
    }
};

// Start app on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
