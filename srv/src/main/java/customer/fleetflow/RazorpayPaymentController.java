
package customer.fleetflow;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sap.cds.Row;
import com.sap.cds.Result;
import com.sap.cds.ql.Insert;
import com.sap.cds.ql.Select;
import com.sap.cds.ql.Update;
import com.sap.cds.services.persistence.PersistenceService;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/payments")
public class RazorpayPaymentController {

    private final PersistenceService db;
    private final ObjectMapper mapper = new ObjectMapper();
    private final BCryptPasswordEncoder encoder =
            new BCryptPasswordEncoder();

    @Value("${razorpay.key-id:}")
    private String keyId;

    @Value("${razorpay.key-secret:}")
    private String keySecret;

    public RazorpayPaymentController(PersistenceService db) {
        this.db = db;
    }

    private Row authenticate(HttpServletRequest request) {
        String header = request.getHeader("Authorization");

        if (header == null || !header.startsWith("Basic ")) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Please log in again.");
        }

        try {
            String decoded = new String(
                    Base64.getDecoder().decode(header.substring(6).trim()),
                    StandardCharsets.UTF_8);

            int colon = decoded.indexOf(':');
            if (colon <= 0) {
                throw new IllegalArgumentException();
            }

            String email = decoded.substring(0, colon)
                    .trim().toLowerCase(Locale.ROOT);
            String password = decoded.substring(colon + 1);

            Result result = db.run(
                    Select.from("fleetflow.Users")
                            .where(u -> u.get("email").eq(email)));

            Row user = result.first().orElse(null);

            if (user == null
                    || !"ACTIVE".equalsIgnoreCase(
                            String.valueOf(user.get("status")))
                    || !"USER".equalsIgnoreCase(
                            String.valueOf(user.get("role")))) {
                throw new IllegalArgumentException();
            }

            String userId = String.valueOf(user.get("ID"));

            Result credentials = db.run(
                    Select.from("fleetflow.UserCredentials")
                            .where(c -> c.get("user_ID").eq(userId)));

            Row credential = credentials.first().orElse(null);

            if (credential == null
                    || !encoder.matches(password,
                            String.valueOf(credential.get("passwordHash")))) {
                throw new IllegalArgumentException();
            }

            return user;

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Invalid login credentials.");
        }
    }

    private void checkConfiguration() {
        if (keyId == null || keyId.isBlank()
                || keySecret == null || keySecret.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Razorpay credentials are not configured.");
        }
    }

    private Row getOwnedCompletedTrip(String tripId, String userId) {
        Result result = db.run(
                Select.from("fleetflow.Trips")
                        .where(t -> t.get("ID").eq(tripId)
                                .and(t.get("requestedBy_ID").eq(userId))));

        Row trip = result.first().orElse(null);

        if (trip == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Trip not found for this account.");
        }

        if (!"COMPLETED".equalsIgnoreCase(
                String.valueOf(trip.get("status")))) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Payment is available only for completed trips.");
        }

        if (trip.get("finalPrice") == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Final trip charge is unavailable.");
        }

        BigDecimal amount = new BigDecimal(
                String.valueOf(trip.get("finalPrice")));

        if (amount.signum() <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trip charge must be greater than zero.");
        }

        return trip;
    }

    private Row getOrCreateInvoice(Row trip, Row user) {
        String tripId = String.valueOf(trip.get("ID"));
        String userId = String.valueOf(user.get("ID"));

        Result existing = db.run(
                Select.from("fleetflow.Invoices")
                        .where(i -> i.get("trip_ID").eq(tripId)
                                .and(i.get("billedTo_ID").eq(userId))));

        Row invoice = existing.first().orElse(null);
        if (invoice != null) {
            return invoice;
        }

        BigDecimal amount = new BigDecimal(
                String.valueOf(trip.get("finalPrice")))
                .setScale(2, RoundingMode.HALF_UP);

        String invoiceId = UUID.randomUUID().toString();
        String invoiceNumber = "FF-" + UUID.randomUUID()
                .toString().substring(0, 8).toUpperCase(Locale.ROOT);

        Map<String, Object> values = new HashMap<>();
        values.put("ID", invoiceId);
        values.put("invoiceNumber", invoiceNumber);
        values.put("trip_ID", tripId);
        values.put("billedTo_ID", userId);
        values.put("amount", amount);
        values.put("currency", "INR");
        values.put("status", "UNPAID");

        db.run(Insert.into("fleetflow.Invoices").entry(values));

        Result created = db.run(
                Select.from("fleetflow.Invoices")
                        .where(i -> i.get("ID").eq(invoiceId)));

        return created.first().orElseThrow(() ->
                new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Invoice creation could not be confirmed."));
    }

    @PostMapping(
            value = "/order",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> createOrder(
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {

        checkConfiguration();
        Row user = authenticate(request);

        String tripId = body.get("tripID");
        if (tripId == null || tripId.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Trip ID is required.");
        }

        Row trip = getOwnedCompletedTrip(
                tripId, String.valueOf(user.get("ID")));

        Row invoice = getOrCreateInvoice(trip, user);

        if ("PAID".equalsIgnoreCase(
                String.valueOf(invoice.get("status")))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "This invoice is already paid.");
        }

        BigDecimal amount = new BigDecimal(
                String.valueOf(invoice.get("amount")))
                .setScale(2, RoundingMode.HALF_UP);

        long paise = amount.multiply(BigDecimal.valueOf(100))
                .longValueExact();

        try {
            Map<String, Object> orderRequest = new HashMap<>();
            orderRequest.put("amount", paise);
            orderRequest.put("currency", "INR");
            orderRequest.put("receipt",
                    String.valueOf(invoice.get("ID")));
            orderRequest.put("notes", Map.of(
                    "invoiceId", String.valueOf(invoice.get("ID")),
                    "tripId", tripId));

            String payload = mapper.writeValueAsString(orderRequest);

            java.net.http.HttpRequest httpRequest =
                    java.net.http.HttpRequest.newBuilder()
                            .uri(java.net.URI.create(
                                    "https://api.razorpay.com/v1/orders"))
                            .header("Content-Type", "application/json")
                            .header("Authorization", "Basic "
                                    + Base64.getEncoder().encodeToString(
                                            (keyId + ":" + keySecret)
                                                    .getBytes(StandardCharsets.UTF_8)))
                            .POST(java.net.http.HttpRequest.BodyPublishers
                                    .ofString(payload))
                            .build();

            java.net.http.HttpResponse<String> response =
                    java.net.http.HttpClient.newHttpClient().send(
                            httpRequest,
                            java.net.http.HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200
                    || response.statusCode() >= 300) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "Razorpay could not create the order. Please retry.");
            }

            JsonNode order = mapper.readTree(response.body());
            String orderId = order.path("id").asText();

            if (orderId.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "Razorpay returned an invalid order.");
            }

            String paymentId = UUID.randomUUID().toString();

            Map<String, Object> payment = new HashMap<>();
            payment.put("ID", paymentId);
            payment.put("invoice_ID", String.valueOf(invoice.get("ID")));
            payment.put("razorpayOrderId", orderId);
            payment.put("amount", amount);
            payment.put("currency", "INR");
            payment.put("status", "CREATED");

            db.run(Insert.into("fleetflow.Payments").entry(payment));

            return Map.of(
                    "keyId", keyId,
                    "orderId", orderId,
                    "amount", paise,
                    "currency", "INR",
                    "invoiceId", String.valueOf(invoice.get("ID")),
                    "invoiceNumber", String.valueOf(
                            invoice.get("invoiceNumber")),
                    "customerName", String.valueOf(user.get("firstName")),
                    "customerEmail", String.valueOf(user.get("email")));

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to create the Razorpay order.");
        }
    }

    @PostMapping(
            value = "/verify",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> verifyPayment(
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {

        checkConfiguration();
        Row user = authenticate(request);

        String invoiceId = body.get("invoiceId");
        String orderId = body.get("razorpay_order_id");
        String paymentId = body.get("razorpay_payment_id");
        String signature = body.get("razorpay_signature");

        if (invoiceId == null || orderId == null
                || paymentId == null || signature == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Required payment verification fields are missing.");
        }

        String userId = String.valueOf(user.get("ID"));

        Result invoices = db.run(
                Select.from("fleetflow.Invoices")
                        .where(i -> i.get("ID").eq(invoiceId)
                                .and(i.get("billedTo_ID").eq(userId))));

        Row invoice = invoices.first().orElse(null);

        if (invoice == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Invoice not found.");
        }

        if ("PAID".equalsIgnoreCase(
                String.valueOf(invoice.get("status")))) {
            return Map.of("status", "PAID",
                    "message", "Invoice is already paid.");
        }

        Result payments = db.run(
                Select.from("fleetflow.Payments")
                        .where(p -> p.get("invoice_ID").eq(invoiceId)
                                .and(p.get("razorpayOrderId").eq(orderId))));

        Row payment = payments.first().orElse(null);

        if (payment == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Payment order was not found.");
        }

        try {
            String signedData = orderId + "|" + paymentId;

            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                    keySecret.getBytes(StandardCharsets.UTF_8),
                    "HmacSHA256"));

            String expected = java.util.HexFormat.of()
                    .formatHex(mac.doFinal(
                            signedData.getBytes(StandardCharsets.UTF_8)));

            if (!MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.UTF_8),
                    signature.getBytes(StandardCharsets.UTF_8))) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Payment signature verification failed.");
            }

            Map<String, Object> paymentUpdate = new HashMap<>();
            paymentUpdate.put("razorpayPaymentId", paymentId);
            paymentUpdate.put("status", "PAID");

            db.run(Update.entity("fleetflow.Payments")
                    .data(paymentUpdate)
                    .where(p -> p.get("ID").eq(String.valueOf(payment.get("ID")))));

            db.run(Update.entity("fleetflow.Invoices")
                    .data(Map.of("status", "PAID"))
                    .where(i -> i.get("ID").eq(invoiceId)));

            return Map.of("status", "PAID",
                    "message", "Payment verified successfully.");

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Payment verification could not be completed.");
        }
    }
}