package com.foodorder.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "restaurants")
public class Restaurant {
    @Id
    private String id;
    private String name;
    private String cuisine;
    private String address;
    private double rating = 4.5;
    private String deliveryTime = "25-35 min";
    private double deliveryFee = 2.49;
    private double minOrder = 10.00;
    private String imageUrl;
    private String ownerId; // user ID with RESTAURANT_OWNER role
    private String ownerEmail;
    private String category = "All";
    private boolean open = true;
    private boolean featured = false;

    public Restaurant() {}

    public Restaurant(String name, String cuisine, String address, double rating) {
        this.name = name;
        this.cuisine = cuisine;
        this.address = address;
        this.rating = rating;
    }

    public Restaurant(String name, String cuisine, String address, double rating,
                      String deliveryTime, double deliveryFee, String imageUrl, String category) {
        this.name = name;
        this.cuisine = cuisine;
        this.address = address;
        this.rating = rating;
        this.deliveryTime = deliveryTime;
        this.deliveryFee = deliveryFee;
        this.imageUrl = imageUrl;
        this.category = category;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCuisine() { return cuisine; }
    public void setCuisine(String cuisine) { this.cuisine = cuisine; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }
    public String getDeliveryTime() { return deliveryTime; }
    public void setDeliveryTime(String deliveryTime) { this.deliveryTime = deliveryTime; }
    public double getDeliveryFee() { return deliveryFee; }
    public void setDeliveryFee(double deliveryFee) { this.deliveryFee = deliveryFee; }
    public double getMinOrder() { return minOrder; }
    public void setMinOrder(double minOrder) { this.minOrder = minOrder; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }
    public String getOwnerEmail() { return ownerEmail; }
    public void setOwnerEmail(String ownerEmail) { this.ownerEmail = ownerEmail; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public boolean isOpen() { return open; }
    public void setOpen(boolean open) { this.open = open; }
    public boolean isFeatured() { return featured; }
    public void setFeatured(boolean featured) { this.featured = featured; }
}
