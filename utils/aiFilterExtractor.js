const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

/**
 * Converts a natural language travel query into a structured filter object
 * that matches our Listing schema fields ONLY using Google Gemini.
 * Never returns hotel data itself — only search filters.
 */
async function extractFilters(userMessage) {
  const systemPrompt = `
You are a filter-extraction engine for a hotel booking site called StayAdda.

Your ONLY job is to read the user's message and extract search filters as JSON.
You are NOT allowed to answer questions, recommend hotels, or generate any hotel names.
You must respond with JSON only — no explanation, no extra text.

Allowed fields (use ONLY these, omit any field not mentioned by the user):
- "location": string (city or area name, e.g. "Manali")
- "country": string (country name, e.g. "India")
- "minPrice": number
- "maxPrice": number
- "keyword": string (any other useful search term, e.g. "beach", "mountain view")

If the user does not mention a field, do not include it in the JSON.
If the message is not related to travel/hotel search at all, return {}.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0,
      }
    });

    return JSON.parse(response.text);
  } catch (err) {
    console.error("Failed to parse Gemini AI filter JSON:", err.message);
    return {};
  }
}

module.exports = { extractFilters };