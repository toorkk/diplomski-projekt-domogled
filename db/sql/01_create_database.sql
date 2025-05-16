-- 1. Ustvari bazo in omogoči postgis
\c postgres;

DROP DATABASE IF EXISTS domogled;

CREATE DATABASE domogled
  WITH ENCODING='UTF8'
       LC_COLLATE='sl_SI.utf8'
       LC_CTYPE='sl_SI.utf8'
       TEMPLATE=template0;

\c domogled;
CREATE EXTENSION IF NOT EXISTS postgis;
