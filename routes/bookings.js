const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const Listing = require('../models/listing');
const { isLoggedIn } = require('../middleware');

// Show booking form
router.get('/new/:id', isLoggedIn, async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            req.flash('error', 'Listing not found');
            return res.redirect('/listings');
        }
        res.render('bookings/new', { listing });
    } catch (err) {
        req.flash('error', 'Something went wrong');
        res.redirect('/listings');
    }``
});

// Create booking
router.post('/', isLoggedIn, async (req, res) => {
    try {
        const { listingId, checkIn, checkOut, guests } = req.body;
        const listing = await Listing.findById(listingId);
        
        if (!listing) {
            req.flash('error', 'Listing not found');
            return res.redirect('/listings');
        }

        // Calculate total amount
        const days = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        const totalAmount = listing.price * days;

        // Create booking
        const booking = new Booking({
            user: req.user._id,
            listing: listingId,
            checkIn,
            checkOut,
            guests,
            totalAmount,
            status: 'confirmed' // Set status directly to confirmed since there's no payment
        });
        await booking.save();

        req.flash('success', 'Booking confirmed successfully!');
        res.redirect('/bookings/my-bookings');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Something went wrong');
        res.redirect('/listings');
    }
});

// Show user's bookings
router.get('/my-bookings', isLoggedIn, async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user._id })
            .populate('listing')
            .sort({ createdAt: -1 });
        res.render('bookings/index', { bookings });
    } catch (err) {
        req.flash('error', 'Something went wrong');
        res.redirect('/listings');
    }
});

module.exports = router; 