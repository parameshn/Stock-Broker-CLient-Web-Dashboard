package com.stockbroker.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stockbroker.model.ClientMessage;
import com.stockbroker.service.StockPriceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.Disposable;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class StockWebSocketHandler implements WebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(StockWebSocketHandler.class);

    private final StockPriceService priceService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public StockWebSocketHandler(StockPriceService priceService) {
        this.priceService = priceService;
    }

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        // outgoing sink for this session
        Sinks.Many<String> outgoing = Sinks.many().unicast().onBackpressureBuffer();
        Map<String, Disposable> subs = new ConcurrentHashMap<>();

        // process incoming messages (subscribe/unsubscribe). Accept JSON or plain text.
        Mono<Void> inbound = session.receive()
                .map(WebSocketMessage::getPayloadAsText)
                .doOnNext(rawPayload -> {
                    String payload = rawPayload.trim();
                    String type = null;
                    String stock = null;
                    try {
                        if (payload.startsWith("{")) {
                            // JSON parse with Jackson
                            ClientMessage cm = objectMapper.readValue(payload, ClientMessage.class);
                            type = cm.type();
                            stock = cm.stock();
                        } else if (payload.startsWith("SUBSCRIBE:") || payload.startsWith("UNSUBSCRIBE:")) {
                            // plain text fallback
                            if (payload.startsWith("SUBSCRIBE:")) {
                                type = "SUBSCRIBE";
                                stock = payload.substring("SUBSCRIBE:".length()).trim();
                            } else {
                                type = "UNSUBSCRIBE";
                                stock = payload.substring("UNSUBSCRIBE:".length()).trim();
                            }
                        }

                        if (type != null && stock != null) {
                            stock = stock.toUpperCase();

                            if ("SUBSCRIBE".equalsIgnoreCase(type)) {
                                if (StockPriceService.STOCKS.contains(stock)) {
                                    if (!subs.containsKey(stock)) {
                                        Disposable d = priceService.prices(stock)
                                                .doOnNext(outgoing::tryEmitNext)
                                                .subscribe();
                                        subs.put(stock, d);
                                    }
                                    log.info("User SUBSCRIBED to {}", stock);
                                    outgoing.tryEmitNext("{\"type\":\"SUBSCRIBED\",\"stock\":\"" + stock + "\"}");
                                } else {
                                    log.warn("Attempt to subscribe to unsupported stock: {}", stock);
                                    outgoing.tryEmitNext(
                                            "{\"type\":\"ERROR\",\"message\":\"Unsupported stock: " + stock + "\"}");
                                }
                            } else if ("UNSUBSCRIBE".equalsIgnoreCase(type)) {
                                Disposable d = subs.remove(stock);
                                if (d != null) {
                                    d.dispose();
                                    log.info("User UNSUBSCRIBED from {}", stock);
                                    outgoing.tryEmitNext("{\"type\":\"UNSUBSCRIBED\",\"stock\":\"" + stock + "\"}");
                                } else {
                                    log.warn("Attempt to unsubscribe from non-subscribed stock: {}", stock);
                                    outgoing.tryEmitNext(
                                            "{\"type\":\"ERROR\",\"message\":\"Not subscribed to: " + stock + "\"}");
                                }
                            }
                        }
                    } catch (Exception ex) {
                        log.error("Invalid message received: {}", payload, ex);
                        outgoing.tryEmitNext("{\"type\":\"ERROR\",\"message\":\"Invalid message format\"}");
                    }
                })
                .then()
                .doFinally(signal -> {
                    subs.values().forEach(Disposable::dispose);
                    log.info("WebSocket session closed. Cleaned up {} subscriptions.", subs.size());
                });

        // send outgoing flux to client
        Mono<Void> outbound = session.send(outgoing.asFlux().map(session::textMessage))
                .doFinally(signal -> {
                    subs.values().forEach(Disposable::dispose);
                });

        // run both inbound and outbound
        return Mono.when(inbound, outbound);
    }
}