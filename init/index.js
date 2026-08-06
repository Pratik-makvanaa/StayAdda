if (process.env.NODE_ENV !== "production") {
    require("dotenv").config({ path: "../.env" });
}

const mongoose = require("mongoose");
const Listing = require("../models/listing.js");
const Review = require("../models/review.js");
const Booking = require("../models/booking.js");
const User = require("../models/user.js");

const sampleListings = require("./data.js");
const sampleUsers = require("./users.js");
const sampleReviews = require("./reviews.js");
const sampleBookings = require("./bookings.js");

const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/stayadda";

async function main() {
    try {
        await mongoose.connect(dbUrl);
        console.log("Connected to MongoDB successfully.");

        await initDB();
    } catch (err) {
        console.error("Database initialization error:", err);
    } finally {
        await mongoose.connection.close();
        console.log("MongoDB connection closed.");
    }
}

async function initDB() {
    console.log("Clearing existing database collections...");
    await Listing.deleteMany({});
    await Review.deleteMany({});
    await Booking.deleteMany({});
    await User.deleteMany({});

    console.log("Seeding Users...");
    const createdUsers = [];
    for (let u of sampleUsers) {
        const userObj = new User({ email: u.email, username: u.username });
        const registeredUser = await User.register(userObj, u.password);
        createdUsers.push(registeredUser);
    }
    console.log(`Successfully registered ${createdUsers.length} users.`);

    const ownerUser = createdUsers.find(u => u.username === "pratik_host") || createdUsers[0];
    const guestUser1 = createdUsers.find(u => u.username === "ananya_travels") || createdUsers[1];
    const guestUser2 = createdUsers.find(u => u.username === "rohit_sharma") || createdUsers[2];

    console.log("Seeding Reviews...");
    const createdReviews = [];
    for (let i = 0; i < sampleReviews.length; i++) {
        const revData = sampleReviews[i];
        const author = (i % 2 === 0) ? guestUser1._id : guestUser2._id;
        const review = new Review({
            ...revData,
            author: author,
        });
        await review.save();
        createdReviews.push(review);
    }
    console.log(`Successfully created ${createdReviews.length} reviews.`);

    console.log("Seeding 50 Hotel Listings...");
    const createdListings = [];
    for (let i = 0; i < sampleListings.length; i++) {
        const listingData = sampleListings[i];
        
        // Attach 2 sample reviews to first few listings
        const assignedReviews = (i < 5) ? [createdReviews[i % createdReviews.length]._id, createdReviews[(i + 1) % createdReviews.length]._id] : [];
        
        const listing = new Listing({
            ...listingData,
            owner: ownerUser._id,
            reviews: assignedReviews,
            numReviews: assignedReviews.length > 0 ? assignedReviews.length : (listingData.numReviews || 0),
        });

        await listing.save();
        createdListings.push(listing);
    }
    console.log(`Successfully seeded ${createdListings.length} hotel listings.`);

    console.log("Seeding Sample Bookings...");
    for (let i = 0; i < sampleBookings.length; i++) {
        const bookingData = sampleBookings[i];
        const targetListing = createdListings[i % createdListings.length];
        const targetUser = (i % 2 === 0) ? guestUser1._id : guestUser2._id;

        const booking = new Booking({
            ...bookingData,
            user: targetUser,
            listing: targetListing._id,
        });

        await booking.save();
    }
    console.log("Successfully seeded sample bookings.");

    console.log("Database Seeding Completed Successfully! 🚀");
}

main();
