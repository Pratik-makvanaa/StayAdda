// test-ai.js (delete after testing)
require("dotenv").config();
const { extractFilters } = require("./utils/aiFilterExtractor");

extractFilters("I want a cheap place in Manali under 2000 for a couple")
  .then(console.log);