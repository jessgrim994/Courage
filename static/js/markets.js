class DerivWebSocket {
    constructor() {
        this.ws = null;
        this.appId = '1089';
        this.apiToken = 'EHnGivjENIEwmTF';
        this.markets = {
            "R_100": "Volatility 100 Index",
            "R_50": "Volatility 50 Index",
            "R_10": "Volatility 10 Index",
            "R_75": "Volatility 75 Index",
            "R_25": "Volatility 25 Index",
            "1HZ25V": "Volatility (1s) 25 Index",
            "1HZ10V": "Volatility (1s) 10 Index",
            "1HZ50V": "Volatility (1s) 50 Index",
            "1HZ75V": "Volatility (1s) 75 Index",
            "1HZ100V": "Volatility (1s) 100 Index",
        };
        this.activeSubscriptions = new Map();
        this.priceHistory = {};
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.heartbeatInterval = null;
        this.requestId = 1;
        this.init();
    }

    async init() {
        try {
            this.connect();
            this.initializeMarketsUI();
        } catch (error) {
            console.error('Initialization failed:', error);
            this.handleError(error);
        }
    }

    connect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.handleError(new Error('Max reconnection attempts reached'));
            return;
        }

        try {
            this.ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`);
            this.setupWebSocketHandlers();
            this.startHeartbeat();
        } catch (error) {
            this.handleError(error);
        }
    }

    setupWebSocketHandlers() {
        this.ws.onopen = () => {
            console.log('Connected to Deriv WebSocket');
            this.reconnectAttempts = 0;
            this.authorize();
            this.subscribeToAllMarkets();
        };

        this.ws.onmessage = (msg) => {
            try {
                const response = JSON.parse(msg.data);
                this.handleResponse(response);
            } catch (error) {
                this.handleError(error);
            }
        };

        this.ws.onclose = (event) => {
            this.handleDisconnect(event);
        };

        this.ws.onerror = (error) => {
            this.handleError(error);
        };
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ ping: 1 }));
            }
        }, 30000);
    }

    handleDisconnect(event) {
        console.log('Disconnected from Deriv WebSocket:', event);
        clearInterval(this.heartbeatInterval);
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), this.reconnectDelay);
        } else {
            this.handleError(new Error('Connection lost'));
        }
    }

    handleError(error) {
        console.error('WebSocket Error:', error);
        const errorMessage = error.message || 'An error occurred';
        this.showErrorNotification(errorMessage);
    }

    showErrorNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    authorize() {
        const req_id = this.getNextRequestId();
        this.ws.send(JSON.stringify({
            authorize: this.apiToken,
            req_id: req_id
        }));
    }

    subscribeToAllMarkets() {
        Object.keys(this.markets).forEach(symbol => {
            this.subscribeTicks(symbol);
            this.priceHistory[symbol] = [];
        });
    }

    subscribeTicks(symbol) {
        const req_id = this.getNextRequestId();
        const request = {
            ticks: symbol,
            subscribe: 1,
            req_id: req_id
        };
        
        console.log('Subscribing to:', request);
        this.ws.send(JSON.stringify(request));
        this.activeSubscriptions.set(req_id, symbol);
    }

    getNextRequestId() {
        return `${this.requestId++}`;
    }

    handleResponse(response) {
        if (response.error) {
            console.error('API Error:', response.error.message, response);
            return;
        }

        if (response.msg_type === 'authorize') {
            console.log('Authorization successful');
            this.subscribeToAllMarkets();
            return;
        }

        if (response.msg_type === 'tick') {
            this.updateMarketCard(response.tick);
            this.updatePriceHistory(response.tick);
        }
    }

    updatePriceHistory(tick) {
        const symbol = tick.symbol;
        if (!this.priceHistory[symbol]) {
            this.priceHistory[symbol] = [];
        }

        this.priceHistory[symbol].push({
            time: new Date(tick.epoch * 1000),
            price: tick.quote
        });

        // Keep only last 100 prices
        if (this.priceHistory[symbol].length > 100) {
            this.priceHistory[symbol].shift();
        }

        this.updatePriceDisplay(symbol);
    }

    updateMarketCard(tick) {
        const marketCard = document.querySelector(`[data-symbol="${tick.symbol}"]`);
        if (!marketCard) return;

        const priceElement = marketCard.querySelector('.price');
        const changeElement = marketCard.querySelector('.market-status');
        const oldPrice = parseFloat(priceElement.getAttribute('data-price') || '0');
        const newPrice = tick.quote;

        // Update price
        priceElement.setAttribute('data-price', newPrice);
        priceElement.textContent = newPrice.toFixed(5);
        priceElement.classList.add('updating');
        setTimeout(() => priceElement.classList.remove('updating'), 300);

        // Calculate and update percentage change
        if (oldPrice !== 0) {
            const priceChange = ((newPrice - oldPrice) / oldPrice) * 100;
            const changeText = priceChange >= 0 ? `+${priceChange.toFixed(2)}%` : `${priceChange.toFixed(2)}%`;
            changeElement.textContent = changeText;
            changeElement.className = `market-status ${priceChange >= 0 ? 'up' : 'down'}`;
        }
    }

    updatePriceDisplay(symbol) {
        const marketCard = document.querySelector(`[data-symbol="${symbol}"]`);
        if (!marketCard) return;

        const priceHistory = this.priceHistory[symbol];
        if (priceHistory.length < 2) return;

        const latestPrice = priceHistory[priceHistory.length - 1].price;
        const previousPrice = priceHistory[priceHistory.length - 2].price;
        
        const priceChange = ((latestPrice - previousPrice) / previousPrice) * 100;
        const trendIndicator = marketCard.querySelector('.trend-indicator');
        
        trendIndicator.innerHTML = this.generateSparkline(priceHistory);
        trendIndicator.className = `trend-indicator ${priceChange >= 0 ? 'up' : 'down'}`;
    }

    generateSparkline(priceHistory) {
        const prices = priceHistory.map(p => p.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min;
        
        const width = 100;
        const height = 30;
        const points = prices.map((price, index) => {
            const x = (index / (prices.length - 1)) * width;
            const y = height - ((price - min) / range) * height;
            return `${x},${y}`;
        }).join(' ');

        return `
            <svg width="${width}" height="${height}" class="sparkline">
                <polyline points="${points}" 
                          fill="none" 
                          stroke="currentColor" 
                          stroke-width="1"/>
            </svg>
        `;
    }

    initializeMarketsUI() {
        const marketsGrid = document.querySelector('.markets-grid');
        marketsGrid.innerHTML = '';

        Object.entries(this.markets).forEach(([symbol, name]) => {
            const card = this.createMarketCard(symbol, name);
            marketsGrid.appendChild(card);
        });
    }

    createMarketCard(symbol, name) {
        const card = document.createElement('div');
        card.className = 'market-card';
        card.setAttribute('data-symbol', symbol);
        card.setAttribute('data-type', symbol.includes('1HZ') ? '1s' : 'standard');
        
        card.innerHTML = `
            <div class="market-header">
                <div class="market-title">
                    <h3>${name}</h3>
                    <span class="market-symbol">${symbol}</span>
                </div>
                <div class="market-indicators">
                    <span class="market-status">--</span>
                    <span class="volatility-indicator">
                        <i class="fas fa-bolt"></i>
                        <span class="volatility-level">Medium</span>
                    </span>
                </div>
            </div>
            <div class="market-body">
                <div class="price-section">
                    <div class="price" data-price="0">0.00000</div>
                    <div class="price-change">
                        <span class="change-value">0.00%</span>
                        <span class="change-arrow"><i class="fas fa-arrow-up"></i></span>
                    </div>
                </div>
                <div class="market-stats">
                    <div class="stat-item">
                        <span class="stat-label">24h High</span>
                        <span class="stat-value high">0.00000</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">24h Low</span>
                        <span class="stat-value low">0.00000</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Volume</span>
                        <span class="stat-value volume">0</span>
                    </div>
                </div>
                <div class="trend-container">
                    <div class="trend-indicator"></div>
                    <div class="trend-stats">
                        <div class="trend-stat up">
                            <span class="trend-label">Rise</span>
                            <span class="trend-value">52%</span>
                        </div>
                        <div class="trend-stat down">
                            <span class="trend-label">Fall</span>
                            <span class="trend-value">48%</span>
                        </div>
                    </div>
                </div>
                <div class="digit-preview">
                    <span class="last-digit">Last: <b>5</b></span>
                    <div class="digit-pattern">
                        <span class="pattern-digit">7</span>
                        <span class="pattern-digit">3</span>
                        <span class="pattern-digit">5</span>
                    </div>
                </div>
                <div class="trade-buttons">
                    <button class="trade-btn rise" onclick="window.location.href='/rise_fall?symbol=${symbol}'">
                        <i class="fas fa-arrow-up"></i> Rise
                    </button>
                    <button class="trade-btn fall" onclick="window.location.href='/rise_fall?symbol=${symbol}'">
                        <i class="fas fa-arrow-down"></i> Fall
                    </button>
                </div>
            </div>
            <div class="market-footer">
                <button class="action-btn" onclick="window.derivWS.showPremiumModal('analysis')">
                    <i class="fas fa-chart-line"></i> Analysis
                </button>
                <button class="action-btn" onclick="window.derivWS.showPremiumModal('alerts')">
                    <i class="fas fa-bell"></i> Set Alert
                </button>
                <button class="action-btn favorite">
                    <i class="far fa-star"></i>
                </button>
            </div>
        `;

        return card;
    }

    showPremiumModal(feature) {
        const modal = document.getElementById('premiumFeatureModal');
        if (modal) {
            modal.style.display = 'block';
            
            // Close modal when clicking outside
            window.onclick = function(event) {
                if (event.target == modal) {
                    modal.style.display = 'none';
                }
            }

            // Close modal when clicking "Maybe Later"
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.onclick = function() {
                    modal.style.display = 'none';
                }
            }
        }
    }
}

// Initialize with error handling
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.derivWS = new DerivWebSocket();
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
    }
}); 