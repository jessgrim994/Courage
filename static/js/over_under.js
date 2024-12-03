class OverUnderInterface {
    constructor() {
        this.ws = null;
        this.appId = '1089';
        this.currentSymbol = 'R_100';
        this.chartData = [];
        this.priceHistory = [];
        this.targetPrice = 0;
        
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

        // Price level controls
        this.priceLevelInput = document.querySelector('.price-input input');
        this.plusBtn = document.querySelector('.adjust-btn.plus');
        this.minusBtn = document.querySelector('.adjust-btn.minus');

        // Stats elements
        this.distributionChart = document.querySelector('.distribution-chart');
        this.levelStats = document.querySelector('.level-stats');

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

        // Price level controls
        this.plusBtn?.addEventListener('click', () => this.adjustPriceLevel(0.0001));
        this.minusBtn?.addEventListener('click', () => this.adjustPriceLevel(-0.0001));

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
            this.updatePriceHistory(data.tick.quote);
            this.updateDistributionChart();
        } else if (data.history) {
            this.chartData = data.history.prices;
            this.initializeChart();
            this.calculateInitialTargetPrice();
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

    updatePriceHistory(price) {
        this.priceHistory.push(price);
        if (this.priceHistory.length > 1000) {
            this.priceHistory.shift();
        }
    }

    calculateInitialTargetPrice() {
        if (this.chartData.length > 0) {
            const lastPrice = this.chartData[this.chartData.length - 1];
            this.targetPrice = parseFloat(lastPrice);
            if (this.priceLevelInput) {
                this.priceLevelInput.value = this.targetPrice.toFixed(4);
            }
        }
    }

    adjustPriceLevel(adjustment) {
        if (this.priceLevelInput) {
            const currentValue = parseFloat(this.priceLevelInput.value);
            const newValue = (currentValue + adjustment).toFixed(4);
            this.priceLevelInput.value = newValue;
            this.targetPrice = parseFloat(newValue);
        }
    }

    updateDistributionChart() {
        // Placeholder for price distribution chart update
        // This will be implemented when the feature is ready
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
        this.priceHistory = [];
        this.chartOverlay.style.display = 'flex';
        if (this.distributionChart) {
            // Reset distribution chart
        }
        if (this.levelStats) {
            this.levelStats.innerHTML = '<div class="coming-soon">Statistics will be available soon</div>';
        }
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.overUnderInterface = new OverUnderInterface();
}); 