# NOXMFD Extension: NOAutopilot

[![NOXMFD](https://img.shields.io/badge/Requires-NOXMFD%200.58.0%2B-blue)](https://github.com/roke77/NOXMFD)
![Status](https://img.shields.io/badge/Status-Planning-lightgrey)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Adds an **AP** page under [NOXMFD](https://github.com/roke77/NOXMFD)'s EXT nav that shows and
controls the [NOAutopilot](https://github.com/qwerty1423/no-autopilot-mod) mod from the MFD
instead of its in-game F8 window. Requested in
[roke77/NOXMFD#86](https://github.com/roke77/NOXMFD/issues/86).

Planned in two phases:

- **Phase 1 — AP page**: a visible UI for NOAutopilot's existing features. Status annunciators,
  current and target altitude, speed, course, and bank, apply and engage/disengage, NOAutopilot's
  own nav mode, and the GCAS, autothrottle, auto-jammer, autoland, afterburner/airbrake, and
  single-player FBW toggles, matching everything in NOAutopilot's F8 window. Click/touch only;
  NOAutopilot's own keybinds stay as they are.
- **Phase 2 — NOXMFD integration**: flying NOXMFD's WPT route (with direct-to and loop), and
  drawing NOAutopilot's own nav queue on NOXMFD's MAP.

Built entirely through NOXMFD's public extension API (see NOXMFD's
[`EXTENSIONS.md`](https://github.com/roke77/NOXMFD/blob/main/EXTENSIONS.md)). This repo does
**not** modify NOXMFD's or NOAutopilot's source. NOAutopilot is optional at runtime: without it,
the page loads and says why it's inactive.

## Status

Phase 1 in progress: the read-only AP page is built (status, targets, nav mode, and toggle states,
with no controls yet). See [`docs/noautopilot-plan.md`](docs/noautopilot-plan.md) for the design,
the integration surface, and the phasing.

## What's here

- `src/plugin/Plugin.cs` registers the **AP** EXT page and publishes NOAutopilot's state at 10 Hz.
- `src/plugin/NoApBridge.cs` reads NOAutopilot by reflection and builds the published slice.
- `src/plugin/NoApPageAssets.cs` serves the embedded `src/web/` files.
- `src/web/noap.{html,css,js}` is the page; `noap-format.js` holds its unit and sentinel helpers,
  checked by `node src/web/noap-format.test.js`.
- `lib/NOXMFD.dll` is a compile-time reference only (`Private=false`), not shipped.

## Building

Requires a local Nuclear Option install with BepInEx 5 and NOXMFD. If the game isn't at the default
Steam path, create a gitignored `GameDir.props` next to the `.csproj`:

```xml
<Project><PropertyGroup>
  <GameDir>D:\SteamLibrary\steamapps\common\Nuclear Option</GameDir>
</PropertyGroup></Project>
```

Then:

```bash
dotnet build NOAutopilotModule.csproj -c Release
```

The build copies `NOXMFD.NOAutopilotModule.dll` into `$(GameDir)\BepInEx\plugins\`.

## Requirements

- BepInEx 5
- [NOXMFD](https://github.com/roke77/NOXMFD) 0.58.0 or newer (extension API version 7)
- [NOAutopilot](https://github.com/qwerty1423/no-autopilot-mod) for the page to do anything

Some multiplayer hosts prohibit NOAutopilot. Check with the host before using it, especially in PvP.

## Installing

1. Install BepInEx 5, [NOXMFD](https://github.com/roke77/NOXMFD), and
   [NOAutopilot](https://github.com/qwerty1423/no-autopilot-mod).
2. Drop `NOXMFD.NOAutopilotModule.dll` into `BepInEx/plugins/`.
3. Launch the game. An **AP** entry appears under NOXMFD's EXT nav.
