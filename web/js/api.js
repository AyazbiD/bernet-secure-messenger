// api client
class BernetAPI {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.token = localStorage.getItem('bernet_token') || null;
    }

    get headers() {
        const h = { 'Content-Type': 'application/json' };
        if (this.token) h['Authorization'] = `Bearer ${this.token}`;
        return h;
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('bernet_token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('bernet_token');
        localStorage.removeItem('bernet_user');
    }

    saveUser(user) {
        localStorage.setItem('bernet_user', JSON.stringify(user));
    }

    getLocalUser() {
        try {
            return JSON.parse(localStorage.getItem('bernet_user'));
        } catch {
            return null;
        }
    }

    async request(method, path, body = null) {
        const opts = { method, headers: this.headers };
        if (body) opts.body = JSON.stringify(body);

        try {
            const res = await fetch(`${this.baseUrl}${path}`, opts);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || `HTTP ${res.status}`);
            }
            return data;
        } catch (err) {
            if (err.message.includes('Failed to fetch')) {
                throw new Error('Сервер недоступен');
            }
            throw err;
        }
    }

    // auth
    async login(username, password) {
        const data = await this.request('POST', '/api/auth/login', { username, password });
        this.setToken(data.token);
        this.saveUser(data.user);
        return data;
    }

    async register(username, password, firstName, lastName, phone = '', birthDate = '') {
        const data = await this.request('POST', '/api/auth/register', {
            username, password,
            first_name: firstName,
            last_name: lastName,
            phone, birth_date: birthDate
        });
        this.setToken(data.token);
        this.saveUser(data.user);
        return data;
    }

    // users
    async getMe() { return this.request('GET', '/api/users/me'); }
    async getUser(id) { return this.request('GET', `/api/users/${id}`); }
    async searchUsers(query) { return this.request('GET', `/api/users/search/${encodeURIComponent(query)}`); }
    async updateProfile(data) { return this.request('PUT', '/api/users/me', data); }
    async updatePreferences(data) { return this.request('PUT', '/api/users/me/preferences', data); }

    // chats
    async getChats() { return this.request('GET', '/api/chats'); }

    // messages
    async getMessages(otherUserId) { return this.request('GET', `/api/messages/${otherUserId}`); }
    async sendMessage(recipientId, encryptedContent, encryptedAesKey = '', senderEncryptedKey = '', iv = '', attachmentIds = []) {
        return this.request('POST', '/api/messages/send', {
            recipient_id: recipientId,
            encrypted_content: encryptedContent,
            encrypted_aes_key: encryptedAesKey,
            sender_encrypted_key: senderEncryptedKey,
            iv: iv,
            attachment_ids: attachmentIds
        });
    }

    // attachments
    async uploadAttachment(formData) {
        const res = await fetch('/api/attachments/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload failed');
        return data;
    }

    async getAttachmentInfo(id) {
        return this.request('GET', `/api/attachments/${id}/info`);
    }

    async downloadAttachment(id) {
        const res = await fetch(`/api/attachments/${id}/download`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return await res.arrayBuffer();
    }

    // public key
    async updatePublicKey(publicKeyPem) {
        return this.request('PUT', '/api/users/me/public-key', { public_key: publicKeyPem });
    }

    // blocks
    async blockUser(id) { return this.request('POST', `/api/blocks/${id}`); }
    async unblockUser(id) { return this.request('DELETE', `/api/blocks/${id}`); }
    async getBlocked() { return this.request('GET', '/api/blocks'); }

    // chat management
    async clearChat(otherUserId) { return this.request('DELETE', `/api/chats/${otherUserId}`); }

    // status
    async getStatus(userId) { return this.request('GET', `/api/status/${userId}`); }
    async health() { return this.request('GET', '/api/health'); }

    // avatar
    async uploadAvatar(file) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/users/me/avatar', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: form
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload failed');
        return data;
    }
}


const api = new BernetAPI();
window.api = api;
