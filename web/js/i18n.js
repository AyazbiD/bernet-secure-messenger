// i18n localization (ru, kz, en)

const I18n = {
    currentLang: 'ru',

    translations: {
        ru: {
            // Sidebar
            search_placeholder: 'Поиск пользователей...',
            encrypted_message: 'Зашифрованное сообщение',
            self_destruct_msg: 'Исчезающее сообщение',

            // Welcome
            welcome_title: 'Bernet Messenger',
            welcome_text: 'Выберите чат или найдите пользователя',

            // Chat
            online: 'в сети',
            offline: 'не в сети',
            type_message: 'Напишите сообщение...',
            start_chat: 'Начните общение',
            no_chats: 'Нет чатов',
            find_user_search: 'Найдите пользователя через поиск',
            no_blocked_users: 'Нет заблокированных',
            load_more: 'Загрузить ещё ↑',
            loading_error: 'Ошибка загрузки',

            // Context menu
            ctx_profile: 'Профиль',
            ctx_clear_chat: 'Очистить чат',
            ctx_block: 'Заблокировать',

            // Profile modal
            my_profile: 'Мой профиль',
            change_photo: 'Изменить фото',
            first_name: 'Имя',
            last_name: 'Фамилия',
            phone: 'Телефон',
            birth_date: 'Дата рождения',
            about_label: 'О себе',
            about_me: 'Расскажите о себе...',
            not_specified: 'Не указано',
            save: 'Сохранить',
            profile_saved: 'Профиль сохранён ✅',

            // Other profile
            user_profile: 'Профиль',
            send_message: 'Написать',
            block_user: 'Заблокировать',
            unblock_user: 'Разблокировать',

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
            encryption_active: 'E2E активно',
            encryption_inactive: '⚠️ Не активно',
            regen_keys: 'Перегенерировать ключи',
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
            confirm_block: 'Точно хотите заблокировать пользователя?',
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

            // Settings (Password / Privacy)
            old_password: 'Старый пароль',
            current_password_placeholder: 'Текущий пароль',
            new_password: 'Новый пароль',
            password_hint: 'Минимум 4 символа',
            change_password_btn: 'Сменить пароль',
            encryption_keys: 'Ключи шифрования',
            checking: 'Проверка...',
            pubkey_fingerprint: 'Отпечаток публичного ключа',
            pubkey_pem: 'Публичный ключ (PEM)',
            copy_btn: 'Копировать',
            private_key_label: 'Приватный ключ',
            regen_warning: 'При обновлении старые зашифрованные сообщения станут нечитаемыми',
            
            key_active_title: 'Шифрование активно',
            fingerprint_error: 'Не удалось вычислить',
            privkey_saved: '🟢 Сохранён локально (PBKDF2 + AES-GCM)',
            privkey_not_found: '🔴 Не найден',
            privkey_not_loaded: '🔴 Не загружен',
            key_missing_title: 'Ключи отсутствуют',
            key_missing_sub: 'Нажмите "Обновить ключи" для генерации',
            copy_no_key: 'Нет ключа для копирования',
            copy_success: 'Скопировано',
            regen_confirm: '⚠️ Обновить ключи шифрования?\n\nСтарые зашифрованные сообщения станут нечитаемыми.\nПродолжить?',
            regen_relogin: 'Перезайдите для обновления ключей',
            regen_generating: 'Генерация ключей...',

            // PIN
            pin_enter: 'Введите PIN-код',
            pin_create: 'Создайте PIN-код',
            pin_confirm: 'Подтвердите PIN-код',
            pin_wrong: 'Неверный PIN-код',
            pin_mismatch: 'PIN-коды не совпадают',
            pin_too_short: 'PIN должен быть минимум 4 цифры',
            pin_protects_key: 'PIN защищает ваш приватный ключ',
            pin_generating: 'Генерация ключей...',
            pin_new_keys_info: 'Будут созданы новые ключи шифрования',
            pin_repeat_digits: 'Повторите 4 цифры',

            // Security verification
            security_verification: 'Безопасность',
            e2e_encryption: 'Сквозное шифрование',
            auto_message_protection: 'Автоматическая защита сообщений',
            your_key_fingerprint: 'Ваш отпечаток ключа:',
            peer_key_fingerprint: 'Отпечаток собеседника:',
            compare_fingerprints: 'Сравните отпечатки лично. Совпадение отпечатков означает, что связь зашифрована сквозным методом от устройства к устройству и никто (даже сервер) не может их прочитать.',
            understood: 'Понятно',
            admin_ban: 'Глобальный Бан (Админ)',
            admin_unban: 'Разбанить (Админ)',
            admin_confirm_ban: 'Точно забанить пользователя (глобально)?',
            admin_confirm_unban: 'Разбанить пользователя?',
            admin_success_ban: 'Пользователь забанен!',
            admin_success_unban: 'Пользователь разбанен!',
            
            // Admin Panel
            admin_panel_title: 'Панель администратора',
            admin_users_loading: 'Загрузка пользователей...',
            admin_no_users: 'Нет пользователей',
            admin_role_grant: 'Дать Админа',
            admin_role_revoke: 'Забрать Админа',
            admin_role_super: '[Super Admin]',
            admin_role_admin: '[Admin]',
            admin_banned: '[Забанен]',
            admin_confirm_grant: 'Вы уверены, что хотите ВЫДАТЬ права администратора этому пользователю?',
            admin_confirm_revoke: 'Вы уверены, что хотите ЗАБРАТЬ права администратора у этого пользователя?',
            admin_confirm_ban_user: 'Вы уверены, что хотите ЗАБАНИТЬ этого пользователя?',
            admin_confirm_unban_user: 'Вы уверены, что хотите РАЗБАНИТЬ этого пользователя?',
            admin_error: 'Ошибка загрузки:',
            admin_search_placeholder: 'Поиск пользователей...',
            admin_page_prev: 'Назад',
            admin_page_next: 'Вперед'
        },

        kz: {
            search_placeholder: 'Пайдаланушыларды іздеу...',
            encrypted_message: 'Шифрланған хабарлама',
            self_destruct_msg: 'Жойылатын хабарлама',

            welcome_title: 'Bernet Messenger',
            welcome_text: 'Чат таңдаңыз немесе пайдаланушы табыңыз',

            online: 'желіде',
            offline: 'желіде емес',
            type_message: 'Хабарлама жазыңыз...',
            start_chat: 'Сөйлесуді бастаңыз',
            no_chats: 'Чаттар жоқ',
            find_user_search: 'Пайдаланушыны іздеу арқылы табыңыз',
            no_blocked_users: 'Бұғатталғандар жоқ',
            load_more: 'Тағы жүктеу ↑',
            loading_error: 'Жүктеу қатесі',

            ctx_profile: 'Профиль',
            ctx_clear_chat: 'Чатты тазалау',
            ctx_block: 'Бұғаттау',

            my_profile: 'Менің профилім',
            change_photo: 'Суретті өзгерту',
            first_name: 'Аты',
            last_name: 'Тегі',
            phone: 'Телефон',
            birth_date: 'Туған күні',
            about_label: 'Өзі туралы',
            about_me: 'Өзіңіз туралы айтып беріңіз...',
            not_specified: 'Көрсетілмеген',
            save: 'Сақтау',
            profile_saved: 'Профиль сақталды ✅',

            user_profile: 'Профиль',
            send_message: 'Жазу',
            block_user: 'Бұғаттау',
            unblock_user: 'Бұғаттан шығару',

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
            encryption_active: 'E2E белсенді',
            encryption_inactive: '⚠️ Белсенді емес',
            regen_keys: 'Кілттерді қайта жасау',
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
            confirm_block: 'Пайдаланушыны бұғаттағыңыз келетініне сенімдісіз бе?',
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

            // Settings (Password / Privacy)
            old_password: 'Ескі құпия сөз',
            current_password_placeholder: 'Ағымдағы құпия сөз',
            new_password: 'Жаңа құпия сөз',
            password_hint: 'Кемінде 4 таңба',
            change_password_btn: 'Құпия сөзді өзгерту',
            encryption_keys: 'Шифрлау кілттері',
            checking: 'Тексеру...',
            pubkey_fingerprint: 'Ашық кілттің ізі',
            pubkey_pem: 'Ашық кілт (PEM)',
            copy_btn: 'Көшіру',
            private_key_label: 'Жеке кілт',
            regen_warning: '⚠️ Жаңарту кезінде ескі хабарламаларды оқу мүмкін болмайды',
            
            key_active_title: 'Шифрлау белсенді',
            fingerprint_error: 'Есептеу мүмкін болмады',
            privkey_saved: '🟢 Локальды сақталған (PBKDF2 + AES-GCM)',
            privkey_not_found: '🔴 Табылмады',
            privkey_not_loaded: '🔴 Жүктелмеді',
            key_missing_title: 'Кілттер жоқ',
            key_missing_sub: 'Жасау үшін "Кілттерді қайта жасау" басыңыз',
            copy_no_key: 'Көшіру үшін кілт жоқ',
            copy_success: 'Көшірілді',
            regen_confirm: '⚠️ Кілттерді қайта жасау керек пе?\n\nЕскі хабарламаларды оқу мүмкін болмайды.\nЖалғастыру керек пе?',
            regen_relogin: 'Кілттерді жаңарту үшін қайта кіріңіз',
            regen_generating: 'Кілттер жасалуда...',

            // PIN
            pin_enter: 'PIN кодын енгізіңіз',
            pin_create: 'PIN код жасаңыз',
            pin_confirm: 'PIN кодын растаңыз',
            pin_wrong: 'PIN коды дұрыс емес',
            pin_mismatch: 'PIN кодтары сәйкес келмейді',
            pin_too_short: 'PIN кемінде 4 сан болуы керек',
            pin_protects_key: 'PIN сіздің жеке кілтіңізді қорғайды',
            pin_generating: 'Кілттерді жасау...',
            pin_new_keys_info: 'Жаңа шифрлау кілттері жасалады',
            pin_repeat_digits: '4 санды қайталаңыз',

            // Security verification
            security_verification: 'Қауіпсіздік',
            e2e_encryption: 'Толық шифрлау',
            auto_message_protection: 'Хабарламаларды автоматты түрде қорғау',
            your_key_fingerprint: 'Сіздің кілт ізіңіз:',
            peer_key_fingerprint: 'Сұхбаттасушының кілт ізі:',
            compare_fingerprints: 'Іздерді жеке салыстырыңыз. Іздердің сәйкес келуі байланыстың құрылғыдан құрылғыға дейін толық шифрланғанын және оларды ешкім (тіпті сервер де) оқи алмайтынын білдіреді.',
            understood: 'Түсінікті',
            admin_ban: 'Глобалдық Бұғаттау (Админ)',
            admin_unban: 'Бұғаттан шығару (Админ)',
            admin_confirm_ban: 'Пайдаланушыны (глобалды) бұғаттауға сенімдісіз бе?',
            admin_confirm_unban: 'Пайдаланушыны бұғаттан шығару керек пе?',
            admin_success_ban: 'Пайдаланушы бұғатталды!',
            admin_success_unban: 'Пайдаланушы бұғаттан шығарылды!',
            
            // Admin Panel
            admin_panel_title: 'Әкімші тақтасы',
            admin_users_loading: 'Пайдаланушыларды жүктеу...',
            admin_no_users: 'Пайдаланушылар жоқ',
            admin_role_grant: 'Әкімші беру',
            admin_role_revoke: 'Әкімшіні алу',
            admin_role_super: '[Super Admin]',
            admin_role_admin: '[Admin]',
            admin_banned: '[Бұғатталған]',
            admin_confirm_grant: 'Осы пайдаланушыға әкімші құқықтарын БЕРГІҢІЗ келетініне сенімдісіз бе?',
            admin_confirm_revoke: 'Осы пайдаланушыдан әкімші құқықтарын АЛҒЫҢЫЗ келетініне сенімдісіз бе?',
            admin_confirm_ban_user: 'Осы пайдаланушыны БҰҒАТТАҒЫҢЫЗ келетініне сенімдісіз бе?',
            admin_confirm_unban_user: 'Осы пайдаланушыны БҰҒАТТАН ШЫҒАРҒЫҢЫЗ келетініне сенімдісіз бе?',
            admin_error: 'Жүктеу қатесі:',
            admin_search_placeholder: 'Пайдаланушыларды іздеу...',
            admin_page_prev: 'Артқа',
            admin_page_next: 'Алға'
        },

        en: {
            search_placeholder: 'Search users...',
            encrypted_message: 'Encrypted message',
            self_destruct_msg: 'Disappearing message',

            welcome_title: 'Bernet Messenger',
            welcome_text: 'Select a chat or find a user',

            online: 'online',
            offline: 'offline',
            type_message: 'Type a message...',
            start_chat: 'Start chatting',
            no_chats: 'No chats',
            find_user_search: 'Find a user through search',
            no_blocked_users: 'No blocked users',
            load_more: 'Load more ↑',
            loading_error: 'Loading error',

            ctx_profile: 'Profile',
            ctx_clear_chat: 'Clear chat',
            ctx_block: 'Block',

            my_profile: 'My Profile',
            change_photo: 'Change photo',
            first_name: 'First name',
            last_name: 'Last name',
            phone: 'Phone',
            birth_date: 'Birth date',
            about_label: 'About',
            about_me: 'Tell about yourself...',
            not_specified: 'Not specified',
            save: 'Save',
            profile_saved: 'Profile saved ✅',

            user_profile: 'Profile',
            send_message: 'Message',
            block_user: 'Block',
            unblock_user: 'Unblock',

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
            encryption_active: 'E2E active',
            encryption_inactive: '⚠️ Not active',
            regen_keys: 'Regenerate keys',
            blocked_users: 'Blocked users',
            no_blocked: 'No blocked users',
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
            confirm_block: 'Are you sure you want to block this user?',
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

            // Settings (Password / Privacy)
            old_password: 'Old password',
            current_password_placeholder: 'Current password',
            new_password: 'New password',
            password_hint: 'Minimum 4 characters',
            change_password_btn: 'Change password',
            encryption_keys: 'Encryption keys',
            checking: 'Checking...',
            pubkey_fingerprint: 'Public key fingerprint',
            pubkey_pem: 'Public key (PEM)',
            copy_btn: 'Copy',
            private_key_label: 'Private key',
            regen_warning: 'Old encrypted messages will become unreadable upon update',
            
            key_active_title: 'Encryption active',
            fingerprint_error: 'Failed to compute',
            privkey_saved: 'Saved locally (PBKDF2 + AES-GCM)',
            privkey_not_found: 'Not found',
            privkey_not_loaded: 'Not loaded',
            key_missing_title: 'Keys missing',
            key_missing_sub: 'Click "Regenerate keys" to create',
            copy_no_key: 'No key to copy',
            copy_success: 'Copied',
            regen_confirm: '⚠️ Regenerate encryption keys?\n\nOld encrypted messages will become unreadable.\nContinue?',
            regen_relogin: 'Relogin to update keys',
            regen_generating: 'Generating keys...',

            // PIN
            pin_enter: 'Enter PIN code',
            pin_create: 'Create PIN code',
            pin_confirm: 'Confirm PIN code',
            pin_wrong: 'Wrong PIN code',
            pin_mismatch: 'PIN codes don\'t match',
            pin_too_short: 'PIN must be at least 4 digits',
            pin_protects_key: 'PIN protects your private key',
            pin_generating: 'Generating keys...',
            pin_new_keys_info: 'New encryption keys will be generated',
            pin_repeat_digits: 'Repeat 4 digits',

            // Security verification
            security_verification: 'Security',
            e2e_encryption: 'End-to-end encryption',
            auto_message_protection: 'Automatic message protection',
            your_key_fingerprint: 'Your key fingerprint:',
            peer_key_fingerprint: 'Peer\'s key fingerprint:',
            compare_fingerprints: 'Compare fingerprints in person. Matching fingerprints mean that your connection is end-to-end encrypted and nobody (not even the server) can read them.',
            understood: 'Understood',
            admin_ban: 'Global Ban (Admin)',
            admin_unban: 'Global Unban (Admin)',
            admin_confirm_ban: 'Are you sure you want to ban this user globally?',
            admin_confirm_unban: 'Unban this user?',
            admin_success_ban: 'User banned successfully!',
            admin_success_unban: 'User unbanned successfully!',
            
            // Admin Panel
            admin_panel_title: 'Admin Panel',
            admin_users_loading: 'Loading users...',
            admin_no_users: 'No users',
            admin_role_grant: 'Grant Admin',
            admin_role_revoke: 'Revoke Admin',
            admin_role_super: '[Super Admin]',
            admin_role_admin: '[Admin]',
            admin_banned: '[Banned]',
            admin_confirm_grant: 'Are you sure you want to GRANT admin rights to this user?',
            admin_confirm_revoke: 'Are you sure you want to REVOKE admin rights from this user?',
            admin_confirm_ban_user: 'Are you sure you want to BAN this user?',
            admin_confirm_unban_user: 'Are you sure you want to UNBAN this user?',
            admin_error: 'Loading error:',
            admin_search_placeholder: 'Search users...',
            admin_page_prev: 'Prev',
            admin_page_next: 'Next'
        }
    },

    // get translation
    t(key) {
        return this.translations[this.currentLang]?.[key]
            || this.translations['ru']?.[key]
            || key;
    },

    // set language
    setLang(lang) {
        if (!this.translations[lang]) return;
        this.currentLang = lang;
        localStorage.setItem('bernet_lang', lang);
        this.applyAll();
    },

    // apply to dom
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
        // Handle contenteditable placeholders (data-i18n-placeholder)
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.setAttribute('data-placeholder', this.t(key));
        });
    },

    // init
    init() {
        const saved = localStorage.getItem('bernet_lang');
        if (saved && this.translations[saved]) {
            this.currentLang = saved;
        }
        this.applyAll();
    }
};
