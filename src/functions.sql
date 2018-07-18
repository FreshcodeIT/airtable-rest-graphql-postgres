CREATE OR REPLACE FUNCTION ARRAYUNIQUE(data jsonb) RETURNS jsonb
    AS $$ SELECT jsonb_agg(distinct elem) FROM jsonb_array_elements(data) elem $$
    LANGUAGE SQL
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;

CREATE OR REPLACE FUNCTION ARRAYCOMPACT(data jsonb) RETURNS jsonb
    AS $$ SELECT jsonb_agg(elem) FROM jsonb_array_elements(data) elem WHERE NOT elem='null' $$
    LANGUAGE SQL
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;

CREATE OR REPLACE FUNCTION ARRAYJOIN(data jsonb, separator text) RETURNS text
    AS $$ SELECT string_agg(trim(elem::text, '"'), ', ') FROM jsonb_array_elements(data) elem $$
    LANGUAGE SQL
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;

CREATE OR REPLACE FUNCTION FIND(stringToFind text, whereToSearch text,startFromPosition integer default 0) RETURNS integer 
    AS $$ SELECT position(stringToFind in substring(whereToSearch from startFromPosition)) $$
    LANGUAGE SQL
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;