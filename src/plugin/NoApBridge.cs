using System;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using System.Text;
using BepInEx;
using BepInEx.Bootstrap;
using BepInEx.Configuration;
using UnityEngine;

namespace NoApModule
{
    // Read side of the NOAutopilot link (docs/noautopilot-plan.md, "Integration surface").
    // NOAutopilot has no API, so every member is looked up once by reflection; a lookup that fails
    // leaves the page INCOMPATIBLE with the missing names logged, never an exception. Main thread
    // only: APData is written by NOAutopilot's own Unity callbacks.
    internal static class NoApBridge
    {
        internal const string NoApGuid = "com.qwerty1423.NOAutopilot";

        private enum Link { Unresolved, Missing, Incompatible, Linked }

        private static Link _link;
        private static string _version = "";

        private static FieldInfo? _enabled, _navEnabled, _gcasEnabled, _gcasWarning, _gcasActive, _autoJam,
            _alsActive, _alsText, _extremeThrottle, _fbwDisabled, _speedIsMach, _tgtAlt, _tgtSpeed,
            _tgtCourse, _tgtRoll, _climbRate, _navQueue, _aircraft, _rb, _navCycle, _isBroken;
        private static MethodInfo? _isMultiplayer;

        private static void Resolve()
        {
            if (!Chainloader.PluginInfos.TryGetValue(NoApGuid, out PluginInfo info) || info.Instance == null)
            {
                _link = Link.Missing;
                Plugin.Log?.LogInfo("[NOAP] NOAutopilot not installed; the AP page shows NOT INSTALLED.");
                return;
            }
            _version = info.Metadata.Version.ToString();

            Assembly asm = info.Instance.GetType().Assembly;
            Type? ap = asm.GetType("NOAutopilot.Core.APData");
            Type? pl = asm.GetType("NOAutopilot.Core.Plugin");
            var missing = new List<string>();
            if (ap == null) missing.Add("NOAutopilot.Core.APData");
            if (pl == null) missing.Add("NOAutopilot.Core.Plugin");

            FieldInfo? F(Type? t, string name)
            {
                FieldInfo? f = t?.GetField(name, BindingFlags.Public | BindingFlags.Static);
                if (f == null && t != null) missing.Add(t.Name + "." + name);
                return f;
            }

            _enabled = F(ap, "Enabled");
            _navEnabled = F(ap, "NavEnabled");
            _gcasEnabled = F(ap, "GCASEnabled");
            _gcasWarning = F(ap, "GCASWarning");
            _gcasActive = F(ap, "GCASActive");
            _autoJam = F(ap, "AutoJammerActive");
            _alsActive = F(ap, "ALSActive");
            _alsText = F(ap, "ALSStatusText");
            _extremeThrottle = F(ap, "AllowExtremeThrottle");
            _fbwDisabled = F(ap, "FBWDisabled");
            _speedIsMach = F(ap, "SpeedHoldIsMach");
            _tgtAlt = F(ap, "TargetAlt");
            _tgtSpeed = F(ap, "TargetSpeed");
            _tgtCourse = F(ap, "TargetCourse");
            _tgtRoll = F(ap, "TargetRoll");
            _climbRate = F(ap, "CurrentMaxClimbRate");
            _navQueue = F(ap, "NavQueue");
            _aircraft = F(ap, "LocalAircraft");
            _rb = F(ap, "PlayerRB");
            _navCycle = F(pl, "NavCycle");
            _isBroken = F(pl, "IsBroken");
            _isMultiplayer = pl?.GetMethod("IsMultiplayer", BindingFlags.Public | BindingFlags.Static, null, Type.EmptyTypes, null);
            if (_isMultiplayer == null && pl != null) missing.Add("Plugin.IsMultiplayer()");

            if (missing.Count == 0)
            {
                _link = Link.Linked;
                Plugin.Log?.LogInfo($"[NOAP] linked to NOAutopilot {_version}.");
            }
            else
            {
                _link = Link.Incompatible;
                Plugin.Log?.LogWarning($"[NOAP] NOAutopilot {_version} is incompatible, missing: {string.Join(", ", missing)}.");
            }
        }

        internal static string BuildSliceJson()
        {
            if (_link == Link.Unresolved) Resolve();
            if (_link == Link.Linked)
            {
                try { return BuildLinkedJson(); }
                catch (Exception ex)
                {
                    // A member that resolved but no longer has the expected type (an NOAutopilot
                    // update) throws on every frame; log once and stop reading it.
                    _link = Link.Incompatible;
                    Plugin.Log?.LogWarning($"[NOAP] reading NOAutopilot {_version} failed, AP page disabled: {ex}");
                }
            }
            return new JsonObj()
                .Str("link", _link == Link.Missing ? "missing" : "incompatible")
                .Str("ver", _version)
                .ToString();
        }

        private static bool B(FieldInfo f) => (bool)f.GetValue(null)!;
        private static float N(FieldInfo f) => (float)f.GetValue(null)!;

        private static string BuildLinkedJson()
        {
            var j = new JsonObj()
                .Str("link", "linked")
                .Str("ver", _version)
                .Bool("broken", B(_isBroken!))
                .Bool("mp", (bool)_isMultiplayer!.Invoke(null, null)!)
                .Bool("ap", B(_enabled!))
                .Bool("nav", B(_navEnabled!))
                .Bool("gcas", B(_gcasEnabled!))
                .Bool("gcasWarn", B(_gcasWarning!))
                .Bool("gcasActive", B(_gcasActive!))
                .Bool("jam", B(_autoJam!))
                .Bool("als", B(_alsActive!))
                .Str("alsText", _alsText!.GetValue(null) as string ?? "")
                .Bool("xthr", B(_extremeThrottle!))
                .Bool("fbw", B(_fbwDisabled!))
                .Bool("cycle", ((ConfigEntry<bool>)_navCycle!.GetValue(null)!).Value)
                .Bool("mach", B(_speedIsMach!));

            // Raw NOAutopilot values, sentinels included (alt/spd/crs -1 = off, roll -999 = off);
            // spd is Mach when "mach" is true, else m/s. The page owns units and formatting.
            j.Obj("tgt", new JsonObj()
                .Num("alt", N(_tgtAlt!))
                .Num("spd", N(_tgtSpeed!))
                .Num("crs", N(_tgtCourse!))
                .Num("roll", N(_tgtRoll!))
                .Num("vs", N(_climbRate!)));

            var queue = (List<Vector3>)_navQueue!.GetValue(null)!;
            var ac = _aircraft!.GetValue(null) as Aircraft;
            var rb = _rb!.GetValue(null) as Rigidbody;
            bool air = ac != null && rb != null;
            j.Bool("air", air);

            var nav = new JsonObj().Num("n", queue.Count);
            if (air)
            {
                float alt = ac!.GlobalPosition().y;
                Vector3 v = rb!.velocity;
                var flat = new Vector3(v.x, 0f, v.z);
                float roll = ac!.transform.eulerAngles.z;
                if (roll > 180f) roll -= 360f;
                // Same derivations as NOAutopilot's own F8 readout, so the two always agree.
                j.Obj("cur", new JsonObj()
                    .Num("alt", alt)
                    .Num("spd", v.magnitude)
                    .Num("mach", v.magnitude / Mathf.Max(LevelInfo.GetSpeedOfSound(alt), 1f))
                    .Num("crs", flat.sqrMagnitude > 1f ? Quaternion.LookRotation(flat).eulerAngles.y : float.NaN)
                    .Num("roll", roll)
                    .Num("vs", v.y));

                if (queue.Count > 0)
                {
                    Vector3 pos = rb.position.ToGlobalPosition().AsVector3();
                    float next = FlatDistance(pos, queue[0]);
                    float total = next;
                    for (int i = 1; i < queue.Count; i++) total += FlatDistance(queue[i - 1], queue[i]);
                    // Bearing to the next point (0 = +Z = north, clockwise), for the heading tape's nav bug.
                    float brg = Mathf.Atan2(queue[0].x - pos.x, queue[0].z - pos.z) * Mathf.Rad2Deg;
                    nav.Num("next", next).Num("total", total).Num("brg", (brg + 360f) % 360f);
                }
            }
            return j.Obj("navq", nav).ToString();
        }

        private static float FlatDistance(Vector3 a, Vector3 b) => new Vector2(b.x - a.x, b.z - a.z).magnitude;

        // Minimal JSON builder for the flat slice. NaN/Infinity become null, since JSON has neither.
        private sealed class JsonObj
        {
            private readonly StringBuilder _sb = new StringBuilder("{");

            private JsonObj Key(string k)
            {
                if (_sb.Length > 1) _sb.Append(',');
                _sb.Append('"').Append(k).Append("\":");
                return this;
            }

            public JsonObj Bool(string k, bool v) { Key(k)._sb.Append(v ? "true" : "false"); return this; }

            public JsonObj Num(string k, float v)
            {
                Key(k);
                if (float.IsNaN(v) || float.IsInfinity(v)) _sb.Append("null");
                else _sb.Append(v.ToString("0.###", CultureInfo.InvariantCulture));
                return this;
            }

            public JsonObj Str(string k, string v)
            {
                Key(k)._sb.Append('"');
                foreach (char c in v)
                {
                    if (c == '"' || c == '\\') _sb.Append('\\').Append(c);
                    else if (c < 0x20) _sb.Append("\\u").Append(((int)c).ToString("x4"));
                    else _sb.Append(c);
                }
                _sb.Append('"');
                return this;
            }

            public JsonObj Obj(string k, JsonObj v) { Key(k)._sb.Append(v); return this; }

            public override string ToString() => _sb.ToString() + "}";
        }
    }
}
