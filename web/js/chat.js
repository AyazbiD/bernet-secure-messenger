// main chat module
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
    },

    // theme and language
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
        // re-render dynamic content with new language
        this.renderChatList();
        this.renderBlockedList();
        if (this.currentChat) this.renderMessages();
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

    // event handlers
    bindEvents() {
        // Search input
        const searchInput = document.getElementById('searchInput');
        let searchTimer;
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimer);
                const q = searchInput.value.trim();
                if (q.length >= 2) {
                    searchTimer = setTimeout(() => this.searchUsers(q), 300);
                } else {
                    this.hideSearchResults();
                }
            });
            searchInput.addEventListener('focus', () => {
                const q = searchInput.value.trim();
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
                formData.append('encrypted_aes_key', encrypted.encryptedKey);
                formData.append('sender_encrypted_key', encrypted.senderEncryptedKey);
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
                    encrypted_aes_key: uploaded.encrypted_aes_key,
                    sender_encrypted_key: uploaded.sender_encrypted_key,
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
                ? att.sender_encrypted_key
                : att.encrypted_aes_key;

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
                ? att.sender_encrypted_key
                : att.encrypted_aes_key;

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
            if (Crypto.isReady && msg.iv && msg.encrypted_aes_key) {
                try {
                    const plain = await Crypto.decryptMessage(msg.encrypted_content, msg.iv, msg.encrypted_aes_key);
                    if (plain) msg._decrypted = plain;
                } catch { }
            }

            // Incoming message from other user
            if (this.currentChat && msg.sender_id === this.currentChat.id) {
                this.appendMessage(msg);
                this.markReadViaWS(msg.sender_id);
            }
            this.loadChats();
        };

        ws.onStatusUpdate = (userId, isOnline) => {
            const dot = document.querySelector(`.chat-item[data-id="${userId}"] .online-dot`);
            if (dot) dot.style.display = isOnline ? 'block' : 'none';
            if (this.currentChat && this.currentChat.id === userId) {
                const el = document.getElementById('chatHeaderStatus');
                if (el) { el.textContent = isOnline ? 'в сети' : 'не в сети'; el.className = 'status' + (isOnline ? ' online' : ''); }
            }
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

    markReadViaWS(fromUserId) {
        if (ws.connected) {
            ws.send({ type: 'mark_read', from_user_id: fromUserId });
        }
    },

    // search
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
            dd.innerHTML = '<div class="search-result-item text-muted">Ничего не найдено</div>';
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

    clearSearch() {
        const input = document.getElementById('searchInput');
        if (input) input.value = '';
        this.hideSearchResults();
    },

    // chat list
    async loadChats() {
        try {
            const data = await api.getChats();
            this.chats = Array.isArray(data) ? data : [];

            // Decrypt last messages
            if (Crypto.isReady) {
                await Promise.all(this.chats.map(async (c) => {
                    const msg = c.last_message;
                    if (msg && msg.iv && (msg.encrypted_aes_key || msg.sender_encrypted_key)) {
                        try {
                            // Determine which key to use
                            const keyToUse = (msg.sender_id === this.currentUser.id)
                                ? msg.sender_encrypted_key
                                : msg.encrypted_aes_key;

                            if (keyToUse) {
                                const plain = await Crypto.decryptMessage(msg.encrypted_content, msg.iv, keyToUse);
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
            list.innerHTML = `<div class="empty-state"><span class="empty-icon">💬</span><p>${I18n.t('no_chats')}</p><p class="text-sm text-muted">${I18n.t('find_user_hint')}</p></div>`;
            return;
        }
        list.innerHTML = this.chats.map(c => {
            const u = c.user || {};
            const active = this.currentChat && this.currentChat.id === u.id;
            const initials = this.getInitials(u.first_name, u.last_name);
            const lastMsg = c.last_message;

            // Show decrypted text if available, otherwise lock or raw
            let lastText = '';
            if (lastMsg) {
                if (lastMsg._decrypted) {
                    lastText = lastMsg._decrypted;
                } else if (lastMsg.iv && lastMsg.encrypted_aes_key) {
                    lastText = I18n.t('encrypted_message');
                } else {
                    lastText = lastMsg.encrypted_content || lastMsg.content || '';
                }
                // Truncate
                if (lastText.length > 30) lastText = lastText.substring(0, 30) + '...';
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
        <div class="chat-info"><div class="chat-name">${this.esc(name)}</div><div class="chat-last-msg">${this.esc(lastText)}</div></div>
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
        this._allMessages = [];

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
            el.textContent = s.is_online ? 'в сети' : 'не в сети';
            el.className = 'status' + (s.is_online ? ' online' : '');
        } catch { document.getElementById('chatHeaderStatus').textContent = ''; }

        // Load messages (this also marks them as read on server)
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '<div class="loading-messages"><div class="spinner spinner-accent"></div></div>';

        try {
            const all = await api.getMessages(user.id);
            this._allMessages = Array.isArray(all) ? all : [];

            // Decrypt all messages
            await this.decryptAllMessages();

            // Show last 30 messages
            const showCount = Math.min(30, this._allMessages.length);
            this.messages = this._allMessages.slice(-showCount);
            this._hasMore = showCount < this._allMessages.length;
            this.renderMessages();
        } catch (e) {
            container.innerHTML = '<div class="loading-messages text-muted">Ошибка загрузки</div>';
        }

        // After loading messages — refresh chat list to clear unread badge
        this.loadChats();

        document.getElementById('messageInput').focus();

        // On mobile, switch to chat view
        if (window.innerWidth <= 768) this.showChatView();
    },

    // messages
    renderMessages() {
        const c = document.getElementById('messagesContainer');
        if (this.messages.length === 0) {
            c.innerHTML = `<div class="empty-chat"><span>✉️</span><p>${I18n.t('start_chat')}</p></div>`;
            return;
        }
        let html = '';
        if (this._hasMore) {
            html += `<div class="load-more"><button onclick="Chat.loadMoreMessages()">${I18n.t('load_more')}</button></div>`;
        }
        html += this.messages.map(m => this.buildMsgHTML(m)).join('');
        c.innerHTML = html;
        c.scrollTop = c.scrollHeight;

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
        const isEncrypted = !!(msg.iv && msg.encrypted_aes_key);

        // Show decrypted text, or placeholder for encrypted, or raw content
        let text = '';
        if (msg._decrypted) {
            text = this.esc(msg._decrypted);
        } else if (isEncrypted) {
            // Don't show base64 encrypted content — show nothing or placeholder
            text = '';
        } else {
            text = this.esc(msg.content || msg.encrypted_content || '');
        }

        let attachmentsHtml = '';
        if (msg.attachments && msg.attachments.length > 0) {
            const atts = msg.attachments.map(a => {
                const attData = encodeURIComponent(JSON.stringify(a));
                if (a.file_type && a.file_type.startsWith('image/')) {
                    // IMAGE — clickable, fullscreen preview
                    const src = a.localUrl || '';
                    return `<div class="att-image loading"><img class="lazy-att" data-att="${attData}" src="${src}" alt="Image"></div>`;
                } else if (a.file_type && a.file_type.startsWith('audio/')) {
                    // AUDIO — inline player
                    const src = a.localUrl || '';
                    return `<div class="att-audio loading">
                        <audio class="lazy-audio" data-att="${attData}" controls preload="none" ${src ? `src="${src}"` : ''}></audio>
                        <button class="audio-download" title="Скачать">⬇️</button>
                    </div>`;
                } else {
                    // FILE — download card
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

        return `<div class="message ${mine ? 'sent' : 'received'}" data-id="${msg.id || ''}">
      <div class="message-bubble">
        ${attachmentsHtml}
        ${text ? `<div class="message-text">${text}</div>` : ''}
        <div class="message-time">${isEncrypted ? '<span class="lock-icon">🔒</span>' : ''} ${time}</div>
      </div>
    </div>`;
    },

    appendMessage(msg) {
        this.messages.push(msg);
        this._allMessages.push(msg);
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

    loadMoreMessages() {
        if (this._loadingMore || !this._hasMore || !this.currentChat) return;
        this._loadingMore = true;
        const currentCount = this.messages.length;
        const newCount = Math.min(currentCount + 20, this._allMessages.length);
        this.messages = this._allMessages.slice(-newCount);
        this._hasMore = newCount < this._allMessages.length;
        const c = document.getElementById('messagesContainer');
        const prevHeight = c.scrollHeight;
        this.renderMessages();
        c.scrollTop = c.scrollHeight - prevHeight;
        this._loadingMore = false;
    },

    // send message via rest api
    // server sends the ws notification itself
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

        // Optimistic UI
        try {
            if (!Crypto.isReady) {
                this.showToast(I18n.t('crypto_inactive'), 'error');
                return;
            }

            // Get recipient's public key
            const recipientKey = await Crypto.getRecipientPublicKey(this.currentChat.id);
            if (!recipientKey) {
                this.showToast(I18n.t('no_recipient_encryption'), 'error');
                return;
            }

            const enc = await Crypto.encryptMessage(text, recipientKey);

            // Optimistic UI - ONLY AFTER ENCRYPTION SUCCEEDS
            const tempMsg = {
                sender_id: this.currentUser.id,
                recipient_id: this.currentChat.id,
                encrypted_content: enc.encrypted_content, // use real encrypted content
                _decrypted: text,
                timestamp: new Date().toISOString(),
                iv: enc.iv,
                encrypted_aes_key: enc.encrypted_aes_key,
                sender_encrypted_key: enc.sender_encrypted_key,
                attachments: atts.map(a => ({
                    id: a.id,
                    file_name: a.name,
                    file_type: a.type,
                    file_size: a.size,
                    localUrl: a.localUrl,
                    from_user_id: a.from_user_id || this.currentUser.id,
                    encrypted_aes_key: a.encrypted_aes_key,
                    sender_encrypted_key: a.sender_encrypted_key,
                    iv: a.iv
                }))
            };
            this.appendMessage(tempMsg);
            
            // update temp message so lock icon shows right away
            const c = document.getElementById('messagesContainer');
            const bubble = c.querySelector('.message:last-child .message-time');
            if (bubble && !bubble.querySelector('.lock-icon')) {
                bubble.insertAdjacentHTML('afterbegin', '<span class="lock-icon">🔒</span> ');
            }

            await api.sendMessage(
                this.currentChat.id,
                enc.encrypted_content,
                enc.encrypted_aes_key,
                enc.sender_encrypted_key,
                enc.iv,
                attIds
            );
            this.loadChats();
        } catch (e) { this.showToast(I18n.t('send_error'), 'error'); }
    },

    async decryptAllMessages() {
        if (!Crypto.isReady) return;
        for (const msg of this._allMessages) {
            if (!msg.iv || !msg.encrypted_aes_key) continue; // not encrypted
            if (msg._decrypted) continue; // already done
            try {
                const isMine = msg.sender_id === this.currentUser.id;
                // For own messages use sender_encrypted_key, for others use encrypted_aes_key
                const keyToUse = isMine ? (msg.sender_encrypted_key || msg.encrypted_aes_key) : msg.encrypted_aes_key;
                const plain = await Crypto.decryptMessage(msg.encrypted_content, msg.iv, keyToUse);
                if (plain) msg._decrypted = plain;
            } catch { }
        }
    },

    // my profile
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
        document.getElementById('editPhone').value = u.phone || '';
        document.getElementById('editBirth').value = u.birth_date || '';
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
        const phone = document.getElementById('editPhone').value.trim();
        const birthDate = document.getElementById('editBirth').value.trim();
        const about = document.getElementById('editAbout').value.trim();
        if (!firstName) { this.showToast(I18n.t('error'), 'error'); return; }

        try {
            const updated = await api.updateProfile({ first_name: firstName, last_name: lastName, phone, birth_date: birthDate, about });
            Object.assign(this.currentUser, updated);
            api.saveUser(this.currentUser);
            document.getElementById('profileName').textContent = `${firstName} ${lastName}`.trim();
            document.getElementById('currentUserName').textContent = firstName;
            this.updateSidebarAvatar();
            this.showToast(I18n.t('profile_saved'), 'success');
        } catch (e) { this.showToast('Ошибка: ' + e.message, 'error'); }
    },

    async uploadAvatar() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { this.showToast('Max 5 MB', 'error'); return; }
            try {
                const data = await api.uploadAvatar(file);
                this.currentUser.avatar = data.avatar;
                api.saveUser(this.currentUser);
                const avatarEl = document.getElementById('profileAvatar');
                avatarEl.innerHTML = `<img src="${data.avatar}" alt="">`;
                avatarEl.classList.add('has-img');
                this.updateSidebarAvatar();
                this.showToast(I18n.t('profile_saved'), 'success');
            } catch (e) { this.showToast('Ошибка: ' + e.message, 'error'); }
        };
        input.click();
    },

    // other user's profile
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
        document.getElementById('otherProfileBirth').textContent = u.birth_date || I18n.t('not_specified_f');
        document.getElementById('otherProfileAbout').textContent = u.about || I18n.t('not_specified_n');

        try {
            const s = await api.getStatus(this.currentChat.id);
            document.getElementById('otherProfileStatus').textContent = s.is_online ? `🟢 ${I18n.t('online')}` : `⚫ ${I18n.t('offline')}`;
        } catch { document.getElementById('otherProfileStatus').textContent = ''; }

        const isBlocked = this.blockedUsers.some(b => b.id === this.currentChat.id);
        const blockBtn = document.getElementById('otherProfileBlockBtn');
        blockBtn.textContent = isBlocked ? `🔓 ${I18n.t('unblock_user')}` : `🚫 ${I18n.t('block_user')}`;
        blockBtn.onclick = () => this.toggleBlock(this.currentChat.id, isBlocked);

        document.getElementById('otherProfileWriteBtn').onclick = () => { modal.classList.add('hidden'); };
        document.getElementById('otherProfileClearBtn').onclick = () => this.clearChat(this.currentChat.id);

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
            icon.textContent = '✅';
            title.textContent = I18n.t('encryption_active_title');
            sub.textContent = 'RSA-2048 + AES-256-GCM';

            // Show public key PEM
            pemEl.value = Crypto._publicKeyPem;

            // Generate fingerprint (SHA-256 of public key)
            try {
                const pubBuf = Crypto._pemToBuffer(Crypto._publicKeyPem);
                const hashBuf = await crypto.subtle.digest('SHA-256', pubBuf);
                const hashArr = Array.from(new Uint8Array(hashBuf));
                const fp = hashArr.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
                fingerprint.textContent = fp;
            } catch {
                fingerprint.textContent = I18n.t('error');
            }

            // Private key status
            const hasKeys = Crypto.hasKeys(this.currentUser.id);
            privStatus.innerHTML = hasKeys
                ? '🟢 Stored encrypted (PBKDF2 + AES-GCM)'
                : '🔴 Not found';

        } else {
            // No keys
            card.className = 'key-status-card inactive';
            icon.textContent = '❌';
            title.textContent = I18n.t('encryption_inactive_title');
            sub.textContent = I18n.t('press_regen');;
            pemEl.value = '';
            fingerprint.textContent = '—';
            privStatus.innerHTML = '🔴 Not loaded';
        }
    },

    copyPublicKey() {
        const pem = document.getElementById('keyPublicPem').value;
        if (!pem) { this.showToast(I18n.t('error'), 'error'); return; }
        navigator.clipboard.writeText(pem).then(() => {
            this.showToast(I18n.t('copy_btn') + ' ✅', 'success');
        }).catch(() => {
            // Fallback
            const el = document.getElementById('keyPublicPem');
            el.select();
            document.execCommand('copy');
            this.showToast(I18n.t('copy_btn') + ' ✅', 'success');
        });
    },

    async regenerateKeys() {
        if (!confirm(I18n.t('regen_warning').replace('⚠️ ', ''))) return;

        const pw = sessionStorage.getItem('bernet_pw');
        if (!pw) {
            this.showToast(I18n.t('error'), 'error');
            return;
        }

        try {
            this.showToast(I18n.t('checking'), '');

            // Generate new keypair
            await Crypto.generateKeypair();

            // Save to localStorage (encrypted with password)
            await Crypto.saveKeysToStorage(this.currentUser.id, pw);

            // Upload new public key to server
            await Crypto.uploadPublicKey();

            // Clear key cache (recipients' keys)
            Crypto._keyCache = {};
            Crypto._ready = true;

            // Refresh display
            await this.loadKeyInfo();

            this.showToast(I18n.t('regen_keys_btn') + ' ✅', 'success');
        } catch (e) {
            console.error('[Keys] Regeneration failed:', e);
            this.showToast('Ошибка генерации: ' + e.message, 'error');
        }
    },

    async changePassword() {
        const oldPw = document.getElementById('oldPassword').value;
        const newPw = document.getElementById('newPassword').value;
        if (!oldPw || !newPw) { this.showToast(I18n.t('error'), 'error'); return; }
        if (newPw.length < 4) { this.showToast(I18n.t('error'), 'error'); return; }
        try {
            await api.login(this.currentUser.username, oldPw);
            this.showToast(I18n.t('profile_saved'), 'success');
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
        } catch { this.showToast(I18n.t('error'), 'error'); }
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
                this.showToast(I18n.t('user_unblocked'), 'success');
            } else {
                await api.blockUser(userId);
                this.showToast(I18n.t('user_blocked'), 'success');
            }
            await this.loadBlocked();
            this.loadChats();
            document.getElementById('otherProfileModal')?.classList.add('hidden');
            this.renderBlockedList();
        } catch (e) { this.showToast('Ошибка: ' + e.message, 'error'); }
    },

    renderBlockedList() {
        const container = document.getElementById('blockedList');
        if (!container) return;
        if (this.blockedUsers.length === 0) {
            container.innerHTML = `<p class="text-muted text-sm">${I18n.t('no_blocked')}</p>`;
            return;
        }
        container.innerHTML = this.blockedUsers.map(b => {
            const name = `${b.first_name || b.username || '?'} ${b.last_name || ''}`.trim();
            return `<div class="blocked-item">
        <span>${this.esc(name)}</span>
        <button class="btn-unblock" onclick="Chat.toggleBlock(${b.id}, true)">${I18n.t('unblock_user')}</button>
      </div>`;
        }).join('');
    },

    // clear chat
    async clearChat(userId) {
        if (!confirm(I18n.t('confirm_clear'))) return;
        try {
            await api.clearChat(userId);
            this.messages = [];
            this._allMessages = [];
            this.renderMessages();
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

    // mobile navigation
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
    }
};

window.Chat = Chat;
