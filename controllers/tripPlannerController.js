const tripPlannerService = require("../services/tripPlannerService");

module.exports.showPlanner = (req, res) => {
    res.render("tripPlanner/planner", {
        travelTypes: ["Solo", "Couple", "Family", "Friends"],
        interests: [
            "Adventure", "Nature", "Food", "Beaches",
            "Heritage", "Shopping", "Nightlife",
        ],
    });
};

module.exports.generateItinerary = async (req, res) => {
    try {
        const result = await tripPlannerService.generateItinerary(req.validatedTripInput);

        return res.json({
            success: true,
            itinerary: result.itinerary,
            hotels: result.hotels,
            places: result.places,
            warning: result.warning || null,
        });
    } catch (err) {
        if (err.code === "NO_HOTELS") {
            return res.status(404).json({
                success: false,
                error: "NO_HOTELS",
                message: err.message,
            });
        }
        if (err.code === "GEMINI_FAILED") {
            return res.status(503).json({
                success: false,
                error: "GEMINI_FAILED",
                message: err.message,
            });
        }
        console.error("Trip planner error:", err);
        return res.status(500).json({
            success: false,
            error: "INTERNAL_ERROR",
            message: "Something went wrong while generating your itinerary.",
        });
    }
};
