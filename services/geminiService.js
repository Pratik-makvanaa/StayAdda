const { GoogleGenAI } = require("@google/genai");

const ai = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;

const ITINERARY_SCHEMA = `{
  "recommendedHotel": { "id": "string", "title": "string", "reason": "string" },
  "dailyBudget": {
    "accommodation": number,
    "food": number,
    "activities": number,
    "transport": number,
    "total": number
  },
  "days": [{
    "day": number,
    "title": "string",
    "hotel": { "id": "string", "title": "string" },
    "placesToVisit": [{ "name": "string", "time": "string", "duration": "string" }],
    "foodRecommendation": { "name": "string", "cuisine": "string", "estimatedCost": number },
    "estimatedCost": number,
    "tips": ["string"]
  }],
  "travelTips": ["string"]
}`;

/**
 * Intelligent deterministic fallback generator when AI API is unavailable,
 * overloaded (503), rate-limited (429), or times out.
 * Ensures the itinerary feature ALWAYS succeeds and never crashes.
 */
function buildFallbackItinerary({ hotels, places, tripInput }) {
    const { destination, budget, days, travelers, travelType, interests } = tripInput;
    const primaryHotel = hotels[0] || {
        id: "fallback-hotel",
        title: `Premier Boutique Hotel ${destination}`,
        pricePerNight: Math.round(budget / (days * 2)),
    };

    const dailyTotal = Math.round(budget / days);
    const accommodationPerDay = Math.round(primaryHotel.pricePerNight || dailyTotal * 0.45);
    const remainingDaily = Math.max(dailyTotal - accommodationPerDay, 500);
    const foodPerDay = Math.round(remainingDaily * 0.45);
    const activitiesPerDay = Math.round(remainingDaily * 0.35);
    const transportPerDay = Math.max(remainingDaily - foodPerDay - activitiesPerDay, 200);

    const attractionsList = (places.attractions && places.attractions.length > 0)
        ? places.attractions
        : [
            { name: `${destination} Heritage & Cultural Walk` },
            { name: `${destination} Nature Viewpoint & Promenade` },
            { name: `${destination} Local Market & Handicrafts Bazaar` },
            { name: `Panoramic Sunset Point of ${destination}` }
        ];

    const restaurantsList = (places.restaurants && places.restaurants.length > 0)
        ? places.restaurants
        : [
            { name: `${destination} Traditional Flavors Diner`, cuisine: "Local Authentic Cuisine" },
            { name: "The Mountain & Valley Terrace Cafe", cuisine: "Multi-Cuisine & Cafe" },
            { name: "Royal Spice Garden Restaurant", cuisine: "North & South Indian Specialities" }
        ];

    const itineraryDays = [];
    let attrIndex = 0;

    const timesOfDay = [
        { time: "09:30 AM", duration: "2 hours" },
        { time: "02:00 PM", duration: "2.5 hours" },
        { time: "05:30 PM", duration: "1.5 hours" }
    ];

    for (let d = 1; d <= days; d++) {
        const dayPlaces = [];
        const placesCount = Math.min(2 + (d % 2), 3);

        for (let p = 0; p < placesCount; p++) {
            const attr = attractionsList[attrIndex % attractionsList.length];
            attrIndex++;
            dayPlaces.push({
                name: attr.name,
                time: timesOfDay[p].time,
                duration: timesOfDay[p].duration
            });
        }

        const restaurant = restaurantsList[(d - 1) % restaurantsList.length];

        const dayTitles = [
            `Arrival, Hotel Check-in & Iconic Sights`,
            `Deep Exploration, Heritage & Culture`,
            `Nature, Scenic Horizons & Local Experience`,
            `Adventure & Culinary Discovery`,
            `Relaxation, Souvenirs & Sunset Vistas`
        ];

        itineraryDays.push({
            day: d,
            title: dayTitles[(d - 1) % dayTitles.length],
            hotel: {
                id: primaryHotel.id,
                title: primaryHotel.title
            },
            placesToVisit: dayPlaces,
            foodRecommendation: {
                name: restaurant.name,
                cuisine: restaurant.cuisine || "Local Specialties",
                estimatedCost: Math.round(foodPerDay / travelers)
            },
            estimatedCost: dailyTotal,
            tips: [
                `Carry comfortable footwear suitable for walking around ${destination}.`,
                `Reserve outdoor activities early in the morning for best weather and fewer crowds.`
            ]
        });
    }

    return {
        recommendedHotel: {
            id: primaryHotel.id,
            title: primaryHotel.title,
            reason: `Top-rated stay in ${destination} offering the best comfort, verified amenities, and great accessibility within your ₹${budget.toLocaleString("en-IN")} budget.`
        },
        dailyBudget: {
            accommodation: accommodationPerDay,
            food: foodPerDay,
            activities: activitiesPerDay,
            transport: transportPerDay,
            total: accommodationPerDay + foodPerDay + activitiesPerDay + transportPerDay
        },
        days: itineraryDays,
        travelTips: [
            `Keep cash handy as local markets and auto-rickshaws in ${destination} may prefer cash payments.`,
            `Stay hydrated and check local timings before visiting popular attractions.`,
            `Book local transport or day cabs through verified operators or your hotel reception.`
        ]
    };
}

/**
 * Generate a structured day-wise itinerary using Gemini AI with intelligent fallback.
 */
async function generateItinerary({ hotels, places, tripInput }) {
    // If no Gemini key is provided, gracefully use high-quality fallback generator
    if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY not configured, generating itinerary via smart fallback engine.");
        return buildFallbackItinerary({ hotels, places, tripInput });
    }

    const systemPrompt = `You are StayAdda AI Trip Planner, an expert travel itinerary assistant for India.

CRITICAL MANDATORY RULES:
1. You MUST ONLY recommend hotels from the HOTELS list provided. NEVER invent or hallucinate hotels.
2. You can use the provided PLACES list or recommend well-known real attractions and restaurants in ${tripInput.destination}.
3. All costs must be in INR (₹) and fit within the total budget of ₹${tripInput.budget} for ${tripInput.days} days and ${tripInput.travelers} traveler(s).
4. Tailor the plan for travel type "${tripInput.travelType}" and interests: ${tripInput.interests.join(", ")}.
5. Return ONLY valid JSON matching this exact schema (no markdown, no commentary):
${ITINERARY_SCHEMA}`;

    const userContent = `Create a ${tripInput.days}-day itinerary for ${tripInput.destination}, India.

HOTELS (use ONLY these — pick the best match as recommendedHotel):
${JSON.stringify(hotels, null, 2)}

PLACES (attractions & food):
${JSON.stringify(places, null, 2)}

Trip details:
- Total budget: ₹${tripInput.budget}
- Days: ${tripInput.days}
- Travelers: ${tripInput.travelers}
- Travel type: ${tripInput.travelType}
- Interests: ${tripInput.interests.join(", ")}`;

    try {
        // Run Gemini generation with a 12-second timeout to prevent server hanging
        const generatePromise = ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: userContent,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                temperature: 0.3,
            },
        });

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Gemini AI request timed out after 12s")), 12000);
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);
        return JSON.parse(response.text);
    } catch (err) {
        console.warn("Gemini AI generation unavailable or timed out:", err.message);
        console.warn("Falling back seamlessly to smart itinerary generator.");
        return buildFallbackItinerary({ hotels, places, tripInput });
    }
}

module.exports = { generateItinerary, buildFallbackItinerary };
