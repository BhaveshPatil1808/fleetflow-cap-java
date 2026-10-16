
package customer.fleetflow;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sap.cds.Row;
import com.sap.cds.Result;
import com.sap.cds.ql.Select;
import com.sap.cds.services.persistence.PersistenceService;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/fleet-ai")
public class FleetAnalyticsAIController {

    private final PersistenceService db;
    private final ObjectMapper mapper;
    private final BCryptPasswordEncoder encoder =
            new BCryptPasswordEncoder();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${GROQ_API_KEY:}")
    private String groqApiKey;

    public FleetAnalyticsAIController(PersistenceService db) {
        this.db = db;
        this.mapper = new ObjectMapper();
    }

    @PostMapping("/ask")
    public Map<String, String> ask(
            @RequestBody Map<String, Object> requestBody,
            HttpServletRequest request) {

        // Preserve existing administrator verification.
        verifyAdmin(request);

        String question = String.valueOf(
                requestBody.getOrDefault("question", "")).trim();

        if (question.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Please enter a question about your fleet.");
        }

        if (question.length() > 2000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Question is too long. Maximum 2000 characters.");
        }

        if (groqApiKey == null || groqApiKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Groq API key is not configured.");
        }

        try {
            // All statistics are calculated from backend database records.
            Map<String, Object> stats = loadFleetStatistics();
            String statsJson = mapper.writeValueAsString(stats);
            System.out.println("FleetFlow AI statistics: " + statsJson);

            
String prompt =
        "You are FleetFlow's professional fleet analytics assistant.\n"
        + "Answer the administrator's question using the backend statistics below.\n"
        + "The statistics are already retrieved from the database. They are the source of truth.\n"
        + "Never claim that no data was provided when the statistics object contains values.\n"
        + "Never invent numbers. If a metric is null, say that the metric is unavailable.\n"
        + "Use the exact supplied values; do not recalculate totals unless necessary.\n"
        + "Format the response in clean Markdown with a bold heading, facts, "
        
+ "All monetary amounts are in INR (Indian Rupees), never USD or dollars. "
+ "Display currency using the ₹ symbol. "
+ "Do not infer consistent pricing, profitability, or driver performance "
+ "unless the supplied statistics directly support the conclusion. "
+ "Do not recommend assigning vehicles to rejected trips unless those trips "
+ "are approved again. "
+ "Use the term 'trip charges' rather than 'revenue' unless revenue is "
+ "explicitly established by the supplied data. "
        + "and actionable recommendations supported by the data.\n\n"
        + "Backend fleet statistics (JSON):\n"
        + statsJson
        + "\n\nAdministrator's question:\n"
        + question;
            Map<String, Object> payload = Map.of(
                    "model", "openai/gpt-oss-120b",
                    "messages", List.of(
                            Map.of(
                                    "role", "user",
                                    "content", prompt)),
                    "temperature", 0.9,
                    "max_tokens", 1000);

            String json = mapper.writeValueAsString(payload);

            HttpRequest groqRequest = HttpRequest.newBuilder()
                    .uri(URI.create(
                            "https://api.groq.com/openai/v1/chat/completions"))
                    .timeout(Duration.ofSeconds(45))
                    .header("Authorization", "Bearer " + groqApiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    groqRequest,
                    HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200
                    || response.statusCode() >= 300) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "Groq could not process the question. Please try again.");
            }

            JsonNode result = mapper.readTree(response.body());

            String answer = result.path("choices")
                    .path(0)
                    .path("message")
                    .path("content")
                    .asText("")
                    .trim();

            if (answer.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "Groq returned an empty answer.");
            }

            return Map.of("answer", answer);

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve fleet data or contact the AI service. "
                    + "Please try again.");
        }
    }

    private Map<String, Object> loadFleetStatistics() {
        Result tripResult = db.run(
                Select.from("fleetflow.Trips"));

        Result vehicleResult = db.run(
                Select.from("fleetflow.Vehicles"));

        Result driverResult = db.run(
                Select.from("fleetflow.Drivers"));

        long totalTrips = 0;
        long completedTrips = 0;
        long pendingTrips = 0;
        long rejectedTrips = 0;
        long otherTripStatuses = 0;

        double completedDistanceKm = 0;
        long tripsWithRecordedDistance = 0;

        double completedCharges = 0;
        long tripsWithRecordedCharges = 0;

        for (Row trip : tripResult) {
            totalTrips++;

            String status = stringValue(trip.get("status"))
                    .toUpperCase(Locale.ROOT);

            if ("COMPLETED".equals(status)) {
                completedTrips++;

                Number distance = numberValue(trip.get("actualDistance"));
                if (distance != null) {
                    completedDistanceKm += distance.doubleValue();
                    tripsWithRecordedDistance++;
                }

                Number charge = numberValue(trip.get("finalPrice"));
                if (charge != null) {
                    completedCharges += charge.doubleValue();
                    tripsWithRecordedCharges++;
                }

            } else if ("PENDING".equals(status)
                    || "PENDING_CONFIRMATION".equals(status)) {
                pendingTrips++;

            } else if ("REJECTED".equals(status)) {
                rejectedTrips++;

            } else {
                otherTripStatuses++;
            }
        }

        long totalVehicles = 0;
        long availableVehicles = 0;
        long otherVehicleStatuses = 0;

        for (Row vehicle : vehicleResult) {
            totalVehicles++;

            String status = stringValue(vehicle.get("status"))
                    .toUpperCase(Locale.ROOT);

            if ("AVAILABLE".equals(status)) {
                availableVehicles++;
            } else {
                otherVehicleStatuses++;
            }
        }

        long totalDrivers = 0;
        long activeDrivers = 0;
        long availableDrivers = 0;
        long otherAvailabilityStatuses = 0;

        for (Row driver : driverResult) {
            totalDrivers++;

            String status = stringValue(driver.get("status"))
                    .toUpperCase(Locale.ROOT);

            String availability = stringValue(
                    driver.get("availabilityStatus"))
                    .toUpperCase(Locale.ROOT);

            if ("ACTIVE".equals(status)) {
                activeDrivers++;
            }

            if ("AVAILABLE".equals(availability)) {
                availableDrivers++;
            } else {
                otherAvailabilityStatuses++;
            }
        }

        Map<String, Object> stats = new LinkedHashMap<>();

        stats.put("totalTrips", totalTrips);
        stats.put("completedTrips", completedTrips);
        stats.put("pendingTrips", pendingTrips);
        stats.put("rejectedTrips", rejectedTrips);
        stats.put("otherTripStatuses", otherTripStatuses);

        stats.put("totalVehicles", totalVehicles);
        stats.put("availableVehicles", availableVehicles);
        stats.put("otherVehicleStatuses", otherVehicleStatuses);

        stats.put("totalDrivers", totalDrivers);
        stats.put("activeDrivers", activeDrivers);
        stats.put("availableDrivers", availableDrivers);
        stats.put("otherAvailabilityStatuses", otherAvailabilityStatuses);

        stats.put("completedTripDistanceKm",
                roundToTwoDecimals(completedDistanceKm));
        stats.put("completedTripsWithRecordedDistance",
                tripsWithRecordedDistance);

        stats.put("completedTripFinalCharges",
                roundToTwoDecimals(completedCharges));
        stats.put("completedTripsWithRecordedCharges",
                tripsWithRecordedCharges);

        stats.put("averageRecordedCompletedTripCharge",
                tripsWithRecordedCharges == 0
                        ? null
                        : roundToTwoDecimals(
                                completedCharges / tripsWithRecordedCharges));

        return stats;
    }

    private String stringValue(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private Number numberValue(Object value) {
        return value instanceof Number ? (Number) value : null;
    }

    private double roundToTwoDecimals(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private void verifyAdmin(HttpServletRequest request) {
        String header = request.getHeader("Authorization");

        if (header == null || !header.startsWith("Basic ")) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please log in again.");
        }

        try {
            String decoded = new String(
                    Base64.getDecoder().decode(
                            header.substring(6).trim()),
                    StandardCharsets.UTF_8);

            int colon = decoded.indexOf(':');

            if (colon <= 0) {
                throw new IllegalArgumentException();
            }

            String email = decoded.substring(0, colon)
                    .trim()
                    .toLowerCase(Locale.ROOT);

            String password = decoded.substring(colon + 1);

            // Preserve the existing demo administrator account.
            if (("admin".equals(email)
                    || "admin@fleetflow.com".equals(email))
                    && "admin".equals(password)) {
                return;
            }

            Result users = db.run(
                    Select.from("fleetflow.Users")
                            .where(u -> u.get("email").eq(email)));

            Row user = users.first().orElse(null);

            if (user == null
                    || !"ACTIVE".equalsIgnoreCase(
                            String.valueOf(user.get("status")))
                    || !"ADMIN".equalsIgnoreCase(
                            String.valueOf(user.get("role")))) {
                throw new IllegalArgumentException();
            }

            String userId = String.valueOf(user.get("ID"));

            Result credentials = db.run(
                    Select.from("fleetflow.UserCredentials")
                            .where(c -> c.get("user_ID").eq(userId)));

            Row credential = credentials.first().orElse(null);

            if (credential == null
                    || !encoder.matches(
                            password,
                            String.valueOf(
                                    credential.get("passwordHash")))) {
                throw new IllegalArgumentException();
            }

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Administrator authentication failed.");
        }
    }
}