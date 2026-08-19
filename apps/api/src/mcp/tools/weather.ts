/**
 * Current weather for a named city, via Open-Meteo — chosen because it is
 * free, keyless and CORS-friendly, which makes it safe for an unattended
 * public demo: there is no API key to leak and no bill for a scraper to
 * run up. Rate limiting for OUR endpoint is handled by the app-wide
 * throttler; this module just needs to fail fast and clearly.
 */

export interface WeatherResult {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  windSpeedKmh: number;
  relativeHumidityPercent: number;
  description: string;
}

/** WMO weather interpretation codes, abridged to what a demo answer needs. */
const WEATHER_CODES: Record<number, string> = {
  0: 'clear sky',
  1: 'mainly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'depositing rime fog',
  51: 'light drizzle',
  53: 'moderate drizzle',
  55: 'dense drizzle',
  61: 'slight rain',
  63: 'moderate rain',
  65: 'heavy rain',
  71: 'slight snow',
  73: 'moderate snow',
  75: 'heavy snow',
  80: 'slight rain showers',
  81: 'moderate rain showers',
  82: 'violent rain showers',
  95: 'thunderstorm',
  96: 'thunderstorm with slight hail',
  99: 'thunderstorm with heavy hail',
};

export class WeatherError extends Error {}

export async function fetchCurrentWeather(
  city: string,
): Promise<WeatherResult> {
  const geoRes = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
  );
  const geo = geoRes as {
    results?: {
      name: string;
      country: string;
      latitude: number;
      longitude: number;
    }[];
  };
  const place = geo.results?.[0];
  if (!place) {
    throw new WeatherError(`No location found for "${city}".`);
  }

  const forecastRes = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`,
  );
  const forecast = forecastRes as {
    current?: {
      temperature_2m: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      weather_code: number;
    };
  };
  if (!forecast.current) {
    throw new WeatherError(`No current weather available for "${city}".`);
  }

  return {
    city: place.name,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    temperatureC: forecast.current.temperature_2m,
    windSpeedKmh: forecast.current.wind_speed_10m,
    relativeHumidityPercent: forecast.current.relative_humidity_2m,
    description:
      WEATHER_CODES[forecast.current.weather_code] ??
      `weather code ${forecast.current.weather_code}`,
  };
}

async function fetchJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw new WeatherError(
      `Weather service unreachable: ${(err as Error).message}`,
    );
  }
  if (!res.ok) {
    throw new WeatherError(`Weather service returned ${res.status}.`);
  }
  return res.json();
}
