require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

if (!process.env.GEMINI_API_KEY) {
  console.log("GEMINI_API_KEY .env mein missing hai.");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function checkGemini() {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: "Reply with exactly: Gemini API is working.",
    });

    console.log("Success — Gemini API is working.");
    console.log(result.text);
  } catch (error) {
    console.log("Gemini API request failed.");
    console.log("Status:", error.status || error.code || "unknown");
    console.log("Message:", error.message);
  }
}

checkGemini();