(function lexframeStage17LocalizationGuard() {
  const replacements = new Map([
    ["Trigger", "Триггер"],
  ]);

  function replaceText(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const value = node.nodeValue;
      if (!value) continue;
      const trimmed = value.trim();
      const replacement = replacements.get(trimmed);
      if (!replacement) continue;
      node.nodeValue = value.replace(trimmed, replacement);
    }
  }

  function start() {
    replaceText(document.body);
    const target = document.documentElement || document.body;
    if (!target) return;
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            const value = node.nodeValue;
            const replacement = value ? replacements.get(value.trim()) : null;
            if (replacement && value) {
              node.nodeValue = value.replace(value.trim(), replacement);
            }
            continue;
          }
          if (node.nodeType === Node.ELEMENT_NODE) {
            replaceText(node);
          }
        }
      }
    }).observe(target, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
