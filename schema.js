const Joi = require('joi');

const listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        location: Joi.string().required(),
        country: Joi.string().required(),
        price: Joi.number().required().min(0),
        image: Joi.string().allow("", null),
        city: Joi.string().allow("", null),
        state: Joi.string().allow("", null),
        category: Joi.string().valid("Luxury", "Villa", "Resort", "Heritage", "Budget", "Boutique", "Beachfront", "Mountain").allow("", null),
        rating: Joi.number().min(0).max(5).allow(null),
        amenities: Joi.array().items(Joi.string()).allow(null),
        availableRooms: Joi.number().min(0).allow(null),
    }).required()
});

const reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().required(),
        title: Joi.string().allow("", null),
    }).required(),
});

const TRAVEL_TYPES = ["Solo", "Couple", "Family", "Friends"];
const INTERESTS = [
    "Adventure", "Nature", "Food", "Beaches",
    "Heritage", "Shopping", "Nightlife"
];

const tripPlannerSchema = Joi.object({
    destination: Joi.string().trim().min(2).max(100).required()
        .messages({ "any.required": "Destination is required" }),
    budget: Joi.number().integer().min(1000).max(10000000).required()
        .messages({ "any.required": "Budget is required" }),
    days: Joi.number().integer().min(1).max(14).required()
        .messages({ "any.required": "Number of days is required" }),
    travelers: Joi.number().integer().min(1).max(20).required()
        .messages({ "any.required": "Number of travelers is required" }),
    travelType: Joi.string().valid(...TRAVEL_TYPES).required()
        .messages({ "any.required": "Travel type is required" }),
    interests: Joi.array().items(Joi.string().valid(...INTERESTS)).min(1).required()
        .messages({ "any.required": "Select at least one interest" }),
});

module.exports = { listingSchema, reviewSchema, tripPlannerSchema, TRAVEL_TYPES, INTERESTS };
