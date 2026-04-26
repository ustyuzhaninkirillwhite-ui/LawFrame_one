create or replace view app.canvas_validation_runs as
select *
from app.automation_canvas_validation_results;

create or replace view app.canvas_validation_issues as
select *
from app.automation_canvas_validation_issues;

create or replace view app.canvas_test_runs as
select *
from app.automation_canvas_test_runs;

create or replace view app.canvas_test_run_steps as
select *
from app.automation_canvas_test_run_steps;

comment on view app.canvas_validation_runs is
  'Stage 16 live-audit compatibility view. Canonical storage table: app.automation_canvas_validation_results.';

comment on view app.canvas_validation_issues is
  'Stage 16 live-audit compatibility view. Canonical storage table: app.automation_canvas_validation_issues.';

comment on view app.canvas_test_runs is
  'Stage 16 live-audit compatibility view. Canonical storage table: app.automation_canvas_test_runs.';

comment on view app.canvas_test_run_steps is
  'Stage 16 live-audit compatibility view. Canonical storage table: app.automation_canvas_test_run_steps.';

grant select on app.canvas_validation_runs to authenticated;
grant select on app.canvas_validation_issues to authenticated;
grant select on app.canvas_test_runs to authenticated;
grant select on app.canvas_test_run_steps to authenticated;
