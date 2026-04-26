import type { CanvasModuleCard } from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CanvasModuleSearchService {
  filter(
    modules: readonly CanvasModuleCard[],
    query: string | undefined,
  ): readonly CanvasModuleCard[] {
    const normalized = normalize(query);
    if (!normalized) {
      return modules;
    }

    return modules.filter((module) =>
      [
        module.display_name,
        module.short_description,
        module.module_code,
        module.category_label,
        ...module.tags,
        ...module.aliases,
        ...module.input_summary.map((input) => input.label),
        ...module.output_summary.map((output) => output.label),
      ]
        .map(normalize)
        .some((value) => value.includes(normalized)),
    );
  }
}

function normalize(value: string | undefined) {
  return (value ?? '').trim().toLocaleLowerCase('ru-RU');
}
