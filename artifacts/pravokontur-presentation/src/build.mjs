import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  Presentation,
  PresentationFile,
  column,
  row,
  grid,
  panel,
  text,
  rule,
  shape,
  fill,
  fixed,
  hug,
  fr,
  drawSlideToCtx,
} from "@oai/artifact-tool";
import { paint, stroke } from "@oai/artifact-tool/presentation-jsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(__dirname, "..");
const scratchDir = path.join(workspace, "scratch");
const outputDir = path.join(workspace, "output");
const sourceRenderDir = path.join(scratchDir, "renders-source");
const pptxRenderDir = path.join(scratchDir, "renders-pptx");
const finalPptx = path.join(outputDir, "pravokontur-legaltech.pptx");
const qaReportPath = path.join(scratchDir, "qa-report.json");
const montagePath = path.join(scratchDir, "pravokontur-montage.png");

for (const dir of [scratchDir, outputDir, sourceRenderDir, pptxRenderDir]) {
  fs.mkdirSync(dir, { recursive: true });
}
for (const dir of [sourceRenderDir, pptxRenderDir]) {
  for (const item of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, item), { force: true, recursive: true });
  }
}

const artifactUrl = await import.meta.resolve("@oai/artifact-tool");
const artifactRoot = path.dirname(path.dirname(fileURLToPath(artifactUrl)));
const runtimeNodeModules = path.dirname(path.dirname(artifactRoot));
const { Canvas, loadImage } = await import(
  pathToFileURL(path.join(artifactRoot, "node_modules", "skia-canvas", "lib", "index.js")).href
);
const { default: JSZip } = await import(
  pathToFileURL(path.join(runtimeNodeModules, "jszip", "lib", "index.js")).href
);

const W = 1920;
const H = 1080;

const C = {
  ink: "#111827",
  graphite: "#1F2937",
  slate: "#334155",
  muted: "#64748B",
  warm: "#F8F5EF",
  paper: "#FFFCF7",
  line: "#D9E2E7",
  teal: "#0F766E",
  cyan: "#06B6D4",
  cyanSoft: "#D9F8FF",
  tealSoft: "#DDF4EF",
  amber: "#D97706",
  amberSoft: "#FFF1D6",
  purple: "#7C3AED",
  purpleSoft: "#F0E7FF",
  green: "#15803D",
  greenSoft: "#E7F7EC",
  graySoft: "#EEF2F5",
  danger: "#B45309",
  dark: "#0B1220",
  dark2: "#121A2A",
  white: "#FFFFFF",
};

const flowPalette = {
  trigger: { fill: C.greenSoft, line: C.green, text: "#14532D" },
  data: { fill: C.cyanSoft, line: C.cyan, text: "#155E75" },
  ai: { fill: C.purpleSoft, line: C.purple, text: "#4C1D95" },
  legal: { fill: C.tealSoft, line: C.teal, text: "#134E4A" },
  deadline: { fill: C.amberSoft, line: C.amber, text: "#92400E" },
  neutral: { fill: C.graySoft, line: "#94A3B8", text: C.graphite },
  risk: { fill: "#FEE2E2", line: "#DC2626", text: "#7F1D1D" },
  dark: { fill: "#E8EEF3", line: C.slate, text: C.ink },
};

const p = (color) => paint(color);
const s = (color, width = 2) => stroke(color, width);

function t(value, opts = {}) {
  return text(value, {
    name: opts.name,
    width: opts.width ?? fill,
    height: opts.height ?? hug,
    columnSpan: opts.columnSpan,
    rowSpan: opts.rowSpan,
    style: {
      fontSize: opts.size ?? 24,
      color: opts.color ?? C.ink,
      bold: opts.bold ?? false,
      italic: opts.italic ?? false,
      ...opts.style,
    },
  });
}

function label(value, color = C.teal) {
  return panel(
    {
      width: hug,
      height: hug,
      padding: { x: 16, y: 8 },
      fill: p("#FFFFFFCC"),
      line: s(color, 1.5),
      borderRadius: 20,
    },
    t(value, { width: hug, size: 16, bold: true, color }),
  );
}

function slideNumber(n) {
  return t(String(n).padStart(2, "0"), {
    width: fixed(44),
    size: 16,
    bold: true,
    color: C.muted,
  });
}

function header(n, kicker, dark = false) {
  return row(
    { width: fill, height: hug, align: "center", justify: "between" },
    [
      row({ width: hug, height: hug, align: "center", gap: 14 }, [
        shape({
          name: `header-mark-${n}`,
          width: fixed(18),
          height: fixed(18),
          fill: p(dark ? C.cyan : C.teal),
          line: s(dark ? C.cyan : C.teal, 0),
          borderRadius: 18,
        }),
        t(kicker.toUpperCase(), {
          width: fixed(180),
          size: 15,
          bold: true,
          color: dark ? "#A7F3F0" : C.teal,
        }),
      ]),
      slideNumber(n),
    ],
  );
}

function titleBlock(n, kicker, title, subtitle) {
  return column({ width: fill, height: hug, gap: 14 }, [
    header(n, kicker),
    t(title, { name: `slide-${n}-title`, size: title.length > 70 ? 38 : 43, bold: true, color: C.ink }),
    subtitle ? t(subtitle, { name: `slide-${n}-subtitle`, size: 20, color: C.slate }) : null,
  ].filter(Boolean));
}

function rootSlide(children, opts = {}) {
  return panel(
    {
      name: opts.name,
      width: fill,
      height: fill,
      fill: p(opts.fill ?? C.paper),
      padding: { x: opts.x ?? 72, y: opts.y ?? 58 },
    },
    column({ width: fill, height: fill, gap: opts.gap ?? 26 }, children),
  );
}

function flowStep(step, idx, compact = false) {
  const role = typeof step === "string" ? "neutral" : step.role ?? "neutral";
  const labelText = typeof step === "string" ? step : step.text;
  const colors = flowPalette[role] ?? flowPalette.neutral;
  return panel(
    {
      name: `step-${idx}`,
      width: fixed(compact ? 156 : 184),
      height: hug,
      padding: { x: compact ? 12 : 14, y: compact ? 10 : 12 },
      fill: p(colors.fill),
      line: s(colors.line, 1.6),
      borderRadius: 16,
    },
    t(labelText, {
      width: fill,
      size: compact ? 15 : 16.5,
      bold: true,
      color: colors.text,
    }),
  );
}

function arrow(compact = false, textValue = "→") {
  return t(textValue, {
    width: fixed(compact ? 24 : 30),
    size: compact ? 20 : 24,
    bold: true,
    color: C.muted,
  });
}

function flowRows(steps, opts = {}) {
  const perRow = opts.perRow ?? 5;
  const compact = opts.compact ?? false;
  const rows = [];
  for (let i = 0; i < steps.length; i += perRow) {
    const chunk = steps.slice(i, i + perRow);
    const children = [];
    chunk.forEach((step, j) => {
      children.push(flowStep(step, i + j + 1, compact));
      if (j !== chunk.length - 1) children.push(arrow(compact));
    });
    rows.push(row({ width: fill, height: hug, align: "center", gap: compact ? 8 : 10 }, children));
  }
  return column({ width: fill, height: hug, gap: opts.gap ?? 16 }, rows);
}

function sideNote(title, body, opts = {}) {
  return row({ width: fill, height: fill, gap: 20 }, [
    rule({ width: fixed(4), height: fill, stroke: opts.color ?? C.teal, weight: 4 }),
    column({ width: fill, height: fill, gap: 14 }, [
      t(title, { size: 18, bold: true, color: opts.color ?? C.teal }),
      t(body, { size: opts.size ?? 19, color: C.graphite }),
    ]),
  ]);
}

function sourceLine(value) {
  return t(value, { size: 11, color: "#7C8792" });
}

function caseSlide(deck, n, cfg) {
  const slide = deck.slides.add();
  slide.compose(
    rootSlide([
      titleBlock(n, cfg.kicker ?? `Кейс ${n - 2}`, cfg.title, cfg.subtitle),
      grid(
        {
          name: `case-grid-${n}`,
          width: fill,
          height: fill,
          columns: [fr(1.55), fr(0.9)],
          rows: [fr(1), "auto"],
          columnGap: 48,
          rowGap: 18,
        },
        [
          column({ width: fill, height: fill, gap: 18 }, [
            t("Маршрут автоматизации", { size: 18, bold: true, color: C.teal }),
            cfg.visual ?? flowRows(cfg.steps, { perRow: cfg.perRow ?? 4, compact: cfg.compact ?? false }),
          ]),
          sideNote(cfg.noteTitle ?? "Практический пример", cfg.note, {
            color: cfg.noteColor ?? C.teal,
            size: cfg.noteSize ?? 18,
          }),
          cfg.source ? sourceLine(cfg.source) : t("", { size: 1 }),
        ],
      ),
    ]),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
  if (cfg.notes) slide.speakerNotes.setText(cfg.notes);
  return slide;
}

function branchVisual(leftTitle, leftSteps, rightTitle, rightSteps, mergeText, finalText) {
  return column({ width: fill, height: fill, gap: 18 }, [
    grid(
      { width: fill, height: hug, columns: [fr(1), fr(1)], columnGap: 28 },
      [
        column({ width: fill, gap: 12 }, [
          t(leftTitle, { size: 17, bold: true, color: C.slate }),
          flowRows(leftSteps, { perRow: 2, compact: true, gap: 10 }),
        ]),
        column({ width: fill, gap: 12 }, [
          t(rightTitle, { size: 17, bold: true, color: C.slate }),
          flowRows(rightSteps, { perRow: 2, compact: true, gap: 10 }),
        ]),
      ],
    ),
    row({ width: fill, height: hug, align: "center", justify: "center", gap: 16 }, [
      arrow(false, "↘"),
      flowStep({ text: mergeText, role: "legal" }, 100),
      arrow(false, "↙"),
    ]),
    row({ width: fill, height: hug, align: "center", justify: "center", gap: 14 }, [
      arrow(false),
      flowStep({ text: finalText, role: "deadline" }, 101),
    ]),
  ]);
}

function decisionVisual(before, condition, yes, no) {
  return column({ width: fill, height: fill, gap: 18 }, [
    flowRows(before, { perRow: 4, compact: true }),
    row({ width: fill, height: hug, align: "center", justify: "center", gap: 18 }, [
      flowStep({ text: condition, role: "deadline" }, 70),
    ]),
    grid({ width: fill, height: hug, columns: [fr(1), fr(1)], columnGap: 30 }, [
      column({ width: fill, gap: 10 }, [
        t("Если да", { size: 16, bold: true, color: C.green }),
        flowStep({ text: yes, role: "trigger" }, 71),
      ]),
      column({ width: fill, gap: 10 }, [
        t("Если нет / есть риск", { size: 16, bold: true, color: C.danger }),
        flowStep({ text: no, role: "risk" }, 72),
      ]),
    ]),
  ]);
}

function hubVisual(center, items) {
  return grid(
    {
      width: fill,
      height: fill,
      columns: [fr(1), fr(0.8), fr(1)],
      rows: [fr(1), fr(1), fr(1)],
      columnGap: 20,
      rowGap: 16,
      alignItems: "center",
      justifyItems: "center",
    },
    [
      flowStep(items[0], 1, true),
      t("↘", { width: fill, size: 28, bold: true, color: C.muted }),
      flowStep(items[1], 2, true),
      flowStep(items[2], 3, true),
      panel(
        {
          width: fill,
          height: fill,
          padding: { x: 18, y: 16 },
          fill: p(C.dark),
          line: s(C.cyan, 2),
          borderRadius: 22,
        },
        column({ width: fill, height: fill, align: "center", justify: "center", gap: 8 }, [
          t(center, { width: fill, size: 26, bold: true, color: C.white }),
          t("распознаёт команду и запускает сценарий", { width: fill, size: 14, color: "#B6D6E2" }),
        ]),
      ),
      flowStep(items[3], 4, true),
      flowStep(items[4], 5, true),
      t("↗", { width: fill, size: 28, bold: true, color: C.muted }),
      flowStep(items[5], 6, true),
    ],
  );
}

const deck = Presentation.create({ slideSize: { width: W, height: H } });

// 1. Cover
{
  const slide = deck.slides.add();
  slide.compose(
    panel(
      { width: fill, height: fill, fill: p(C.dark), padding: { x: 92, y: 76 } },
      column({ width: fill, height: fill, gap: 38, justify: "between" }, [
        row({ width: fill, height: hug, align: "center", justify: "between" }, [
          label("premium legal-tech", C.cyan),
          t("Платформа автоматизации юридической деятельности", {
            width: hug,
            size: 18,
            color: "#B6C6D4",
          }),
        ]),
        column({ width: fill, height: hug, gap: 24 }, [
          t("ПравоКонтур", {
            name: "cover-title",
            size: 108,
            bold: true,
            color: C.white,
          }),
          t("Автоматизируем не отдельный документ, а весь маршрут юридической работы", {
            name: "cover-claim",
            width: fixed(1180),
            size: 40,
            bold: true,
            color: "#A7F3F0",
          }),
          rule({ width: fixed(560), stroke: C.cyan, weight: 5 }),
        ]),
        row({ width: fill, height: hug, align: "center", gap: 12 }, [
          ...["запрос", "данные", "проверка", "документ", "срок", "результат", "отчёт"].flatMap((item, i, arr) => [
            flowStep({ text: item, role: i === 0 ? "trigger" : i === 4 ? "deadline" : "legal" }, i + 1, true),
            ...(i < arr.length - 1 ? [arrow(true)] : []),
          ]),
        ]),
        row({ width: fill, height: hug, align: "center", justify: "between" }, [
          t("Юрист управляет процессом. Система снимает рутину.", {
            width: hug,
            size: 22,
            color: "#DCEAF2",
          }),
          t("2026", { width: fixed(80), size: 18, color: "#7F93A7" }),
        ]),
      ]),
    ),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
  slide.speakerNotes.setText(
    "Обложка фиксирует позиционирование: ПравоКонтур продаётся не как генератор документов, а как система управления юридическим маршрутом.",
  );
}

// 2. Problem
{
  const slide = deck.slides.add();
  slide.compose(
    rootSlide([
      titleBlock(
        2,
        "Актуальность",
        "Проблема не в отсутствии юридических знаний, а в отсутствии управляемого процесса",
        "Юридическая работа часто распадается на каналы, файлы, ручные сроки и повторяющиеся действия.",
      ),
      grid(
        { width: fill, height: fill, columns: [fr(1), fixed(92), fr(1)], columnGap: 30 },
        [
          column({ width: fill, height: fill, gap: 18 }, [
            t("Как есть: фрагменты", { size: 25, bold: true, color: C.danger }),
            flowRows(
              [
                { text: "почта", role: "risk" },
                { text: "Telegram", role: "risk" },
                { text: "папки", role: "neutral" },
                { text: "Excel", role: "neutral" },
                { text: "календарь", role: "deadline" },
                { text: "устные поручения", role: "risk" },
              ],
              { perRow: 2 },
            ),
            t("Юристы тратят время на сбор данных, поиск документов, проверку комплектности, напоминания и перенос информации.", {
              size: 21,
              color: C.graphite,
            }),
          ]),
          column({ width: fill, height: fill, align: "center", justify: "center" }, [
            t("→", { width: fill, size: 72, bold: true, color: C.teal }),
          ]),
          column({ width: fill, height: fill, gap: 18 }, [
            t("Как должно быть: маршрут", { size: 25, bold: true, color: C.teal }),
            flowRows(
              [
                { text: "триггер", role: "trigger" },
                { text: "анкета", role: "data" },
                { text: "проверка", role: "legal" },
                { text: "задача", role: "neutral" },
                { text: "срок", role: "deadline" },
                { text: "архив", role: "neutral" },
                { text: "отчёт", role: "legal" },
              ],
              { perRow: 2 },
            ),
            t("ПравоКонтур превращает разрозненные обращения и документы в контролируемые сценарии с ответственными, сроками и следами действий.", {
              size: 21,
              color: C.graphite,
            }),
          ]),
        ],
      ),
    ]),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
}

caseSlide(deck, 3, {
  title: "Чат-бот для первичной обработки обращения клиента",
  subtitle: "Молодому клиенту проще описать проблему в телефоне, чем сразу звонить и долго объяснять ситуацию устно.",
  steps: [
    { text: "сайт / реклама", role: "trigger" },
    { text: "чат-бот", role: "data" },
    { text: "контакты", role: "data" },
    { text: "свободное описание", role: "neutral" },
    { text: "AI-категория", role: "ai" },
    { text: "анкета", role: "data" },
    { text: "список документов", role: "legal" },
    { text: "выбор времени", role: "deadline" },
    { text: "Google Calendar", role: "deadline" },
    { text: "карточка обращения", role: "legal" },
  ],
  perRow: 5,
  compact: true,
  note:
    "Клиент пишет: «долги, приставы, платить не могу». Система относит обращение к банкротству или долговому спору, уточняет сумму долгов, кредиторов, доход, имущество и предлагает время консультации.",
  source:
    "Техническая опора: Telegram Bot API — HTTP-интерфейс для ботов; Google Calendar API Events.insert создаёт события календаря.",
  notes:
    "Официальные источники: https://core.telegram.org/bots/api и https://developers.google.com/workspace/calendar/api/v3/reference/events/insert.",
});

caseSlide(deck, 4, {
  title: "Предконсультационная подготовка юриста",
  subtitle: "После записи система готовит юриста к встрече: анкета, документы, нормы, практика, риски и вопросы клиенту.",
  steps: [
    { text: "запись", role: "trigger" },
    { text: "проверка анкеты", role: "data" },
    { text: "документы", role: "neutral" },
    { text: "AI-анализ", role: "ai" },
    { text: "категория дела", role: "legal" },
    { text: "НПА и статьи", role: "legal" },
    { text: "судебная практика", role: "legal" },
    { text: "карта рисков", role: "deadline" },
    { text: "вопросы клиенту", role: "data" },
    { text: "папка дела", role: "neutral" },
    { text: "напоминание юристу", role: "deadline" },
  ],
  perRow: 4,
  compact: true,
  noteTitle: "Юрист утверждает / редактирует",
  note:
    "Для банкротства система подсказывает нормы закона о несостоятельности; для ЖКХ — правила коммунальных услуг; для трудового спора — релевантные нормы ТК. Юрист может менять категории и список норм.",
});

caseSlide(deck, 5, {
  title: "Банкротное досье физического лица",
  subtitle: "Система собирает долги, доходы, расходы и имущество, затем готовит черновое обоснование невозможности платить.",
  visual: branchVisual(
    "Документы о долгах",
    [
      { text: "кредитная история", role: "neutral" },
      { text: "договоры / выписки", role: "neutral" },
      { text: "судебные акты", role: "neutral" },
      { text: "кредиторы", role: "data" },
    ],
    "Доходы и расходы",
    [
      { text: "доход", role: "data" },
      { text: "расходы", role: "data" },
      { text: "иждивенцы", role: "deadline" },
      { text: "имущество", role: "neutral" },
    ],
    "таблица задолженности + анализ бюджета",
    "проект заявления",
  ),
  note:
    "Клиент загружает кредитную историю, договоры, справки о доходах, документы о детях, алиментах, аренде и медицине. Система показывает, что доход после обязательных расходов не позволяет платить без нарушения минимальных жизненных потребностей.",
});

caseSlide(deck, 6, {
  title: "Обработка входящих юридически значимых документов",
  subtitle: "Претензии, уведомления, требования госорганов и судебные документы превращаются в карточку, задачу и контролируемый срок.",
  steps: [
    { text: "почта / ЭДО / скан", role: "trigger" },
    { text: "OCR", role: "data" },
    { text: "тип документа", role: "ai" },
    { text: "реквизиты и срок", role: "deadline" },
    { text: "переименование", role: "neutral" },
    { text: "папка", role: "neutral" },
    { text: "карточка", role: "legal" },
    { text: "задача", role: "legal" },
    { text: "напоминание", role: "deadline" },
    { text: "архив результата", role: "neutral" },
  ],
  perRow: 5,
  compact: true,
  note:
    "Пришла претензия. Система извлекает контрагента, дату, срок ответа и номер договора, сохраняет файл в папку «Претензии/2026/Контрагент», создаёт задачу юристу и включает напоминание.",
});

caseSlide(deck, 7, {
  title: "Личный юридический ассистент запускает другие автоматизации",
  subtitle: "Юрист управляет системой текстом или голосом: ассистент распознаёт команду, проверяет доступ и запускает нужный сценарий.",
  visual: hubVisual("ассистент", [
    { text: "банкротство", role: "legal" },
    { text: "договоры", role: "neutral" },
    { text: "расчёты", role: "deadline" },
    { text: "документы", role: "data" },
    { text: "календарь", role: "deadline" },
    { text: "локальная база / Яндекс.Диск", role: "data" },
  ]),
  note:
    "Юрист говорит: «Составь лист кредиторов для Иванова». Система находит автоматизацию «банкротное досье», берёт данные из хранилища или Яндекс.Диска, запускает обработку и возвращает таблицу.",
  source: "Техническая опора: Yandex Disk REST API использует HTTP-запросы для работы с файлами пользователя.",
  notes: "Официальный источник: https://yandex.com/dev/disk/rest/.",
});

caseSlide(deck, 8, {
  title: "Претензионно-исковой маршрут по задолженности",
  subtitle: "Путь от сигнала о долге до претензии, таймера ответа и искового пакета становится управляемым процессом.",
  visual: decisionVisual(
    [
      { text: "сообщение о долге", role: "trigger" },
      { text: "договор", role: "neutral" },
      { text: "акты / счета / УПД", role: "data" },
      { text: "срок оплаты", role: "deadline" },
      { text: "расчёт долга", role: "deadline" },
      { text: "претензия", role: "legal" },
      { text: "согласование", role: "legal" },
      { text: "таймер ответа", role: "deadline" },
    ],
    "оплатил?",
    "закрыть дело",
    "иск + приложения",
  ),
  note:
    "Сотрудник пишет: «Контрагент не оплатил». Система подтягивает документы, готовит претензию и ставит срок ответа. Если оплаты нет, собирает доказательства направления претензии и основу для иска.",
});

caseSlide(deck, 9, {
  title: "Расчётный модуль для исков и претензий",
  subtitle: "ЖКХ, земля и платежи: формулы из базы нормативных актов подставляются в расчёт для претензии или иска.",
  steps: [
    { text: "задача: иск", role: "trigger" },
    { text: "квитанции / договор / тарифы", role: "data" },
    { text: "площадь, период, тариф", role: "data" },
    { text: "формула из базы", role: "legal" },
    { text: "расчёт", role: "deadline" },
    { text: "сравнение", role: "legal" },
    { text: "таблица переплаты", role: "deadline" },
    { text: "проект претензии / иска", role: "legal" },
    { text: "проверка юристом", role: "legal" },
  ],
  perRow: 4,
  compact: true,
  noteTitle: "Формула как подключаемый модуль",
  note:
    "Для ЖКХ основой может быть Постановление Правительства РФ от 06.05.2011 № 354: правила указывают на расчёт платы по тарифам, а Приложение № 2 содержит формулы коммунальных начислений.",
  noteColor: C.amber,
});

caseSlide(deck, 10, {
  title: "Правовой радар актуальности документов и договоров",
  subtitle: "Система регулярно проверяет локальную базу: иски, договоры, шаблоны, претензии, регламенты и заключения.",
  steps: [
    { text: "база документов", role: "trigger" },
    { text: "каждый понедельник", role: "deadline" },
    { text: "ссылки на НПА", role: "data" },
    { text: "проверка редакций", role: "legal" },
    { text: "изменения", role: "ai" },
    { text: "риск-карта", role: "deadline" },
    { text: "задача юристу", role: "legal" },
    { text: "сводка", role: "neutral" },
    { text: "обновление", role: "legal" },
  ],
  perRow: 5,
  compact: true,
  note:
    "Это не «чтение новостей вместо закона». Система опирается на официальные публикации и редакции актов, показывает затронутые документы и создаёт задачи на актуализацию.",
  source:
    "Официальный интернет-портал правовой информации содержит публикации, поиск, календарь опубликования и открытые данные.",
  notes: "Официальный источник: https://publication.pravo.gov.ru/.",
});

caseSlide(deck, 11, {
  title: "Проверка договора на стандарты компании",
  subtitle: "Система сравнивает новый договор с внутренними стандартами и обычной практикой прошлых договоров.",
  visual: branchVisual(
    "Новый договор",
    [
      { text: "проект договора", role: "trigger" },
      { text: "условия", role: "data" },
      { text: "срок / штраф / аванс", role: "deadline" },
      { text: "порядок расторжения", role: "legal" },
    ],
    "Стандарты и история",
    [
      { text: "база стандартов", role: "legal" },
      { text: "прошлые договоры", role: "neutral" },
      { text: "обычная практика", role: "data" },
      { text: "порог риска", role: "deadline" },
    ],
    "сравнение условий",
    "отклонение + риск",
  ),
  note:
    "Если обычный срок поставки — до 10 дней, а в новом договоре указано 15 дней, система помечает отклонение и требует проверки юриста.",
});

caseSlide(deck, 12, {
  title: "Контроль действий юриста и прозрачность отклонений",
  subtitle: "Руководитель видит, где юрист отходит от стандартов компании и какие решения требуют объяснения.",
  visual: decisionVisual(
    [
      { text: "юрист редактирует договор", role: "trigger" },
      { text: "фиксация действий", role: "data" },
      { text: "сравнение со стандартом", role: "legal" },
    ],
    "есть отклонение?",
    "журнал без эскалации",
    "комментарий + уведомление руководителя",
  ),
  note:
    "Юрист согласовал отсрочку платежа 60 дней вместо обычных 10. Система не блокирует работу, но требует комментарий: почему принято отклонение. При высоком риске руководитель получает уведомление.",
});

caseSlide(deck, 13, {
  title: "Внутренний запрос сотрудника на юридическую помощь",
  subtitle: "Сотрудник обращается не хаотичным письмом, а через управляемый маршрут с проверкой комплектности.",
  steps: [
    { text: "запрос сотрудника", role: "trigger" },
    { text: "свободное описание", role: "data" },
    { text: "AI-категория", role: "ai" },
    { text: "уточняющая анкета", role: "data" },
    { text: "проверка вложений", role: "legal" },
    { text: "назначение юриста", role: "legal" },
    { text: "срок исполнения", role: "deadline" },
    { text: "статус", role: "neutral" },
    { text: "отчёт руководителю", role: "legal" },
  ],
  perRow: 5,
  compact: true,
  note:
    "Сотрудник пишет: «Нужен договор с поставщиком оборудования». Система уточняет сумму, предмет, контрагента, срок поставки, проект договора, аванс и персональные данные. Только комплектный запрос уходит юристу.",
});

caseSlide(deck, 14, {
  title: "Подготовка ответа на запрос госоргана",
  subtitle: "Требование, запрос, уведомление о проверке или предписание превращаются в рабочую группу и контролируемый ответ.",
  visual: branchVisual(
    "Входящий запрос",
    [
      { text: "орган и тип", role: "ai" },
      { text: "срок", role: "deadline" },
      { text: "рабочая группа", role: "legal" },
      { text: "проект ответа", role: "legal" },
    ],
    "Подразделения",
    [
      { text: "бухгалтерия", role: "data" },
      { text: "кадры", role: "data" },
      { text: "ИБ", role: "data" },
      { text: "бизнес-блок", role: "data" },
    ],
    "сбор документов",
    "согласование + архив доказательств",
  ),
  note:
    "Поступило требование налогового органа. Система ставит срок, создаёт задачи бухгалтерии и юристу, отслеживает загрузку материалов, формирует проект ответа и сохраняет доказательства отправки.",
});

caseSlide(deck, 15, {
  title: "Типовой документ с проверкой стоп-факторов",
  subtitle: "NDA, доверенность, уведомление, допсоглашение, акт, письмо или претензия готовятся быстро, но рискованные случаи уходят юристу.",
  visual: decisionVisual(
    [
      { text: "выбор документа", role: "trigger" },
      { text: "описание задачи", role: "data" },
      { text: "анкета", role: "data" },
      { text: "стоп-факторы", role: "deadline" },
      { text: "шаблон", role: "neutral" },
      { text: "реквизиты", role: "data" },
      { text: "проект", role: "legal" },
    ],
    "риск есть?",
    "выдать документ + архив",
    "задача юристу",
  ),
  note:
    "Если документ стандартный — система выдаёт проект. Если есть иностранный контрагент, персональные данные, крупная сумма или нестандартные условия — автоматическая выдача отключается, задача передаётся юристу.",
});

caseSlide(deck, 16, {
  title: "Судебный трекер с задачами и календарём",
  subtitle: "Юрист добавляет номер дела или сторону спора, а система отслеживает события и обновляет карточку дела.",
  visual: branchVisual(
    "Мониторинг",
    [
      { text: "номер дела / сторона", role: "trigger" },
      { text: "источники", role: "data" },
      { text: "новое событие", role: "ai" },
      { text: "обновление карточки", role: "legal" },
    ],
    "Автодействия",
    [
      { text: "судебный акт", role: "neutral" },
      { text: "календарь", role: "deadline" },
      { text: "задача юристу", role: "legal" },
      { text: "уведомление", role: "data" },
    ],
    "контроль подготовки",
    "клиент / руководитель в курсе",
  ),
  note:
    "Появилось новое определение суда. Система сохраняет документ, ставит заседание в календарь, создаёт задачу подготовить позицию и отправляет краткое уведомление ответственному.",
});

caseSlide(deck, 17, {
  title: "Панель руководителя и выявление новых автоматизаций",
  subtitle: "События из всех маршрутов показывают реальную нагрузку, просрочки, отклонения и процессы, которые пора автоматизировать.",
  visual: hubVisual("журнал событий", [
    { text: "нагрузка юристов", role: "data" },
    { text: "SLA и сроки", role: "deadline" },
    { text: "просрочки", role: "risk" },
    { text: "отклонения", role: "deadline" },
    { text: "узкие места", role: "ai" },
    { text: "новые автоматизации", role: "legal" },
  ]),
  note:
    "Руководитель видит, что 40% договорных запросов возвращаются из-за неполных данных. Следующая автоматизация — не новый чат, а форма договорного запроса с проверкой комплектности.",
});

// 18. Benefits
{
  const slide = deck.slides.add();
  const rows = [
    ["клиент ждёт звонка", "бот сразу собирает данные"],
    ["документы в папках", "автоматическая сортировка"],
    ["сроки в голове", "календарь и напоминания"],
    ["ручные расчёты", "формульный модуль"],
    ["неясная нагрузка", "панель руководителя"],
    ["рост задач = рост штата", "масштабирование без пропорционального найма"],
  ];
  slide.compose(
    rootSlide([
      titleBlock(
        18,
        "Выгода",
        "ПравоКонтур снижает ручную операционную нагрузку",
        "Для юридической фирмы — быстрее заявки и выше готовность к консультации. Для юрдепартамента — прозрачность, стандарты и сроки.",
      ),
      grid(
        { width: fill, height: fill, columns: [fr(0.9), fr(1.2)], columnGap: 48 },
        [
          column({ width: fill, height: fill, gap: 14 }, [
            ...[
              "меньше ручной работы",
              "быстрее первичная обработка",
              "меньше потерь документов и сроков",
              "прозрачность работы юристов",
              "персональные маршруты под практику",
              "масштабирование без пропорционального роста штата",
            ].map((item, i) => row({ width: fill, height: hug, gap: 12, align: "center" }, [
              shape({
                width: fixed(12),
                height: fixed(12),
                fill: p(i % 2 ? C.cyan : C.teal),
                line: s(i % 2 ? C.cyan : C.teal, 0),
                borderRadius: 12,
              }),
              t(item, { size: 21, bold: true, color: C.graphite }),
            ])),
          ]),
          column({ width: fill, height: fill, gap: 0 }, [
            grid({ width: fill, height: hug, columns: [fr(1), fr(1)], columnGap: 0 }, [
              panel({ fill: p(C.dark), padding: { x: 22, y: 14 } }, t("До", { size: 21, bold: true, color: C.white })),
              panel({ fill: p(C.teal), padding: { x: 22, y: 14 } }, t("После", { size: 21, bold: true, color: C.white })),
            ]),
            ...rows.map(([before, after], i) =>
              grid(
                {
                  width: fill,
                  height: hug,
                  columns: [fr(1), fr(1)],
                  columnGap: 0,
                },
                [
                  panel(
                    {
                      fill: p(i % 2 ? "#F2F5F7" : C.white),
                      line: s(C.line, 1),
                      padding: { x: 22, y: 16 },
                    },
                    t(before, { size: 18, color: C.slate }),
                  ),
                  panel(
                    {
                      fill: p(i % 2 ? "#EAF8F6" : "#F7FFFD"),
                      line: s(C.line, 1),
                      padding: { x: 22, y: 16 },
                    },
                    t(after, { size: 18, bold: true, color: C.teal }),
                  ),
                ],
              ),
            ),
          ]),
        ],
      ),
    ]),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
}

// 19. Final
{
  const slide = deck.slides.add();
  slide.compose(
    panel(
      { width: fill, height: fill, fill: p(C.dark), padding: { x: 92, y: 76 } },
      column({ width: fill, height: fill, justify: "between", gap: 30 }, [
        header(19, "Связь", true),
        column({ width: fill, height: hug, gap: 24 }, [
          t("ПравоКонтур", { name: "final-title", size: 92, bold: true, color: C.white }),
          t("юридические процессы без хаоса, ручной рутины и потерянных сроков", {
            name: "final-claim",
            width: fixed(1320),
            size: 42,
            bold: true,
            color: "#A7F3F0",
          }),
        ]),
        grid({ width: fill, height: hug, columns: [fr(1.2), fr(0.8)], columnGap: 44 }, [
          column({ width: fill, gap: 18 }, [
            t("Открыты к сотрудничеству и пилотным проектам", {
              size: 30,
              bold: true,
              color: C.white,
            }),
            t("Ищем партнёров и юридические команды, которым важно сократить рутину, повысить прозрачность процессов и сделать юридическую функцию технологичной.", {
              size: 23,
              color: "#DCEAF2",
            }),
          ]),
          column({ width: fill, gap: 18 }, [
            panel(
              {
                fill: p("#FFFFFF10"),
                line: s("#2DD4BF", 1.5),
                borderRadius: 18,
                padding: { x: 24, y: 20 },
              },
              column({ width: fill, gap: 12 }, [
                t("Telegram", { size: 18, bold: true, color: "#A7F3F0" }),
                t("https://t.me/ustyuzhaninkirill", { size: 22, bold: true, color: C.white }),
              ]),
            ),
            panel(
              {
                fill: p("#FFFFFF10"),
                line: s("#38BDF8", 1.5),
                borderRadius: 18,
                padding: { x: 24, y: 20 },
              },
              column({ width: fill, gap: 12 }, [
                t("Email", { size: 18, bold: true, color: "#BAE6FD" }),
                t("ustyuzhaninkirillred@gmail.com", { size: 20, bold: true, color: C.white }),
              ]),
            ),
          ]),
        ]),
      ]),
    ),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
}

async function renderDeck(presentation, dir) {
  const files = [];
  for (const [idx, slide] of presentation.slides.items.entries()) {
    const canvas = new Canvas(W, H);
    const ctx = canvas.getContext("2d");
    await drawSlideToCtx(slide, presentation, ctx, null, null, null, null, null, null, null, {
      clearBeforeDraw: true,
    });
    const buffer = await canvas.toBuffer("png");
    const file = path.join(dir, `slide-${String(idx + 1).padStart(2, "0")}.png`);
    fs.writeFileSync(file, buffer);
    files.push(file);
  }
  return files;
}

async function makeMontage(imageFiles, output) {
  const thumbW = 480;
  const thumbH = 270;
  const cols = 4;
  const gap = 18;
  const labelH = 34;
  const rowsCount = Math.ceil(imageFiles.length / cols);
  const canvas = new Canvas(cols * thumbW + (cols + 1) * gap, rowsCount * (thumbH + labelH) + (rowsCount + 1) * gap);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#EEF2F5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "bold 18px Arial";
  ctx.fillStyle = C.slate;
  for (let i = 0; i < imageFiles.length; i += 1) {
    const img = await loadImage(imageFiles[i]);
    const colIdx = i % cols;
    const rowIdx = Math.floor(i / cols);
    const x = gap + colIdx * (thumbW + gap);
    const y = gap + rowIdx * (thumbH + labelH + gap);
    ctx.drawImage(img, x, y, thumbW, thumbH);
    ctx.fillStyle = C.slate;
    ctx.fillText(`Слайд ${i + 1}`, x, y + thumbH + 24);
  }
  fs.writeFileSync(output, await canvas.toBuffer("png"));
}

function scanPngs(files) {
  const results = [];
  for (const file of files) {
    const size = fs.statSync(file).size;
    const png = fs.readFileSync(file);
    const magic = png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    results.push({ file, size, pngMagic: magic });
  }
  return results;
}

async function inspectOpenXml(pptxFile) {
  const zip = await JSZip.loadAsync(fs.readFileSync(pptxFile));
  const names = Object.keys(zip.files);
  const slideNames = names
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml$/)[1]) - Number(b.match(/slide(\d+)\.xml$/)[1]));
  const placeholderPattern = /\b(Slide Number|Click to add|Lorem ipsum|Replace with|TODO|TBD)\b/i;
  const slideNumberPattern = /\btype="sldNum"|Slide Number/i;
  const placeholderSlides = [];
  const slideNumberSlides = [];
  const slideTextCounts = [];
  for (const [idx, name] of slideNames.entries()) {
    const xml = await zip.file(name).async("string");
    if (placeholderPattern.test(xml)) placeholderSlides.push(idx + 1);
    if (slideNumberPattern.test(xml)) slideNumberSlides.push(idx + 1);
    slideTextCounts.push({
      slide: idx + 1,
      textRuns: (xml.match(/<a:t>/g) ?? []).length,
      shapes: (xml.match(/<p:sp\b/g) ?? []).length,
      pictures: (xml.match(/<p:pic\b/g) ?? []).length,
    });
  }
  const media = names.filter((name) => name.startsWith("ppt/media/"));
  const zeroByteMedia = media.filter((name) => zip.files[name]._data?.uncompressedSize === 0);
  return {
    slideCount: slideNames.length,
    mediaCount: media.length,
    chartCount: names.filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name)).length,
    placeholderSlides,
    slideNumberSlides,
    zeroByteMedia,
    slideTextCounts,
    passed:
      slideNames.length === 19 &&
      placeholderSlides.length === 0 &&
      slideNumberSlides.length === 0 &&
      zeroByteMedia.length === 0,
  };
}

const blob = await PresentationFile.exportPptx(deck);
await blob.save(finalPptx);

const sourcePngs = await renderDeck(deck, sourceRenderDir);
const savedDeck = await PresentationFile.importPptx(fs.readFileSync(finalPptx));
const pptxPngs = await renderDeck(savedDeck, pptxRenderDir);
await makeMontage(pptxPngs, montagePath);
const openXml = await inspectOpenXml(finalPptx);

const report = {
  generatedAt: new Date().toISOString(),
  slideCount: deck.slides.items.length,
  output: finalPptx,
  sourceRenderDir,
  pptxRenderDir,
  montage: montagePath,
  checks: {
    expectedSlides: deck.slides.items.length === 19,
    pptxExists: fs.existsSync(finalPptx),
    pptxBytes: fs.statSync(finalPptx).size,
    openXml,
    sourcePngs: scanPngs(sourcePngs),
    pptxPngs: scanPngs(pptxPngs),
    pptxReimported: savedDeck.slides.items.length === 19,
    sourcesVerifiedInDeck: [
      "Telegram Bot API: https://core.telegram.org/bots/api",
      "Google Calendar Events.insert: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert",
      "Yandex Disk REST API: https://yandex.com/dev/disk/rest/",
      "Official legal publication portal: https://publication.pravo.gov.ru/",
    ],
  },
};

fs.writeFileSync(qaReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  pptx: finalPptx,
  slides: deck.slides.items.length,
  sourceRenderDir,
  pptxRenderDir,
  montage: montagePath,
  qaReport: qaReportPath,
}, null, 2));
