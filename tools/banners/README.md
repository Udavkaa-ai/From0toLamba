# Banner generator — Из грязи в князи

Generates the 90 deal banner images for the Telegram Mini App
(6 archetypes × 5 deal types × 3 variants) using Google AI Studio's
`gemini-3.1-flash-image-preview`.

## Files in this folder

| File              | Purpose                                                     |
|-------------------|-------------------------------------------------------------|
| `characters.json` | 3-5 visual variants per archetype (different individuals)   |
| `deals.json`      | 3 scene compositions per deal type                          |
| `style_anchor.txt`| Three style options + shared suffix (Bilibin / Vasnetsov / Lubok) |
| `generate.py`     | Driver: builds prompts, calls Gemini, saves PNGs            |

## Output

Files land in `tools/banners/output/<ARCHETYPE>_<DEAL>_<NN>.<ext>`,
e.g. `output/BABA_YAGA_POTION_BREW_01.png`. The folder is git-ignored.

## Setup

```bash
pip install google-genai pillow
export GEMINI_API_KEY=your_studio_key   # or GOOGLE_API_KEY
```

Get the key from <https://aistudio.google.com/app/apikey>. The free tier
gives ~500 generations / day on `gemini-3.1-flash-image-preview` and roughly
10 RPM; `generate.py` defaults to 8 RPM so it stays under the cap.

## Usage

```bash
# Smoke test — first 2 images only
python generate.py --limit 2

# Try a different style anchor
python generate.py --style vasnetsov --limit 3

# Just one archetype
python generate.py --only BABA_YAGA

# Just one (archetype, deal) pair — 3 variants
python generate.py --only IVAN_DURAK --only-deal HONEST_TRADE

# Print prompts without calling the API (for sanity-check)
python generate.py --dry --limit 5

# Full run — resumable; existing files are skipped automatically
python generate.py
```

`--force` overwrites existing files. Without it the script is idempotent —
re-running picks up where it stopped.

## Style picking

`style_anchor.txt` has three labelled blocks: `[bilibin]`, `[vasnetsov]`,
`[lubok]`, plus one `[shared suffix …]` block that's appended to all of
them. Choose with `--style <key>`. Default: `bilibin`.

Recommended workflow:
1. Run `generate.py --style bilibin --limit 6` (~6 different
   archetype/deal pairs).
2. Eyeball the result. If it looks too flat, repeat with
   `--style vasnetsov`. Pick a winner.
3. Run the full set with the chosen style.

## Rate limiting & retries

- Steady-pace token bucket at `--rpm` requests/min (default 8).
- 5 retries per image with exponential backoff (4s → 8s → 16s → 32s → 64s,
  + small jitter). Enough to ride out 429 quota bumps without losing progress.
- Failed images are reported at the end; just re-run to retry them.

## Integration with the game

After `python generate.py` finishes, copy the images into the client
public folder:

```bash
mkdir -p ../../tg/client/public/banners
cp output/*.png ../../tg/client/public/banners/
# (optional) compress to webp for smaller bundle:
# for f in ../../tg/client/public/banners/*.png; do cwebp -q 80 "$f" -o "${f%.png}.webp"; done
```

`tg/client/public/` is copied verbatim into `tg/server/public/` by Vite at
build time, so files are served at `/banners/<ARCHETYPE>_<DEAL>_<NN>.<ext>`
on Railway.

Then update `generateProjectBanner()` in
`tg/server/src/ai/openRouterClient.ts` to use the local files:

```ts
export async function generateProjectBanner(
  projectId: string,
  _projectName: string,
  type: ProjectType,
  archetype: PersonaArchetype,
): Promise<void> {
  const variant = (parseInt(projectId.slice(-2), 16) % 3) + 1
  const file = `${archetype}_${type}_${String(variant).padStart(2, '0')}.webp`
  await prisma.project.update({
    where: { id: projectId },
    data: { bannerImageUrl: `/banners/${file}` },
  }).catch(err => console.error('[Banner] DB update failed:', err))
}
```

The variant is deterministic on `projectId`, so the same project always shows
the same banner. Adding more variants later: drop more files and bump the
modulo.
