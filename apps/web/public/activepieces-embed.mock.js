(function bootstrapActivepiecesMock() {
  var activeRoute = "/";

  function ensureContainer(containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      return null;
    }

    container.innerHTML = [
      '<div style="height:100%;min-height:520px;display:flex;align-items:center;justify-content:center;border-radius:18px;background:rgba(255,255,255,0.03);color:#f2eadf;font-family:monospace;text-align:center;padding:24px;">',
      '<div>',
      '<div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;opacity:0.7;">Activepieces Mock</div>',
      '<div style="margin-top:12px;font-size:18px;">Embedded builder is mounted</div>',
      '<div style="margin-top:8px;font-size:13px;opacity:0.7;" data-activepieces-route></div>',
      "</div>",
      "</div>",
    ].join("");

    return container;
  }

  function updateRoute(container, route) {
    activeRoute = route;
    var routeNode = container && container.querySelector("[data-activepieces-route]");
    if (routeNode) {
      routeNode.textContent = "route: " + activeRoute;
    }
  }

  window.ActivepiecesEmbed = {
    configure: function configure(input) {
      var container = ensureContainer(input.containerId);
      if (container) {
        updateRoute(container, input.prefix || "/");
      }
      return Promise.resolve();
    },
    navigate: function navigate(input) {
      var route = (input && input.route) || "/";
      var routeNode = document.querySelector("[data-activepieces-route]");
      if (routeNode && routeNode.parentElement) {
        updateRoute(routeNode.parentElement.parentElement, route);
      }
      return Promise.resolve();
    },
  };
  window.activepieces = window.ActivepiecesEmbed;
  window.ActivepiecesEmbeddedBuilder = window.ActivepiecesEmbed;
})();
