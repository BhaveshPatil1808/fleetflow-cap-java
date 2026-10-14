package customer.fleetflow;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class GeographicalDistanceService {

    private static final double EARTH_RADIUS_KM = 6371.0088;

    private static final String GEOCODING_URL =
            "https://nominatim.openstreetmap.org/search";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    private final Map<String, Coordinates> cache =
            new ConcurrentHashMap<>();

    private long lastRequestTime = 0;

    public GeographicalDistanceService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        this.objectMapper = new ObjectMapper();
    }

    public Coordinates geocode(String location) {

        if (location == null || location.isBlank()) {
            throw new IllegalArgumentException(
                    "Start location and destination are required."
            );
        }

        String searchText = location.trim();
        String cacheKey = searchText.toLowerCase();

        Coordinates cached = cache.get(cacheKey);

        if (cached != null) {
            return cached;
        }

        try {
            /*
             * Nominatim public service:
             * keep requests below its published rate limit.
             */
            synchronized (this) {
                long elapsed =
                        System.currentTimeMillis() - lastRequestTime;

                if (elapsed < 1100) {
                    Thread.sleep(1100 - elapsed);
                }

                String encodedLocation = URLEncoder.encode(
                        searchText,
                        StandardCharsets.UTF_8
                );

                String url = GEOCODING_URL
                        + "?format=jsonv2&limit=1&q="
                        + encodedLocation;

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(15))
                        .header(
                                "User-Agent",
                                "FleetFlowLearningApp/1.0"
                        )
                        .header(
                                "Accept",
                                "application/json"
                        )
                        .GET()
                        .build();

                lastRequestTime = System.currentTimeMillis();

                HttpResponse<String> response =
                        httpClient.send(
                                request,
                                HttpResponse.BodyHandlers.ofString()
                        );

                if (response.statusCode() != 200) {
                    throw new IllegalStateException(
                            "Location lookup failed. HTTP status: "
                                    + response.statusCode()
                    );
                }

                JsonNode results =
                        objectMapper.readTree(response.body());

                if (!results.isArray() || results.isEmpty()) {
                    throw new IllegalArgumentException(
                            "Location not found: " + searchText
                    );
                }

                JsonNode firstResult = results.get(0);

                double latitude =
                        firstResult.get("lat").asDouble();

                double longitude =
                        firstResult.get("lon").asDouble();

                Coordinates coordinates =
                        new Coordinates(latitude, longitude);

                cache.put(cacheKey, coordinates);

                return coordinates;
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();

            throw new IllegalStateException(
                    "Location lookup was interrupted.", e
            );

        } catch (Exception e) {
            if (e instanceof IllegalArgumentException
                    || e instanceof IllegalStateException) {
                throw (RuntimeException) e;
            }

            throw new IllegalStateException(
                    "Unable to look up location: " + searchText,
                    e
            );
        }
    }

    public double calculateDistanceKm(
            double startLatitude,
            double startLongitude,
            double endLatitude,
            double endLongitude) {

        validateCoordinates(startLatitude, startLongitude);
        validateCoordinates(endLatitude, endLongitude);

        double lat1 = Math.toRadians(startLatitude);
        double lon1 = Math.toRadians(startLongitude);

        double lat2 = Math.toRadians(endLatitude);
        double lon2 = Math.toRadians(endLongitude);

        double deltaLatitude = lat2 - lat1;
        double deltaLongitude = lon2 - lon1;

        double a =
                Math.pow(Math.sin(deltaLatitude / 2), 2)
                + Math.cos(lat1)
                * Math.cos(lat2)
                * Math.pow(Math.sin(deltaLongitude / 2), 2);

        // Protect against floating-point rounding outside [0, 1].
        a = Math.max(0.0, Math.min(1.0, a));

        double c = 2 * Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
        );

        return EARTH_RADIUS_KM * c;
    }

    public BigDecimal calculatePrice(
            double distanceKm,
            BigDecimal ratePerKm) {

        if (ratePerKm == null
                || ratePerKm.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(
                    "Rate per kilometre cannot be negative."
            );
        }

        return BigDecimal.valueOf(distanceKm)
                .multiply(ratePerKm)
                .setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private void validateCoordinates(
            double latitude,
            double longitude) {

        if (!Double.isFinite(latitude)
                || latitude < -90
                || latitude > 90) {
            throw new IllegalArgumentException(
                    "Latitude must be between -90 and 90."
            );
        }

        if (!Double.isFinite(longitude)
                || longitude < -180
                || longitude > 180) {
            throw new IllegalArgumentException(
                    "Longitude must be between -180 and 180."
            );
        }
    }

    public record Coordinates(
            double latitude,
            double longitude) {
    }
}