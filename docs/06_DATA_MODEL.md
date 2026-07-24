# Data Model

Bu belge kavramsal şemayı tanımlar. Fiziksel alan adları migration aşamasında netleştirilir.

## 1. Kimlik ve erişim

### users

- id
- email
- display_name
- password_hash
- role: owner | manager
- status
- last_login_at
- created_at
- updated_at

### user_business_unit_scopes

- user_id
- business_unit_id

Owner tüm kapsama sahip olabilir; Manager için en az bir kapsam atanır.

## 2. Odoo bağlantısı

### odoo_connections

- id
- name
- base_url
- database_name, gerekliyse
- api_version
- encrypted_api_key veya secret_reference
- active
- last_tested_at
- last_success_at
- last_error_code

### odoo_companies

- id
- connection_id
- odoo_id
- source_name
- source_currency_id
- active

### business_units

- id
- code
- display_name
- active
- display_order

### company_mappings

- odoo_company_id
- business_unit_id
- effective_from
- effective_to

## 3. Kaynak boyutlar

### customers

- source identity
- company_id
- name
- country
- active
- source_create_date
- source_write_date

### salespersons

- source identity
- display_name
- active
- company scope

### products

- source identity
- name
- category
- active

### currencies

- source identity
- code
- name

## 4. Satış verisi

### sales_orders

- source identity
- company_id
- business_unit_id
- order_name
- customer_id
- salesperson_id
- source_state
- normalized_status
- create_date
- quotation_date
- confirmation_date
- validity_date
- write_date
- currency_id
- amount_untaxed
- amount_tax
- amount_total
- active/source_deleted flag
- raw_fingerprint

### sales_order_lines

- source identity
- sales_order_id
- product_id
- quantity
- unit_price
- subtotal
- currency_id

## 5. Senkronizasyon

### sync_runs

- id
- connection_id
- job_type
- started_at
- finished_at
- status
- fetched_count
- inserted_count
- updated_count
- skipped_count
- error_count
- cursor_before
- cursor_after

### sync_errors

- sync_run_id
- model_name
- source_id
- error_type
- safe_message
- retry_count
- resolved_at

### sync_cursors

- connection_id
- model_name
- last_write_date
- last_source_id

## 6. Raporlar

### report_definitions

- id
- code
- name
- description
- category
- implementation_key
- status: draft | published | archived
- current_version
- allowed_roles
- default_filters
- created_by

### report_versions

- report_definition_id
- version
- configuration_json
- metric_versions_json
- released_at

### report_runs

- report_definition_id
- report_version
- requested_by
- filters_json
- started_at
- finished_at
- status
- result_summary_json

### generated_exports

- report_run_id
- format
- storage_key
- expires_at
- checksum

## 7. Veri kalitesi

### data_quality_issues

- issue_type
- severity
- entity_type
- entity_id
- detected_at
- details_json
- status
- resolved_at

## 8. Denetim

### audit_logs

- actor_user_id
- action
- entity_type
- entity_id
- business_unit_scope
- safe_metadata_json
- created_at

Secret, parola, tam API response veya hassas veri audit metadata’sına yazılmaz.
