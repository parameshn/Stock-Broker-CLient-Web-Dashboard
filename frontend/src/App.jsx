import React, { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown, Minus, LogOut, DollarSign } from "lucide-react";
import "./App.css";

const STOCKS = ["GOOG", "TSLA", "AMZN", "META", "NVDA"];
const WS_URL = "ws://localhost:8383/ws";

export default function App() {
    const [email, setEmail] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [subscribedStocks, setSubscribedStocks] = useState(new Set());
    const [stockPrices, setStockPrices] = useState({});
    const [priceHistory, setPriceHistory] = useState({});
    const [connectionStatus, setConnectionStatus] = useState("disconnected");
    const [error, setError] = useState("");
    const wsRef = useRef(null);

    // connect WS after login
    useEffect(() => {
        if (!isLoggedIn) return;

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => setConnectionStatus("connected");
        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === "PRICE_UPDATE") {
                    const { stock, price } = msg;
                    setStockPrices(prev => ({ ...prev, [stock]: Number(price) }));
                    setPriceHistory(prev => {
                        const arr = [...(prev[stock] || []), Number(price)].slice(-60);
                        return { ...prev, [stock]: arr };
                    });
                } else if (msg.type === "ERROR") {
                    setError(msg.message);
                    // rollback optimistic UI on specific errors
                    if (msg.message.startsWith("Unsupported stock: ")) {
                        const stock = msg.message.substring("Unsupported stock: ".length);
                        setSubscribedStocks(prev => {
                            const n = new Set(prev);
                            n.delete(stock);
                            return n;
                        });
                    } else if (msg.message.startsWith("Not subscribed to: ")) {
                        const stock = msg.message.substring("Not subscribed to: ".length);
                        setSubscribedStocks(prev => new Set([...prev, stock]));
                    }
                }
                // ignore SUBSCRIBED/UNSUBSCRIBED for now (optimistic handles it)
            } catch (err) {
                console.error("WS parse error:", err);
            }
        };
        ws.onerror = () => {
            setConnectionStatus("error");
            setError("WebSocket connection error");
        };
        ws.onclose = () => setConnectionStatus("disconnected");

        return () => {
            try { ws.close(); } catch (e) { }
        };
    }, [isLoggedIn]);

    const handleLogin = () => {
        if (!email) { setError("Please enter an email"); return; }
        setError("");
        setIsLoggedIn(true);
    };

    const handleLogout = () => {
        if (wsRef.current) wsRef.current.close();
        setIsLoggedIn(false);
        setSubscribedStocks(new Set());
        setStockPrices({});
        setPriceHistory({});
        setEmail("");
        setError("");
        setConnectionStatus("disconnected");
    };

    const sendSubscribeMessage = (stock) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            setError("WebSocket not connected");
            return;
        }
        const json = JSON.stringify({ type: "SUBSCRIBE", stock });
        ws.send(json);
    };

    const sendUnsubscribeMessage = (stock) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            setError("WebSocket not connected");
            return;
        }
        const json = JSON.stringify({ type: "UNSUBSCRIBE", stock });
        ws.send(json);
    };

    const handleToggle = (stock) => {
        if (subscribedStocks.has(stock)) {
            // unsubscribe (optimistic)
            sendUnsubscribeMessage(stock);
            setSubscribedStocks(prev => {
                const n = new Set(prev);
                n.delete(stock);
                return n;
            });
        } else {
            // subscribe (optimistic)
            sendSubscribeMessage(stock);
            setSubscribedStocks(prev => new Set([...prev, stock]));
        }
    };

    const getPriceChange = (stock) => {
        const hist = priceHistory[stock] || [];
        if (hist.length < 2) return { change: 0, percent: 0 };
        const cur = hist[hist.length - 1];
        const prev = hist[hist.length - 2] || cur;
        const change = cur - prev;
        const percent = prev === 0 ? 0 : (change / prev) * 100;
        return { change, percent };
    };

    const getTrendIcon = (stock) => {
        const { change } = getPriceChange(stock);
        if (change > 0) return <TrendingUp className="w-5 h-5" style={{ color: "#16a34a" }} />;
        if (change < 0) return <TrendingDown className="w-5 h-5" style={{ color: "#dc2626" }} />;
        return <Minus className="w-5 h-5" style={{ color: "#9ca3af" }} />;
    };

    if (!isLoggedIn) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#eff6ff,#eef2ff)" }}>
                <div style={{ width: 420 }}>
                    <div className="card">
                        <div style={{ textAlign: "center", marginBottom: 8 }}>
                            <DollarSign size={36} color="#6366f1" />
                        </div>
                        <h2 style={{ textAlign: "center", margin: 0, marginBottom: 6 }}>Stock Broker</h2>
                        <p style={{ textAlign: "center", marginTop: 0, color: "#6b7280" }}>Client Web Dashboard — port 8383</p>

                        <div style={{ marginTop: 12 }}>
                            <label style={{ display: "block", marginBottom: 6, color: "#374151" }}>Email</label>
                            <input
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e6e9ef" }}
                                onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                            />
                        </div>

                        {error && <div style={{ marginTop: 12, padding: 10, background: "#fff1f2", color: "#9f1239", borderRadius: 8 }}>{error}</div>}

                        <button onClick={handleLogin} style={{ marginTop: 12, width: "100%", padding: 12, background: "#6366f1", color: "white", border: "none", borderRadius: 10, cursor: "pointer" }}>
                            Sign in (email only)
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 24 }}>
            <div className="container">
                <div className="card header">
                    <div>
                        <h1 style={{ margin: 0 }}>Stock Broker Dashboard</h1>
                        <div style={{ color: "#6b7280" }}>{email}</div>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 50, background: connectionStatus === "connected" ? "#16a34a" : connectionStatus === "error" ? "#dc2626" : "#9ca3af" }} />
                            <div style={{ color: "#6b7280", textTransform: "capitalize" }}>{connectionStatus}</div>
                        </div>

                        <button onClick={handleLogout} style={{ padding: 8, background: "#ef4444", color: "white", borderRadius: 8, border: "none", display: "flex", alignItems: "center", gap: 8 }}>
                            <LogOut size={16} /> Logout
                        </button>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Supported Stocks</h3>
                    <p style={{ color: "#6b7280" }}>Click to subscribe. Prices update live without refresh.</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        {STOCKS.map(s => (
                            <button key={s}
                                onClick={() => handleToggle(s)}
                                className={`stock-btn ${subscribedStocks.has(s) ? "sub" : ""}`}
                                style={{ border: "none" }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <h3 style={{ margin: 0 }}>Subscribed Stocks</h3>
                        <div style={{ color: "#6b7280" }}>Real-time simulated prices</div>
                    </div>

                    {subscribedStocks.size === 0 ? (
                        <div style={{ padding: 36, textAlign: "center", color: "#9ca3af" }}>
                            Subscribe to stocks above to see live prices.
                        </div>
                    ) : (
                        <div className="grid">
                            {Array.from(subscribedStocks).map(stock => {
                                const price = stockPrices[stock];
                                const hist = priceHistory[stock] || [];
                                const { change, percent } = getPriceChange(stock);

                                const min = hist.length ? Math.min(...hist) : 0;
                                const max = hist.length ? Math.max(...hist) : 1;
                                const range = Math.max(1, max - min);

                                return (
                                    <div key={stock} className="card">
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <h4 style={{ margin: 0 }}>{stock}</h4>
                                                <div style={{ color: "#6b7280" }}>Live</div>
                                            </div>
                                            {getTrendIcon(stock)}
                                        </div>

                                        <div style={{ marginTop: 12 }}>
                                            <div style={{ fontSize: 26, fontWeight: 700 }}>
                                                ${price ? price.toFixed(2) : "---"}
                                            </div>
                                            <div style={{ marginTop: 6, color: change > 0 ? "#16a34a" : change < 0 ? "#dc2626" : "#6b7280" }}>
                                                {change > 0 ? "+" : ""}{change.toFixed(2)} ({percent > 0 ? "+" : ""}{percent.toFixed(2)}%)
                                            </div>

                                            <div className="spark" style={{ marginTop: 12 }}>
                                                {(hist.slice(-20).length ? hist.slice(-20) : []).map((p, i, arr) => {
                                                    const hmin = Math.min(...arr);
                                                    const hmax = Math.max(...arr);
                                                    const hrange = Math.max(1, hmax - hmin);
                                                    const h = ((p - hmin) / hrange) * 100;
                                                    const last = i === arr.length - 1;
                                                    const bg = last ? (change > 0 ? "#16a34a" : change < 0 ? "#dc2626" : "#94a3b8") : "#6366f1";
                                                    return <div key={i} style={{ height: `${Math.max(h, 6)}%`, background: bg }} />;
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div style={{ textAlign: "center", marginTop: 8, color: "#6b7280" }}>
                    Prices are simulated and update every second (no refresh). Multiple users can open this page and subscribe independently.
                </div>
            </div>
        </div>
    );
}