const express = require("express");
const { fetchAPI } = require("../apis/fetcher");
const router = express.Router();

const BASE_URL = "https://api.themoviedb.org/3";

// GET /api/movies/popular
router.get("/popular", async (req, res) => {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey || apiKey === "your_key_here") {
    return res.status(400).json({ error: "TMDB_API_KEY not configured in .env" });
  }

  const result = await fetchAPI(`${BASE_URL}/movie/popular`, { api_key: apiKey });
  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const movies = result.data.results.map((m) => ({
    id: m.id,
    title: m.title,
    overview: m.overview,
    release_date: m.release_date,
    rating: m.vote_average,
    vote_count: m.vote_count,
    poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
  }));

  res.json({ source: "TheMovieDB", page: result.data.page, movies });
});

// GET /api/movies/search/:query
router.get("/search/:query", async (req, res) => {
  const { query } = req.params;
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey || apiKey === "your_key_here") {
    return res.status(400).json({ error: "TMDB_API_KEY not configured in .env" });
  }

  const result = await fetchAPI(`${BASE_URL}/search/movie`, {
    api_key: apiKey,
    query,
  });

  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const movies = result.data.results.map((m) => ({
    id: m.id,
    title: m.title,
    overview: m.overview,
    release_date: m.release_date,
    rating: m.vote_average,
    poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
  }));

  res.json({ source: "TheMovieDB", query, totalResults: result.data.total_results, movies });
});

module.exports = router;
