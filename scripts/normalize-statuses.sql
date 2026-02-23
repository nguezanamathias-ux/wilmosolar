-- Normalize statuses to: en_attente, confirmee, echec
-- Run once on your database.

UPDATE withdrawals
SET status = 'confirmee'
WHERE status IN ('confirmee', 'confirmée', 'confirmed');

UPDATE deposits
SET status = 'confirmee'
WHERE status IN ('confirmee', 'confirmée', 'confirmed');

UPDATE transactions
SET status = 'confirmee'
WHERE status IN ('confirmee', 'confirmée', 'confirmed');

UPDATE withdrawals
SET status = 'en_attente'
WHERE status IN ('en attente', 'pending', 'enattente');

UPDATE deposits
SET status = 'en_attente'
WHERE status IN ('en attente', 'pending', 'enattente');

UPDATE transactions
SET status = 'en_attente'
WHERE status IN ('en attente', 'pending', 'enattente');

UPDATE withdrawals
SET status = 'echec'
WHERE status IN ('echec', 'échoué', 'echec ', 'failed');

UPDATE deposits
SET status = 'echec'
WHERE status IN ('echec', 'échoué', 'echec ', 'failed');

UPDATE transactions
SET status = 'echec'
WHERE status IN ('echec', 'échoué', 'echec ', 'failed');
