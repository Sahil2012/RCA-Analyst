const express = require("express");
const { fetchAPI } = require("../apis/fetcher");
const router = express.Router();

const BASE_URL = "https://api.openweathermap.org/data/2.5";

// GET /api/weather/:city
router.get("/:city", async (req, res) => {
  const { city } = req.params;
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey || apiKey === "your_key_here") {
    return res.status(400).json({ error: "OPENWEATHER_API_KEY not configured in .env" });
  }

  const result = await fetchAPI(`${BASE_URL}/weather`, {
    q: city,
    appid: apiKey,
    units: "metric",
  });

  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const d = result.data;
  res.json({
    source: "OpenWeatherMap",
    city: d.name,
    country: d.sys.country,
    temperature: `${d.main.temp}°C`,
    feels_like: `${d.main.feels_like}°C`,
    humidity: `${d.main.humidity}%`,
    condition: d.weather[0].description,
    wind_speed: `${d.wind.speed} m/s`,
    visibility: d.visibility,
  });
});

module.exports = router;
