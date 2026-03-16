// localization - ru, kz, en

const I18n = {
    currentLang: 'ru',

    translations: {
        ru: {
            // Sidebar
            search_placeholder: 'Поиск пользователей...',
            encrypted_message: '🔒 Зашифрованное сообщение',

            // Welcome
            welcome_title: 'Bernet Messenger',
            welcome_text: 'Выберите чат или найдите пользователя',

            // Chat
            online: 'в сети',
            offline: 'не в сети',
            type_message: 'Напишите сообщение...',
            start_chat: 'Начните общение',
            load_more: 'Загрузить ещё ↑',
            loading_error: 'Ошибка загрузки',

            // Context menu
            ctx_profile: '👤 Профиль',
            ctx_clear_chat: '🗑️ Очистить чат',
            ctx_block: '🚫 Заблокировать',

            // Profile modal
            my_profile: 'Мой профиль',
            change_photo: '📷 Изменить фото',
            first_name: 'Имя',
            last_name: 'Фамилия',
            phone: 'Телефон',
            birth_date: 'Дата рождения',
            about_label: 'О себе',
            about_me: 'Расскажите о себе...',
            save: 'Сохранить',
            profile_saved: 'Профиль сохранён ✅',

            // Other profile
            user_profile: 'Профиль',
            send_message: 'Написать',
            block_user: '🚫 Заблокировать',
            unblock_user: '✅ Разблокировать',

            // Settings
            settings_title: 'Настройки',
            appearance: 'Оформление',
            theme: 'Тема',
            theme_dark: 'Тёмная',
            theme_light: 'Светлая',
            language: 'Язык',
            lang_ru: 'Русский',
            lang_kz: 'Қазақша',
            lang_en: 'English',
            security: 'Безопасность',
            encryption_status: 'Шифрование',
            encryption_active: '🔒 E2E активно',
            encryption_inactive: '⚠️ Не активно',
            regen_keys: '🔄 Перегенерировать ключи',
            blocked_users: 'Заблокированные',
            no_blocked: 'Нет заблокированных',

            // Attachments
            downloading: 'Скачивание и расшифровка...',
            download_ok: 'Файл скачан ✅',
            decrypt_fail: 'Не удалось расшифровать файл',
            no_key: 'Нет ключа для расшифровки',
            crypto_not_ready: 'Шифрование не готово',
            encrypting: 'Шифрование и загрузка...',
            no_recipient_keys: 'Получатель не имеет ключей шифрования',

            // Search
            nothing_found: 'Ничего не найдено',

            // Actions
            logout: 'Выйти',
            close: 'Закрыть',
            cancel: 'Отмена',
            confirm_clear: 'Очистить чат?',
            confirm_block: 'Заблокировать пользователя?',
            chat_cleared: 'Чат очищен',
            user_blocked: 'Пользователь заблокирован',
            user_unblocked: 'Пользователь разблокирован',
            send_error: 'Ошибка отправки',
            crypto_inactive: 'Шифрование не активно. Перезайдите.',
            no_recipient_encryption: 'Получатель ещё не активировал шифрование',
            error: 'Ошибка',
            download: 'Скачать',
            edit_profile: 'Редактировать',
            blocked_list: 'Блокировки',
            appearance_tab: 'Оформление',
            password_tab: 'Пароль',
            privacy_tab: 'Конфиденциальность',

            // Privacy tab
            encryption_keys: 'Ключи шифрования',
            checking: 'Проверка...',
            encryption_active_title: 'Шифрование активно',
            encryption_inactive_title: 'Ключи отсутствуют',
            press_regen: 'Нажмите "Обновить ключи" для генерации',
            key_fingerprint: 'Отпечаток публичного ключа',
            public_key_pem: 'Публичный ключ (PEM)',
            no_key: 'Нет ключа',
            copy_btn: 'Копировать',
            private_key: 'Приватный ключ',
            regen_keys_btn: 'Обновить ключи',
            regen_warning: '⚠️ При обновлении старые зашифрованные сообщения станут нечитаемыми',
            logout_btn: 'Выйти из аккаунта',

            // Password tab
            old_password: 'Старый пароль',
            old_password_placeholder: 'Текущий пароль',
            new_password: 'Новый пароль',
            new_password_placeholder: 'Минимум 4 символа',
            change_password_btn: 'Сменить пароль',

            // Sidebar
            no_chats: 'Нет чатов',
            find_user_hint: 'Найдите пользователя через поиск',
            settings_tooltip: 'Настройки безопасности',
            logout_tooltip: 'Выйти',
            menu_tooltip: 'Меню',
            attach_tooltip: 'Прикрепить файл',
            send_tooltip: 'Отправить',

            // Other profile labels
            phone_label: '📱 Телефон',
            birth_label: '🎂 Дата рождения',
            about_info_label: '📝 О себе',
            not_specified: 'Не указан',
            not_specified_f: 'Не указана',
            not_specified_n: 'Не указано',
            loading_text: 'Загрузка...',
            download_tooltip: 'Скачать',
            close_tooltip: 'Закрыть'
        },

        kz: {
            search_placeholder: 'Пайдаланушыларды іздеу...',
            encrypted_message: '🔒 Шифрланған хабарлама',

            welcome_title: 'Bernet Messenger',
            welcome_text: 'Чат таңдаңыз немесе пайдаланушы табыңыз',

            online: 'желіде',
            offline: 'желіде емес',
            type_message: 'Хабарлама жазыңыз...',
            start_chat: 'Сөйлесуді бастаңыз',
            load_more: 'Тағы жүктеу ↑',
            loading_error: 'Жүктеу қатесі',

            ctx_profile: '👤 Профиль',
            ctx_clear_chat: '🗑️ Чатты тазалау',
            ctx_block: '🚫 Бұғаттау',

            my_profile: 'Менің профилім',
            change_photo: '📷 Суретті өзгерту',
            first_name: 'Аты',
            last_name: 'Тегі',
            phone: 'Телефон',
            birth_date: 'Туған күні',
            about_label: 'Өзі туралы',
            about_me: 'Өзіңіз туралы айтып беріңіз...',
            save: 'Сақтау',
            profile_saved: 'Профиль сақталды ✅',

            user_profile: 'Профиль',
            send_message: 'Жазу',
            block_user: '🚫 Бұғаттау',
            unblock_user: '✅ Бұғаттан шығару',

            settings_title: 'Параметрлер',
            appearance: 'Сыртқы түрі',
            theme: 'Тема',
            theme_dark: 'Қараңғы',
            theme_light: 'Жарық',
            language: 'Тіл',
            lang_ru: 'Русский',
            lang_kz: 'Қазақша',
            lang_en: 'English',
            security: 'Қауіпсіздік',
            encryption_status: 'Шифрлау',
            encryption_active: '🔒 E2E белсенді',
            encryption_inactive: '⚠️ Белсенді емес',
            regen_keys: '🔄 Кілттерді қайта жасау',
            blocked_users: 'Бұғатталғандар',
            no_blocked: 'Бұғатталғандар жоқ',

            downloading: 'Жүктеу және шифрді ашу...',
            download_ok: 'Файл жүктелді ✅',
            decrypt_fail: 'Файлды шифрдан ашу сәтсіз',
            no_key: 'Шифрді ашу кілті жоқ',
            crypto_not_ready: 'Шифрлау дайын емес',
            encrypting: 'Шифрлау және жүктеу...',
            no_recipient_keys: 'Алушыда шифрлау кілттері жоқ',

            nothing_found: 'Ештеңе табылмады',

            logout: 'Шығу',
            close: 'Жабу',
            cancel: 'Бас тарту',
            confirm_clear: 'Чатты тазалау?',
            confirm_block: 'Пайдаланушыны бұғаттау?',
            chat_cleared: 'Чат тазаланды',
            user_blocked: 'Пайдаланушы бұғатталды',
            user_unblocked: 'Пайдаланушы бұғаттан шығарылды',
            send_error: 'Жіберу қатесі',
            crypto_inactive: 'Шифрлау белсенді емес. Қайта кіріңіз.',
            no_recipient_encryption: 'Алушы шифрлауды белсендірмеген',
            error: 'Қате',
            download: 'Жүктеу',
            edit_profile: 'Өңдеу',
            blocked_list: 'Бұғаттаулар',
            appearance_tab: 'Сыртқы түрі',
            password_tab: 'Құпия сөз',
            privacy_tab: 'Қауіпсіздік',

            encryption_keys: 'Шифрлау кілттері',
            checking: 'Тексеру...',
            encryption_active_title: 'Шифрлау белсенді',
            encryption_inactive_title: 'Кілттер жоқ',
            press_regen: 'Кілттерді жасау үшін "Кілттерді жаңарту" басыңыз',
            key_fingerprint: 'Ашық кілт саусақ ізі',
            public_key_pem: 'Ашық кілт (PEM)',
            no_key: 'Кілт жоқ',
            copy_btn: 'Көшіру',
            private_key: 'Жеке кілт',
            regen_keys_btn: 'Кілттерді жаңарту',
            regen_warning: '⚠️ Жаңартқанда ескі шифрланған хабарламалар оқылмайды',
            logout_btn: 'Аккаунттан шығу',

            old_password: 'Ескі құпия сөз',
            old_password_placeholder: 'Ағымдағы құпия сөз',
            new_password: 'Жаңа құпия сөз',
            new_password_placeholder: 'Кемінде 4 таңба',
            change_password_btn: 'Құпия сөзді өзгерту',

            no_chats: 'Чаттар жоқ',
            find_user_hint: 'Іздеу арқылы пайдаланушы табыңыз',
            settings_tooltip: 'Қауіпсіздік параметрлері',
            logout_tooltip: 'Шығу',
            menu_tooltip: 'Мәзір',
            attach_tooltip: 'Файл тіркеу',
            send_tooltip: 'Жіберу',

            phone_label: '📱 Телефон',
            birth_label: '🎂 Туған күні',
            about_info_label: '📝 Өзі туралы',
            not_specified: 'Көрсетілмеген',
            not_specified_f: 'Көрсетілмеген',
            not_specified_n: 'Көрсетілмеген',
            loading_text: 'Жүктелуде...',
            download_tooltip: 'Жүктеу',
            close_tooltip: 'Жабу'
        },

        en: {
            search_placeholder: 'Search users...',
            encrypted_message: '🔒 Encrypted message',

            welcome_title: 'Bernet Messenger',
            welcome_text: 'Select a chat or find a user',

            online: 'online',
            offline: 'offline',
            type_message: 'Type a message...',
            start_chat: 'Start chatting',
            load_more: 'Load more ↑',
            loading_error: 'Loading error',

            ctx_profile: '👤 Profile',
            ctx_clear_chat: '🗑️ Clear chat',
            ctx_block: '🚫 Block',

            my_profile: 'My Profile',
            change_photo: '📷 Change photo',
            first_name: 'First name',
            last_name: 'Last name',
            phone: 'Phone',
            birth_date: 'Birth date',
            about_label: 'About',
            about_me: 'Tell about yourself...',
            save: 'Save',
            profile_saved: 'Profile saved ✅',

            user_profile: 'Profile',
            send_message: 'Message',
            block_user: '🚫 Block',
            unblock_user: '✅ Unblock',

            settings_title: 'Settings',
            appearance: 'Appearance',
            theme: 'Theme',
            theme_dark: 'Dark',
            theme_light: 'Light',
            language: 'Language',
            lang_ru: 'Русский',
            lang_kz: 'Қазақша',
            lang_en: 'English',
            security: 'Security',
            encryption_status: 'Encryption',
            encryption_active: '🔒 E2E active',
            encryption_inactive: '⚠️ Not active',
            regen_keys: '🔄 Regenerate keys',
            blocked_users: 'Blocked users',
            no_blocked: 'No blocked users',

            downloading: 'Downloading & decrypting...',
            download_ok: 'File downloaded ✅',
            decrypt_fail: 'Could not decrypt file',
            no_key: 'No decryption key',
            crypto_not_ready: 'Encryption not ready',
            encrypting: 'Encrypting & uploading...',
            no_recipient_keys: 'Recipient has no encryption keys',

            nothing_found: 'Nothing found',

            logout: 'Log out',
            close: 'Close',
            cancel: 'Cancel',
            confirm_clear: 'Clear chat?',
            confirm_block: 'Block user?',
            chat_cleared: 'Chat cleared',
            user_blocked: 'User blocked',
            user_unblocked: 'User unblocked',
            send_error: 'Send error',
            crypto_inactive: 'Encryption not active. Please re-login.',
            no_recipient_encryption: 'Recipient has not activated encryption yet',
            error: 'Error',
            download: 'Download',
            edit_profile: 'Edit',
            blocked_list: 'Blocked',
            appearance_tab: 'Appearance',
            password_tab: 'Password',
            privacy_tab: 'Privacy',

            encryption_keys: 'Encryption keys',
            checking: 'Checking...',
            encryption_active_title: 'Encryption active',
            encryption_inactive_title: 'No keys found',
            press_regen: 'Press "Regenerate keys" to generate',
            key_fingerprint: 'Public key fingerprint',
            public_key_pem: 'Public key (PEM)',
            no_key: 'No key',
            copy_btn: 'Copy',
            private_key: 'Private key',
            regen_keys_btn: 'Regenerate keys',
            regen_warning: '⚠️ Old encrypted messages will become unreadable after regeneration',
            logout_btn: 'Log out',

            old_password: 'Old password',
            old_password_placeholder: 'Current password',
            new_password: 'New password',
            new_password_placeholder: 'Minimum 4 characters',
            change_password_btn: 'Change password',

            no_chats: 'No chats',
            find_user_hint: 'Find a user via search',
            settings_tooltip: 'Security settings',
            logout_tooltip: 'Log out',
            menu_tooltip: 'Menu',
            attach_tooltip: 'Attach file',
            send_tooltip: 'Send',

            phone_label: '📱 Phone',
            birth_label: '🎂 Birth date',
            about_info_label: '📝 About',
            not_specified: 'Not specified',
            not_specified_f: 'Not specified',
            not_specified_n: 'Not specified',
            loading_text: 'Loading...',
            download_tooltip: 'Download',
            close_tooltip: 'Close'
        }
    },

    t(key) {
        return this.translations[this.currentLang]?.[key]
            || this.translations['ru']?.[key]
            || key;
    },

    setLang(lang) {
        if (!this.translations[lang]) return;
        this.currentLang = lang;
        localStorage.setItem('bernet_lang', lang);
        this.applyAll();
    },

    applyAll() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = this.t(key);
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = text;
            } else {
                el.textContent = text;
            }
        });
        // translate title attributes
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        });
    },

    init() {
        const saved = localStorage.getItem('bernet_lang');
        if (saved && this.translations[saved]) {
            this.currentLang = saved;
        }
        this.applyAll();
    }
};
