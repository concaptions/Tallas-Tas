# Cosmetic notes, logged during the page run

Ship-blocking problems are fixed in place. These are noted and deliberately left for a cleanup pass.

- **07 Products** — the Landing page URL and Collection link columns render the host only, so every row
  of a single-brand workspace reads "niagarasleep.example" and the columns carry no information. Show
  the path (or the last path segment) instead, keeping the full URL in the title attribute.
- **14/15 Queues** — the card thumbnail renders a provider token derived from the design-file host, so it
  reads as a clipped "FRAM…" inside the fixed tile. Either widen the tile, shorten the token to a letter,
  or drop the text and keep the colour block.
