export default function PulsePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-10">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--lf-text-muted)]">
        LexFrame
      </div>
      <h1 className="text-3xl font-semibold text-[color:var(--lf-text-primary)]">
        Пульс
      </h1>
      <p className="max-w-2xl text-sm text-[color:var(--lf-text-muted)]">
        Здесь будет лента последних изменений законодательства, судебной практики и
        связанных уведомлений по проектам.
      </p>
    </div>
  );
}
