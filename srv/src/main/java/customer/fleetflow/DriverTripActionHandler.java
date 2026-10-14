
package customer.fleetflow;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.sap.cds.Row;
import com.sap.cds.Result;
import com.sap.cds.ql.Select;
import com.sap.cds.ql.Update;
import com.sap.cds.services.EventContext;
import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.On;
import com.sap.cds.services.handler.annotations.ServiceName;
import com.sap.cds.services.persistence.PersistenceService;

@Component
@ServiceName("DriverService")
public class DriverTripActionHandler implements EventHandler {

    private final PersistenceService persistence;
    private final DriverIdentityHelper driverIdentityHelper;

    public DriverTripActionHandler(
            PersistenceService persistence,
            DriverIdentityHelper driverIdentityHelper) {
        this.persistence = persistence;
        this.driverIdentityHelper = driverIdentityHelper;
    }

    @On(event = "approveTrip")
    public void approveTrip(EventContext context) {
        String tripID = getRequiredValue(context, "tripID");

        getAssignedTrip(context, tripID, "PENDING_CONFIRMATION");

        updateTripStatus(tripID, "APPROVED", null);

        context.setCompleted();
    }

    @On(event = "rejectTrip")
    public void rejectTrip(EventContext context) {
        String tripID = getRequiredValue(context, "tripID");
        String reason = getRequiredValue(context, "reason").trim();

        if (reason.isEmpty()) {
            throw new IllegalArgumentException(
                    "Please provide a rejection reason.");
        }

        if (reason.length() > 255) {
            throw new IllegalArgumentException(
                    "Rejection reason cannot exceed 255 characters.");
        }

        getAssignedTrip(context, tripID, "PENDING_CONFIRMATION");

        updateTripStatus(tripID, "REJECTED", reason);

        context.setCompleted();
    }

    @On(event = "startTrip")
    public void startTrip(EventContext context) {
        String tripID = getRequiredValue(context, "tripID");
        int startMeter = getIntegerValue(context, "startMeter");

        if (startMeter < 0) {
            throw new IllegalArgumentException(
                    "Starting odometer reading cannot be negative.");
        }

        getAssignedTrip(context, tripID, "APPROVED");

        Map<String, Object> values = new HashMap<>();
        values.put("startMeter", startMeter);
        values.put("status", "IN_PROGRESS");

        Result result = persistence.run(
                Update.entity("fleetflow.Trips")
                        .data(values)
                        .where(t -> t.get("ID").eq(tripID)
                                .and(t.get("status").eq("APPROVED")))
        );

        if (result.rowCount() == 0) {
            throw new IllegalArgumentException(
                    "Trip could not be started. Refresh and try again.");
        }

        context.setCompleted();
    }

    @On(event = "completeTrip")
    public void completeTrip(EventContext context) {
        String tripID = getRequiredValue(context, "tripID");
        int endMeter = getIntegerValue(context, "endMeter");

        if (endMeter < 0) {
            throw new IllegalArgumentException(
                    "Ending odometer reading cannot be negative.");
        }

        Row trip = getAssignedTrip(
                context, tripID, "IN_PROGRESS");

        Object startMeterValue = trip.get("startMeter");

        if (startMeterValue == null) {
            throw new IllegalArgumentException(
                    "Starting odometer reading is missing.");
        }

        int startMeter =
                Integer.parseInt(startMeterValue.toString());

        if (endMeter <= startMeter) {
            throw new IllegalArgumentException(
                    "Ending odometer reading must be greater than "
                            + "the starting reading.");
        }

        int actualDistance = endMeter - startMeter;

        Object rateValue = trip.get("ratePerKM");

        BigDecimal ratePerKM = rateValue == null
                ? new BigDecimal("15.00")
                : new BigDecimal(rateValue.toString());

        BigDecimal finalPrice = ratePerKM
                .multiply(BigDecimal.valueOf(actualDistance))
                .setScale(2, RoundingMode.HALF_UP);

        Map<String, Object> values = new HashMap<>();
        values.put("endMeter", endMeter);
        values.put("actualDistance", actualDistance);
        values.put("finalPrice", finalPrice);
        values.put("status", "COMPLETED");

        Result result = persistence.run(
                Update.entity("fleetflow.Trips")
                        .data(values)
                        .where(t -> t.get("ID").eq(tripID)
                                .and(t.get("status").eq("IN_PROGRESS")))
        );

        if (result.rowCount() == 0) {
            throw new IllegalArgumentException(
                    "Trip could not be completed. Refresh and try again.");
        }

        context.setCompleted();
    }

    private Row getAssignedTrip(
            EventContext context,
            String tripID,
            String expectedStatus) {

        // Resolve the driver using verified request credentials.
        Row driver = driverIdentityHelper.getLoggedInDriver();

        String driverID = String.valueOf(driver.get("ID"));

        Row trip = persistence.run(
                Select.from("fleetflow.Trips")
                        .columns(
                                "ID",
                                "driver_ID",
                                "status",
                                "startMeter",
                                "ratePerKM"
                        )
                        .where(t -> t.get("ID").eq(tripID))
        ).first().orElse(null);

        if (trip == null) {
            throw new IllegalArgumentException(
                    "Trip request was not found.");
        }

        Object assignedDriverValue = trip.get("driver_ID");

        String assignedDriverID = assignedDriverValue == null
                ? ""
                : assignedDriverValue.toString();

        System.out.println("========== TRIP ASSIGNMENT DEBUG ==========");
System.out.println("Trip ID          : " + tripID);
System.out.println("Logged Driver ID : " + driverID);
System.out.println("Assigned Driver ID: " + assignedDriverID);
System.out.println("Expected Status  : " + expectedStatus);
System.out.println("Actual Status    : " + trip.get("status"));
System.out.println("===========================================");

        if (!driverID.equals(assignedDriverID)) {
            throw new IllegalArgumentException(
                    "You are not assigned to this trip.");
        }

        if (!expectedStatus.equals(
                String.valueOf(trip.get("status")))) {
            throw new IllegalArgumentException(
                    "Trip status must be " + expectedStatus
                            + ". Refresh the page and try again.");
        }

        return trip;
    }

    private void updateTripStatus(
            String tripID,
            String status,
            String reason) {

        Map<String, Object> values = new HashMap<>();
        values.put("status", status);
        values.put("rejectionReason", reason);

        Result result = persistence.run(
                Update.entity("fleetflow.Trips")
                        .data(values)
                        .where(t -> t.get("ID").eq(tripID)
                                .and(t.get("status")
                                        .eq("PENDING_CONFIRMATION")))
        );

        if (result.rowCount() == 0) {
            throw new IllegalArgumentException(
                    "This trip was already processed. Refresh the requests.");
        }
    }

    private String getRequiredValue(
            EventContext context,
            String field) {

        Object value = context.get(field);

        if (value == null || value.toString().isBlank()) {
            throw new IllegalArgumentException(
                    field + " is required.");
        }

        return value.toString();
    }

    private int getIntegerValue(
            EventContext context,
            String field) {

        String value = getRequiredValue(context, field);

        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    field + " must be a valid whole number.");
        }
    }
}