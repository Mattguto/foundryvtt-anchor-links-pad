class AnchorPad extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "anchor-links-pad",
      title: "Anchor Links",
      template: null,
      width: 360,
      height: 420,
      resizable: true
    });
  }

  async getData() {
    const links = await this._getLinks();
    return { links };
  }

  /** Util: carrega/salva links do usuário atual via flags */
  async _getLinks() {
    return game.user.getFlag("anchor-links-pad", "links") ?? [];
  }
  async _setLinks(links) {
    return game.user.setFlag("anchor-links-pad", "links", links);
  }
  async _addLink(entry) {
    const links = await this._getLinks();
    links.push(entry);
    await this._setLinks(links);
    this.render(true);
  }
  async _deleteLink(index) {
    const links = await this._getLinks();
    links.splice(index, 1);
    await this._setLinks(links);
    this.render(true);
  }

  async _renderInner(data) {
    const links = data.links ?? [];
    const rows = links.map((l, i) => `
      <li class="anchor-row" data-idx="${i}">
        <div class="row">
          <a href="#" class="open-doc" data-uuid="${foundry.utils.escapeHTML(l.uuid)}">${foundry.utils.escapeHTML(l.label)}</a>
          <div class="btns">
            <a class="copy-uuid" data-uuid="${foundry.utils.escapeHTML(l.uuid)}" title="Copiar @UUID">⧉</a>
            <a class="del" title="Remover">✕</a>
          </div>
        </div>
        <div class="sub">${foundry.utils.escapeHTML(l.uuid)}</div>
      </li>
    `).join("");

    const el = document.createElement("div");
    el.innerHTML = `
      <style>
        #${this.options.id} .pad { padding: 8px; display:flex; flex-direction:column; gap:8px;}
        #${this.options.id} .dropzone {
          border: 2px dashed var(--color-border-dark-tertiary);
          border-radius: 6px; padding: 10px; text-align:center; font-size:12px; opacity:.9;
        }
        #${this.options.id} ul { list-style:none; margin:0; padding:0; }
        #${this.options.id} .anchor-row { padding:6px 4px; border-bottom:1px solid var(--color-border-light-tertiary); }
        #${this.options.id} .row { display:flex; justify-content:space-between; gap:8px; align-items:center; }
        #${this.options.id} .btns a { margin-left:8px; cursor:pointer; opacity:.8; }
        #${this.options.id} .btns a:hover { opacity:1; }
        #${this.options.id} .sub { color: var(--color-text-dark-secondary); font-size: 11px; margin-top:2px; word-break: break-all; }
        #${this.options.id} .toolbar { display:flex; gap:6px; }
        #${this.options.id} input[name="label"] { width:100%; }
        #${this.options.id} .footer { font-size:11px; opacity:.8; }
      </style>
      <div class="pad" tabindex="0">
        <div class="dropzone" draggable="false">
          Arraste itens/atores/journals/compêndios aqui<br>(ou cole um UUID abaixo)
        </div>
        <div class="toolbar">
          <input type="text" name="uuid" placeholder="Cole um UUID (ex.: Compendium...)" />
          <input type="text" name="label" placeholder="Rótulo (opcional)" />
          <button type="button" class="add-manual">Adicionar</button>
        </div>
        <ul class="list">${rows || ""}</ul>
        <div class="footer">Sua lista é pessoal (salva no seu usuário).</div>
      </div>
    `;
    return el;
  }

  activateListeners(html) {
    super.activateListeners(html);
    const dz = html.find(".dropzone")[0];

    dz.addEventListener("dragover", ev => { ev.preventDefault(); dz.style.opacity = "1"; });
    dz.addEventListener("dragleave", () => { dz.style.opacity = ".9"; });

    dz.addEventListener("drop", async ev => {
  ev.preventDefault();
  dz.style.opacity = ".9";

  let data;
  try {
    // Usa o parser oficial do Foundry p/ drag & drop
    data = TextEditor.getDragEventData(ev);
  } catch (e) {
    console.error(e);
    return ui.notifications.warn("Não reconheci o drop.");
  }

  // 1) Caminho feliz: já veio com UUID
  let uuid = data?.uuid;

  // 2) Itens/atores do compêndio: pack + id
  if (!uuid && data?.pack && data?.id) {
    uuid = `Compendium.${data.pack}.${data.id}`;
  }

  // 3) Documentos do mundo: coleção + id (ex.: "Item", "Actor", etc.)
  if (!uuid && data?.type && data?.id) {
    try {
      const collection = game.collections.get(data.type);
      const doc = collection?.get(data.id);
      uuid = doc?.uuid;
    } catch (e) {
      console.debug("Falha ao resolver doc do mundo:", e);
    }
  }

  // 4) Último recurso: tentar achar um @UUID[...] no texto
  if (!uuid && typeof data === "string") {
    const m = data.match(/@UUID\[(.+?)\]/);
    if (m) uuid = m[1];
  }

  if (!uuid) return ui.notifications.warn("Não consegui identificar o documento ou UUID.");

  // Resolve rótulo
  let label;
  try {
    const doc = await fromUuid(uuid);
    label = doc?.name ?? data?.name ?? uuid;
  } catch {
    label = data?.name ?? uuid;
  }

  await this._addLink({ uuid, label });
});

    html.find(".add-manual").on("click", async () => {
      const uuid = html.find('input[name="uuid"]').val()?.trim();
      if (!uuid) return ui.notifications.warn("Cole um UUID válido.");
      let label = html.find('input[name="label"]').val()?.trim();
      try { if (!label) label = (await fromUuid(uuid))?.name ?? uuid; } catch {}
      await this._addLink({ uuid, label });
    });

    html.on("click", ".open-doc", async ev => {
      ev.preventDefault();
      const uuid = ev.currentTarget.dataset.uuid;
      try {
        const doc = await fromUuid(uuid);
        if (!doc) return ui.notifications.error("Não encontrei o documento.");
        doc.sheet?.render(true);
      } catch (e) {
        console.error(e);
        ui.notifications.error("Falha ao abrir o documento.");
      }
    });

    html.on("click", ".copy-uuid", async ev => {
      const uuid = ev.currentTarget.dataset.uuid;
      const text = `@UUID[${uuid}]{${this._safeLabelFromUuid(uuid)}}`;
      await navigator.clipboard.writeText(text);
      ui.notifications.info("Copiado: " + text);
    });

    html.on("click", ".del", async ev => {
      const idx = Number(ev.currentTarget.closest(".anchor-row").dataset.idx);
      await this._deleteLink(idx);
    });
  }

  _safeLabelFromUuid(uuid) {
    const parts = uuid.split(".");
    return parts[parts.length - 1];
  }
}

Hooks.once("ready", () => {
  game.anchorLinksPad = game.anchorLinksPad || new AnchorPad();

  Hooks.on("getSceneControlButtons", controls => {
    controls.push({
      name: "anchor-links-pad",
      title: "Anchor Links",
      icon: "fas fa-link",
      layer: null,
      button: true,
      // Visível a todos (cada um vê/edita a própria lista)
      visible: true,
      onClick: () => game.anchorLinksPad.render(true),
      tools: []
    });
  });

  // Macro de atalho:
  // game.anchorLinksPad.render(true);
});
