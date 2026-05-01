"use client";

import * as React from "react";
import { getPublicEnv } from "@/lib/browser-auth";
import type { SafeActivepiecesSession } from "./use-activepieces-session";

type ActivepiecesEmbedSdk = {
  configure: (input: Record<string, unknown>) => void | Promise<void>;
  navigate?: (input: { route: string }) => void | Promise<void>;
};

type ActivepiecesEmbedConfigureInput = {
  readonly instanceUrl: string;
  readonly jwtToken: string;
  readonly prefix: string;
  readonly embedding: {
    readonly containerId: string;
    readonly locale: "ru";
    readonly builder: {
      readonly disableNavigation: false;
      readonly hideFlowName: false;
      readonly homeButtonIcon: "logo";
    };
    readonly dashboard: {
      readonly hideSidebar: false;
      readonly hideFlowsPageNavbar: false;
      readonly hidePageHeader: false;
    };
    readonly hideFolders: false;
    readonly hideExportAndImportFlow: false;
    readonly hideDuplicateFlow: false;
    readonly navigation: {
      readonly handler: (input: unknown) => void;
    };
  };
  readonly containerId: string;
  readonly locale: "ru";
  readonly brandDisplayName: string;
  readonly initialRoute: string;
  readonly navigationHandler: (input: unknown) => void;
};

declare global {
  interface Window {
    activepieces?: ActivepiecesEmbedSdk;
    ActivepiecesEmbeddedBuilder?: ActivepiecesEmbedSdk;
    ActivepiecesEmbed?: ActivepiecesEmbedSdk;
  }
}

let embedSdkPromise: Promise<ActivepiecesEmbedSdk> | null = null;

export function ActivepiecesCanvasWrapper({
  session,
  tokenRef,
  onMounted,
  onAuthFailure,
}: {
  readonly session: SafeActivepiecesSession;
  readonly tokenRef: React.MutableRefObject<string | null>;
  readonly onMounted: () => void;
  readonly onAuthFailure: () => void;
}) {
  const env = React.useMemo(() => getPublicEnv(), []);
  const [sdkState, setSdkState] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [sdkError, setSdkError] = React.useState<string | null>(null);
  const containerId = session.sdkConfig.embedding.containerId;

  React.useEffect(() => {
    const previousTitle = document.title;
    document.title = session.brand.documentTitle;

    return () => {
      document.title = previousTitle;
    };
  }, [session.brand.documentTitle]);

  React.useEffect(() => {
    let disposed = false;
    let disposeLocalizationOverlay: (() => void) | null = null;

    async function mount() {
      try {
        setSdkState("loading");
        setSdkError(null);
        persistRuLocaleForEmbeddedRuntime();
        await nextFrame();

        const jwtToken = tokenRef.current;
        if (!jwtToken) {
          throw new Error("Защищённая сессия конструктора недоступна.");
        }

        const sdk = await loadActivepiecesSdk(
          env.NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL,
        );

        if (disposed) {
          return;
        }

        const handleNavigation = (input: unknown) => {
          const route = readSdkRoute(input);
          if (route && isLoginRoute(route)) {
            onAuthFailure();
          }
        };

        const configureInput: ActivepiecesEmbedConfigureInput = {
          instanceUrl: session.instanceUrl,
          jwtToken,
          prefix: session.sdkConfig.prefix,
          embedding: {
            containerId,
            locale: "ru",
            builder: {
              disableNavigation:
                session.sdkConfig.embedding.builder.disableNavigation,
              hideFlowName: session.sdkConfig.embedding.builder.hideFlowName,
              homeButtonIcon:
                session.sdkConfig.embedding.builder.homeButtonIcon,
            },
            dashboard: {
              hideSidebar: session.sdkConfig.embedding.dashboard.hideSidebar,
              hideFlowsPageNavbar:
                session.sdkConfig.embedding.dashboard.hideFlowsPageNavbar,
              hidePageHeader:
                session.sdkConfig.embedding.dashboard.hidePageHeader,
            },
            hideFolders: session.sdkConfig.embedding.hideFolders,
            hideExportAndImportFlow:
              session.sdkConfig.embedding.hideExportAndImportFlow,
            hideDuplicateFlow: session.sdkConfig.embedding.hideDuplicateFlow,
            navigation: {
              handler: handleNavigation,
            },
          },
          containerId,
          locale: "ru",
          brandDisplayName: session.brand.shortName,
          initialRoute: session.initialRoute,
          navigationHandler: handleNavigation,
        };
        await sdk.configure(configureInput);
        disposeLocalizationOverlay =
          installEmbeddedLocalizationOverlay(containerId);

        if (
          !disposed &&
          typeof sdk.navigate === "function" &&
          session.initialRoute
        ) {
          window.setTimeout(() => {
            if (!disposed) {
              void sdk.navigate?.({ route: session.initialRoute });
            }
          }, 250);
        }

        if (!disposed) {
          setSdkState("ready");
          onMounted();
        }
      } catch (error) {
        if (!disposed) {
          setSdkState("error");
          setSdkError(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить конструктор автоматизаций.",
          );
        }
      }
    }

    void mount();

    return () => {
      disposed = true;
      disposeLocalizationOverlay?.();
      const container = document.getElementById(containerId);
      if (container) {
        container.replaceChildren();
      }
    };
  }, [
    containerId,
    env.NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL,
    onAuthFailure,
    onMounted,
    session,
    tokenRef,
  ]);

  return (
    <div
      aria-label={session.brand.ariaLabel}
      className="relative h-screen min-h-0 overflow-hidden bg-[color:var(--lf-bg-app)]"
      data-testid="activepieces-canvas-container"
    >
      <div id={containerId} className="h-full min-h-0 w-full" />
      {sdkState !== "ready" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--lf-bg-panel)]/85 p-6 text-center text-sm text-[color:var(--lf-text-secondary)] backdrop-blur">
          {sdkState === "error"
            ? (sdkError ?? "Конструктор автоматизаций временно недоступен.")
            : "Загружаем конструктор автоматизаций."}
        </div>
      ) : null}
    </div>
  );
}

async function loadActivepiecesSdk(url: string): Promise<ActivepiecesEmbedSdk> {
  const existingSdk = resolveActivepiecesSdk();
  if (existingSdk) {
    return existingSdk;
  }

  if (!embedSdkPromise) {
    embedSdkPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${url}"]`,
      );
      const script = existingScript ?? document.createElement("script");

      script.async = true;
      script.src = url;
      script.onload = () => {
        const sdk = resolveActivepiecesSdk();
        if (sdk) {
          resolve(sdk);
        } else {
          reject(new Error("Embed SDK did not expose configure."));
        }
      };
      script.onerror = () => {
        reject(new Error("Не удалось загрузить embed SDK конструктора."));
      };

      if (!existingScript) {
        document.head.appendChild(script);
      }
    });
  }

  return embedSdkPromise;
}

function resolveActivepiecesSdk() {
  const candidates = [
    window.activepieces,
    window.ActivepiecesEmbeddedBuilder,
    window.ActivepiecesEmbed,
  ];

  return (
    candidates.find(
      (sdk): sdk is ActivepiecesEmbedSdk =>
        typeof sdk?.configure === "function",
    ) ?? null
  );
}

function persistRuLocaleForEmbeddedRuntime() {
  try {
    window.localStorage.setItem("i18nextLng", "ru");
    window.localStorage.setItem("locale", "ru");
    window.localStorage.setItem("activepieces.locale", "ru");
  } catch {
    // localStorage may be unavailable in hardened browser contexts.
  }
}

const visibleTextTranslations = new Map<string, string>([
  ["Flows", "\u0421\u0446\u0435\u043d\u0430\u0440\u0438\u0438"],
  ["New Flow", "\u041d\u043e\u0432\u044b\u0439 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u0439"],
  ["Import Flow", "\u0418\u043c\u043f\u043e\u0440\u0442 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u044f"],
  ["Flow name", "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u044f"],
  ["All flows", "\u0412\u0441\u0435 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u0438"],
  ["Folders", "\u041f\u0430\u043f\u043a\u0438"],
  ["Name", "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435"],
  ["Steps", "\u0428\u0430\u0433\u0438"],
  ["Folder", "\u041f\u0430\u043f\u043a\u0430"],
  ["Created", "\u0421\u043e\u0437\u0434\u0430\u043d"],
  ["Status", "\u0421\u0442\u0430\u0442\u0443\u0441"],
  ["Rows per page", "\u0421\u0442\u0440\u043e\u043a \u043d\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435"],
  ["Previous", "\u041d\u0430\u0437\u0430\u0434"],
  ["Next", "\u0414\u0430\u043b\u0435\u0435"],
  ["All", "\u0412\u0441\u0435"],
  ["AI", "\u0418\u0418"],
  ["Core", "\u0411\u0430\u0437\u043e\u0432\u044b\u0435"],
  ["Apps", "\u041f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f"],
  ["Flow Control", "\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u0435\u043c"],
  ["Loop on Items", "\u0426\u0438\u043a\u043b \u043f\u043e \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u0430\u043c"],
  ["Router", "\u041c\u0430\u0440\u0448\u0440\u0443\u0442\u0438\u0437\u0430\u0442\u043e\u0440"],
  ["Utility", "\u0418\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u044b"],
  ["Code", "\u041a\u043e\u0434"],
  ["Please select a piece first", "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043c\u043e\u0434\u0443\u043b\u044c"],
  ["Manual Trigger", "\u0420\u0443\u0447\u043d\u043e\u0439 \u0437\u0430\u043f\u0443\u0441\u043a"],
  ["Trigger this flow manually.", "\u0417\u0430\u043f\u0443\u0441\u043a\u0430\u0435\u0442 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u0439 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0437\u0430\u0446\u0438\u0438 \u0432\u0440\u0443\u0447\u043d\u0443\u044e."],
  ["Activepieces", "Автоматизация"],
  ["Support", "Помощь"],
  ["Runs", "Запуски"],
  ["Versions", "Версии"],
  ["Publish", "Опубликовать"],
  ["Uncategorized", "Без категории"],
  ["End", "Конец"],
  ["Test Flow", "Тест автоматизации"],
  ["Data Selector", "Выбор данных"],
  ["No matching data", "Нет подходящих данных"],
  ["Try adjusting your search", "Попробуйте изменить условия поиска"],
  ["Generate Sample Data", "Сгенерировать тестовые данные"],
  ["Test Trigger", "Проверить запуск"],
  ["Use Mock Data", "Использовать тестовые данные"],
  ["Or", "или"],
  ["Close", "Закрыть"],
  ["Search", "Поиск"],
  ["Go to Dashboard", "Перейти к панели управления"],
]);

const embeddedAutomationIconUrl = "/lexframe-automation-icon.svg";

function installEmbeddedLocalizationOverlay(containerId: string) {
  const disposers: Array<() => void> = [];
  let attempts = 0;

  const attach = () => {
    const iframe = document
      .getElementById(containerId)
      ?.querySelector("iframe");
    const doc = iframe?.contentDocument;
    if (!doc?.body) {
      attempts += 1;
      if (attempts > 60) {
        window.clearInterval(intervalId);
      }
      return;
    }

    window.clearInterval(intervalId);
    translateEmbeddedDocument(doc);
    const currentIframe = iframe;
    if (!currentIframe) {
      return;
    }
    let scheduled = false;
    const scheduleTranslate = () => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      window.setTimeout(() => {
        scheduled = false;
        translateEmbeddedDocument(doc);
      }, 100);
    };
    const observer = new MutationObserver(scheduleTranslate);
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "alt", "title", "placeholder"],
    });
    disposers.push(() => observer.disconnect());

    const handleLoad = () => {
      const nextDoc = currentIframe.contentDocument;
      if (nextDoc?.body) {
        translateEmbeddedDocument(nextDoc);
      }
    };
    currentIframe.addEventListener("load", handleLoad);
    disposers.push(() => currentIframe.removeEventListener("load", handleLoad));
  };

  const intervalId = window.setInterval(attach, 250);
  attach();

  return () => {
    window.clearInterval(intervalId);
    for (const dispose of disposers) {
      dispose();
    }
  };
}

function translateEmbeddedDocument(doc: Document) {
  doc.documentElement.lang = "ru";
  doc.title = "Конструктор автоматизаций";
  translateTextNodes(doc.body);
  replaceBrandedImages(doc);
  for (const element of doc.body.querySelectorAll<HTMLElement>("*")) {
    for (const attribute of ["aria-label", "alt", "title", "placeholder"]) {
      const value = element.getAttribute(attribute);
      if (value) {
        const nextValue = translateVisibleString(value);
        if (nextValue !== value) {
          element.setAttribute(attribute, nextValue);
        }
      }
    }
  }
}

function replaceBrandedImages(doc: Document) {
  const brandedImages = doc.body.querySelectorAll<HTMLImageElement>(
    'img[src*="activepieces.com/brand"], img[src*="/brand/logo"], img[src$="/logo.svg"]',
  );

  for (const image of brandedImages) {
    const src = image.getAttribute("src") ?? "";
    if (!/activepieces|\/brand\/logo|\/logo\.svg/i.test(src)) {
      continue;
    }
    image.src = embeddedAutomationIconUrl;
    image.alt = translateVisibleString(image.alt || "Activepieces");
  }
}

function translateTextNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  for (const node of nodes) {
    const nextValue = translateVisibleString(node.nodeValue ?? "");
    if (nextValue !== node.nodeValue) {
      node.nodeValue = nextValue;
    }
  }
}

function translateVisibleString(value: string) {
  const trimmed = value.trim();
  const translated = visibleTextTranslations.get(trimmed);
  if (!translated) {
    return value;
  }

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function readSdkRoute(input: unknown) {
  if (typeof input === "string") {
    return input;
  }

  if (!input || typeof input !== "object") {
    return null;
  }

  const route = (input as { readonly route?: unknown }).route;
  return typeof route === "string" ? route : null;
}

function isLoginRoute(route: string) {
  return /\/(login|sign-in|sign_in)(\/|$|\?)/i.test(route);
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
