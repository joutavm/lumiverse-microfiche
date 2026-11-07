# Microfiche for Lumiverse

Microfiche sends older roleplay chat as pictures of text, using the Spleen 5×8 bitmap font, so Gemini can bill those pages by image resolution instead of raw text tokens. Medium quality is about 560 input tokens for a full page. The same page is about 5,500 tokens as text.

This is a Lumiverse [Spindle](https://lumiverse.chat/guides/extensions/) port of [SillyTavern-Microfiche](https://github.com/cata02222/SillyTavern-Microfiche) by cata02222. It is not a fork of Lumiverse. SillyTavern extensions do not load here. The renderer, page planner, keep-marker, and notes are the upstream ones, copied under `vendor/microfiche/lib/`.

License: GNU Affero General Public License v3 (`LICENSE`). Font: Spleen, BSD 2-Clause (`licenses/LICENSE-spleen`). Emoji names: Unicode License (`licenses/LICENSE-unicode`). See `NOTICE`.

## Feasibility

It fits the Spindle interceptor. After Lumiverse assembles the prompt, `spindle.registerInterceptor` can replace messages. Image content is a real part:

```ts
{ type: "image", data: "<base64>", mime_type: "application/pdf" | "image/png" }
```

Lumiverse's OpenAI-compatible provider, which is what a custom proxy uses, turns that part into:

```json
{ "type": "image_url", "image_url": { "url": "data:application/pdf;base64,..." } }
```

Native Gemini and Vertex send the same bytes as `inlineData`. There is no OpenAI `detail` field on the Spindle part, so the host never sends `detail: "low"`.

Defaults match upstream:

| Setting | Default |
|---|---|
| Enabled | on |
| Chat history | images |
| Preset, character card, persona, lorebook | text |
| Quality | Medium (PDF, about 560 tokens a full page) |
| Keep newest as text | 4000 tokens |
| Page | 1568×728, margin 4, glyph 5×8 |

A character the font does not list becomes `?`. Emoji becomes `[emoji: name]`.

Spleen 5×8 lists Latin-1, but the accented letters in that file are empty bitmaps, so upstream draws "ação" with the ã and ç missing. This port leaves every glyph Spleen actually drew unchanged, and draws a one-row accent (or a cedilla) into those empty slots. á, ã, â, à, ç, é, ê, í, ó, ô, õ, ú, and the capitals are visible. Ordinals ª and º are too, because Portuguese uses them constantly.

## What this host cannot do the same way

- **Low quality is sent as Medium.** Upstream sends Low as `detail: "low"` only off AI Studio and Vertex, and sends Low as Medium on those two. Lumiverse cannot set `detail`. Vertex through an OpenAI-compatible proxy is the Medium/PDF path either way. High is still the 1-bit PNG, about 1,120 tokens a page.
- **Preset, card, and persona are one switch.** The interceptor can see `__isChatHistory` and `__isWorldInfoEntry`. It cannot see which other block is the preset, the card, or the persona. The switch images every remaining system or user block. Leave it off if you use a large Sola preset. Assistant-role blocks stay text, including prompts inserted inside the chat.
- **Lore inserted into another block is not a lore message.** Only world-info entries Lumiverse flags on their own can be imaged, and only if you turn lorebook on. Marker lore inside a preset stays in that preset.
- **A depth-inserted note can sit on the other side of the page** compared with SillyTavern. SillyTavern removes the old chat turns before assembly, so depth is measured against the shortened chat. This port runs after assembly, so those notes stay as text where Lumiverse already put them.
- **Speaker names need the chat-mutation permission.** Assembled turns do not carry the persona or character name. With the permission, pages say `[João]`. Without it, they say `[User]` and `[Character]`. The extension only reads messages. Revoking the permission does not stop the pages.
- **Prompt post-processing set to `single` drops every image.** `merge`, `semi`, and `strict` join neighboring messages of the same role and would also drop image parts, so the page is folded into the neighboring user turn first. `single` collapses the entire prompt to one string. Do not use `single` with Microfiche.
- **Names, numbers, and exact quotes can drift.** That is the upstream tradeoff. The newest 4000 tokens stay as text so the live scene does not.
- **The savings number is an estimate** (`characters / 3.5`, and 560 or 1,120 per Gemini page). It is not the provider's usage line. There is no per-message badge in the chat transcript.

`<!-- microfiche:keep -->` anywhere in a preset, card, persona, or lore block keeps that block as text and is removed before sending. It does not exempt a chat message. Upstream works the same way.

## Install on a self-hosted Lumiverse

You need a Lumiverse that already speaks Spindle interceptors and image parts (current `main` / 1.x). This port was checked against the public source, not against your server.

Once this repo is on GitHub:

1. Open the Spindle panel (drawer → Extensions).
2. Add Extension → Install from Source, and paste the git URL. Pick the branch if it is not the default.
3. Grant `interceptor` and `chat_mutation`.
4. Enable the extension.
5. Open the Microfiche drawer tab and leave the setup switch off.

Lumiverse clones the repo, reads `spindle.json`, and runs `bun build` if `dist/` is missing. This repo also ships `dist/` so install does not depend on a rebuild. After you pull changes, use the extension's Update button.

To try it before it is published, copy this directory onto the server and use **Import Local** (owner or admin) from `data/extensions/`, or point Install from Source at your fork.

The `github` field in `spindle.json` credits the SillyTavern project. After you publish the port, point `github` and `homepage` at your fork.

### Develop

[Bun](https://bun.sh) builds the bundles Lumiverse loads. Tests use Bun as well, because it resolves the TypeScript sources.

```bash
bun test
bun run build
```

There are no runtime dependencies. `pnpm` is not required unless you add some.

## How a request is rewritten

The interceptor runs late (priority 900), after other prompt edits. Quiet generations are ignored. On failure the original text is sent.

For a normal chat the result looks like:

1. System and other non-chat blocks, unchanged.
2. One user message: the upstream note, then one or more `image` parts, oldest page first.
3. World-info entries and assistant-role inserts that were sitting in the history, still text.
4. The newest ~4000 tokens of chat, still text.

The note is the upstream sentence: each message starts with `[Name]`, `¶` is a paragraph break, and `[emoji: name]` is an emoji.

Medium attaches `application/pdf`. High attaches `image/png`. Both are 1568×728, 1-bit, the same geometry as upstream. On a custom OpenAI-compatible connection those parts leave as `image_url` data URLs. Prompt Breakdown gains a "Microfiche chat pages" entry.

## Check it on a long chat

This environment cannot open your Lumiverse.

1. Use a chat whose older part is well past 4,000 tokens. A short chat stays text; the panel says so.
2. Confirm the model string contains `gemini` and **Gemini billing** is on. That is the right switch for Vertex, AI Studio, and a proxy in front of either.
3. Leave preset / card / persona off. Put a unique sentence in the preset and another, `OLD_STORY`, far up the chat.
4. Generate, or run Lumiverse's dry prompt if you have one. In Prompt Breakdown you should see `[image: application/pdf]` (Medium) or `[image: image/png]` (High), the note beginning `[Earlier messages`, the preset sentence still in text, and the latest scene still in text. `OLD_STORY` should be gone from the text.
5. Open the Microfiche tab. **Last rewritten request** lists roles and mime types without the bitmap. **Render a Brazilian Portuguese sample** should show `Não, a ação do coração…` with the accents drawn and no `?`.
6. On the proxy, confirm the JSON body contains `image_url` and `data:application/pdf;base64,` (Medium) and that Vertex accepts it. A proxy that strips non-PNG data URLs will fail this step; switch to High, which is a normal PNG, and compare the bill.
7. Optional: turn token estimates on. The figure is `characters / 3.5` against 560 (Medium) or 1,120 (High) per page. It ignores cache discounts.
8. Put `<!-- microfiche:keep -->` in one preset block, turn the setup switch on, and confirm that block stays text while a long unmarked block becomes a page. Turn the switch back off when you are done.

If the interceptor exceeds its budget, Lumiverse logs `Interceptor timeout from microfiche` and sends the original text. The manifest asks for 30 seconds. Rendering is local bitmap work and should be well under that.

## Layout of this repo

| Path | Role |
|---|---|
| `src/backend.ts` | Registers the interceptor, settings, and speaker-name lookup |
| `src/frontend.ts` | Drawer settings, last-request summary, font sample |
| `src/transform.ts` | Chooses which messages become pages and attaches the parts |
| `src/latin1-glyphs.ts` | Draws accents into the empty Latin-1 slots of the copied font |
| `src/openai-wire.ts` | Shows the OpenAI-compatible body the host will send |
| `vendor/microfiche/lib/` | Upstream renderer, font, emoji, planner, keep-marker. Leave these alone |
| `test/microfiche.test.ts` | Accents, page size, defaults, and the rewritten prompt |

Upstream behavior that this port intentionally keeps: unknown glyphs become `?`, assistant-role inserts stay text, and a page that would not save tokens is not sent.
