begin;

-- Padroniza chave de SLA para aprovacao do CEO em aditivos contratuais.
update public.request_sla_settings
set
  config_key = 'project_contract_events_ceo_approval',
  description = 'SLA em horas para aprovacao do CEO em aditivos de valor de contratos de projetos.'
where config_key = 'project_contract_events_finance_approval'
  and not exists (
    select 1
    from public.request_sla_settings s
    where s.config_key = 'project_contract_events_ceo_approval'
  );

insert into public.request_sla_settings (config_key, sla_hours, description)
values (
  'project_contract_events_ceo_approval',
  48,
  'SLA em horas para aprovacao do CEO em aditivos de valor de contratos de projetos.'
)
on conflict (config_key) do nothing;

delete from public.request_sla_settings
where config_key = 'project_contract_events_finance_approval'
  and exists (
    select 1
    from public.request_sla_settings s
    where s.config_key = 'project_contract_events_ceo_approval'
  );

commit;
