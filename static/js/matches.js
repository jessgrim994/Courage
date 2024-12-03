class VolatilityTracker {
    constructor() {
        this.ws = null;
        this.markets = {};
        this.currentSymbol = null;
        this.symbols = [
            'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
            '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V'
        ];
        this.maxDigits = 10;
        this.defaultSampleSize = 1000;
        this.missingDigitsTracker = {
            threshold: 50,
            digitCounts: Array(10).fill(0),
            lastAppearance: Array(10).fill(0),
            averageAppearance: Array(10).fill([]),
            maxAverageHistory: 10
        };
        this.patternLength = 5;
        this.streakData = {
            currentStreaks: Array(10).fill(0),
            longestStreaks: Array(10).fill(0)
        };
        this.pairStats = {
            matrix: Array(10).fill().map(() => Array(10).fill(0)),
            totalPairs: 0,
            direction: 'next',
            maxCount: 0
        };
        this.rangeData = {
            high: null,
            low: null,
            rangeHistory: []
        };
        this.connect();
        this.setupEventListeners();
        this.initializeFromCache();
    }

    async initializeFromCache() {
        for (const symbol of this.symbols) {
            try {
                const response = await fetch(`/api/market-data/${symbol}`);
                const data = await response.json();
                
                this.markets[symbol] = {
                    lastPrice: data.ticks[0]?.price || null,
                    tickHistory: data.ticks.map(t => ({
                        time: new Date(t.time * 1000).toLocaleTimeString(),
                        price: this.formatPrice(t.price),
                        change: '0.00',
                        digit: t.digit
                    })),
                    lastDigits: data.last_digits,
                    digitStats: data.digit_stats
                };

                // Calculate price changes
                for (let i = 1; i < this.markets[symbol].tickHistory.length; i++) {
                    const current = data.ticks[i - 1].price;
                    const previous = data.ticks[i].price;
                    this.markets[symbol].tickHistory[i].change = 
                        (current - previous).toFixed(2);
                }

                // Initialize pairs matrix
                this.pairStats.matrix = data.pairs_matrix;
                
                // Update displays if this is the current symbol
                if (symbol === this.currentSymbol) {
                    this.updateAllDisplays();
                }
            } catch (error) {
                console.error(`Error loading cache for ${symbol}:`, error);
            }
        }
    }

    updateAllDisplays() {
        const market = this.markets[this.currentSymbol];
        if (!market || !market.tickHistory[0]) return;

        const latest = market.tickHistory[0];
        this.updateDisplays(
            latest.price,
            latest.change,
            latest.digit,
            latest.time
        );
    }

    connect() {
        this.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.symbols.forEach(symbol => {
                this.subscribeToSymbol(symbol);
            });
            this.switchMarket(this.symbols[0]);
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.tick) {
                this.handleTick(data.tick);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            setTimeout(() => this.connect(), 5000);
        };
    }

    subscribeToSymbol(symbol) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                ticks: symbol,
                subscribe: 1
            }));
            
            this.markets[symbol] = {
                lastPrice: null,
                tickHistory: [],
                lastDigits: [],
                digitStats: {
                    counts: Array(10).fill(0),
                    total: 0,
                    maxSamples: this.defaultSampleSize
                }
            };
        }
    }

    handleTick(tick) {
        const symbol = tick.symbol;
        const market = this.markets[symbol];
        
        if (!market) return;

        const rawPrice = tick.quote;
        const formattedPrice = this.formatPrice(rawPrice);
        const time = new Date(tick.epoch * 1000).toLocaleTimeString();
        const lastDigit = this.getLastDigit(rawPrice);
        const priceChange = market.lastPrice ? 
            (rawPrice - market.lastPrice).toFixed(2) : 
            '0.00';

        this.updateMarketData(symbol, {
            price: rawPrice,
            formattedPrice,
            time,
            lastDigit,
            priceChange
        });

        if (symbol === this.currentSymbol) {
            this.updateDisplays(formattedPrice, priceChange, lastDigit, time);
        }
    }

    updateDisplays(formattedPrice, priceChange, lastDigit, time) {
        // Update current price
        const priceDisplay = document.querySelector('.current-price');
        if (priceDisplay) {
            priceDisplay.textContent = formattedPrice;
            priceDisplay.classList.add('price-update');
            setTimeout(() => priceDisplay.classList.remove('price-update'), 500);
        }

        // Update price change
        const changeDisplay = document.querySelector('.price-change');
        if (changeDisplay) {
            const changeValue = parseFloat(priceChange);
            changeDisplay.textContent = `${changeValue >= 0 ? '+' : ''}${priceChange}`;
            changeDisplay.className = `price-change ${changeValue >= 0 ? 'positive' : 'negative'}`;
        }

        // Update last digits display
        const market = this.markets[this.currentSymbol];
        if (market) {
            const digitDisplay = document.querySelector('.digit-display');
            if (digitDisplay) {
                digitDisplay.innerHTML = market.lastDigits.map(digit => 
                    `<div class="digit">${digit}</div>`
                ).join('');
            }

            // Update tick history
            const historyBody = document.querySelector('.tick-history tbody');
            if (historyBody) {
                historyBody.innerHTML = market.tickHistory.map(tick => `
                    <tr>
                        <td>${tick.time}</td>
                        <td>${tick.price}</td>
                        <td class="${parseFloat(tick.change) >= 0 ? 'positive' : 'negative'}">
                            ${parseFloat(tick.change) >= 0 ? '+' : ''}${tick.change}
                        </td>
                        <td>${tick.digit}</td>
                    </tr>
                `).join('');
            }
        }

        this.updatePatternDisplay();
        this.updateStreakDisplay();
        this.updatePairsDisplay();
        this.updateRangeDisplay(parseFloat(formattedPrice));
    }

    updateMarketData(symbol, tickData) {
        const market = this.markets[symbol];
        
        // Update last digits
        market.lastDigits.unshift(tickData.lastDigit);
        if (market.lastDigits.length > this.maxDigits) {
            market.lastDigits.pop();
        }

        // Add back tick history update
        market.tickHistory.unshift({
            time: tickData.time,
            price: tickData.formattedPrice,
            change: tickData.priceChange,
            digit: tickData.lastDigit
        });
        if (market.tickHistory.length > this.maxHistory) {
            market.tickHistory.pop();
        }

        // Update digit statistics
        const stats = market.digitStats;
        stats.counts[tickData.lastDigit]++;
        stats.total++;
        
        if (stats.total > stats.maxSamples) {
            stats.counts[market.lastDigits[stats.maxSamples - 1]]--;
            stats.total--;
        }

        market.lastPrice = tickData.price;

        // Update missing digits tracker
        if (symbol === this.currentSymbol) {
            const lastDigit = tickData.lastDigit;
            
            this.missingDigitsTracker.digitCounts = this.missingDigitsTracker.digitCounts.map((count, digit) => {
                if (digit === lastDigit) {
                    if (count > 0) {
                        const appearances = this.missingDigitsTracker.averageAppearance[digit];
                        appearances.unshift(count);
                        if (appearances.length > this.missingDigitsTracker.maxAverageHistory) {
                            appearances.pop();
                        }
                    }
                    return 0;
                }
                return count + 1;
            });

            this.updateMissingDigitsDisplay();
            this.updateDigitStats();
        }
    }

    formatPrice(price) {
        // Convert to number and fix to 2 decimal places
        return Number(price).toFixed(2);
    }

    getLastDigit(price) {
        const formattedPrice = this.formatPrice(price);
        return parseInt(formattedPrice.slice(-1));
    }

    updateDigitStats(forceRefresh = false) {
        if (!this.currentSymbol || !this.markets[this.currentSymbol]) return;

        const market = this.markets[this.currentSymbol];
        const stats = market.digitStats;

        if (forceRefresh) {
            stats.counts = Array(10).fill(0);
            stats.total = 0;
            
            // Recount from existing history
            market.lastDigits.slice(0, stats.maxSamples).forEach(digit => {
                stats.counts[digit]++;
                stats.total++;
            });
        }

        // Update sample count display
        const sampleCount = document.getElementById('sampleCount');
        if (sampleCount) {
            sampleCount.textContent = `(${stats.total} samples)`;
        }

        // Calculate percentages and find most/least frequent
        const percentages = stats.counts.map(count => 
            (count / stats.total * 100) || 0
        );

        let maxPercent = Math.max(...percentages);
        let minPercent = Math.min(...percentages);
        let mostFrequent = percentages.indexOf(maxPercent);
        let leastFrequent = percentages.indexOf(minPercent);

        // Update stats display
        document.getElementById('mostFrequent').textContent = 
            `${mostFrequent} (${maxPercent.toFixed(1)}%)`;
        document.getElementById('leastFrequent').textContent = 
            `${leastFrequent} (${minPercent.toFixed(1)}%)`;

        // Update chart bars
        const barsContainer = document.querySelector('.chart-bars');
        if (barsContainer) {
            barsContainer.innerHTML = percentages.map((percent, digit) => `
                <div class="chart-bar-wrapper">
                    <div class="chart-bar-label">${percent.toFixed(1)}%</div>
                    <div class="chart-bar" style="height: ${percent}%;" data-digit="${digit}">
                        <div class="chart-bar-highlight"></div>
                    </div>
                    <div class="chart-bar-digit">${digit}</div>
                </div>
            `).join('');
        }
    }

    clearDisplays() {
        document.querySelector('.current-price').textContent = 'Loading...';
        document.querySelector('.price-change').textContent = '';
        document.querySelector('.digit-display').innerHTML = '';
        document.querySelector('.tick-history tbody').innerHTML = '';
        
        // Reset current market's data
        if (this.currentSymbol && this.markets[this.currentSymbol]) {
            const market = this.markets[this.currentSymbol];
            market.lastDigits = [];
            market.tickHistory = [];
            market.digitStats.counts = Array(10).fill(0);
            market.digitStats.total = 0;
        }
    }

    updateMissingDigitsDisplay() {
        const market = this.markets[this.currentSymbol];
        if (!market) return;

        const grid = document.querySelector('.missing-digits-grid');
        const statsContainer = document.querySelector('.average-stats-container');
        const alertContainer = document.querySelector('.alert-container');

        if (!grid || !statsContainer || !alertContainer) return;

        // Update grid
        grid.innerHTML = this.missingDigitsTracker.digitCounts.map((count, digit) => {
            const isMissing = count >= this.missingDigitsTracker.threshold;
            const avgAppearance = this.calculateAverageAppearance(digit);
            
            return `
                <div class="digit-tracker ${isMissing ? 'missing' : ''}" data-digit="${digit}">
                    <div class="digit-value">${digit}</div>
                    <div class="missing-count">${count}</div>
                    <div class="avg-appearance">${avgAppearance ? avgAppearance.toFixed(1) : '-'}</div>
                </div>
            `;
        }).join('');

        // Update average stats
        statsContainer.innerHTML = this.missingDigitsTracker.digitCounts.map((count, digit) => {
            const avgAppearance = this.calculateAverageAppearance(digit);
            return avgAppearance ? `
                <div class="avg-stat-item">
                    <span class="digit-label">${digit}:</span>
                    <span class="avg-value">${avgAppearance.toFixed(1)} ticks</span>
                </div>
            ` : '';
        }).join('');

        // Update alerts
        const missingDigits = this.missingDigitsTracker.digitCounts
            .map((count, digit) => ({ digit, count }))
            .filter(item => item.count >= this.missingDigitsTracker.threshold);

        alertContainer.innerHTML = missingDigits.map(item => `
            <div class="alert-item">
                <div class="alert-digit">${item.digit}</div>
                <div class="alert-count">Missing for ${item.count} ticks</div>
            </div>
        `).join('');
    }

    calculateAverageAppearance(digit) {
        const appearances = this.missingDigitsTracker.averageAppearance[digit];
        return appearances.length > 0 ? 
            appearances.reduce((a, b) => a + b, 0) / appearances.length : 
            null;
    }

    setupEventListeners() {
        // Market buttons
        const marketButtons = document.querySelectorAll('.market-btn');
        marketButtons.forEach(button => {
            button.addEventListener('click', () => {
                marketButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const symbol = button.dataset.symbol;
                this.switchMarket(symbol);
            });
        });

        // Missing ticks threshold listener
        const thresholdSelect = document.getElementById('missingTicksThreshold');
        if (thresholdSelect) {
            thresholdSelect.addEventListener('change', (e) => {
                this.missingDigitsTracker.threshold = parseInt(e.target.value);
                this.updateMissingDigitsDisplay();
            });
        }

        // Sample size listener
        const sampleSizeSelect = document.getElementById('sampleSize');
        if (sampleSizeSelect) {
            sampleSizeSelect.addEventListener('change', (e) => {
                const newSize = parseInt(e.target.value);
                if (this.currentSymbol && this.markets[this.currentSymbol]) {
                    this.markets[this.currentSymbol].digitStats.maxSamples = newSize;
                    this.updateDigitStats(true);
                }
            });
        }

        // Pattern length selector
        const patternSelect = document.getElementById('patternLength');
        if (patternSelect) {
            patternSelect.addEventListener('change', (e) => {
                this.patternLength = parseInt(e.target.value);
                this.updatePatternDisplay();
            });
        }

        // Pair direction selector
        const pairDirectionSelect = document.getElementById('pairDirection');
        if (pairDirectionSelect) {
            pairDirectionSelect.addEventListener('change', (e) => {
                this.pairStats.direction = e.target.value;
                this.updatePairsDisplay();
            });
        }
    }

    switchMarket(symbol) {
        this.currentSymbol = symbol;
        const market = this.markets[symbol];
        
        if (market) {
            // Update displays with current market data
            const lastTick = market.tickHistory[0];
            if (lastTick) {
                this.updateDisplays(
                    lastTick.price,
                    lastTick.change,
                    lastTick.digit,
                    lastTick.time
                );
            } else {
                this.clearDisplays();
            }
        }

        // Reset missing digits tracker
        this.missingDigitsTracker.digitCounts = Array(10).fill(0);
        this.missingDigitsTracker.averageAppearance = Array(10).fill([]).map(() => []);
        this.updateMissingDigitsDisplay();

        // Reset pairs matrix when switching markets
        this.pairStats = {
            matrix: Array(10).fill().map(() => Array(10).fill(0)),
            totalPairs: 0,
            direction: this.pairStats.direction,
            maxCount: 0
        };
    }

    updatePatternDisplay() {
        const market = this.markets[this.currentSymbol];
        if (!market) return;

        const currentPattern = market.lastDigits.slice(0, this.patternLength);
        const patternDisplay = document.querySelector('.current-pattern');
        if (patternDisplay) {
            patternDisplay.innerHTML = `
                <div class="pattern-digits">
                    ${currentPattern.map(d => `<span class="pattern-digit">${d}</span>`).join('')}
                </div>
            `;
        }

        // Update pattern history and predictions
        const patternHistory = document.querySelector('.pattern-history');
        if (patternHistory) {
            // Calculate pattern frequencies
            const patterns = this.findPatterns(market.lastDigits);
            patternHistory.innerHTML = patterns.slice(0, 5).map(p => `
                <div class="pattern-item">
                    <span class="pattern">${p.pattern.join('')}</span>
                    <span class="frequency">${p.frequency}x</span>
                </div>
            `).join('');
        }
    }

    updateStreakDisplay() {
        const market = this.markets[this.currentSymbol];
        if (!market) return;

        // Update current streaks
        let currentDigit = market.lastDigits[0];
        let streakCount = 1;
        for (let i = 1; i < market.lastDigits.length; i++) {
            if (market.lastDigits[i] === currentDigit) {
                streakCount++;
            } else {
                break;
            }
        }

        // Update streak display
        const streakDisplay = document.querySelector('.current-streaks');
        if (streakDisplay) {
            streakDisplay.innerHTML = `
                <div class="current-streak">
                    <span class="streak-digit">${currentDigit}</span>
                    <span class="streak-count">${streakCount}x</span>
                </div>
            `;
        }

        // Update longest streaks
        if (streakCount > this.streakData.longestStreaks[currentDigit]) {
            this.streakData.longestStreaks[currentDigit] = streakCount;
        }

        const longestStreaksDisplay = document.querySelector('.longest-streaks');
        if (longestStreaksDisplay) {
            longestStreaksDisplay.innerHTML = this.streakData.longestStreaks
                .map((count, digit) => `
                    <div class="streak-record">
                        <span class="digit">${digit}</span>
                        <span class="count">${count}x</span>
                    </div>
                `).join('');
        }
    }

    updatePairsDisplay() {
        const market = this.markets[this.currentSymbol];
        if (!market) return;

        // Update pairs matrix based on direction
        if (this.pairStats.direction === 'next') {
            // Look at current digit -> next digit relationships
            for (let i = 0; i < market.lastDigits.length - 1; i++) {
                const currentDigit = market.lastDigits[i];
                const nextDigit = market.lastDigits[i + 1];
                this.pairStats.matrix[currentDigit][nextDigit]++;
                this.pairStats.totalPairs++;
                this.pairStats.maxCount = Math.max(
                    this.pairStats.maxCount, 
                    this.pairStats.matrix[currentDigit][nextDigit]
                );
            }
        } else {
            // Look at current digit -> previous digit relationships
            for (let i = 1; i < market.lastDigits.length; i++) {
                const currentDigit = market.lastDigits[i];
                const prevDigit = market.lastDigits[i - 1];
                this.pairStats.matrix[currentDigit][prevDigit]++;
                this.pairStats.totalPairs++;
                this.pairStats.maxCount = Math.max(
                    this.pairStats.maxCount, 
                    this.pairStats.matrix[currentDigit][prevDigit]
                );
            }
        }

        // Update the matrix display
        const matrix = document.querySelector('.pairs-matrix');
        if (matrix) {
            matrix.innerHTML = `
                <div class="matrix-header">
                    <div class="matrix-corner"></div>
                    ${Array(10).fill().map((_, i) => `
                        <div class="matrix-header-cell">${i}</div>
                    `).join('')}
                </div>
                ${this.pairStats.matrix.map((row, i) => `
                    <div class="matrix-row">
                        <div class="matrix-row-header">${i}</div>
                        ${row.map((count, j) => {
                            const percentage = (count / this.pairStats.totalPairs * 100).toFixed(1);
                            const intensity = Math.floor((count / this.pairStats.maxCount) * 100);
                            return `
                                <div class="matrix-cell" 
                                     style="background: rgba(255, 215, 0, ${intensity/100})"
                                     title="${i} → ${j}: ${count} times (${percentage}%)">
                                    ${count}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `).join('')}
            `;
        }

        // Update most common pairs
        const pairsStats = document.querySelector('.pairs-stats');
        if (pairsStats) {
            const pairs = this.findMostCommonPairs();
            pairsStats.innerHTML = `
                <h4>Most Common Pairs:</h4>
                ${pairs.slice(0, 5).map(p => `
                    <div class="pair-stat">
                        <span class="pair-digits">${p.from} → ${p.to}</span>
                        <span class="pair-count">${p.count}x</span>
                        <span class="pair-percent">(${(p.count / this.pairStats.totalPairs * 100).toFixed(1)}%)</span>
                    </div>
                `).join('')}
            `;
        }
    }

    updateRangeDisplay(currentPrice) {
        if (this.rangeData.high === null || currentPrice > this.rangeData.high) {
            this.rangeData.high = currentPrice;
        }
        if (this.rangeData.low === null || currentPrice < this.rangeData.low) {
            this.rangeData.low = currentPrice;
        }

        const rangeDisplay = document.querySelector('.current-range');
        if (rangeDisplay) {
            rangeDisplay.innerHTML = `
                <div class="range-item">
                    <span class="range-label">High:</span>
                    <span class="range-value">${this.rangeData.high.toFixed(2)}</span>
                </div>
                <div class="range-item">
                    <span class="range-label">Low:</span>
                    <span class="range-value">${this.rangeData.low.toFixed(2)}</span>
                </div>
                <div class="range-item">
                    <span class="range-label">Range:</span>
                    <span class="range-value">${(this.rangeData.high - this.rangeData.low).toFixed(2)}</span>
                </div>
            `;
        }
    }

    // Helper methods
    findPatterns(digits) {
        // Implementation for pattern finding
        // Returns array of {pattern: [], frequency: number}
        return [];
    }

    findMostCommonPairs() {
        const pairs = [];
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 10; j++) {
                pairs.push({
                    from: i,
                    to: j,
                    count: this.pairStats.matrix[i][j]
                });
            }
        }
        return pairs.sort((a, b) => b.count - a.count);
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.volatilityTracker = new VolatilityTracker();
});