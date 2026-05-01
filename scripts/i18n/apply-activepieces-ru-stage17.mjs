import fs from "node:fs";
import path from "node:path";

const activepiecesRoot =
  process.env.ACTIVEPIECES_SOURCE_DIR ?? "E:/activepieces-main";
const localesRoot = path.join(
  activepiecesRoot,
  "packages/web/public/locales",
);
const enPath = path.join(localesRoot, "en/translation.json");
const ruPath = path.join(localesRoot, "ru/translation.json");

const en = readJson(enPath);
const ru = readJson(ruPath);

const known = new Map(
  Object.entries({
    "0": "0",
    "Edit flow": "Редактировать автоматизацию",
    "View draft": "Открыть черновик",
    "Zoom in": "Приблизить",
    "Zoom out": "Отдалить",
    "Fit to view": "Подогнать к экрану",
    "Grab mode": "Режим перемещения",
    "Select mode": "Режим выбора",
    "Add note": "Добавить заметку",
    "Leaving this page while saving will discard your changes, are you sure you want to leave?":
      "Если уйти со страницы во время сохранения, изменения будут потеряны. Уйти?",
    "Double click to edit...": "Дважды нажмите для редактирования...",
    "Double click to edit": "Дважды нажмите для редактирования",
    Color: "Цвет",
    "Incomplete step": "Незавершенный шаг",
    "Testing...": "Идет тестирование...",
    Trigger: "Триггер",
    "You have unpublished changes": "Есть неопубликованные изменения",
    "Discard changes": "Отменить изменения",
    "You have incomplete steps": "Есть незавершенные шаги",
    "Discarding changes...": "Отменяем изменения...",
    Publish: "Опубликовать",
    Save: "Сохранить",
    Run: "Запустить",
    Runs: "Запуски",
    Connections: "Подключения",
    Settings: "Настройки",
    Error: "Ошибка",
    Warning: "Предупреждение",
    Flow: "Автоматизация",
    Flows: "Автоматизации",
    Builder: "Конструктор",
    Piece: "Модуль",
    Pieces: "Модули",
    "Run Details": "Детали запуска",
    "Recent Runs": "Последние запуски",
    "No runs found": "Запусков не найдено",
    "Global Connections": "Глобальные подключения",
    "Project Settings": "Настройки проекта",
    "Replace Connections": "Заменить подключения",
    "Delete Connections": "Удалить подключения",
    "No connections found": "Подключения не найдены",
    "Flow Run": "Запуск автоматизации",
    "Run Succeeded": "Запуск выполнен",
    "Run Failed": "Запуск завершился ошибкой",
    "Exit Run": "Выйти из запуска",
    "Published Version": "Опубликованная версия",
    "Flow has been published.": "Автоматизация опубликована.",
    "Please publish flow first": "Сначала опубликуйте автоматизацию",
    "Publishing...": "Публикуем...",
    "Errors are not saved on refresh":
      "Ошибки не сохраняются при обновлении страницы",
    "Time Saved Per Run": "Сэкономленное время за запуск",
    "Total Time Saved": "Всего сэкономлено времени",
    "This flow ran {runs} time(s), saving {minutesSaved} minutes per run":
      "Автоматизация запускалась {runs} раз(а), экономия {minutesSaved} минут за запуск",
    "Time Saved": "Сэкономленное время",
    "Time Saved Over Time": "Экономия времени в динамике",
    "Manage Billing": "Управление оплатой",
    "Business trial started successfully": "Пробный бизнес-период запущен",
    "Start Business Trial": "Запустить пробный бизнес-период",
    "Manage alerts settings": "Настройка оповещений",
    "Sign in With": "Войти через",
    "Monitor your active flows usage":
      "Отслеживайте использование активных автоматизаций",
    "Manage Active Flows": "Управление активными автоматизациями",
    "Adjust your automation capacity by modifying the number of active flows.":
      "Измените емкость автоматизаций через количество активных автоматизаций.",
    "Total number of active flows": "Общее число активных автоматизаций",
    "flows (min)": "автоматизаций (мин.)",
    "Current active flows limit: ":
      "Текущий лимит активных автоматизаций: ",
    Pack: "Пакет",
    "Updating Active Flows": "Обновление активных автоматизаций",
    "Current projects: ": "Текущие проекты: ",
    "/month": "/месяц",
    "Monitor your projects usage": "Отслеживайте использование проектов",
    "Approaching limit": "Лимит близко",
    "/year": "/год",
    "plan — explore all features and make the most of your trial.":
      "тариф: изучите возможности и используйте пробный период.",
    "See Plans": "Посмотреть тарифы",
    "Save 24%": "Экономия 24%",
    "Viewing retried runs": "Просмотр повторных запусков",
    "Translate Activepieces": "Перевести конструктор автоматизаций",
    "Activepieces Copilot": "AI-помощник конструктора",
    "Brand Activepieces": "Брендинг конструктора",
    "Get started with Activepieces": "Начните работу с автоматизацией",
    "Activepieces Crash Course": "Краткий курс по автоматизации",
    "Receive updates and newsletters from activepieces":
      "Получать обновления и новости продукта",
    "Preview (Activepieces Todos)": "Предпросмотр (задачи автоматизации)",
  }),
);

const phraseReplacements = [
  [/Powered by Activepieces/gi, "Конструктор автоматизаций"],
  [/Activepieces Copilot/g, "AI-помощник конструктора"],
  [/Activepieces Todos/g, "задачи автоматизации"],
  [/Activepieces APIs/g, "API конструктора автоматизаций"],
  [/Activepieces API/g, "API конструктора автоматизаций"],
  [/Activepieces instance/g, "экземпляра конструктора автоматизаций"],
  [/Activepieces/g, "Конструктор автоматизаций"],
  [/activepieces cloud/g, "облака модулей"],
  [/activepieces/g, "автоматизаций"],
  [/Errors are not saved on refresh/g, "Ошибки не сохраняются при обновлении страницы"],
  [/Time Saved Per Run/g, "Сэкономленное время за запуск"],
  [/Total Time Saved/g, "Всего сэкономлено времени"],
  [/This flow ran \{runs\} time\(s\), saving \{minutesSaved\} minutes per run/g, "Автоматизация запускалась {runs} раз(а), экономия {minutesSaved} минут за запуск"],
  [/Time Saved Over Time/g, "Экономия времени в динамике"],
  [/Time Saved/g, "Сэкономленное время"],
  [/Publishing\.\.\./g, "Публикуем..."],
  [/\bSave\b/g, "Сохранить"],
  [/\bRun Details\b/g, "Детали запуска"],
  [/\bRecent Runs\b/g, "Последние запуски"],
  [/\bRuns\b/g, "Запуски"],
  [/\bRun\b/g, "Запуск"],
  [/\brun\b/g, "запуск"],
  [/\bPublish\b/g, "Опубликовать"],
  [/\bPublishing\b/g, "Публикация"],
  [/\bConnections\b/g, "Подключения"],
  [/\bConnection\b/g, "Подключение"],
  [/\bSettings\b/g, "Настройки"],
  [/\bErrors\b/g, "Ошибки"],
  [/\bError\b/g, "Ошибка"],
  [/\bWarning\b/g, "Предупреждение"],
  [/\bBuilder\b/g, "Конструктор"],
  [/\bFlows\b/g, "Автоматизации"],
  [/\bFlow\b/g, "Автоматизация"],
  [/\bPieces\b/g, "Модули"],
  [/\bPiece\b/g, "Модуль"],
  [/потоками/g, "автоматизациями"],
  [/потоков/g, "автоматизаций"],
  [/потоки/g, "автоматизации"],
  [/потока/g, "автоматизации"],
  [/потоке/g, "автоматизации"],
  [/поток/g, "автоматизацию"],
  [/соединения/g, "подключения"],
  [/соединений/g, "подключений"],
  [/соединение/g, "подключение"],
  [/AI/g, "ИИ"],
];

const tokenMap = [
  [/\bAdd\b/g, "Добавить"],
  [/\bCreate\b/g, "Создать"],
  [/\bDelete\b/g, "Удалить"],
  [/\bEdit\b/g, "Редактировать"],
  [/\bUpdate\b/g, "Обновить"],
  [/\bView\b/g, "Просмотр"],
  [/\bOpen\b/g, "Открыть"],
  [/\bClose\b/g, "Закрыть"],
  [/\bCancel\b/g, "Отменить"],
  [/\bRetry\b/g, "Повторить"],
  [/\bFailed\b/g, "Ошибка"],
  [/\bSucceeded\b/g, "Выполнено"],
  [/\bSuccess\b/g, "Успешно"],
  [/\bName\b/g, "Название"],
  [/\bDescription\b/g, "Описание"],
  [/\bProject\b/g, "Проект"],
  [/\bProjects\b/g, "Проекты"],
  [/\bTable\b/g, "Таблица"],
  [/\bTables\b/g, "Таблицы"],
  [/\bFolder\b/g, "Папка"],
  [/\bFolders\b/g, "Папки"],
  [/\bStep\b/g, "Шаг"],
  [/\bSteps\b/g, "Шаги"],
  [/\bTrigger\b/g, "Триггер"],
  [/\bAction\b/g, "Действие"],
  [/\bActions\b/g, "Действия"],
  [/\bStatus\b/g, "Статус"],
  [/\bTest\b/g, "Тест"],
  [/\bTesting\b/g, "Тестирование"],
  [/\bDraft\b/g, "Черновик"],
  [/\bVersion\b/g, "Версия"],
  [/\bVersions\b/g, "Версии"],
  [/\bPublished\b/g, "Опубликовано"],
  [/\bHome\b/g, "Главная"],
  [/\bDashboard\b/g, "Панель"],
  [/\bUsers\b/g, "Пользователи"],
  [/\bUser\b/g, "Пользователь"],
  [/\bRole\b/g, "Роль"],
  [/\bEmail\b/g, "Email"],
  [/\bPassword\b/g, "Пароль"],
  [/\bSearch\b/g, "Поиск"],
  [/\bFilter\b/g, "Фильтр"],
  [/\bImport\b/g, "Импорт"],
  [/\bExport\b/g, "Экспорт"],
];

const ordered = {};
for (const key of Object.keys(en)) {
  const current = ru[key];
  ordered[key] =
    typeof current === "string" && current.trim() === ""
      ? fallbackTranslate(key, en[key])
      : current === undefined
        ? fallbackTranslate(key, en[key])
        : clean(current);
}

fs.writeFileSync(ruPath, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      locale: "ru",
      baseKeys: Object.keys(en).length,
      translatedKeys: Object.keys(ordered).length,
      missingKeys: 0,
      emptyValues: Object.values(ordered).filter(
        (value) => typeof value === "string" && value.trim() === "",
      ).length,
    },
    null,
    2,
  ),
);

function fallbackTranslate(key, source) {
  if (known.has(key)) {
    return known.get(key);
  }

  if (typeof source !== "string") {
    return source;
  }

  let next = source.trim() ? source : key;
  for (const [pattern, replacement] of phraseReplacements) {
    next = next.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of tokenMap) {
    next = next.replace(pattern, replacement);
  }
  return next.trim() ? next : key;
}

function clean(value) {
  if (typeof value !== "string") {
    return value;
  }

  let next = value;
  for (const [pattern, replacement] of phraseReplacements) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
