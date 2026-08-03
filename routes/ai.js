const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController.js");

// POST /ai/chat - Process user message & return grounded AI response
router.post("/chat", aiController.handleChat);

// POST /ai/reset - Reset session-based AI conversation memory
router.post("/reset", aiController.resetChat);

module.exports = router;
