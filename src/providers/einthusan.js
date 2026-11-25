/**
 * Einthusan Direct Provider for Nuvio
 * Powered by dedicated Oregon Cloud Relay
 */
var TMDB_KEY = "1b3113663c9004682ed61086cf967c44";
var TMDB_BASE = "https://api.themoviedb.org/3";
var RELAY_BASE = "https://einthusan-relay.onrender.com";

async function fetchMetadata(tmdbId, type) {
  try {
    var url = TMDB_BASE + "/" + (type === "movie" ? "movie" : "tv") + "/" + tmdbId + "?api_key=" + TMDB_KEY;
    var res = await fetch(url);
    var data = await res.json();
    return {
      title: data.title || data.name,
      year: (data.release_date || data.first_air_date || "").split("-")[0],
      lang: data.original_language || "ta"
    };
  } catch (e) {
    return null;
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  console.log("[Einthusan] Processing: " + tmdbId);
  try {
    var meta;
    if (/^\d+$/.test(tmdbId)) {
      meta = await fetchMetadata(tmdbId, mediaType);
    } else {
      meta = { title: tmdbId, year: null, lang: "ta" };
    }

    if (!meta || !meta.title) return [];

    var langMap = {
      ta: "tamil",
      te: "telugu",
      hi: "hindi",
      ml: "malayalam",
      kn: "kannada",
      mr: "marathi",
      pa: "punjabi",
      bn: "bengali"
    };
    var section = langMap[meta.lang] || "tamil";

    var reqUrl = RELAY_BASE + "/resolve?title=" + encodeURIComponent(meta.title) + "&lang=" + encodeURIComponent(section);
    console.log("[Einthusan] Calling Relay: " + reqUrl);

    var resp = await fetch(reqUrl);
    if (!resp.ok) {
      console.log("[Einthusan] Relay returned error: " + resp.status);
      return [];
    }

    var result = await resp.json();
    if (!result || !result.streamUrl) {
      console.log("[Einthusan] No streamUrl in response.");
      return [];
    }

    console.log("[Einthusan] Successfully resolved: " + result.streamUrl);

    return [{
      name: "Einthusan (Direct)",
      title: "Einthusan HD • 1080p [Direct HLS]",
      url: result.streamUrl,
      quality: "1080p",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://einthusan.tv/"
      },
      provider: "Einthusan"
    }];
  } catch (err) {
    console.log("[Einthusan] Error: " + err.message);
    return [];
  }
}

typeof module !== "undefined" && module.exports
  ? (module.exports = { getStreams: getStreams })
  : (global.getStreams = { getStreams: getStreams });
