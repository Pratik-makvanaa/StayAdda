const mongoose = require("mongoose");
const Review = require("./review.js");
const Schema = mongoose.Schema;

const listingSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        image: {
            url: String,
            filename: String,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        location: {
            type: String,
            required: true,
        },
        country: {
            type: String,
            required: true,
            default: "India",
        },
        // --- Extended fields for AI & Production ---
        city: {
            type: String,
            trim: true,
        },
        state: {
            type: String,
            trim: true,
        },
        category: {
            type: String,
            enum: ["Luxury", "Villa", "Resort", "Heritage", "Budget", "Boutique", "Beachfront", "Mountain"],
            default: "Resort",
        },
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        numReviews: {
            type: Number,
            default: 0,
        },
        amenities: [
            {
                type: String,
            },
        ],
        coordinates: {
            lat: { type: Number },
            lng: { type: Number },
        },
        nearbyAttractions: [
            {
                name: { type: String },
                distance: { type: String },
            },
        ],
        travelType: [
            {
                type: String,
                enum: ["Solo", "Family", "Couples", "Business", "Friends", "Luxury", "Budget"],
            },
        ],
        roomTypes: [
            {
                name: { type: String },
                price: { type: Number },
                capacity: { type: Number },
            },
        ],
        availableRooms: {
            type: Number,
            default: 1,
            min: 0,
        },
        bestSeason: [
            {
                type: String,
            },
        ],
        reviews: [
            {
                type: Schema.Types.ObjectId,
                ref: "Review",
            },
        ],
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

// Delete associated reviews when a listing is deleted
listingSchema.post("findOneAndDelete", async (listing) => {
    if (listing) {
        await Review.deleteMany({ _id: { $in: listing.reviews } });
    }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;

