# Combat Visualizer

Web-based replay viewer for combat simulations. Watch battles play out tick by tick with full statistics.

## Quick Start

Record a battle from the main runner:

```bash
cd simulation
node runner.mjs --mode quick --record my-battle.json
```

Start the visualizer:

```bash
cd visualizer
node serve.mjs
```

Open http://localhost:3000/, load `my-battle.json`, and hit play.

## Recording Battles

Any runner mode can record. Just add `--record <filename>`:

```bash
node runner.mjs --mode random --battles 100 --record random-battle.json
node runner.mjs --mode predefined --scenario ranged_kite --record kite-test.json
```

The runner records one battle from the first matchup and saves it to the specified file.

## Controls

Play/pause/reset buttons work as expected. Click anywhere on the timeline to jump. Speed slider goes from 0.25x to 20x.

Green squares are your creeps, red squares are enemies. Gray background is swamp terrain. Yellow lines are attacks, cyan lines are heals. Health bars change from green to yellow to red as creeps take damage.

The sidebar shows live stats: total damage dealt, healing done, and survivors for both teams.
