# Interaction states (P8)

A static screenshot shows only the default state. Most "I can't see the button"
reports come from a state nobody captured. A common example is a link styled as a
button: the global `a:hover` colour wins over the button's own text colour, so the text
turns the same colour as the background.

## State matrix

Check each control type in each state that applies. "Differs" means visibly different
from default without relying on colour alone (an outline, underline, weight, shadow or
icon change).

| Control | Default | Hover | Focus (keyboard) | Active | Disabled | Selected / current | Loading | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Primary button (button and link) | contrast | contrast kept, differs | ring ≥ 3:1 | differs | readable label, not-allowed cursor | – | label or spinner, no double submit | – |
| Secondary or ghost button | contrast, border ≥ 3:1 | differs | ring | differs | readable | – | – | – |
| Text link | contrast, distinguishable from text | underline or colour | ring | – | – | aria-current marked | – | – |
| Input, select, textarea | border ≥ 3:1, label visible | – | ring or border change | – | readable value | – | – | message, aria-invalid, focus moves to the first error |
| Checkbox, radio, switch | border ≥ 3:1 | – | ring | – | readable | checked state differs | – | message |
| Tab, chip, segmented control | contrast | differs | ring | – | – | selected differs | – | – |
| Card that is a link | – | differs | ring around the card | – | – | – | – | – |
| Menu or dropdown item | contrast | background change | ring or background | – | readable | current marked | – | – |
| Map marker or popup control | contrast on map tiles | differs | ring visible on light and dark tiles | – | – | selected differs | – | – |

## Overlays and feedback

- **Dialog or drawer:** opens with focus inside, traps Tab, closes with Esc and a
  visible close button, and returns focus to the trigger. The page behind does not
  scroll. The dialog is readable at 320px.
- **Menu or dropdown:** opens with the keyboard, moves with arrow keys, closes on
  outside click and Esc, and does not overflow the viewport edge.
- **Toast:** solid background (no translucency on busy pages), contrast ≥ 4.5:1, stays
  long enough to read (≥ 4s, or until dismissed for errors), does not cover the main
  action, and is announced through `aria-live`.
- **Cookie or consent banner:** does not hide the main action on phones; the settings
  view is readable and has a reachable save button.
- **Loading:** a skeleton or spinner within 300ms; no layout jump when the content
  arrives; a slow request (> 10s) shows a message.
- **Empty:** says what is missing and the next action. A bare "no data" is not enough.
- **Error:** says what happened and what to do, in Thai, with a retry or a way back.
  It never shows raw API text or stack traces.
- **Session expiry or permission denied:** explains the situation, offers sign-in or
  a way back, and returns the user to where they were after sign-in.

## Contrast rules

- Text ≥ 4.5:1, or ≥ 3:1 for large text (≥ 24px, or bold ≥ 18.7px).
- Focus rings, input borders and control boundaries ≥ 3:1 against the adjacent colour.
- On gradients or images, measure against the worst point.
- Disabled controls are exempt from WCAG contrast, but their label must still be
  readable. Aim for ≥ 3:1 so users know what is disabled.

## How to check

1. Run `node scripts/ui_states.mjs --url <page> --widths 375,1440 --out 08-states`. For
   each visible control it measures default, hover, focus (Tab) and active. Read its
   report for these flags:
   - `hover-hides-text`;
   - `low-contrast`;
   - `no-focus-indicator`;
   - `state-identical`.
2. For overlays and the loading, empty, error and expiry states, trigger them by hand:
   - submit empty forms (local only);
   - block a request in DevTools;
   - log out mid-flow;
   - open every dialog.
3. Fix in shared tokens or components first. Add a regression test that lists every
   variant, so a new variant cannot miss the rule.
