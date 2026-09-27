using System;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;

namespace NoApModule
{
    // What the AP page's controls do (docs/noautopilot-plan.md, Phase 1). Each command copies what
    // NOAutopilot's own F8 window or keybind does for the same action, so the page and F8 always
    // behave the same. NOXMFD runs this on the main thread. The body comes from the browser, so every
    // value is range-checked here before anything is written to NOAutopilot.
    internal static class NoApCommands
    {
        // Flat on purpose: Unity's JsonUtility doesn't fill nested objects under Mono. NaN marks a
        // target the page didn't send (JSON has no NaN, so a sent value can't collide with it).
        [Serializable]
        private sealed class Envelope
        {
            public string cmd = "";
            public string what = "";
            public float alt = float.NaN, spd = float.NaN, crs = float.NaN, roll = float.NaN, vs = float.NaN;
            public bool spdMach = false;
        }

        internal static void Handle(string json)
        {
            if (!NoApBridge.IsLinked) return;
            var e = new Envelope();
            try { JsonUtility.FromJsonOverwrite(json, e); }
            catch (Exception ex)
            {
                Plugin.Log?.LogWarning($"[NOAP] malformed command ignored: {ex.Message}");
                return;
            }

            try
            {
                if (!Dispatch(e)) Plugin.Log?.LogWarning($"[NOAP] command rejected: {json}");
            }
            catch (TargetInvocationException ex)
            {
                // One of NOAutopilot's own methods threw (e.g. autoland with no runway in reach); that
                // is its failure, not a broken link, so the page stays up.
                Plugin.Log?.LogWarning($"[NOAP] NOAutopilot failed on '{e.cmd}': {ex.InnerException?.Message ?? ex.Message}");
            }
            catch (Exception ex) { NoApBridge.Fail("command '" + e.cmd + "'", ex); }
        }

        private static bool Dispatch(Envelope e)
        {
            switch (e.cmd)
            {
                case "apply": return Apply(e);
                case "engage": Engage(); return true;
                case "disengage": Disengage(); return true;
                case "crs-hold": return CourseHold();
                case "crs-clear": CourseClear(); return true;
                case "toggle": return Toggle(e.what);
                case "nav-skip": RemoveNav(first: true); return true;
                case "nav-undo": RemoveNav(first: false); return true;
                case "nav-clear": ClearNav(); return true;
                case "als": Autoland(); return true;
                default: return false;
            }
        }

        private static bool Given(float v) => !float.IsNaN(v);
        private static bool InRange(float v, float lo, float hi) => !float.IsInfinity(v) && v >= lo && v <= hi;

        // F8's Apply: set the sent targets, then engage with UseSetValues. Targets not sent keep their
        // current value.
        private static bool Apply(Envelope e)
        {
            if (Given(e.alt) && !InRange(e.alt, 0f, 30000f)) return false;
            if (Given(e.spd) && !InRange(e.spd, 0f, e.spdMach ? 5f : 1500f)) return false;
            if (Given(e.crs) && !InRange(e.crs, 0f, 360f)) return false;
            if (Given(e.roll) && !InRange(e.roll, -90f, 90f)) return false;
            if (Given(e.vs) && !InRange(e.vs, 0.5f, 300f)) return false;

            if (Given(e.alt)) NoApBridge.TargetAlt = e.alt;
            if (Given(e.vs)) NoApBridge.ClimbRate = e.vs;
            if (Given(e.spd)) NoApBridge.TargetSpeed = SpeedInNoApUnits(e.spd, e.spdMach);
            if (Given(e.crs)) NoApBridge.TargetCourse = e.crs % 360f;
            if (Given(e.roll)) NoApBridge.TargetRoll = e.roll;
            else DefaultBankLimitIfSteering();

            NoApBridge.Enabled = true;
            NoApBridge.UseSetValues = true;
            NoApBridge.SyncMenuValues();
            return true;
        }

        // The page sends speed in the unit it was showing; if F8 or the keybind switched KT/M since,
        // convert through the current speed of sound instead of misreading Mach as m/s.
        private static float SpeedInNoApUnits(float v, bool isMach)
        {
            if (isMach == NoApBridge.SpeedIsMach || !NoApBridge.InAircraft(out Aircraft ac, out _)) return v;
            float sos = NoApBridge.SpeedOfSound(ac);
            return isMach ? v * sos : v / sos;
        }

        // Course hold and nav steer within TargetRoll as a bank limit; a zero or unset limit would
        // never turn, so they get NOAutopilot's configured default, as its F8 Apply and nav toggle do.
        private static void DefaultBankLimitIfSteering()
        {
            float roll = NoApBridge.TargetRoll;
            if ((NoApBridge.NavEnabled || NoApBridge.TargetCourse >= 0f) && (roll == -999f || roll == 0f))
                NoApBridge.TargetRoll = NoApBridge.DefaultCRLimit;
        }

        // F8's Engage button: hold the current altitude if no altitude target is set, and level the
        // wings (or use the default bank limit in nav mode) if neither course nor roll is set.
        private static void Engage()
        {
            NoApBridge.Enabled = true;
            if (NoApBridge.TargetAlt < 0f && NoApBridge.InAircraft(out Aircraft ac, out _))
                NoApBridge.TargetAlt = NoApBridge.CurrentAlt(ac);
            if (NoApBridge.TargetCourse < 0f && NoApBridge.TargetRoll == -999f)
                NoApBridge.TargetRoll = NoApBridge.NavEnabled ? NoApBridge.DefaultCRLimit : 0f;
            NoApBridge.UseSetValues = true;
            NoApBridge.SyncMenuValues();
        }

        // F8's Disengage button, including its optional "disable autothrottle with AP" setting.
        private static void Disengage()
        {
            NoApBridge.Enabled = false;
            if (NoApBridge.DisableATAPGUI) NoApBridge.TargetSpeed = -1f;
            NoApBridge.SyncMenuValues();
        }

        private static bool CourseHold()
        {
            if (!NoApBridge.InAircraft(out _, out Rigidbody rb)) return false;
            float crs = NoApBridge.CurrentCourse(rb);
            if (float.IsNaN(crs)) return false;
            NoApBridge.TargetCourse = crs;
            DefaultBankLimitIfSteering();
            NoApBridge.SyncMenuValues();
            return true;
        }

        // F8's course CLR: drop the course target and nav, and level the wings.
        private static void CourseClear()
        {
            NoApBridge.TargetCourse = -1f;
            NoApBridge.NavEnabled = false;
            NoApBridge.TargetRoll = 0f;
            NoApBridge.SyncMenuValues();
        }

        private static bool Toggle(string what)
        {
            switch (what)
            {
                case "athr": ToggleAutothrottle(); break;
                case "mach": ToggleMach(); break;
                case "abbrk": NoApBridge.ExtremeThrottle = !NoApBridge.ExtremeThrottle; break;
                case "jam": NoApBridge.AutoJammer = !NoApBridge.AutoJammer; break;
                case "gcas":
                    NoApBridge.GcasEnabled = !NoApBridge.GcasEnabled;
                    if (!NoApBridge.GcasEnabled) { NoApBridge.GcasActive = false; NoApBridge.GcasWarning = false; }
                    break;
                case "fbw":
                    // NOAutopilot refuses FBW off in multiplayer and turns it back on there.
                    NoApBridge.FbwDisabled = !NoApBridge.IsMultiplayer() && !NoApBridge.FbwDisabled;
                    NoApBridge.UpdateFBWState();
                    break;
                case "nav":
                    NoApBridge.NavEnabled = !NoApBridge.NavEnabled;
                    DefaultBankLimitIfSteering();
                    NoApBridge.SyncMenuValues();
                    break;
                case "cycle": NoApBridge.NavCycle.Value = !NoApBridge.NavCycle.Value; break;
                default: return false;
            }
            return true;
        }

        // NOAutopilot's speed-hold key: clear the speed target, or capture the current speed as it.
        private static void ToggleAutothrottle()
        {
            if (NoApBridge.TargetSpeed >= 0f) NoApBridge.TargetSpeed = -1f;
            else if (NoApBridge.InAircraft(out Aircraft ac, out _))
                NoApBridge.TargetSpeed = NoApBridge.SpeedIsMach ? ac.speed / NoApBridge.SpeedOfSound(ac) : ac.speed;
            NoApBridge.SyncMenuValues();
        }

        // F8's KT/M button: switch units, converting a set target so the held speed doesn't change.
        private static void ToggleMach()
        {
            if (NoApBridge.TargetSpeed >= 0f && NoApBridge.InAircraft(out Aircraft ac, out _))
            {
                float sos = NoApBridge.SpeedOfSound(ac);
                NoApBridge.TargetSpeed = NoApBridge.SpeedIsMach ? NoApBridge.TargetSpeed * sos : NoApBridge.TargetSpeed / sos;
            }
            NoApBridge.SpeedIsMach = !NoApBridge.SpeedIsMach;
            NoApBridge.SyncMenuValues();
        }

        // F8's Skip wp / Undo wp; an emptied queue also ends nav mode, as there.
        private static void RemoveNav(bool first)
        {
            List<Vector3> q = NoApBridge.NavQueue;
            if (q.Count == 0) return;
            q.RemoveAt(first ? 0 : q.Count - 1);
            if (q.Count == 0) NoApBridge.NavEnabled = false;
            NoApBridge.RefreshNavVisuals();
        }

        private static void ClearNav()
        {
            NoApBridge.NavQueue.Clear();
            NoApBridge.NavEnabled = false;
            NoApBridge.RefreshNavVisuals();
        }

        // NOAutopilot's autoland key: cancel a running autoland (handing control back to the player's
        // pilot state), or start one.
        private static void Autoland()
        {
            if (NoApBridge.AlsActive)
            {
                NoApBridge.AlsActive = false;
                NoApBridge.AlsText = "";
                Pilot? pilot = NoApBridge.LocalPilot;
                if (pilot != null) pilot.SwitchState(pilot.playerState);
            }
            else NoApBridge.StartAutoland();
        }
    }
}
