# StandupTImer

An endless-loop posture timer that cycles through three phases repeatedly to encourage healthy movement habits throughout the day.

## Phase cycle

| Phase       | Duration | Activity                     |
|-------------|----------|------------------------------|
| 🪑 Sitting  | 40 min   | Sit down and focus           |
| 🧍 Standing | 15 min   | Stand up and stretch         |
| 🚶 Moving   | 5 min    | Walk around and energize     |

After the **Moving** phase the timer automatically restarts at **Sitting** — repeating forever.

## Features

- Endless automatic loop — no manual restart needed
- Large countdown display with colour-coded phases
- Progress bar that depletes as each phase runs down
- Visual + audio chime on every phase transition
- Warning beep at 30 seconds remaining
- **Skip** button to jump to the next phase immediately
- **Pause / Resume** support
- **Reset** button to return to the start
- Loop counter so you can track your cycles
- Keyboard shortcuts: `Space` = pause/resume, `R` = reset, `S` = skip
- Mute toggle to silence audio notifications

## Usage

Open `index.html` in any modern browser — no build step or server required.

## Files

| File         | Description                           |
|--------------|---------------------------------------|
| `index.html` | App markup                            |
| `style.css`  | Dark-theme styles & animations        |
| `timer.js`   | Timer logic, phase transitions, audio |
