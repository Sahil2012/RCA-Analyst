const express = require("express");
const { fetchAPI } = require("../apis/fetcher");
const router = express.Router();

const BASE_URL = "https://openlibrary.org";

// GET /api/books/:query
router.get("/:query", async (req, res) => {
  const { query } = req.params;

  const result = await fetchAPI(`${BASE_URL}/search.json`, {
    q: query,
    limit: 10,
    fields: "title,author_name,first_publish_year,number_of_pages_median,subject,isbn,cover_i",
  });

  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const books = result.data.docs.map((b) => ({
    title: b.title,
    authors: b.author_name,
    first_published: b.first_publish_year,
    pages: b.number_of_pages_median,
    subjects: b.subject?.slice(0, 5),
    isbn: b.isbn?.[0],
    cover_url: b.cover_i
      ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`
      : null,
  }));

  res.json({
    source: "Open Library",
    query,
    totalResults: result.data.numFound,
    books,
  });
});

module.exports = router;
