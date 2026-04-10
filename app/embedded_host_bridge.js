(function () {
  const params = new URLSearchParams(window.location.search);
  const isEmbedded = params.get("embed") === "1";
  const embedClass = "code-lab-embedded";

  if (!isEmbedded) {
    return;
  }

  const pageName = (window.location.pathname || "").split("/").pop().toLowerCase();
  document.documentElement.classList.add(embedClass);

  const baseCss = `
html.${embedClass},
html.${embedClass} body,
body.${embedClass}{
  min-height:0 !important;
  overflow-y:visible !important;
}
`;

  const rotationSetCss = `
html.${embedClass} .passage-tab-list,
html.${embedClass} .passage-editor-shell,
html.${embedClass} .passage-editor-body,
html.${embedClass} .p-card.open .p-card-body,
html.${embedClass} .assign-checklist,
html.${embedClass} .inline-answer-content,
html.${embedClass} .sidebar,
html.${embedClass} .main{
  max-height:none !important;
  height:auto !important;
  overflow:visible !important;
}

html.${embedClass} .passage-editor-shell,
html.${embedClass} .main,
html.${embedClass} .sidebar,
html.${embedClass} #class-screen{
  min-height:0 !important;
}
`;

  const style = document.createElement("style");
  style.textContent = baseCss + (pageName === "rotation_set_builder.html" ? rotationSetCss : "");
  document.head.appendChild(style);

  const applyBodyClass = () => {
    if (document.body) {
      document.body.classList.add(embedClass);
    }
  };

  const postHeight = () => {
    const body = document.body;
    const html = document.documentElement;
    const height = Math.max(
      body ? body.scrollHeight : 0,
      html ? html.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      html ? html.offsetHeight : 0
    );

    window.parent.postMessage(
      {
        type: "CODE_LAB_EMBED_HEIGHT",
        height
      },
      "*"
    );
  };

  let frameRequest = 0;
  const scheduleHeightPost = () => {
    if (frameRequest) {
      cancelAnimationFrame(frameRequest);
    }

    frameRequest = requestAnimationFrame(() => {
      frameRequest = 0;
      postHeight();
    });
  };

  const startBridge = () => {
    applyBodyClass();
    scheduleHeightPost();

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => scheduleHeightPost());
      resizeObserver.observe(document.documentElement);
      if (document.body) {
        resizeObserver.observe(document.body);
      }
    }

    const mutationObserver = new MutationObserver(() => scheduleHeightPost());
    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });

    document.addEventListener("input", scheduleHeightPost, true);
    document.addEventListener("change", scheduleHeightPost, true);
    window.addEventListener("resize", scheduleHeightPost);
    window.addEventListener("load", scheduleHeightPost);
    window.addEventListener("message", event => {
      if (event.data && event.data.type === "CODE_LAB_EMBED_PING") {
        scheduleHeightPost();
      }
    });

    setTimeout(scheduleHeightPost, 80);
    setTimeout(scheduleHeightPost, 240);
    setTimeout(scheduleHeightPost, 800);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startBridge, { once: true });
  } else {
    startBridge();
  }
})();
