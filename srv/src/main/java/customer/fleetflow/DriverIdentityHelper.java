package customer.fleetflow;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Locale;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.sap.cds.Row;
import com.sap.cds.Result;
import com.sap.cds.ql.Select;
import com.sap.cds.services.persistence.PersistenceService;

import jakarta.servlet.http.HttpServletRequest;

@Component
public class DriverIdentityHelper {


private final PersistenceService persistence;
private final BCryptPasswordEncoder passwordEncoder =
        new BCryptPasswordEncoder();

public DriverIdentityHelper(PersistenceService persistence) {
    this.persistence = persistence;
}

public Row getLoggedInDriver() {
    ServletRequestAttributes attributes =
            (ServletRequestAttributes)
            RequestContextHolder.getRequestAttributes();

    if (attributes == null) {
        throw new IllegalArgumentException(
                "Unable to identify the current request.");
    }

    HttpServletRequest request = attributes.getRequest();
    String authorization = request.getHeader("Authorization");

    if (authorization == null ||
            !authorization.startsWith("Basic ")) {
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
            .trim().toLowerCase(Locale.ROOT);
    String password = decoded.substring(separator + 1);

    Result users = persistence.run(
            Select.from("fleetflow.Users")
                .where(u -> u.get("email").eq(email)));

    Row user = users.first().orElse(null);

    if (user == null ||
            !"ACTIVE".equalsIgnoreCase(
                    String.valueOf(user.get("status")))) {
        throw new IllegalArgumentException(
                "Invalid login credentials.");
    }

    String role = String.valueOf(user.get("role"));
    if (!"DRIVER".equalsIgnoreCase(role)) {
        throw new IllegalArgumentException(
                "Only driver accounts can register vehicles.");
    }

    String userID = String.valueOf(user.get("ID"));

    Result credentials = persistence.run(
            Select.from("fleetflow.UserCredentials")
                .where(c -> c.get("user_ID").eq(userID)));

    Row credential = credentials.first().orElse(null);

    if (credential == null ||
            !passwordEncoder.matches(
                    password,
                    String.valueOf(credential.get("passwordHash")))) {
        throw new IllegalArgumentException(
                "Invalid login credentials.");
    }

    Result drivers = persistence.run(
            Select.from("fleetflow.Drivers")
                .where(d -> d.get("user_ID").eq(userID)));

    Row driver = drivers.first().orElse(null);

    if (driver == null) {
        throw new IllegalArgumentException(
                "No driver profile is linked to this account.");
    }

    return driver;
}


}
