# database.py - SQLite Backend for Bernet Messenger
import sqlite3
import uuid
import json
import os
from datetime import datetime, timedelta
from security import hash_password

# db file
DATA_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(DATA_DIR, "bernet.db")

# init db
def init_database():
    # init db tables
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Enable Write-Ahead Logging (WAL) for better concurrency and performance
    cursor.execute("PRAGMA journal_mode=WAL;")
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT,
            first_name TEXT,
            last_name TEXT,
            phone TEXT,
            birth_date TEXT,
            role TEXT DEFAULT 'user',
            color TEXT DEFAULT 'blue',
            icon TEXT,
            avatar TEXT,
            is_online INTEGER DEFAULT 1,
            is_verified INTEGER DEFAULT 0,
            about TEXT DEFAULT '',
            settings TEXT,
            public_key TEXT,
            language TEXT DEFAULT 'ru',
            theme TEXT DEFAULT 'dark'
        )
    ''')
    
    # Add about column if not exists (for existing databases)
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN about TEXT DEFAULT ''")
    except:
        pass  # Column already exists
    
    # Add avatar column if not exists
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN avatar TEXT")
    except:
        pass
    
    # Add language column if not exists
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'ru'")
    except:
        pass
    
    # Add theme column if not exists
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark'")
    except:
        pass
        
    # Add is_banned column if not exists
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0")
    except:
        pass
    
    # Messages table - E2E encrypted
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            sender_id INTEGER NOT NULL,
            sender_username TEXT,
            recipient_id INTEGER NOT NULL,
            recipient_username TEXT,
            aes_encrypted_content TEXT,
            rsa_encrypted_aes_key_recipient TEXT,
            rsa_encrypted_aes_key_sender TEXT,
            iv TEXT,
            timestamp TEXT,
            status TEXT DEFAULT 'sent',
            is_read INTEGER DEFAULT 0,
            deleted_for TEXT DEFAULT '',
            self_destruct_seconds INTEGER DEFAULT 0,
            read_at TEXT
        )
    ''')
    
    # Attachments table for files/photos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            message_id TEXT,
            from_user_id INTEGER,
            to_user_id INTEGER,
            file_name TEXT,
            file_path TEXT,
            file_type TEXT,
            file_size INTEGER,
            timestamp TEXT,
            rsa_encrypted_aes_key_recipient TEXT,
            rsa_encrypted_aes_key_sender TEXT,
            iv TEXT
        )
    ''')
    
    # Blocks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS blocks (
            id TEXT PRIMARY KEY,
            blocker_id TEXT NOT NULL,
            blocked_id TEXT NOT NULL,
            timestamp TEXT,
            UNIQUE(blocker_id, blocked_id)
        )
    ''')
    
    # Add new columns if they don't exist
    try:
        cursor.execute("ALTER TABLE messages ADD COLUMN deleted_for TEXT DEFAULT ''")
    except:
        pass
    
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN last_seen TEXT")
    except:
        pass
    
    try:
        cursor.execute("ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent'")
    except:
        pass

    # Add attachment encryption columns
    try:
        cursor.execute("ALTER TABLE attachments ADD COLUMN rsa_encrypted_aes_key_recipient TEXT")
    except:
        pass
    try:
        cursor.execute("ALTER TABLE attachments ADD COLUMN rsa_encrypted_aes_key_sender TEXT")
    except:
        pass
    try:
        cursor.execute("ALTER TABLE attachments ADD COLUMN iv TEXT")
    except:
        pass
    
    # Add self-destruct columns if not exist
    try:
        cursor.execute("ALTER TABLE messages ADD COLUMN self_destruct_seconds INTEGER DEFAULT 0")
    except:
        pass
    try:
        cursor.execute("ALTER TABLE messages ADD COLUMN read_at TEXT")
    except:
        pass
    
    conn.commit()
    conn.close()

def insert_default_users():
    # insert default users
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Check if admin exists
    cursor.execute("SELECT id FROM users WHERE username = ?", ("admin",))
    if cursor.fetchone() is None:
        default_users = [
            ("admin", hash_password("admin"), "Admin", "User", 
             "", "", "super_admin", "red", None, 1, 1,
             json.dumps({"language": "ru", "theme": "dark", "hide_personal_data": False}), None),
            
            ("test", hash_password("test"), "Test", "User",
             "", "", "user", "blue", None, 1, 0,
             json.dumps({"language": "ru", "theme": "dark", "hide_personal_data": False}), None),
        ]
        
        cursor.executemany('''
            INSERT INTO users (username, password, first_name, last_name, phone, 
                             birth_date, role, color, icon, is_online, is_verified, settings, public_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', default_users)
        
        print(f"[DATABASE] Default users created with auto IDs")
    
    conn.commit()
    conn.close()

# Initialize on import
init_database()
insert_default_users()

# convert row to dict helper
def row_to_user(row, columns=None):
    # convert row to user dict
    if row is None:
        return None
    
    # If we have column names, build a dict first
    if columns:
        d = dict(zip(columns, row))
    elif hasattr(row, 'keys'):
        # sqlite3.Row
        d = dict(row)
    else:
        # Fallback: old-style tuple — use positional access
        d = {
            "id": row[0],
            "username": row[1],
            "password": row[2],
            "first_name": row[3],
            "last_name": row[4],
            "phone": row[5],
            "birth_date": row[6],
            "role": row[7],
            "color": row[8],
            "icon": row[9],
        }
        # Remaining fields depend on schema version
        # For fresh DB: avatar(10), is_online(11), ...
        # For migrated DB: is_online(10), ..., avatar at end
        remaining = list(row[10:])
        # Detect: if len(row) > 17, avatar is in the schema
        # Best effort: just map by known lengths
        if len(row) >= 18:
            # Fresh DB with avatar at index 10
            d["avatar"] = row[10]
            d["is_online"] = bool(row[11])
            d["is_verified"] = bool(row[12])
            d["about"] = row[13] or ""
            d["settings"] = json.loads(row[14]) if row[14] else {}
            d["public_key"] = row[15]
        elif len(row) >= 15:
            # Migrated DB (avatar at end or missing)
            d["is_online"] = bool(row[10])
            d["is_verified"] = bool(row[11])
            d["about"] = row[12] if len(row) > 12 else ""
            d["settings"] = json.loads(row[13]) if len(row) > 13 and row[13] else {}
            d["public_key"] = row[14] if len(row) > 14 else None
            # Avatar might be appended at end by ALTER TABLE
            d["avatar"] = row[-1] if len(row) > 17 else (row[-2] if len(row) > 16 else None)
        return d
    
    # Named access (dict-based) — clean and reliable
    return {
        "id": d.get("id"),
        "username": d.get("username"),
        "password": d.get("password"),
        "first_name": d.get("first_name"),
        "last_name": d.get("last_name"),
        "phone": d.get("phone"),
        "birth_date": d.get("birth_date"),
        "role": d.get("role", "user"),
        "color": d.get("color", "blue"),
        "icon": d.get("icon"),
        "avatar": d.get("avatar"),
        "is_online": bool(d.get("is_online", 0)),
        "is_verified": bool(d.get("is_verified", 0)),
        "about": d.get("about", ""),
        "settings": json.loads(d["settings"]) if d.get("settings") else {},
        "public_key": d.get("public_key"),
        "is_banned": bool(d.get("is_banned", 0)),
    }

def row_to_message(row):
    # convert row to message dict
    if row is None:
        return None
    return {
        "id": row[0],
        "sender_id": row[1],
        "sender_username": row[2],
        "recipient_id": row[3],
        "recipient_username": row[4],
        "aes_encrypted_content": row[5],
        "rsa_encrypted_aes_key_recipient": row[6],
        "rsa_encrypted_aes_key_sender": row[7],
        "iv": row[8],
        "timestamp": row[9] if row[9] else datetime.now().isoformat(),
        "status": row[10] if len(row) > 10 else "sent",
        "is_read": bool(row[11]) if len(row) > 11 else False,
        "self_destruct_seconds": row[13] if len(row) > 13 else 0,
        "read_at": row[14] if len(row) > 14 else None
    }

# user funcs
def get_all_users():
    # get all users
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    conn.close()
    return [row_to_user(row, columns) for row in rows]

def get_admin_users_paginated(search_query: str = "", limit: int = 50, offset: int = 0):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    where_clause = ""
    params = []
    
    if search_query:
        search_term = f"%{search_query}%"
        where_clause = "WHERE username LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR CAST(id AS TEXT) LIKE ?"
        params = [search_term, search_term, search_term, search_term]
        
    # Get total count
    cursor.execute(f"SELECT COUNT(*) FROM users {where_clause}", params)
    total = cursor.fetchone()[0]
    
    # Get paginated users
    cursor.execute(f"SELECT * FROM users {where_clause} ORDER BY id DESC LIMIT ? OFFSET ?", [*params, limit, offset])
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    conn.close()
    
    return [row_to_user(row, columns) for row in rows], total

def get_user_by_id(user_id: str):
    # find user by id
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    columns = [desc[0] for desc in cursor.description]
    row = cursor.fetchone()
    conn.close()
    return row_to_user(row, columns)

def get_user_by_username(username: str):
    # find user by username
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    columns = [desc[0] for desc in cursor.description]
    row = cursor.fetchone()
    conn.close()
    return row_to_user(row, columns)

def add_user(user_data: dict):
    # register new user
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO users (username, password, first_name, last_name, phone, 
                         birth_date, role, color, icon, is_online, is_verified, settings, public_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        user_data.get("username"),
        user_data.get("password"),
        user_data.get("first_name"),
        user_data.get("last_name"),
        user_data.get("phone", ""),
        user_data.get("birth_date", ""),
        user_data.get("role", "user"),
        user_data.get("color", "blue"),
        user_data.get("icon"),
        1 if user_data.get("is_online", True) else 0,
        1 if user_data.get("is_verified", False) else 0,
        json.dumps(user_data.get("settings", {})),
        user_data.get("public_key")
    ))
    
    # Get the auto-generated ID
    user_id = cursor.lastrowid
    user_data["id"] = user_id
    
    conn.commit()
    conn.close()
    
    print(f"[DATABASE] User '{user_data['username']}' saved with ID {user_id}")
    return user_data

def update_user(user_id: str, updates: dict):
    # update user profile
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Build update query dynamically
    set_parts = []
    values = []
    for key, value in updates.items():
        if key in ["first_name", "last_name", "phone", "birth_date", "password", "about", "public_key", "avatar"]:
            set_parts.append(f"{key} = ?")
            values.append(value)
    
    if set_parts:
        values.append(user_id)
        query = f"UPDATE users SET {', '.join(set_parts)} WHERE id = ?"
        cursor.execute(query, values)
        conn.commit()
        print(f"[DATABASE] User {user_id} updated: {list(updates.keys())}")
    
    conn.close()

def search_users(query: str, exclude_id: str = None) -> list:
    # search by name
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    if query:
        query = f"%{query.lower()}%"
        cursor.execute('''
            SELECT * FROM users 
            WHERE (LOWER(username) LIKE ? OR LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ?)
            AND id != ?
        ''', (query, query, query, exclude_id or ""))
    else:
        cursor.execute("SELECT * FROM users WHERE id != ?", (exclude_id or "",))
    
    rows = cursor.fetchall()
    conn.close()
    return [row_to_user(row) for row in rows]

def update_user_role(user_id: str, new_role: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, user_id))
    conn.commit()
    conn.close()

# msg funcs
def get_messages_between(user1_id: str, user2_id: str, current_user_id: str = None) -> list:
    # chat history
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # If current_user_id provided, filter out deleted messages
    if current_user_id:
        cursor.execute('''
            SELECT * FROM messages 
            WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
            AND (deleted_for IS NULL OR deleted_for = '' OR deleted_for NOT LIKE ?)
            ORDER BY timestamp ASC
        ''', (user1_id, user2_id, user2_id, user1_id, f'%{current_user_id}%'))
    else:
        cursor.execute('''
            SELECT * FROM messages 
            WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
            ORDER BY timestamp ASC
        ''', (user1_id, user2_id, user2_id, user1_id))
    
    rows = cursor.fetchall()
    conn.close()
    return [row_to_message(row) for row in rows]

def get_messages_paginated(user1_id: str, user2_id: str, current_user_id: str = None, limit: int = 15, before_id: str = None) -> list:
    # load paginated messages
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    deleted_filter = ""
    params = []
    
    if current_user_id:
        base_where = """((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
            AND (deleted_for IS NULL OR deleted_for = '' OR deleted_for NOT LIKE ?)"""
        params = [user1_id, user2_id, user2_id, user1_id, f'%{current_user_id}%']
    else:
        base_where = """(sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)"""
        params = [user1_id, user2_id, user2_id, user1_id]
    
    if before_id:
        # Get timestamp of the before_id message
        cursor.execute('SELECT timestamp FROM messages WHERE id = ?', (before_id,))
        row = cursor.fetchone()
        if row:
            before_ts = row[0]
            cursor.execute(f'''
                SELECT * FROM (
                    SELECT * FROM messages 
                    WHERE {base_where} AND timestamp < ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                ) sub ORDER BY timestamp ASC
            ''', params + [before_ts, limit])
        else:
            conn.close()
            return []
    else:
        # Get last N messages
        cursor.execute(f'''
            SELECT * FROM (
                SELECT * FROM messages 
                WHERE {base_where}
                ORDER BY timestamp DESC
                LIMIT ?
            ) sub ORDER BY timestamp ASC
        ''', params + [limit])
    
    rows = cursor.fetchall()
    conn.close()
    return [row_to_message(row) for row in rows]

def add_message(sender_id: int, sender_username: str, recipient_id: int, recipient_username: str, 
                aes_encrypted_content: str, rsa_encrypted_aes_key_recipient: str, rsa_encrypted_aes_key_sender: str, iv: str, 
                status: str = "sent", self_destruct_seconds: int = 0):
    # save message
    msg_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO messages (id, sender_id, sender_username, recipient_id, recipient_username,
                            aes_encrypted_content, rsa_encrypted_aes_key_recipient, rsa_encrypted_aes_key_sender, iv, timestamp, status, is_read,
                            self_destruct_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (msg_id, sender_id, sender_username, recipient_id, recipient_username, 
          aes_encrypted_content, rsa_encrypted_aes_key_recipient, rsa_encrypted_aes_key_sender, iv, timestamp, status, 0,
          self_destruct_seconds))
    
    conn.commit()
    conn.close()
    
    return {
        "id": msg_id,
        "sender_id": sender_id,
        "sender_username": sender_username,
        "recipient_id": recipient_id,
        "recipient_username": recipient_username,
        "aes_encrypted_content": aes_encrypted_content,
        "rsa_encrypted_aes_key_recipient": rsa_encrypted_aes_key_recipient,
        "rsa_encrypted_aes_key_sender": rsa_encrypted_aes_key_sender,
        "iv": iv,
        "timestamp": timestamp,
        "status": status,
        "is_read": False,
        "self_destruct_seconds": self_destruct_seconds,
        "read_at": None
    }

def add_attachment(id: str, from_user_id: int, to_user_id: int,
                  file_name: str, file_path: str, file_type: str, file_size: int,
                  rsa_encrypted_aes_key_recipient: str, rsa_encrypted_aes_key_sender: str, iv: str):
    # save attachment
    timestamp = datetime.now().isoformat()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO attachments (id, from_user_id, to_user_id, file_name, file_path, file_type, file_size, 
                               rsa_encrypted_aes_key_recipient, rsa_encrypted_aes_key_sender, iv, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (id, from_user_id, to_user_id, file_name, file_path, file_type, file_size, 
          rsa_encrypted_aes_key_recipient, rsa_encrypted_aes_key_sender, iv, timestamp))
    conn.commit()
    conn.close()
    return {
        "id": id,
        "from_user_id": from_user_id,
        "file_name": file_name,
        "file_type": file_type,
        "file_size": file_size,
        "timestamp": timestamp,
        "rsa_encrypted_aes_key_recipient": rsa_encrypted_aes_key_recipient,
        "rsa_encrypted_aes_key_sender": rsa_encrypted_aes_key_sender,
        "iv": iv,
        "message_id": None
    }

def get_attachment(attachment_id: str):
    # get file info
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    # Explicit column selection to avoid index errors
    cursor.execute('''
        SELECT id, message_id, from_user_id, to_user_id, file_name, file_path, 
               file_type, file_size, timestamp, rsa_encrypted_aes_key_recipient, rsa_encrypted_aes_key_sender, iv
        FROM attachments WHERE id = ?
    ''', (attachment_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0],
        "message_id": row[1],
        "from_user_id": row[2],
        "to_user_id": row[3],
        "file_name": row[4],
        "file_path": row[5],
        "file_type": row[6],
        "file_size": row[7],
        "timestamp": row[8],
        "rsa_encrypted_aes_key_recipient": row[9],
        "rsa_encrypted_aes_key_sender": row[10],
        "iv": row[11]
    }

def update_attachment_message_link(attachment_id: str, message_id: str):
    # link file to message
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("UPDATE attachments SET message_id = ? WHERE id = ?", (message_id, attachment_id))
    conn.commit()
    conn.close()

def get_attachments_for_message(message_id: str) -> list:
    # message attachments
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, message_id, from_user_id, to_user_id, file_name, file_path,
               file_type, file_size, timestamp, rsa_encrypted_aes_key_recipient, rsa_encrypted_aes_key_sender, iv
        FROM attachments WHERE message_id = ?
    ''', (message_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{
        "id": r[0], "message_id": r[1], "from_user_id": r[2], "to_user_id": r[3],
        "file_name": r[4], "file_path": r[5], "file_type": r[6], "file_size": r[7],
        "timestamp": r[8], "rsa_encrypted_aes_key_recipient": r[9], "rsa_encrypted_aes_key_sender": r[10], "iv": r[11]
    } for r in rows]

def get_unread_count(user_id: str, from_user_id: str) -> int:
    # unread count
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT COUNT(*) FROM messages 
        WHERE recipient_id = ? AND sender_id = ? AND is_read = 0
    ''', (user_id, from_user_id))
    count = cursor.fetchone()[0]
    conn.close()
    return count

def mark_messages_read(user_id: str, from_user_id: str):
    # mark as read
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute('''
        UPDATE messages SET is_read = 1, status = 'read', 
            read_at = CASE WHEN read_at IS NULL THEN ? ELSE read_at END
        WHERE recipient_id = ? AND sender_id = ?
        AND (self_destruct_seconds = 0 OR id NOT IN (SELECT message_id FROM attachments WHERE file_type LIKE 'image/%'))
    ''', (now, user_id, from_user_id))
    conn.commit()
    conn.close()

def update_message_status(message_id: str, status: str):
    # update msg status
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE messages SET status = ? WHERE id = ?
    ''', (status, message_id))
    conn.commit()
    conn.close()

def get_last_message_between(user1_id: str, user2_id: str):
    # last chat message
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM messages 
        WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
        ORDER BY timestamp DESC LIMIT 1
    ''', (user1_id, user2_id, user2_id, user1_id))
    row = cursor.fetchone()
    conn.close()
    return row_to_message(row) if row else None

# block funcs
def block_user(blocker_id: str, blocked_id: str):
    # block user
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO blocks (id, blocker_id, blocked_id, timestamp)
            VALUES (?, ?, ?, ?)
        ''', (str(uuid.uuid4()), blocker_id, blocked_id, datetime.now().isoformat()))
        conn.commit()
        print(f"[DATABASE] User {blocked_id} blocked by {blocker_id}")
    except sqlite3.IntegrityError:
        pass  # Already blocked
    conn.close()

def unblock_user(blocker_id: str, blocked_id: str):
    # unblock user
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?
    ''', (blocker_id, blocked_id))
    conn.commit()
    conn.close()
    print(f"[DATABASE] User {blocked_id} unblocked by {blocker_id}")

def get_blocked_users(blocker_id: str) -> list:
    # blocked users list
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.* FROM users u
        INNER JOIN blocks b ON u.id = b.blocked_id
        WHERE b.blocker_id = ?
    ''', (blocker_id,))
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    conn.close()
    return [row_to_user(row, columns) for row in rows]

def is_blocked(user1_id: str, user2_id: str) -> bool:
    # check if blocked
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT COUNT(*) FROM blocks 
        WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
    ''', (user1_id, user2_id, user2_id, user1_id))
    count = cursor.fetchone()[0]
    conn.close()
    return count > 0

def search_users_with_blocks(query: str, current_user_id: str) -> list:
    # search excluding blocked
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Get all blocked user IDs (both directions)
    cursor.execute('''
        SELECT blocked_id FROM blocks WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocks WHERE blocked_id = ?
    ''', (current_user_id, current_user_id))
    blocked_ids = [row[0] for row in cursor.fetchall()]
    blocked_ids.append(current_user_id)  # Exclude self
    
    # Build placeholders
    placeholders = ','.join('?' * len(blocked_ids))
    
    if query:
        query = f"%{query.lower()}%"
        cursor.execute(f'''
            SELECT * FROM users 
            WHERE (LOWER(username) LIKE ? OR LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ?)
            AND id NOT IN ({placeholders})
        ''', (query, query, query, *blocked_ids))
    else:
        cursor.execute(f'''
            SELECT * FROM users WHERE id NOT IN ({placeholders})
        ''', blocked_ids)
    
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    conn.close()
    return [row_to_user(row, columns) for row in rows]

def get_chat_users(current_user_id: str) -> list:
    # active chats list
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Get all unique users we've chatted with and their last message time
    cursor.execute('''
        SELECT DISTINCT 
            CASE 
                WHEN sender_id = ? THEN recipient_id 
                ELSE sender_id 
            END as other_user_id,
            MAX(timestamp) as last_msg_time
        FROM messages
        WHERE (sender_id = ? OR recipient_id = ?)
        AND (deleted_for NOT LIKE ? AND deleted_for NOT LIKE ?)
        GROUP BY other_user_id
        ORDER BY last_msg_time DESC
    ''', (current_user_id, current_user_id, current_user_id, f'%{current_user_id}%', f'%{current_user_id}%'))
    
    rows = cursor.fetchall()
    conn.close()
    
    # Get user details for each
    chat_users = []
    for row in rows:
        user = get_user_by_id(row[0])
        if user and user.get("role") != "support":  # Exclude support from chat list
            chat_users.append(user)
    
    return chat_users

# media stuff
def get_media_between(user1_id: str, user2_id: str) -> list:
    # chat media files
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM attachments 
        WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
        ORDER BY timestamp DESC
    ''', (user1_id, user2_id, user2_id, user1_id))
    rows = cursor.fetchall()
    conn.close()
    
    return [{"id": r[0], "message_id": r[1], "from_user_id": r[2], "to_user_id": r[3],
             "file_name": r[4], "file_path": r[5], "file_type": r[6], "file_size": r[7], 
             "timestamp": r[8]} for r in rows]

# clear chat
def clear_chat_for_user(user_id: str, other_user_id: str):
    # clear chat history
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    now = datetime.now()
    ten_min_ago = (now - timedelta(minutes=10)).isoformat()
    
    # Get all messages between them
    cursor.execute('''
        SELECT id, timestamp, deleted_for FROM messages
        WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
    ''', (user_id, other_user_id, other_user_id, user_id))
    
    rows = cursor.fetchall()
    
    for msg_id, timestamp, deleted_for in rows:
        deleted_list = deleted_for.split(',') if deleted_for else []
        
        # If message is within 10 minutes, delete for both
        if timestamp >= ten_min_ago:
            cursor.execute("DELETE FROM messages WHERE id = ?", (msg_id,))
        else:
            # Otherwise, mark deleted for this user only
            if user_id not in deleted_list:
                deleted_list.append(user_id)
                cursor.execute("UPDATE messages SET deleted_for = ? WHERE id = ?", 
                              (','.join(deleted_list), msg_id))
    
    conn.commit()
    conn.close()
    print(f"[DATABASE] Chat cleared for user {user_id} with {other_user_id}")

def delete_all_messages_between(user1_id: str, user2_id: str):
    # delete all messages
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        DELETE FROM messages 
        WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
    ''', (user1_id, user2_id, user2_id, user1_id))
    # Also delete attachments
    cursor.execute('''
        DELETE FROM attachments 
        WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
    ''', (user1_id, user2_id, user2_id, user1_id))
    conn.commit()
    conn.close()
    print(f"[DATABASE] All messages deleted between {user1_id} and {user2_id}")

# online status funcs
def set_user_online(user_id: str, is_online: bool):
    # set online status
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE users SET is_online = ?, last_seen = ? WHERE id = ?
    ''', (1 if is_online else 0, datetime.now().isoformat(), user_id))
    conn.commit()
    conn.close()

def get_user_online_status(user_id: str) -> dict:
    # check online status
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT is_online, last_seen FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {"is_online": bool(row[0]), "last_seen": row[1]}
    return {"is_online": False, "last_seen": None}

def update_user_preferences(user_id: str, language: str = None, theme: str = None):
    # update preferences
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    if language:
        cursor.execute("UPDATE users SET language = ? WHERE id = ?", (language, user_id))
    if theme:
        cursor.execute("UPDATE users SET theme = ? WHERE id = ?", (theme, user_id))
        
    # Sync settings JSON column
    cursor.execute("SELECT settings FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if row:
        import json
        settings = {}
        if row[0]:
            try:
                settings = json.loads(row[0])
            except:
                pass
        if language:
            settings["language"] = language
        if theme:
            settings["theme"] = theme
        cursor.execute("UPDATE users SET settings = ? WHERE id = ?", (json.dumps(settings), user_id))
    
    conn.commit()
    conn.close()

def get_user_preferences(user_id: str) -> dict:
    # get preferences
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT language, theme FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {"language": row[0] or "ru", "theme": row[1] or "dark"}
    return {"language": "ru", "theme": "dark"}

# self destruct funcs
def get_expired_self_destruct_messages() -> list:
    # find expired sd messages
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, sender_id, recipient_id, self_destruct_seconds, read_at FROM messages 
        WHERE self_destruct_seconds > 0 AND read_at IS NOT NULL
    ''')
    rows = cursor.fetchall()
    conn.close()
    
    expired = []
    now = datetime.now()
    for msg_id, sender_id, recipient_id, destruct_secs, read_at in rows:
        try:
            read_time = datetime.fromisoformat(read_at)
            if (now - read_time).total_seconds() >= destruct_secs:
                expired.append({"id": msg_id, "sender_id": sender_id, "recipient_id": recipient_id})
        except:
            pass
    return expired

def delete_expired_messages():
    # delete expired sd messages
    expired = get_expired_self_destruct_messages()
    if not expired:
        return []
    
    expired_ids = [e["id"] for e in expired]
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    placeholders = ','.join('?' * len(expired_ids))
    cursor.execute(f'DELETE FROM messages WHERE id IN ({placeholders})', expired_ids)
    conn.commit()
    conn.close()
    if expired:
        print(f"[DATABASE] Deleted {len(expired)} expired self-destruct messages")
    return expired

def set_message_read_at(message_id: str, read_at: str = None):
    # set read_at for timer
    if read_at is None:
        read_at = datetime.now().isoformat()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE messages SET read_at = ?, is_read = 1, status = 'read'
        WHERE id = ? AND read_at IS NULL
    ''', (read_at, message_id))
    conn.commit()
    conn.close()
    return read_at

def set_user_banned(user_id: str, is_banned: bool):
    # ban/unban user globally
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_banned = ? WHERE id = ?", (1 if is_banned else 0, user_id))
    conn.commit()
    conn.close()

def get_message_by_id(message_id: str):
    # get msg by id
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM messages WHERE id = ?', (message_id,))
    row = cursor.fetchone()
    conn.close()
    return row_to_message(row) if row else None

def get_self_destruct_info(message_id: str) -> dict:
    # get sd info
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('SELECT self_destruct_seconds, read_at FROM messages WHERE id = ?', (message_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"self_destruct_seconds": row[0] or 0, "read_at": row[1]}
    return {"self_destruct_seconds": 0, "read_at": None}

# compat
all_users = get_all_users()
all_messages = []  # Loaded on demand

