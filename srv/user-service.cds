using { fleetflow as db } from '../db/schema';

@path: '/user'
service UserService {

    entity Users as projection on db.Users;

    entity Trips as projection on db.Trips;

    entity Vehicles as projection on db.Vehicles;

    entity Drivers as projection on db.Drivers;
}