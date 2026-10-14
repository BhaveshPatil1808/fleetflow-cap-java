
using { fleetflow as db } from '../db/schema';

@path: '/driver'
service DriverService {
    entity Drivers as projection on db.Drivers;
    entity Users as projection on db.Users;
    entity Vehicles as projection on db.Vehicles;

    entity Trips as projection on db.Trips {
        *,
        vehicle,
        driver,
        requestedBy
    };

    action approveTrip(tripID: UUID);
    action rejectTrip(tripID: UUID, reason: String(255));

    action startTrip(
        tripID: UUID,
        startMeter: Integer
    );

    action completeTrip(
        tripID: UUID,
        endMeter: Integer
    );
}