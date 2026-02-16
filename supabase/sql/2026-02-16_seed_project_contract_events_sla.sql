begin;

insert into public.request_sla_settings (config_key, sla_hours, description)
values (
  'project_contract_events_ceo_approval',
  48,
  'SLA em horas para aprovacao do CEO em aditivos de valor de contratos de projetos.'
)
on conflict (config_key) do nothing;

commit;
