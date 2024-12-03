import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-here'
    DERIV_APP_ID = os.environ.get('DERIV_APP_ID') or '1089'
    DERIV_API_TOKEN = os.environ.get('DERIV_API_TOKEN') or 'EHnGivjENIEwmTF'
    
    # Security Settings
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(minutes=30)
    
    # WebSocket Settings
    WEBSOCKET_ALLOWED_ORIGINS = [
        'wss://ws.binaryws.com',
        'ws://ws.binaryws.com'
    ]
    
    # Rate Limiting
    RATELIMIT_DEFAULT = "100/minute"
    RATELIMIT_STORAGE_URL = "memory://"
    
    # Content Security Policy
    CSP = {
        'default-src': ['\'self\''],
        'connect-src': [
            '\'self\'',
            'wss://ws.binaryws.com',
            'ws://ws.binaryws.com'
        ],
        'script-src': [
            '\'self\'',
            '\'unsafe-inline\'',
            '\'unsafe-eval\''
        ],
        'img-src': ['\'self\'', 'data:', 'https:'],
        'style-src': ['\'self\'', '\'unsafe-inline\''],
    } 