namespace fleetflow;

using {
    cuid,
    managed
} from '@sap/cds/common';


/* =========================================================
   USERS
   ========================================================= */

entity Users : cuid, managed {

    firstName : String(50) not null;
    lastName  : String(50);

    email : String(100) not null;

    role : String(20) not null default 'USER';

    status : String(20) not null default 'ACTIVE';
}


/* =========================================================
   VEHICLES
   ========================================================= */

entity Vehicles : cuid, managed {

    registrationNumber : String(20) not null;

    vehicleType : String(30);

    brand : String(50);

    model : String(50);

    fuelType : String(20);

    purchaseDate : Date;

    currentKM : Integer;

    status : String(20) not null default 'AVAILABLE';

    driver : Association to Drivers;
}


/* =========================================================
   DRIVERS
   ========================================================= */

entity Drivers : cuid, managed {

    firstName : String(50) not null;

    lastName : String(50);

    email : String(100);

    phone : String(20);

    licenseNumber : String(30) not null;

    licenseExpiry : Date;

    status : String(20) not null default 'ACTIVE';

    availabilityStatus : String(20) not null default 'AVAILABLE';

    user : Association to Users;
}


entity Trips : cuid, managed {

    /* BASIC TRIP INFORMATION */

    tripDate : Date not null;

    startLocation : String(100) not null;

    endLocation : String(100) not null;

    purpose : String(255);


    /* LOCATION COORDINATES */

    startLatitude  : Decimal(10,7);
    startLongitude : Decimal(10,7);

    endLatitude    : Decimal(10,7);
    endLongitude   : Decimal(10,7);


    /* ESTIMATED DISTANCE */

    estimatedDistance : Decimal(10,2);

    estimatedDistanceSource : String(30)
        default 'GEOGRAPHICAL_ESTIMATE';


    /* ESTIMATED PRICE */

    ratePerKM : Decimal(10,2) not null default 15;

    estimatedPrice : Decimal(12,2);


    /* ACTUAL VEHICLE METER READINGS */

    startMeter : Integer;

    endMeter : Integer;

    actualDistance : Integer;


    /* FINAL PRICE */

    finalPrice : Decimal(12,2);


    /* TRIP STATUS */

    status : String(30)
        not null default 'PENDING_CONFIRMATION';

    rejectionReason : String(255);


    /* RELATIONSHIPS */

    vehicle : Association to Vehicles;

    driver : Association to Drivers;

    requestedBy : Association to Users;
}


entity UserCredentials : cuid, managed {
    user         : Association to Users not null;
    passwordHash : String(100) not null;
}




/* =========================================================
   INVOICES
   ========================================================= */

entity Invoices : cuid, managed {
    invoiceNumber : String(40) not null;
    trip           : Association to Trips not null;
    billedTo       : Association to Users not null;
    amount         : Decimal(12,2) not null;
    currency       : String(3) not null default 'INR';
    status         : String(20) not null default 'UNPAID';
}

/* =========================================================
   PAYMENTS
   ========================================================= */

entity Payments : cuid, managed {
    invoice            : Association to Invoices not null;
    razorpayOrderId    : String(100);
    razorpayPaymentId  : String(100);
    amount             : Decimal(12,2) not null;
    currency           : String(3) not null default 'INR';
    status             : String(20) not null default 'CREATED';
}