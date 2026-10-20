package com.foodorder.repository;

import com.foodorder.model.Restaurant;
import org.springframework.data.repository.ListCrudRepository;

public interface RestaurantRepository extends ListCrudRepository<Restaurant, String> {
}
