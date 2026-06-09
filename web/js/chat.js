/**
 * Bernet Chat — Complete UI Module
 * Bugs fixed: message dedup, unread badge, search clear, mobile Telegram-like
 */
const Chat = {
    currentChat: null,
    messages: [],
    chats: [],
    currentUser: null,
    typingTimers: {},
    blockedUsers: [],
    _sentIds: new Set(),
    pendingAttachments: [], // Encrypted attachments ready to send

    // init
    init(user) {
        this.currentUser = user;
        this.initThemeAndLang();
        this.bindEvents();
        this.loadChats();
        this.loadBlocked();
        this.setupWebSocket();
        this.updateSidebarAvatar();
        document.getElementById('currentUserName').textContent = user.first_name || user.username;
        
        // Show Admin Panel button if user is admin
        if (user.role === 'admin' || user.role === 'super_admin') {
            const adminBtn = document.getElementById('adminPanelBtn');
            if (adminBtn) adminBtn.classList.remove('hidden');
        }
    },

    // theme & language
    initThemeAndLang() {
        // Apply saved theme
        const savedTheme = localStorage.getItem('bernet_theme') || 'dark';
        this.applyTheme(savedTheme);

        // Apply saved language
        I18n.init();
        this.updateLangButtons();
    },

    setTheme(theme) {
        this.applyTheme(theme);
        localStorage.setItem('bernet_theme', theme);
        // Save to server if possible
        try { api.request('PUT', '/api/users/me/preferences', { theme }); } catch { }
    },

    applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        // Update theme buttons
        const darkBtn = document.getElementById('btnThemeDark');
        const lightBtn = document.getElementById('btnThemeLight');
        if (darkBtn) darkBtn.classList.toggle('active', theme === 'dark');
        if (lightBtn) lightBtn.classList.toggle('active', theme === 'light');
    },

    setLanguage(lang) {
        I18n.setLang(lang);
        this.updateLangButtons();
        this.loadKeyInfo(); // Update dynamic settings strings

        // Refresh UI dynamically
        this.loadChats();
        if (this.currentChat) {
            this.renderMessages(); // Re-render messages with new language

            // Update header status text to new language
            const el = document.getElementById('chatHeaderStatus');
            if (el) {
                const isOnline = el.className.includes('online');
                el.textContent = isOnline ? I18n.t('online') : I18n.t('offline');
            }

            if (!document.getElementById('otherProfileModal').classList.contains('hidden')) {
                this.openOtherProfile(); // Refresh profile modal ONLY if open
            }
        } else {
            this.renderMessages(); // Refresh empty state
        }
        this.renderBlockedList();

        // Save to server if possible
        try { api.request('PUT', '/api/users/me/preferences', { language: lang }); } catch { }
    },

    updateLangButtons() {
        ['ru', 'kz', 'en'].forEach(l => {
            const btn = document.getElementById('btnLang' + l.charAt(0).toUpperCase() + l.slice(1));
            if (btn) btn.classList.toggle('active', I18n.currentLang === l);
        });
    },


    updateSidebarAvatar() {
        const el = document.getElementById('currentUserAvatar');
        if (!el) return;
        if (this.currentUser.avatar) {
            el.innerHTML = `<img src="${this.currentUser.avatar}" alt="">`;
            el.classList.add('has-img');
        } else {
            el.textContent = this.getInitials(this.currentUser.first_name, this.currentUser.last_name);
            el.classList.remove('has-img');
        }
    },

    // event binding
    bindEvents() {
        // Search input
        const searchInput = document.getElementById('searchInputUser');
        let searchTimer;
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimer);
                const q = searchInput.textContent.trim();
                if (q.length >= 2) {
                    searchTimer = setTimeout(() => this.searchUsers(q), 300);
                } else {
                    this.hideSearchResults();
                }
            });
            // Prevent Enter from adding newlines
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                }
            });
            // Strip formatting on paste
            searchInput.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text/plain');
                document.execCommand('insertText', false, text);
            });
            searchInput.addEventListener('focus', () => {
                const q = searchInput.textContent.trim();
                if (q.length >= 2) this.searchUsers(q);
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-box')) {
                    this.hideSearchResults();
                }
            });
        }

        // Message input
        const msgInput = document.getElementById('messageInput');
        if (msgInput) {
            msgInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            msgInput.addEventListener('input', () => {
                msgInput.style.height = 'auto';
                msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
                if (this.currentChat && ws.connected) {
                    ws.sendTyping(this.currentChat.id, true);
                    clearTimeout(this.typingTimers._send);
                    this.typingTimers._send = setTimeout(() => {
                        if (this.currentChat) ws.sendTyping(this.currentChat.id, false);
                    }, 2000);
                }
            });
        }

        // Send button
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) sendBtn.addEventListener('click', () => this.sendMessage());

        // Profile button (sidebar avatar/name click → open own profile)
        const myAvatar = document.getElementById('currentUserAvatar');
        const myName = document.getElementById('currentUserName');
        if (myAvatar) myAvatar.addEventListener('click', () => this.openMyProfile());
        if (myName) myName.addEventListener('click', () => this.openMyProfile());

        // Settings button → security only
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) settingsBtn.addEventListener('click', () => this.openSettings());

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

        // Chat header — click name/avatar to open OTHER user's profile
        const headerAvatar = document.getElementById('chatHeaderAvatar');
        const headerName = document.getElementById('chatHeaderName');
        if (headerAvatar) headerAvatar.addEventListener('click', () => this.openOtherProfile());
        if (headerName) headerName.addEventListener('click', () => this.openOtherProfile());

        // Header menu button
        const menuBtn = document.getElementById('chatMenuBtn');
        if (menuBtn) menuBtn.addEventListener('click', (e) => this.showChatMenu(e));

        // Mobile back
        const backBtn = document.getElementById('mobileBackBtn');
        if (backBtn) backBtn.addEventListener('click', () => this.goBackToList());

        // Scroll for pagination
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.addEventListener('scroll', () => {
                if (container.scrollTop <= 30 && !this._loadingMore && this._hasMore && this.currentChat) {
                    this.loadMoreMessages();
                }
            });
        }

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target === el) el.classList.add('hidden');
            });
        });
        document.querySelectorAll('.modal-overlay').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target === el) el.classList.add('hidden');
            });
        });

        // Initialize advanced UI libraries for Profile
        if (window.flatpickr) {
            flatpickr("#editBirth", {
                minDate: "1900-01-01",
                maxDate: "2100-12-31",
                allowInput: true,
                dateFormat: "Y-m-d"
            });
        }
        
        if (window.intlTelInput) {
            const phoneInput = document.getElementById("editPhone");
            phoneInput.removeAttribute("placeholder");
            this.iti = window.intlTelInput(phoneInput, {
                initialCountry: "auto",
                autoPlaceholder: "aggressive",
                geoIpLookup: function(callback) {
                    fetch("https://ipapi.co/json")
                        .then(function(res) { return res.json(); })
                        .then(function(data) { callback(data.country_code); })
                        .catch(function() { callback("us"); });
                },
                utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@23.0.4/build/js/utils.js",
                separateDialCode: true,
                autoFormat: true
            });
        }
    },

    // attachments
    async handleFileSelect(input) {
        if (!input.files || input.files.length === 0) return;
        if (!this.currentChat || !Crypto.isReady) {
            this.showToast('Шифрование не готово или чат не выбран', 'error');
            input.value = '';
            return;
        }

        const recipientKey = await Crypto.getRecipientPublicKey(this.currentChat.id);
        if (!recipientKey) {
            this.showToast('Получатель не имеет ключей шифрования', 'error');
            input.value = '';
            return;
        }

        this.showToast('Шифрование и загрузка...', 'info');

        for (const file of input.files) {
            try {
                // Encrypt
                const encrypted = await Crypto.encryptFile(file, recipientKey);

                // Upload
                const formData = new FormData();
                formData.append('file', encrypted.encryptedBlob, file.name);
                formData.append('iv', encrypted.iv);
                formData.append('rsa_encrypted_aes_key_recipient', encrypted.encryptedKey);
                formData.append('rsa_encrypted_aes_key_sender', encrypted.senderEncryptedKey);
                formData.append('to_user_id', this.currentChat.id);
                formData.append('original_type', file.type || 'application/octet-stream');

                const uploaded = await api.uploadAttachment(formData);
                this.pendingAttachments.push({
                    id: uploaded.id,
                    name: file.name,
                    type: file.type,
                    size: uploaded.file_size || file.size,
                    localUrl: URL.createObjectURL(file),
                    // Preserve encryption keys for download/decrypt
                    rsa_encrypted_aes_key_recipient: uploaded.rsa_encrypted_aes_key_recipient,
                    rsa_encrypted_aes_key_sender: uploaded.rsa_encrypted_aes_key_sender,
                    iv: uploaded.iv,
                    from_user_id: uploaded.from_user_id || this.currentUser.id
                });
            } catch (e) {
                console.error('[Attachment] Upload error:', e);
                this.showToast(`Ошибка: ${e.message || e}`, 'error');
            }
        }
        input.value = '';
        this.renderPendingAttachments();
    },

    renderPendingAttachments() {
        const container = document.getElementById('pendingAttachments');
        if (!container) return;
        if (this.pendingAttachments.length === 0) {
            container.classList.add('hidden');
            container.innerHTML = '';
            return;
        }
        container.classList.remove('hidden');
        container.innerHTML = this.pendingAttachments.map((att, i) => `
            <div class="pending-att">
                ${att.type.startsWith('image/') ? `<img src="${att.localUrl}" class="att-thumb" onclick="event.stopPropagation(); Chat.openImageViewer('${att.localUrl}', '${this.esc(att.name)}')">` : '<div class="att-icon">📄</div>'}
                <div class="att-name">${this.esc(att.name)}</div>
                <button class="btn-icon sm" onclick="Chat.removeAttachment(${i})">✕</button>
            </div>
        `).join('');
    },

    removeAttachment(index) {
        this.pendingAttachments.splice(index, 1);
        this.renderPendingAttachments();
    },

    openImageViewer(src, fileName) {
        const modal = document.getElementById('imageViewerModal');
        const img = document.getElementById('imageViewerImg');
        img.src = src;
        this._viewerImageUrl = src;
        this._viewerImageName = fileName || 'image.jpg';
        modal.classList.remove('hidden');
    },

    downloadViewerImage() {
        if (!this._viewerImageUrl) return;
        const a = document.createElement('a');
        a.href = this._viewerImageUrl;
        a.download = this._viewerImageName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    viewAvatar(el) {
        const img = el.querySelector('img');
        if (img && img.src) {
            this.openImageViewer(img.src);
        }
    },

    async loadAttachment(att, el) {
        // If we have localUrl (already loaded/optimistic), handle directly
        if (att.localUrl) {
            if (el.tagName === 'IMG') {
                el.onload = () => {
                    const c = document.getElementById('messagesContainer');
                    if (c) {
                        const isAtBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 100;
                        if (isAtBottom) c.scrollTop = c.scrollHeight;
                    }
                };
                el.src = att.localUrl;
                el.onclick = () => Chat.openImageViewer(att.localUrl, att.file_name);
                el.parentElement.classList.remove('loading');
            } else if (el.tagName === 'AUDIO') {
                el.src = att.localUrl;
                el.parentElement.classList.remove('loading');
            }
            return;
        }

        if (!Crypto.isReady) return;

        try {
            const keyToUse = (Number(att.from_user_id) === Number(this.currentUser.id))
                ? att.rsa_encrypted_aes_key_sender
                : att.rsa_encrypted_aes_key_recipient;

            if (!keyToUse) {
                el.parentElement.innerHTML = '<span style="color:#ff6b6b;font-size:12px">Нет ключа</span>';
                return;
            }

            const encryptedBuf = await api.downloadAttachment(att.id);
            const blob = await Crypto.decryptFile(encryptedBuf, att.iv, keyToUse);

            if (blob) {
                const mimeType = att.file_type || 'application/octet-stream';
                const typedBlob = new Blob([blob], { type: mimeType });
                const url = URL.createObjectURL(typedBlob);
                att.localUrl = url;

                if (el.tagName === 'IMG') {
                    el.onload = () => {
                        const c = document.getElementById('messagesContainer');
                        if (c) {
                            const isAtBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 100;
                            if (isAtBottom) c.scrollTop = c.scrollHeight;
                        }
                    };
                    el.src = url;
                    el.onclick = () => Chat.openImageViewer(url, att.file_name);
                    el.parentElement.classList.remove('loading');
                } else if (el.tagName === 'AUDIO') {
                    el.src = url;
                    el.parentElement.classList.remove('loading');
                    // Set download link
                    const dlBtn = el.parentElement.querySelector('.audio-download');
                    if (dlBtn) {
                        dlBtn.onclick = (e) => {
                            e.stopPropagation();
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = att.file_name || 'audio';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                        };
                    }
                }
            }
        } catch (e) {
            console.error('Load attachment failed', e);
            el.parentElement.innerHTML = '<span style="color:#ff6b6b;font-size:12px">Ошибка</span>';
        }
    },

    async downloadFile(attId, fileName, attDataStr) {
        const att = JSON.parse(decodeURIComponent(attDataStr));
        if (!Crypto.isReady) {
            this.showToast('Шифрование не готово', 'error');
            return;
        }

        try {
            const keyToUse = (att.from_user_id === this.currentUser.id)
                ? att.rsa_encrypted_aes_key_sender
                : att.rsa_encrypted_aes_key_recipient;

            if (!keyToUse) {
                this.showToast('Нет ключа для расшифровки', 'error');
                return;
            }

            this.showToast('Скачивание и расшифровка...', 'info');
            const encryptedBuf = await api.downloadAttachment(att.id);
            const blob = await Crypto.decryptFile(encryptedBuf, att.iv, keyToUse);

            if (blob) {
                // Determine correct MIME type
                const mimeType = att.file_type || 'application/octet-stream';
                const typedBlob = new Blob([blob], { type: mimeType });
                const url = URL.createObjectURL(typedBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 5000);
                this.showToast('Файл скачан ✅', 'success');
            } else {
                this.showToast('Не удалось расшифровать файл', 'error');
            }
        } catch (e) {
            console.error('[Download]', e);
            this.showToast(`Ошибка: ${e.message || e}`, 'error');
        }
    },

    setupWebSocket() {
        ws.onMessage = async (msg) => {
            // ── DEDUPLICATION: skip if this is our own echo ──
            if (msg.sender_id === this.currentUser.id) {
                return;
            }

            // Decrypt incoming message if encrypted
            if (Crypto.isReady && msg.iv && msg.rsa_encrypted_aes_key_recipient) {
                try {
                    const plain = await Crypto.decryptMessage(msg.aes_encrypted_content, msg.iv, msg.rsa_encrypted_aes_key_recipient);
                    if (plain) msg._decrypted = plain;
                } catch { }
            }

            // Incoming message from other user
            if (this.currentChat && msg.sender_id === this.currentChat.id) {
                this.appendMessage(msg);
                // For SD photo messages, DON'T auto mark-read — let the user click to reveal
                const hasSDPhotos = msg.self_destruct_seconds > 0 && msg.attachments && msg.attachments.some(a => a.file_type && a.file_type.startsWith('image/'));
                if (!hasSDPhotos) {
                    this.markReadViaWS(msg.sender_id);
                }
            }
            this.loadChats();
        };

        ws.onStatusUpdate = (userId, isOnline) => {
            const dot = document.querySelector(`.chat-item[data-id="${userId}"] .online-dot`);
            if (dot) dot.style.display = isOnline ? 'block' : 'none';
            if (this.currentChat && this.currentChat.id === userId) {
                const el = document.getElementById('chatHeaderStatus');
                if (el) { el.textContent = isOnline ? I18n.t('online') : I18n.t('offline'); el.className = 'status' + (isOnline ? ' online' : ''); }
            }
        };

        ws.onMessagesRead = (readerId) => {
            if (this.currentChat && this.currentChat.id === readerId) {
                const now = new Date().toISOString();
                let needRender = false;
                this.messages.forEach(m => {
                    if (m.sender_id === this.currentUser.id && !m.read_at) {
                        if (m.self_destruct_seconds > 0) {
                            // Only auto-start timer for text-only SD messages
                            const hasImages = m.attachments && m.attachments.some(a => a.file_type && a.file_type.startsWith('image/'));
                            if (!hasImages) {
                                m.read_at = now;
                                needRender = true;
                            }
                        } else {
                            // Normal messages: mark as read immediately
                            m.read_at = now;
                            needRender = true;
                        }
                    }
                });
                if (needRender) {
                    this.renderMessages();
                }
            }
        };

        // Server says SD timer started (for photo reveals or text reads)
        ws.onSdStarted = (data) => {
            const msgId = data.message_id;
            // Update message data
            const msg = this.messages.find(m => String(m.id) === String(msgId));
            if (msg) {
                msg.read_at = data.read_at;
                msg._expires_at = data.expires_at;
            }
            // Start visual countdown on the DOM element
            const el = document.querySelector(`.message[data-id="${msgId}"]`);
            if (el) {
                el.setAttribute('data-read', 'true');
                el.setAttribute('data-expires', data.expires_at);
            }
            this.loadChats(); // refresh sidebar
        };

        // Server deleted an expired message
        ws.onMessageDeleted = (messageId) => {
            // Remove from data arrays
            this.messages = this.messages.filter(m => String(m.id) !== String(messageId));

            // Remove from DOM with animation
            const el = document.querySelector(`.message[data-id="${messageId}"]`);
            if (el && !el.classList.contains('vanishing')) {
                el.classList.add('vanishing');
                const timerSpan = el.querySelector('.sd-timer');
                if (timerSpan) timerSpan.innerHTML = '<svg class=\"icon\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"></path></svg> 0с';
                setTimeout(() => el.remove(), 400);
            }

            // Close fullscreen if showing this image
            const viewerModal = document.getElementById('imageViewerModal');
            if (viewerModal && !viewerModal.classList.contains('hidden') && el) {
                const viewerImg = document.getElementById('imageViewerImg');
                const msgImgs = el.querySelectorAll('img');
                for (const mi of msgImgs) {
                    if (viewerImg && viewerImg.src === mi.src) {
                        viewerModal.classList.add('hidden');
                        break;
                    }
                }
            }

            this.loadChats(); // refresh sidebar
        };

        ws.onUserUpdate = (userId, updates) => {
            const chatObj = this.chats.find(c => c.user && c.user.id === userId);
            if (chatObj) {
                if (updates.avatar) chatObj.user.avatar = updates.avatar;
                if (updates.first_name) chatObj.user.first_name = updates.first_name;
                if (updates.last_name) chatObj.user.last_name = updates.last_name;
            }

            if (this.currentChat && this.currentChat.id === userId) {
                if (updates.avatar) this.currentChat.avatar = updates.avatar;
                if (updates.first_name) this.currentChat.first_name = updates.first_name;
                if (updates.last_name) this.currentChat.last_name = updates.last_name;
                
                if (updates.avatar) {
                    const headerAvatar = document.getElementById('chatHeaderAvatar');
                    headerAvatar.innerHTML = `<img src="${updates.avatar}" alt="">`;
                    headerAvatar.classList.add('has-img');
                }
            }
            this.renderChatList();
        };

        ws.onTyping = (userId, isTyping) => {
            if (this.currentChat && this.currentChat.id === userId) {
                const container = document.getElementById('messagesContainer');
                let ind = document.getElementById('typingIndicator');
                if (isTyping && !ind) {
                    ind = document.createElement('div');
                    ind.id = 'typingIndicator';
                    ind.className = 'typing-indicator';
                    ind.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
                    container.appendChild(ind);
                    container.scrollTop = container.scrollHeight;
                } else if (!isTyping && ind) {
                    ind.remove();
                }
            }
            clearTimeout(this.typingTimers[userId]);
            if (isTyping) {
                this.typingTimers[userId] = setTimeout(() => {
                    const i = document.getElementById('typingIndicator');
                    if (i) i.remove();
                }, 4000);
            }
        };
    },

    /** Send mark_read via WebSocket so unread badge clears */
    markReadViaWS(fromUserId) {
        if (ws.connected) {
            ws.send({ type: 'mark_read', from_user_id: fromUserId });
        }
    },

    // search — api returns flat array
    async searchUsers(query) {
        try {
            const users = await api.searchUsers(query);
            this.showSearchResults(Array.isArray(users) ? users : []);
        } catch (e) { console.error('Search failed:', e); }
    },

    showSearchResults(users) {
        const dd = document.getElementById('searchResults');
        if (!dd) return;
        if (users.length === 0) {
            dd.innerHTML = `<div class="search-result-item text-muted">${I18n.t('nothing_found')}</div>`;
        } else {
            dd.innerHTML = users.map(u => {
                const initials = this.getInitials(u.first_name, u.last_name);
                const avatarHtml = u.avatar
                    ? `<div class="chat-avatar sm has-img"><img src="${u.avatar}" alt=""></div>`
                    : `<div class="chat-avatar sm">${initials}</div>`;
                return `<div class="search-result-item" data-id="${u.id}" data-username="${this.esc(u.username)}" data-first="${this.esc(u.first_name || '')}" data-last="${this.esc(u.last_name || '')}" data-avatar="${this.esc(u.avatar || '')}">
          ${avatarHtml}
          <div><div class="search-name">${this.esc(u.first_name || u.username)} ${this.esc(u.last_name || '')}</div><div class="search-sub">@${this.esc(u.username)}</div></div>
        </div>`;
            }).join('');
        }
        dd.classList.add('active');
        dd.querySelectorAll('.search-result-item[data-id]').forEach(el => {
            el.addEventListener('click', () => {
                this.openChat({
                    id: parseInt(el.dataset.id),
                    username: el.dataset.username,
                    first_name: el.dataset.first,
                    last_name: el.dataset.last,
                    avatar: el.dataset.avatar || ''
                });
                this.clearSearch();
            });
        });
    },

    hideSearchResults() {
        const dd = document.getElementById('searchResults');
        if (dd) dd.classList.remove('active');
    },

    /** Clear search input + dropdown — called when navigating away */
    clearSearch() {
        const input = document.getElementById('searchInputUser');
        if (input) input.textContent = '';
        this.hideSearchResults();
    },

    markReadViaWS(senderId) {
        // Send mark_read event to server so it can broadcast to the sender
        if (ws && ws.connected) {
            ws.send({
                type: 'mark_read',
                from_user_id: senderId
            });
        }
    },

    // chat list — api returns [{user:{...}, unread_count, is_online, last_seen, last_message}]
    async loadChats() {
        try {
            const data = await api.getChats();
            this.chats = Array.isArray(data) ? data : [];

            // Decrypt last messages
            if (Crypto.isReady) {
                await Promise.all(this.chats.map(async (c) => {
                    const msg = c.last_message;
                    if (msg && msg.iv && (msg.rsa_encrypted_aes_key_recipient || msg.rsa_encrypted_aes_key_sender)) {
                        try {
                            // Determine which key to use
                            const keyToUse = (msg.sender_id === this.currentUser.id)
                                ? msg.rsa_encrypted_aes_key_sender
                                : msg.rsa_encrypted_aes_key_recipient;

                            if (keyToUse) {
                                const plain = await Crypto.decryptMessage(msg.aes_encrypted_content, msg.iv, keyToUse);
                                if (plain) msg._decrypted = plain;
                            }
                        } catch (e) { console.warn('Failed to decrypt last msg:', e); }
                    }
                }));
            }

            this.renderChatList();
        } catch (e) { console.error('[loadChats]', e); }
    },

    renderChatList() {
        const list = document.getElementById('chatList');
        if (!list) return;
        if (this.chats.length === 0) {
            list.innerHTML = `<div class="empty-state"><span class="empty-icon">💬</span><p>${I18n.t('no_chats')}</p><p class="text-sm text-muted">${I18n.t('find_user_search')}</p></div>`;
            return;
        }
        list.innerHTML = this.chats.map(c => {
            const u = c.user || {};
            const active = this.currentChat && this.currentChat.id === u.id;
            const initials = this.getInitials(u.first_name, u.last_name);
            const lastMsg = c.last_message;

            // Show decrypted text if available, otherwise lock or raw
            let lastTextHtml = '';
            if (lastMsg) {
                if (lastMsg.self_destruct_seconds > 0) {
                    lastTextHtml = '<svg class=\"icon\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"color:var(--error);vertical-align:middle;\"><path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"></path></svg> ' + this.esc(I18n.t('self_destruct_msg') || 'Исчезающее сообщение');
                } else {
                    let rawText = '';
                    let prependHtml = '';
                    if (lastMsg._decrypted) {
                        rawText = lastMsg._decrypted;
                    } else if (lastMsg.iv && lastMsg.rsa_encrypted_aes_key_recipient) {
                        rawText = I18n.t('encrypted_message');
                        prependHtml = '<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px;margin-right:4px;opacity:0.8;\"><rect x=\"4\" y=\"11\" width=\"16\" height=\"11\" rx=\"2\" ry=\"2\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"></path></svg>';
                    } else {
                        rawText = lastMsg.aes_encrypted_content || lastMsg.content || '';
                    }
                    // Truncate
                    if (rawText.length > 30) rawText = rawText.substring(0, 30) + '...';
                    lastTextHtml = prependHtml + this.esc(rawText);
                }
            }

            const time = lastMsg ? this.formatTime(lastMsg.timestamp) : '';
            const name = `${u.first_name || u.username || '?'} ${u.last_name || ''}`.trim();
            // If this chat is currently open, unread = 0 (we're reading them)
            const unread = (active ? 0 : (c.unread_count || 0));
            const avatarHtml = u.avatar
                ? `<div class="chat-avatar has-img"><img src="${u.avatar}" alt=""><div class="online-dot" style="display:${c.is_online ? 'block' : 'none'}"></div></div>`
                : `<div class="chat-avatar">${initials}<div class="online-dot" style="display:${c.is_online ? 'block' : 'none'}"></div></div>`;
            return `<div class="chat-item ${active ? 'active' : ''}" data-id="${u.id}" 
                data-username="${this.esc(u.username)}" data-first="${this.esc(u.first_name || '')}" data-last="${this.esc(u.last_name || '')}" data-avatar="${this.esc(u.avatar || '')}">
        ${avatarHtml}
        <div class="chat-info"><div class="chat-name">${this.esc(name)}</div><div class="chat-last-msg">${lastTextHtml}</div></div>
        <div class="chat-meta"><span class="chat-time">${time}</span>${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}</div>
      </div>`;
        }).join('');
        list.querySelectorAll('.chat-item').forEach(el => {
            el.addEventListener('click', () => {
                this.openChat({
                    id: parseInt(el.dataset.id),
                    username: el.dataset.username,
                    first_name: el.dataset.first,
                    last_name: el.dataset.last,
                    avatar: el.dataset.avatar || ''
                });
            });
        });
    },

    // open chat
    async openChat(user) {
        this.currentChat = user;
        this.messages = [];
        this._loadingMore = false;
        this._hasMore = true;
        this._hasMore = true;
        // Clear search when opening any chat
        this.clearSearch();

        // Highlight in sidebar
        document.querySelectorAll('.chat-item').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.id) === user.id);
        });

        // Show chat, hide welcome
        document.getElementById('welcomeScreen').classList.add('hidden');
        const chatView = document.getElementById('chatView');
        chatView.classList.remove('hidden');
        chatView.style.display = 'flex';

        // Header avatar
        const headerAvatar = document.getElementById('chatHeaderAvatar');
        if (user.avatar) {
            headerAvatar.innerHTML = `<img src="${user.avatar}" alt="">`;
            headerAvatar.classList.add('has-img');
        } else {
            headerAvatar.textContent = this.getInitials(user.first_name, user.last_name);
            headerAvatar.classList.remove('has-img');
        }
        document.querySelector('#chatHeaderName .name').textContent = `${user.first_name || user.username} ${user.last_name || ''}`.trim();

        // Status
        try {
            const s = await api.getStatus(user.id);
            const el = document.getElementById('chatHeaderStatus');
            el.textContent = s.is_online ? I18n.t('online') : I18n.t('offline');
            el.className = 'status' + (s.is_online ? ' online' : '');
        } catch { document.getElementById('chatHeaderStatus').textContent = ''; }

        // Load messages (this also marks them as read on server)
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '<div class="loading-messages"><div class="spinner spinner-accent"></div></div>';

        try {
            const msgs = await api.getMessages(user.id, 15);
            this.messages = Array.isArray(msgs) ? msgs : [];
            this._hasMore = this.messages.length === 15;

            // Decrypt messages
            await this.decryptMessages(this.messages);

            this.renderMessages();
        } catch (e) {
            container.innerHTML = '<div class="loading-messages text-muted">Ошибка загрузки</div>';
        }

        // After loading messages — refresh chat list to clear unread badge
        this.loadChats();

        document.getElementById('messageInput').focus();

        // On mobile, switch to chat view
        if (window.innerWidth <= 768) this.showChatView();
        
        // Ensure timers loop is running
        this.startDestructTimerLoop();
    },

    startDestructTimerLoop() {
        if (this._destructInterval) return;
        this._destructInterval = setInterval(() => {
            if (!this.currentChat) return;
            document.querySelectorAll('.message[data-sd][data-read="true"]').forEach(el => {
                let remaining = parseInt(el.getAttribute('data-remaining'));
                if (isNaN(remaining)) {
                    remaining = parseInt(el.getAttribute('data-sd'));
                    el.setAttribute('data-remaining', remaining);
                }
                
                remaining -= 1;
                el.setAttribute('data-remaining', remaining);
                
                const timerSpan = el.querySelector('.sd-timer');
                if (remaining <= 0) {
                    if (!el.classList.contains('vanishing')) {
                        el.classList.add('vanishing');
                        if (timerSpan) timerSpan.innerHTML = '<svg class=\"icon\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"></path></svg> 0с';
                        // Mark as expired IMMEDIATELY in data arrays (prevents zombie on re-render)
                        const msgId = el.getAttribute('data-id');
                        this.messages = this.messages.filter(m => String(m.id) !== String(msgId));
                        // Close fullscreen image viewer if it's showing this message's photo
                        const viewerModal = document.getElementById('imageViewerModal');
                        if (viewerModal && !viewerModal.classList.contains('hidden')) {
                            const viewerImg = document.getElementById('imageViewerImg');
                            const msgImgs = el.querySelectorAll('img');
                            for (const mi of msgImgs) {
                                if (viewerImg && viewerImg.src === mi.src) {
                                    viewerModal.classList.add('hidden');
                                    break;
                                }
                            }
                        }
                        // Remove DOM element after animation
                        setTimeout(() => el.remove(), 400);
                    }
                } else {
                    if (timerSpan && !el.classList.contains('vanishing')) {
                        timerSpan.innerHTML = `🔥 ${remaining}с`;
                    }
                }
            });
        }, 1000);
    },

    // messages
    renderMessages(preserveScroll = false) {
        const c = document.getElementById('messagesContainer');
        const wasAtBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 100;
        const prevScrollTop = c.scrollTop;

        if (this.messages.length === 0) {
            c.innerHTML = `
                <div class="empty-chat" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                    <div style="background: var(--primary-color); width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto; box-shadow: 0 4px 15px rgba(var(--primary-color-rgb), 0.3);">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.5 14H15.5M8.5 10H15.5M21 12C21 16.4183 16.9706 20 12 20C10.4607 20 9.01172 19.5929 7.76045 18.8993C7.45788 18.7316 7.09703 18.6836 6.7628 18.7675L4.5 19.3358C3.99222 19.4632 3.53675 19.0078 3.66415 18.5L4.23253 16.2372C4.31641 15.903 4.26839 15.5421 4.10065 15.2395C3.40706 13.9883 3 12.5393 3 11C3 6.58172 7.02944 3 12 3C16.9706 3 21 6.58172 21 11Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <p style="font-size: 1.1rem; font-weight: 500">${I18n.t('start_chat')}</p>
                </div>
            `;
            return;
        }
        let html = '';
        // Removed load-more button
        html += this.messages.map(m => this.buildMsgHTML(m)).join('');
        c.innerHTML = html;
        
        if (!preserveScroll) {
            if (wasAtBottom) {
                c.scrollTop = c.scrollHeight;
            } else {
                c.scrollTop = prevScrollTop;
            }
        }

        // Trigger lazy loading for images
        c.querySelectorAll('.lazy-att').forEach(img => {
            const att = JSON.parse(decodeURIComponent(img.dataset.att));
            this.loadAttachment(att, img);
        });
        // Trigger lazy loading for audio
        c.querySelectorAll('.lazy-audio').forEach(audio => {
            const att = JSON.parse(decodeURIComponent(audio.dataset.att));
            this.loadAttachment(att, audio);
        });
    },

    buildMsgHTML(msg) {
        const mine = msg.sender_id === this.currentUser.id;
        const time = this.formatTime(msg.timestamp);
        const isEncrypted = !!(msg.is_encrypted || (msg.iv && msg.rsa_encrypted_aes_key_recipient));
        const isSelfDestruct = msg.self_destruct_seconds > 0;
        const hasImages = msg.attachments && msg.attachments.some(a => a.file_type && a.file_type.startsWith('image/'));

        // Show decrypted text, or placeholder for encrypted, or raw content
        let text = '';
        if (msg._decrypted) {
            text = this.esc(msg._decrypted);
        } else if (isEncrypted) {
            text = '';
        } else {
            text = this.esc(msg.content || msg.aes_encrypted_content || '');
        }

        let attachmentsHtml = '';
        if (msg.attachments && msg.attachments.length > 0) {
            const atts = msg.attachments.map(a => {
                const attData = encodeURIComponent(JSON.stringify(a));
                if (a.file_type && a.file_type.startsWith('image/')) {
                    const src = a.localUrl || '';
                    if (isSelfDestruct && !mine) {
                        // Self-destruct photo for RECEIVER: blurred with overlay
                        const isRevealed = !!msg.read_at;
                        return `<div class="sd-photo-wrap ${isRevealed ? 'revealed' : ''}" ${!isRevealed ? 'onclick="Chat.revealSdPhoto(this)"' : ''}>
                            <div class="sd-photo-overlay" style="${isRevealed ? 'display:none;' : ''}">
                                <div class="sd-eye" style="border:none; background:none; width:auto; height:auto; margin-bottom:5px;">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </div>
                                <div class="sd-label" style="text-align:center; max-width:90%; line-height:1.2;">${I18n.t('self_destruct_msg') || 'Исчезающее фото'}</div>
                            </div>
                            <img class="lazy-att" data-att="${attData}" src="${src}" alt="Photo">
                        </div>`;
                    }
                    return `<div class="att-image loading"><img class="lazy-att" data-att="${attData}" src="${src}" alt="Image"></div>`;
                } else if (a.file_type && a.file_type.startsWith('audio/')) {
                    const src = a.localUrl || '';
                    return `<div class="att-audio loading">
                        <audio class="lazy-audio" data-att="${attData}" controls preload="none" ${src ? `src="${src}"` : ''}></audio>
                        <button class="audio-download" title="Скачать">⬇️</button>
                    </div>`;
                } else {
                    const safeFileName = this.esc(a.file_name || 'file');
                    return `<div class="att-file" onclick="Chat.downloadFile('${a.id}', '${safeFileName}', '${attData}')">
                       <div class="att-file-icon">📄</div>
                       <div class="att-info">
                           <div class="att-name">${safeFileName}</div>
                           <div class="att-size">${this.formatSize(a.file_size)}</div>
                       </div>
                       <div class="att-download-icon">⬇️</div>
                   </div>`;
                }
            }).join('');
            attachmentsHtml = `<div class="message-attachments">${atts}</div>`;
        }

        let timerAttr = '';
        let timerHtml = '';
        if (isSelfDestruct) {
            timerAttr = ` data-sd="${msg.self_destruct_seconds}"`;
            let remaining = msg.self_destruct_seconds;
            
            if (hasImages) {
                // For SD photos: timer ONLY starts from server sd_started event
                // Server sets read_at when receiver clicks reveal_photo
                if (msg.read_at) {
                    timerAttr += ` data-read="true"`;
                    const elapsed = Math.floor((Date.now() - new Date(msg.read_at).getTime()) / 1000);
                    remaining = Math.max(0, msg.self_destruct_seconds - elapsed);
                }
                // If receiver hasn't clicked yet, no data-read → no countdown
            } else {
                // For text-only SD: timer starts on read (existing behavior)
                if (msg.read_at || (!msg.read_at && this.currentChat && !mine)) {
                    timerAttr += ` data-read="true"`;
                    if (msg.read_at) {
                        const elapsed = Math.floor((Date.now() - new Date(msg.read_at).getTime()) / 1000);
                        remaining = Math.max(0, msg.self_destruct_seconds - elapsed);
                    } else if (msg._local_read_at) {
                        const elapsed = Math.floor((Date.now() - msg._local_read_at) / 1000);
                        remaining = Math.max(0, msg.self_destruct_seconds - elapsed);
                    } else {
                        msg._local_read_at = Date.now();
                    }
                }
            }
            timerAttr += ` data-remaining="${remaining}"`;
            timerHtml = `<span class="sd-timer" style="color:var(--warning);font-size:12px;margin-right:2px;font-weight:600;"><svg class=\"icon\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"></path></svg> ${remaining}с</span> `;
        }

        // For SD photos on RECEIVER side, hide text until photo is revealed
        const textClass = (isSelfDestruct && hasImages && !mine && !msg.read_at) ? 'sd-hidden-text' : '';

        let readStatusHtml = '';
        if (mine) {
            if (msg.read_at) {
                // Double tick (read)
                readStatusHtml = `<span class="read-status read" title="Прочитано"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L7 17l-5-5"></path><path d="M22 10l-7.5 7.5L13 16"></path></svg></span>`;
            } else {
                // Single tick (sent)
                readStatusHtml = `<span class="read-status" title="Отправлено"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>`;
            }
        }

        return `<div class="message ${mine ? 'sent' : 'received'}" data-id="${msg.id || ''}"${timerAttr}>
      <div class="message-bubble">
        ${attachmentsHtml}
        ${text ? `<div class="message-text ${textClass}">${text}</div>` : ''}
        <div class="message-time">${isEncrypted ? '<span class="lock-icon"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px;margin-right:2px;\"><rect x=\"4\" y=\"11\" width=\"16\" height=\"11\" rx=\"2\" ry=\"2\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"></path></svg></span>' : ''} ${timerHtml}${time}${readStatusHtml}</div>
      </div>
    </div>`;
    },

    appendMessage(msg) {
        this.messages.push(msg);
        const c = document.getElementById('messagesContainer');
        const empty = c.querySelector('.empty-chat');
        if (empty) empty.remove();
        const typing = document.getElementById('typingIndicator');
        if (typing) typing.remove();
        c.insertAdjacentHTML('beforeend', this.buildMsgHTML(msg));
        // Trigger lazy loading for new attachment images
        c.querySelectorAll('.lazy-att:not([data-loaded])').forEach(img => {
            img.setAttribute('data-loaded', '1');
            const att = JSON.parse(decodeURIComponent(img.dataset.att));
            this.loadAttachment(att, img);
        });
        // Trigger lazy loading for new audio attachments
        c.querySelectorAll('.lazy-audio:not([data-loaded])').forEach(audio => {
            audio.setAttribute('data-loaded', '1');
            const att = JSON.parse(decodeURIComponent(audio.dataset.att));
            this.loadAttachment(att, audio);
        });
        c.scrollTop = c.scrollHeight;
    },

    async loadMoreMessages() {
        if (this._loadingMore || !this._hasMore || !this.currentChat || this.messages.length === 0) return;
        this._loadingMore = true;
        
        const c = document.getElementById('messagesContainer');
        const firstMsg = this.messages[0];

        // Add spinner at top
        c.insertAdjacentHTML('afterbegin', `
            <div id="loadMoreSpinner" style="text-align: center; padding: 10px 0; width: 100%; display: flex; justify-content: center;">
                <div class="spinner spinner-accent" style="width: 24px; height: 24px;"></div>
            </div>
        `);

        // Force 1 second delay
        await new Promise(r => setTimeout(r, 1000));

        try {
            const olderMsgs = await api.getMessages(this.currentChat.id, 15, firstMsg.id);
            
            // Remove spinner
            const spinner = document.getElementById('loadMoreSpinner');
            if (spinner) spinner.remove();

            if (olderMsgs && olderMsgs.length > 0) {
                await this.decryptMessages(olderMsgs);
                this.messages = [...olderMsgs, ...this.messages];
                this._hasMore = olderMsgs.length === 15;
                
                const prevHeight = c.scrollHeight;
                const prevScrollTop = c.scrollTop;
                const html = olderMsgs.map(m => this.buildMsgHTML(m)).join('');
                
                // Prepend HTML without destroying existing DOM elements
                c.insertAdjacentHTML('afterbegin', html);
                
                // Keep scroll position exactly where it was
                c.scrollTop = prevScrollTop + (c.scrollHeight - prevHeight);
                
                // Lazy load new images
                c.querySelectorAll('.lazy-att:not([data-loaded])').forEach(img => {
                    img.setAttribute('data-loaded', '1');
                    const att = JSON.parse(decodeURIComponent(img.dataset.att));
                    this.loadAttachment(att, img);
                });
                // Lazy load audio
                c.querySelectorAll('.lazy-audio:not([data-loaded])').forEach(audio => {
                    audio.setAttribute('data-loaded', '1');
                    const att = JSON.parse(decodeURIComponent(audio.dataset.att));
                    this.loadAttachment(att, audio);
                });
            } else {
                this._hasMore = false;
            }
        } catch (e) {
            console.error('[LoadMore]', e);
            const spinner = document.getElementById('loadMoreSpinner');
            if (spinner) spinner.remove();
        }

        this._loadingMore = false;
    },

    // ════════════════════════════════════════
    // SEND MESSAGE — NO ws.sendMessage()! Only REST API.
    // Server's REST endpoint already sends WS echo back to sender,
    // which we SKIP in ws.onMessage to prevent duplication.
    // ════════════════════════════════════════
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if ((!text && this.pendingAttachments.length === 0) || !this.currentChat) return;

        input.value = '';
        input.style.height = 'auto';
        input.focus();

        const attIds = this.pendingAttachments.map(a => a.id);
        const atts = [...this.pendingAttachments];
        this.pendingAttachments = [];
        this.renderPendingAttachments();

        // Get timer value
        const timerValInput = document.getElementById('timerSelect');
        const timerVal = timerValInput ? (parseInt(timerValInput.value) || 0) : 0;

        // Optimistic UI
        const tempId = 'temp_' + Date.now();
        const tempMsg = {
            id: tempId,
            sender_id: this.currentUser.id,
            recipient_id: this.currentChat.id,
            aes_encrypted_content: text,
            _decrypted: text,
            is_encrypted: true,
            timestamp: new Date().toISOString(),
            self_destruct_seconds: timerVal,
            attachments: atts.map(a => ({
                id: a.id,
                file_name: a.name,
                file_type: a.type,
                file_size: a.size,
                localUrl: a.localUrl,
                from_user_id: a.from_user_id || this.currentUser.id,
                rsa_encrypted_aes_key_recipient: a.rsa_encrypted_aes_key_recipient,
                rsa_encrypted_aes_key_sender: a.rsa_encrypted_aes_key_sender,
                iv: a.iv
            }))
        };
        this.appendMessage(tempMsg);

        try {
            if (!Crypto.isReady) {
                this.showToast('Шифрование не активно. Перезайдите.', 'error');
                this.messages = this.messages.filter(m => m.id !== tempId);
                const el = document.querySelector(`.message[data-id="${tempId}"]`);
                if (el) el.remove();
                return;
            }

            // Get recipient's public key
            const recipientKey = await Crypto.getRecipientPublicKey(this.currentChat.id);
            if (!recipientKey) {
                this.showToast('Получатель ещё не активировал шифрование', 'error');
                this.messages = this.messages.filter(m => m.id !== tempId);
                const el = document.querySelector(`.message[data-id="${tempId}"]`);
                if (el) el.remove();
                return;
            }

            const enc = await Crypto.encryptMessage(text, recipientKey);
            const serverMsg = await api.sendMessage(
                this.currentChat.id,
                enc.aes_encrypted_content,
                enc.rsa_encrypted_aes_key_recipient,
                enc.rsa_encrypted_aes_key_sender,
                enc.iv,
                attIds,
                timerVal
            );
            if (serverMsg && serverMsg.id) {
                Object.assign(tempMsg, serverMsg);
                tempMsg._decrypted = text;
                if (tempMsg.attachments && atts.length > 0) {
                    tempMsg.attachments.forEach(sa => {
                        const localAtt = atts.find(la => la.id === sa.id);
                        if (localAtt && localAtt.localUrl) sa.localUrl = localAtt.localUrl;
                    });
                }
                const msgEl = document.querySelector(`.message[data-id="${tempId}"]`);
                if (msgEl) msgEl.setAttribute('data-id', serverMsg.id);
            }
            this.loadChats();
        } catch (e) { this.showToast('Ошибка отправки', 'error'); }
    },

    /** Decrypt all loaded messages */
    async decryptMessages(msgs) {
        if (!Crypto.isReady) return;
        for (const msg of msgs) {
            if (!msg.iv || !msg.rsa_encrypted_aes_key_recipient) continue; // not encrypted
            if (msg._decrypted) continue; // already done
            try {
                const isMine = msg.sender_id === this.currentUser.id;
                // For own messages use rsa_encrypted_aes_key_sender, for others use rsa_encrypted_aes_key_recipient
                const keyToUse = isMine ? (msg.rsa_encrypted_aes_key_sender || msg.rsa_encrypted_aes_key_recipient) : msg.rsa_encrypted_aes_key_recipient;
                const plain = await Crypto.decryptMessage(msg.aes_encrypted_content, msg.iv, keyToUse);
                if (plain) msg._decrypted = plain;
            } catch { }
        }
    },

    // my profile modal (sidebar avatar/name click)
    async openMyProfile() {
        this.clearSearch(); // clear search when opening profile
        const modal = document.getElementById('profileModal');
        if (!modal) return;
        const u = this.currentUser;

        try { const fresh = await api.getMe(); Object.assign(this.currentUser, fresh); } catch { }

        const avatarEl = document.getElementById('profileAvatar');
        if (u.avatar) {
            avatarEl.innerHTML = `<img src="${u.avatar}" alt="">`;
            avatarEl.classList.add('has-img');
        } else {
            avatarEl.textContent = this.getInitials(u.first_name, u.last_name);
            avatarEl.classList.remove('has-img');
        }

        document.getElementById('profileName').textContent = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
        document.getElementById('profileUsername').textContent = '@' + (u.username || '');

        document.getElementById('editFirstName').value = u.first_name || '';
        document.getElementById('editLastName').value = u.last_name || '';
        const phoneInput = document.getElementById('editPhone');
        phoneInput.value = u.phone || '';
        if (this.iti) this.iti.setNumber(u.phone || '');

        const birthInput = document.getElementById('editBirth');
        birthInput.value = u.birth_date || '';
        if (birthInput._flatpickr) birthInput._flatpickr.setDate(u.birth_date || '');
        document.getElementById('editAbout').value = u.about || '';

        this.renderBlockedList();
        this.switchProfileTab(document.querySelector('.profile-tabs .tab'), 'tabProfileEdit');
        modal.classList.remove('hidden');
    },

    switchProfileTab(btn, tabId) {
        if (!btn) return;
        document.querySelectorAll('.profile-tabs .tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('#profileModal .tab-content').forEach(t => t.classList.add('hidden'));
        document.getElementById(tabId).classList.remove('hidden');
    },

    async saveProfile() {
        const firstName = document.getElementById('editFirstName').value.trim();
        const lastName = document.getElementById('editLastName').value.trim();
        const phone = this.iti ? this.iti.getNumber() : document.getElementById('editPhone').value.trim();
        const birthDate = document.getElementById('editBirth').value.trim();
        const about = document.getElementById('editAbout').value.trim();
        if (!firstName) { this.showToast('Имя обязательно', 'error'); return; }

        try {
            const updated = await api.updateProfile({ first_name: firstName, last_name: lastName, phone, birth_date: birthDate, about });
            Object.assign(this.currentUser, updated);
            api.saveUser(this.currentUser);
            document.getElementById('profileName').textContent = `${firstName} ${lastName}`.trim();
            document.getElementById('currentUserName').textContent = firstName;
            this.updateSidebarAvatar();
            this.showToast('Профиль сохранён', 'success');
        } catch (e) { this.showToast('Ошибка: ' + e.message, 'error'); }
    },

    async uploadAvatar() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { this.showToast('Макс. 5 МБ', 'error'); return; }
            try {
                const data = await api.uploadAvatar(file);
                this.currentUser.avatar = data.avatar;
                api.saveUser(this.currentUser);
                const avatarEl = document.getElementById('profileAvatar');
                avatarEl.innerHTML = `<img src="${data.avatar}" alt="">`;
                avatarEl.classList.add('has-img');
                this.updateSidebarAvatar();
                this.showToast('Фото обновлено', 'success');
            } catch (e) { this.showToast('Ошибка: ' + e.message, 'error'); }
        };
        input.click();
    },

    // other user's profile (click on chat header)
    async openOtherProfile() {
        if (!this.currentChat) return;
        const modal = document.getElementById('otherProfileModal');
        if (!modal) return;

        let u = this.currentChat;
        try { u = await api.getUser(this.currentChat.id); } catch { }

        const avatarEl = document.getElementById('otherProfileAvatar');
        if (u.avatar) {
            avatarEl.innerHTML = `<img src="${u.avatar}" alt="">`;
            avatarEl.classList.add('has-img');
        } else {
            avatarEl.textContent = this.getInitials(u.first_name, u.last_name);
            avatarEl.classList.remove('has-img');
        }

        document.getElementById('otherProfileName').textContent = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
        document.getElementById('otherProfileUsername').textContent = '@' + (u.username || '');
        document.getElementById('otherProfilePhone').textContent = u.phone || I18n.t('not_specified');
        document.getElementById('otherProfileBirth').textContent = u.birth_date || I18n.t('not_specified');
        document.getElementById('otherProfileAbout').textContent = u.about || I18n.t('not_specified');

        try {
            const s = await api.getStatus(this.currentChat.id);
            document.getElementById('otherProfileStatus').textContent = s.is_online ? '🟢 ' + I18n.t('online') : '⚫ ' + I18n.t('offline');
        } catch { document.getElementById('otherProfileStatus').textContent = ''; }

        // Fetch user details again to explicitly get public_key if not in this.currentChat
        let targetUser = u;
        if (!targetUser.public_key) {
            try { targetUser = await api.getUser(this.currentChat.id); } catch { }
        }
        const fpEl = document.getElementById('otherProfileFingerprint');
        if (targetUser.public_key) {
            const fp = await Crypto.getFingerprint(targetUser.public_key);
            fpEl.textContent = fp || I18n.t('not_available');
        } else {
            fpEl.textContent = I18n.t('not_available');
        }

        const isBlocked = this.blockedUsers.some(b => b.id === this.currentChat.id);
        const blockBtn = document.getElementById('otherProfileBlockBtn');
        blockBtn.innerHTML = isBlocked ? '<svg class=\"icon\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" ry=\"2\"></rect><path d=\"M7 11V7a5 5 0 0 1 9.9-1\"></path></svg> <span data-i18n="unblock_user">' + I18n.t('unblock_user') + '</span>' : '<svg class=\"icon\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><line x1=\"4.93\" y1=\"4.93\" x2=\"19.07\" y2=\"19.07\"></line></svg> <span data-i18n="block_user">' + I18n.t('block_user') + '</span>';
        blockBtn.onclick = () => {
            if (!isBlocked && !confirm(I18n.t('confirm_block'))) return;
            this.toggleBlock(this.currentChat.id, isBlocked);
        };

        document.getElementById('otherProfileWriteBtn').onclick = () => { modal.classList.add('hidden'); };
        document.getElementById('otherProfileClearBtn').onclick = () => {
            if (confirm(I18n.t('confirm_clear'))) this.clearChat(this.currentChat.id);
        };

        const adminBtn = document.getElementById('otherProfileAdminBanBtn');
        if (adminBtn) {
            if (this.currentUser && this.currentUser.role === 'super_admin') {
                adminBtn.classList.remove('hidden');
                const isBanned = u.is_banned;
                const handSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"></path><path d="M14 11V4a2 2 0 0 0-4 0v7"></path><path d="M10 11V3a2 2 0 0 0-4 0v8"></path><path d="M6 11V7a2 2 0 0 0-4 0v9a8 8 0 0 0 16 0v-5a2 2 0 0 0-4 0"></path></svg>';
                const checkSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
                adminBtn.innerHTML = isBanned 
                    ? checkSvg + '<span data-i18n="admin_unban">' + (I18n.t('admin_unban') !== 'admin_unban' ? I18n.t('admin_unban') : 'Разбанить (Админ)') + '</span>' 
                    : handSvg + '<span data-i18n="admin_ban">' + (I18n.t('admin_ban') !== 'admin_ban' ? I18n.t('admin_ban') : 'Глобальный Бан') + '</span>';
                adminBtn.style.color = isBanned ? 'var(--success)' : 'var(--error)';
                adminBtn.style.borderColor = isBanned ? 'var(--success)' : 'var(--error)';
                adminBtn.style.display = 'flex';
                adminBtn.style.alignItems = 'center';
                adminBtn.style.justifyContent = 'center';
                adminBtn.style.gap = '8px';
                adminBtn.setAttribute('data-banned', isBanned ? 'true' : 'false');
            } else {
                adminBtn.classList.add('hidden');
            }
        }

        modal.classList.remove('hidden');
    },

    async adminToggleBan() {
        if (!this.currentChat) return;
        const btn = document.getElementById('otherProfileAdminBanBtn');
        const isBanned = btn.getAttribute('data-banned') === 'true';
        const action = isBanned ? 'unban' : 'ban';
        
        const confirmMsg = action === 'ban' ? I18n.t('admin_confirm_ban') : I18n.t('admin_confirm_unban');
        if (!confirm(confirmMsg || (action === 'ban' ? 'Точно забанить пользователя (глобально)?' : 'Разбанить пользователя?'))) return;
        
        try {
            await api.adminBan(this.currentChat.id, action);
            const successMsg = action === 'ban' ? I18n.t('admin_success_ban') : I18n.t('admin_success_unban');
            alert(successMsg || (action === 'ban' ? 'Пользователь забанен!' : 'Пользователь разбанен!'));
            this.openOtherProfile(); // refresh
        } catch (e) {
            alert(e.message);
        }
    },

    // security verification modal
    async showSecurityVerification() {
        if (!this.currentChat) return;
        const modal = document.getElementById('securityVerificationModal');
        if (!modal) return;
        
        let theirFpText = '—';
        let theirKey = this.currentChat.public_key;
        if (!theirKey) {
            try { 
                const targetUser = await api.getUser(this.currentChat.id); 
                theirKey = targetUser.public_key;
            } catch { }
        }
        
        if (theirKey) {
            const fp = await Crypto.getFingerprint(theirKey);
            theirFpText = fp || 'Ошибка вычисления';
        } else {
            theirFpText = 'Ключ еще не загружен';
        }
        
        let myFpText = '—';
        if (Crypto.isReady && Crypto._publicKeyPem) {
            const myFp = await Crypto.getFingerprint(Crypto._publicKeyPem);
            myFpText = myFp || 'Ошибка вычисления';
        } else {
            myFpText = 'Ключ не активен';
        }
        
        document.getElementById('secTheirFingerprint').textContent = theirFpText;
        document.getElementById('secMyFingerprint').textContent = myFpText;
        
        modal.classList.remove('hidden');
    },

    // settings
    openSettings() {
        this.clearSearch();
        const modal = document.getElementById('settingsModal');
        if (!modal) return;

        document.getElementById('oldPassword').value = '';
        document.getElementById('newPassword').value = '';

        // Wire all tab buttons
        ['Appearance', 'Password', 'Privacy'].forEach(tab => {
            const btn = document.getElementById('btnTab' + tab);
            if (btn) btn.onclick = () => this.switchSettingsTab(tab);
        });

        // Show Appearance tab by default
        this.switchSettingsTab('Appearance');
        modal.classList.remove('hidden');
    },

    switchSettingsTab(tabName) {
        ['Appearance', 'Password', 'Privacy'].forEach(t => {
            const btn = document.getElementById('btnTab' + t);
            const content = document.getElementById('tab' + t);
            if (btn) btn.classList.toggle('active', t === tabName);
            if (content) content.classList.toggle('hidden', t !== tabName);
        });

        // Load key info when privacy tab is opened
        if (tabName === 'Privacy') this.loadKeyInfo();
    },

    async loadKeyInfo() {
        const card = document.getElementById('keyStatusCard');
        const icon = document.getElementById('keyStatusIcon');
        const title = document.getElementById('keyStatusTitle');
        const sub = document.getElementById('keyStatusSub');
        const fingerprint = document.getElementById('keyFingerprint');
        const pemEl = document.getElementById('keyPublicPem');
        const privStatus = document.getElementById('keyPrivateStatus');

        if (Crypto.isReady && Crypto._publicKeyPem) {
            // Keys exist and loaded
            card.className = 'key-status-card active';
            icon.textContent = '🔒︎';
            icon.style.opacity = '0.5';
            title.textContent = I18n.t('key_active_title');
            sub.textContent = 'RSA-2048 + AES-256-GCM';

            // Show public key PEM
            pemEl.value = Crypto._publicKeyPem;

            // Generate fingerprint (SHA-256 of public key)
            const fp = await Crypto.getFingerprint(Crypto._publicKeyPem);
            fingerprint.textContent = fp ? fp : I18n.t('fingerprint_error');

            // Private key status
            const hasKeys = Crypto.hasKeys(`${this.currentUser.id}_${this.currentUser.username}`);
            privStatus.innerHTML = hasKeys
                ? I18n.t('privkey_saved')
                : I18n.t('privkey_not_found');

        } else {
            // No keys
            card.className = 'key-status-card inactive';
            icon.textContent = '❌';
            icon.style.opacity = '1';
            title.textContent = I18n.t('key_missing_title');
            sub.textContent = I18n.t('key_missing_sub');
            pemEl.value = '';
            fingerprint.textContent = '—';
            privStatus.innerHTML = I18n.t('privkey_not_loaded');
        }
    },

    copyPublicKey() {
        const pem = document.getElementById('keyPublicPem').value;
        if (!pem) { this.showToast(I18n.t('copy_no_key'), 'error'); return; }
        navigator.clipboard.writeText(pem).then(() => {
            this.showToast(I18n.t('copy_success'), 'success');
        }).catch(() => {
            // Fallback
            const el = document.getElementById('keyPublicPem');
            el.select();
            document.execCommand('copy');
            this.showToast(I18n.t('copy_success'), 'success');
        });
    },

    async regenerateKeys() {
        if (!confirm(I18n.t('regen_confirm'))) return;

        const pw = sessionStorage.getItem('bernet_pin');
        if (!pw) {
            this.showToast(I18n.t('regen_relogin'), 'error');
            return;
        }

        try {
            this.showToast(I18n.t('regen_generating'), '');

            // Generate new keypair
            await Crypto.generateKeypair();

            // Save to localStorage (encrypted with password)
            await Crypto.saveKeysToStorage(`${this.currentUser.id}_${this.currentUser.username}`, pw);

            // Upload new public key to server
            await Crypto.uploadPublicKey();

            // Clear key cache (recipients' keys)
            Crypto._keyCache = {};
            Crypto._ready = true;

            // Refresh display
            await this.loadKeyInfo();

            this.showToast('Ключи обновлены ✅', 'success');
        } catch (e) {
            console.error('[Keys] Regeneration failed:', e);
            this.showToast('Ошибка генерации: ' + e.message, 'error');
        }
    },

    async changePassword() {
        const oldPw = document.getElementById('oldPassword').value;
        const newPw = document.getElementById('newPassword').value;
        if (!oldPw || !newPw) { this.showToast('Заполните оба поля', 'error'); return; }
        if (newPw.length < 4) { this.showToast('Мин. 4 символа', 'error'); return; }
        try {
            await api.login(this.currentUser.username, oldPw);
            this.showToast('Пароль изменён', 'success');
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
        } catch { this.showToast('Неверный старый пароль', 'error'); }
    },

    // block / unblock
    async loadBlocked() {
        try {
            const data = await api.getBlocked();
            this.blockedUsers = Array.isArray(data) ? data : [];
        } catch { this.blockedUsers = []; }
    },

    async toggleBlock(userId, isBlocked) {
        try {
            if (isBlocked) {
                await api.unblockUser(userId);
                this.showToast('Разблокирован', 'success');
            } else {
                await api.blockUser(userId);
                this.showToast('Заблокирован', 'success');
            }
            await this.loadBlocked();
            this.loadChats();
            document.getElementById('otherProfileModal')?.classList.add('hidden');
            this.renderBlockedList();
            
            if (!isBlocked && this.currentChat && this.currentChat.id === userId) {
                this.currentChat = null;
                document.getElementById('chatView').classList.add('hidden');
                document.getElementById('chatView').style.display = 'none';
                document.getElementById('welcomeScreen').classList.remove('hidden');
            }
        } catch (e) { this.showToast('Ошибка: ' + e.message, 'error'); }
    },

    renderBlockedList() {
        const container = document.getElementById('blockedList');
        if (!container) return;
        if (this.blockedUsers.length === 0) {
            container.innerHTML = `<p class="text-muted text-sm">${I18n.t('no_blocked_users')}</p>`;
            return;
        }
        container.innerHTML = this.blockedUsers.map(b => {
            const name = `${b.first_name || b.username || '?'} ${b.last_name || ''}`.trim();
            return `<div class="blocked-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 10px; border-bottom: 1px solid var(--border-color);">
        <span style="font-weight: 500">${this.esc(name)}</span>
        <button class="btn btn-outline" style="border-radius: 8px; padding: 6px 14px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;" onclick="Chat.toggleBlock(${b.id}, true)">
            <svg class=\"icon\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" ry=\"2\"></rect><path d=\"M7 11V7a5 5 0 0 1 9.9-1\"></path></svg> ${I18n.t('unblock_user')}
        </button>
      </div>`;
        }).join('');
    },

    // clear chat
    async clearChat(userId) {
        if (!confirm(I18n.t('confirm_clear'))) return;
        try {
            await api.clearChat(userId);
            this.messages = [];
            this.currentChat = null;
            
            // Hide chat area, show welcome screen
            const chatView = document.getElementById('chatView');
            const welcomeScreen = document.getElementById('welcomeScreen');
            if (chatView) chatView.classList.add('hidden');
            if (welcomeScreen) welcomeScreen.classList.remove('hidden');
            
            // Go back to list on mobile
            document.querySelector('.app-layout').classList.remove('show-chat');
            
            this.loadChats();
            document.getElementById('otherProfileModal')?.classList.add('hidden');
            this.showToast(I18n.t('chat_cleared'), 'success');
        } catch (e) { this.showToast('Ошибка: ' + e.message, 'error'); }
    },

    // chat menu
    showChatMenu(e) {
        if (!this.currentChat) return;
        const menu = document.getElementById('chatContextMenu');
        if (!menu) return;
        menu.classList.toggle('active');
        const rect = e.target.getBoundingClientRect();
        menu.style.top = rect.bottom + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';
        setTimeout(() => {
            const close = (ev) => { if (!menu.contains(ev.target)) { menu.classList.remove('active'); document.removeEventListener('click', close); } };
            document.addEventListener('click', close);
        }, 10);
    },

    // mobile — telegram-like navigation
    showChatView() {
        document.querySelector('.app-layout').classList.add('show-chat');
    },

    goBackToList() {
        document.querySelector('.app-layout').classList.remove('show-chat');
        this.clearSearch();
    },

    // logout
    logout() {
        ws.disconnect();
        api.clearToken();
        sessionStorage.removeItem('bernet_pin');
        window.location.href = '/web/';
    },



    // helpers
    getInitials(f, l) {
        return ((f || '?')[0] + ((l || '')[0] || '')).toUpperCase();
    },

    formatTime(ts) {
        if (!ts) return '';
        try {
            const d = new Date(ts);
            const now = new Date();
            if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        } catch { return ''; }
    },

    formatSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    esc(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    },

    showToast(msg, type = '') {
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
    },

    /** Reveal a self-destruct photo — one-time view */
    revealSdPhoto(wrapEl) {
        if (wrapEl.classList.contains('revealed')) return; // already opened
        wrapEl.classList.add('revealed');

        // Find the parent .message element
        const msgEl = wrapEl.closest('.message');
        if (!msgEl) return;

        // Show hidden text
        msgEl.classList.add('sd-revealed');

        // Get the message ID and send reveal_photo to server
        // Server will set read_at and broadcast sd_started to BOTH users
        const messageId = msgEl.getAttribute('data-id');
        if (messageId && ws && ws.connected) {
            ws.send({ type: 'reveal_photo', message_id: messageId });
        }
    },

    // self destruct timer ui
    toggleTimerMenu(e) {
        e.stopPropagation();
        const menu = document.getElementById('timerMenu');
        if (!menu) return;
        menu.classList.toggle('hidden');
        if (!menu.classList.contains('hidden')) {
            const close = (ev) => { 
                if (!menu.contains(ev.target)) { 
                    menu.classList.add('hidden'); 
                    document.removeEventListener('click', close); 
                } 
            };
            document.addEventListener('click', close);
        }
    },

    setTimer(val, el) {
        document.getElementById('timerSelect').value = val;
        document.querySelectorAll('.timer-option').forEach(o => o.classList.remove('active'));
        if (el) el.classList.add('active');
        
        const btn = document.getElementById('timerBtn');
        if (val > 0) {
            btn.style.color = 'var(--warning)';
            btn.innerHTML = '<svg class=\"icon\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"></path></svg><span style="font-size:10px;display:block;margin-top:-5px">' + val + 's</span>';
        } else {
            btn.style.color = 'var(--text-secondary)';
            btn.innerHTML = '<svg class=\"icon\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"></path></svg>';
        }
        document.getElementById('timerMenu').classList.add('hidden');
    },

    // --- Admin Panel ---
    adminCurrentPage: 1,
    adminSearchQuery: '',
    adminLimit: 50,

    async openAdminPanel() {
        document.getElementById('adminModal').classList.remove('hidden');
        document.getElementById('adminSearchInput').value = '';
        this.adminCurrentPage = 1;
        this.adminSearchQuery = '';
        await this.renderAdminUsers();
    },

    async adminSearch(val) {
        this.adminSearchQuery = val.trim();
        this.adminCurrentPage = 1;
        await this.renderAdminUsers();
    },

    async adminChangePage(delta) {
        this.adminCurrentPage += delta;
        await this.renderAdminUsers();
    },

    async renderAdminUsers() {
        const list = document.getElementById('adminUsersList');
        try {
            const data = await api.getAdminUsers(this.adminSearchQuery, this.adminCurrentPage, this.adminLimit);
            const users = data.users;
            const total = data.total;

            const pagination = document.getElementById('adminPagination');
            const pageInfo = document.getElementById('adminPageInfo');
            const prevBtn = document.getElementById('adminPrevBtn');
            const nextBtn = document.getElementById('adminNextBtn');

            if (total > this.adminLimit) {
                pagination.style.display = 'flex';
                const totalPages = Math.ceil(total / this.adminLimit);
                pageInfo.textContent = `${this.adminCurrentPage} / ${totalPages}`;
                prevBtn.disabled = this.adminCurrentPage === 1;
                nextBtn.disabled = this.adminCurrentPage === totalPages;
            } else {
                pagination.style.display = 'none';
            }

            if (users.length === 0) {
                list.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">${I18n.t('admin_no_users') || 'Нет пользователей'}</div>`;
                return;
            }

            let html = '';
            for (const u of users) {
                const isSuper = u.role === 'super_admin';
                const isAdmin = u.role === 'admin';
                const isBanned = u.is_banned;
                const isSelf = String(u.id) === String(this.currentUser.id);
                
                // Don't show action buttons for super_admin, for self, or if we are a regular admin and they are an admin
                let actionsHtml = '';
                const isPeerAdmin = this.currentUser.role === 'admin' && isAdmin;
                if (!isSuper && !isSelf && !isPeerAdmin) {
                    const banAction = isBanned ? 'unban' : 'ban';
                    const banColor = isBanned ? 'var(--success)' : 'var(--error)';
                    const banText = isBanned ? (I18n.t('admin_unban') || 'Разбанить') : (I18n.t('admin_ban') || 'Забанить');
                    
                    const roleAction = isAdmin ? 'user' : 'admin';
                    const roleColor = isAdmin ? 'var(--text-muted)' : 'var(--accent)';
                    const roleText = isAdmin ? (I18n.t('admin_role_revoke') || 'Забрать Админа') : (I18n.t('admin_role_grant') || 'Дать Админа');

                    actionsHtml = `
                        <div style="display: flex; gap: 8px;">
                            <button onclick="Chat.adminToggleRole(${u.id}, '${roleAction}')" class="btn btn-outline" style="padding: 4px 8px; font-size: 0.8rem; border-color: ${roleColor}; color: ${roleColor};">${roleText}</button>
                            <button onclick="Chat.adminToggleBan(${u.id}, '${banAction}')" class="btn btn-outline" style="padding: 4px 8px; font-size: 0.8rem; border-color: ${banColor}; color: ${banColor};">${banText}</button>
                        </div>
                    `;
                }

                const roleBadge = isSuper ? `<span style="color:var(--accent); font-weight:bold; font-size:0.8rem; margin-left:8px;">${I18n.t('admin_role_super') || '[Super Admin]'}</span>` 
                                          : (isAdmin ? `<span style="color:var(--primary); font-size:0.8rem; margin-left:8px;">${I18n.t('admin_role_admin') || '[Admin]'}</span>` : '');
                const banBadge = isBanned ? `<span style="color:var(--error); font-size:0.8rem; margin-left:8px;">${I18n.t('admin_banned') || '[Забанен]'}</span>` : '';

                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-hover); border-radius: 8px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div class="chat-avatar sm">${u.avatar ? `<img src="${u.avatar}">` : this.getInitials(u.first_name, u.last_name)}</div>
                            <div>
                                <div style="font-weight: 500;">${u.first_name || ''} ${u.last_name || ''} ${roleBadge} ${banBadge}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">@${u.username} • ID: ${u.id}</div>
                            </div>
                        </div>
                        ${actionsHtml}
                    </div>
                `;
            }
            list.innerHTML = html;
        } catch (e) {
            console.error(e);
            list.innerHTML = `<div style="text-align: center; color: var(--error); padding: 20px;">${I18n.t('admin_error') || 'Ошибка загрузки:'} ${e.message}</div>`;
        }
    },

    async adminToggleRole(userId, newRole) {
        const msg = newRole === 'admin' ? (I18n.t('admin_confirm_grant') || 'Вы уверены?') : (I18n.t('admin_confirm_revoke') || 'Вы уверены?');
        if (!confirm(msg)) return;
        try {
            await api.adminUpdateRole(userId, newRole);
            this.showToast('Успешно', 'success');
            await this.renderAdminUsers();
        } catch (e) {
            this.showToast('Ошибка: ' + e.message, 'error');
        }
    },

    async adminToggleBan(userId, action) {
        const msg = action === 'ban' ? (I18n.t('admin_confirm_ban_user') || 'Вы уверены?') : (I18n.t('admin_confirm_unban_user') || 'Вы уверены?');
        if (!confirm(msg)) return;
        try {
            await api.adminBan(userId, action);
            this.showToast(action === 'ban' ? (I18n.t('admin_success_ban') || 'Забанен') : (I18n.t('admin_success_unban') || 'Разбанен'), 'success');
            await this.renderAdminUsers();
        } catch (e) {
            this.showToast('Ошибка: ' + e.message, 'error');
        }
    }
};

window.Chat = Chat;
