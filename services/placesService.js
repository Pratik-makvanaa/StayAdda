const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";

const INTEREST_TYPE_MAP = {
    Adventure: ["amusement_park", "tourist_attraction"],
    Nature: ["park", "natural_feature"],
    Food: ["restaurant", "cafe"],
    Beaches: ["tourist_attraction"],
    Heritage: ["museum", "church", "hindu_temple", "place_of_worship"],
    Shopping: ["shopping_mall", "store"],
    Nightlife: ["night_club", "bar"],
};

function formatPlace(place) {
    return {
        name: place.name,
        address: place.vicinity || place.formatted_address || "",
        rating: place.rating || null,
        placeId: place.place_id || null,
    };
}

/**
 * Geocode a destination string to lat/lng using Google Geocoding API.
 */
async function geocodeDestination(destination) {
    if (!API_KEY) return null;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination + ", India")}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "OK" && data.results[0]) {
        return data.results[0].geometry.location;
    }
    return null;
}

/**
 * Nearby Search for a single place type.
 */
async function nearbySearch(lat, lng, type, keyword) {
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=10000&type=${type}&key=${API_KEY}`;
    if (keyword) {
        url += `&keyword=${encodeURIComponent(keyword)}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        throw new Error(`Places API error: ${data.status}`);
    }

    return (data.results || []).slice(0, 5).map(formatPlace);
}

/**
 * Fetch nearby attractions, restaurants, and popular places based on user interests.
 */
async function fetchNearbyPlaces(coords, interests = []) {
    if (!API_KEY) {
        throw new Error("Google Places API key not configured");
    }

    const { lat, lng } = coords;
    const attractions = [];
    const restaurants = [];
    const popular = [];
    const seen = new Set();

    const typesToFetch = new Set();
    for (const interest of interests) {
        const types = INTEREST_TYPE_MAP[interest] || ["tourist_attraction"];
        types.forEach((t) => typesToFetch.add(t));
    }
    if (typesToFetch.size === 0) {
        typesToFetch.add("tourist_attraction");
        typesToFetch.add("restaurant");
    }

    for (const type of typesToFetch) {
        const keyword = interests.includes("Beaches") && type === "tourist_attraction" ? "beach" : null;
        try {
            const results = await nearbySearch(lat, lng, type, keyword);
            for (const place of results) {
                if (seen.has(place.name)) continue;
                seen.add(place.name);

                if (["restaurant", "cafe", "bar", "night_club"].includes(type)) {
                    restaurants.push(place);
                } else {
                    attractions.push(place);
                }
                popular.push(place);
            }
        } catch (err) {
            console.error(`Places fetch error for type ${type}:`, err.message);
        }
    }

    return {
        attractions: attractions.slice(0, 15),
        restaurants: restaurants.slice(0, 10),
        popular: popular.slice(0, 20),
    };
}

/**
 * Build place data from hotel nearbyAttractions when Google Places is unavailable.
 */
function buildFallbackFromHotels(hotels) {
    const attractions = [];
    const seen = new Set();

    for (const hotel of hotels) {
        for (const attr of hotel.nearbyAttractions || []) {
            if (!seen.has(attr.name)) {
                seen.add(attr.name);
                attractions.push({
                    name: attr.name,
                    address: hotel.location || "",
                    rating: null,
                    placeId: null,
                    distance: attr.distance || null,
                });
            }
        }
    }

    return {
        attractions,
        restaurants: [],
        popular: attractions,
    };
}

module.exports = {
    geocodeDestination,
    fetchNearbyPlaces,
    buildFallbackFromHotels,
};
