/**
 * Sample bookings dataset template for StayAdda AI initialization.
 * Contains realistic booking records with payment status and Razorpay IDs for analytics and management.
 */
const sampleBookings = [
    {
        bookingId: "SA-2026-8801",
        checkIn: new Date("2026-08-15"),
        checkOut: new Date("2026-08-18"),
        guests: 2,
        totalAmount: 19500,
        status: "confirmed",
        paymentId: "pay_P19827364501",
        razorpayOrderId: "order_O8827361928",
        paymentStatus: "paid",
        paymentMethod: "upi",
    },
    {
        bookingId: "SA-2026-8802",
        checkIn: new Date("2026-09-01"),
        checkOut: new Date("2026-09-05"),
        guests: 4,
        totalAmount: 34000,
        status: "confirmed",
        paymentId: "pay_P29837461522",
        razorpayOrderId: "order_O9938472819",
        paymentStatus: "paid",
        paymentMethod: "card",
    },
    {
        bookingId: "SA-2026-8803",
        checkIn: new Date("2026-08-20"),
        checkOut: new Date("2026-08-22"),
        guests: 1,
        totalAmount: 9200,
        status: "pending",
        paymentId: null,
        razorpayOrderId: "order_O7738291045",
        paymentStatus: "pending",
        paymentMethod: "pay_at_hotel",
    }
];

module.exports = sampleBookings;
