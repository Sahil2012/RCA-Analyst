const express = require("express");
const { fetchAPI } = require("../apis/fetcher");
const router = express.Router();

// GET /api/exchange/:base/:target
router.get("/:base/:target", async (req, res) => {
  const { base, target } = req.params;
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;

  if (!apiKey || apiKey === "your_key_here") {
    // Fallback to free frankfurter API (no key needed)
    const result = await fetchAPI(`https://api.frankfurter.app/latest`, {
      from: base.toUpperCase(),
      to: target.toUpperCase(),
    });

    if (!result.success) return res.status(result.status || 500).json({ error: result.error });

    return res.json({
      source: "Frankfurter (ECB)",
      base: result.data.base,
      target: target.toUpperCase(),
      rate: result.data.rates[target.toUpperCase()],
      date: result.data.date,
    });
  }

  const result = await fetchAPI(
    `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${base.toUpperCase()}/${target.toUpperCase()}`
  );

  if (!result.success) return res.status(result.status || 500).json({ error: result.error });

  res.json({
    source: "ExchangeRate-API",
    base: result.data.base_code,
    target: result.data.target_code,
    rate: result.data.conversion_rate,
    last_updated: result.data.time_last_update_utc,
  });
});

module.exports = router;
