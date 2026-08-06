const Listing = require("../models/listing");
const placesService = require("./placesService");
const geminiService = require("./geminiService");

const TRAVEL_TYPE_MAP = {
    Solo: "Solo",
    Couple: "Couples",
    Family: "Family",
    Friends: "Friends",
};

/**
 * Query MongoDB for hotels matching destination, budget, and travel type.
 */
async function findMatchingHotels({ destination, budget, days, travelType }) {
    const perNightBudget = Math.floor(budget / days);
    const locRegex = new RegExp(destination.trim(), "i");

    const query = {
        $or: [
            { city: locRegex },
            { location: locRegex },
            { state: locRegex },
            { title: locRegex },
        ],
        price: { $lte: perNightBudget },
        availableRooms: { $gt: 0 },
    };

    const dbTravelType = TRAVEL_TYPE_MAP[travelType];
    if (dbTravelType) {
        query.travelType = dbTravelType;
    }

    let hotels = await Listing.find(query).limit(10).lean();

    if (hotels.length === 0 && dbTravelType) {
        delete query.travelType;
        hotels = await Listing.find(query).limit(10).lean();
    }

    if (hotels.length === 0) {
        delete query.price;
        hotels = await Listing.find(query).limit(10).lean();
    }

    return hotels;
}

/**
 * Resolve coordinates from matched hotels or geocode the destination.
 */
async function resolveCoordinates(hotels, destination) {
    const withCoords = hotels.filter((h) => h.coordinates?.lat && h.coordinates?.lng);
    if (withCoords.length > 0) {
        const avgLat = withCoords.reduce((s, h) => s + h.coordinates.lat, 0) / withCoords.length;
        const avgLng = withCoords.reduce((s, h) => s + h.coordinates.lng, 0) / withCoords.length;
        return { lat: avgLat, lng: avgLng };
    }
    return placesService.geocodeDestination(destination);
}

function cleanHotelData(hotels) {
    return hotels.map((h) => ({
        id: h._id.toString(),
        title: h.title,
        location: h.location,
        city: h.city,
        pricePerNight: h.price,
        description: h.description,
        category: h.category,
        amenities: h.amenities,
        coordinates: h.coordinates,
        nearbyAttractions: h.nearbyAttractions,
        imageUrl: h.image?.url || null,
    }));
}

/**
 * Main orchestrator — runs the full 6-step trip planning workflow.
 */
async function generateItinerary(tripInput) {
    const { destination, budget, days, travelers, travelType, interests } = tripInput;

    const hotels = await findMatchingHotels(tripInput);
    if (hotels.length === 0) {
        const err = new Error(
            `No hotels found in "${destination}" within your budget of ₹${budget.toLocaleString("en-IN")}. Try increasing your budget or choosing a different destination.`
        );
        err.code = "NO_HOTELS";
        throw err;
    }

    const coords = await resolveCoordinates(hotels, destination);

    let places = { attractions: [], restaurants: [], popular: [] };
    let warning = null;

    try {
        if (coords) {
            places = await placesService.fetchNearbyPlaces(coords, interests);
        } else {
            throw new Error("Could not resolve destination coordinates");
        }
    } catch (err) {
        console.warn("Places API fallback:", err.message);
        warning = "Limited place data — using hotel nearby attractions.";
        places = placesService.buildFallbackFromHotels(hotels);
    }

    if (places.attractions.length === 0 && places.restaurants.length === 0) {
        places = placesService.buildFallbackFromHotels(hotels);
        if (!warning) {
            warning = "Using hotel nearby attractions as place data.";
        }
    }

    const cleanHotels = cleanHotelData(hotels);

    const itinerary = await geminiService.generateItinerary({
        hotels: cleanHotels,
        places,
        tripInput: { destination, budget, days, travelers, travelType, interests },
    });

    return {
        itinerary,
        hotels: cleanHotels,
        places,
        warning,
    };
}

module.exports = { generateItinerary, findMatchingHotels };
