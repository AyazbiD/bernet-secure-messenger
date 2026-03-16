// websocket client - real-time messaging
class BernetWS {
    constructor() {
        this.ws = null;
        this.token = null;
        this.connected = false;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.reconnectDelay = 2000;

        // callbacks
        this.onMessage = null;       // (message) => {}
        this.onStatusUpdate = null;  // (userId, isOnline) => {}
        this.onTyping = null;        // (userId, isTyping) => {}
        this.onConnect = null;       // () => {}
        this.onDisconnect = null;    // () => {}
    }

    connect(token) {
        if (this.ws && this.ws.readyState <= 1) return; // Already connecting/connected

        this.token = token;
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.host}/ws/${token}`;

        console.log('[WS] Connecting...');

        try {
            this.ws = new WebSocket(wsUrl);
        } catch (e) {
            console.error('[WS] Connection error:', e);
            this.scheduleReconnect();
            return;
        }

        this.ws.onopen = () => {
            console.log('[WS] Connected');
            this.connected = true;
            this.reconnectDelay = 2000;
            this.startHeartbeat();
            if (this.onConnect) this.onConnect();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (e) {
                console.warn('[WS] Invalid message:', event.data);
            }
        };

        this.ws.onclose = () => {
            console.log('[WS] Disconnected');
            this.connected = false;
            this.stopHeartbeat();
            if (this.onDisconnect) this.onDisconnect();
            this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
            console.error('[WS] Error:', err);
        };
    }

    handleMessage(data) {
        switch (data.type) {
            case 'new_message':
                if (this.onMessage) this.onMessage(data.message || data);
                break;
            case 'status_update':
                if (this.onStatusUpdate) this.onStatusUpdate(data.user_id, data.is_online);
                break;
            case 'typing':
                if (this.onTyping) this.onTyping(data.user_id, data.is_typing);
                break;
            case 'heartbeat_ack':
                break;
            default:
                console.log('[WS] Unknown type:', data.type);
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    sendMessage(recipientId, content) {
        this.send({
            type: 'message',
            recipient_id: recipientId,
            encrypted_content: content,
            encrypted_aes_key: '',
            sender_encrypted_key: '',
            iv: ''
        });
    }

    sendTyping(toUserId, isTyping = true) {
        this.send({ type: 'typing', to_user_id: toUserId, is_typing: isTyping });
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            this.send({ type: 'heartbeat' });
        }, 15000);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        if (!this.token) return;

        console.log(`[WS] Reconnecting in ${this.reconnectDelay / 1000}s...`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect(this.token);
        }, this.reconnectDelay);

        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
    }

    disconnect() {
        this.token = null;
        this.stopHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.onclose = null; // Prevent reconnect
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }
}


const ws = new BernetWS();
