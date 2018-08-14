CREATE OR REPLACE FUNCTION is_valid_json(p_json text)
  RETURNS BOOLEAN
AS
$$
BEGIN
  return (p_json::json is not null);
exception 
  when others then
     return false;  
END;
$$
LANGUAGE PLPGSQL
IMMUTABLE;

CREATE OR REPLACE FUNCTION numeric_to_boolean(num numeric) RETURNS BOOLEAN 
AS 
$$
BEGIN 
    return num>0;
END;
$$
LANGUAGE PLPGSQL
IMMUTABLE;

DROP CAST IF EXISTS (numeric AS boolean);
CREATE CAST (numeric AS boolean) WITH FUNCTION numeric_to_boolean(numeric) AS IMPLICIT;

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

CREATE OR REPLACE FUNCTION JSON_BINOP(type text, op text, leftOp text, rightOp text) RETURNS numeric LANGUAGE plpgsql STABLE AS $_$
DECLARE
  result numeric;
BEGIN
CASE 

  WHEN type='math' THEN 
   CASE 
    WHEN leftOp='' AND rightOp='' THEN result:=0;
    WHEN leftOp='' THEN result:=rightOp;
    WHEN rightOp='' THEN result:=leftOp;
    WHEN leftOp ~ '^-?\d+(.\d+)?$' AND rightOp ~ '^-?\d+(.\d+)?$' THEN 
        EXECUTE format('SELECT $1 %s $2', op) USING leftOp::numeric, rightOp::numeric INTO result;
  END CASE;

  when type='rel' THEN
   CASE 
    WHEN leftOp ~ '^-?\d+(.\d+)?$' AND rightOp ~ '^-?\d+(.\d+)?$' THEN 
        EXECUTE format('SELECT ($1 %s $2)::integer', op) USING leftOp::numeric, rightOp::numeric INTO result;
    WHEN is_valid_json(leftOp) AND jsonb_typeof(leftOp::jsonb)='array' THEN
        SELECT JSON_BINOP(type,op,ARRAYJOIN(leftOp, ','),rightOp) INTO result;
    WHEN is_valid_json(rightOp) AND jsonb_typeof(rightOp::jsonb)='array' THEN
        SELECT JSON_BINOP(type,op,leftOp,ARRAYJOIN(rightOp,',')) INTO result;
    ELSE 
        EXECUTE format('SELECT ($1 %s $2)::integer', op) USING leftOp::text, rightOp::text INTO result;
  END CASE;

END CASE;
RETURN result;
END;
$_$;
