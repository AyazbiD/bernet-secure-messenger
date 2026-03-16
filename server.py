# bernet messenger server
# fastapi + websocket + jwt

import os
import json
import shutil
import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Query, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import jwt, JWTError

from security import hash_password, check_password
from database import (
    init_database, insert_default_users,
    get_all_users, get_user_by_id, get_user_by_username, add_user, update_user,
    search_users_with_blocks, get_chat_users,
    get_messages_between, add_message, get_unread_count, mark_messages_read,
    update_message_status, get_last_message_between,
    block_user, unblock_user, get_blocked_users, is_blocked,
    set_user_online, get_user_online_status,
    update_user_preferences, get_user_preferences,
    clear_chat_for_user, delete_all_messages_between,
    add_attachment, get_attachment, update_attachment_message_link, get_attachments_for_message, get_media_between,
)

class SendMessageRequest(BaseModel):
    recipient_id: int
    encrypted_content: str
    encrypted_aes_key: str = ""
    sender_encrypted_key: str = ""
    iv: str = ""
    attachment_ids: list[str] = []

# app settings
app = FastAPI(title="Bernet Messenger API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# jwt settings
SECRET_KEY = os.environ.get("JWT_SECRET", "change-this-secret-key-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security_scheme = HTTPBearer()

# request models
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    birth_date: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[str] = None
    about: Optional[str] = None
    public_key: Optional[str] = None

class PreferencesRequest(BaseModel):
    language: Optional[str] = None
    theme: Optional[str] = None

# jwt functions
def create_access_token(user_id: int, username: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        user = get_user_by_id(user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# websocket connection manager
class ConnectionManager:
    
    HEARTBEAT_TIMEOUT = 45  # seconds without heartbeat = offline
    
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}
        self.heartbeats: dict[int, datetime] = {}
        self.typing_status: dict[int, set] = {}
        self.last_seen: dict[int, str] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        self.heartbeats[user_id] = datetime.utcnow()
        
        set_user_online(user_id, True)
        await self.broadcast_status(user_id, True)
        
        print(f"[WS] User {user_id} connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                self.last_seen[user_id] = datetime.utcnow().isoformat()
                set_user_online(user_id, False)
                asyncio.create_task(self.broadcast_status(user_id, False))
        
        if user_id in self.typing_status:
            del self.typing_status[user_id]
        
        print(f"[WS] User {user_id} disconnected. Total: {len(self.active_connections)}")
    
    def get_last_seen(self, user_id: int) -> str:
        if self.is_online(user_id):
            return "online"
        return self.last_seen.get(user_id, "")
    
    async def check_heartbeats(self):
        # check who hasn't responded and kick them
        now = datetime.utcnow()
        stale_users = []
        for user_id, last_hb in list(self.heartbeats.items()):
            if (now - last_hb).total_seconds() > self.HEARTBEAT_TIMEOUT:
                if self.is_online(user_id):
                    stale_users.append(user_id)
        
        for user_id in stale_users:
            if user_id in self.active_connections:
                for ws in list(self.active_connections[user_id]):
                    try:
                        await ws.close()
                    except Exception:
                        pass
                self.active_connections.pop(user_id, None)
            self.last_seen[user_id] = now.isoformat()
            set_user_online(user_id, False)
            await self.broadcast_status(user_id, False)
            print(f"[WS] User {user_id} timed out")
    
    def is_online(self, user_id: int) -> bool:
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0
    
    async def send_to_user(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            dead_connections = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead_connections.append(ws)
            
            # remove dead connections
            for ws in dead_connections:
                self.active_connections[user_id].remove(ws)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    
    async def broadcast_status(self, user_id: int, is_online: bool):
        # notify everyone that user went online/offline
        status_msg = {
            "type": "status_update",
            "user_id": user_id,
            "is_online": is_online,
            "timestamp": datetime.utcnow().isoformat()
        }
        for uid, connections in list(self.active_connections.items()):
            if uid != user_id:
                for ws in connections:
                    try:
                        await ws.send_json(status_msg)
                    except Exception:
                        pass
    
    async def broadcast_typing(self, from_user_id: int, to_user_id: int, is_typing: bool):
        typing_msg = {
            "type": "typing",
            "user_id": from_user_id,
            "is_typing": is_typing
        }
        await self.send_to_user(to_user_id, typing_msg)

manager = ConnectionManager()

# --- auth ---

@app.post("/api/auth/login")
async def login(request: LoginRequest):
    user = get_user_by_username(request.username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if user.get("password") and not check_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Wrong password")
    
    token = create_access_token(user["id"], user["username"])
    
    user_data = {k: v for k, v in user.items() if k != "password"}
    
    return {"token": token, "user": user_data}

@app.post("/api/auth/register")
async def register(request: RegisterRequest):
    existing = get_user_by_username(request.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user_data = {
        "username": request.username,
        "password": hash_password(request.password),
        "first_name": request.first_name,
        "last_name": request.last_name,
        "phone": request.phone or "",
        "birth_date": request.birth_date or "",
        "role": "user",
        "color": "blue",
    }
    
    new_user = add_user(user_data)
    if not new_user:
        raise HTTPException(status_code=500, detail="Failed to create user")
    
    token = create_access_token(new_user["id"], new_user["username"])
    user_data_response = {k: v for k, v in new_user.items() if k != "password"}
    
    return {"token": token, "user": user_data_response}

# --- users ---

@app.get("/api/users/me")
async def get_me(user=Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password"}

@app.get("/api/users/{user_id}")
async def get_user(user_id: int, user=Depends(get_current_user)):
    target = get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    return {k: v for k, v in target.items() if k != "password"}

@app.get("/api/users/search/{query}")
async def search(query: str, user=Depends(get_current_user)):
    results = search_users_with_blocks(query, str(user["id"]))
    return [
        {k: v for k, v in u.items() if k != "password"}
        for u in results
    ]

@app.put("/api/users/me")
async def update_profile(request: UpdateProfileRequest, user=Depends(get_current_user)):
    updates = {k: v for k, v in request.dict().items() if v is not None}
    if updates:
        update_user(user["id"], updates)
    updated = get_user_by_id(user["id"])
    return {k: v for k, v in updated.items() if k != "password"}

@app.put("/api/users/me/preferences")
async def update_prefs(request: PreferencesRequest, user=Depends(get_current_user)):
    update_user_preferences(user["id"], language=request.language, theme=request.theme)
    return {"status": "ok"}

@app.put("/api/users/me/public-key")
async def update_public_key(body: dict, user=Depends(get_current_user)):
    public_key = body.get("public_key")
    if public_key:
        update_user(user["id"], {"public_key": public_key})
    return {"status": "ok"}

# --- attachments (encrypted files) ---

ATTACHMENT_DIR = Path(__file__).parent / "uploads" / "attachments"
ATTACHMENT_DIR.mkdir(parents=True, exist_ok=True)

@app.post("/api/attachments/upload")
async def upload_attachment(
    file: UploadFile = File(...),
    iv: str = Form(...),
    encrypted_aes_key: str = Form(...),
    sender_encrypted_key: str = Form(...),
    to_user_id: int = Form(...),
    original_type: str = Form("application/octet-stream"),
    user=Depends(get_current_user)
):
    att_id = str(uuid.uuid4())
    file_path = ATTACHMENT_DIR / f"{att_id}.enc"
    
    try:
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File save failed: {str(e)}")
    
    file_size = file_path.stat().st_size
    
    attachment = add_attachment(
        id=att_id,
        from_user_id=user["id"],
        to_user_id=to_user_id,
        file_name=file.filename or "unknown",
        file_path=str(file_path),
        file_type=original_type if original_type != "application/octet-stream" else (file.content_type or "application/octet-stream"),
        file_size=file_size,
        encrypted_aes_key=encrypted_aes_key,
        sender_encrypted_key=sender_encrypted_key,
        iv=iv
    )
    
    return attachment

@app.get("/api/attachments/{att_id}/info")
async def get_attachment_info(att_id: str, user=Depends(get_current_user)):
    att = get_attachment(att_id)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # only sender or recipient can view
    if int(att["from_user_id"]) != int(user["id"]) and int(att["to_user_id"]) != int(user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")
        
    return att

@app.get("/api/attachments/{att_id}/download")
async def download_attachment(att_id: str, user=Depends(get_current_user)):
    att = get_attachment(att_id)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    if int(att["from_user_id"]) != int(user["id"]) and int(att["to_user_id"]) != int(user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")
        
    file_path = Path(att["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File on disk not found")
        
    return FileResponse(
        file_path, 
        media_type="application/octet-stream", 
        filename=f"{att_id}.enc"
    )

# --- chats ---

@app.get("/api/chats")
async def get_chats(user=Depends(get_current_user)):
    chat_users = get_chat_users(str(user["id"]))
    result = []
    for chat_user in chat_users:
        unread = get_unread_count(str(user["id"]), str(chat_user["id"]))
        is_online = manager.is_online(chat_user["id"])
        last_seen = manager.get_last_seen(chat_user["id"])
        last_msg = get_last_message_between(str(user["id"]), str(chat_user["id"]))
        
        result.append({
            "user": {k: v for k, v in chat_user.items() if k != "password"},
            "unread_count": unread,
            "is_online": is_online,
            "last_seen": last_seen,
            "last_message": last_msg,
        })
    return result

# --- messages ---

@app.get("/api/messages/{other_user_id}")
async def get_messages(other_user_id: int, user=Depends(get_current_user)):
    messages = get_messages_between(
        str(user["id"]), str(other_user_id), str(user["id"])
    )
    mark_messages_read(str(user["id"]), str(other_user_id))
    
    # notify sender that messages were read
    await manager.send_to_user(other_user_id, {
        "type": "messages_read",
        "reader_id": user["id"]
    })
    
    # attach files to messages
    for msg in messages:
        atts = get_attachments_for_message(msg["id"])
        if atts:
            msg["attachments"] = atts
    
    return messages

@app.post("/api/messages/send")
async def send_message(request: SendMessageRequest, user=Depends(get_current_user)):
    if is_blocked(str(user["id"]), str(request.recipient_id)):
        raise HTTPException(status_code=403, detail="User is blocked")
    
    recipient = get_user_by_id(request.recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    msg = add_message(
        sender_id=user["id"],
        sender_username=user["username"],
        recipient_id=request.recipient_id,
        recipient_username=recipient["username"],
        encrypted_content=request.encrypted_content,
        encrypted_aes_key=request.encrypted_aes_key,
        sender_encrypted_key=request.sender_encrypted_key,
        iv=request.iv,
        status="sent"
    )

    # link attachments
    if request.attachment_ids:
        for att_id in request.attachment_ids:
            update_attachment_message_link(att_id, msg["id"])
            if "attachments" not in msg:
                msg["attachments"] = []
            att_info = get_attachment(att_id)
            if att_info:
                msg["attachments"].append(att_info)
    
    # send via websocket
    ws_message = {
        "type": "new_message",
        "message": msg
    }
    
    if manager.is_online(request.recipient_id):
        await manager.send_to_user(request.recipient_id, ws_message)
        msg["status"] = "delivered"
        update_message_status(msg["id"], "delivered")
    
    # send back to sender for confirmation
    await manager.send_to_user(user["id"], ws_message)
    
    return msg

# --- blocks ---

@app.post("/api/blocks/{blocked_id}")
async def block(blocked_id: int, user=Depends(get_current_user)):
    block_user(str(user["id"]), str(blocked_id))
    delete_all_messages_between(str(user["id"]), str(blocked_id))
    return {"status": "blocked"}

@app.delete("/api/blocks/{blocked_id}")
async def unblock(blocked_id: int, user=Depends(get_current_user)):
    unblock_user(str(user["id"]), str(blocked_id))
    return {"status": "unblocked"}

@app.get("/api/blocks")
async def get_blocks(user=Depends(get_current_user)):
    blocked = get_blocked_users(str(user["id"]))
    return [
        {k: v for k, v in b.items() if k != "password"}
        for b in blocked
    ]

# --- chat management ---

@app.delete("/api/chats/{other_user_id}")
async def clear_chat(other_user_id: int, user=Depends(get_current_user)):
    clear_chat_for_user(str(user["id"]), str(other_user_id))
    return {"status": "cleared"}

# --- online status ---

@app.get("/api/status/{user_id}")
async def get_status(user_id: int, user=Depends(get_current_user)):
    is_online = manager.is_online(user_id)
    last_seen = manager.get_last_seen(user_id)
    if not last_seen:
        db_status = get_user_online_status(user_id)
        last_seen = db_status.get("last_seen") if db_status else None
    return {
        "user_id": user_id,
        "is_online": is_online,
        "last_seen": last_seen
    }

# --- websocket ---

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    # verify token
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except JWTError:
        await websocket.close(code=4001)
        return
    
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "heartbeat":
                manager.heartbeats[user_id] = datetime.utcnow()
                await websocket.send_json({"type": "heartbeat_ack"})
            
            elif msg_type == "typing":
                to_user_id = data.get("to_user_id")
                is_typing = data.get("is_typing", False)
                if to_user_id:
                    await manager.broadcast_typing(user_id, int(to_user_id), is_typing)
            
            elif msg_type == "message":
                recipient_id = data.get("recipient_id")
                if recipient_id:
                    recipient = get_user_by_id(int(recipient_id))
                    if recipient and not is_blocked(str(user_id), str(recipient_id)):
                        user = get_user_by_id(user_id)
                        msg = add_message(
                            sender_id=user_id,
                            sender_username=user["username"],
                            recipient_id=int(recipient_id),
                            recipient_username=recipient["username"],
                            encrypted_content=data.get("encrypted_content", ""),
                            encrypted_aes_key=data.get("encrypted_aes_key", ""),
                            sender_encrypted_key=data.get("sender_encrypted_key", ""),
                            iv=data.get("iv", ""),
                            status="sent"
                        )
                        
                        ws_msg = {"type": "new_message", "message": msg}
                        
                        if manager.is_online(int(recipient_id)):
                            await manager.send_to_user(int(recipient_id), ws_msg)
                            msg["status"] = "delivered"
                        
                        await websocket.send_json(ws_msg)
            
            elif msg_type == "mark_read":
                from_user_id = data.get("from_user_id")
                if from_user_id:
                    mark_messages_read(str(user_id), str(from_user_id))
                    await manager.send_to_user(int(from_user_id), {
                        "type": "messages_read",
                        "reader_id": user_id
                    })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        print(f"[WS] Error for user {user_id}: {e}")
        manager.disconnect(websocket, user_id)

# background task - check heartbeats every 30 sec
@app.on_event("startup")
async def start_heartbeat_monitor():
    async def monitor():
        while True:
            await asyncio.sleep(30)
            await manager.check_heartbeats()
    asyncio.create_task(monitor())
    print("[SERVER] Heartbeat monitor started")

# server health check
@app.get("/api/health")
async def health():
    online_list = list(manager.active_connections.keys())
    return {
        "status": "ok",
        "online_users": len(online_list),
        "online_user_ids": online_list,
        "timestamp": datetime.utcnow().isoformat()
    }

# avatar upload
UPLOAD_DIR = Path(__file__).parent / "uploads" / "avatars"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@app.post("/api/users/me/avatar")
async def upload_avatar(file: UploadFile = File(...), user=Depends(get_current_user)):
    ext = Path(file.filename).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        raise HTTPException(status_code=400, detail="Only JPG/PNG/GIF/WebP allowed")
    avatar_name = f"{user['id']}{ext}"
    # remove old avatar
    for old in UPLOAD_DIR.glob(f"{user['id']}.*"):
        old.unlink(missing_ok=True)
    dest = UPLOAD_DIR / avatar_name
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    avatar_url = f"/uploads/avatars/{avatar_name}"
    update_user(user["id"], {"avatar": avatar_url})
    return {"avatar": avatar_url}

@app.get("/uploads/{filepath:path}")
async def serve_upload(filepath: str):
    file = Path(__file__).parent / "uploads" / filepath
    if file.is_file():
        return FileResponse(file)
    raise HTTPException(status_code=404, detail="File not found")

# serve web frontend
WEB_DIR = Path(__file__).parent / "web"

@app.get("/")
async def root_redirect():
    return RedirectResponse(url="/web/")

@app.get("/web/")
@app.get("/web")
async def web_index():
    return FileResponse(WEB_DIR / "index.html")

@app.get("/web/{filepath:path}")
async def web_static(filepath: str):
    file = WEB_DIR / filepath
    if file.is_file():
        suffix = file.suffix.lower()
        media_types = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.json': 'application/json',
        }
        return FileResponse(file, media_type=media_types.get(suffix))
    return {"detail": "File not found"}

# start
if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("  Bernet Messenger Server v1.0")
    print("  http://localhost:8000")
    print("  Web UI: http://localhost:8000/web/")
    print("  Docs: http://localhost:8000/docs")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
