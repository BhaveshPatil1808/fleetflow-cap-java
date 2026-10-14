
package customer.fleetflow;

import java.util.List;
import java.util.Locale;

import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import com.sap.cds.Row;
import com.sap.cds.Result;
import com.sap.cds.ql.Select;
import com.sap.cds.services.persistence.PersistenceService;

@Component
public class FleetFlowAuthenticationProvider implements AuthenticationProvider {

    private final PersistenceService db;
    private final BCryptPasswordEncoder passwordEncoder =
            new BCryptPasswordEncoder();

    public FleetFlowAuthenticationProvider(PersistenceService db) {
        this.db = db;
    }

    @Override
    public Authentication authenticate(Authentication authentication) {
        String username = authentication.getName() == null
                ? ""
                : authentication.getName().trim().toLowerCase(Locale.ROOT);

        String password = authentication.getCredentials() == null
                ? ""
                : authentication.getCredentials().toString();

        if (username.isBlank() || password.isBlank()) {
            throw new BadCredentialsException("Invalid email or password.");
        }

        // Preserve existing demo accounts.
        if (("admin".equals(username)
                || "admin@fleetflow.com".equals(username))
                && "admin".equals(password)) {
            return authenticated("admin@fleetflow.com", "ADMIN");
        }

        if ("rahul@fleetflow.com".equals(username)
                && "rahul".equals(password)) {
            return authenticated(username, "USER");
        }

        if ("amit.driver@fleetflow.com".equals(username)
                && "amit".equals(password)) {
            return authenticated(username, "DRIVER");
        }

        // Registered accounts are authenticated against SQLite.
        Result users = db.run(
            Select.from("fleetflow.Users")
                .where(u -> u.get("email").eq(username))
        );

        if (users.list().isEmpty()) {
            throw new BadCredentialsException("Invalid email or password.");
        }

        Row user = users.list().get(0);

        if (!"ACTIVE".equalsIgnoreCase(
                String.valueOf(user.get("status")))) {
            throw new BadCredentialsException("Account is not active.");
        }

        String role = String.valueOf(user.get("role"));

        if (!"USER".equals(role) && !"DRIVER".equals(role)) {
            throw new BadCredentialsException("Invalid email or password.");
        }

        String userId = String.valueOf(user.get("ID"));

        Result credentials = db.run(
            Select.from("fleetflow.UserCredentials")
                .where(c -> c.get("user_ID").eq(userId))
        );

        if (credentials.list().isEmpty()) {
            throw new BadCredentialsException("Invalid email or password.");
        }

        String passwordHash = String.valueOf(
            credentials.list().get(0).get("passwordHash")
        );

        if (!passwordEncoder.matches(password, passwordHash)) {
            throw new BadCredentialsException("Invalid email or password.");
        }

        return authenticated(username, role);
    }

    private Authentication authenticated(String username, String role) {
        return UsernamePasswordAuthenticationToken.authenticated(
            username,
            null,
            List.of(new SimpleGrantedAuthority(role))
        );
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class
                .isAssignableFrom(authentication);
    }
}