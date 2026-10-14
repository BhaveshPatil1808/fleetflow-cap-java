
package customer.fleetflow;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Locale;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.sap.cds.Result;
import com.sap.cds.Row;
import com.sap.cds.ql.Select;
import com.sap.cds.ql.cqn.CqnSelect;
import com.sap.cds.services.EventContext;
import com.sap.cds.services.cds.CqnService;
import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.Before;
import com.sap.cds.services.handler.annotations.ServiceName;
import com.sap.cds.services.persistence.PersistenceService;

import cds.gen.userservice.Trips;
import jakarta.servlet.http.HttpServletRequest;

@Component
@ServiceName("UserService")
public class TripDistanceHandler implements EventHandler {

    private final GeographicalDistanceService distanceService;
    private final PersistenceService persistence;
    private final BCryptPasswordEncoder passwordEncoder =
            new BCryptPasswordEncoder();

    public TripDistanceHandler(
            GeographicalDistanceService distanceService,
            PersistenceService persistence) {
        this.distanceService = distanceService;
        this.persistence = persistence;
    }

    @Before(event = CqnService.EVENT_CREATE, entity = "UserService.Trips")
    public void prepareTrip(Trips trip, EventContext context) {

        // Authenticate the actual request and resolve the FleetFlow user.
        Row user = getAuthenticatedUser();

        // Read the selected vehicle from the incoming request.
        Object vehicleValue = trip.get("vehicle_ID");
        String vehicleId = vehicleValue == null
                ? null : vehicleValue.toString();

        if (vehicleId == null || vehicleId.isBlank()) {
            throw new IllegalArgumentException(
                    "Select a vehicle before requesting a trip.");
        }

        // Find the selected vehicle.
        Row vehicle = findOne(
                Select.from("fleetflow.Vehicles")
                        .where(v -> v.get("ID").eq(vehicleId)));

        if (vehicle == null) {
            throw new IllegalArgumentException(
                    "The selected vehicle does not exist.");
        }

        // Determine the driver assigned to this vehicle.
        Object driverValue = vehicle.get("driver_ID");
        String driverId = driverValue == null
                ? null : driverValue.toString();

        if (driverId == null || driverId.isBlank()) {
            throw new IllegalArgumentException(
                    "The selected vehicle has no assigned driver.");
        }

        // Never trust relationship IDs supplied by the browser.
        trip.put("requestedBy_ID", user.get("ID"));
        trip.put("driver_ID", driverId);

        // Validate locations.
        if (trip.getStartLocation() == null
                || trip.getStartLocation().isBlank()
                || trip.getEndLocation() == null
                || trip.getEndLocation().isBlank()) {
            throw new IllegalArgumentException(
                    "Enter both the start location and destination.");
        }

        // Geocode both locations.
        var start = distanceService.geocode(
                trip.getStartLocation());

        var end = distanceService.geocode(
                trip.getEndLocation());

        trip.setStartLatitude(
                BigDecimal.valueOf(start.latitude()));

        trip.setStartLongitude(
                BigDecimal.valueOf(start.longitude()));

        trip.setEndLatitude(
                BigDecimal.valueOf(end.latitude()));

        trip.setEndLongitude(
                BigDecimal.valueOf(end.longitude()));

        // Calculate geographical distance.
        double distanceKm =
                distanceService.calculateDistanceKm(
                        start.latitude(),
                        start.longitude(),
                        end.latitude(),
                        end.longitude());

        BigDecimal roundedDistance =
                BigDecimal.valueOf(distanceKm)
                        .setScale(2, RoundingMode.HALF_UP);

        trip.setEstimatedDistance(roundedDistance);
        trip.setEstimatedDistanceSource(
                "GEOGRAPHICAL_ESTIMATE");

        // The server controls the estimated rate and price.
        BigDecimal rate = new BigDecimal("15.00");

        trip.setRatePerKM(rate);

        trip.setEstimatedPrice(
                distanceService.calculatePrice(
                        roundedDistance.doubleValue(),
                        rate));

        // The server controls the initial trip status.
        trip.setStatus("PENDING_CONFIRMATION");

        // Clear fields that must not be provided by the client.
        trip.put("startMeter", null);
        trip.put("endMeter", null);
        trip.put("actualDistance", null);
        trip.put("finalPrice", null);
        trip.put("rejectionReason", null);
    }

    /**
     * Validates the Basic credentials supplied with the request
     * and returns the matching active USER account.
     */
    private Row getAuthenticatedUser() {

        ServletRequestAttributes attributes =
                (ServletRequestAttributes)
                        RequestContextHolder.getRequestAttributes();

        if (attributes == null) {
            throw new IllegalArgumentException(
                    "Unable to identify the current request. Please log in again.");
        }

        HttpServletRequest request = attributes.getRequest();

        String authorization =
                request.getHeader("Authorization");

        if (authorization == null
                || !authorization.startsWith("Basic ")) {
            throw new IllegalArgumentException(
                    "Please log in again.");
        }

        final String decoded;

        try {
            decoded = new String(
                    Base64.getDecoder().decode(
                            authorization.substring(6).trim()),
                    StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Invalid login credentials.");
        }

        int separator = decoded.indexOf(':');

        if (separator <= 0) {
            throw new IllegalArgumentException(
                    "Invalid login credentials.");
        }

        String email = decoded.substring(0, separator)
                .trim()
                .toLowerCase(Locale.ROOT);

        String password = decoded.substring(separator + 1);

        if (email.isBlank() || password.isEmpty()) {
            throw new IllegalArgumentException(
                    "Invalid login credentials.");
        }

        // Find the account by normalized email.
        Row user = findOne(
                Select.from("fleetflow.Users")
                        .where(u -> u.get("email").eq(email)));

        if (user == null) {
            throw new IllegalArgumentException(
                    "Invalid login credentials.");
        }

        // Only active accounts can request trips.
        if (!"ACTIVE".equalsIgnoreCase(
                String.valueOf(user.get("status")))) {
            throw new IllegalArgumentException(
                    "Your account is inactive.");
        }

        // Only USER accounts can request trips.
        String role = String.valueOf(user.get("role"));

        if (!"USER".equalsIgnoreCase(role)) {
            throw new IllegalArgumentException(
                    "Only user accounts can request trips.");
        }

        // Retrieve the stored BCrypt password hash.
        String userId = String.valueOf(user.get("ID"));

        Result credentials = persistence.run(
                Select.from("fleetflow.UserCredentials")
                        .where(c -> c.get("user_ID").eq(userId)));

        Row credential = credentials.first().orElse(null);

        if (credential == null) {
            throw new IllegalArgumentException(
                    "Invalid login credentials.");
        }

        Object hashValue = credential.get("passwordHash");

        if (hashValue == null
                || !passwordEncoder.matches(
                        password, hashValue.toString())) {
            throw new IllegalArgumentException(
                    "Invalid login credentials.");
        }

        return user;
    }

    private Row findOne(CqnSelect query) {
        Result result = persistence.run(query);
        return result.first().orElse(null);
    }
}