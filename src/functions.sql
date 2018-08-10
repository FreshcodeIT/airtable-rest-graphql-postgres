CREATE OR REPLACE FUNCTION ARRAYUNIQUE(data text) RETURNS jsonb
    AS $$ SELECT jsonb_agg(distinct elem) FROM jsonb_array_elements(data::jsonb) elem $$
    LANGUAGE SQL
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;

CREATE OR REPLACE FUNCTION ARRAYCOMPACT(data text) RETURNS jsonb
    AS $$ SELECT jsonb_agg(elem) FROM jsonb_array_elements(data::jsonb) elem WHERE NOT elem='null' $$
    LANGUAGE SQL
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;

CREATE OR REPLACE FUNCTION ARRAYJOIN(data text, separator text) RETURNS text
    AS $$ SELECT string_agg(trim(elem::text, '"'), separator) FROM jsonb_array_elements(data::jsonb) elem $$
    LANGUAGE SQL
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;

CREATE OR REPLACE FUNCTION FIND(stringToFind text, whereToSearch text,startFromPosition integer default 0) RETURNS integer 
    AS $$ SELECT position(stringToFind in substring(whereToSearch from startFromPosition)) $$
    LANGUAGE SQL
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;

CREATE OR REPLACE FUNCTION JSON_BINOP(type text, op text, leftOp text, rightOp text) RETURNS int LANGUAGE plpgsql STABLE AS $_$
DECLARE
  result int;
BEGIN
CASE 

  WHEN type='math' THEN 
   CASE 
    WHEN leftOp='' AND rightOp='' THEN result:=0;
    WHEN leftOp='' THEN result:=rightOp;
    WHEN rightOp='' THEN result:=leftOp;
    WHEN leftOp ~ '^\d+(.\d+)?$' AND rightOp ~ '^\d+(.\d+)?$' THEN 
        EXECUTE format('SELECT $1 %s $2', op) USING leftOp::integer, rightOp::integer INTO result;
  END CASE;

  when type='rel' THEN
   CASE 
    WHEN leftOp ~ '^\d+(.\d+)?$' AND rightOp ~ '^\d+(.\d+)?$' THEN 
        EXECUTE format('SELECT ($1 %s $2)::integer', op) USING leftOp::integer, rightOp::integer INTO result;
    ELSE 
        EXECUTE format('SELECT ($1 %s $2)::integer', op) USING leftOp::text, rightOp::text INTO result;
  END CASE;

END CASE;
RETURN result;
END;
$_$;
