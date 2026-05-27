const express = require("express");
const { fetchAPI } = require("../apis/fetcher");
const router = express.Router();

const BASE_URL = "https://dog.ceo/api";

// GET /api/dogs/random
router.get("/random", async (req, res) => {
  const result = await fetchAPI(`${BASE_URL}/breeds/image/random`);
  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  res.json({
    source: "Dog CEO API",
    image_url: result.data.message,
    status: result.data.status,
  });
});

// GET /api/dogs/breeds
router.get("/breeds", async (req, res) => {
  const result = await fetchAPI(`${BASE_URL}/breeds/list/all`);
  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const breeds = Object.entries(result.data.message).map(([breed, subBreeds]) => ({
    breed,
    sub_breeds: subBreeds,
  }));

  res.json({ source: "Dog CEO API", total_breeds: breeds.length, breeds });
});

module.exports = router;
