const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
});

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
 * Generate a structured day-wise itinerary using Gemini.
 * Only uses hotels and places provided — never invents data.
 */
async function generateItinerary({ hotels, places, tripInput }) {
    if (!process.env.GEMINI_API_KEY) {
        const err = new Error("Gemini API key not configured");
        err.code = "GEMINI_FAILED";
        throw err;
    }

    const systemPrompt = `You are StayAdda AI Trip Planner, an expert travel itinerary assistant for India.

CRITICAL MANDATORY RULES:
1. You MUST ONLY recommend hotels from the HOTELS list provided. NEVER invent or hallucinate hotels.
2. You MUST ONLY suggest attractions and restaurants from the PLACES list provided. NEVER invent places.
3. If there are fewer places than days, reuse places across days or suggest leisure time at the hotel — do NOT invent new places.
4. All costs must be in INR (₹) and fit within the total budget of ₹${tripInput.budget} for ${tripInput.days} days and ${tripInput.travelers} traveler(s).
5. Tailor the plan for travel type "${tripInput.travelType}" and interests: ${tripInput.interests.join(", ")}.
6. Return ONLY valid JSON matching this exact schema (no markdown, no commentary):
${ITINERARY_SCHEMA}`;

    const userContent = `Create a ${tripInput.days}-day itinerary for ${tripInput.destination}, India.

HOTELS (use ONLY these — pick the best match as recommendedHotel):
${JSON.stringify(hotels, null, 2)}

PLACES (use ONLY these for attractions and food recommendations):
${JSON.stringify(places, null, 2)}

Trip details:
- Total budget: ₹${tripInput.budget}
- Days: ${tripInput.days}
- Travelers: ${tripInput.travelers}
- Travel type: ${tripInput.travelType}
- Interests: ${tripInput.interests.join(", ")}`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: userContent,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                temperature: 0.3,
            },
        });

        return JSON.parse(response.text);
    } catch (err) {
        console.error("Gemini itinerary error:", err.message);

        let message = "Failed to generate itinerary via Gemini AI. Please try again.";
        if (err.message && err.message.includes("429")) {
            message = "Gemini rate limit reached. Please wait a moment and try again.";
        } else if (err.message && err.message.includes("API key")) {
            message = "Gemini API key authentication failed. Check GEMINI_API_KEY in environment settings.";
        }

        const error = new Error(message);
        error.code = "GEMINI_FAILED";
        throw error;
    }
}

module.exports = { generateItinerary };
