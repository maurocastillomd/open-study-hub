# Study Hub

A free, private study hub for any certification exam. Tell it your exam date, how many hours a day you can study and how you learn best. It builds a day-by-day plan, checks where you are weak, and turns your own study sources into lessons, practice questions and flashcards.

Everything runs in your browser. There is no account, no server and no database. Your progress stays on your device.

## What it does

- **Setup in five answers:** your name, the certification, the exam date, daily study hours and learning style (visual, reading, practice or mixed).
- **Quick check:** a short quiz across every area. The plan gives more time to areas with a high exam weight and a low score.
- **Today:** the day's plan split into learning, flashcards and practice, a countdown and the next seven days. The last week shifts to practice and review, and the day before the exam is light.
- **Learn:** each lesson opens with a picture of its main idea, drawn as a small working machine with the [Anatomy](https://github.com/wheresryan22/anatomy) figure kit: gauge blocks under a dial for steps, a rotary index table for a cycle, a balance for a comparison and a chest of drawers for layers. Tap a part and the machine shows it. Lessons built from your uploads get the same pictures.
- **Practice:** multiple-choice questions with explanations, weakest area first or mixed, plus flashcards on a spaced schedule (1, 3, 7, 14 and 30 days).
- **Sources:** upload PDF, text or Markdown files. Claude reads them and writes lessons, questions and flashcards, then the plan updates.
- **Top bar:** hide or show the menu, switch day and night, open your bookmarks, and search every lesson, question and flashcard (press / to jump to search). Save any lesson, question or card with its bookmark button.
- **Progress:** score by area against your quick check, lessons done, cards learned, study streak, and backup download and restore.

**Try it:** https://maurocastillomd.github.io/open-study-hub/

It ships with a small sample about how to study, so you can try everything before you upload your own material.

## Run it on your computer

You need a simple web server, because browsers block these files when opened straight from disk. If you have Python 3 (built into macOS):

```bash
cd study-hub-open-source
python3 -m http.server 4173
```

Then open http://localhost:4173 in your browser. If you prefer Node.js, `npm start` does the same.

## Put it online for free

Any static host works, because the site is just files.

- **GitHub Pages:** fork this repository, open *Settings → Pages*, choose *Deploy from a branch*, pick `main` and `/ (root)`, and save. Your hub appears at `https://<your-name>.github.io/<repo-name>/` after a minute.
- **Netlify or Cloudflare Pages:** connect the repository. There is no build command; the output folder is the repository root.

Each visitor's progress is stored in their own browser, so one public copy can serve many people without them seeing each other's data.

## Building lessons from your sources

Turning a PDF into lessons needs an AI model. The hub uses the Claude API with **your own Anthropic API key**:

1. Create a key at [console.anthropic.com](https://console.anthropic.com) and add a little credit.
2. In the hub, open **Settings** and paste the key. It is saved only in your browser and sent only to Anthropic.
3. Go to **Sources**, add your files and press **Build my hub from these files**.

Good to know:

- Each file is one request. Split long books into chapters (under 30 MB and a few hundred pages each) for better results.
- Claude Opus 5.5 gives the best lessons. Sonnet 5.5 and Haiku 5.5 cost less; choose one in Settings.
- Requests use structured output, so every reply is checked against a fixed shape before it enters your hub. Opus and Sonnet requests also ask Anthropic to retry on a fallback model if a request is declined.
- Only upload material you have the right to use. The generated lessons stay in your browser.
- Don't save your key on a shared or public computer. Remove it from Settings when you are done.

## Your data

- Profile, progress, lessons and cards are saved in the browser's local storage on this device.
- **Settings → Erase everything** clears it. **Progress → Download backup** saves a copy you can restore on another device. Backups never include your API key.
- Clearing your browser's site data also erases your hub, so keep a backup.

## Project layout

| Path | What it holds |
| --- | --- |
| `index.html` | The page shell |
| `css/app.css` | All styles, light and dark |
| `js/app.js` | Screens, navigation and the study sessions |
| `js/planner.js` | The study plan and area scores (no browser code, so it is tested in Node) |
| `js/figures.js` | The lesson pictures, built for 2 to 6 parts |
| `js/vendor/anatomy/` | The Anatomy isometric figure kit (MIT, see its LICENSE) |
| `css/iso.css` | The kit's figure styles |
| `js/search.js` | Search across lessons, questions and flashcards |
| `js/cards.js` | Flashcard spacing |
| `js/generate.js` | The Claude request, reply checks and merging into your hub |
| `js/store.js` | Saving, backup and restore |
| `content/sample-pack.js` | The sample lessons |
| `tests/` | Tests for the planner, flashcards, source merging and pictures; `tests/figures-preview.html` shows every picture kind |

Run the tests with `npm test` (Node.js 20 or later).

## How the plan works

1. Days left = exam date minus today.
2. Each area's share of study time = exam weight × (1.5 − score). An area with no score yet counts as 1. Shares are scaled to add up to 100%.
3. Each day's focus goes to the area furthest behind its share so far, so focus days rotate in proportion.
4. Daily minutes are split by learning style (for example, visual: 45% learning, 25% flashcards, 30% questions). In the final seven days the split becomes 15% / 30% / 55%. The day before the exam is a 30-minute card review.
5. Scores use your quick check plus your last three tries at each practice question, so fixed mistakes stop counting against you.

## License

MIT. See [LICENSE](LICENSE).
