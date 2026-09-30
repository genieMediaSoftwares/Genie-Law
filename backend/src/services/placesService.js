const ApiError = require("../utils/AppError");
const { required, optional } = require("../config/env");

const REQUEST_TIMEOUT_MS = 8000;

const OSM_HEADERS = {
  "User-Agent": `GenieLaw/1.0 (legal consultation app; ${required("SUPPORT_EMAIL")})`,
  "Accept-Language": "en",
};

const PHOTON_PLACE_TAGS = [
  "place:city",
  "place:town",
  "place:village",
  "place:suburb",
  "place:municipality",
  "place:neighbourhood",
];

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

const cache = new Map();

const cacheGet = (key) => {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
};

const cacheSet = (key, value) => {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

const fetchJson = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });

    if (response.status === 429) {
      throw new ApiError("Place search is busy. Please try again in a moment.", 429);
    }
    if (!response.ok) {
      throw new ApiError("Place search is temporarily unavailable.", 502);
    }

    return await response.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === "AbortError") {
      throw new ApiError("Place search timed out. Please try again.", 504);
    }
    throw new ApiError("Could not reach the place search service.", 502);
  } finally {
    clearTimeout(timer);
  }
};

class PlacesService {
  get googleKey() {
    return optional("GOOGLE_PLACES_API_KEY") || null;
  }

  async autocomplete(input, { country = "in" } = {}) {
    const query = input.trim();
    if (query.length < 2) return [];

    const cacheKey = `auto:${country}:${query.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    let results;

    if (/^\d{3,6}$/.test(query)) {
      results = await this._pinCodeLookup(query);
    } else if (this.googleKey) {
      results = await this._googleAutocomplete(query, country);
    } else {
      results = await this._photonAutocomplete(query, country);
    }

    cacheSet(cacheKey, results);
    return results;
  }

  async details(placeId) {
    const cacheKey = `details:${placeId}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    if (placeId.startsWith("osm:") || placeId.startsWith("pin:")) {
      throw new ApiError(
        "That suggestion has expired. Please search again and reselect.",
        410
      );
    }

    if (!this.googleKey) {
      throw new ApiError("Place details are unavailable.", 503);
    }

    const details = await this._googleDetails(placeId);
    cacheSet(cacheKey, details);
    return details;
  }

  async _googleAutocomplete(query, country) {
    const url =
      "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
      `?input=${encodeURIComponent(query)}` +
      "&types=(cities)" +
      `&components=country:${encodeURIComponent(country)}` +
      `&key=${this.googleKey}`;

    const data = await fetchJson(url);

    if (data.status === "ZERO_RESULTS") return [];

    if (data.status === "OVER_QUERY_LIMIT") {
      throw new ApiError("Place search quota exceeded. Please try again later.", 429);
    }
    if (data.status === "REQUEST_DENIED" || data.status === "INVALID_REQUEST") {
      console.error(`Google Places autocomplete rejected: ${data.status} ${data.error_message || ""}`);
      throw new ApiError("Place search is misconfigured.", 502);
    }
    if (data.status !== "OK") {
      throw new ApiError("Place search is temporarily unavailable.", 502);
    }

    return (data.predictions || []).map((p) => ({
      description: p.description,
      placeId: p.place_id,
    }));
  }

  async _googleDetails(placeId) {
    const url =
      "https://maps.googleapis.com/maps/api/place/details/json" +
      `?place_id=${encodeURIComponent(placeId)}` +
      "&fields=name,formatted_address,geometry,address_component" +
      `&key=${this.googleKey}`;

    const data = await fetchJson(url);

    if (data.status === "NOT_FOUND" || data.status === "ZERO_RESULTS") {
      throw new ApiError("Place details not found.", 404);
    }
    if (data.status !== "OK" || !data.result) {
      throw new ApiError("Could not load place details.", 502);
    }

    const r = data.result;
    const component = (type) =>
      (r.address_components || []).find((c) => c.types.includes(type))?.long_name || "";

    const city =
      component("locality") ||
      component("administrative_area_level_3") ||
      r.name ||
      "";

    return {
      description: r.formatted_address || r.name || "",
      city,
      district: component("administrative_area_level_2") || city,
      state: component("administrative_area_level_1"),
      country: component("country"),
      latitude: r.geometry?.location?.lat ?? null,
      longitude: r.geometry?.location?.lng ?? null,
      placeId,
    };
  }

  async _photonAutocomplete(query, country) {
    const tags = PHOTON_PLACE_TAGS.map((t) => `&osm_tag=${encodeURIComponent(t)}`).join("");

    const url =
      "https://photon.komoot.io/api/" +
      `?q=${encodeURIComponent(query)}` +
      "&limit=20&lang=en" +
      tags;

    const data = await fetchJson(url, { headers: OSM_HEADERS });
    const features = Array.isArray(data?.features) ? data.features : [];

    const wanted = country.toUpperCase();
    const seen = new Set();
    const results = [];

    for (const feature of features) {
      const p = feature.properties || {};
      if (p.countrycode && p.countrycode.toUpperCase() !== wanted) continue;

      const city = p.name;
      if (!city) continue;

      const district = p.county || p.district || "";
      const state = p.state || "";

      const description = [city, district, state, p.country]
        .filter((part, index, all) => part && all.indexOf(part) === index)
        .join(", ");
      const dedupeKey = description.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const placeId = `osm:${p.osm_type || "N"}:${p.osm_id}`;

      const coords = Array.isArray(feature.geometry?.coordinates)
        ? feature.geometry.coordinates
        : null;

      cacheSet(`details:${placeId}`, {
        description,
        city,
        district: district || city,
        state,
        country: p.country || "",
        latitude: coords ? Number(coords[1]) : null,
        longitude: coords ? Number(coords[0]) : null,
        placeId,
      });

      results.push({ description, placeId });
      if (results.length >= 8) break;
    }

    return results;
  }

  async _pinCodeLookup(pin) {
    const data = await fetchJson(`https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`);

    const first = Array.isArray(data) ? data[0] : null;
    if (!first || first.Status !== "Success" || !Array.isArray(first.PostOffice)) {
      return [];
    }

    const seen = new Set();

    return first.PostOffice.reduce((out, office) => {
      const city = office.Name || "";
      const district = office.District || "";
      const state = office.State || "";
      if (!city) return out;

      const description = [city, district, state, office.Pincode]
        .filter(Boolean)
        .join(", ");
      if (seen.has(description)) return out;
      seen.add(description);

      const placeId = `pin:${office.Pincode}:${city}`;

      cacheSet(`details:${placeId}`, {
        description,
        city,
        district: district || city,
        state,
        country: office.Country || "India",
        latitude: null,
        longitude: null,
        placeId,
      });

      out.push({ description, placeId });
      return out;
    }, []);
  }
}

module.exports = new PlacesService();
