# Stock Broker Client Web Dashboard

A real-time stock price monitoring dashboard built with Spring Boot WebFlux and React. Users can subscribe to multiple stocks and receive live price updates via WebSocket connections without page refreshes.

## Demo Video

> **📹 50-second walkthrough showing login, real-time subscriptions, live price updates, and multi-user support**

https://github.com/user-attachments/assets/730bef31-9696-4417-a687-e5ecbae0c0d9

## Features

### Core Functionality
- **Email-based Login**: Simple authentication using email (no password required for demo purposes)
- **Real-time Stock Subscriptions**: Subscribe/unsubscribe to 5 supported stocks (GOOG, TSLA, AMZN, META, NVDA)
- **Live Price Updates**: Prices update every second via WebSocket without page refresh
- **Multi-user Support**: Multiple users can connect simultaneously with independent subscriptions
- **Price History Tracking**: Visual sparkline charts showing the last 20 price points
- **Trend Indicators**: Real-time price change indicators with percentage calculations
- **Connection Status**: Live connection status indicator (Connected/Disconnected/Error)

### User Interface
- Clean, modern dashboard with card-based layout
- Color-coded trend indicators (green for up, red for down)
- Responsive grid layout for stock cards
- Mini sparkline charts for price visualization
- Real-time price change calculations
- Optimistic UI updates for instant feedback

## Architecture

### Backend (Spring Boot + WebFlux)

#### Technology Stack
- **Spring Boot 3.2.0** with **WebFlux** for reactive programming
- **Java 17**
- **WebSocket** for real-time bidirectional communication
- **Project Reactor** for reactive streams

#### Key Components

**1. StockPriceService**
- Manages price generation for all stocks using `Flux.interval()`
- Uses `Sinks.Many` for multicasting prices to multiple subscribers
- Maintains last 10 price points per stock for historical replay
- Simulates realistic price movements (100-300 range with random fluctuations)

**2. StockWebSocketHandler**
- Handles WebSocket connections and message routing
- Accepts both JSON and plain text message formats for flexibility
- Manages per-session subscriptions using `ConcurrentHashMap`
- Implements proper cleanup on connection close
- Provides error handling with descriptive messages

## WebSocket Protocol

### Connection
```
ws://localhost:8383/ws
```

### Message Format

All messages are JSON strings sent over the WebSocket connection.

#### Client → Server Messages

**Subscribe to a stock:**
```json
{
  "type": "SUBSCRIBE",
  "stock": "GOOG"
}
```

**Unsubscribe from a stock:**
```json
{
  "type": "UNSUBSCRIBE",
  "stock": "TSLA"
}
```

**Alternative plain text format (also supported):**
```
SUBSCRIBE:GOOG
UNSUBSCRIBE:TSLA
```

#### Server → Client Messages

**Price update (sent every second for subscribed stocks):**
```json
{
  "type": "PRICE_UPDATE",
  "stock": "GOOG",
  "price": 142.50
}
```

**Subscription confirmation:**
```json
{
  "type": "SUBSCRIBED",
  "stock": "GOOG"
}
```

**Unsubscription confirmation:**
```json
{
  "type": "UNSUBSCRIBED",
  "stock": "TSLA"
}
```

**Error message:**
```json
{
  "type": "ERROR",
  "message": "Unsupported stock: AAPL"
}
```

### Supported Stocks
- `GOOG` - Google
- `TSLA` - Tesla
- `AMZN` - Amazon
- `META` - Meta
- `NVDA` - NVIDIA

### Example WebSocket Session

```javascript
// Connect
const ws = new WebSocket('ws://localhost:8383/ws');

// Subscribe to Google stock
ws.send(JSON.stringify({ type: 'SUBSCRIBE', stock: 'GOOG' }));

// Receive confirmation
// {"type":"SUBSCRIBED","stock":"GOOG"}

// Receive price updates every second
// {"type":"PRICE_UPDATE","stock":"GOOG","price":142.50}
// {"type":"PRICE_UPDATE","stock":"GOOG","price":143.25}
// ...

// Unsubscribe
ws.send(JSON.stringify({ type: 'UNSUBSCRIBE', stock: 'GOOG' }));

// Receive confirmation
// {"type":"UNSUBSCRIBED","stock":"GOOG"}

// Close connection
ws.close();
```

#### Architecture Decisions

**Why Reactive (WebFlux)?**
- Perfect for real-time streaming data
- Non-blocking I/O handles many concurrent WebSocket connections efficiently
- `Flux` and `Sinks` provide natural abstractions for price streams
- Better resource utilization compared to traditional blocking approaches

**Why WebSocket?**
- Bidirectional communication for subscribe/unsubscribe operations
- Low latency for real-time price updates
- Persistent connection avoids polling overhead
- Native browser support

**Price Generation Strategy**
- Pre-starts price streams for all stocks on service initialization
- Uses `Flux.interval()` for consistent 1-second updates
- Historical replay ensures new subscribers see recent prices immediately
- Multicast sink allows multiple subscribers per stock without duplicate streams

### Frontend (React + Vite)

#### Technology Stack
- **React 18** with functional components and hooks
- **Vite** for fast development and optimized builds
- **Lucide React** for icons
- **Native WebSocket API** for server communication

#### Key Components

**State Management**
- `useState` for all application state (login, subscriptions, prices)
- `useRef` for WebSocket instance management
- `useEffect` for WebSocket lifecycle management

**Optimistic UI Updates**
- Subscribe/unsubscribe actions update UI immediately
- Server errors trigger rollback to previous state
- Provides instant feedback for better user experience

**Price Visualization**
- Real-time price change calculation (absolute and percentage)
- Trend icons (up/down/neutral) based on last price movement
- Sparkline charts using last 20 price points
- Color-coded bars with highlighted most recent value

#### Architecture Decisions

**Why React?**
- Component-based architecture fits card-based UI naturally
- Hooks provide clean state management for real-time data
- Virtual DOM handles frequent price updates efficiently

**Why Optimistic Updates?**
- Immediate feedback improves perceived performance
- Server validation still occurs in background
- Rollback mechanism handles edge cases gracefully

**Connection Management**
- WebSocket lifecycle tied to login state via `useEffect`
- Automatic cleanup on logout prevents memory leaks
- Connection status indicator keeps users informed

## Project Structure

```
stock-broker/
├── backend/
│   ├── pom.xml
│   └── src/main/java/com/stockbroker/
│       ├── StockBrokerApplication.java
│       ├── config/WebSocketConfig.java
│       ├── handler/StockWebSocketHandler.java
│       ├── model/ClientMessage.java
│       └── service/StockPriceService.java
│
└── frontend/
    ├── package.json
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── App.css
```

## Setup & Running

### Backend
```bash
cd backend
mvn clean install
mvn spring-boot:run
```
Server runs on `http://localhost:8383`

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173` (default Vite port)

### WebSocket Endpoint
```
ws://localhost:8383/ws
```

## Usage

1. **Login**: Enter any email address (no validation, demo only)
2. **Subscribe**: Click stock buttons to subscribe (button turns blue)
3. **Monitor**: Watch prices update every second with trend indicators
4. **Unsubscribe**: Click subscribed stocks again to remove them
5. **Multi-user**: Open multiple browser windows/tabs to simulate different users

## Technical Highlights

### Reactive Backpressure Handling
- `onBackpressureBuffer()` prevents message loss during slow clients
- Proper disposal of subscriptions prevents memory leaks
- Graceful cleanup on WebSocket close

### Error Handling
- Client-side WebSocket error recovery with status indicators
- Server-side validation with descriptive error messages
- Optimistic rollback on subscription failures

### Performance Optimizations
- Price history limited to last 60 points to prevent unbounded growth
- Sparklines show only last 20 points for clean visualization
- Efficient React re-renders using proper state updates

### Scalability Considerations
- Each WebSocket session maintains independent subscriptions
- Multicast sinks share price streams across subscribers
- No database required (in-memory state only)
- Stateless server design (apart from active WebSocket connections)

## Limitations & Future Enhancements

**Current Limitations**
- No authentication/authorization (email only)
- Simulated prices (not real market data)
- No persistence (state lost on server restart)
- No user session management

**Potential Enhancements**
- Integration with real stock price APIs
- User authentication with JWT tokens
- Price history persistence (database or time-series DB)
- Trading functionality (buy/sell orders)
- Portfolio tracking
- Price alerts and notifications
- Historical charts with more data points
- Mobile responsive improvements

## License

MIT License - Free to use and modify

---

**Note**: This is a demonstration project showcasing real-time WebSocket communication with reactive streams. Not intended for production use with real financial data.
