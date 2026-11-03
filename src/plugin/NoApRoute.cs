using System.Collections.Generic;
using NOXMFD;
using UnityEngine;

namespace NoApModule
{
    // Route coupling (docs/noautopilot-plan.md, Phase 2): NOAutopilot flies NOXMFD's active WPT route,
    // or its selected steer point when no route is active. NOXMFD's route is the source of truth and
    // NavQueue a copy of its remaining points. NOAutopilot keeps its own sequencing (it drops the head
    // point once reached or passed); each drop is mirrored back to NOXMFD as an advance, so the HUD
    // cue, RTD and WPT follow. Direct-to, edits and route switches on NOXMFD's pages arrive as a
    // RouteRevision change and re-sync the copy. Main thread only (Plugin.Update, command handler).
    internal static class NoApRoute
    {
        internal static bool Coupled { get; private set; }
        internal static bool Loop { get; private set; }

        // NOXMFD's route state, re-read only when RouteRevision changes.
        private static int _rev = int.MinValue;
        internal static NavRoute? Route { get; private set; }
        internal static NavPoint? SteerPoint { get; private set; }

        // What the extension last wrote to NavQueue, and the route index of its head point.
        private static readonly List<Vector3> _expected = new List<Vector3>();
        private static int _headIndex;
        private static bool _resync;
        // The pilot's own "Cycle wp", held off while coupled: with it on, NOAutopilot re-appends each
        // reached point and the route would never end. Restored on decouple; null while uncoupled.
        private static bool? _savedCycle;

        internal static bool Available => (Route != null && Route.Points.Length > 0) || SteerPoint != null;

        internal static void Tick()
        {
            int rev = Api.RouteRevision;
            if (rev != _rev)
            {
                _rev = rev;
                Route = Api.GetActiveRoute();
                SteerPoint = Route == null ? Api.GetActiveSteerPoint() : null;
                _resync = true;
            }
            if (!Coupled) return;
            if (!NoApBridge.IsLinked || !NoApBridge.InAircraft(out Aircraft ac, out _))
            {
                Decouple();
                return;
            }

            if (NoApBridge.NavCycle.Value)
            {
                _savedCycle = true;   // the pilot turned it on from F8: that's the value to restore
                NoApBridge.NavCycle.Value = false;
            }

            List<Vector3> q = NoApBridge.NavQueue;
            if (!Matches(q, 0))
            {
                // With the route changed this same frame, the re-sync below rewrites the queue
                // instead; if the dropped point is still due, NOAutopilot drops it again next frame.
                if (Matches(q, 1)) { if (!_resync) Advance(); }
                else if (q.Count == 0) { Decouple(); return; }   // F8's CLEAR
                else _resync = true;   // a map click or UNDO edited the copy; NOXMFD's route wins
            }
            if (_resync) Sync(ac, q);
        }

        // NOAutopilot dropped the head point (reached, passed, or SKIP). The index comes from the last
        // sync rather than the route's live NextIndex, so a proximity advance NOXMFD made in the same
        // frame isn't counted twice.
        private static void Advance()
        {
            _expected.RemoveAt(0);
            if (Route != null) Api.SetActiveRouteNextIndex(++_headIndex);
        }

        private static bool Matches(List<Vector3> q, int skip)
        {
            if (q.Count != _expected.Count - skip) return false;
            for (int i = 0; i < q.Count; i++)
                if (q[i] != _expected[i + skip]) return false;
            return true;
        }

        private static void Sync(Aircraft ac, List<Vector3> q)
        {
            _resync = false;
            NavRoute? r = Route;
            if (r != null && Loop && r.Points.Length > 0 && r.NextIndex >= r.Points.Length)
            {
                Api.SetActiveRouteNextIndex(0);   // its revision bump re-syncs from the first point
                return;
            }

            // NOXMFD points have no altitude and NOAutopilot steers laterally, but its "passed" test
            // includes height: a point far below a climbing aircraft would count as passed early.
            float y = NoApBridge.TargetAlt >= 0f ? NoApBridge.TargetAlt : NoApBridge.CurrentAlt(ac);
            _expected.Clear();
            if (r != null)
            {
                _headIndex = r.NextIndex;
                for (int i = r.NextIndex; i < r.Points.Length; i++) _expected.Add(new Vector3(r.Points[i].X, y, r.Points[i].Z));
            }
            else if (SteerPoint != null) _expected.Add(new Vector3(SteerPoint.X, y, SteerPoint.Z));

            // An emptied queue turned NOAutopilot's nav off; points arriving again (a loop, a
            // direct-to after the route ended, a route activated later) resume it.
            bool resume = q.Count == 0 && _expected.Count > 0;
            q.Clear();
            q.AddRange(_expected);
            if (resume) EnableNav();
            NoApBridge.RefreshNavVisuals();
        }

        private static void EnableNav()
        {
            NoApBridge.NavEnabled = true;
            NoApCommands.DefaultBankLimitIfSteering();
            NoApBridge.SyncMenuValues();
        }

        internal static bool Couple()
        {
            if (Coupled || !Available || !NoApBridge.InAircraft(out Aircraft ac, out _)) return false;
            Coupled = true;
            _savedCycle = NoApBridge.NavCycle.Value;
            NoApBridge.NavCycle.Value = false;
            List<Vector3> q = NoApBridge.NavQueue;
            q.Clear();   // the pilot's own map points give way to the route
            Sync(ac, q);
            return true;
        }

        // Leaves NOXMFD's route alone; only NOAutopilot's copy and nav mode are cleared.
        internal static void Decouple()
        {
            if (!Coupled) return;
            Coupled = false;
            _expected.Clear();
            bool? cycle = _savedCycle;
            _savedCycle = null;
            if (!NoApBridge.IsLinked) return;
            if (cycle != null) NoApBridge.NavCycle.Value = cycle.Value;
            NoApBridge.NavQueue.Clear();
            NoApBridge.NavEnabled = false;
            NoApBridge.RefreshNavVisuals();
            NoApBridge.SyncMenuValues();
        }

        internal static void ToggleLoop() => Loop = !Loop;
    }
}
