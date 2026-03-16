# sqlite database
import sqlite3
import uuid
import json
import os
from datetime import datetime, timedelta
from security import hash_password

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(DATA_DIR, "bernet.db")

# create tables
def init_database():

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
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
    
    # add new columns if missing (for db upgrades)
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN about TEXT DEFAULT ''")
    except:
        pass  # Column already exists
    

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN avatar TEXT")
    except:
        pass
    

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'ru'")
    except:
        pass
    

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark'")
    except:
        pass
    
    # messages table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            sender_id INTEGER NOT NULL,
            sender_username TEXT,
            recipient_id INTEGER NOT NULL,
            recipient_username TEXT,
            encrypted_content TEXT,
            encrypted_aes_key TEXT,
            sender_encrypted_key TEXT,
            iv TEXT,
            timestamp TEXT,
            status TEXT DEFAULT 'sent',
            is_read INTEGER DEFAULT 0,
            deleted_for TEXT DEFAULT ''
        )
    ''')
    
    # attachments table
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
            encrypted_aes_key TEXT,
            sender_encrypted_key TEXT,
            iv TEXT
        )
    ''')
    
    # blocks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS blocks (
            id TEXT PRIMARY KEY,
            blocker_id TEXT NOT NULL,
            blocked_id TEXT NOT NULL,
            timestamp TEXT,
            UNIQUE(blocker_id, blocked_id)
        )
    ''')
    

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


    try:
        cursor.execute("ALTER TABLE attachments ADD COLUMN encrypted_aes_key TEXT")
    except:
        pass
    try:
        cursor.execute("ALTER TABLE attachments ADD COLUMN sender_encrypted_key TEXT")
    except:
        pass
    try:
        cursor.execute("ALTER TABLE attachments ADD COLUMN iv TEXT")
    except:
        pass
    
    conn.commit()
    conn.close()

def insert_default_users():
    # create demo users on first launch
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Check if any users exist
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        # admin password from env variable
        admin_password = os.environ.get("ADMIN_PASSWORD", "admin")
        
        default_users = [
            ("admin", hash_password(admin_password), "Admin", "User", 
             "", "", "admin", "red", None, 0, 0,
             json.dumps({"language": "ru", "theme": "dark", "hide_personal_data": False}), None),
            
            ("test", hash_password("test"), "Test", "User",
             "+7 000 000 0000", "2000-01-01", "user", "green", None, 0, 0,
             json.dumps({"language": "en", "theme": "dark", "hide_personal_data": False}), None),
        ]
        
        cursor.executemany('''
            INSERT INTO users (username, password, first_name, last_name, phone, 
                             birth_date, role, color, icon, is_online, is_verified, settings, public_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', default_users)
        
        print(f"[DATABASE] Default users created (admin / test)")
    
    conn.commit()
    conn.close()

# init tables and demo users on import
init_database()
insert_default_users()

# convert db rows to dicts
def row_to_user(row, columns=None):
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
    }

def row_to_message(row):
    if row is None:
        return None
    return {
        "id": row[0],
        "sender_id": row[1],
        "sender_username": row[2],
        "recipient_id": row[3],
        "recipient_username": row[4],
        "encrypted_content": row[5],
        "encrypted_aes_key": row[6],
        "sender_encrypted_key": row[7],
        "iv": row[8],
        "timestamp": row[9] if row[9] else datetime.now().isoformat(),
        "status": row[10] if len(row) > 10 else "sent",
        "is_read": bool(row[11]) if len(row) > 11 else False
    }

# --- user functions ---

def get_all_users():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    conn.close()
    return [row_to_user(row, columns) for row in rows]

def get_user_by_id(user_id: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    columns = [desc[0] for desc in cursor.description]
    row = cursor.fetchone()
    conn.close()
    return row_to_user(row, columns)

def get_user_by_username(username: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    columns = [desc[0] for desc in cursor.description]
    row = cursor.fetchone()
    conn.close()
    return row_to_user(row, columns)

def add_user(user_data: dict):
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

# --- messages ---

def get_messages_between(user1_id: str, user2_id: str, current_user_id: str = None) -> list:
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
    # pagination - get last N messages
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
                encrypted_content: str, encrypted_aes_key: str, sender_encrypted_key: str, iv: str, status: str = "sent"):
    msg_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO messages (id, sender_id, sender_username, recipient_id, recipient_username,
                            encrypted_content, encrypted_aes_key, sender_encrypted_key, iv, timestamp, status, is_read)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (msg_id, sender_id, sender_username, recipient_id, recipient_username, 
          encrypted_content, encrypted_aes_key, sender_encrypted_key, iv, timestamp, status, 0))
    
    conn.commit()
    conn.close()
    
    return {
        "id": msg_id,
        "sender_id": sender_id,
        "sender_username": sender_username,
        "recipient_id": recipient_id,
        "recipient_username": recipient_username,
        "encrypted_content": encrypted_content,
        "encrypted_aes_key": encrypted_aes_key,
        "sender_encrypted_key": sender_encrypted_key,
        "iv": iv,
        "timestamp": timestamp,
        "status": status,
        "is_read": False
    }

def add_attachment(id: str, from_user_id: int, to_user_id: int,
                  file_name: str, file_path: str, file_type: str, file_size: int,
                  encrypted_aes_key: str, sender_encrypted_key: str, iv: str):
    timestamp = datetime.now().isoformat()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO attachments (id, from_user_id, to_user_id, file_name, file_path, file_type, file_size, 
                               encrypted_aes_key, sender_encrypted_key, iv, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (id, from_user_id, to_user_id, file_name, file_path, file_type, file_size, 
          encrypted_aes_key, sender_encrypted_key, iv, timestamp))
    conn.commit()
    conn.close()
    return {
        "id": id,
        "from_user_id": from_user_id,
        "file_name": file_name,
        "file_type": file_type,
        "file_size": file_size,
        "timestamp": timestamp,
        "encrypted_aes_key": encrypted_aes_key,
        "sender_encrypted_key": sender_encrypted_key,
        "iv": iv,
        "message_id": None
    }

def get_attachment(attachment_id: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id, message_id, from_user_id, to_user_id, file_name, file_path, 
               file_type, file_size, timestamp, encrypted_aes_key, sender_encrypted_key, iv
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
        "encrypted_aes_key": row[9],
        "sender_encrypted_key": row[10],
        "iv": row[11]
    }

def update_attachment_message_link(attachment_id: str, message_id: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("UPDATE attachments SET message_id = ? WHERE id = ?", (message_id, attachment_id))
    conn.commit()
    conn.close()

def get_attachments_for_message(message_id: str) -> list:
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, message_id, from_user_id, to_user_id, file_name, file_path,
               file_type, file_size, timestamp, encrypted_aes_key, sender_encrypted_key, iv
        FROM attachments WHERE message_id = ?
    ''', (message_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{
        "id": r[0], "message_id": r[1], "from_user_id": r[2], "to_user_id": r[3],
        "file_name": r[4], "file_path": r[5], "file_type": r[6], "file_size": r[7],
        "timestamp": r[8], "encrypted_aes_key": r[9], "sender_encrypted_key": r[10], "iv": r[11]
    } for r in rows]

def get_unread_count(user_id: str, from_user_id: str) -> int:
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
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE messages SET is_read = 1, status = 'read'
        WHERE recipient_id = ? AND sender_id = ?
    ''', (user_id, from_user_id))
    conn.commit()
    conn.close()

def update_message_status(message_id: str, status: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE messages SET status = ? WHERE id = ?
    ''', (status, message_id))
    conn.commit()
    conn.close()

def get_last_message_between(user1_id: str, user2_id: str):
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

# --- blocks ---

def block_user(blocker_id: str, blocked_id: str):
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
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?
    ''', (blocker_id, blocked_id))
    conn.commit()
    conn.close()
    print(f"[DATABASE] User {blocked_id} unblocked by {blocker_id}")

def get_blocked_users(blocker_id: str) -> list:
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.* FROM users u
        INNER JOIN blocks b ON u.id = b.blocked_id
        WHERE b.blocker_id = ?
    ''', (blocker_id,))
    rows = cursor.fetchall()
    conn.close()
    return [row_to_user(row) for row in rows]

def is_blocked(user1_id: str, user2_id: str) -> bool:
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
    # search users, exclude blocked
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    

    cursor.execute('''
        SELECT blocked_id FROM blocks WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocks WHERE blocked_id = ?
    ''', (current_user_id, current_user_id))
    blocked_ids = [row[0] for row in cursor.fetchall()]
    blocked_ids.append(current_user_id)  # Exclude self
    

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
    # list of users with message history, sorted by time
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    

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
    

    chat_users = []
    for row in rows:
        user = get_user_by_id(row[0])
        if user and user.get("role") != "support":  # Exclude support from chat list
            chat_users.append(user)
    
    return chat_users

# --- media ---

def get_media_between(user1_id: str, user2_id: str) -> list:
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

# --- chat clearing ---

def clear_chat_for_user(user_id: str, other_user_id: str):
    # messages under 10 min deleted for both, older only for requester
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
    # permanently delete all messages (on block)
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        DELETE FROM messages 
        WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
    ''', (user1_id, user2_id, user2_id, user1_id))
    # delete attachments too
    cursor.execute('''
        DELETE FROM attachments 
        WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
    ''', (user1_id, user2_id, user2_id, user1_id))
    conn.commit()
    conn.close()
    print(f"[DATABASE] All messages deleted between {user1_id} and {user2_id}")

# --- online status ---

def set_user_online(user_id: str, is_online: bool):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE users SET is_online = ?, last_seen = ? WHERE id = ?
    ''', (1 if is_online else 0, datetime.now().isoformat(), user_id))
    conn.commit()
    conn.close()

def get_user_online_status(user_id: str) -> dict:
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT is_online, last_seen FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {"is_online": bool(row[0]), "last_seen": row[1]}
    return {"is_online": False, "last_seen": None}

def update_user_preferences(user_id: str, language: str = None, theme: str = None):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    if language:
        cursor.execute("UPDATE users SET language = ? WHERE id = ?", (language, user_id))
    if theme:
        cursor.execute("UPDATE users SET theme = ? WHERE id = ?", (theme, user_id))
    
    conn.commit()
    conn.close()

def get_user_preferences(user_id: str) -> dict:
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT language, theme FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {"language": row[0] or "ru", "theme": row[1] or "dark"}
    return {"language": "ru", "theme": "dark"}

# compatibility
all_users = get_all_users()
all_messages = []  # Loaded on demand

