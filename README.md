# NOXMFD Extension: NOAutopilot

[![NOXMFD](https://img.shields.io/badge/Requires-NOXMFD%200.58.0%2B-blue)](https://github.com/roke77/NOXMFD)
![Status](https://img.shields.io/badge/Status-Planning-lightgrey)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Adds an **AP** page under [NOXMFD](https://github.com/roke77/NOXMFD)'s EXT nav that shows and
controls the [NOAutopilot](https://github.com/qwerty1423/no-autopilot-mod) mod from the MFD
instead of its in-game F8 window, and lets the autopilot fly the route built on NOXMFD's WPT page.
Requested in [roke77/NOXMFD#86](https://github.com/roke77/NOXMFD/issues/86).

Planned features:

- **Autopilot status**: engaged, nav mode, autothrottle, GCAS, auto-jammer, and ALS annunciators,
  plus current and target altitude, speed, course, and bank.
- **Autopilot controls**: set targets, apply, engage/disengage, and toggle GCAS, autothrottle,
  auto-jammer, and autoland. Click/touch only; NOAutopilot's own keybinds stay as they are.
- **Fly the WPT route**: couple NOAutopilot's nav mode to NOXMFD's active route, with direct-to
  and loop.

Built entirely through NOXMFD's public extension API (see NOXMFD's
[`EXTENSIONS.md`](https://github.com/roke77/NOXMFD/blob/main/EXTENSIONS.md)). This repo does
**not** modify NOXMFD's or NOAutopilot's source. NOAutopilot is optional at runtime: without it,
the page loads and says why it's inactive.

## Status

Planning. See [`docs/noautopilot-plan.md`](docs/noautopilot-plan.md) for the design, the
integration surface, and the phasing.

## Requirements

- BepInEx 5
- [NOXMFD](https://github.com/roke77/NOXMFD) 0.58.0 or newer (extension API version 7)
- [NOAutopilot](https://github.com/qwerty1423/no-autopilot-mod) for the page to do anything

Some multiplayer hosts prohibit NOAutopilot. Check with the host before using it, especially in PvP.
