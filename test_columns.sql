-- Test if columns exist
SELECT name FROM pragma_table_info('flow_runs') WHERE name = 'input_payload';
SELECT name FROM pragma_table_info('step_runs') WHERE name = 'input_payload';
SELECT name FROM pragma_table_info('step_runs') WHERE name = 'output_payload';
