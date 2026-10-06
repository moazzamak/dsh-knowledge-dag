# Changelog

All notable changes to this plugin are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versions 0.1.0 through 0.5.0 existed only as commits in this repository, untagged
and unpublished; they are listed below so the record is complete. 0.6.0 is the
first public release.

## [Unreleased]

## [0.6.1] — 2026-10-06

### Fixed

- **The stylesheet is now owned by this plugin, which is what keeps it applied.**
  The harness client loader owns plugin styles by the `data-plugin` attribute:
  it claims every `<style>` that lacks it for whichever plugin materialises
  next, and deletes every `<style>` whose `data-plugin` equals an id when that
  entry is replaced or pruned. The sheet carried only a private
  `data-dsh-knowledge-dag` marker, so it looked unowned to the loader — another
  plugin took it and the first refresh or prune of that plugin deleted it. The
  sheet is injected while `apply` runs, which is after the loader's claim pass,
  so this plugin's own claim never saw it either. Losing it is silent and
  severe: an SVG `<path>` with no `fill: none` fills black, so the graph drew as
  black shapes, and buttons fell back to the browser's default control. The sheet
  now carries `data-plugin` and `data-plugin-css`, and a second `apply` no longer
  stacks a duplicate.
- The frame trigger no longer positions itself with `position: fixed` at the top
  right, where the window controls (minimise/maximise/close) are painted over it
  and it cannot be clicked. It sits in the frame's overlay seat as a normal icon
  button of that row.

### Added

- `tests/activate.mjs` now asserts the ownership tagging, so the sheet cannot
  silently become unowned again.

## [0.6.0] — 2026-10-04

First public release: the plugin is installable from GitHub, carries a license,
and ships the gate that proves its browser half still activates.

### Added

- **The node-link graph view.** The pane's third tab draws the record as nodes and
  descent edges in one SVG: a node's colour is its status, a dashed edge crosses
  tracks, hovering lights a node's own edges, and the panel's filters dim the
  nodes they exclude instead of removing them, so the shape of the record
  survives the question "where is this one". Pan, zoom, and a fit control belong
  to the reader; the layout is computed once in graph coordinates.
- **`tests/activate.mjs`** — an activation gate for the browser half. The bundle
  has no build step, so nothing type-checks it and nothing loads it outside a
  browser: a broken `client.cjs` otherwise surfaces only as the harness boot
  audit reporting that the entry did not activate. The gate evaluates the real
  bundle, calls `apply` over service fakes that enforce the 0.2.0 registry rules,
  renders every registration once, and checks that the frame trigger reads the
  on-screen session.
- `LICENSE` (MIT) and `.gitattributes`, which keeps the two committed halves in
  LF so a clone does not show a line-ending diff.

### Fixed

- **The frame trigger read the wrong session.** `sidebarRight.openTabs` is not one
  session's tab list: it is the pane's inventory of saved and adopted layouts,
  flattened across every session, and each record carries its own `sessionId`. The
  trigger asked "is this kind open anywhere", so with a knowledge-graph tab open
  in any session every session's button read *open* and its click **closed** the
  column instead of opening the graph. It now reads the on-screen session from
  `sidebarRight.mounted` and watches both sources, and it reads closed when no
  session is on screen.

### Changed

- The README is written for someone installing the plugin rather than for the
  author planning it, and no longer contains absolute paths from one machine.

## [0.5.0] — 2026-10-01

### Fixed

- The row-config schema, which failed the composition row at boot.
- A registered tool must declare its `output` as `{ schema, render }`; without it
  the row fails its second boot check.

### Changed

- The console moved into the right pane, where the other tab types live.

## [0.4.0] — 2026-10-01

### Added

- Structural analogs: Gentner structure-mapping over the node store, so a node
  page can answer "which other node has this one's shape on a different surface".
  A signature is built from relational structure only — role and fate, the shape
  of the registered uncertainty, the decision space, the evidence, and lineage
  topology — while the surface (track and wording) is used only to penalise
  surface-similar pairs.

## [0.3.0] — 2026-10-01

### Added

- The viewer became a steering console: the **board** (every node with
  kind/track/status/verdict, filterable, with live counts), the **frontier** (what
  is open or running, each with its prediction, falsifier, and decision menu), and
  a structured node page (story beats, decision menu, measured outcome, lineage).

## [0.2.0] — 2026-10-01

### Fixed

- The plugin activates and works: the wire format between the two halves, the
  file-system service contract, and node identity.

## [0.1.0] — 2026-10-01

### Added

- The research-graph viewer plugin for DeepSeek Harness: a node store read from
  the host, a tab in the right pane, and the `knowledge_dag` tool.

[Unreleased]: https://github.com/moazzamak/dsh-knowledge-dag/compare/v0.6.1...HEAD
[0.6.1]: https://github.com/moazzamak/dsh-knowledge-dag/releases/tag/v0.6.1
[0.6.0]: https://github.com/moazzamak/dsh-knowledge-dag/releases/tag/v0.6.0
