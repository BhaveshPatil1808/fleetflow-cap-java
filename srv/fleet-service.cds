using { fleetflow as db } from '../db/schema';

@path: '/fleet'
service FleetService {

    entity Vehicles as projection on db.Vehicles;
    entity Drivers  as projection on db.Drivers;
    entity Trips    as projection on db.Trips;

}