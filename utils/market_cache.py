import threading
import websocket
import json
import time
from collections import defaultdict

class MarketCache:
    def __init__(self):
        self.cache = defaultdict(lambda: {
            'ticks': [],
            'last_digits': [],
            'digit_stats': {
                'counts': [0] * 10,
                'total': 0
            },
            'pairs_matrix': [[0] * 10 for _ in range(10)],
            'missing_digits': [0] * 10,
            'last_update': None
        })
        self.max_history = 1000
        self.lock = threading.Lock()
        self.ws = None
        self.symbols = [
            'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
            '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V'
        ]
        self.start_websocket()

    def start_websocket(self):
        def on_message(ws, message):
            data = json.loads(message)
            if 'tick' in data:
                self.update_cache(data['tick'])

        def on_error(ws, error):
            print(f"WebSocket error: {error}")
            time.sleep(5)
            self.start_websocket()

        def on_close(ws, close_status_code, close_msg):
            print("WebSocket connection closed")
            time.sleep(5)
            self.start_websocket()

        def on_open(ws):
            print("WebSocket connection opened")
            for symbol in self.symbols:
                ws.send(json.dumps({
                    "ticks": symbol,
                    "subscribe": 1
                }))

        websocket.enableTrace(True)
        self.ws = websocket.WebSocketApp(
            "wss://ws.binaryws.com/websockets/v3?app_id=1089",
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open
        )
        
        wst = threading.Thread(target=self.ws.run_forever)
        wst.daemon = True
        wst.start()

    def update_cache(self, tick):
        with self.lock:
            symbol = tick['symbol']
            market_data = self.cache[symbol]
            
            # Update ticks
            market_data['ticks'].insert(0, {
                'time': tick['epoch'],
                'price': tick['quote'],
                'digit': int(str(tick['quote'])[-1])
            })
            
            if len(market_data['ticks']) > self.max_history:
                market_data['ticks'].pop()

            # Update last digits
            last_digit = market_data['ticks'][0]['digit']
            market_data['last_digits'].insert(0, last_digit)
            if len(market_data['last_digits']) > 10:
                market_data['last_digits'].pop()

            # Update digit stats
            market_data['digit_stats']['counts'][last_digit] += 1
            market_data['digit_stats']['total'] += 1

            # Update pairs matrix
            if len(market_data['last_digits']) > 1:
                prev_digit = market_data['last_digits'][1]
                market_data['pairs_matrix'][prev_digit][last_digit] += 1

            market_data['last_update'] = time.time()

    def get_market_data(self, symbol):
        with self.lock:
            return dict(self.cache[symbol])

# Initialize the cache as a singleton
market_cache = MarketCache() 