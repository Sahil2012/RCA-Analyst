const express = require("express");
const { fetchAPI } = require("../apis/fetcher");
const router = express.Router();

const BASE_URL = "https://restcountries.com/v3.1";

// GET /api/countries/:name
router.get("/:name", async (req, res) => {
  const { name } = req.params;

  const result = await fetchAPI(`${BASE_URL}/name/${name}`);
  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const countries = result.data.map((c) => ({
    name: c.name.common,
    official_name: c.name.official,
    capital: c.capital?.[0],
    region: c.region,
    subregion: c.subregion,
    population: c.population,
    area_km2: c.area,
    currencies: Object.values(c.currencies || {}).map((cur) => cur.name),
    languages: Object.values(c.languages || {}),
    timezones: c.timezones,
    flag: c.flags?.png,
    maps: c.maps?.googleMaps,
  }));

  res.json({ source: "RestCountries", query: name, results: countries });
});

// GET /api/countries/region/:region
router.get("/region/:region", async (req, res) => {
  const { region } = req.params;

  const result = await fetchAPI(`${BASE_URL}/region/${region}`);
  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const countries = result.data.map((c) => ({
    name: c.name.common,
    capital: c.capital?.[0],
    population: c.population,
    flag: c.flags?.png,
  }));

  res.json({ source: "RestCountries", region, count: countries.length, countries });
});

module.exports = router;
