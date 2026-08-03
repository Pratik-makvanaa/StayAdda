const { GoogleGenAI } = require("@google/genai");
const Listing = require("../models/listing");

// Initialize Google Gemini AI client
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
});

/**
 * Parses user input to extract structured search filters and intent.
 * Combines current prompt with existing session memory context using Google Gemini.
 */
async function parseUserIntent(userPrompt, previousContext = {}) {
    const systemPrompt = `You are a travel query parsing assistant for StayAdda hotel booking system.
Your job is to extract search parameters and intent from a user's prompt, while maintaining past context.

Past Context Memory: ${JSON.stringify(previousContext)}

Extract the following JSON structure:
{
    "location": string or null (city/state/region. If user mentions a new location, update it. If not, preserve past location if relevant),
    "maxPrice": number or null (budget threshold in INR/rupees),
    "amenities": array of strings (e.g., ["swimming pool", "wifi", "parking", "breakfast", "mountain view"]),
    "guestCount": number or null,
    "travelType": string or null (e.g., "honeymoon", "family", "solo", "business", "friends"),
    "intent": string ("search" | "details_qa" | "trip_suggestion" | "general_chat"),
    "hotelName": string or null (if the user refers to a specific hotel name)
}

Return ONLY raw valid JSON. Do not include markdown code blocks or additional commentary.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                temperature: 0.1,
            }
        });

        const parsed = JSON.parse(response.text);
        
        // Merge with previous context if new value isn't explicitly provided
        return {
            location: parsed.location || previousContext.location || null,
            maxPrice: parsed.maxPrice !== undefined && parsed.maxPrice !== null ? parsed.maxPrice : (previousContext.maxPrice || null),
            amenities: Array.from(new Set([...(previousContext.amenities || []), ...(parsed.amenities || [])])),
            guestCount: parsed.guestCount || previousContext.guestCount || null,
            travelType: parsed.travelType || previousContext.travelType || null,
            intent: parsed.intent || "search",
            hotelName: parsed.hotelName || previousContext.hotelName || null
        };
    } catch (err) {
        console.error("Gemini Intent Parsing Error:", err.message);
        return {
            location: previousContext.location || null,
            maxPrice: previousContext.maxPrice || null,
            amenities: previousContext.amenities || [],
            guestCount: previousContext.guestCount || null,
            travelType: previousContext.travelType || null,
            intent: "search",
            hotelName: null
        };
    }
}

/**
 * Fetches real grounded hotel data from MongoDB based on extracted criteria.
 */
async function fetchMatchingListings(criteria) {
    const mongoQuery = {};

    // Location search (regex across location, country, title, description)
    if (criteria.location) {
        const locRegex = new RegExp(criteria.location, "i");
        mongoQuery.$or = [
            { location: locRegex },
            { country: locRegex },
            { title: locRegex },
            { description: locRegex }
        ];
    }

    // Price / Budget filter
    if (criteria.maxPrice && !isNaN(criteria.maxPrice)) {
        mongoQuery.price = { $lte: Number(criteria.maxPrice) };
    }

    // Amenities and travel type regex matching in description or title
    const searchTerms = [...(criteria.amenities || [])];
    if (criteria.travelType) searchTerms.push(criteria.travelType);

    if (searchTerms.length > 0) {
        const termConditions = searchTerms.map(term => {
            const regex = new RegExp(term, "i");
            return {
                $or: [
                    { title: regex },
                    { description: regex }
                ]
            };
        });
        
        if (mongoQuery.$or) {
            mongoQuery.$and = termConditions;
        } else {
            mongoQuery.$or = termConditions.flatMap(c => c.$or);
        }
    }

    try {
        let listings = await Listing.find(mongoQuery).populate({
            path: "reviews",
            select: "rating comment"
        }).limit(8).lean();

        // Fallback: If strict query yielded 0 results, relax criteria to location only to ensure we find real candidates
        if (listings.length === 0 && criteria.location) {
            listings = await Listing.find({
                $or: [
                    { location: new RegExp(criteria.location, "i") },
                    { country: new RegExp(criteria.location, "i") },
                    { title: new RegExp(criteria.location, "i") }
                ]
            }).populate({
                path: "reviews",
                select: "rating comment"
            }).limit(5).lean();
        }

        return listings;
    } catch (err) {
        console.error("MongoDB Listing Query Error:", err.message);
        return [];
    }
}

/**
 * Main process Assistant function - combines parser, MongoDB lookup, and grounded response synthesis using Gemini.
 */
async function processAssistantQuery(userPrompt, sessionState = {}) {
    if (!userPrompt || typeof userPrompt !== "string" || !userPrompt.trim()) {
        return {
            reply: "Please provide a valid query about hotels or travel recommendations.",
            updatedState: sessionState,
            hotels: []
        };
    }

    if (!process.env.GEMINI_API_KEY) {
        return {
            reply: "The AI Assistant is currently offline due to missing GEMINI_API_KEY configuration in environment variables. Please contact administrator.",
            updatedState: sessionState,
            hotels: []
        };
    }

    // Step 1: Parse intent and update state memory via Gemini
    const updatedState = await parseUserIntent(userPrompt, sessionState);

    // Step 2: Fetch ground-truth MongoDB listings
    let matchedListings = [];
    if (updatedState.hotelName) {
        matchedListings = await Listing.find({ title: new RegExp(updatedState.hotelName, "i") })
            .populate("reviews")
            .lean();
    }
    if (matchedListings.length === 0) {
        matchedListings = await fetchMatchingListings(updatedState);
    }

    // Clean MongoDB listings data to pass to LLM context
    const cleanHotelsContext = matchedListings.map(h => {
        const avgRating = h.reviews && h.reviews.length > 0 
            ? (h.reviews.reduce((acc, r) => acc + r.rating, 0) / h.reviews.length).toFixed(1)
            : "No ratings yet";
        
        return {
            id: h._id.toString(),
            title: h.title,
            location: h.location,
            country: h.country,
            pricePerNight: h.price,
            description: h.description,
            avgRating: avgRating,
            reviewCount: h.reviews ? h.reviews.length : 0,
            imageUrl: h.image ? h.image.url : null
        };
    });

    // Step 3: Grounded Gemini Response Generation
    const systemPrompt = `You are "StayAdda AI Travel Consultant", an expert, helpful, and courteous travel assistant for the StayAdda platform powered by Google Gemini.

CRITICAL MANDATORY RULES:
1. Grounding: You MUST ONLY recommend and answer questions about the hotels provided in the "GROUND TRUTH HOTELS FROM DATABASE" section below. NEVER fabricate, invent, or hallucinate hotels not listed in the database context.
2. If NO hotels are listed in the context, politely inform the user that no matching properties were found in MongoDB for their current criteria, and suggest modifying budget or location.
3. For Recommendations, provide a clean, structured response:
   - Explain WHY the hotel matches their request.
   - List key ADVANTAGES (e.g. price value, location, amenities, atmosphere).
   - Note POSSIBLE LIMITATIONS (e.g., check description/price constraints, budget trade-offs).
4. For Q&A (parking, breakfast, family friendliness, etc.): Answer accurately based solely on the description and reviews of the retrieved hotels.
5. For Trip Suggestions: If asked about itineraries or nearby attractions, give a tailored plan based on the destination city and mention that for live route guidance/maps, external APIs like Google Maps / Google Places API can be integrated.
6. Tone: Warm, professional, helpful, formatted nicely with Markdown (bolding, bullet points).

CURRENT ACTIVE USER PREFERENCES MEMORY:
${JSON.stringify(updatedState, null, 2)}

GROUND TRUTH HOTELS FROM DATABASE:
${JSON.stringify(cleanHotelsContext, null, 2)}`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.4,
            }
        });

        const reply = response.text;

        return {
            reply,
            updatedState,
            hotels: cleanHotelsContext
        };
    } catch (err) {
        console.error("Gemini AI Response Generation Error:", err.message);
        
        let errorMessage = "Sorry, I encountered an issue processing your request via Gemini AI. Please try again.";
        if (err.message && err.message.includes('429')) {
            errorMessage = "Google Gemini rate limit reached. Please wait a moment and try again.";
        } else if (err.message && err.message.includes('API key')) {
            errorMessage = "Google Gemini API key authentication failed. Please check GEMINI_API_KEY in environment settings.";
        }

        return {
            reply: errorMessage,
            updatedState,
            hotels: cleanHotelsContext
        };
    }
}

module.exports = {
    processAssistantQuery,
    parseUserIntent,
    fetchMatchingListings
};
