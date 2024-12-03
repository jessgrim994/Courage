from app import app, db, User
from werkzeug.security import generate_password_hash

ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'admin123'  # Change this to your desired password
ADMIN_EMAIL = 'admin@example.com'

with app.app_context():
    # Check if admin already exists
    admin = User.query.filter_by(username=ADMIN_USERNAME).first()
    if not admin:
        admin = User(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            password=generate_password_hash(ADMIN_PASSWORD, method='pbkdf2:sha256'),
            is_admin=True
        )
        db.session.add(admin)
        db.session.commit()
        print("Admin user created successfully!")
        print(f"Username: {ADMIN_USERNAME}")
        print(f"Password: {ADMIN_PASSWORD}")
        print(f"Email: {ADMIN_EMAIL}")
    else:
        print("Admin user already exists!")