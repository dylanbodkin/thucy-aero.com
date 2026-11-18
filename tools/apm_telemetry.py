#!/usr/bin/env python3
"""Turn an ArduPilot DataFlash log (.BIN) into compact, video-synced telemetry.

The output JSON is what the /latest/ page loads to show live readouts under the
flight video. Pure standard library (no pymavlink needed).

Example (Flight Test 2, 1 Nov 2026):

    python3 tools/apm_telemetry.py \
        assets/flight-test-2/APM/LOGS/00000001.BIN \
        latest/media/first-flight.telemetry.json \
        --offset 503.3 --clip-start 12.0 --duration 24.5 --touchdown 536.25

How the sync numbers were found
  --offset     log time (s) minus original-video time (s). The original video
               has no recording timestamp, so it was matched by eye on two
               events that agree to ~0.1 s:
                 liftoff    video 21.45 s  <->  log 524.75 s (EKF alt rises)
                 touchdown  video 32.95 s  <->  log 536.25 s (AccZ spike)
  --clip-start where the trimmed web clip starts in the original video.
  --touchdown  log time of touchdown. After it, altitude is reported as 0:
               the EKF height drifts several metres negative while the aircraft
               sits on the ground (the barometer confirms it is on the ground).

Heading: EKF yaw resets inside the clip are removed (see build()). In Flight
Test 2 the EKF re-aligned yaw by +166.7 deg just after liftoff (log 524.92 s).
In the indoor hover test it jumped by about -40 deg twice at liftoff (log
320.01 and 320.41 s) and was back within 0.3 s each time. Indoors the compass
is disturbed, so that heading shows turns well but its north is not checked.

Example (indoor hover test, 16 Nov 2026; the left view of the two-camera clip
is PXL_20261117_050904666.mp4 from 159.0 s):

    python3 tools/apm_telemetry.py \
        "<team Drive>/Sessions/2026-11-16 Indoor/APM/LOGS/00000041.BIN" \
        latest/media/indoor-hover.telemetry.json \
        --offset 158.28 --clip-start 159.0 --duration 30.0 --touchdown 347.0 \
        --alt-source rangefinder

  --alt-source rangefinder
               Indoors there is no GPS fix, so the log has no POS message, and
               the EKF height reads 0.2 m high while the motors spin up on the
               floor. The downward rangefinder measures height above the floor
               directly and agrees with the picture to a few centimetres.
  --offset     found from the picture, not by eye: the aircraft's on-screen
               climb rate, tracked in each camera view, was matched against the
               EKF's vertical speed (XKF1.VD). Both views and both halves of the
               clip give log 317.28 s at clip start, within 0.01 s.
  --touchdown  AccZ spike at log 347.0 s; the rangefinder is at its floor
               reading from then on.
"""
import argparse
import bisect
import collections
import json
import math
import struct

# ------------------------------------------------------------ log reader ---
FMTCH = {
    "a": ("64s", 64), "b": ("b", 1), "B": ("B", 1), "h": ("h", 2), "H": ("H", 2),
    "i": ("i", 4), "I": ("I", 4), "f": ("f", 4), "d": ("d", 8), "n": ("4s", 4),
    "N": ("16s", 16), "Z": ("64s", 64), "c": ("h", 2), "C": ("H", 2), "e": ("i", 4),
    "E": ("I", 4), "L": ("i", 4), "M": ("B", 1), "q": ("q", 8), "Q": ("Q", 8),
}
SCALE = {"c": 0.01, "C": 0.01, "e": 0.01, "E": 0.01, "L": 1e-7}


def read_dataflash(path):
    """Return {message name: [record dict, ...]} for a DataFlash .BIN log."""
    data = open(path, "rb").read()
    fmts = {128: ("FMT", 89, "BBnNZ", ["Type", "Length", "Name", "Format", "Columns"])}
    out = collections.defaultdict(list)
    i, n = 0, len(data)
    while i < n - 3:
        if data[i] != 0xA3 or data[i + 1] != 0x95 or data[i + 2] not in fmts:
            i += 1
            continue
        name, length, fmt, cols = fmts[data[i + 2]]
        if i + length > n:
            break
        st = "<" + "".join(FMTCH[c][0] for c in fmt)
        try:
            vals = struct.unpack_from(st, data, i + 3)
        except struct.error:
            i += 1
            continue
        rec = {}
        for c, col, v in zip(fmt, cols, vals):
            if isinstance(v, bytes):
                v = v.split(b"\0")[0].decode("ascii", "replace")
            elif c in SCALE:
                v = v * SCALE[c]
            rec[col] = v
        if name == "FMT":
            fmts[rec["Type"]] = (rec["Name"], rec["Length"], rec["Format"],
                                 rec["Columns"].split(","))
        out[name].append(rec)
        i += length
    return out


# ----------------------------------------------------------- resampling ---
class Series:
    def __init__(self, records, key):
        self.t = [r["TimeUS"] / 1e6 for r in records]
        self.v = [r[key] for r in records]

    def at(self, t, wrap=None):
        """Linear interpolation; `wrap`=360 interpolates angles the short way."""
        j = bisect.bisect(self.t, t)
        if j <= 0:
            return self.v[0]
        if j >= len(self.t):
            return self.v[-1]
        t0, t1, a, b = self.t[j - 1], self.t[j], self.v[j - 1], self.v[j]
        f = (t - t0) / (t1 - t0) if t1 > t0 else 0
        if wrap:
            d = (b - a + wrap / 2) % wrap - wrap / 2
            return (a + d * f) % wrap
        return a + (b - a) * f

    def last(self, t):
        j = bisect.bisect(self.t, t)
        return self.v[max(0, j - 1)]


PLANE_MODES = {
    0: "MANUAL", 1: "CIRCLE", 2: "STABILIZE", 3: "TRAINING", 4: "ACRO", 5: "FBWA",
    6: "FBWB", 7: "CRUISE", 8: "AUTOTUNE", 10: "AUTO", 11: "RTL", 12: "LOITER",
    13: "TAKEOFF", 14: "AVOID_ADSB", 15: "GUIDED", 17: "QSTABILIZE", 18: "QHOVER",
    19: "QLOITER", 20: "QLAND", 21: "QRTL", 22: "QAUTOTUNE", 23: "QACRO",
    24: "THERMAL", 25: "LOITER2QLAND",
}


def build(log, offset, clip_start, duration, touchdown, rate, alt_source="ekf"):
    log_t0 = offset + clip_start            # log time at clip t = 0
    n = int(round(duration * rate)) + 1
    ts = [log_t0 + k / rate for k in range(n)]

    if alt_source == "rangefinder":         # height above the floor, measured
        alt = Series([r for r in log["RFND"] if r.get("Instance", 0) == 0], "Dist")
    else:                                   # EKF height above home
        alt = Series(log["POS"], "RelHomeAlt")
    ground = alt.at(log_t0)                 # reading while still on the ground
    lat, lng = Series(log["GPS"], "Lat"), Series(log["GPS"], "Lng")
    sats, fix = Series(log["GPS"], "NSats"), Series(log["GPS"], "Status")
    roll, pitch = Series(log["ATT"], "Roll"), Series(log["ATT"], "Pitch")
    yaw = Series(log["ATT"], "Yaw")
    # EKF yaw resets (EV 62, e.g. "ground mag anomaly, yaw re-aligned") make the
    # heading jump although the aircraft did not turn. Two kinds are seen:
    #   - the jump stays (Flight Test 2): the value after it is the corrected
    #     one, so carry the jump back to the samples before it;
    #   - the heading is back near its old value within 0.3 s (indoor hover
    #     test, twice at liftoff): the jump is a blip, so drop its samples and
    #     let the readout run straight across it.
    def turn(a, b):
        return (b - a + 180) % 360 - 180

    for ev in log["EV"]:
        tr = ev["TimeUS"] / 1e6
        if ev["Id"] != 62 or not (log_t0 <= tr <= ts[-1]):
            continue
        j = bisect.bisect(yaw.t, tr)
        if 0 < j < len(yaw.t):
            step = turn(yaw.v[j - 1], yaw.v[j])
            k = bisect.bisect_left(yaw.t, tr + 0.3)
            if k < len(yaw.t) and abs(turn(yaw.v[j - 1], yaw.v[k])) < abs(step) / 2:
                del yaw.t[j:k], yaw.v[j:k]
            else:
                yaw.v[:j] = [(v + step) % 360 for v in yaw.v[:j]]

    def clip_t(t):
        return round(t - log_t0, 2)

    modes = [{"t": 0, "mode": PLANE_MODES.get(Series(log["MODE"], "ModeNum").last(log_t0), "?")}]
    for r in log["MODE"]:
        t = r["TimeUS"] / 1e6
        if log_t0 < t <= ts[-1]:
            modes.append({"t": clip_t(t), "mode": PLANE_MODES.get(r["ModeNum"], str(r["ModeNum"]))})
    arm = Series(log["ARM"], "ArmState")
    armed = [{"t": 0, "armed": bool(arm.last(log_t0)) if arm.t[0] <= log_t0 else False}]
    for r in log["ARM"]:
        t = r["TimeUS"] / 1e6
        if log_t0 < t <= ts[-1]:
            armed.append({"t": clip_t(t), "armed": bool(r["ArmState"])})

    return {
        "source": "ArduPilot DataFlash log, synced to video",
        "rate": rate,
        "duration": duration,
        "events": {"mode": modes, "armed": armed},
        "series": {
            # altitude above the takeoff point, m, 0 after touchdown
            "alt": [0.0 if t >= touchdown else round(max(0.0, alt.at(t) - ground), 2) for t in ts],
            "lat": [round(lat.at(t), 7) for t in ts],
            "lon": [round(lng.at(t), 7) for t in ts],
            "sats": [int(sats.last(t)) for t in ts],
            "fix": [int(fix.last(t)) for t in ts],          # 3 = 3D fix
            "roll": [round(roll.at(t), 1) for t in ts],     # deg, right wing down +
            "pitch": [round(pitch.at(t), 1) for t in ts],   # deg, nose up +
            "hdg": [round(yaw.at(t, wrap=360), 1) for t in ts],  # deg true
        },
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("log")
    ap.add_argument("out")
    ap.add_argument("--offset", type=float, required=True, help="log time minus original video time, s")
    ap.add_argument("--clip-start", type=float, default=0.0, help="clip start in the original video, s")
    ap.add_argument("--duration", type=float, required=True, help="clip length, s")
    ap.add_argument("--touchdown", type=float, default=math.inf, help="log time of touchdown, s")
    ap.add_argument("--rate", type=int, default=20, help="samples per second")
    ap.add_argument("--alt-source", choices=("ekf", "rangefinder"), default="ekf",
                    help="where altitude comes from; use rangefinder for indoor flights")
    ap.add_argument("--fields", default="alt,hdg,roll,pitch",
                    help="comma-separated outputs to keep; available: "
                         "alt,hdg,roll,pitch,lat,lon,sats,fix,mode,armed")
    a = ap.parse_args()
    data = build(read_dataflash(a.log), a.offset, a.clip_start, a.duration, a.touchdown, a.rate,
                 a.alt_source)
    # Only publish what the page shows (e.g. keep GPS out unless asked for).
    keep = set(a.fields.split(","))
    data["series"] = {k: v for k, v in data["series"].items() if k in keep}
    data["events"] = {k: v for k, v in data["events"].items() if k in keep}
    with open(a.out, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    s = data["series"]
    n = len(next(iter(s.values()))) if s else 0
    print(f"wrote {a.out}: {n} samples @ {a.rate} Hz, fields {sorted(s) + sorted(data['events'])}")


if __name__ == "__main__":
    main()
