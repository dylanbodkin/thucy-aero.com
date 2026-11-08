/*
 * Live flight telemetry under the milestone video, GCS-style.
 *
 * The <video> names its telemetry file in data-telemetry. That JSON is built
 * from the onboard ArduPilot log by tools/apm_telemetry.py and is already
 * synced to the clip: sample k is at video time k / rate. Values are
 * interpolated between samples, so readouts move smoothly while playing and
 * stay correct when paused or scrubbing.
 */
(() => {
  "use strict";

  const video = document.getElementById("flight-video");
  const panel = document.querySelector('.telemetry[data-for="flight-video"]');
  if (!video || !panel || !video.dataset.telemetry) return;

  const el = {};
  panel.querySelectorAll("[data-tm]").forEach((node) => { el[node.dataset.tm] = node; });

  let data = null;
  const MINUS = "−";
  const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  const set = (key, text) => {
    const node = el[key];
    if (node && node.textContent !== text) node.textContent = text;
  };
  const signed = (v, digits) => {
    const s = Math.abs(v).toFixed(digits);
    return (Number(s) === 0 ? " " : v < 0 ? MINUS : "+") + s;
  };

  // Linear interpolation of series `key` at clip time t (seconds).
  function lerp(key, t, wrap) {
    const s = data.series[key];
    const x = Math.min(Math.max(t * data.rate, 0), s.length - 1);
    const i = Math.floor(x), f = x - i;
    const a = s[i], b = s[Math.min(i + 1, s.length - 1)];
    if (!wrap) return a + (b - a) * f;
    const d = ((b - a + wrap * 1.5) % wrap) - wrap / 2;  // shortest way round
    return (a + d * f + wrap) % wrap;
  }

  function render(t) {
    if (!data) return;
    set("alt", `${lerp("alt", t).toFixed(1)} m`);

    const hdg = Math.round(lerp("hdg", t, 360)) % 360;
    set("hdg", `${String(hdg).padStart(3, "0")}°`);
    set("cardinal", CARDINALS[Math.round(hdg / 45) % 8]);

    set("roll", `${signed(lerp("roll", t), 1)}°`);
    set("pitch", `${signed(lerp("pitch", t), 1)}°`);
  }

  // Follow the video frame by frame where supported, otherwise per animation
  // frame while playing. Seeks and pauses re-render once.
  if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
    const onFrame = (_now, meta) => {
      render(meta.mediaTime);
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
  } else {
    const loop = () => {
      render(video.currentTime);
      if (!video.paused && !video.ended) requestAnimationFrame(loop);
    };
    video.addEventListener("play", () => requestAnimationFrame(loop));
  }
  ["seeked", "pause", "loadedmetadata"].forEach((type) =>
    video.addEventListener(type, () => render(video.currentTime)));

  fetch(video.dataset.telemetry)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
    .then((json) => {
      data = json;
      render(video.currentTime);
    })
    .catch(() => panel.classList.add("is-unavailable"));
})();
