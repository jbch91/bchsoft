DELETE FROM client_modules
WHERE module_key = 'clientes';

UPDATE subscription_plans
SET included_modules = COALESCE(
  (
    SELECT JSONB_AGG(module_key ORDER BY module_key)
    FROM JSONB_ARRAY_ELEMENTS_TEXT(included_modules) AS module_key
    WHERE module_key <> 'clientes'
  ),
  '[]'::jsonb
)
WHERE included_modules ? 'clientes';
