// Einthusan Scraper for Nuvio Local Scrapers (React Native Hermes compatible)
var RELAY_BASE = "https://einthusan-relay.onrender.com";
var TMDB_KEY = "45dbdd5643f112d31135c359d3334748";

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

    // 1. Fetch title and original_language from TMDB
    var tmdbUrl = "https://api.themoviedb.org/3/movie/" + tmdbId + "?api_key=" + TMDB_KEY;
    fetch(tmdbUrl)
      .then(function(r) { return r.json(); })
      .catch(function() { return { title: "Leo", original_language: "ta" }; })
      .then(function(movie) {
        var title = movie.title || movie.original_title || "Leo";
        var origLang = movie.original_language || "ta";
        var einthusanLang = LANG_MAP[origLang] || "tamil";
        var cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, " ").trim();

        // 2. Search Einthusan
        var searchUrl = RELAY_BASE + "/search?lang=" + einthusanLang + "&query=" + encodeURIComponent(cleanTitle);
        return fetch(searchUrl)
          .then(function(res) { return res.text(); })
          .then(function(html) {
            var match = html.match(/\/movie\/watch\/[a-zA-Z0-9]+\/\?lang=[a-z]+/);
            // If not found in original language, try Tamil as fallback
            if (!match && einthusanLang !== "tamil") {
              return fetch(RELAY_BASE + "/search?lang=tamil&query=" + encodeURIComponent(cleanTitle))
                .then(function(r) { return r.text(); })
                .then(function(h2) {
                  return { match: h2.match(/\/movie\/watch\/[a-zA-Z0-9]+\/\?lang=[a-z]+/), title: title };
                });
            }
            return { match: match, title: title };
          });
      })
      .then(function(data) {
        var match = data.match;
        var movieTitle = data.title;
        if (!match) {
          return resolve([]);
        }

        var watchPath = match[0];
        // 3. Resolve authenticated stream via cloud relay
        return fetch(RELAY_BASE + "/resolve-stream?path=" + encodeURIComponent(watchPath))
          .then(function(res) { return res.json(); })
          .then(function(streamInfo) {
            var streams = [];
            if (streamInfo && streamInfo.streamData) {
              if (streamInfo.streamData.MP4Link) {
                streams.push({
                  name: "Einthusan (Direct MP4)",
                  title: movieTitle + " - 1080p Full HD [High Speed]",
                  url: RELAY_BASE + "/proxy?url=" + encodeURIComponent(streamInfo.streamData.MP4Link),
                  quality: "1080p",
                  type: "direct",
                  behaviorHints: { bingeGroup: "einthusan-mp4" }
                });
              }
              if (streamInfo.streamData.HLSLink) {
                streams.push({
                  name: "Einthusan (Adaptive HLS)",
                  title: movieTitle + " - Multi-Quality Adaptive HLS",
                  url: RELAY_BASE + "/proxy-hls?url=" + encodeURIComponent(streamInfo.streamData.HLSLink),
                  quality: "1080p",
                  type: "direct",
                  behaviorHints: { bingeGroup: "einthusan-hls" }
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
