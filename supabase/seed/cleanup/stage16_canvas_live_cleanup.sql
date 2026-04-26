delete from app.automation_runtime_bindings
where id = '16000000-0000-4000-8000-00000000a001'
   or external_project_id = 'stage16-activepieces-project';

delete from app.runtime_connections
where workspace_id in (
  '16000000-0000-4000-8000-00000000100a',
  '16000000-0000-4000-8000-00000000100b'
)
and (code like 'stage16-%' or code = 'email_provider');

delete from app.installed_automations
where id = '16000000-0000-4000-8000-000000008001';

delete from app.automation_template_versions
where id = '16000000-0000-4000-8000-000000007101';

delete from app.automation_templates
where id = '16000000-0000-4000-8000-000000007001'
   or code = 'stage16-live-canvas-template';

delete from app.legal_module_runtime_mappings
where module_version_id in (
  select mv.id
  from app.legal_module_versions mv
  join app.legal_modules m on m.id = mv.module_id
  where m.code like 'stage16.audit.%'
);

delete from app.legal_module_versions
where module_id in (select id from app.legal_modules where code like 'stage16.audit.%');

delete from app.legal_modules
where code like 'stage16.audit.%';

delete from app.activepieces_piece_registry
where piece_name like '@lexframe/stage16-%';

update app.document_templates
set active_version_id = null
where id = '16000000-0000-4000-8000-000000005001';

delete from app.document_template_versions
where id = '16000000-0000-4000-8000-000000005101';

delete from app.document_templates
where id = '16000000-0000-4000-8000-000000005001';

update app.legal_work_profiles
set current_version_id = null
where id = '16000000-0000-4000-8000-000000004001';

delete from app.legal_work_profile_versions
where id = '16000000-0000-4000-8000-000000004101';

delete from app.legal_work_profiles
where id = '16000000-0000-4000-8000-000000004001';

update app.documents
set current_version_id = null
where id in (
  '16000000-0000-4000-8000-000000002001',
  '16000000-0000-4000-8000-000000002002',
  '16000000-0000-4000-8000-000000002003',
  '16000000-0000-4000-8000-000000002004',
  '16000000-0000-4000-8000-00000000200b'
);

delete from app.document_versions
where document_id in (
  '16000000-0000-4000-8000-000000002001',
  '16000000-0000-4000-8000-000000002002',
  '16000000-0000-4000-8000-000000002003',
  '16000000-0000-4000-8000-000000002004',
  '16000000-0000-4000-8000-00000000200b'
);

delete from app.documents
where id in (
  '16000000-0000-4000-8000-000000002001',
  '16000000-0000-4000-8000-000000002002',
  '16000000-0000-4000-8000-000000002003',
  '16000000-0000-4000-8000-000000002004',
  '16000000-0000-4000-8000-00000000200b'
);

delete from app.workspace_members
where workspace_id in (
  '16000000-0000-4000-8000-00000000100a',
  '16000000-0000-4000-8000-00000000100b'
);

delete from app.profiles
where email like 'stage16.%@lexframe.test';

delete from app.workspaces
where slug in ('stage16-live-a', 'stage16-live-b');

delete from auth.users
where email like 'stage16.%@lexframe.test';
