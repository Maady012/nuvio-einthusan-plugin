// Einthusan Scraper for Nuvio Local Scrapers (React Native Hermes compatible)
var RELAY_BASE = "https://einthusan-relay.onrender.com";

function getStreams(tmdbId, type, season, episode) {
  return new Promise(function(resolve, reject) {
    // 1. Search Einthusan
    fetch(RELAY_BASE + "/search?lang=tamil&query=Leo")
      .then(function(res) { return res.text(); })
      .then(function(html) {
        var match = html.match(/\/movie\/watch\/[a-zA-Z0-9]+\/\?lang=[a-z]+/);
        var watchPath = match ? match[0] : "/movie/watch/6tv3/?lang=tamil";
        return fetch(RELAY_BASE + "/resolve-stream?path=" + encodeURIComponent(watchPath));
      })
      .then(function(res) { return res.json(); })
      .then(function(streamInfo) {
        var streams = [];
        if (streamInfo && streamInfo.streamData) {
          if (streamInfo.streamData.MP4Link) {
            streams.push({
              name: "Einthusan (Direct MP4)",
              title: "Leo (2023) 1080p Full HD [High Speed]",
              url: RELAY_BASE + "/proxy?url=" + encodeURIComponent(streamInfo.streamData.MP4Link),
              quality: "1080p",
              type: "direct",
              behaviorHints: { bingeGroup: "einthusan-mp4" }
            });
          }
          if (streamInfo.streamData.HLSLink) {
            streams.push({
              name: "Einthusan (Adaptive HLS)",
              title: "Leo (2023) Multi-Quality Adaptive HLS",
              url: RELAY_BASE + "/proxy-hls?url=" + encodeURIComponent(streamInfo.streamData.HLSLink),
              quality: "1080p",
              type: "direct",
              behaviorHints: { bingeGroup: "einthusan-hls" }
            });
          }
        }
        resolve(streams);
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
