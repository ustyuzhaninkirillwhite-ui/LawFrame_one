/*
 * Activepieces embed SDK compatibility bundle for LexFrame Stage 17.
 * Version target: 0.9.0, sourced from E:/activepieces-main/packages/ee/embed-sdk.
 * This local bundle keeps the AP Canvas integration off the external CDN.
 */
/* eslint-disable @typescript-eslint/no-this-alias, @typescript-eslint/no-unused-vars */
(function attachActivepiecesEmbedSdk(global) {
  "use strict";

  var CLIENT_INIT = "CLIENT_INIT";
  var CLIENT_ROUTE_CHANGED = "CLIENT_ROUTE_CHANGED";
  var CLIENT_AUTHENTICATION_SUCCESS = "CLIENT_AUTHENTICATION_SUCCESS";
  var CLIENT_AUTHENTICATION_FAILED = "CLIENT_AUTHENTICATION_FAILED";
  var CLIENT_CONFIGURATION_FINISHED = "CLIENT_CONFIGURATION_FINISHED";
  var CLIENT_BUILDER_HOME_BUTTON_CLICKED = "CLIENT_BUILDER_HOME_BUTTON_CLICKED";
  var VENDOR_INIT = "VENDOR_INIT";
  var VENDOR_ROUTE_CHANGED = "VENDOR_ROUTE_CHANGED";
  var SDK_VERSION = "0.9.0";

  function ActivepiecesEmbedded() {
    this._instanceUrl = "";
    this._jwtToken = "";
    this._prefix = "";
    this._initialRoute = "/";
    this._embeddingState = {};
    this._dashboardAndBuilderIframeWindow = null;
    this._navigationHandler = null;
  }

  ActivepiecesEmbedded.prototype.configure = function configure(params) {
    var embedding = params.embedding || {};
    this._instanceUrl = removeTrailingSlashes(params.instanceUrl);
    this._jwtToken = params.jwtToken;
    this._prefix = removeTrailingSlashes(prependSlash(params.prefix || "/"));
    this._initialRoute = normalizeInitialRoute(params.initialRoute);
    this._embeddingState = embedding;
    this._navigationHandler =
      params.navigationHandler ||
      (embedding.navigation && embedding.navigation.handler) ||
      null;

    if (!embedding.containerId) {
      return Promise.resolve({ status: "success" });
    }

    return this._initializeIframe("#" + embedding.containerId);
  };

  ActivepiecesEmbedded.prototype.navigate = function navigate(input) {
    if (!this._dashboardAndBuilderIframeWindow) {
      return;
    }

    this._dashboardAndBuilderIframeWindow.postMessage(
      {
        type: VENDOR_ROUTE_CHANGED,
        data: {
          vendorRoute: prependSlash(input.route),
        },
      },
      "*",
    );
  };

  ActivepiecesEmbedded.prototype._initializeIframe = function initializeIframe(
    selector,
  ) {
    var self = this;

    return new Promise(function configureIframe(resolve, reject) {
      waitForElement(selector, 4000)
        .then(function attach(container) {
          container.textContent = "";
          var iframe = document.createElement("iframe");
          iframe.src = buildEmbedUrl(self._instanceUrl);
          iframe.setAttribute("allow", "clipboard-read; clipboard-write");
          iframe.setAttribute("title", "Конструктор автоматизаций");
          iframe.style.width = "100%";
          iframe.style.height = "100%";
          iframe.style.minHeight = "100%";
          iframe.style.border = "0";
          iframe.style.display = "block";
          container.appendChild(iframe);

          if (!iframe.contentWindow) {
            reject(new Error("iframe window not accessible"));
            return;
          }

          self._dashboardAndBuilderIframeWindow = iframe.contentWindow;
          self._setupInitialMessageHandler(
            iframe.contentWindow,
            self._initialRoute,
            resolve,
          );
          self._checkForClientRouteChanges(iframe.contentWindow);
          self._checkForBuilderHomeButtonClicked(iframe.contentWindow);
          self._checkForAuthenticationFailure(iframe.contentWindow, reject);
        })
        .catch(reject);
    });
  };

  ActivepiecesEmbedded.prototype._setupInitialMessageHandler =
    function setupInitialMessageHandler(targetWindow, initialRoute, resolve) {
      var self = this;
      var expectedOrigin = resolveEmbedOrigin(this._instanceUrl);

      function handler(event) {
        if (event.source !== targetWindow || event.origin !== expectedOrigin) {
          return;
        }

        if (!event.data || event.data.type !== CLIENT_INIT) {
          return;
        }

        targetWindow.postMessage(
          {
            type: VENDOR_INIT,
            data: {
              hideSidebar: Boolean(self._embeddingState.dashboard && self._embeddingState.dashboard.hideSidebar),
              hideFlowsPageNavbar: Boolean(self._embeddingState.dashboard && self._embeddingState.dashboard.hideFlowsPageNavbar),
              disableNavigationInBuilder:
                (self._embeddingState.builder && self._embeddingState.builder.disableNavigation) || false,
              hideFolders: Boolean(self._embeddingState.hideFolders),
              hideTables: Boolean(self._embeddingState.hideTables),
              hideFlowNameInBuilder: Boolean(self._embeddingState.builder && self._embeddingState.builder.hideFlowName),
              jwtToken: self._jwtToken,
              initialRoute: initialRoute,
              fontUrl: self._embeddingState.styling && self._embeddingState.styling.fontUrl,
              fontFamily: self._embeddingState.styling && self._embeddingState.styling.fontFamily,
              hideExportAndImportFlow: Boolean(self._embeddingState.hideExportAndImportFlow),
              emitHomeButtonClickedEvent: Boolean(self._embeddingState.builder && self._embeddingState.builder.homeButtonClickedHandler),
              locale: self._embeddingState.locale || "en",
              sdkVersion: SDK_VERSION,
              homeButtonIcon:
                (self._embeddingState.builder && self._embeddingState.builder.homeButtonIcon) || "logo",
              hideDuplicateFlow: Boolean(self._embeddingState.hideDuplicateFlow),
              mode: self._embeddingState.styling && self._embeddingState.styling.mode,
              hidePageHeader: Boolean(self._embeddingState.dashboard && self._embeddingState.dashboard.hidePageHeader),
            },
          },
          "*",
        );
        window.removeEventListener("message", handler);
      }

      function finishedHandler(event) {
        if (
          event.source === targetWindow &&
          event.data &&
          event.data.type === CLIENT_CONFIGURATION_FINISHED
        ) {
          window.removeEventListener("message", finishedHandler);
          resolve({ status: "success" });
        }
      }

      window.addEventListener("message", handler);
      window.addEventListener("message", finishedHandler);
    };

  ActivepiecesEmbedded.prototype._checkForAuthenticationFailure =
    function checkForAuthenticationFailure(targetWindow, reject) {
      function handler(event) {
        if (
          event.source === targetWindow &&
          event.data &&
          event.data.type === CLIENT_AUTHENTICATION_FAILED
        ) {
          window.removeEventListener("message", handler);
          reject(new Error("Authentication failed"));
        }
      }

      window.addEventListener("message", handler);
    };

  ActivepiecesEmbedded.prototype._checkForClientRouteChanges =
    function checkForClientRouteChanges(targetWindow) {
      var self = this;

      function handler(event) {
        if (
          event.source !== targetWindow ||
          !event.data ||
          event.data.type !== CLIENT_ROUTE_CHANGED
        ) {
          return;
        }

        if (typeof self._navigationHandler === "function") {
          self._navigationHandler({ route: event.data.data && event.data.data.route });
        }
      }

      window.addEventListener("message", handler);
    };

  ActivepiecesEmbedded.prototype._checkForBuilderHomeButtonClicked =
    function checkForBuilderHomeButtonClicked(targetWindow) {
      var self = this;

      function handler(event) {
        if (
          event.source !== targetWindow ||
          !event.data ||
          event.data.type !== CLIENT_BUILDER_HOME_BUTTON_CLICKED
        ) {
          return;
        }

        var callback =
          self._embeddingState.builder &&
          self._embeddingState.builder.homeButtonClickedHandler;
        if (typeof callback === "function") {
          callback(event.data.data || {});
        }
      }

      window.addEventListener("message", handler);
    };

  function waitForElement(selector, timeoutMs) {
    var startedAt = Date.now();

    return new Promise(function wait(resolve, reject) {
      var element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("container not found"));
        return;
      }

      window.setTimeout(function retry() {
        wait(resolve, reject);
      }, 50);
    });
  }

  function removeTrailingSlashes(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function prependSlash(value) {
    var route = String(value || "/");
    return route.charAt(0) === "/" ? route : "/" + route;
  }

  function normalizeInitialRoute(value) {
    if (typeof value !== "string" || value.trim().length === 0) {
      return "/";
    }

    return prependSlash(value.trim());
  }

  function buildEmbedUrl(instanceUrl) {
    return resolveEmbedOrigin(instanceUrl) + "/embed?currentDate=" + Date.now();
  }

  function resolveEmbedOrigin(instanceUrl) {
    var url = new URL(instanceUrl, window.location.href);
    var current = new URL(window.location.href);
    if (isLoopbackHost(url.hostname) && isLoopbackHost(current.hostname)) {
      return current.origin;
    }
    return url.origin;
  }

  function isLoopbackHost(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  }

  var sdk = new ActivepiecesEmbedded();
  global.activepieces = sdk;
  global.ActivepiecesEmbeddedBuilder = sdk;
  global.ActivepiecesEmbed = sdk;
})(window);
