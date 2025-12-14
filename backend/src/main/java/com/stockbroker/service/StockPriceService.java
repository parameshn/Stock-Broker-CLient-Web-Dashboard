package com.stockbroker.service;

import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class StockPriceService {

    private final Map<String, Sinks.Many<String>> sinks = new ConcurrentHashMap<>();
    private final Map<String, List<String>> history = new ConcurrentHashMap<>();

    public static final List<String> STOCKS = List.of("GOOG", "TSLA", "AMZN", "META", "NVDA");

    public StockPriceService() {
        STOCKS.forEach(stock -> {
            Sinks.Many<String> sink = Sinks.many().multicast().onBackpressureBuffer();
            sinks.put(stock, sink);
            history.put(stock, new ArrayList<>());

            Flux.interval(Duration.ofSeconds(1))
                    .map(i -> 100 + Math.random() * 200) // simulated price
                    .map(p -> buildJson(stock, p))
                    .doOnNext(p -> {
                        List<String> h = history.get(stock);
                        h.add(p);
                        if (h.size() > 10)
                            h.remove(0);
                    })
                    .subscribe(sink::tryEmitNext);
        });
    }

    public Flux<String> prices(String stock) {
        Sinks.Many<String> sink = sinks.get(stock);
        if (sink == null)
            return Flux.empty();
        return Flux.fromIterable(history.getOrDefault(stock, List.of()))
                .concatWith(sink.asFlux());
    }

    private String buildJson(String stock, double price) {
        return "{"
                + "\"type\":\"PRICE_UPDATE\","
                + "\"stock\":\"" + stock + "\","
                + "\"price\":" + String.format("%.2f", price)
                + "}";
    }
}