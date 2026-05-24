# Open API Aggregator Service

A Node.js + Express service that aggregates data from **10+ open source APIs** in one place.

---

## APIs Used

| # | API | Key Required | Endpoints |
|---|-----|-------------|-----------|
| 1 | [OpenWeatherMap](https://openweathermap.org/api) | ✅ Free | `/api/weather/:city` |
| 2 | [NewsAPI](https://newsapi.org) | ✅ Free | `/api/news/:topic` |
| 3 | [CoinGecko](https://www.coingecko.com/en/api) | ❌ None | `/api/crypto/:coin`, `/api/crypto/top/:limit` |
| 4 | [RestCountries](https://restcountries.com) | ❌ None | `/api/countries/:name`, `/api/countries/region/:region` |
| 5 | [Open Library](https://openlibrary.org/developers) | ❌ None | `/api/books/:query` |
| 6 | [JokeAPI](https://jokeapi.dev) | ❌ None | `/api/jokes`, `/api/jokes/:category` |
| 7 | [Dog CEO API](https://dog.ceo/dog-api) | ❌ None | `/api/dogs/random`, `/api/dogs/breeds` |
| 8 | [NASA APOD](https://api.nasa.gov) | ✅ Free (DEMO_KEY) | `/api/nasa/apod` |
| 9 | [TheMovieDB](https://www.themoviedb.org/settings/api) | ✅ Free | `/api/movies/popular`, `/api/movies/search/:query` |
| 10 | [Frankfurter / ExchangeRate-API](https://www.frankfurter.app) | ❌ None | `/api/exchange/:base/:target` |

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Start the server
```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

---

## API Endpoints

### 🌤 Weather
```
GET /api/weather/London
GET /api/weather/Mumbai
```

### 📰 News
```
GET /api/news/technology
GET /api/news/sports
```

### 💰 Crypto
```
GET /api/crypto/bitcoin
GET /api/crypto/ethereum
GET /api/crypto/top/10
```

### 🌍 Countries
```
GET /api/countries/India
GET /api/countries/region/Asia
```

### 📚 Books
```
GET /api/books/harry+potter
GET /api/books/javascript
```

### 😂 Jokes
```
GET /api/jokes
GET /api/jokes/Programming
GET /api/jokes/Pun
```

### 🐶 Dogs
```
GET /api/dogs/random
GET /api/dogs/breeds
```

### 🚀 NASA
```
GET /api/nasa/apod
```

### 🎬 Movies
```
GET /api/movies/popular
GET /api/movies/search/Inception
```

### 💱 Exchange Rates
```
GET /api/exchange/USD/INR
GET /api/exchange/EUR/GBP
```

---

## Free API Keys (5 min setup)

1. **OpenWeatherMap** → https://home.openweathermap.org/users/sign_up
2. **NewsAPI** → https://newsapi.org/register
3. **NASA** → Use `DEMO_KEY` (already set) or register at https://api.nasa.gov
4. **TMDB** → https://www.themoviedb.org/signup

APIs 3, 4, 5, 6, 7, and 10 work with **no key** out of the box!
