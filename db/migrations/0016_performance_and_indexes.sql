BEGIN;

-- ============================================================================
-- 1. SOCIALINIŲ SĄVEIKŲ IR KASKADŲ IŠORINIŲ RAKTŲ INDEKSAI
-- ============================================================================
-- Optimizuoja PostgREST count agregacijas feed'e ir saugo nuo ON DELETE CASCADE užraktų
CREATE INDEX IF NOT EXISTS likes_post_idx ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS reposts_post_idx ON public.reposts(post_id);
CREATE INDEX IF NOT EXISTS bookmarks_post_idx ON public.bookmarks(post_id);
CREATE INDEX IF NOT EXISTS post_media_post_idx ON public.post_media(post_id);

-- ============================================================================
-- 2. PROFILIO IR NAUJIENŲ SRAUTO KOMPOZITINIS INDEKSAS
-- ============================================================================
-- Optimizuoja /u/[username] profilio įrašų sąrašą ir following feed'ą
CREATE INDEX IF NOT EXISTS posts_user_created_idx ON public.posts(user_id, created_at DESC);

-- ============================================================================
-- 3. MEISTRŲ, PASLAUGŲ IR UŽSAKYMŲ MODULIO INDEKSAI
-- ============================================================================
-- Meistro paslaugų katalogui (/pro) ir RLS patikrai
CREATE INDEX IF NOT EXISTS pro_services_pro_idx ON public.pro_services(pro_id);

-- Kliento užsakymų sąrašui (/my-orders)
CREATE INDEX IF NOT EXISTS service_requests_client_created_idx ON public.service_requests(client_id, created_at DESC);

-- Meistrui priskirtų užklausų paieškai ir automatiniam agentui
CREATE INDEX IF NOT EXISTS service_requests_pro_idx ON public.service_requests(pro_id) WHERE pro_id IS NOT NULL;

-- Dalinis indeksas laisvų užsakymų lentai (/pro RequestBoard) ir atvirų užsakymų RLS
CREATE INDEX IF NOT EXISTS service_requests_open_unassigned_idx 
  ON public.service_requests(created_at DESC) 
  WHERE status = 'open' AND pro_id IS NULL;

-- Meistro užsakymų valdymo pultui (/pro/dashboard)
CREATE INDEX IF NOT EXISTS orders_pro_created_idx ON public.orders(pro_id, created_at DESC);

-- ============================================================================
-- 4. MODERAVIMO ATASKAITŲ FILTRAVIMAS
-- ============================================================================
-- Admin ataskaitų sąrašo filtravimui ir rūšiavimui (/admin/reports)
CREATE INDEX IF NOT EXISTS reports_status_created_idx ON public.reports(status, created_at DESC);

-- ============================================================================
-- 5. POSTGIS GEOGRAFIJOS IŠRAIŠKOS INDEKSAS (get_nearby_post_ids)
-- ============================================================================
-- Įgalina GIST Index Scan funkcijai ST_DWithin(author.location::geography, ...)
CREATE INDEX IF NOT EXISTS profiles_geo_geog_idx ON public.profiles USING gist(((location)::geography));

NOTIFY pgrst, 'reload schema';

COMMIT;
