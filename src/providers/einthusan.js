// Einthusan Scraper for Nuvio Local Scrapers (React Native Hermes compatible)
var RELAY_BASE = "https://einthusan-relay.onrender.com";
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";

var LANG_MAP = {
  "ta": "tamil",
  "hi": "hindi",
  "te": "telugu",
  "ml": "malayalam",
  "kn": "kannada",
  "bn": "bengali",
  "mr": "marathi",
  "pa": "punjabi"
};

function getStreams(tmdbId, type, season, episode) {
  return new Promise(function(resolve, reject) {
    if (type !== 'movie') {
      return resolve([]);
    }

    // 1. Fetch title and original_language from TMDB using working API key
    var tmdbUrl = "https://api.themoviedb.org/3/movie/" + tmdbId + "?api_key=" + TMDB_KEY;
    fetch(tmdbUrl)
      .then(function(r) { return r.json(); })
      .then(function(movie) {
        if (!movie || (!movie.title && !movie.original_title)) {
          return resolve([]);
        }

        var title = movie.title || movie.original_title;
        var origLang = movie.original_language || "ta";
        var einthusanLang = LANG_MAP[origLang] || "tamil";
        // Clean special characters
        var cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, " ").trim();

        // 2. Search Einthusan dynamically for THIS specific movie
        var searchUrl = RELAY_BASE + "/search?lang=" + einthusanLang + "&query=" + encodeURIComponent(cleanTitle);
        return fetch(searchUrl)
          .then(function(res) { return res.text(); })
          .then(function(html) {
            // Find watch links
            var match = html.match(/\/movie\/watch\/[a-zA-Z0-9]+\/\?lang=[a-z]+/);
            // Fallback to Tamil search if not found in original language
            if (!match && einthusanLang !== "tamil") {
              return fetch(RELAY_BASE + "/search?lang=tamil&query=" + encodeURIComponent(cleanTitle))
                .then(function(r) { return r.text(); })
                .then(function(h2) {
                  return {
                    match: h2.match(/\/movie\/watch\/[a-zA-Z0-9]+\/\?lang=[a-z]+/),
                    title: title
                  };
                });
            }
            return { match: match, title: title };
          });
      })
      .then(function(data) {
        if (!data || !data.match) {
          return resolve([]);
        }

        var watchPath = data.match[0];
        var movieTitle = data.title;

        // 3. Resolve authenticated stream for THIS specific movie path
        return fetch(RELAY_BASE + "/resolve-stream?path=" + encodeURIComponent(watchPath))
          .then(function(res) { return res.json(); })
          .then(function(streamInfo) {
            var streams = [];
            if (streamInfo && streamInfo.streamData) {
              // Direct CDN link (0 relay bandwidth)
              if (streamInfo.streamData.MP4Link) {
                streams.push({
                  name: "Einthusan (Direct MP4)",
                  title: movieTitle + " - 1080p Ultra-Fast [Direct CDN]",
                  url: streamInfo.streamData.MP4Link,
                  quality: "1080p",
                  type: "direct",
                  behaviorHints: { bingeGroup: "einthusan-cdn-" + tmdbId }
                });

                // Relay Proxy Fallback
                streams.push({
                  name: "Einthusan (Relay Proxy)",
                  title: movieTitle + " - 1080p Full HD [Bypass Proxy]",
                  url: RELAY_BASE + "/proxy?url=" + encodeURIComponent(streamInfo.streamData.MP4Link),
                  quality: "1080p",
                  type: "direct",
                  behaviorHints: { bingeGroup: "einthusan-proxy-" + tmdbId }
                });
              }

              if (streamInfo.streamData.HLSLink) {
                streams.push({
                  name: "Einthusan (Adaptive HLS)",
                  title: movieTitle + " - Multi-Quality Adaptive HLS",
                  url: RELAY_BASE + "/proxy-hls?url=" + encodeURIComponent(streamInfo.streamData.HLSLink),
                  quality: "1080p",
                  type: "direct",
                  behaviorHints: { bingeGroup: "einthusan-hls-" + tmdbId }
                });
              }
            }
            resolve(streams);
          });
      })
      .catch(function(err) {
        resolve([]);
      });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
