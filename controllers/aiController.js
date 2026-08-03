const aiService = require("../services/aiService.js");

/**
 * Controller to handle AI chat queries.
 * Maintains session-based conversation memory.
 */
module.exports.handleChat = async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== "string") {
            return res.status(400).json({
                success: false,
                reply: "Please enter a valid travel question or search prompt.",
                hotels: []
            });
        }

        // Retrieve existing session state memory or initialize empty state
        const currentSessionState = req.session.aiContext || {};

        // Process query with OpenAI & MongoDB grounding
        const result = await aiService.processAssistantQuery(prompt, currentSessionState);

        // Update session memory context with new filters
        req.session.aiContext = result.updatedState;

        return res.json({
            success: true,
            reply: result.reply,
            hotels: result.hotels,
            context: req.session.aiContext
        });

    } catch (err) {
        console.error("AI Controller Error:", err);
        return res.status(500).json({
            success: false,
            reply: "An internal server error occurred while processing your request.",
            hotels: []
        });
    }
};

/**
 * Controller to reset AI conversation memory session.
 */
module.exports.resetChat = (req, res) => {
    req.session.aiContext = {};
    return res.json({
        success: true,
        message: "AI conversation memory reset successfully."
    });
};
