# UI and Rendering

## UI ownership

`modules/ui/ui.js` is the main HUD/navigation/panel shell. It lazily builds primary panels and owns management-mode layout integration.

Panel/source ownership is mapped in `CODEMAP.md`.

`index.html` currently contains the full stylesheet as well as the canvas/application roots and browser import map. A CSS interaction bug may therefore live in `index.html`, not in a separate CSS file.

## Management mode and time

`modules/ui/management.js` centralizes shared management behavior so UI layout and simulation speed do not drift apart.

Current constants:

- tactical time scale: **0.30**;
- live management battlefield share: **0.30**;
- live management panel share: **0.56**;
- Command Phase panel share: **0.86**.

Live combat + an open management panel eases toward tactical slowdown. A cleared-wave intermission that the player intentionally pauses becomes a Command Phase and can stop combat while expanding the management panel.

`modules/main.js` is the final authority on what ticks during these states.

## Modal contract

Owner: `modules/ui/modals.js`.

Critical v1.17.6 interaction invariants:

- `#modal` is `pointer-events:none` while closed.
- `#modal.on` becomes `pointer-events:auto` while open.
- opening a modal locks background interaction through inert handling;
- the lock operation first clears stale tracked inert state;
- `closeModal()` restores background interaction even if modal visibility was interrupted/lost;
- focus is moved into the modal and Tab is trapped appropriately;
- dismissable dialogs can close with Escape;
- required onboarding dialogs cannot be bypassed with Escape.

Do not remove these as "redundant" CSS/JS. They were added to recover a real whole-interface click failure.

## Touch / purchase interaction

`modules/ui/dom.js` owns shared hold/tap behavior used by purchase controls.

A scroll/drag gesture must never commit a purchase. Pointer-down alone is not sufficient; the helper distinguishes taps, movement and holds.

Keyboard activation must remain possible for focused controls. `modules/main.js` deliberately avoids stealing Space/arrow behavior from buttons, inputs, textareas, selects and contenteditable elements.

## Onboarding UI

`modules/meta/onboarding.js` provides serialized lesson/briefing/objective state. `ui.js` routes the user to real controls and evaluates important panel-open tutorial gates synchronously.

Blocking briefing semantics matter:

- while reading required guidance, the whole game clock can be frozen;
- after acknowledgement, the relevant real control can be highlighted;
- already-performed actions should smart-skip impossible/stale tutorial gates;
- lessons should not stack into a permanent combat overlay.

## Ship Loadout / equipment picker

`modules/ui/panels/modules.js` is the central paper doll.

`modules/ui/equipment-picker.js` has an explicit preview/apply contract:

- selecting an option previews it;
- preview alone does not mutate loadout;
- apply/confirm calls the owner action;
- a failed/stale apply leaves the picker open and explains the failure;
- removal preserves inventory ownership where appropriate.

Avoid browser-native select dialogs for these game equipment flows.

## Icons

Owner: `modules/ui/icons.js` and `assets/icons/`.

The source-atlas and runtime-slice contract is verified by `tests/icon-atlas-regression.mjs`:

- the source/reference atlas remains 8 columns x 8 rows with 64 mapped cells;
- all named normalized slice files exist;
- runtime gameplay mappings resolve to those individual slice files rather than CSS atlas offsets;
- a missing runtime slice degrades to a visible text glyph instead of silently blanking the icon;
- unmapped exotic materials can use the colour-aware vector fallback.

Using normalized slices avoids sprite-position drift and prevents one failed atlas request from removing every game icon. Runtime slices intentionally suppress the bright cyan corner-bracket accents from the original atlas cells, while retaining the dark tile/frame and central art. Decorative icon wrappers and their images are deliberately `pointer-events:none` so clicks land on the underlying button/control.

Reward rows use a fixed icon slot. In particular, `.gain` label flex styling must never apply to `.material-icon`; material reward icons are fixed square flex items so ore/bar artwork cannot stretch across the dialog.

## Renderer contract

`modules/rendering/renderer.js` states its boundary explicitly: it reads simulation arrays, drains `world.fx` and does not write game progression state.

The renderer uses:

- Three.js WebGLRenderer;
- procedural geometry from `geometry.js`;
- instanced meshes for repeated enemies/barriers/drones;
- sprite batches and particle/transient helpers from `effects.js`;
- sector backgrounds from `background.js`;
- a 2D overlay for labels/bars/floating text.

When adding a new visual effect, prefer expressing it as world/fx data from simulation and consuming it in rendering rather than calling rendering code directly from deep combat logic.

## Adaptive rendering

Renderer quality can adapt using sustained-frame-time hysteresis. Avoid one-frame oscillation logic or UI-driven quality toggles that fight this mechanism.

## Manual validation for UI/render work

Automated tests do not render a real browser. After UI/CSS/render/input changes:

- boot in a browser with console open;
- test mouse and keyboard;
- if touch behavior was affected, test pointer-drag/scroll/tap paths;
- open/close affected modals repeatedly;
- verify the background becomes interactive again;
- verify the battlefield still receives pointer input outside management/modal surfaces;
- check the Ship Loadout at both sparse and expanded slot counts where relevant.