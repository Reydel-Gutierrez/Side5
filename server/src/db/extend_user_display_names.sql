-- MySQL / MariaDB: set every user's display_name to "<first word> <random surname>".
-- First word = text before the first space (trimmed). Surname is picked deterministically from id so re-runs stay stable.
-- display_name is VARCHAR(100); result is truncated safely.

UPDATE users
SET display_name = LEFT(
  CONCAT(
    SUBSTRING_INDEX(TRIM(display_name), ' ', 1),
    ' ',
    ELT(
      1 + MOD(id, 50),
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
      'Rodriguez',
      'Martinez',
      'Hernandez',
      'Lopez',
      'Gonzalez',
      'Wilson',
      'Anderson',
      'Thomas',
      'Taylor',
      'Moore',
      'Jackson',
      'Martin',
      'Lee',
      'Perez',
      'Thompson',
      'White',
      'Harris',
      'Sanchez',
      'Clark',
      'Ramirez',
      'Lewis',
      'Robinson',
      'Walker',
      'Young',
      'Allen',
      'King',
      'Wright',
      'Scott',
      'Torres',
      'Nguyen',
      'Hill',
      'Flores',
      'Green',
      'Adams',
      'Nelson',
      'Baker',
      'Hall',
      'Rivera',
      'Campbell',
      'Mitchell',
      'Carter',
      'Roberts'
    )
  ),
  100
);

-- Optional: preview what would change (run in a transaction or copy DB first)
-- SELECT id, username, display_name AS new_display_name
-- FROM (
--   SELECT id, username,
--     LEFT(CONCAT(SUBSTRING_INDEX(TRIM(display_name), ' ', 1), ' ',
--       ELT(1 + MOD(id, 50), 'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts')), 100) AS display_name
--   FROM users
-- ) x;
