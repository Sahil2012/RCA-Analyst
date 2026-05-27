const express = require("express");
const { fetchAPI } = require("../apis/fetcher");
const router = express.Router();

const BASE_URL = "https://api.nasa.gov";

// GET /api/nasa/apod  - Astronomy Picture of the Day
router.get("/apod", async (req, res) => {
  const apiKey = process.env.NASA_API_KEY || "DEMO_KEY";

  const result = await fetchAPI(`${BASE_URL}/planetary/apod`, {
    api_key: apiKey,
  });

  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const d = result.data;
  res.json({
    source: "NASA APOD",
    title: d.title,
    date: d.date,
    explanation: d.explanation,
    media_type: d.media_type,
    url: d.url,
    hdurl: d.hdurl,
    copyright: d.copyright,
  });
});

module.exports = router;
