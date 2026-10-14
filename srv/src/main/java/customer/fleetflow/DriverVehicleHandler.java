package customer.fleetflow;

import org.springframework.stereotype.Component;

import com.sap.cds.Row;
import com.sap.cds.services.EventContext;
import com.sap.cds.services.cds.CqnService;
import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.Before;
import com.sap.cds.services.handler.annotations.ServiceName;

import cds.gen.driverservice.Vehicles;

@Component
@ServiceName("DriverService")
public class DriverVehicleHandler implements EventHandler {


private final DriverIdentityHelper driverIdentityHelper;

public DriverVehicleHandler(
        DriverIdentityHelper driverIdentityHelper) {
    this.driverIdentityHelper = driverIdentityHelper;
}

@Before(
    event = CqnService.EVENT_CREATE,
    entity = "DriverService.Vehicles"
)
public void assignVehicleOwner(
        Vehicles vehicle, EventContext context) {

    Row driver = driverIdentityHelper.getLoggedInDriver();

    // Ownership is always assigned by the backend.
    vehicle.put("driver_ID", driver.get("ID"));
    vehicle.setStatus("AVAILABLE");
}


}
