from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from functools import wraps
import re
import logging
from logging.handlers import RotatingFileHandler
import os
from flask_wtf.csrf import CSRFProtect
from flask_talisman import Talisman
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import bleach
from werkzeug.datastructures import ImmutableMultiDict
from flask_wtf import FlaskForm
from redis import Redis
from itsdangerous import URLSafeTimedSerializer
from flask_mail import Mail, Message
import mimetypes
import sys

# Add the project root directory to Python path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.append(project_root)

from utils.market_cache import market_cache

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URI', 'sqlite:///database.db')
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Initialize CSRF protection
csrf = CSRFProtect(app)

# Configure CSP
csp = {
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

# Initialize Talisman with CSP
Talisman(app,
         content_security_policy=csp,
         content_security_policy_nonce_in=['script-src'],
         force_https=False)  # Set to True in production

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Add after app initialization
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=timedelta(minutes=60),  # Session expires after 60 minutes
    REMEMBER_COOKIE_SECURE=True,
    REMEMBER_COOKIE_HTTPONLY=True,
    REMEMBER_COOKIE_DURATION=timedelta(days=14)  # Remember me cookie duration
)

# Email configuration
app.config.update(
    MAIL_SERVER='smtp.gmail.com',
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME='lucywangechi921@gmail.com',
    MAIL_PASSWORD='aspc hyye hcmx bgrv',
    MAIL_DEFAULT_SENDER='lucywangechi921@gmail.com'
)

# Initialize Flask-Mail
mail = Mail(app)
serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])

# Add MIME types
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/x-font-woff', '.woff')
mimetypes.add_type('application/x-font-woff2', '.woff2')
mimetypes.add_type('application/x-font-ttf', '.ttf')
mimetypes.add_type('application/x-font-eot', '.eot')

# Configure static files to be served with correct MIME types
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(app.static_folder, filename, conditional=True)

def is_valid_password(password):
    """
    Password must:
    - Be at least 8 characters long
    - Contain at least one uppercase letter
    - Contain at least one lowercase letter
    - Contain at least one number
    - Contain at least one special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    
    if not re.search(r"[ !@#$%&'()*+,-./[\\\]^_`{|}~"+r'"]', password):
        return False, "Password must contain at least one special character"
    
    return True, "Password is valid"

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    login_attempts = db.Column(db.Integer, default=0)
    last_login_attempt = db.Column(db.DateTime)
    locked_until = db.Column(db.DateTime)

    def __repr__(self):
        return f'<User {self.username}>'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def is_valid_email(email):
    # Basic email validation pattern
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

@app.route('/')
def index():
    return render_template('index.html')

def sanitize_input(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == 'POST':
            # Create a mutable copy of form data
            cleaned_form = request.form.copy()
            
            # Sanitize each form field
            for key in cleaned_form:
                if isinstance(cleaned_form[key], str):
                    cleaned_form[key] = bleach.clean(
                        cleaned_form[key],
                        tags=[],  # No HTML tags allowed
                        strip=True
                    )
            
            # Replace request.form with sanitized data
            request.form = ImmutableMultiDict(cleaned_form)
        return f(*args, **kwargs)
    return decorated_function

@app.route('/register', methods=['GET', 'POST'])
@limiter.limit("3 per minute")
@sanitize_input
def register():
    form = CSRFForm()  # Create CSRF form instance
    
    if request.method == 'POST':
        if form.validate_on_submit():  # Validate CSRF token
            username = request.form['username']
            email = request.form['email']
            password = request.form['password']
            confirm_password = request.form['confirm_password']

            # Validation
            error = None
            if not username or not email or not password or not confirm_password:
                error = 'All fields are required.'
            elif not is_valid_email(email):
                error = 'Invalid email address.'
            elif password != confirm_password:
                error = 'Passwords do not match.'
            elif len(password) < 6:
                error = 'Password must be at least 6 characters long.'
            elif User.query.filter_by(username=username).first():
                error = 'Username already exists.'
            elif User.query.filter_by(email=email).first():
                error = 'Email already registered.'

            # Add password validation
            is_valid, password_error = is_valid_password(password)
            if not is_valid:
                flash(password_error)
                return render_template('register.html', form=form)

            if error:
                flash(error)
                return render_template('register.html', form=form)

            # Create new user
            hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
            new_user = User(
                username=username,
                email=email,
                password=hashed_password
            )
            db.session.add(new_user)
            db.session.commit()
            
            flash('Registration successful! Please login.')
            return redirect(url_for('login'))
    
    return render_template('register.html', form=form)  # Pass form to template

# Define the check_rate_limit decorator before using it
def check_rate_limit(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == 'POST':
            username = request.form.get('username')
            if username:
                user = User.query.filter_by(username=username).first()
                if user:
                    # Check if account is locked
                    if user.locked_until and user.locked_until > datetime.utcnow():
                        remaining_time = (user.locked_until - datetime.utcnow()).total_seconds() / 60
                        flash(f'Account is locked. Try again in {int(remaining_time)} minutes.')
                        return redirect(url_for('login'))
                    
                    # Reset login attempts if last attempt was more than 30 minutes ago
                    if user.last_login_attempt and \
                       datetime.utcnow() - user.last_login_attempt > timedelta(minutes=30):
                        user.login_attempts = 0
                    
                    user.login_attempts += 1
                    user.last_login_attempt = datetime.utcnow()
                    
                    # Lock account after 5 failed attempts
                    if user.login_attempts >= 5:
                        user.locked_until = datetime.utcnow() + timedelta(minutes=30)
                        db.session.commit()
                        flash('Too many failed attempts. Account locked for 30 minutes.')
                        return redirect(url_for('login'))
                    
                    db.session.commit()
        return f(*args, **kwargs)
    return decorated_function

# Then use it in your routes
class CSRFForm(FlaskForm):
    pass

@app.route('/login', methods=['GET', 'POST'])
@limiter.limit("5 per minute")
@check_rate_limit
@sanitize_input
def login():
    form = CSRFForm()  # Create CSRF form instance
    
    if request.method == 'POST':
        if form.validate_on_submit():  # Validate CSRF token
            username = request.form['username']
            password = request.form['password']
            user = User.query.filter_by(username=username).first()
            
            if user and check_password_hash(user.password, password):
                # Reset login attempts on successful login
                user.login_attempts = 0
                user.locked_until = None
                db.session.commit()
                
                app.logger.info(f'Successful login for user {username}')
                login_user(user)
                if user.is_admin:
                    return redirect(url_for('admin_dashboard'))
                return redirect(url_for('user_dashboard'))
            
            app.logger.warning(f'Failed login attempt for user {username}')
            flash('Invalid username or password')
    
    return render_template('login.html', form=form)  # Pass form to template

@app.route('/user_dashboard')
@login_required
def user_dashboard():
    if current_user.is_admin:
        return redirect(url_for('admin_dashboard'))
    
    form = CSRFForm()
    user_data = {
        'username': current_user.username,
        'email': current_user.email,
        'created_at': current_user.created_at,
        'last_login': current_user.last_login_attempt,
        'is_admin': current_user.is_admin
    }
    
    return render_template('user_dashboard.html', 
                         user=user_data, 
                         form=form, 
                         active_page='dashboard')

@app.route('/admin_dashboard')
@login_required
def admin_dashboard():
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('user_dashboard'))
    
    # Get all users and their stats
    users = User.query.all()
    stats = {
        'total_users': len(users),
        'admin_users': len([u for u in users if u.is_admin]),
        'regular_users': len([u for u in users if not u.is_admin]),
        'recent_registrations': len([u for u in users if u.created_at > datetime.utcnow() - timedelta(days=7)])
    }
    
    return render_template('admin_dashboard.html', users=users, stats=stats)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

# Admin user management routes
@app.route('/delete_user/<int:user_id>')
@login_required
def delete_user(user_id):
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('user_dashboard'))
    
    user = User.query.get_or_404(user_id)
    if user.is_admin:
        flash('Cannot delete admin user')
        return redirect(url_for('admin_dashboard'))
    
    db.session.delete(user)
    db.session.commit()
    flash('User deleted successfully')
    return redirect(url_for('admin_dashboard'))

@app.route('/toggle_admin/<int:user_id>')
@login_required
def toggle_admin(user_id):
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('user_dashboard'))
    
    user = User.query.get_or_404(user_id)
    if user == current_user:
        flash('Cannot modify your own admin status')
        return redirect(url_for('admin_dashboard'))
    
    user.is_admin = not user.is_admin
    db.session.commit()
    flash(f'Admin status updated for {user.username}')
    return redirect(url_for('admin_dashboard'))

# Add security headers middleware
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

# Setup logging
def setup_logging():
    if not os.path.exists('logs'):
        os.mkdir('logs')
    
    # Configure logging
    file_handler = RotatingFileHandler(
        'logs/security.log',
        maxBytes=10240,
        backupCount=10
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('Flask Web App startup')

# Call setup_logging after app initialization
setup_logging()

@app.route('/change_password', methods=['POST'])
@login_required
@limiter.limit("5 per minute")
@sanitize_input
def change_password():
    current_password = request.form.get('currentPassword')
    new_password = request.form.get('newPassword')
    
    if not current_password or not new_password:
        return jsonify({'success': False, 'message': 'All fields are required'}), 400
    
    # Verify current password
    if not check_password_hash(current_user.password, current_password):
        app.logger.warning(f'Failed password change attempt for user {current_user.username}')
        return jsonify({'success': False, 'message': 'Current password is incorrect'}), 400
    
    # Validate new password
    is_valid, password_error = is_valid_password(new_password)
    if not is_valid:
        return jsonify({'success': False, 'message': password_error}), 400
    
    # Update password
    current_user.password = generate_password_hash(new_password, method='pbkdf2:sha256')
    db.session.commit()
    
    app.logger.info(f'Password changed successfully for user {current_user.username}')
    return jsonify({'success': True, 'message': 'Password changed successfully'})

@app.route('/update_profile', methods=['POST'])
@login_required
@limiter.limit("5 per minute")
@sanitize_input
def update_profile():
    email = request.form.get('email')
    
    if not email:
        return jsonify({'success': False, 'message': 'Email is required'}), 400
    
    if not is_valid_email(email):
        return jsonify({'success': False, 'message': 'Invalid email format'}), 400
    
    # Check if email is already taken by another user
    existing_user = User.query.filter_by(email=email).first()
    if existing_user and existing_user.id != current_user.id:
        return jsonify({'success': False, 'message': 'Email already in use'}), 400
    
    # Update email
    current_user.email = email
    db.session.commit()
    
    app.logger.info(f'Profile updated for user {current_user.username}')
    return jsonify({'success': True, 'message': 'Profile updated successfully'})

# Add this function after your User model definition
def init_db():
    with app.app_context():
        # Drop all tables
        db.drop_all()
        
        # Create all tables
        db.create_all()
        
        # Create an admin user
        admin = User(
            username='admin',
            email='admin@example.com',
            password=generate_password_hash('Admin123!'),
            is_admin=True
        )
        
        try:
            db.session.add(admin)
            db.session.commit()
            print("Database initialized with admin user")
        except Exception as e:
            print(f"Error creating admin user: {e}")
            db.session.rollback()

# Add these routes after your existing routes
@app.route('/forgot_password', methods=['GET', 'POST'])
@limiter.limit("3 per minute")
@sanitize_input
def forgot_password():
    form = CSRFForm()
    if request.method == 'POST' and form.validate_on_submit():
        email = request.form.get('email')
        user = User.query.filter_by(email=email).first()
        
        if user:
            # Generate token
            token = serializer.dumps(user.email, salt='password-reset-salt')
            
            # Create password reset link
            reset_url = url_for('reset_password', token=token, _external=True)
            
            # Send email
            msg = Message('Password Reset Request',
                        recipients=[user.email])
            msg.body = f'''To reset your password, visit the following link:
{reset_url}

If you did not make this request, please ignore this email.
'''
            mail.send(msg)
            
            flash('Password reset instructions sent to your email.')
            app.logger.info(f'Password reset requested for user {user.username}')
        else:
            # Send the same message even if email doesn't exist (security through obscurity)
            flash('Password reset instructions sent to your email.')
            app.logger.warning(f'Password reset attempted for non-existent email: {email}')
            
        return redirect(url_for('login'))
    
    return render_template('forgot_password.html', form=form)

@app.route('/reset_password/<token>', methods=['GET', 'POST'])
@limiter.limit("3 per minute")
@sanitize_input
def reset_password(token):
    form = CSRFForm()
    try:
        email = serializer.loads(token, salt='password-reset-salt', max_age=3600)  # Token expires in 1 hour
    except:
        flash('The password reset link is invalid or has expired.')
        return redirect(url_for('forgot_password'))
    
    user = User.query.filter_by(email=email).first()
    if not user:
        flash('User not found.')
        return redirect(url_for('forgot_password'))
    
    if request.method == 'POST' and form.validate_on_submit():
        new_password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if new_password != confirm_password:
            flash('Passwords do not match.')
            return render_template('reset_password.html', form=form)
        
        # Validate password strength
        is_valid, password_error = is_valid_password(new_password)
        if not is_valid:
            flash(password_error)
            return render_template('reset_password.html', form=form)
        
        # Update password
        user.password = generate_password_hash(new_password, method='pbkdf2:sha256')
        db.session.commit()
        
        app.logger.info(f'Password reset successful for user {user.username}')
        flash('Your password has been reset successfully. Please login.')
        return redirect(url_for('login'))
    
    return render_template('reset_password.html', form=form)

# Test route for email
@app.route('/send_test_email')
def send_test_email():
    try:
        msg = Message(
            'Test Email from Flask App',
            sender='lucywangechi921@gmail.com',
            recipients=['lucywangechi921@gmail.com']
        )
        msg.body = 'This is a test email from your Flask application. If you receive this, your email configuration is working!'
        mail.send(msg)
        return 'Test email sent successfully! Check your inbox.'
    except Exception as e:
        app.logger.error(f'Failed to send test email: {e}')
        return f'Failed to send test email: {str(e)}', 500

# Add these routes after your existing routes

@app.route('/markets')
@login_required
def markets():
    form = CSRFForm()
    initial_data = {
        symbol: market_cache.get_market_data(symbol)
        for symbol in market_cache.symbols
    }
    return render_template(
        'markets.html',
        form=form,
        active_page='markets',
        initial_data=initial_data
    )

@app.route('/matches')
@login_required
def matches():
    form = CSRFForm()
    # Pre-fetch initial market data for faster loading
    initial_data = {
        symbol: market_cache.get_market_data(symbol)
        for symbol in market_cache.symbols
    }
    return render_template(
        'matches.html',
        form=form,
        active_page='matches',
        initial_data=initial_data
    )

@app.route('/rise-fall')
@login_required
def rise_fall():
    form = CSRFForm()
    return render_template('rise_fall.html', form=form, active_page='rise_fall')

@app.route('/over-under')
@login_required
def over_under():
    form = CSRFForm()
    return render_template('over_under.html', form=form, active_page='over_under')

@app.route('/alerts')
@login_required
def alerts():
    form = CSRFForm()
    # You might want to fetch actual alerts from the database
    alerts = []  # Replace with actual alerts data
    return render_template('alerts.html', form=form, alerts=alerts, active_page='alerts')

@app.route('/premium')
@login_required
def premium():
    form = CSRFForm()
    # You might want to fetch user's premium status
    premium_status = False  # Replace with actual premium status
    return render_template('premium.html', form=form, premium_status=premium_status, active_page='premium')

# Add new market data routes
@app.route('/api/market-data/<symbol>')
@login_required
def get_market_data(symbol):
    try:
        data = market_cache.get_market_data(symbol)
        return jsonify({
            'success': True,
            'data': data
        })
    except Exception as e:
        app.logger.error(f'Error fetching market data for {symbol}: {str(e)}')
        return jsonify({
            'success': False,
            'message': 'Failed to fetch market data'
        }), 500

# Add cache status endpoint for monitoring
@app.route('/api/cache-status')
@login_required
def cache_status():
    if not current_user.is_admin:
        return jsonify({
            'success': False,
            'message': 'Access denied'
        }), 403

    status = {
        symbol: {
            'last_update': market_cache.cache[symbol]['last_update'],
            'tick_count': len(market_cache.cache[symbol]['ticks']),
            'memory_usage': len(str(market_cache.cache[symbol])),
        }
        for symbol in market_cache.symbols
    }
    
    return jsonify({
        'success': True,
        'status': status
    })

# Add cache control endpoints for admins
@app.route('/api/cache/clear/<symbol>', methods=['POST'])
@login_required
def clear_cache(symbol):
    if not current_user.is_admin:
        return jsonify({
            'success': False,
            'message': 'Access denied'
        }), 403

    try:
        with market_cache.lock:
            market_cache.cache[symbol] = market_cache.cache.default_factory()
        return jsonify({
            'success': True,
            'message': f'Cache cleared for {symbol}'
        })
    except Exception as e:
        app.logger.error(f'Error clearing cache for {symbol}: {str(e)}')
        return jsonify({
            'success': False,
            'message': 'Failed to clear cache'
        }), 500

# Add websocket status endpoint
@app.route('/api/websocket-status')
@login_required
def websocket_status():
    if not current_user.is_admin:
        return jsonify({
            'success': False,
            'message': 'Access denied'
        }), 403

    return jsonify({
        'success': True,
        'status': {
            'connected': market_cache.ws.sock and market_cache.ws.sock.connected,
            'last_error': getattr(market_cache.ws, 'last_error', None),
            'reconnect_count': getattr(market_cache.ws, 'reconnect_count', 0)
        }
    })

# Update the main block at the bottom of the file
if __name__ == '__main__':
    init_db()  # Initialize the database
    app.run(debug=True)