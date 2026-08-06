const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { validateTripPlanner } = require("../middleware");
const tripPlannerController = require("../controllers/tripPlannerController");

router.get("/", tripPlannerController.showPlanner);
router.post("/generate", validateTripPlanner, wrapAsync(tripPlannerController.generateItinerary));

module.exports = router;
