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
    // The NOAutopilot link (docs/noautopilot-plan.md, "Integration surface"). NOAutopilot has no
    // API, so every member is looked up once by reflection; a lookup that fails leaves the page
    // INCOMPATIBLE with the missing names logged, never an exception. This class only exposes what
    // NOAutopilot has (typed get/set and its own methods); what the page's buttons do with it is
    // NoApCommands. Main thread only: APData is written by NOAutopilot's own Unity callbacks.
    internal static class NoApBridge
    {
        internal const string NoApGuid = "com.qwerty1423.NOAutopilot";

        private enum Link { Unresolved, Missing, Incompatible, Linked }

        private static Link _link;
        private static string _version = "";

        private static FieldInfo _enabled = null!, _navEnabled = null!, _gcasEnabled = null!, _gcasWarning = null!,
            _gcasActive = null!, _autoJam = null!, _alsActive = null!, _alsText = null!, _extremeThrottle = null!,
            _fbwDisabled = null!, _speedIsMach = null!, _useSetValues = null!, _tgtAlt = null!, _tgtSpeed = null!,
            _tgtCourse = null!, _tgtRoll = null!, _climbRate = null!, _navQueue = null!, _aircraft = null!, _rb = null!,
            _pilot = null!, _navCycle = null!, _defaultCRLimit = null!, _disableATAPGUI = null!, _isBroken = null!;
        private static MethodInfo _isMultiplayer = null!, _syncMenuValues = null!, _refreshNavVisuals = null!,
            _updateFBWState = null!, _startAutoland = null!;

        internal static bool IsLinked
        {
            get
            {
                if (_link == Link.Unresolved) Resolve();
                return _link == Link.Linked;
            }
        }

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

            FieldInfo F(Type? t, string name)
            {
                FieldInfo? f = t?.GetField(name, BindingFlags.Public | BindingFlags.Static);
                if (f == null && t != null) missing.Add(t.Name + "." + name);
                return f!;
            }

            // StartAutoland is private; the rest are public.
            MethodInfo M(string name, bool nonPublic = false)
            {
                BindingFlags vis = nonPublic ? BindingFlags.NonPublic : BindingFlags.Public;
                MethodInfo? m = pl?.GetMethod(name, vis | BindingFlags.Static, null, Type.EmptyTypes, null);
                if (m == null && pl != null) missing.Add("Plugin." + name + "()");
                return m!;
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
            _useSetValues = F(ap, "UseSetValues");
            _tgtAlt = F(ap, "TargetAlt");
            _tgtSpeed = F(ap, "TargetSpeed");
            _tgtCourse = F(ap, "TargetCourse");
            _tgtRoll = F(ap, "TargetRoll");
            _climbRate = F(ap, "CurrentMaxClimbRate");
            _navQueue = F(ap, "NavQueue");
            _aircraft = F(ap, "LocalAircraft");
            _rb = F(ap, "PlayerRB");
            _pilot = F(ap, "LocalPilot");
            _navCycle = F(pl, "NavCycle");
            _defaultCRLimit = F(pl, "DefaultCRLimit");
            _disableATAPGUI = F(pl, "DisableATAPGUI");
            _isBroken = F(pl, "IsBroken");
            _isMultiplayer = M("IsMultiplayer");
            _syncMenuValues = M("SyncMenuValues");
            _refreshNavVisuals = M("RefreshNavVisuals");
            _updateFBWState = M("UpdateFBWState");
            _startAutoland = M("StartAutoland", nonPublic: true);

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

        // A member that resolved but no longer has the expected type (an NOAutopilot update) throws on
        // every use; the first failure logs and stops the link for the rest of the session.
        internal static void Fail(string what, Exception ex)
        {
            _link = Link.Incompatible;
            Plugin.Log?.LogWarning($"[NOAP] {what} failed against NOAutopilot {_version}, AP page disabled: {ex}");
        }

        // ── NOAutopilot state (APData and Plugin settings) ────────────────────────────────────
        private static bool GetB(FieldInfo f) => (bool)f.GetValue(null)!;
        private static float GetF(FieldInfo f) => (float)f.GetValue(null)!;

        internal static bool Enabled { get => GetB(_enabled); set => _enabled.SetValue(null, value); }
        internal static bool NavEnabled { get => GetB(_navEnabled); set => _navEnabled.SetValue(null, value); }
        internal static bool GcasEnabled { get => GetB(_gcasEnabled); set => _gcasEnabled.SetValue(null, value); }
        internal static bool GcasWarning { get => GetB(_gcasWarning); set => _gcasWarning.SetValue(null, value); }
        internal static bool GcasActive { get => GetB(_gcasActive); set => _gcasActive.SetValue(null, value); }
        internal static bool AutoJammer { get => GetB(_autoJam); set => _autoJam.SetValue(null, value); }
        internal static bool AlsActive { get => GetB(_alsActive); set => _alsActive.SetValue(null, value); }
        internal static string AlsText { get => _alsText.GetValue(null) as string ?? ""; set => _alsText.SetValue(null, value); }
        internal static bool ExtremeThrottle { get => GetB(_extremeThrottle); set => _extremeThrottle.SetValue(null, value); }
        internal static bool FbwDisabled { get => GetB(_fbwDisabled); set => _fbwDisabled.SetValue(null, value); }
        internal static bool SpeedIsMach { get => GetB(_speedIsMach); set => _speedIsMach.SetValue(null, value); }
        internal static bool UseSetValues { set => _useSetValues.SetValue(null, value); }
        // Targets use NOAutopilot's units and sentinels: alt m (-1 off), speed m/s or Mach (-1 off),
        // course deg (-1 off), roll deg (-999 off), climb-rate limit m/s.
        internal static float TargetAlt { get => GetF(_tgtAlt); set => _tgtAlt.SetValue(null, value); }
        internal static float TargetSpeed { get => GetF(_tgtSpeed); set => _tgtSpeed.SetValue(null, value); }
        internal static float TargetCourse { get => GetF(_tgtCourse); set => _tgtCourse.SetValue(null, value); }
        internal static float TargetRoll { get => GetF(_tgtRoll); set => _tgtRoll.SetValue(null, value); }
        internal static float ClimbRate { get => GetF(_climbRate); set => _climbRate.SetValue(null, value); }
        internal static List<Vector3> NavQueue => (List<Vector3>)_navQueue.GetValue(null)!;
        internal static Aircraft? Aircraft => _aircraft.GetValue(null) as Aircraft;
        internal static Rigidbody? Rb => _rb.GetValue(null) as Rigidbody;
        internal static Pilot? LocalPilot => _pilot.GetValue(null) as Pilot;
        internal static ConfigEntry<bool> NavCycle => (ConfigEntry<bool>)_navCycle.GetValue(null)!;
        internal static float DefaultCRLimit => ((ConfigEntry<float>)_defaultCRLimit.GetValue(null)!).Value;
        internal static bool DisableATAPGUI => ((ConfigEntry<bool>)_disableATAPGUI.GetValue(null)!).Value;
        internal static bool IsBroken => GetB(_isBroken);

        // ── NOAutopilot's own methods ─────────────────────────────────────────────────────────
        internal static bool IsMultiplayer() => (bool)_isMultiplayer.Invoke(null, null)!;
        internal static void SyncMenuValues() => _syncMenuValues.Invoke(null, null);
        internal static void RefreshNavVisuals() => _refreshNavVisuals.Invoke(null, null);
        internal static void UpdateFBWState() => _updateFBWState.Invoke(null, null);
        internal static void StartAutoland() => _startAutoland.Invoke(null, null);

        // ── derived flight state, same derivations as NOAutopilot's F8 readout ────────────────
        internal static bool InAircraft(out Aircraft ac, out Rigidbody rb)
        {
            ac = Aircraft!;
            rb = Rb!;
            return ac != null && rb != null;
        }

        internal static float CurrentAlt(Aircraft ac) => ac.GlobalPosition().y;
        internal static float SpeedOfSound(Aircraft ac) => Mathf.Max(LevelInfo.GetSpeedOfSound(CurrentAlt(ac)), 1f);

        // Ground track, or NaN when too slow to have one.
        internal static float CurrentCourse(Rigidbody rb)
        {
            var flat = new Vector3(rb.velocity.x, 0f, rb.velocity.z);
            return flat.sqrMagnitude > 1f ? Quaternion.LookRotation(flat).eulerAngles.y : float.NaN;
        }

        // ── published slice ───────────────────────────────────────────────────────────────────
        internal static string BuildSliceJson()
        {
            if (IsLinked)
            {
                try { return BuildLinkedJson(); }
                catch (Exception ex) { Fail("reading state", ex); }
            }
            return new JsonObj()
                .Str("link", _link == Link.Missing ? "missing" : "incompatible")
                .Str("ver", _version)
                .ToString();
        }

        private static string BuildLinkedJson()
        {
            var j = new JsonObj()
                .Str("link", "linked")
                .Str("ver", _version)
                .Bool("broken", IsBroken)
                .Bool("mp", IsMultiplayer())
                .Bool("ap", Enabled)
                .Bool("nav", NavEnabled)
                .Bool("gcas", GcasEnabled)
                .Bool("gcasWarn", GcasWarning)
                .Bool("gcasActive", GcasActive)
                .Bool("jam", AutoJammer)
                .Bool("als", AlsActive)
                .Str("alsText", AlsText)
                .Bool("xthr", ExtremeThrottle)
                .Bool("fbw", FbwDisabled)
                .Bool("cycle", NavCycle.Value)
                .Bool("mach", SpeedIsMach);

            // Raw NOAutopilot values, sentinels included; the page owns units and formatting.
            j.Obj("tgt", new JsonObj()
                .Num("alt", TargetAlt)
                .Num("spd", TargetSpeed)
                .Num("crs", TargetCourse)
                .Num("roll", TargetRoll)
                .Num("vs", ClimbRate));

            List<Vector3> queue = NavQueue;
            bool air = InAircraft(out Aircraft ac, out Rigidbody rb);
            j.Bool("air", air);

            var nav = new JsonObj().Num("n", queue.Count);
            if (air)
            {
                float roll = ac.transform.eulerAngles.z;
                if (roll > 180f) roll -= 360f;
                j.Obj("cur", new JsonObj()
                    .Num("alt", CurrentAlt(ac))
                    .Num("spd", rb.velocity.magnitude)
                    .Num("mach", rb.velocity.magnitude / SpeedOfSound(ac))
                    .Num("crs", CurrentCourse(rb))
                    .Num("roll", roll)
                    .Num("vs", rb.velocity.y));

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
