# NOXMFD Extension: NOAutopilot

[![NOXMFD](https://img.shields.io/badge/Requires-NOXMFD%200.58.0%2B-blue)](https://github.com/roke77/NOXMFD)
[![NOAutopilot](https://img.shields.io/badge/Requires-NOAutopilot-lightgrey)](https://github.com/qwerty1423/no-autopilot-mod)
[![Version](https://img.shields.io/badge/Version-0.1.2-green)](https://github.com/roke77/NOXMFD-Extension-NOAutopilot/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Adds an **AUTO PILOT** page to [NOXMFD](https://github.com/roke77/NOXMFD)'s browser MFD that shows
and controls the [NOAutopilot](https://github.com/qwerty1423/no-autopilot-mod) mod: set altitude,
speed and course, engage the autopilot, fly NOAutopilot's waypoints, and toggle GCAS, autothrottle
and autoland from a tablet or second screen, instead of NOAutopilot's in-game F8 window.

Built entirely through NOXMFD's public extension API (see
[`EXTENSIONS.md`](https://github.com/roke77/NOXMFD/blob/main/EXTENSIONS.md)). This repo does
**not** modify NOXMFD's or NOAutopilot's source.

> [!IMPORTANT]
> **Install order:** BepInEx 5 → [NOAutopilot](https://github.com/qwerty1423/no-autopilot-mod) → [NOXMFD](https://github.com/roke77/NOXMFD) (≥ 0.58.0) → **`NOXMFD.NOAutopilotModule.dll`**.

> [!WARNING]
> Some multiplayer hosts prohibit NOAutopilot. Check with the host before using it, especially in PvP.

---

## Table of contents

- [Features](#features)
- [Using the page](#using-the-page)
- [Installing](#installing)
- [Links](#links)
- [What's here](#whats-here)
- [Building](#building)
- [Credits](#credits)

---

## Features

- **Speed, altitude and heading tapes** laid out like the in-game HUD, each with the autopilot's
  target marked. Units follow the game's Metric/Imperial setting; speed can hold in KT/KM/H or Mach.
- **Set targets by touch:** ▲▼ ‹ › and −/+ step the speed, altitude, course, bank limit and V/S
  limit, or tap a target marked with the keypad icon to type it. Changes stay pending (amber) until
  **APPLY**; **SYNC** loads your current altitude, speed and course.
- **AP ring** to engage and disengage, and **HOLD** / **CLR** for the course.
- **NOAutopilot's nav mode:** distance and ETA to the next waypoint and to the end, plus NAV,
  CYCLE WP, SKIP, UNDO and CLEAR. Waypoints are placed on the in-game map, as in NOAutopilot.
- **Toggles:** GCAS (with warning and PULL UP), A/THR, AB/BRK, JAM, FBW OFF (single player) and ALS
  autoland. FBW OFF and ALS are guarded: a confirming second tap turns them on, one tap turns them
  back off.
- Works alongside NOAutopilot's F8 window and keybinds. Without NOAutopilot, or with a version it
  can't read, the page says why instead of breaking.

![AUTO PILOT page in NOXMFD](docs/images/AP.png)

---

## Using the page

1. In NOXMFD, open **EXT → AUTO PILOT**.
2. Step or type the targets you want (they turn amber), then press **APPLY** to engage with them,
   or tap the **AP** ring to engage (it holds your current altitude if no altitude target is set).
3. To fly waypoints, place them on the in-game map with NOAutopilot (right-click), then turn on
   **NAV**.

Tapping the speed or altitude target opens the keypad:

![AUTO PILOT keypad](docs/images/AP_NUM_PAD.png)

---

## Installing

1. Install BepInEx 5, [NOAutopilot](https://github.com/qwerty1423/no-autopilot-mod) and
   [NOXMFD](https://github.com/roke77/NOXMFD) 0.58.0 or later.
2. Download `NOXMFD.NOAutopilotModule_<version>.zip` from the
   [latest release](https://github.com/roke77/NOXMFD-Extension-NOAutopilot/releases/latest) and
   extract it into `BepInEx/plugins/`.
3. Launch the game. An **AUTO PILOT** entry appears under NOXMFD's EXT nav.

---

## Links

- [Releases and changelog](https://github.com/roke77/NOXMFD-Extension-NOAutopilot/releases)
- [NOXMFD](https://github.com/roke77/NOXMFD): the browser MFD this page runs in
- [NOAutopilot](https://github.com/qwerty1423/no-autopilot-mod): the autopilot mod this page controls
- [Original request, roke77/NOXMFD#86](https://github.com/roke77/NOXMFD/issues/86)
- [Design and roadmap](docs/noautopilot-plan.md)

---

## What's here

- `src/plugin/Plugin.cs` registers the **AUTO PILOT** EXT page and publishes NOAutopilot's state.
- `src/plugin/NoApBridge.cs` reads and writes NOAutopilot by reflection.
- `src/plugin/NoApCommands.cs` validates the page's commands and applies them as NOAutopilot's F8
  window and keybinds do.
- `src/plugin/NoApPageAssets.cs` serves the embedded `src/web/` files.
- `src/web/noap.{html,css,js}` is the page; `noap-format.js` holds its pure helpers, checked by
  `node src/web/noap-format.test.js`.
- `tools/preview.py` previews the page in a browser with mock telemetry.
- `lib/NOXMFD.dll` is a compile-time reference only, not shipped to players.

---

## Building

Requires a local Nuclear Option install with BepInEx 5 and NOXMFD. If the game isn't at the default
Steam path, create a gitignored `GameDir.props` next to the `.csproj`:

```xml
<Project><PropertyGroup>
  <GameDir>D:\SteamLibrary\steamapps\common\Nuclear Option</GameDir>
</PropertyGroup></Project>
```

```bash
dotnet build NOAutopilotModule.csproj -c Release
```

The build copies `NOXMFD.NOAutopilotModule.dll` into `$(GameDir)\BepInEx\plugins\`.

To check the page without the game, run `python tools/preview.py 8790` and open
`http://localhost:8790/`. It reads NOXMFD's shared assets from a sibling `../NOXMFD` checkout (or a
path given as the second argument); `/scenario?s=<name>` switches the mock state, as listed in the
script's header.

---

## Credits

- [NOAutopilot](https://github.com/qwerty1423/no-autopilot-mod) by qwerty1423 and contributors,
  which does all the flying.
- [NOXMFD](https://github.com/roke77/NOXMFD) by roke77.
