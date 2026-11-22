# Tech Pack Studio

A private product-development tool for a women's loungewear brand. Describe a piece in plain words (and add photos or sketches), and it builds everything a factory needs: tech pack, product renders, technical flats, measurement guide, detail callouts, print files, labels and a ready-to-send quote request.

## The flow

**Create**: type the idea, toggle Brand DNA on or off, attach up to 4 photos.

**1 · Design**
- Chat with the design assistant (Claude) to build and change the tech pack.
- Front, side and back product renders, made automatically after the first tech pack.
- Mockups and campaign shots: flat lay, on model, lifestyle, close-up. Each can be edited (“make it sage”).

**2 · Specs** (with an Outputs checklist on the right)
- **Basic Product Specs**: product info, colours and pattern, materials (bill of materials), construction and trims, open questions.
- **Flat Sketches**: front and back SVG flats, POM (measurement guide plus an editable graded size chart with tolerances), technical sketch with numbered construction callouts, coloured sketch in any colourway.
- **Detailed Specs**: click on any image to pin a detail, or let AI find them. Each pin gets an AI close-up. Components list.
- **Print Files**: seamless repeat tiles or placement graphics (AI or upload), with placement and size in cm.
- **Labels & Tags**: woven or care label and hang tag (AI or upload), with position and notes.

**3 · Hand off**
- Readiness checklist.
- Tech pack PDF (print view, then “Save as PDF”).
- Factory pack ZIP: SVG flats, images, prints, labels, `measurements.csv`, `bill-of-materials.csv`, `tech-pack.json`.
- AI-written quote-request email to copy into your own mail.

## Setup (once)

1. Install Node.js 20+.
2. Get a Claude API key at https://platform.claude.com/ and an OpenAI API key at https://platform.openai.com/api-keys.
3. Copy `.env.example` to `.env.local` and paste both keys.
   Optional settings: `OPENAI_IMAGE_MODEL` (default `gpt-image-2`) and `OPENAI_IMAGE_QUALITY` (`low` | `medium` | `high`, default `medium`).
4. Run `npm install`.

## Run

```
npm run dev
```

Open http://localhost:3000

## Where things are saved

Everything is stored on this computer in `./data` (products as JSON, images and drawings in `data/uploads`). That folder and `.env.local` are git-ignored, so designs and keys never go to GitHub. Back up `data/`.

## Costs (pay-as-you-go API usage)

Roughly: tech pack $0.10–0.25 per update; 3 product views about $0.25; mockup, close-up, print or label about $0.05–0.15 each; flats about $0.40; technical sketch about $0.20.

## Code map

- `src/lib/ai.ts`: Claude calls (tech pack, flats, technical sketch, details, quote email). Structured JSON output.
- `src/lib/imagegen.ts`: OpenAI image calls and prompts (views, mockups, close-ups, prints, labels).
- `src/lib/schema.ts`: data model and output status.
- `src/lib/store.ts`, `src/lib/files.ts`: local storage (JSON plus images; AI SVGs are sanitised).
- `src/lib/route.ts`: API helper that merges concurrent edits safely.
- `src/app/(main)`: Create, Workspace, Brand DNA.
- `src/app/products/[id]`: the Design / Specs / Hand off workspace and the PDF print view.
