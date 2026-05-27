const express = require("express");
const { fetchAPI } = require("../apis/fetcher");
const router = express.Router();

const BASE_URL = "https://newsapi.org/v2";

// GET /api/news/:topic
router.get("/:topic", async (req, res) => {
  const { topic } = req.params;
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey || apiKey === "your_key_here") {
    return res.status(400).json({ error: "NEWS_API_KEY not configured in .env" });
  }

  const result = await fetchAPI(`${BASE_URL}/everything`, {
    q: topic,
    apiKey,
    pageSize: 10,
    sortBy: "publishedAt",
    language: "en",
  });

  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const articles = result.data.articles.map((a) => ({
    title: a.title,
    source: a.source.name,
    author: a.author,
    description: a.description,
    url: a.url,
    publishedAt: a.publishedAt,
  }));

  res.json({ source: "NewsAPI", topic, totalResults: result.data.totalResults, articles });
});

module.exports = router;
