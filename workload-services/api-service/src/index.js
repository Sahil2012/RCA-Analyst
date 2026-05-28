require("dotenv").config();
const express = require("express");
const cors = require("cors");
const logger = require("./logger");

const weatherRoutes = require("./routes/weather");
const newsRoutes = require("./routes/news");
const cryptoRoutes = require("./routes/crypto");
const countriesRoutes = require("./routes/countries");
const booksRoutes = require("./routes/books");
const jokesRoutes = require("./routes/jokes");
const dogsRoutes = require("./routes/dogs");
const nasaRoutes = require("./routes/nasa");
const moviesRoutes = require("./routes/movies");
const exchangeRoutes = require("./routes/exchange");
const testRoutes     = require("./routes/test");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(logger.requestLogger);

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Open API Aggregator Service",
    version: "1.0.0",
    endpoints: [
      "/api/weather/:city",
      "/api/news/:topic",
      "/api/crypto/:coin",
      "/api/crypto/top/:limit",
      "/api/countries/:name",
      "/api/countries/region/:region",
      "/api/books/:query",
      "/api/jokes",
      "/api/jokes/:category",
      "/api/dogs/random",
      "/api/dogs/breeds",
      "/api/nasa/apod",
      "/api/movies/popular",
      "/api/movies/search/:query",
      "/api/exchange/:base/:target",
    ],
  });
});

// Mount routes
app.use("/api/weather", weatherRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/crypto", cryptoRoutes);
app.use("/api/countries", countriesRoutes);
app.use("/api/books", booksRoutes);
app.use("/api/jokes", jokesRoutes);
app.use("/api/dogs", dogsRoutes);
app.use("/api/nasa", nasaRoutes);
app.use("/api/movies", moviesRoutes);
app.use("/api/exchange", exchangeRoutes);
app.use("/api/test",    testRoutes);

// Global error handler
app.use((err, req, res, next) => {
  logger.error("Global Error", { message: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

app.listen(PORT, () => {
  logger.info("API Aggregator Service started", { port: PORT });
  logger.info(`Visit http://localhost:${PORT} to see all endpoints`);
});
