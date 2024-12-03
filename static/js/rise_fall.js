class TradingInterface {
    constructor() {
        this.ws = null;
        this.appId = '1089';
        this.currentSymbol = 'R_100';
        this.chartData = [];
        this.digitStats = new Array(10).fill(0);
        this.patterns = [];
        
        this.initializeElements();
        this.setupWebSocket();
        this.initializeEventListeners();
    }

    initializeElements() {
        // Market selector
        this.marketSelect = document.getElementById('marketSelect');
        this.currentPrice = document.querySelector('.current-price');
        this.priceChange = document.querySelector('.price-change');

        // Trading controls
        this.stakeInput = document.querySelector('.stake-input input');
        this.quickAmountBtns = document.querySelectorAll('.quick-amounts button');
        this.timeButtons = document.querySelectorAll('.time-btn');
        this.tradeButtons = document.querySelectorAll('.trade-btn');

        // Stats elements
        this.digitGrid = document.querySelector('.digit-grid');
        this.patternList = document.querySelector('.pattern-list');

        // Chart container
        this.chartContainer = document.querySelector('.chart-container');
        this.chartOverlay = document.querySelector('.chart-overlay');
    }

    setupWebSocket() {
        this.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=' + this.appId);
        
        this.ws.onopen = () => {
            this.subscribe();
            this.showNotification('Connected to market feed', 'success');
        };

        this.ws.onclose = () => {
            this.showNotification('Connection lost. Reconnecting...', 'warning');
            setTimeout(() => this.setupWebSocket(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            this.showNotification('Connection error occurred', 'error');
        };

        this.ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            this.handleWebSocketMessage(data);
        };
    }

    subscribe() {
        // Subscribe to tick stream
        this.ws.send(JSON.stringify({
            ticks: this.currentSymbol,
            subscribe: 1
        }));

        // Request history
        this.ws.send(JSON.stringify({
            ticks_history: this.currentSymbol,
            adjust_start_time: 1,
            count: 1000,
            end: 'latest',
            start: 1,
            style: 'ticks'
        }));
    }

    initializeEventListeners() {
        // Market selector
        this.marketSelect?.addEventListener('change', (e) => {
            this.currentSymbol = e.target.value;
            this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
            this.subscribe();
            this.resetStats();
        });

        // Quick amount buttons
        this.quickAmountBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = parseInt(btn.textContent.replace('+', ''));
                if (btn.textContent === 'Max') {
                    this.stakeInput.value = '1000';
                } else {
                    const newValue = parseInt(this.stakeInput.value) + amount;
                    this.stakeInput.value = Math.min(newValue, 1000);
                }
            });
        });

        // Time buttons
        this.timeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.timeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Stake input validation
        this.stakeInput?.addEventListener('input', (e) => {
            let value = parseInt(e.target.value);
            if (isNaN(value)) value = 1;
            if (value > 1000) value = 1000;
            if (value < 1) value = 1;
            e.target.value = value;
        });
    }

    handleWebSocketMessage(data) {
        if (data.tick) {
            this.updatePrice(data.tick);
            this.updateDigitStats(data.tick.quote);
            this.updatePatterns();
        } else if (data.history) {
            this.chartData = data.history.prices;
            this.initializeChart();
        }
    }

    updatePrice(tick) {
        if (this.currentPrice) {
            const price = tick.quote.toFixed(5);
            const prevPrice = this.currentPrice.textContent;
            
            this.currentPrice.textContent = price;
            this.currentPrice.classList.add(price > prevPrice ? 'up' : 'down');
            
            setTimeout(() => {
                this.currentPrice.classList.remove('up', 'down');
            }, 500);
        }
    }

    updateDigitStats(price) {
        const lastDigit = Math.floor(price * 100000) % 10;
        this.digitStats[lastDigit]++;
        this.updateDigitDisplay();
    }

    updateDigitDisplay() {
        if (!this.digitGrid) return;

        this.digitGrid.innerHTML = '';
        const total = this.digitStats.reduce((a, b) => a + b, 0);

        this.digitStats.forEach((count, digit) => {
            const percentage = total ? ((count / total) * 100).toFixed(1) : 0;
            const digitEl = document.createElement('div');
            digitEl.className = 'digit-stat';
            digitEl.innerHTML = `
                <span class="digit">${digit}</span>
                <span class="count">${count}</span>
                <span class="percentage">${percentage}%</span>
            `;
            this.digitGrid.appendChild(digitEl);
        });
    }

    updatePatterns() {
        // Implementation for pattern detection
        // This is a placeholder for the premium feature
    }

    initializeChart() {
        this.chartOverlay.style.display = 'none';
        // Chart implementation will go here
        // This is a placeholder for the actual charting library
    }

    showNotification(message, type = 'info') {
        const event = new CustomEvent('showNotification', {
            detail: { message, type }
        });
        window.dispatchEvent(event);
    }

    resetStats() {
        this.digitStats = new Array(10).fill(0);
        this.patterns = [];
        this.updateDigitDisplay();
        this.chartOverlay.style.display = 'flex';
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.tradingInterface = new TradingInterface();
}); 