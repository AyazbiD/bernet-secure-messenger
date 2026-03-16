# encryption RSA + AES-GCM
# hybrid scheme: generate aes key, encrypt text with aes, encrypt aes key with rsa

import os
import base64
import hashlib
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

# rsa key generation

def generate_rsa_keypair():
    # generate 2048 bit rsa keypair
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    return private_pem, public_pem

# encrypt private key with pin

def derive_key_from_pin(pin: str, salt: bytes) -> bytes:
    # derive aes key from pin via pbkdf2, 100k iterations
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )
    return kdf.derive(pin.encode('utf-8'))

def encrypt_private_key_with_pin(private_key_pem: bytes, pin: str) -> dict:
    # encrypt private key with pin using aes-gcm
    salt = os.urandom(16)
    iv = os.urandom(12)
    
    aes_key = derive_key_from_pin(pin, salt)
    aesgcm = AESGCM(aes_key)
    encrypted_key = aesgcm.encrypt(iv, private_key_pem, None)
    
    return {
        'encrypted_key': base64.b64encode(encrypted_key).decode('utf-8'),
        'salt': base64.b64encode(salt).decode('utf-8'),
        'iv': base64.b64encode(iv).decode('utf-8')
    }

def decrypt_private_key_with_pin(encrypted_data: dict, pin: str) -> bytes:
    # decrypt private key, wrong pin will throw error
    encrypted_key = base64.b64decode(encrypted_data['encrypted_key'])
    salt = base64.b64decode(encrypted_data['salt'])
    iv = base64.b64decode(encrypted_data['iv'])
    
    aes_key = derive_key_from_pin(pin, salt)
    aesgcm = AESGCM(aes_key)
    
    try:
        private_key_pem = aesgcm.decrypt(iv, encrypted_key, None)
        return private_key_pem
    except Exception:
        raise ValueError("Wrong PIN - decryption failed")

def save_encrypted_key(encrypted_data: dict, filepath: str):
    import json
    with open(filepath, 'w') as f:
        json.dump(encrypted_data, f)

def load_encrypted_key(filepath: str) -> dict:
    import json
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r') as f:
        return json.load(f)

# save keys to client storage (for flet/web)

def save_key_to_client_storage(page, user_id: int, encrypted_data: dict):
    import json
    key = f"bernet_key_{user_id}"
    page.client_storage.set(key, json.dumps(encrypted_data))

def load_key_from_client_storage(page, user_id: int) -> dict:
    import json
    key = f"bernet_key_{user_id}"
    data = page.client_storage.get(key)
    if data:
        return json.loads(data)
    return None

def save_public_key_to_server(api_client, public_key_pem: bytes):
    try:
        api_client.update_public_key(public_key_pem.decode('utf-8') if isinstance(public_key_pem, bytes) else public_key_pem)
        return True
    except Exception as e:
        print(f"[CRYPTO] Failed to upload public key: {e}")
        return False

# key fingerprint (for ui display)

def get_key_fingerprint(public_key_pem: bytes, length: int = 16) -> str:
    # sha256 of public key, format AB12:CD34:EF56
    if not public_key_pem:
        return None
    
    if isinstance(public_key_pem, str):
        public_key_pem = public_key_pem.encode('utf-8')
    
    digest = hashlib.sha256(public_key_pem).hexdigest()[:length].upper()
    return ':'.join(digest[i:i+4] for i in range(0, len(digest), 4))

# hybrid message encryption

def encrypt_message_hybrid(plaintext: str, recipient_public_key_pem: bytes) -> dict:
    # 1. generate random aes key
    # 2. encrypt text with aes-gcm
    # 3. encrypt aes key with recipient's rsa public key
    if isinstance(recipient_public_key_pem, str):
        recipient_public_key_pem = recipient_public_key_pem.encode('utf-8')
    
    public_key = serialization.load_pem_public_key(
        recipient_public_key_pem,
        backend=default_backend()
    )
    
    aes_key = os.urandom(32)
    iv = os.urandom(12)
    
    aesgcm = AESGCM(aes_key)
    ciphertext = aesgcm.encrypt(iv, plaintext.encode('utf-8'), None)
    
    encrypted_aes_key = public_key.encrypt(
        aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    return {
        'ciphertext_b64': base64.b64encode(ciphertext).decode('utf-8'),
        'iv_b64': base64.b64encode(iv).decode('utf-8'),
        'encrypted_key_b64': base64.b64encode(encrypted_aes_key).decode('utf-8'),
        'aes_key_b64': base64.b64encode(aes_key).decode('utf-8')
    }

def decrypt_message_hybrid(ciphertext_b64: str, iv_b64: str, encrypted_key_b64: str, my_private_key_pem: bytes) -> str:
    # reverse: decrypt aes key with private rsa, then decrypt text
    if isinstance(my_private_key_pem, str):
        my_private_key_pem = my_private_key_pem.encode('utf-8')
    
    private_key = serialization.load_pem_private_key(
        my_private_key_pem,
        password=None,
        backend=default_backend()
    )
    
    ciphertext = base64.b64decode(ciphertext_b64)
    iv = base64.b64decode(iv_b64)
    encrypted_aes_key = base64.b64decode(encrypted_key_b64)
    
    aes_key = private_key.decrypt(
        encrypted_aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    aesgcm = AESGCM(aes_key)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)
    
    return plaintext.decode('utf-8')

# file encryption (photos, documents)

def encrypt_file_hybrid(file_data: bytes, recipient_public_key_pem: bytes) -> dict:
    if isinstance(recipient_public_key_pem, str):
        recipient_public_key_pem = recipient_public_key_pem.encode('utf-8')
    
    public_key = serialization.load_pem_public_key(
        recipient_public_key_pem,
        backend=default_backend()
    )
    
    aes_key = os.urandom(32)
    iv = os.urandom(12)
    
    aesgcm = AESGCM(aes_key)
    ciphertext = aesgcm.encrypt(iv, file_data, None)
    
    encrypted_aes_key = public_key.encrypt(
        aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    return {
        'ciphertext_b64': base64.b64encode(ciphertext).decode('utf-8'),
        'iv_b64': base64.b64encode(iv).decode('utf-8'),
        'encrypted_key_b64': base64.b64encode(encrypted_aes_key).decode('utf-8')
    }

def decrypt_file_hybrid(ciphertext_b64: str, iv_b64: str, encrypted_key_b64: str, my_private_key_pem: bytes) -> bytes:
    if isinstance(my_private_key_pem, str):
        my_private_key_pem = my_private_key_pem.encode('utf-8')
    
    private_key = serialization.load_pem_private_key(
        my_private_key_pem,
        password=None,
        backend=default_backend()
    )
    
    ciphertext = base64.b64decode(ciphertext_b64)
    iv = base64.b64decode(iv_b64)
    encrypted_aes_key = base64.b64decode(encrypted_key_b64)
    
    aes_key = private_key.decrypt(
        encrypted_aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    aesgcm = AESGCM(aes_key)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)
    
    return plaintext

def get_encrypted_preview(ciphertext_b64: str, length: int = 12) -> str:
    return ciphertext_b64[:length] + "..."
