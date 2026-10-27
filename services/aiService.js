const { GoogleGenAI } = require("@google/genai");
const Listing = require("../models/listing");

// Initialize Google Gemini AI client
const ai = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;

/**
 * Robust local fallback intent parser based on keyword and regex extraction.
 * Activates when AI API times out, fails, or is unavailable.
 */
function parseFallbackIntent(userPrompt, previousContext = {}) {
    const text = (userPrompt || "").toLowerCase();

    // 1. Budget extraction (e.g., "under 3000", "budget 5000", "₹4000", "2000 rs")
    let maxPrice = null;
    const priceMatch = userPrompt.match(/(?:under|below|less than|within|budget of?|max(?:imum)?)\s*(?:rs\.?|inr|₹)?\s*(\d+[\d,]*)/i)
        || userPrompt.match(/(?:rs\.?|inr|₹)\s*(\d+[\d,]*)/i)
        || userPrompt.match(/(\d+[\d,]*)\s*(?:rs|rupees|inr)/i);
    if (priceMatch && priceMatch[1]) {
        maxPrice = parseInt(priceMatch[1].replace(/,/g, ""), 10);
    }

    // 2. Travel type extraction
    let travelType = null;
    if (/\b(couple|honeymoon|romantic|partner)\b/i.test(text)) travelType = "Couples";
    else if (/\b(family|kids|children|parents)\b/i.test(text)) travelType = "Family";
    else if (/\b(solo|alone|myself)\b/i.test(text)) travelType = "Solo";
    else if (/\b(friends|buddies|group)\b/i.test(text)) travelType = "Friends";

    // 3. Amenities extraction
    const commonAmenities = ["pool", "swimming pool", "wifi", "parking", "breakfast", "mountain view", "beach", "lake view", "ac", "air conditioning", "balcony"];
    const amenities = [];
    for (const am of commonAmenities) {
        if (text.includes(am)) amenities.push(am);
    }

    // 4. Known destination matching
    const knownLocations = [
        "manali", "goa", "jaipur", "mumbai", "delhi", "udaipur", "shimla",
        "rishikesh", "kerala", "varanasi", "bangalore", "bengaluru", "kolkata",
        "chennai", "pune", "agra", "ooty", "darjeeling", "mussoorie", "nainital",
        "amritsar", "jodhpur", "jaisalmer", "leh", "ladakh", "lonavala", "pondicherry", "kochi"
    ];

    let location = null;
    for (const loc of knownLocations) {
        if (new RegExp(`\\b${loc}\\b`, "i").test(text)) {
            location = loc.charAt(0).toUpperCase() + loc.slice(1);
            break;
        }
    }

    if (!location) {
        const inMatch = userPrompt.match(/\b(?:in|at|around|near|visit|to)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i);
        if (inMatch && inMatch[1] && !["the", "a", "an", "my", "our", "hotel", "hotels", "stay", "stays", "resort", "room"].includes(inMatch[1].toLowerCase())) {
            location = inMatch[1].trim();
        }
    }

    return {
        location: location || previousContext.location || null,
        maxPrice: maxPrice !== null ? maxPrice : (previousContext.maxPrice || null),
        amenities: Array.from(new Set([...(previousContext.amenities || []), ...amenities])),
        guestCount: previousContext.guestCount || null,
        travelType: travelType || previousContext.travelType || null,
        intent: "search",
        hotelName: previousContext.hotelName || null
    };
}

/**
 * Parses user input to extract structured search filters and intent.
 * Combines current prompt with existing session memory context using Google Gemini.
 */
async function parseUserIntent(userPrompt, previousContext = {}) {
    if (!ai) {
        return parseFallbackIntent(userPrompt, previousContext);
    }

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
        const generatePromise = ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                temperature: 0.1,
            }
        });

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Intent parsing timed out")), 6000);
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);
        const parsed = JSON.parse(response.text);
        
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
        console.warn("Using fallback intent parser:", err.message);
        return parseFallbackIntent(userPrompt, previousContext);
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
 * Main process Assistant function - combines parser, MongoDB lookup, and grounded response synthesis.
 */
async function processAssistantQuery(userPrompt, sessionState = {}) {
    if (!userPrompt || typeof userPrompt !== "string" || !userPrompt.trim()) {
        return {
            reply: "Please provide a valid query about hotels or travel recommendations.",
            updatedState: sessionState,
            hotels: []
        };
    }

    // Step 1: Parse intent and update state memory (with local keyword fallback)
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
            : "4.5";
        
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

    // Step 3: Grounded Gemini Response Generation with intelligent fallback
    if (ai) {
        const systemPrompt = `You are "StayAdda AI Travel Consultant", an expert, helpful, and courteous travel assistant for the StayAdda platform powered by Google Gemini.

CRITICAL MANDATORY RULES:
1. Grounding: You MUST ONLY recommend and answer questions about the hotels provided in the "GROUND TRUTH HOTELS FROM DATABASE" section below. NEVER fabricate, invent, or hallucinate hotels not listed in the database context.
2. If NO hotels are listed in the context, politely inform the user that no matching properties were found in MongoDB for their current criteria, and suggest modifying budget or location.
3. For Recommendations, provide a clean, structured response:
   - Explain WHY the hotel matches their request.
   - List key ADVANTAGES (e.g. price value, location, amenities, atmosphere).
   - Note POSSIBLE LIMITATIONS (e.g., check description/price constraints, budget trade-offs).
4. Tone: Warm, professional, helpful, formatted nicely with Markdown (bolding, bullet points).

CURRENT ACTIVE USER PREFERENCES MEMORY:
${JSON.stringify(updatedState, null, 2)}

GROUND TRUTH HOTELS FROM DATABASE:
${JSON.stringify(cleanHotelsContext, null, 2)}`;

        try {
            const generatePromise = ai.models.generateContent({
                model: "gemini-3.8-flash",
                contents: userPrompt,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.4,
                }
            });

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("AI response generation timed out")), 8000);
            });

            const response = await Promise.race([generatePromise, timeoutPromise]);
            return {
                reply: response.text,
                updatedState,
                hotels: cleanHotelsContext
            };
        } catch (err) {
            console.warn("Gemini AI Response Generation fallback:", err.message);
        }
    }

    // High quality deterministic fallback response
    let reply = "";
    if (cleanHotelsContext.length > 0) {
        const dest = updatedState.location ? `in **${updatedState.location}**` : "matching your preferences";
        const budgetNote = updatedState.maxPrice ? ` within ₹${updatedState.maxPrice.toLocaleString("en-IN")}` : "";
        reply = `I found **${cleanHotelsContext.length} great verified stays** ${dest}${budgetNote}:\n\n` +
            cleanHotelsContext.slice(0, 4).map((h, i) => 
                `**${i + 1}. ${h.title}** (${h.location})\n` +
                `• **Price:** ₹${Number(h.pricePerNight).toLocaleString("en-IN")} / night\n` +
                `• **Rating:** ⭐ ${h.avgRating} (${h.reviewCount} reviews)\n` +
                (h.description ? `• **Highlights:** ${h.description.slice(0, 110)}...\n` : "")
            ).join("\n") +
            `\n*Click on any card below to view details and book your stay!*`;
    } else {
        reply = `I couldn't find any stays directly matching **${updatedState.location || "your search"}** with your current filters. Try increasing your budget or checking popular destinations like **Goa, Manali, Jaipur, or Mumbai**!`;
    }

    return {
        reply,
        updatedState,
        hotels: cleanHotelsContext
    };
}

module.exports = {
    processAssistantQuery,
    parseUserIntent,
    fetchMatchingListings
};
