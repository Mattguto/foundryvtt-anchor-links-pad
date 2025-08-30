class AnchorPad extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "anchor-links-pad",
      title: "Anchor Links",
      // Caminho padrão de templates de módulos:
      // modules/<id-do-módulo>/templates/<arquivo>.hbs
      template: "modules/anchor-links-pad/templates/anchor-pad.hbs",
      width: 360,
      height: 440,
      resizable: true
    });
  }

  /** --------- Persistência por JOGADOR --------- */
  async _getLinks() {
    return game.user.getFlag("anchor-links-pad", "links") ?? [];
  }
  async _setLinks(links) {
    return game.user.setFlag("anchor-links-pad", "links", links);
  }

  /** Dados para o template */
  async getData() {
    return { links: await this._getLinks() };
  }

  /** Utilidade */
  _safeLabelFromUuid(uuid) {
    const parts = String(uuid).split(".");
    return parts[parts.length - 1] || String(uuid);
  }

  /** Add/Del */
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

  /** Listeners da janela */
  activateListeners(html) {
    super.activateListeners(html);

    const dz = html.find(".dropzone")[0];
    if (dz) {
      dz.addEventListener("dragover", ev => { ev.preventDefault(); dz.classList.add("hover"); });
      dz.addEventListener("dragleave", () => dz.classList.remove("hover"));
      dz.addEventListener("drop", async ev => {
        ev.preventDefault();
        dz.classList.remove("hover");

        let data;
        try {
          // Parser oficial do Foundry para DnD de documentos
          data = TextEditor.getDragEventData(ev);
        } catch (e) {
          console.error(e);
          return ui.notifications.warn("Não reconheci o drop.");
        }

        // 1) UUID direto
        let uuid = data?.uuid;

        // 2) Compêndio: pack + id
        if (!uuid && data?.pack && data?.id) {
          uuid = `Compendium.${data.pack}.${data.id}`;
        }

        // 3) Documento do mundo: type + id
        if (!uuid && data?.type && data?.id) {
          try {
            const collection = game.collections.get(data.type);
            const doc = collection?.get(data.id);
            uuid = doc?.uuid ?? uuid;
          } catch (e) {
            console.debug("Falha ao resolver documento do mundo:", e);
          }
        }

        // 4) Texto contendo @UUID[...]
        if (!uuid && typeof data === "string") {
          const m = data.match(/@UUID\[(.+?)\]/);
          if (m) uuid = m[1];
        }

        if (!uuid) return ui.notifications.warn("Não consegui identificar o documento ou UUID.");

        // Rótulo
        let label;
        try {
          const doc = await fromUuid(uuid);
          label = doc?.name ?? data?.name ?? uuid;
        } catch {
          label = data?.name ?? uuid;
        }

        await this._addLink({ uuid, label });
      });
    }

    // Botão adicionar manual
    html.find(".add-manual").on("click", async () => {
      const uuid = html.find('input[name="uuid"]').val()?.trim();
      if (!uuid) return ui.notifications.warn("Cole um UUID válido.");
      let label = html.find('input[name="label"]').val()?.trim();
      try { if (!label) label = (await fromUuid(uuid))?.name ?? uuid; } catch {}
      await this._addLink({ uuid, label });
    });

    // Abrir documento
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

    // Copiar enricher
    html.on("click", ".copy-uuid", async ev => {
      const uuid = ev.currentTarget.dataset.uuid;
      const text = `@UUID[${uuid}]{${this._safeLabelFromUuid(uuid)}}`;
      await navigator.clipboard.writeText(text);
      ui.notifications.info("Copiado: " + text);
    });

    // Remover
    html.on("click", ".del", async ev => {
      const idx = Number(ev.currentTarget.closest(".anchor-row")?.dataset?.idx ?? -1);
      if (idx < 0) return;
      await this._deleteLink(idx);
    });
  }
}

/** Inicialização */
Hooks.once("ready", () => {
  // Instância única
  game.anchorLinksPad = game.anchorLinksPad || new AnchorPad();

  // Botão na barra de CONTROLES da cena (esquerda)
  // SUBSTITUA o hook anterior de getSceneControlButtons por este
Hooks.on("getSceneControlButtons", (controls) => {
  // tenta achar o painel "token"
  const tokenCtl = controls.find(c => c.name === "token");
  if (tokenCtl) {
    tokenCtl.tools.push({
      name: "anchor-links-pad",
      title: "Anchor Links",
      icon: "fas fa-link",
      button: true,
      visible: true,
      onClick: () => game.anchorLinksPad.render(true),
      toggle: false
    });
  } else {
    // fallback: cria um painel próprio se por algum motivo não houver "token"
    controls.push({
      name: "anchor-links-pad",
      title: "Anchor Links",
      icon: "fas fa-link",
      layer: null,
      button: true,
      visible: true,
      onClick: () => game.anchorLinksPad.render(true),
      tools: []
    });
  }
});

  // Botão EXTRA na barra superior de navegação de cenas
  Hooks.on("renderSceneNavigation", (_app, html) => {
    const $btn = $(`<a class="anchor-links-button" style="display:flex;align-items:center;gap:6px;"><i class="fas fa-link"></i> Anchor Links</a>`);
    $btn.on("click", () => game.anchorLinksPad.render(true));
    html.find(".nav-controls").append($btn);
  });

  // Macro de atalho (opcional): game.anchorLinksPad.render(true)
});
