// src/frontend.ts
var ctx;
var settings = null;
var keepMarker = "<!-- microfiche:keep -->";
var report = null;
var sample = null;
var tab = null;
var ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-11Zm2 .5v2h10V5H5Zm0 4v2h10V9H5Zm0 4v2h6v-2H5Z"/></svg>`;
function setup(context) {
  ctx = context;
  const removeStyle = ctx.dom.addStyle(CSS);
  tab = ctx.ui.registerDrawerTab({
    id: "microfiche",
    title: "Microfiche",
    shortName: "Fiche",
    description: "Send older chat as bitmap pages to cut Gemini input tokens",
    keywords: ["tokens", "images", "gemini", "cost", "microfiche"],
    iconSvg: ICON
  });
  render();
  ctx.sendToBackend({ type: "get_settings" });
  ctx.sendToBackend({ type: "get_status" });
  ctx.onBackendMessage((payload) => {
    if (payload?.type === "settings" && payload.settings) {
      settings = payload.settings;
      if (payload.keepMarker)
        keepMarker = payload.keepMarker;
      render();
    } else if (payload?.type === "status") {
      report = payload.report ?? null;
      render();
    } else if (payload?.type === "run") {
      report = payload.report ?? null;
      render();
    } else if (payload?.type === "sample" && payload.sample) {
      sample = payload.sample;
      render();
    }
  });
  return () => {
    removeStyle();
    tab?.destroy();
  };
}
function render() {
  if (!tab)
    return;
  tab.root.innerHTML = "";
  const root = el("div", "mf");
  tab.root.appendChild(root);
  if (!settings) {
    root.appendChild(el("p", "mf-muted", "Loading Microfiche settings…"));
    return;
  }
  const current = settings;
  root.appendChild(sectionTitle("Send older roleplay as pages"));
  root.appendChild(el("p", "mf-muted", "Older chat becomes bitmap pages of the Spleen font. The newest text stays written out. Preset, character card, persona, and lore stay as text unless you opt in below."));
  root.appendChild(checkbox("On", current.enabled, (checked) => patch({ enabled: checked })));
  const status = el("p", "mf-status");
  status.textContent = report?.detail ?? "No request has been rewritten in this session yet.";
  root.appendChild(status);
  if (current.showSavings && report?.stats.ok) {
    const saved = report.stats.textTokens - report.stats.imageTokens;
    root.appendChild(el("p", "mf-muted", `Last estimate: ${report.stats.textTokens.toLocaleString("en-US")} text tokens → ${report.stats.imageTokens.toLocaleString("en-US")} image tokens (${saved.toLocaleString("en-US")} fewer, before cache).`));
  }
  if (report?.stats.promotedLow) {
    root.appendChild(el("p", "mf-warn", "Low was sent as Medium. This host cannot set OpenAI image detail, and Vertex bills Low as Medium."));
  }
  root.appendChild(sectionTitle("Send as images"));
  root.appendChild(checkbox("Chat history", current.asImages.chat, (checked) => patchImages({ chat: checked })));
  root.appendChild(checkbox("Lorebook entries that Lumiverse marks on their own", current.asImages.lorebook, (checked) => patchImages({ lorebook: checked })));
  const setupOn = current.asImages.preset || current.asImages.card || current.asImages.persona;
  const mixed = new Set([current.asImages.preset, current.asImages.card, current.asImages.persona]).size > 1;
  root.appendChild(checkbox("Preset, character card, and persona together", setupOn, (checked) => patchImages({ preset: checked, card: checked, persona: checked })));
  root.appendChild(el("p", "mf-warn", "Lumiverse does not tell an extension which blocks are the preset, the card, or the persona. That switch images every other prompt block, including a large Sola preset. Leave it off."));
  if (mixed) {
    root.appendChild(el("p", "mf-warn", "Those three flags disagree in saved settings. Saving from this panel turns them all on or all off together."));
  }
  root.appendChild(sectionTitle("Picture quality"));
  const quality = document.createElement("select");
  quality.className = "mf-input";
  for (const [value, label] of [
    ["low", "Low — sent as Medium on this port"],
    ["medium", "Medium — PDF, about 560 tokens a full page"],
    ["high", "High — PNG, about 1,120 tokens a full page"]
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = current.detail === value;
    quality.appendChild(option);
  }
  quality.disabled = !current.geminiBilling;
  quality.addEventListener("change", () => {
    const value = quality.value === "low" || quality.value === "high" ? quality.value : "medium";
    patch({ detail: value });
  });
  root.appendChild(quality);
  root.appendChild(el("p", "mf-muted", "Medium is the default. On Gemini, Medium is a PDF page. High is a sharper PNG and costs more. Low cannot be billed at about 280 tokens here: Lumiverse image parts have no detail field."));
  root.appendChild(checkbox("Gemini billing (Vertex, AI Studio, or a proxy in front of Gemini)", current.geminiBilling, (checked) => patch({ geminiBilling: checked })));
  if (!current.geminiBilling) {
    const cost = numberField(current.experimentalPageTokens, 1, 1e5, (value) => patch({ experimentalPageTokens: value }));
    const label = el("label", "mf-field");
    label.appendChild(el("span", "", "Estimated tokens per PNG page"));
    label.appendChild(cost);
    root.appendChild(label);
  }
  root.appendChild(sectionTitle("How much stays as text"));
  const keepLabel = el("label", "mf-field");
  keepLabel.appendChild(el("span", "", "Keep newest as text (tokens)"));
  keepLabel.appendChild(numberField(current.keepTokens, 0, 1e6, (value) => patch({ keepTokens: value })));
  root.appendChild(keepLabel);
  root.appendChild(el("p", "mf-muted", "The newest message always stays as text, plus older ones up to this many tokens. 4000 matches upstream. Names, numbers, and exact quotes in the pages can drift."));
  root.appendChild(checkbox("Pack preset, card, persona, and lorebook tightly", current.packSetup, (checked) => patch({ packSetup: checked })));
  root.appendChild(checkbox("Show token estimates after a request", current.showSavings, (checked) => patch({ showSavings: checked })));
  root.appendChild(checkbox("Toast when a request is sent as images", current.showNotifications, (checked) => patch({ showNotifications: checked })));
  root.appendChild(sectionTitle("Keep a prompt as text"));
  root.appendChild(el("p", "mf-muted", "Put this in a preset prompt, card, persona, or lore entry to force that block to stay text."));
  const markerRow = el("div", "mf-row");
  const code = el("code", "mf-code", keepMarker);
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "mf-button";
  copy.textContent = "Copy";
  copy.addEventListener("click", () => copyMarker(copy));
  markerRow.append(code, copy);
  root.appendChild(markerRow);
  root.appendChild(sectionTitle("Last rewritten request"));
  if (!report) {
    root.appendChild(el("p", "mf-muted", "Send a message in a long chat, or run a dry prompt, and this list shows each outbound part without the bitmap."));
  } else {
    const list = el("ol", "mf-wire");
    for (const message of report.wire) {
      const item = document.createElement("li");
      const images = message.images.length ? ` · ${message.images.length} image${message.images.length === 1 ? "" : "s"} (${message.images.map((image) => image.mime_type).join(", ")})` : "";
      const preview = message.text.replace(/\s+/g, " ").slice(0, 180);
      item.textContent = `${message.role}${images}${preview ? ` — ${preview}` : ""}`;
      list.appendChild(item);
    }
    root.appendChild(list);
  }
  root.appendChild(sectionTitle("Font check"));
  const sampleButton = document.createElement("button");
  sampleButton.type = "button";
  sampleButton.className = "mf-button";
  sampleButton.textContent = sample ? "Render the sample again" : "Render a Brazilian Portuguese sample";
  sampleButton.addEventListener("click", () => ctx.sendToBackend({ type: "render_sample" }));
  root.appendChild(sampleButton);
  if (sample) {
    if (sample.unknown > 0) {
      root.appendChild(el("p", "mf-warn", `The sample lost ${sample.unknown} glyph(s). Accented Portuguese should not do that.`));
    } else {
      root.appendChild(el("p", "mf-muted", `Normalized with no missing glyphs: ${sample.normalized}`));
    }
    root.appendChild(el("p", "mf-muted", `Requests at the current quality attach ${sample.requestMimeType}. This preview is a PNG so the browser can paint it.`));
    const frame = el("div", "mf-frame");
    const image = document.createElement("img");
    image.alt = "Microfiche sample page with Brazilian Portuguese text";
    image.src = sample.dataUrl;
    image.width = sample.width;
    frame.appendChild(image);
    root.appendChild(frame);
  }
}
function patch(partial) {
  if (!settings)
    return;
  settings = { ...settings, ...partial };
  ctx.sendToBackend({ type: "update_settings", settings: partial });
  render();
}
function patchImages(partial) {
  if (!settings)
    return;
  const asImages = { ...settings.asImages, ...partial };
  settings = { ...settings, asImages };
  ctx.sendToBackend({ type: "update_settings", settings: { asImages } });
  render();
}
function numberField(value, min, max, onChange) {
  const input = document.createElement("input");
  input.type = "number";
  input.className = "mf-input";
  input.min = String(min);
  input.max = String(max);
  input.step = "100";
  input.value = String(value);
  input.addEventListener("change", () => {
    const next = Number(input.value);
    if (!Number.isFinite(next))
      return;
    onChange(Math.min(max, Math.max(min, Math.round(next))));
  });
  return input;
}
async function copyMarker(button) {
  try {
    await navigator.clipboard.writeText(keepMarker);
    button.textContent = "Copied";
  } catch {
    const input = document.createElement("input");
    input.value = keepMarker;
    input.readOnly = true;
    button.insertAdjacentElement("afterend", input);
    input.select();
    button.textContent = "Select the marker";
  }
  window.setTimeout(() => {
    button.textContent = "Copy";
  }, 1600);
}
function sectionTitle(text) {
  return el("h3", "mf-title", text);
}
function checkbox(label, checked, onChange) {
  const row = document.createElement("label");
  row.className = "mf-check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const span = document.createElement("span");
  span.textContent = label;
  row.append(input, span);
  return row;
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className)
    node.className = className;
  if (text)
    node.textContent = text;
  return node;
}
var CSS = `
.mf { display: flex; flex-direction: column; gap: 10px; padding: 4px 2px 16px; font-size: 13px; line-height: 1.45; color: var(--lumiverse-text, inherit); }
.mf-title { margin: 12px 0 0; font-size: 13px; font-weight: 650; }
.mf-muted { margin: 0; color: var(--lumiverse-text-muted, #8a8a8a); font-size: 12px; }
.mf-warn { margin: 0; color: var(--lumiverse-warning, #c9842a); font-size: 12px; }
.mf-status { margin: 0; padding: 8px 10px; border: 1px solid var(--lumiverse-border, #333); border-radius: 8px; background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.03)); }
.mf-check { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; }
.mf-check input { margin-top: 3px; }
.mf-field { display: flex; flex-direction: column; gap: 4px; }
.mf-input, .mf-button { font: inherit; color: inherit; background: var(--lumiverse-fill, transparent); border: 1px solid var(--lumiverse-border, #444); border-radius: 8px; padding: 6px 8px; }
.mf-button { cursor: pointer; width: fit-content; }
.mf-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.mf-code { font-size: 12px; padding: 4px 6px; border-radius: 6px; background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.04)); }
.mf-wire { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.mf-frame { overflow: auto; max-height: 220px; border: 1px solid var(--lumiverse-border, #333); border-radius: 8px; background: white; }
.mf-frame img { display: block; width: 100%; height: auto; image-rendering: pixelated; }
`;
export {
  setup
};
