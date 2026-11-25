/**
 * Einthusan Direct Provider for Nuvio
 */
var cheerio = require("cheerio-without-node-native");
var TMDB_KEY = "1b3113663c9004682ed61086cf967c44";
var TMDB_BASE = "https://api.themoviedb.org/3";
var BASE_URL = "https://einthusan.tv";

var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://einthusan.tv/"
};

// Fast CORS mirrors that handle Einthusan without timeouts
var PROXY_LIST = [
  "https://corsproxy.org/?",
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://api.allorigins.win/raw?url="
];

async function fetchWithFallback(targetUrl) {
  for (var i = 0; i < PROXY_LIST.length; i++) {
    try {
      var pUrl = PROXY_LIST[i] + encodeURIComponent(targetUrl);
      var ctrl = new AbortController();
      var timer = setTimeout(function() { ctrl.abort(); }, 6000);
      var resp = await fetch(pUrl, { headers: HEADERS, signal: ctrl.signal });
      clearTimeout(timer);
      if (resp.ok) {
        var text = await resp.text();
        if (text && text.length > 500) {
          return text;
        }
      }
    } catch (e) {
      // try next proxy
    }
  }
  return null;
}

function cleanTitle(str) {
  return str ? str.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim() : "";
}

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

    console.log("[Einthusan] Searching for: " + meta.title);
    
    // Map TMDB language code to Einthusan section
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

    var searchUrl = BASE_URL + "/movie/results/?lang=" + section + "&query=" + encodeURIComponent(meta.title);
    var html = await fetchWithFallback(searchUrl);

    if (!html) {
      console.log("[Einthusan] Search fetch failed or timed out.");
      return [];
    }

    var $ = cheerio.load(html);
    var watchLinks = [];
    $("a[href*='/movie/watch/']").each(function(i, el) {
      var href = $(el).attr("href");
      if (href && watchLinks.indexOf(href) === -1) {
        watchLinks.push(href);
      }
    });

    if (watchLinks.length === 0) {
      console.log("[Einthusan] No results found on search page.");
      return [];
    }

    var moviePath = watchLinks[0];
    var moviePageUrl = moviePath.indexOf("http") === 0 ? moviePath : BASE_URL + moviePath;
    console.log("[Einthusan] Fetching player page: " + moviePageUrl);

    var playerHtml = await fetchWithFallback(moviePageUrl);
    if (!playerHtml) {
      console.log("[Einthusan] Player page fetch failed.");
      return [];
    }

    // Extract HLS or MP4 link from modern Einthusan data attributes
    var hlsMatch = playerHtml.match(/data-hls-link=["']([^"']+)["']/i);
    var mp4Match = playerHtml.match(/data-mp4-link=["']([^"']+)["']/i);
    var rawVideoUrl = (hlsMatch ? hlsMatch[1] : (mp4Match ? mp4Match[1] : null));

    if (!rawVideoUrl) {
      // Fallback: check legacy data-video token
      var legacyMatch = playerHtml.match(/data-video=["']([^"']+)["']/i);
      if (legacyMatch && legacyMatch[1]) {
        try {
          var clean = legacyMatch[1].replace(/&amp;/g, "&").trim();
          var rev = clean.split("").reverse().join("");
          while (rev.length % 4 !== 0) rev += "=";
          var dec = atob(rev).replace(/\\\//g, "/");
          if (dec.indexOf("//") === 0) dec = "https:" + dec;
          rawVideoUrl = dec;
        } catch (e) {}
      }
    }

    if (!rawVideoUrl) {
      console.log("[Einthusan] No stream link found in player DOM.");
      return [];
    }

    rawVideoUrl = rawVideoUrl.replace(/&amp;/g, "&");
    console.log("[Einthusan] Resolved Stream URL: " + rawVideoUrl);

    return [{
      name: "Einthusan (Direct)",
      title: "Einthusan HD • [Direct CDN]",
      url: rawVideoUrl,
      quality: "1080p",
      headers: {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": "https://einthusan.tv/",
        "Origin": "https://einthusan.tv"
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
