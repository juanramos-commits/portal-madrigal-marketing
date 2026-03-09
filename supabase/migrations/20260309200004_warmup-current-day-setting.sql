-- Add warmup_current_day setting (starts at 0 for fresh installs)
INSERT INTO ventas_em_settings (key, value, description)
VALUES ('warmup_current_day', '0', 'Día actual del warmup (0 = no iniciado)')
ON CONFLICT (key) DO NOTHING;
