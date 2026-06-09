## About

Bernet is a secure web messenger with strict end-to-end encryption. Built on a zero-knowledge architecture — the server never sees your messages, it only stores encrypted blobs. I developed this as my diploma project to demonstrate how modern, practical encryption (AES-GCM + RSA) functions in real-world applications.

## What's new in Version 1.1 (Release)

Version 1.1 brings significant structural improvements, professional codebase refactoring, and crucial UX features:

- **Explicit Cryptography Architecture:** Renamed ambiguous database columns to reflect their true cryptographic purpose (`aes_encrypted_content`, `rsa_encrypted_aes_key_recipient`).
- **Read Receipts:** Added double-tick message indicators to show exactly when your message has been read by the recipient.
- **Real-Time Typing Indicators:** Added a live typing indicator animation when the other user is typing a message.
- **Theme Synchronization Fix:** Resolved a critical bug where the `LocalStorage` user snapshot failed to sync with the database when switching between Light and Dark themes.
- **Self-Destructing Messages:** Added message self-destruction timers for ephemeral messaging.
- **Professional Docstrings:** Refactored internal code comments into professional Python Docstrings and JSDoc formats for academic and professional review.
- **UI & Margin Fixes:** Corrected multiple alignment and margin issues across the web interface.

## Features

- 🔒 **E2E encryption** (RSA-2048-OAEP + AES-256-GCM)
- 💬 **Real-time messaging** via WebSocket
- 📎 **Encrypted file attachments** (photos, documents)
- ⏱️ **Self-destructing messages** (timer)
- ✅ **Message statuses** (sent / delivered / read)
- ⌨️ **Typing indicator**
- 🟢 **Online/offline status** with last seen
- 🌍 **3 languages:** Russian, Kazakh, English
- 🌙 **Dark and light theme**
- 👤 **User profiles** with avatars
- 🚫 **User blocking**

## Architecture

```text
------------------------------------------------------------------
              CLIENT (Browser)                    
                                                 
  chat.js ←→ crypto.js (Web Crypto API)          
  api.js  ←→ REST API (JWT)                      
  ws.js   ←→ WebSocket (real-time)               
              localStorage (encrypted keys)       
------------------------------|-----------------------------------
                        HTTPS / WSS
------------------------------|-----------------------------------
              SERVER (Python)                     
                                                  
  server.py (FastAPI)                             
  ├── REST API endpoints (/api/...)               
  ├── WebSocket endpoint (/ws/{token})            
  ├── JWT Authentication                          
  └── Static file serving                         
                                                  
  database.py (SQLite) ←→ bernet.db              
  security.py (SHA-256 hashing)                   
  crypto_engine.py (RSA + AES-GCM)               
------------------------------------------------------------------
```

## How Encryption Works

The project uses hybrid encryption with a strict End-to-End Encrypted (E2EE) principle:

1. Generate a random AES-256 key for each individual message.
2. Encrypt the message text using AES-256-GCM.
3. Encrypt the ephemeral AES key using RSA-2048-OAEP-SHA256:
   - Once using the recipient's public key (`rsa_encrypted_aes_key_recipient`).
   - Once using the sender's public key (`rsa_encrypted_aes_key_sender`).
4. The server stores ONLY the resulting ciphertext and encrypted keys.

The private RSA key never leaves the user's browser — it is generated locally and stored securely in `localStorage`, symmetrically encrypted using the user's PIN (derived via PBKDF2 with 100,000 iterations).

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Python 3.10+, FastAPI, Uvicorn | REST API + WebSocket server |
| **Database** | SQLite3 | Built-in relational database |
| **Auth** | JWT (python-jose) | Token-based authentication |
| **Encryption** | RSA-2048 + AES-256-GCM | End-to-end encryption |
| **Frontend** | HTML5, CSS3, Vanilla JS | No frameworks, pure web |
| **Crypto (Client)** | Web Crypto API | Browser-side encryption |
| **Real-time** | WebSocket | Instant messages, typing, status |

## Quick Start

### 1. Clone

``` bash
git clone https://github.com/YOUR_USERNAME/bernet-secure-messenger.git
cd bernet-secure-messenger
```
### 2. Install dependencies

``` bash
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
```
### 3. Configure

``` bash
cp .env.example .env
# Edit .env — set JWT_SECRET and ADMIN_PASSWORD
```
### 4. Run

``` bash
python server.py
```
Open http://localhost:8000/web/ in your browser.

> [!WARNING]
> **Important Note on E2E Encryption**: When starting with a fresh database, **each user must log in at least once** before they can receive messages. This allows their browser to generate and upload their public RSA encryption keys to the server. If you attempt to send a message to a user who has never logged in, the application will block the transmission to protect your security, as it lacks a public key to encrypt the payload.

## Project Structure

```text
bernet-secure-messenger/
├── server.py              # FastAPI server (REST API + WebSocket)
├── database.py            # SQLite operations (40+ functions)
├── crypto_engine.py       # Server-side encryption (RSA + AES-GCM)
├── security.py            # Password hashing (SHA-256)
├── requirements.txt       # Python dependencies
├── .env.example           # Environment variables template
│
├── web/                   # Web Frontend
│   ├── index.html         # Login / Registration page
│   ├── chat.html          # Main chat interface
│   ├── css/
│   │   └── style.css      # Design system (~1700 lines, CSS Variables)
│   ├── js/
│   │   ├── api.js         # REST API client
│   │   ├── app.js         # Auth page logic
│   │   ├── chat.js        # Chat logic (~1300 lines)
│   │   ├── crypto.js      # E2E encryption (Web Crypto API)
│   │   ├── i18n.js        # Localization (RU/KZ/EN)
│   │   └── ws.js          # WebSocket client
│   └── assets/
│       ├── logo.png       # Logo
│       └── background.png # Background image
│
└── uploads/               # User uploads (gitignored)
    ├── avatars/           # Profile pictures
    └── attachments/       # Encrypted file attachments
```
## API

Full Swagger docs available at: **http://localhost:8000/docs**

### Main Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| `POST` | `/api/auth/login` | Login → JWT token |
| `POST` | `/api/auth/register` | Register new user |
| `GET` | `/api/chats` | Get chat list |
| `GET` | `/api/messages/{user_id}` | Get messages with user |
| `POST` | `/api/messages/send` | Send encrypted message |
| `POST` | `/api/attachments/upload` | Upload encrypted file |
| `WS` | `/ws/{jwt_token}` | WebSocket connection |

## Security

| Threat | Protection |
|--------|-----------|
| Message interception | E2E encryption (RSA-2048 + AES-256-GCM) |
| Unauthorized access | JWT authentication on all API |
| Server compromise | End-to-End Encrypted: server has no decryption keys |
| Key theft | Private key encrypted with password (PBKDF2 + AES-GCM) |
| Replay attack | Unique IV for each message |
| XSS | Input sanitization (`esc()` function) |
