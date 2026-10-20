package com.foodorder;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class FoodOrderApplication {

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(FoodOrderApplication.class);
        boolean mongoOnline = isMongoOnline("localhost", 27017, 700);

        if (mongoOnline) {
            System.out.println("==================================================================");
            System.out.println(" [Plateful] MongoDB connection detected on localhost:27017.");
            System.out.println(" [Plateful] Running with Spring Data MongoDB storage.");
            System.out.println("==================================================================");
            app.setDefaultProperties(Map.of("plateful.storage.mode", "mongo"));
        } else {
            System.out.println("==================================================================");
            System.out.println(" [Plateful] MongoDB server was not detected on localhost:27017.");
            System.out.println(" [Plateful] Auto-switching to FAST IN-MEMORY storage mode.");
            System.out.println(" [Plateful] Zero setup required! Demo data, users, and orders seeded.");
            System.out.println(" [Plateful] (To persist to MongoDB, simply start MongoDB on port 27017)");
            System.out.println("==================================================================");
            app.setDefaultProperties(Map.of(
                "spring.autoconfigure.exclude",
                "org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration," +
                "org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration," +
                "org.springframework.boot.autoconfigure.data.mongo.MongoRepositoriesAutoConfiguration",
                "plateful.storage.mode", "memory"
            ));
        }

        app.run(args);
    }

    private static boolean isMongoOnline(String host, int port, int timeoutMs) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), timeoutMs);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
