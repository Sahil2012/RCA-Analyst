const express = require("express");
const { fetchAPI } = require("../apis/fetcher");
const router = express.Router();

const BASE_URL = "https://api.coingecko.com/api/v3";

// GET /api/crypto/top/:limit  - top N coins by market cap
router.get("/top/:limit", async (req, res) => {
  const limit = Math.min(parseInt(req.params.limit) || 10, 50);

  const result = await fetchAPI(`${BASE_URL}/coins/markets`, {
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: limit,
    page: 1,
  });

  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const coins = result.data.map((c) => ({
    rank: c.market_cap_rank,
    name: c.name,
    symbol: c.symbol.toUpperCase(),
    price_usd: c.current_price,
    market_cap: c.market_cap,
    change_24h: `${c.price_change_percentage_24h?.toFixed(2)}%`,
    volume_24h: c.total_volume,
  }));

  res.json({ source: "CoinGecko", count: coins.length, coins });
});

// GET /api/crypto/:coin  - single coin details
router.get("/:coin", async (req, res) => {
  const { coin } = req.params;

  const result = await fetchAPI(`${BASE_URL}/coins/${coin}`, {
    localization: false,
    tickers: false,
    market_data: true,
    community_data: false,
  });

  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  const d = result.data;
  res.json({
    source: "CoinGecko",
    id: d.id,
    name: d.name,
    symbol: d.symbol.toUpperCase(),
    description: d.description?.en?.slice(0, 300) + "...",
    price_usd: d.market_data?.current_price?.usd,
    market_cap_usd: d.market_data?.market_cap?.usd,
    ath_usd: d.market_data?.ath?.usd,
    change_24h: d.market_data?.price_change_percentage_24h,
    change_7d: d.market_data?.price_change_percentage_7d,
    homepage: d.links?.homepage?.[0],
  });
});

module.exports = router;
