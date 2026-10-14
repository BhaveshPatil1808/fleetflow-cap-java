using { fleetflow as db } from '../db/schema';

@path: '/payment'
service PaymentService {
@readonly
entity Invoices as projection on db.Invoices;


@readonly
entity Payments as projection on db.Payments;


}
