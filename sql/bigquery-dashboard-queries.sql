-- PairMuse BigQuery dashboard queries
-- Replace YOUR_PROJECT with your GCP project ID if you copy queries outside matchcraft-app.

-- 1. Daily active anonymous sessions
SELECT
  DATE(eventTimestamp) AS event_date,
  COUNT(DISTINCT sessionId) AS active_sessions
FROM `matchcraft-app.pairmuse_analytics.events`
GROUP BY 1
ORDER BY 1 DESC;

-- 2. Daily funnel by session
SELECT
  DATE(eventTimestamp) AS event_date,
  COUNT(DISTINCT IF(eventName = 'session_touched', sessionId, NULL)) AS sessions,
  COUNT(DISTINCT IF(eventName = 'image_uploaded', sessionId, NULL)) AS uploaded,
  COUNT(DISTINCT IF(eventName = 'image_analyzed', sessionId, NULL)) AS analyzed,
  COUNT(DISTINCT IF(eventName = 'partner_generated', sessionId, NULL)) AS generated_partner,
  COUNT(DISTINCT IF(eventName = 'couple_generated', sessionId, NULL)) AS generated_couple
FROM `matchcraft-app.pairmuse_analytics.events`
GROUP BY 1
ORDER BY 1 DESC;

-- 3. Partner generation mix
SELECT
  matchKind,
  COUNT(*) AS total_generations
FROM `matchcraft-app.pairmuse_analytics.events`
WHERE eventName = 'partner_generated'
GROUP BY 1
ORDER BY 2 DESC;

-- 4. Couple scene popularity
SELECT
  scene,
  COUNT(*) AS total_couple_generations
FROM `matchcraft-app.pairmuse_analytics.events`
WHERE eventName = 'couple_generated'
GROUP BY 1
ORDER BY 2 DESC;

-- 5. Average partner generations per session
WITH session_partner_counts AS (
  SELECT
    sessionId,
    COUNT(*) AS partner_generations
  FROM `matchcraft-app.pairmuse_analytics.events`
  WHERE eventName = 'partner_generated'
  GROUP BY 1
)
SELECT
  AVG(partner_generations) AS avg_partner_generations_per_session
FROM session_partner_counts;

-- 6. Average total generations per session
WITH session_generation_counts AS (
  SELECT
    sessionId,
    COUNTIF(eventName = 'partner_generated') AS partner_generations,
    COUNTIF(eventName = 'couple_generated') AS couple_generations
  FROM `matchcraft-app.pairmuse_analytics.events`
  GROUP BY 1
)
SELECT
  AVG(partner_generations + couple_generations) AS avg_total_generations_per_session
FROM session_generation_counts;

-- 7. Error rate by route
SELECT
  route,
  COUNTIF(status = 'error') AS error_events,
  COUNT(*) AS total_events,
  SAFE_DIVIDE(COUNTIF(status = 'error'), COUNT(*)) AS error_rate
FROM `matchcraft-app.pairmuse_analytics.events`
GROUP BY 1
ORDER BY error_rate DESC, total_events DESC;

-- 8. Top recent API errors
SELECT
  eventTimestamp,
  route,
  errorMessage,
  sessionId
FROM `matchcraft-app.pairmuse_analytics.events`
WHERE eventName = 'api_error'
ORDER BY eventTimestamp DESC
LIMIT 100;

-- 9. Upload to partner conversion rate
WITH upload_sessions AS (
  SELECT DISTINCT sessionId
  FROM `matchcraft-app.pairmuse_analytics.events`
  WHERE eventName = 'image_uploaded'
),
partner_sessions AS (
  SELECT DISTINCT sessionId
  FROM `matchcraft-app.pairmuse_analytics.events`
  WHERE eventName = 'partner_generated'
)
SELECT
  (SELECT COUNT(*) FROM upload_sessions) AS uploaded_sessions,
  (SELECT COUNT(*) FROM partner_sessions) AS partner_sessions,
  SAFE_DIVIDE((SELECT COUNT(*) FROM partner_sessions), (SELECT COUNT(*) FROM upload_sessions)) AS upload_to_partner_rate;

-- 10. Partner to couple conversion rate
WITH partner_sessions AS (
  SELECT DISTINCT sessionId
  FROM `matchcraft-app.pairmuse_analytics.events`
  WHERE eventName = 'partner_generated'
),
couple_sessions AS (
  SELECT DISTINCT sessionId
  FROM `matchcraft-app.pairmuse_analytics.events`
  WHERE eventName = 'couple_generated'
)
SELECT
  (SELECT COUNT(*) FROM partner_sessions) AS partner_sessions,
  (SELECT COUNT(*) FROM couple_sessions) AS couple_sessions,
  SAFE_DIVIDE((SELECT COUNT(*) FROM couple_sessions), (SELECT COUNT(*) FROM partner_sessions)) AS partner_to_couple_rate;
