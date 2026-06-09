# security.py - Authentication Utilities
import hashlib

def hash_password(password: str) -> str:
    # hash password
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def check_password(input_password: str, stored_hash: str) -> bool:
    # verify password
    return hash_password(input_password) == stored_hash