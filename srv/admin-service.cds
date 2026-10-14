using { fleetflow as db } from '../db/schema';

@path: '/admin'
service AdminService {

    @readonly
    entity Users as projection on db.Users;

    @readonly
    entity Vehicles as projection on db.Vehicles;

    @readonly
    entity Drivers as projection on db.Drivers;

    @readonly
    entity Trips as projection on db.Trips;

}