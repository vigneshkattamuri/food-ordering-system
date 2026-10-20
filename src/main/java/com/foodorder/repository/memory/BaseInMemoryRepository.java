package com.foodorder.repository.memory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.function.Function;
import org.springframework.data.repository.ListCrudRepository;

public class BaseInMemoryRepository<T> implements ListCrudRepository<T, String> {
    protected final Map<String, T> map = new ConcurrentHashMap<>();
    private final Function<T, String> idGetter;
    private final Consumer<T> idSetter;

    public BaseInMemoryRepository(Function<T, String> idGetter, Consumer<T> idSetter) {
        this.idGetter = idGetter;
        this.idSetter = idSetter;
    }

    @Override
    public <S extends T> S save(S entity) {
        if (entity == null) return null;
        String id = idGetter.apply(entity);
        if (id == null || id.isBlank()) {
            id = UUID.randomUUID().toString().replace("-", "");
            idSetter.accept(entity);
        }
        map.put(id, entity);
        return entity;
    }

    @Override
    public <S extends T> List<S> saveAll(Iterable<S> entities) {
        List<S> list = new ArrayList<>();
        if (entities != null) {
            for (S e : entities) {
                list.add(save(e));
            }
        }
        return list;
    }

    @Override
    public Optional<T> findById(String id) {
        if (id == null) return Optional.empty();
        return Optional.ofNullable(map.get(id));
    }

    @Override
    public boolean existsById(String id) {
        return id != null && map.containsKey(id);
    }

    @Override
    public List<T> findAll() {
        return new ArrayList<>(map.values());
    }

    @Override
    public List<T> findAllById(Iterable<String> ids) {
        List<T> list = new ArrayList<>();
        if (ids != null) {
            for (String id : ids) {
                findById(id).ifPresent(list::add);
            }
        }
        return list;
    }

    @Override
    public long count() {
        return map.size();
    }

    @Override
    public void deleteById(String id) {
        if (id != null) map.remove(id);
    }

    @Override
    public void delete(T entity) {
        if (entity != null) {
            String id = idGetter.apply(entity);
            if (id != null) map.remove(id);
        }
    }

    @Override
    public void deleteAllById(Iterable<? extends String> ids) {
        if (ids != null) {
            for (String id : ids) deleteById(id);
        }
    }

    @Override
    public void deleteAll(Iterable<? extends T> entities) {
        if (entities != null) {
            for (T e : entities) delete(e);
        }
    }

    @Override
    public void deleteAll() {
        map.clear();
    }
}
