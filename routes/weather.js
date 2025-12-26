const express = require('express')
const axios = require('axios')
const rateLimit = require('express-rate-limit')

const router = express.Router()
const WEATHER_API_KEY = process.env.WEATHER_API_KEY

//make sure we dont go over 1k requests per day
const weatherLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
})

const cache = new Map()
const TTL_MS = 10 * 60 * 1000 // 10 minutes

const roundCoord = (value) => Number.parseFloat(value).toFixed(2) 

router.get('/', weatherLimiter, async (req, res) => {
  const { lat, lon } = req.query

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon are required query params' })
  }

  if (!WEATHER_API_KEY) {
    return res.status(500).json({ error: 'Weather API not configured' })
  }

  const cacheKey = `${roundCoord(lat)},${roundCoord(lon)}`
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > now) {
    return res.json({ ...cached.data, cached: true })
  }

  try {
    const { data } = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        lat,
        lon,
        units: 'metric',
        appid: WEATHER_API_KEY
      }
    })

    const payload = {
      city: data.name,
      country: data.sys?.country,
      temp: data.main?.temp,
      feelsLike: data.main?.feels_like,
      humidity: data.main?.humidity,
      windSpeed: data.wind?.speed,
      description: data.weather?.[0]?.description,
      icon: data.weather?.[0]?.icon,
      timestamp: data.dt
    }

    cache.set(cacheKey, { data: payload, expires: now + TTL_MS })

    return res.json({ ...payload, cached: false })
  } catch (err) {
    const status = err.response?.status || 500
    const message = err.response?.data?.message || 'Failed to fetch weather'
    return res.status(status).json({ error: message })
  }
})

module.exports = router
