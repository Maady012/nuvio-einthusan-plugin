/**
 * Einthusan Direct Provider for Nuvio
 * Local JavaScript Scraper running in Nuvio QuickJS sandbox.
 */
var cheerio = require("cheerio-without-node-native");
var TMDB_KEY = "1b3113663c9004682ed61086cf967c44";
var TMDB_BASE = "https://api.themoviedb.org/3";
var BASE_URL = "https://einthusan.tv";
var PROXY_RELAY = "https://api.allorigins.win/raw?url=";

var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": BASE_URL + "/"
};

function decodeToken(token) {
  try {
    var clean = token.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    var rev = clean.split("").reverse().join("");
    while (rev.length % 4 !== 0) {
      rev += "=";
    }
    var decoded = atob(rev);
    decoded = decoded.replace(/\\\//g, "/");
    if (decoded.indexOf("//") === 0) {
      decoded = "https:" + decoded;
    }
    if (decoded.trim().indexOf("{") === 0) {
      var obj = JSON.parse(decoded);
      return obj.url || obj.mp4 || obj.hls;
    }
    return decoded;
  } catch (e) {
    return null;
  }
}

async function fetchMetadata(tmdbId, type) {
  var url = TMDB_BASE + "/" + (type === "movie" ? "movie" : "tv") + "/" + tmdbId + "?api_key=" + TMDB_KEY;
  var res = await fetch(url);
  var data = await res.json();
  return {
    title: data.title || data.name,
    year: (data.release_date || data.first_air_date || "").split("-")[0]
  };
}

async function getStreams(tmdbId, mediaType, season, episode) {
  console.log("[Einthusan] Processing: " + tmdbId);
  try {
    var meta;
    if (/^\d+$/.test(tmdbId)) {
      meta = await fetchMetadata(tmdbId, mediaType);
    } else {
      meta = { title: tmdbId, year: null };
    }

    if (!meta || !meta.title) return [];

    console.log("[Einthusan] Searching for: " + meta.title);
    var searchUrl = BASE_URL + "/movie/results/?lang=tamil&query=" + encodeURIComponent(meta.title);
    
    // Fetch through CORS edge proxy to bypass ISP DNS block
    var response = await fetch(PROXY_RELAY + encodeURIComponent(searchUrl), { headers: HEADERS });
    var html = await response.text();

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

    var moviePageUrl = watchLinks[0].indexOf("http") === 0 ? watchLinks[0] : BASE_URL + watchLinks[0];
    console.log("[Einthusan] Fetching player page: " + moviePageUrl);

    var playerResp = await fetch(PROXY_RELAY + encodeURIComponent(moviePageUrl), { headers: HEADERS });
    var playerHtml = await playerResp.text();

    var tokenMatch = playerHtml.match(/data-video=["']([^"']+)["']/i);
    if (!tokenMatch || !tokenMatch[1]) {
      console.log("[Einthusan] data-video token not found.");
      return [];
    }

    var streamUrl = decodeToken(tokenMatch[1]);
    if (!streamUrl) {
      console.log("[Einthusan] Token decode failed.");
      return [];
    }

    console.log("[Einthusan] Successfully resolved direct stream: " + streamUrl);

    return [
      {
        name: "Einthusan (Direct)",
        title: meta.title + " • 1080p HD",
        url: streamUrl,
        quality: "1080p",
        headers: {
          "Referer": BASE_URL + "/",
          "Origin": BASE_URL,
          "User-Agent": HEADERS["User-Agent"]
        },
        provider: "Einthusan"
      }
    ];
  } catch (err) {
    console.error("[Einthusan] Error: " + err.message);
    return [];
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = { getStreams: getStreams };
}
