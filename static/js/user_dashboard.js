document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initializeNotifications();
    initializePasswordModal();
    initializeMarketUpdates();
    initializeAnimations();
    initializeMobileMenu();
    
    // Track user activity
    let lastActivity = Date.now();
    document.addEventListener('mousemove', () => lastActivity = Date.now());
    document.addEventListener('keypress', () => lastActivity = Date.now());
    
    // Auto refresh data every 30 seconds if user is active
    setInterval(() => {
        if (Date.now() - lastActivity < 300000) { // 5 minutes
            updateMarketData();
        }
    }, 30000);
});

// Notification System
function initializeNotifications() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationPanel = document.getElementById('notificationPanel');
    const closePanel = document.querySelector('.close-panel');
    
    if (notificationBtn && notificationPanel) {
        notificationBtn.addEventListener('click', () => {
            notificationPanel.classList.toggle('active');
            loadNotifications();
        });
        
        closePanel.addEventListener('click', () => {
            notificationPanel.classList.remove('active');
        });
        
        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!notificationPanel.contains(e.target) && 
                !notificationBtn.contains(e.target)) {
                notificationPanel.classList.remove('active');
            }
        });
    }
}

async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications');
        const notifications = await response.json();
        
        const notificationList = document.querySelector('.notification-list');
        notificationList.innerHTML = notifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}">
                <div class="notification-icon">
                    <i class="fas ${getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <p class="notification-text">${notification.message}</p>
                    <span class="notification-time">${formatTime(notification.timestamp)}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

// Password Modal
function initializePasswordModal() {
    const modal = document.getElementById('passwordModal');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const closeBtn = modal.querySelector('.modal-close');
    const form = document.getElementById('passwordChangeForm');
    
    changePasswordBtn.addEventListener('click', () => {
        modal.classList.add('active');
        animateModal(modal);
    });
    
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        try {
            const response = await fetch('/api/change-password', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                showNotification('Password updated successfully!', 'success');
                modal.classList.remove('active');
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            showNotification('Failed to update password', 'error');
        }
    });
}

// Market Data Updates
function initializeMarketUpdates() {
    const marketStats = document.querySelectorAll('.stat-item');
    
    marketStats.forEach(stat => {
        const value = stat.querySelector('.stat-value');
        const change = stat.querySelector('.stat-change');
        
        // Add hover effect
        stat.addEventListener('mouseenter', () => {
            stat.style.transform = 'scale(1.05)';
        });
        
        stat.addEventListener('mouseleave', () => {
            stat.style.transform = 'scale(1)';
        });
    });
}

async function updateMarketData() {
    try {
        const response = await fetch('/api/market-data');
        const data = await response.json();
        
        data.forEach(item => {
            const statElement = document.querySelector(`[data-pair="${item.pair}"]`);
            if (statElement) {
                const valueElement = statElement.querySelector('.stat-value');
                const changeElement = statElement.querySelector('.stat-change');
                
                // Animate value changes
                if (valueElement.textContent !== item.value) {
                    animateValue(valueElement, item.value);
                }
                
                // Update change percentage with animation
                changeElement.textContent = item.change;
                changeElement.classList.remove('up', 'down');
                changeElement.classList.add(item.change > 0 ? 'up' : 'down');
            }
        });
    } catch (error) {
        console.error('Failed to update market data:', error);
    }
}

// Animations
function initializeAnimations() {
    // Add entrance animations to cards
    const cards = document.querySelectorAll('.dashboard-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        setTimeout(() => {
            card.style.opacity = '1';
            card.classList.add('animate__animated', 'animate__fadeInUp');
        }, index * 100);
    });
}

function animateValue(element, newValue) {
    element.classList.add('updating');
    element.textContent = newValue;
    setTimeout(() => element.classList.remove('updating'), 300);
}

function animateModal(modal) {
    const content = modal.querySelector('.modal-content');
    content.style.transform = 'scale(0.7)';
    content.style.opacity = '0';
    
    setTimeout(() => {
        content.style.transform = 'scale(1)';
        content.style.opacity = '1';
    }, 50);
}

// Utility Functions
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
}

function getNotificationIcon(type) {
    const icons = {
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-times-circle',
        info: 'fa-info-circle'
    };
    return icons[type] || icons.info;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${getNotificationIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }, 100);
}

// Add dynamic styles
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .mobile-nav-toggle {
        display: none;
        background: transparent;
        border: none;
        color: var(--primary-color);
        font-size: 1.5rem;
        cursor: pointer;
    }

    @media (max-width: 768px) {
        .mobile-nav-toggle {
            display: block;
        }
    }
`;
document.head.appendChild(style); 

// Add this to your existing JavaScript
function initializeMobileMenu() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sideNav = document.querySelector('.side-nav');
    
    if (sidebarToggle && sideNav) {
        sidebarToggle.addEventListener('click', () => {
            sideNav.classList.toggle('active');
        });

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (!sideNav.contains(e.target) && 
                !sidebarToggle.contains(e.target) && 
                window.innerWidth <= 768) {
                sideNav.classList.remove('active');
            }
        });
    }
}

class DashboardWebSocket {
    constructor() {
        this.ws = null;
        this.markets = {
            'R_10': { name: 'V10', lastPrice: null },
            'R_25': { name: 'V25', lastPrice: null },
            'R_50': { name: 'V50', lastPrice: null }
        };
        this.connect();
    }

    connect() {
        this.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.subscribeToMarkets();
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.tick) {
                this.updateMarketStats(data.tick);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            setTimeout(() => this.connect(), 5000);
        };
    }

    subscribeToMarkets() {
        Object.keys(this.markets).forEach(symbol => {
            this.ws.send(JSON.stringify({
                ticks: symbol,
                subscribe: 1
            }));
        });
    }

    updateMarketStats(tick) {
        const market = this.markets[tick.symbol];
        if (!market) return;

        const price = tick.quote;
        const priceChange = market.lastPrice ? ((price - market.lastPrice) / market.lastPrice) * 100 : 0;
        market.lastPrice = price;

        // Find the stat item by iterating through all stat items
        const statItems = document.querySelectorAll('.stat-item');
        const statItem = Array.from(statItems).find(item => {
            const label = item.querySelector('.stat-label');
            return label && label.textContent === market.name;
        });

        if (statItem) {
            const valueElement = statItem.querySelector('.stat-value');
            const changeElement = statItem.querySelector('.stat-change');

            if (valueElement && changeElement) {
                valueElement.textContent = price.toFixed(5);
                changeElement.textContent = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`;

                // Update classes for styling
                statItem.classList.remove('up', 'down');
                statItem.classList.add(priceChange >= 0 ? 'up' : 'down');

                // Add animation
                valueElement.classList.add('price-update');
                setTimeout(() => valueElement.classList.remove('price-update'), 500);
            }
        }
    }
}

// UI Event Handlers
document.addEventListener('DOMContentLoaded', () => {
    // Initialize WebSocket
    window.dashboardWS = new DashboardWebSocket();

    // Notification Button
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationPanel = document.getElementById('notificationPanel');
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', () => {
            notificationPanel.classList.toggle('show');
        });
    }

    // Close Notification Panel
    const closePanel = document.querySelector('.close-panel');
    if (closePanel) {
        closePanel.addEventListener('click', () => {
            notificationPanel.classList.remove('show');
        });
    }

    // Change Password Modal
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const passwordModal = document.getElementById('passwordModal');
    const modalClose = document.querySelector('.modal-close');

    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            passwordModal.classList.add('show');
        });
    }

    if (modalClose) {
        modalClose.addEventListener('click', () => {
            passwordModal.classList.remove('show');
        });
    }

    // Password Change Form
    const passwordChangeForm = document.getElementById('passwordChangeForm');
    if (passwordChangeForm) {
        passwordChangeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Add password change logic here
        });
    }

    // Mobile Menu Toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            dashboardContainer.classList.toggle('sidebar-collapsed');
        });
    }
});

class DashboardManager {
    constructor() {
        this.activities = [];
        this.maxActivities = 4;
        this.marketData = {};
        this.patterns = {};
        this.streaks = {};
        this.setupWebSocket();
        this.initializeEventListeners();
    }

    setupWebSocket() {
        this.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.tick) {
                this.processTickData(data.tick);
            }
        };

        this.ws.onopen = () => {
            const symbols = [
                'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
                '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V'
            ];
            symbols.forEach(symbol => {
                this.ws.send(JSON.stringify({
                    ticks: symbol,
                    subscribe: 1
                }));
            });
        };
    }

    processTickData(tick) {
        const symbol = tick.symbol;
        const price = tick.quote;
        const lastDigit = parseInt(price.toString().slice(-1));
        
        // Initialize market data if needed
        if (!this.marketData[symbol]) {
            this.marketData[symbol] = {
                lastDigits: [],
                patterns: [],
                streaks: Array(10).fill(0),
                missingDigits: new Set(),
                lastUpdate: null
            };
        }

        const market = this.marketData[symbol];
        
        // Update last digits
        market.lastDigits.unshift(lastDigit);
        if (market.lastDigits.length > 1000) market.lastDigits.pop();

        // Check for significant events
        this.checkForSignificantEvents(symbol, lastDigit, price);
        
        market.lastUpdate = new Date();
    }

    checkForSignificantEvents(symbol, lastDigit, price) {
        // Check for streaks
        this.checkStreaks(symbol, lastDigit);

        // Check for missing digits
        this.checkMissingDigits(symbol);

        // Check for patterns
        this.checkPatterns(symbol);

        // Check for unusual distributions
        this.checkDistribution(symbol);
    }

    checkStreaks(symbol, digit) {
        const market = this.marketData[symbol];
        const currentStreak = market.lastDigits.findIndex(d => d !== digit);
        
        if (currentStreak >= 4) { // Significant streak threshold
            this.addActivity({
                type: 'info',
                title: `${this.formatSymbol(symbol)} Streak`,
                desc: `Digit ${digit} appeared ${currentStreak + 1} times in a row`,
                icon: 'fire',
                time: new Date()
            });
        }
    }

    checkMissingDigits(symbol) {
        const market = this.marketData[symbol];
        const lastHundred = market.lastDigits.slice(0, 100);
        const missing = new Set([0,1,2,3,4,5,6,7,8,9].filter(d => 
            !lastHundred.includes(d)));

        missing.forEach(digit => {
            if (!market.missingDigits.has(digit)) {
                this.addActivity({
                    type: 'warning',
                    title: `${this.formatSymbol(symbol)} Missing Digit`,
                    desc: `Digit ${digit} hasn't appeared in last 100 ticks`,
                    icon: 'search',
                    time: new Date()
                });
            }
        });

        market.missingDigits = missing;
    }

    checkPatterns(symbol) {
        const market = this.marketData[symbol];
        const pattern = market.lastDigits.slice(0, 5).join('');
        
        if (!this.patterns[pattern]) {
            this.patterns[pattern] = 1;
        } else if (this.patterns[pattern] === 2) { // Pattern appeared 3 times
            this.addActivity({
                type: 'success',
                title: `${this.formatSymbol(symbol)} Pattern`,
                desc: `Pattern ${pattern} detected multiple times`,
                icon: 'puzzle-piece',
                time: new Date()
            });
        }
        this.patterns[pattern]++;
    }

    checkDistribution(symbol) {
        const market = this.marketData[symbol];
        const counts = Array(10).fill(0);
        market.lastDigits.slice(0, 100).forEach(d => counts[d]++);
        
        counts.forEach((count, digit) => {
            if (count >= 20) { // More than 20% frequency
                this.addActivity({
                    type: 'primary',
                    title: `${this.formatSymbol(symbol)} Distribution`,
                    desc: `Digit ${digit} frequency: ${count}%`,
                    icon: 'chart-bar',
                    time: new Date()
                });
            }
        });
    }

    addActivity(activity) {
        const activityList = document.querySelector('.activity-list');
        if (!activityList) return;

        const timeString = this.formatTime(activity.time);
        
        const activityHTML = `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="fas fa-${activity.icon}"></i>
                </div>
                <div class="activity-details">
                    <span class="activity-title">${activity.title}</span>
                    <span class="activity-desc">${activity.desc}</span>
                    <span class="activity-time">${timeString}</span>
                </div>
                <div class="activity-alert ${activity.type}">
                    <i class="fas fa-${this.getAlertIcon(activity.type)}"></i>
                </div>
            </div>
        `;

        // Add new activity at the top
        activityList.insertAdjacentHTML('afterbegin', activityHTML);
        
        // Remove excess activities
        const activities = activityList.querySelectorAll('.activity-item');
        if (activities.length > this.maxActivities) {
            activities[activities.length - 1].remove();
        }

        // Animate new activity
        activities[0].classList.add('slide-in-right');
    }

    formatSymbol(symbol) {
        const matches = {
            'R_10': 'V10',
            'R_25': 'V25',
            'R_50': 'V50',
            'R_75': 'V75',
            'R_100': 'V100',
            '1HZ10V': 'V10 (1s)',
            '1HZ25V': 'V25 (1s)',
            '1HZ50V': 'V50 (1s)',
            '1HZ75V': 'V75 (1s)',
            '1HZ100V': 'V100 (1s)'
        };
        return matches[symbol] || symbol;
    }

    formatTime(date) {
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    getAlertIcon(type) {
        return {
            success: 'check-circle',
            warning: 'bell',
            info: 'info-circle',
            primary: 'chart-bar'
        }[type] || 'info-circle';
    }
}

// Initialize dashboard when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});