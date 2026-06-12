-- ============================================================
-- MISS DUMALINAO 2026 - Official Candidates
-- Photos must exist in server/uploads/ - run `npm run seed:candidates`
-- which copies them from server/graphics/ and applies this file.
--
-- NOTE: candidate_number follows cluster order (LGU = 9, NGA = 10)
-- and age is a PLACEHOLDER (18) - correct both in Admin -> Candidates.
-- ============================================================
USE miss_dumalinao_2026;

INSERT INTO candidates (candidate_number, candidate_name, municipality, age, photo) VALUES
  (1,  'Princess Diane R. Libo-on',  'Cluster 1', 18, '/uploads/candidate-1.jpg'),
  (2,  'Jelian Faith B. Beloy',      'Cluster 2', 18, '/uploads/candidate-2.jpg'),
  (3,  'Justine M. Singue',          'Cluster 3', 18, '/uploads/candidate-3.jpg'),
  (4,  'Jhonie Lou Balbuena',        'Cluster 4', 18, '/uploads/candidate-4.jpg'),
  (5,  'Mariz S. Orapa',             'Cluster 5', 18, '/uploads/candidate-5.jpg'),
  (6,  'Mecel Mae L. Caparoso',      'Cluster 6', 18, '/uploads/candidate-6.jpg'),
  (7,  'Jana Mae F. Abrenica',      'Cluster 7', 18, '/uploads/candidate-7.jpg'),
  (8,  'Maraille Jhulaiza O. Awa',   'Cluster 8', 18, '/uploads/candidate-8.jpg'),
  (9,  'Rosemae Cabasura',           'LGU',       18, '/uploads/candidate-9.jpg'),
  (10, 'Jalaine O. Rosal',           'NGA',       18, '/uploads/candidate-10.jpg')
ON DUPLICATE KEY UPDATE
  candidate_name = VALUES(candidate_name),
  municipality   = VALUES(municipality),
  photo          = VALUES(photo);
