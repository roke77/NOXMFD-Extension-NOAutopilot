# NOAutopilot MFD — planning

## Status

Planning. Nothing is built yet. The project runs in two phases:

- **Phase 1 — AP page.** A full MFD page that gives a visible UI to NOAutopilot's existing
  features: status, targets, engage/disengage, its own nav mode, GCAS, autothrottle, auto-jammer,
  and autoland. Nothing from NOXMFD's MAP or WPT is fed to the autopilot.
- **Phase 2 — NOXMFD integration.** Couple the autopilot to NOXMFD features, starting with flying
  NOXMFD's WPT route.

NOXMFD's side of Phase 2 already shipped in
[NOXMFD 0.58.0](https://github.com/roke77/NOXMFD/releases/tag/0.58.0) (extension API version 7:
the WPT route reads and `SetActiveRouteNextIndex`, see NOXMFD's `docs/extensions-api.md`
section 8). Phase 1 needs no NOXMFD core change. This plan was checked against NOAutopilot 5.5.3.

## Source ticket

Player-submitted, [roke77/NOXMFD#86](https://github.com/roke77/NOXMFD/issues/86): add autopilot
functions to NOXMFD, or make it talk to
[NOAutopilot](https://github.com/qwerty1423/no-autopilot-mod). The same thread's request for
speed/altitude/heading in the TGT list is tracked separately as
[roke77/NOXMFD#88](https://github.com/roke77/NOXMFD/issues/88) and is out of scope here.

## NOAutopilot at a glance

A client-side BepInEx autopilot mod (MIT, `com.qwerty1423.NOAutopilot`). It works in multiplayer,
but some hosts prohibit it (GrayWar, Tomo's Co-Op/PvP at the time of writing), so this extension
treats it as optional. Its controls are keybinds plus an IMGUI **F8** window drawn on the main game
screen, which is awkward in VR or a sim pit. That is the main reason to put it on an MFD.

| Feature | What it does |
|---|---|
| Autopilot | Altitude hold, climb/descent to a target at a rate limit, wing leveller, bank-angle hold, course hold. Per-aircraft PID profiles. Stick input past a threshold disengages it. |
| Autothrottle | Speed hold in the game's units or Mach. |
| Nav mode | Flies a queue of waypoints placed by right-clicking the in-game map. |
| ALS | Autoland, using the AI landing logic. Planes only. |
| Auto-GCAS | Warns, then pulls up before ground impact. On by default. |
| Auto-jammer | Fires selected jammer pods whenever the capacitor is full and a target is selected. |
| Fuel time/range | HUD readout. |
| Extras | HUD AP readout, minimap resize/zoom, single-player FBW disabler, saved map position. |

## Integration surface

NOAutopilot has no API for other mods. Its live state is one public static class,
`NOAutopilot.Core.APData`, plus a few public static methods on `NOAutopilot.Core.Plugin`. The
extension reaches them by reflection, so there is no compile-time dependency on NOAutopilot and
the extension still loads when it's absent or has changed shape.

| Need | NOAutopilot member | Access | Phase |
|---|---|---|---|
| Engaged | `APData.Enabled` | read/write | 1 |
| Targets | `APData.TargetAlt` (m, `-1` = off), `TargetSpeed` (m/s or Mach, `-1` = off), `TargetCourse` (deg, `-1` = off), `TargetRoll` (deg, `-999` = off), `CurrentMaxClimbRate` (m/s) | read/write | 1 |
| Speed unit | `APData.SpeedHoldIsMach` | read/write | 1 |
| Apply typed targets | `APData.UseSetValues = true` alongside `Enabled = true` | write | 1 |
| Nav mode | `APData.NavEnabled`, `APData.NavQueue` (`List<Vector3>`, global coordinates) | read, write `NavEnabled`, remove entries | 1 |
| GCAS | `APData.GCASEnabled`, `GCASWarning`, `GCASActive` | read, write `GCASEnabled` | 1 |
| Auto-jammer | `APData.AutoJammerActive` | read/write | 1 |
| ALS | `APData.ALSActive`, `ALSStatusText` | read | 1 |
| Start autoland | `Plugin.StartAutoland()` | **private**, reflection only | 1 |
| Refresh F8 window and map markers | `Plugin.SyncMenuValues()`, `Plugin.RefreshNavVisuals()` | public static | 1 |
| Current state | `APData.CurrentAlt`, `CurrentRoll`, `PlayerRB`, `LocalAircraft` | read | 1 |
| Broken flag | `Plugin.IsBroken` | read | 1 |
| Replace the nav queue | `APData.NavQueue` | write | 2 |

Two NOAutopilot behaviors shape the design:

- **Engaging has side effects.** Its engage paths (key and F8 button) fill in a missing altitude
  target with the current altitude and a default bank limit when nav or course hold is on. Its
  disengage paths optionally clear nav and autothrottle (config-dependent). The extension copies
  the F8 button's logic rather than only flipping `Enabled`.
- **Its waypoint sequencing doesn't match NOXMFD's.** NOAutopilot pops `NavQueue[0]` within
  2,500 m, or when the point is behind the aircraft and within 10 km (`NavReachDistance`/
  `NavPassedDistance`). With "Cycle wp" on (the default), it re-appends the reached point to the
  end of the queue. NOXMFD advances at 1,000 m. This only matters in Phase 2 (decision 3).

## Prototype mockups

Early prototypes of the page, one per phase, in NOXMFD's own theme (HUD green, amber for
pending/selected, Share Tech Mono). Values are illustrative. The two differ only in the middle
panel: Phase 1 shows NOAutopilot's own nav mode, Phase 2 replaces it with the coupled WPT route.
Each is shown under its phase below.

## Phase 1 — AP page

![AP page mockup, Phase 1](images/ap-page-mockup-phase1.png)

Goal: every in-flight control from NOAutopilot's F8 window and keybinds is visible and usable on
the MFD, by click or touch. The page shows only what NOAutopilot already does. It reads nothing
from NOXMFD's MAP or WPT and never writes to `NavQueue` except to remove points, as the F8 window
does.

Page layout, top to bottom:

1. **Annunciator strip.** AP ENGD, NAV, A/THR, GCAS, JAM, ALS. GCAS steps through `GCAS ARM`
   (green, `GCASEnabled`), amber on `GCASWarning`, and red `PULL UP` on `GCASActive`.
2. **Target tiles.** ALT, SPD (KT/M toggle), CRS (HOLD/CLR), and BANK with the VS limit. Each shows
   the current value large and the target below. −/+ (or tapping the value for a keypad) edits a
   pending target, shown in amber.
3. **APPLY / ENGAGE-DISENGAGE / SYNC.** APPLY commits all pending targets at once, like the F8
   window's Apply, so stepping altitude doesn't jerk the aircraft on every tap. ENGAGE/DISENGAGE
   copies the F8 button's side effects. SYNC loads current altitude, speed and course into the
   pending targets.
4. **Nav mode panel.** NOAutopilot's own waypoint queue, as placed on the in-game map: NAV on/off,
   waypoint count, distance and ETA to the next point, total distance, and SKIP (drop the next
   point), UNDO (drop the last point), and CLEAR, matching the F8 window's buttons. Points are still
   placed on the in-game map through NOAutopilot itself.
5. **System toggles.** GCAS, A/THR, AUTO-JAM, ALS LAND (two-tap confirm), and the ALS status text.
6. **Footer.** NOAutopilot version and link state: `LINKED`, `NOT INSTALLED`, or `INCOMPATIBLE`.
   With NOAutopilot missing or incompatible, the controls are greyed out and the page says why.

Suggested build order within Phase 1:

1. **Read-only.** Plugin skeleton, `NoApBridge` in read-only mode, the published slice, and the page
   showing annunciators, current/target values, nav queue state, and link state. This proves
   reflection against the live game with no way to affect the aircraft.
2. **Controls.** Target tiles with pending/APPLY, engage/disengage, SYNC, KT/M, the nav panel's
   buttons, the GCAS/A/THR/AUTO-JAM toggles, and ALS LAND through the private `StartAutoland`.

## Phase 2 — NOXMFD integration

![AP page mockup, Phase 2](images/ap-page-mockup-phase2.png)

Goal: tie the autopilot into NOXMFD's own features. The first item is flying NOXMFD's WPT route;
the page's nav panel gains the WPT route view and COUPLE/DIRECT-TO/LOOP/DECOUPLE from the mockup.
Further integration candidates are open (see [Open questions](#open-questions)).

### Route coupling

NOXMFD's WPT route is the source of truth. `NavQueue` is a copy of it that the extension keeps in
sync.

- **Couple**: build `NavQueue` from `Points[NextIndex..]` of `Api.GetActiveRoute()` (or the single
  `Api.GetActiveSteerPoint()` when no route is active), set `NavEnabled = true`, then call
  `RefreshNavVisuals()` so NOAutopilot's own map markers match.
- **Re-sync**: whenever `Api.RouteRevision` changes (a WPT edit, route switch, or proximity
  advance), rebuild the queue the same way.
- **Advance mirroring**: when `NavQueue[0]` stops matching the expected `Points[NextIndex]`,
  NOAutopilot has reached it first. The extension calls `Api.SetActiveRouteNextIndex(NextIndex + 1)`,
  which bumps `RouteRevision` and triggers a normal re-sync. Comparing the head point rather than
  the queue length also handles "Cycle wp" re-appending.
- **Direct-to**: `SetActiveRouteNextIndex(i)`, then the re-sync does the rest. The HUD waypoint cue
  and WPT page follow automatically.
- **Loop**: when NOXMFD reports the route complete (`NextIndex == Points.Length`) with LOOP on,
  `SetActiveRouteNextIndex(0)`.
- **Decouple**: clear `NavQueue`, set `NavEnabled = false`, and leave NOXMFD's route alone.
- **Altitude**: NOXMFD waypoints have no altitude. Queue points take the current target altitude
  (`TargetAlt`, or current altitude if none), and nav steers laterally only.
- **Map edits**: while coupled, a right-click waypoint on NOAutopilot's map is overwritten on the
  next re-sync. The page shows this (decision 3).

## Architecture

- **One BepInEx plugin**: `[BepInDependency("com.roque.NOXMFD", MinimumVersion = "0.58.0")]`
  (hard) and `[BepInDependency("com.qwerty1423.NOAutopilot", BepInDependency.DependencyFlags.SoftDependency)]`
  (soft, for load order only). Phase 1 uses only registration, telemetry, and commands, but pins
  0.58.0 from the start so Phase 2 doesn't raise the requirement.
- **`NoApBridge`**: resolves `APData`/`Plugin` members once, by reflection, on first use. Every
  lookup that fails is logged with the member name and puts the bridge in `INCOMPATIBLE` rather
  than throwing. It also reads `Plugin.IsBroken`.
- **Main thread only.** State publishing runs from `Update()`, and commands arrive through the
  extension command handler, which NOXMFD already runs on the main thread. Nothing touches
  `APData` from the HTTP worker.
- **Telemetry**: `Api.PublishSlice("noap", json)` at NOXMFD's 10 Hz frame rate. The payload
  carries link state, annunciators, current/target values, and nav queue state. Phase 2 adds
  coupling state and the route snapshot with its revision.
- **Commands**: one flat JSON envelope `{cmd, …}` posted to `/ext/noap/command`. Phase 1: `apply`,
  `engage`, `disengage`, `sync`, `toggle`, `nav-skip`, `nav-undo`, `nav-clear`, `als`. Phase 2 adds
  `couple`, `decouple`, `direct-to`, `loop`. The handler validates every value at this trust
  boundary (finite numbers, sane ranges, known commands) before writing anything to `APData`.
- **Page**: `src/web/noap.{html,css,js}`, embedded in the DLL, reusing NOXMFD's
  `/assets/shared/theme.css` and `font.css`. Units follow the game's metric/imperial setting,
  like NOAutopilot's own UI.

## Design decisions

1. **Extension, not NOXMFD core.** NOXMFD stays free of integration-specific code, like the ATC and
   TAC extensions. The only core change was the generic route API, which any autopilot or
   navigation extension can use.
2. **Reflection, no compile-time reference.** NOAutopilot is optional, often banned by hosts, and
   its author calls the code due for a rewrite. Reflection with a logged `INCOMPATIBLE` state keeps
   NOXMFD and the page working when NOAutopilot is missing or changes.
3. **NOXMFD owns route progress (Phase 2).** Two independent sequencers would drift apart
   (2,500 m/passed versus 1,000 m, plus "Cycle wp"). NOXMFD's `RouteStore` stays the single
   authority, and the extension turns NOAutopilot's pops into `SetActiveRouteNextIndex` calls. LOOP
   is the extension's, not NOAutopilot's "Cycle wp".
4. **Click/touch only.** No new keybinds. NOAutopilot already has its own, and they keep working
   alongside the page.
5. **Apply-to-commit.** Target edits are pending until APPLY, matching the F8 window and keeping
   aircraft response predictable.
6. **Setup stays in F1.** PID tuning, minimap settings, and the FBW disabler are configuration, not
   in-flight controls, and stay in BepInEx's ConfigurationManager.
7. **No fuel page here.** Fuel time/range doesn't depend on NOAutopilot. If it's wanted, it
   belongs in NOXMFD itself as a separate ticket.
8. **Phase 1 is NOAutopilot-only.** The first release is a UI for features NOAutopilot already has,
   so it can ship and be tested on its own before any NOXMFD data drives the autopilot.

## Open questions

- Ask NOAutopilot's author (qwerty1423) for a small stable API, such as public `Engage`/`Apply`/
  `StartAutoland` methods, instead of relying on reflection into `APData` and a private method?
- Should the page also run while NOAutopilot's F8 window is open, or show a notice that both can
  edit the same targets?
- Phase 1: should the page also mirror the F8 window's remaining toggles ("Cycle wp", the
  autothrottle's extreme-throttle option, the single-player FBW disabler), or leave them to F8/F1?
- Phase 2: should COUPLE turn off NOAutopilot's "Cycle wp" for the session, or leave the player's
  config as it is?
- Phase 2: which NOXMFD integrations beyond route coupling are wanted (for example an AP cue on
  NOXMFD's HUD page)?
- Multiplayer: should the page show a warning banner in multiplayer sessions, given some hosts
  prohibit NOAutopilot?

## Out of scope

- TGT-list speed/altitude/heading (roke77/NOXMFD#88).
- Terrain following, auto take-off, helicopter-specific tuning (not NOAutopilot features either).
- Any change to NOAutopilot's source.
