const express = require("express");
const { fetchAPI } = require("../apis/fetcher");
const router = express.Router();

const BASE_URL = "https://v2.jokeapi.dev/joke";

// GET /api/jokes  - random joke
router.get("/", async (req, res) => {
  const result = await fetchAPI(`${BASE_URL}/Any`, {
    blacklistFlags: "nsfw,racist,sexist",
  });

  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const d = result.data;
  const joke =
    d.type === "single"
      ? { type: "single", joke: d.joke }
      : { type: "twopart", setup: d.setup, delivery: d.delivery };

  res.json({ source: "JokeAPI", category: d.category, ...joke });
});

// GET /api/jokes/:category  - joke by category (Programming, Misc, Pun, Christmas)
router.get("/:category", async (req, res) => {
  const { category } = req.params;

  const result = await fetchAPI(`${BASE_URL}/${category}`, {
    blacklistFlags: "nsfw,racist,sexist",
    amount: 5,
  });

  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const jokes = (result.data.jokes || [result.data]).map((d) =>
    d.type === "single"
      ? { type: "single", joke: d.joke }
      : { type: "twopart", setup: d.setup, delivery: d.delivery }
  );

  res.json({ source: "JokeAPI", category, count: jokes.length, jokes });
});

module.exports = router;
