"use client";

import * as React from "react";
import { getPublicEnv } from "@/lib/browser-auth";
import { useTheme } from "@/providers/theme-provider";
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
    readonly styling: {
      readonly mode: "light" | "dark";
    };
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
    __LEXFRAME_STAGE17_LOCALIZATION_FALLBACK__?: LocalizationFallbackMetrics;
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
  const { theme } = useTheme();
  const themeRef = React.useRef(theme);

  React.useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

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
            styling: {
              mode: themeRef.current,
            },
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
        disposeLocalizationOverlay = installEmbeddedLocalizationOverlay(containerId);

        await sdk.configure(configureInput);

        if (!disposed && typeof sdk.navigate === "function" && session.initialRoute) {
          await sdk.navigate({ route: session.initialRoute });
          await wait(250);
        }

        let localizationReadiness =
          await verifyEmbeddedLocalizationBeforeVisible(containerId);
        if (
          !localizationReadiness.surfaceReady &&
          !disposed &&
          typeof sdk.navigate === "function" &&
          session.initialRoute
        ) {
          await sdk.navigate({ route: session.initialRoute });
          await wait(500);
          localizationReadiness =
            await verifyEmbeddedLocalizationBeforeVisible(containerId);
        }

        if (!localizationReadiness.surfaceReady) {
          throw new Error("Конструктор автоматизаций не отрисовал рабочую область.");
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
const knownUserFacingEnglishTerms = [
  "Flows",
  "Runs",
  "Versions",
  "Publish",
  "Manual Run",
  "Manual Trigger",
  "Manage Flow",
  "Loop on Items",
  "Router",
  "Code",
  "Choose a piece",
  "Select a piece first",
  "Please select a piece first",
  "Connections",
  "No results",
  "Create connection",
  "Test step",
  "Step settings",
  "Trigger",
  "Action",
  "Activepieces",
] as const;

type LocalizationFallbackMetrics = {
  readonly invocations: number;
  readonly replacements: number;
  readonly fingerprints: readonly string[];
  readonly lastCheckedAt: string;
};

async function verifyEmbeddedLocalizationBeforeVisible(containerId: string) {
  const startedAt = Date.now();
  let doc = await waitForEmbeddedDocument(containerId, 5_000);
  if (!doc?.body) {
    return { knownEnglishHits: 0, surfaceReady: false };
  }

  let hits: Array<(typeof knownUserFacingEnglishTerms)[number]> = [];
  let visiblePayload = "";
  do {
    translateEmbeddedDocument(doc);
    visiblePayload = collectVisiblePayload(doc);
    hits = knownUserFacingEnglishTerms.filter((term) =>
      containsUserFacingTerm(visiblePayload, term),
    );
    if (visiblePayload.trim().length > 0 && hits.length === 0) {
      break;
    }

    await wait(100);
    doc =
      document
        .getElementById(containerId)
        ?.querySelector("iframe")
        ?.contentDocument ?? doc;
  } while (Date.now() - startedAt < 8_000);
  recordLocalizationFallback({
    invocations: 0,
    replacements: hits.length,
    fingerprints: hits.map(hashString),
  });

  return {
    knownEnglishHits: hits.length,
    surfaceReady: visiblePayload.trim().length > 0,
  };
}

function installEmbeddedLocalizationOverlay(containerId: string) {
  let activeDocument: Document | null = null;
  let activeObserver: MutationObserver | null = null;

  const attach = () => {
    const iframe = document
      .getElementById(containerId)
      ?.querySelector("iframe");
    const doc = iframe?.contentDocument;
    if (!doc?.body) {
      return;
    }

    if (doc === activeDocument) {
      translateEmbeddedDocument(doc);
      return;
    }

    activeObserver?.disconnect();
    activeDocument = doc;
    translateEmbeddedDocument(doc);

    let scheduled = false;
    const scheduleTranslate = () => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      window.setTimeout(() => {
        scheduled = false;
        if (activeDocument?.body) {
          translateEmbeddedDocument(activeDocument);
        }
      }, 50);
    };
    activeObserver = new MutationObserver(scheduleTranslate);
    activeObserver.observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "alt", "title", "placeholder"],
    });
  };

  const intervalId = window.setInterval(attach, 250);
  attach();

  return () => {
    window.clearInterval(intervalId);
    activeObserver?.disconnect();
  };
}

function translateEmbeddedDocument(doc: Document) {
  doc.documentElement.lang = "ru";
  doc.title = "Конструктор автоматизаций";
  let replacements = translateTextNodes(doc.body);
  replaceBrandedImages(doc);
  for (const element of doc.body.querySelectorAll<HTMLElement>("*")) {
    for (const attribute of ["aria-label", "alt", "title", "placeholder"]) {
      const value = element.getAttribute(attribute);
      if (value) {
        const nextValue = translateVisibleString(value);
        if (nextValue !== value) {
          element.setAttribute(attribute, nextValue);
          replacements += 1;
        }
      }
    }
  }
  if (replacements > 0) {
    recordLocalizationFallback({
      invocations: 1,
      replacements,
      fingerprints: [hashString(String(replacements))],
    });
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

  let replacements = 0;
  for (const node of nodes) {
    const nextValue = translateVisibleString(node.nodeValue ?? "");
    if (nextValue !== node.nodeValue) {
      node.nodeValue = nextValue;
      replacements += 1;
    }
  }
  return replacements;
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

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), milliseconds);
  });
}

function waitForEmbeddedDocument(containerId: string, timeoutMs: number) {
  const startedAt = Date.now();

  return new Promise<Document | null>((resolve) => {
    const check = () => {
      const iframe = document
        .getElementById(containerId)
        ?.querySelector("iframe");
      const doc = iframe?.contentDocument ?? null;
      if (doc?.body) {
        resolve(doc);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        resolve(null);
        return;
      }

      window.setTimeout(check, 50);
    };

    check();
  });
}

function collectVisiblePayload(doc: Document) {
  const values: string[] = [doc.title];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const value = walker.currentNode.nodeValue?.trim();
    if (value) {
      values.push(value);
    }
  }
  for (const element of doc.body.querySelectorAll<HTMLElement>("*")) {
    for (const attribute of ["aria-label", "alt", "title", "placeholder"]) {
      const value = element.getAttribute(attribute)?.trim();
      if (value) {
        values.push(value);
      }
    }
  }
  return values.join("\n");
}

function containsUserFacingTerm(payload: string, term: string) {
  return term.includes(" ")
    ? payload.includes(term)
    : new RegExp(`\\b${escapeRegExp(term)}\\b`).test(payload);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function recordLocalizationFallback(input: {
  readonly invocations: number;
  readonly replacements: number;
  readonly fingerprints: readonly string[];
}) {
  const current = window.__LEXFRAME_STAGE17_LOCALIZATION_FALLBACK__ ?? {
    invocations: 0,
    replacements: 0,
    fingerprints: [],
    lastCheckedAt: new Date(0).toISOString(),
  };
  window.__LEXFRAME_STAGE17_LOCALIZATION_FALLBACK__ = {
    invocations: current.invocations + input.invocations,
    replacements: current.replacements + input.replacements,
    fingerprints: [...current.fingerprints, ...input.fingerprints].slice(-50),
    lastCheckedAt: new Date().toISOString(),
  };
}

function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
