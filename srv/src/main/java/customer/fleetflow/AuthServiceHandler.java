
package customer.fleetflow;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import com.sap.cds.Result;
import com.sap.cds.Row;
import com.sap.cds.ql.Insert;
import com.sap.cds.ql.Select;
import com.sap.cds.services.ServiceException;
import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.On;
import com.sap.cds.services.handler.annotations.ServiceName;
import com.sap.cds.services.persistence.PersistenceService;

import cds.gen.authservice.AuthInfo;
import cds.gen.authservice.LoginContext;
import cds.gen.authservice.RegisterContext;

@Component
@ServiceName("AuthService")
public class AuthServiceHandler implements EventHandler {

    private final PersistenceService db;
    private final BCryptPasswordEncoder passwordEncoder =
            new BCryptPasswordEncoder();

    public AuthServiceHandler(PersistenceService db) {
        this.db = db;
    }

    @On(event = LoginContext.CDS_NAME)
    public void login(LoginContext context) {
        String username = normalizeEmail(context.getUsername());
        String password = context.getPassword();

        if (username.isBlank() || password == null || password.isBlank()) {
            throw new ServiceException("Username and password are required.");
        }

        // Preserve the existing Admin demo credentials.
        if (("admin".equalsIgnoreCase(username)
                || "admin@fleetflow.com".equals(username))
                && "admin".equals(password)) {
            context.setResult(createAuthInfo("admin@fleetflow.com", "ADMIN"));
            return;
        }

        // Preserve the existing demo User account.
        if ("rahul@fleetflow.com".equals(username)
                && "rahul".equals(password)) {
            context.setResult(createAuthInfo(username, "USER"));
            return;
        }

        // Preserve the existing demo Driver account.
        if ("amit.driver@fleetflow.com".equals(username)
                && "amit".equals(password)) {
            context.setResult(createAuthInfo(username, "DRIVER"));
            return;
        }

        // Look up a registered account by email.
        Result users = db.run(
            Select.from("fleetflow.Users")
                .where(u -> u.get("email").eq(username))
        );

        if (users.list().isEmpty()) {
            throw new ServiceException("Invalid username or password.");
        }

        Row user = users.list().get(0);
        String userId = String.valueOf(user.get("ID"));

        Result credentials = db.run(
            Select.from("fleetflow.UserCredentials")
                .where(c -> c.get("user_ID").eq(userId))
        );

        if (credentials.list().isEmpty()) {
            throw new ServiceException("Invalid username or password.");
        }

        Row credential = credentials.list().get(0);
        String passwordHash = String.valueOf(
            credential.get("passwordHash")
        );

        if (!passwordEncoder.matches(password, passwordHash)) {
            throw new ServiceException("Invalid username or password.");
        }

        String role = String.valueOf(user.get("role"));

        if (!"USER".equals(role) && !"DRIVER".equals(role)) {
            throw new ServiceException("This account cannot log in here.");
        }

        context.setResult(createAuthInfo(username, role));
    }

    @On(event = RegisterContext.CDS_NAME)
    public void register(RegisterContext context) {
        String firstName = trim(context.getFirstName());
        String lastName = trim(context.getLastName());
        String email = normalizeEmail(context.getEmail());
        String password = context.getPassword();
        String requestedRole = trim(context.getRole()).toUpperCase(Locale.ROOT);
        String phone = trim(context.getPhone());
        String licenseNumber = trim(context.getLicenseNumber());

        if (firstName.isBlank() || email.isBlank()
                || password == null || password.length() < 8) {
            throw new ServiceException(
                "First name, email, and a password of at least 8 characters are required."
            );
        }

        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new ServiceException("Enter a valid email address.");
        }

        // Never allow public registration as Admin.
        if (!"USER".equals(requestedRole)
                && !"DRIVER".equals(requestedRole)) {
            throw new ServiceException(
                "You can register only as USER or DRIVER."
            );
        }

        if ("DRIVER".equals(requestedRole)
                && licenseNumber.isBlank()) {
            throw new ServiceException(
                "A driving licence number is required for Driver registration."
            );
        }

        Result existing = db.run(
            Select.from("fleetflow.Users")
                .where(u -> u.get("email").eq(email))
        );

        if (!existing.list().isEmpty()) {
            throw new ServiceException(
                "An account with this email already exists."
            );
        }

        String userId = UUID.randomUUID().toString();
        String credentialId = UUID.randomUUID().toString();

        Map<String, Object> userData = new HashMap<>();
        userData.put("ID", userId);
        userData.put("firstName", firstName);
        userData.put("lastName", lastName.isBlank() ? null : lastName);
        userData.put("email", email);
        userData.put("role", requestedRole);
        userData.put("status", "ACTIVE");

        db.run(Insert.into("fleetflow.Users").entry(userData));

        Map<String, Object> credentialData = new HashMap<>();
        credentialData.put("ID", credentialId);
        credentialData.put("user_ID", userId);
        credentialData.put(
            "passwordHash",
            passwordEncoder.encode(password)
        );

        db.run(
            Insert.into("fleetflow.UserCredentials").entry(credentialData)
        );

        if ("DRIVER".equals(requestedRole)) {
            String driverId = UUID.randomUUID().toString();

            Map<String, Object> driverData = new HashMap<>();
            driverData.put("ID", driverId);
            driverData.put("firstName", firstName);
            driverData.put("lastName", lastName.isBlank() ? null : lastName);
            driverData.put("email", email);
            driverData.put("phone", phone.isBlank() ? null : phone);
            driverData.put("licenseNumber", licenseNumber);
            driverData.put("licenseExpiry", context.getLicenseExpiry());
            driverData.put("status", "ACTIVE");
            driverData.put("availabilityStatus", "AVAILABLE");
            driverData.put("user_ID", userId);

            db.run(Insert.into("fleetflow.Drivers").entry(driverData));
        }

        context.setResult(createAuthInfo(email, requestedRole));
    }

    private AuthInfo createAuthInfo(String username, String role) {
        AuthInfo result = AuthInfo.create();
        result.setUsername(username);
        result.setRole(role);
        return result;
    }

    private String normalizeEmail(String value) {
        return value == null
            ? ""
            : value.trim().toLowerCase(Locale.ROOT);
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}