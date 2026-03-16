// e2e encryption with web crypto api
// rsa-2048 + aes-256-gcm
const Crypto = {
    _privateKey: null,   // CryptoKey (RSA-OAEP, decrypt)
    _publicKey: null,    // CryptoKey (RSA-OAEP, encrypt) — own
    _publicKeyPem: '',   // PEM string of own public key
    _ready: false,

    // base64 helpers
    _toB64(buf) {
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    _fromB64(b64) {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
    },

    // pem conversion
    _pemToBuffer(pem) {
        const b64 = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
        return this._fromB64(b64).buffer;
    },

    _bufferToPemPublic(buf) {
        const b64 = this._toB64(buf);
        const lines = b64.match(/.{1,64}/g).join('\n');
        return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
    },

    _bufferToPemPrivate(buf) {
        const b64 = this._toB64(buf);
        const lines = b64.match(/.{1,64}/g).join('\n');
        return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
    },

    // rsa key generation
    async generateKeypair() {
        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'RSA-OAEP',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]), // 65537
                hash: 'SHA-256'
            },
            true, // extractable
            ['encrypt', 'decrypt']
        );

        this._publicKey = keyPair.publicKey;
        this._privateKey = keyPair.privateKey;

        // Export public key as PEM
        const pubBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey);
        this._publicKeyPem = this._bufferToPemPublic(pubBuf);

        return {
            publicKeyPem: this._publicKeyPem,
            privateKey: keyPair.privateKey,
            publicKey: keyPair.publicKey
        };
    },

    // save keys to localstorage (encrypted with password)
    async saveKeysToStorage(userId, password) {
        // Export private key
        const privBuf = await crypto.subtle.exportKey('pkcs8', this._privateKey);

        // Derive encryption key from password via PBKDF2
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2', false, ['deriveKey']
        );
        const aesKey = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false, ['encrypt']
        );

        // Encrypt private key with AES-GCM
        const encPriv = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            privBuf
        );

        const data = {
            encrypted_key: this._toB64(encPriv),
            salt: this._toB64(salt),
            iv: this._toB64(iv),
            public_key_pem: this._publicKeyPem
        };

        localStorage.setItem(`bernet_keys_${userId}`, JSON.stringify(data));
    },

    async loadKeysFromStorage(userId, password) {
        const raw = localStorage.getItem(`bernet_keys_${userId}`);
        if (!raw) return false;

        try {
            const data = JSON.parse(raw);
            const salt = this._fromB64(data.salt);
            const iv = this._fromB64(data.iv);
            const encPriv = this._fromB64(data.encrypted_key);

            // Derive same AES key from password
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(password),
                'PBKDF2', false, ['deriveKey']
            );
            const aesKey = await crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false, ['decrypt']
            );

            // Decrypt private key
            const privBuf = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                aesKey,
                encPriv
            );

            // Import private key
            this._privateKey = await crypto.subtle.importKey(
                'pkcs8', privBuf,
                { name: 'RSA-OAEP', hash: 'SHA-256' },
                true, ['decrypt']
            );

            // Import public key from stored PEM
            this._publicKeyPem = data.public_key_pem;
            const pubBuf = this._pemToBuffer(data.public_key_pem);
            this._publicKey = await crypto.subtle.importKey(
                'spki', pubBuf,
                { name: 'RSA-OAEP', hash: 'SHA-256' },
                true, ['encrypt']
            );

            this._ready = true;
            return true;
        } catch (e) {
            console.error('[Crypto] Failed to load keys:', e);
            return false;
        }
    },

    hasKeys(userId) {
        return !!localStorage.getItem(`bernet_keys_${userId}`);
    },

    // upload public key to server
    async uploadPublicKey() {
        if (!this._publicKeyPem) return;
        await api.updatePublicKey(this._publicKeyPem);
    },

    // import recipient's public key
    async importPublicKey(pem) {
        const buf = this._pemToBuffer(pem);
        return await crypto.subtle.importKey(
            'spki', buf,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            false, ['encrypt']
        );
    },

    // key cache
    _keyCache: {},

    async getRecipientPublicKey(userId) {
        if (this._keyCache[userId]) return this._keyCache[userId];
        try {
            const user = await api.getUser(userId);
            if (user && user.public_key) {
                const key = await this.importPublicKey(user.public_key);
                this._keyCache[userId] = key;
                return key;
            }
        } catch (e) {
            console.error('[Crypto] Cannot get public key for user', userId, e);
        }
        return null;
    },

    // encrypt message (aes + rsa)
    async encryptMessage(plaintext, recipientPublicKey) {
        // 1. Generate ephemeral AES-256 key
        const aesKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true, ['encrypt']
        );

        // 2. Generate IV (12 bytes)
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // 3. Encrypt plaintext with AES-GCM
        const encoded = new TextEncoder().encode(plaintext);
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            encoded
        );

        // 4. Export AES key as raw bytes
        const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

        // 5. Encrypt AES key with recipient's RSA public key (OAEP-SHA256)
        const encryptedAesKey = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            recipientPublicKey,
            rawAesKey
        );

        // 6. Also encrypt AES key with own public key (so sender can decrypt too)
        let senderEncryptedKey = '';
        if (this._publicKey) {
            const senderEnc = await crypto.subtle.encrypt(
                { name: 'RSA-OAEP' },
                this._publicKey,
                rawAesKey
            );
            senderEncryptedKey = this._toB64(senderEnc);
        }

        return {
            encrypted_content: this._toB64(ciphertext),
            iv: this._toB64(iv),
            encrypted_aes_key: this._toB64(encryptedAesKey),
            sender_encrypted_key: senderEncryptedKey
        };
    },

    // decrypt message
    async decryptMessage(encryptedContent, ivB64, encryptedKeyB64) {
        if (!this._privateKey) throw new Error('No private key loaded');
        if (!encryptedContent || !ivB64 || !encryptedKeyB64) return null;

        try {
            const ciphertext = this._fromB64(encryptedContent);
            const iv = this._fromB64(ivB64);
            const encryptedAesKey = this._fromB64(encryptedKeyB64);

            // 1. Decrypt AES key with our RSA private key
            const rawAesKey = await crypto.subtle.decrypt(
                { name: 'RSA-OAEP' },
                this._privateKey,
                encryptedAesKey
            );

            // 2. Import AES key
            const aesKey = await crypto.subtle.importKey(
                'raw', rawAesKey,
                { name: 'AES-GCM', length: 256 },
                false, ['decrypt']
            );

            // 3. Decrypt ciphertext with AES-GCM
            const plainBuf = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                aesKey,
                ciphertext
            );

            return new TextDecoder().decode(plainBuf);
        } catch (e) {
            console.warn('[Crypto] Decrypt failed:', e.message);
            return null;
        }
    },

    // init - call after login
    async init(userId, password) {
        // Try loading existing keys
        if (this.hasKeys(userId)) {
            const ok = await this.loadKeysFromStorage(userId, password);
            if (ok) {
                console.log('[Crypto] Keys loaded from storage');
                return true;
            }
        }

        // Generate new keypair
        console.log('[Crypto] Generating new keypair...');
        await this.generateKeypair();
        await this.saveKeysToStorage(userId, password);
        await this.uploadPublicKey();
        this._ready = true;
        console.log('[Crypto] New keypair generated and uploaded');
        return true;
    },

    async encryptFile(fileBlob, recipientPublicKey) {
        if (!this._ready) throw new Error('Crypto not ready');

        // 1. Generate AES-256-GCM key
        const aesKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true, ['encrypt', 'decrypt']
        );

        // 2. Encrypt file content
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const fileBuffer = await fileBlob.arrayBuffer();
        const encryptedContent = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            fileBuffer
        );

        // 3. Encrypt AES key for Recipient (recipientPublicKey is already a CryptoKey)
        const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
        const encryptedKeyRecipient = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            recipientPublicKey,
            rawAesKey
        );

        // 4. Encrypt AES key for Sender (Self)
        const encryptedKeySender = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            this._publicKey,
            rawAesKey
        );

        return {
            encryptedBlob: new Blob([encryptedContent]),
            iv: this._toB64(iv),
            encryptedKey: this._toB64(encryptedKeyRecipient),
            senderEncryptedKey: this._toB64(encryptedKeySender)
        };
    },

    async decryptFile(encryptedBuffer, ivB64, encryptedKeyB64) {
        if (!this._ready) throw new Error('Crypto not ready');
        try {
            const iv = this._fromB64(ivB64);
            const encryptedKey = this._fromB64(encryptedKeyB64);

            // 1. Decrypt AES key
            const rawAesKey = await crypto.subtle.decrypt(
                { name: 'RSA-OAEP' },
                this._privateKey,
                encryptedKey
            );

            // 2. Import AES key
            const aesKey = await crypto.subtle.importKey(
                'raw',
                rawAesKey,
                'AES-GCM',
                false,
                ['decrypt']
            );

            // 3. Decrypt content
            const decryptedContent = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                aesKey,
                encryptedBuffer
            );

            return new Blob([decryptedContent]);
        } catch (e) {
            console.error('[Crypto] File decryption failed:', e);
            return null;
        }
    },

    get isReady() { return this._ready; }
};

window.Crypto = Crypto;
