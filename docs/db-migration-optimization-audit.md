# Duomenų Bazės Migracijų Auditas ir SQL Optimizavimo Ataskaita (mini-social.online)

**Data:** 2026-08-22  
**Projektas:** `mini-social.online` (`/home/viktor/apps/mini-social`)  
**Audituotos migracijos:** `0000_auth_and_roles.sql` – `0015_grant_blocks_to_anonymous.sql` (16 esamų migracijų)  
**Rezultatas:** Validuota ir patvirtinta galutinė migracija `0016_performance_and_indexes.sql`

---

## 1. Santrauka (Executive Summary)

Atliktas išsamus, kodui ir realiai duomenų bazei (PostgreSQL 17.5) pritaikytas auditas pagal **SQL Optimization Patterns** metodiką.

### Diagnostikos Faktai:
* **`posts.status` pasiskirstymas:** `active` sudaro 100% visų įrašų. Dėl to atsisakyta kurti perteklinį dalinį indeksą `posts WHERE status = 'active'`, kuris dubliuotų esamą `posts_created_idx`.
* **PostGIS `ST_DWithin`:** Įrodyta per `EXPLAIN`, kad esamas `profiles_geo_idx (geometry)` negali aptarnauti `get_nearby_post_ids` funkcijos su `::geography` konversija. Sukurtas funkcinis išraiškos indeksas `gist(((location)::geography))`, kuris pakeičia `Seq Scan` į `GIST Index Scan`.
* **PostgREST subquery agregacijos:** Feed užklausose (`BASE_SELECT`, `REPOST_SELECT`) agreguojami skaičiai `reactions(count), comments(count), reposts(count)`. Lentelėms `likes` ir `reposts` pridėti `post_id` indeksai įgalina `Index Only Scan` ir `Bitmap Index Scan`.

---

## 2. Galutinė Indeksų Validacijos Lentelė (Validation Decisions)

| Indeksas | Sprendimas | Reali Užklausa / Failas | Esamas Padengimas | Laukiamas Poveikis | Write Kaštai | Saugus Metodas |
| :--- | :---: | :--- | :--- | :--- | :---: | :--- |
| `likes_post_idx ON public.likes(post_id)` | **KEEP** | `lib/feed-service.ts:14`, `0014_discovery.sql:40` (`count(likes)`), Post CASCADE delete | Tik `PK(user_id, post_id)` | **Index Only Scan** vietoje Seq Scan skaičiuojant postų patiktukus feed'e ir trending algoritme | Labai maži | `CREATE INDEX IF NOT EXISTS` in transaction |
| `reposts_post_idx ON public.reposts(post_id)` | **KEEP** | `lib/feed-service.ts:14, 38` (`reposts(count)` feed'e), Post CASCADE delete | Tik `PK(user_id, post_id)` | **Bitmap Index Scan** PostgREST subquery kiekvienam feed įrašui | Labai maži | `CREATE INDEX IF NOT EXISTS` in transaction |
| `bookmarks_post_idx ON public.bookmarks(post_id)` | **KEEP** | `posts` lentelės `ON DELETE CASCADE` | `PK(user_id, post_id)`, `bookmarks_user_idx` | Apsaugo nuo `bookmarks` lentelės pilno skenavimo ir lock'inimo trinant įrašą | Labai maži | `CREATE INDEX IF NOT EXISTS` in transaction |
| `post_media_post_idx ON public.post_media(post_id)` | **KEEP** | `lib/feed-service.ts:18`, `app/posts/[id]/page.tsx`, `0013_private_accounts.sql:194` (RLS) | Nėra (tik `PK(id)`) | **Index Scan** medijos failų krovimui feed'e ir RLS politikoje | Minimalūs | `CREATE INDEX IF NOT EXISTS` in transaction |
| `posts_user_created_idx ON public.posts(user_id, created_at DESC)` | **KEEP** | `app/u/[username]/page.tsx:196`, `lib/feed-service.ts:198` | Tik `posts_created_idx(created_at DESC)` | **Index Scan (user_id = $1)** profilio įrašams ir sekamų vartotojų srautui | Maži | `CREATE INDEX IF NOT EXISTS` in transaction |
| `pro_services_pro_idx ON public.pro_services(pro_id)` | **KEEP** | `components/pro/ServicesCatalog.tsx:44`, `0002_functions_and_rls.sql:365` (RLS) | Nėra (tik `PK(id)`) | Greitas paslaugų sąrašo krovimas meistrui ir RLS patikrai | Nereikšmingi | `CREATE INDEX IF NOT EXISTS` in transaction |
| `service_requests_client_created_idx ON public.service_requests(client_id, created_at DESC)` | **KEEP** | `app/my-orders/page.tsx:51` (`WHERE client_id = $1 ORDER BY created_at DESC`) | Nėra (tik `PK(id)`) | Tikslus WHERE + ORDER BY padengimas kliento užsakymų sąrašui | Maži | `CREATE INDEX IF NOT EXISTS` in transaction |
| `service_requests_pro_idx ON public.service_requests(pro_id) WHERE pro_id IS NOT NULL` | **KEEP** | `app/api/agent/run/route.ts:199`, `app/my-orders/page.tsx:51` | Nėra | Dalinis indeksas meistro priskirtų užsakymų paieškai | Maži | `CREATE INDEX IF NOT EXISTS` in transaction |
| `service_requests_open_unassigned_idx ON public.service_requests(created_at DESC) WHERE status = 'open' AND pro_id IS NULL` | **KEEP** | `components/pro/RequestBoard.tsx:39`, `0006_pro_matching_and_radius.sql` (RLS) | Nėra | Dalinis indeksas laisvų užsakymų lentos krovimui | Maži | `CREATE INDEX IF NOT EXISTS` in transaction |
| `orders_pro_created_idx ON public.orders(pro_id, created_at DESC)` | **KEEP** | `app/pro/dashboard/page.tsx:19` (`WHERE pro_id = $1 ORDER BY created_at DESC`) | Nėra (tik `PK(id)`) | Tikslus WHERE + ORDER BY padengimas meistro gautų užsakymų dashboard'ui | Maži | `CREATE INDEX IF NOT EXISTS` in transaction |
| `reports_status_created_idx ON public.reports(status, created_at DESC)` | **KEEP** | `app/admin/reports/page.tsx:43` (`WHERE status = $1 ORDER BY created_at DESC`) | Nėra (tik `PK(id)`) | Greitas moderavimo ataskaitų filtravimas admin pultelyje | Nereikšmingi | `CREATE INDEX IF NOT EXISTS` in transaction |
| `profiles_geo_geog_idx ON public.profiles USING gist(((location)::geography))` | **KEEP** | `0002_functions_and_rls.sql:91` (`get_nearby_post_ids`), `lib/feed-service.ts:181` | Tik `gist(location)` (geometry) | **GIST Index Scan** vietoje Seq Scan vykdant `ST_DWithin` su geography spinduliu | Minimalūs | `CREATE INDEX IF NOT EXISTS` in transaction |

---

### Pašalinti arba Atmesti Indeksai (REMOVE):
1. `post_media(user_id)`: Naudojamas tik vieną kartą paskyros trynimo metu.
2. `comments(user_id)`: Vartotojo komentarų sąrašo UI nėra; apsaugo nuo nereikalingo komentarų rašymo lėtėjimo.
3. `mutes(muted_id)`: Visos `mutes` užklausos turi `WHERE muter_id = $1`, ką pilnai dengia pirminis raktas `PK(muter_id, muted_id)`.
4. `follow_requests(requester_id, status)`: Pilnai padengia pirminis raktas `PK(requester_id, target_id)`.
5. `posts(created_at DESC) WHERE status = 'active'`: Dubliuoja esamą `posts_created_idx`.
6. `posts(quoted_post_id)`: Citatos kraunamos į priekį per `posts.id` PK.
7. `reports(target_type, target_id)`: Admin pultas filtruoja pagal statusą/datą.
8. `moderation_decisions(...)`: Jau sukurti `0009_ai_moderation.sql` migracijoje.
9. `orders(client_id, status)`: Nėra tokios užklausos kliento kode.
10. `service_requests_geo_geog_idx`: Kode nėra `ST_DWithin` užklausų ant šios lentelės.

---

## 3. Galutinė Validuota Migracija: `0016_performance_and_indexes.sql`

```sql
BEGIN;

-- 1. Socialinių sąveikų ir kaskadų išorinių raktų indeksai
CREATE INDEX IF NOT EXISTS likes_post_idx ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS reposts_post_idx ON public.reposts(post_id);
CREATE INDEX IF NOT EXISTS bookmarks_post_idx ON public.bookmarks(post_id);
CREATE INDEX IF NOT EXISTS post_media_post_idx ON public.post_media(post_id);

-- 2. Profilio ir naujienų srauto kompozitinis indeksas
CREATE INDEX IF NOT EXISTS posts_user_created_idx ON public.posts(user_id, created_at DESC);

-- 3. Meistrų, paslaugų ir užsakymų modulio indeksai
CREATE INDEX IF NOT EXISTS pro_services_pro_idx ON public.pro_services(pro_id);
CREATE INDEX IF NOT EXISTS service_requests_client_created_idx ON public.service_requests(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS service_requests_pro_idx ON public.service_requests(pro_id) WHERE pro_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS service_requests_open_unassigned_idx 
  ON public.service_requests(created_at DESC) 
  WHERE status = 'open' AND pro_id IS NULL;
CREATE INDEX IF NOT EXISTS orders_pro_created_idx ON public.orders(pro_id, created_at DESC);

-- 4. Moderavimo ataskaitų filtravimas
CREATE INDEX IF NOT EXISTS reports_status_created_idx ON public.reports(status, created_at DESC);

-- 5. PostGIS geografijos išraiškos indeksas (get_nearby_post_ids)
CREATE INDEX IF NOT EXISTS profiles_geo_geog_idx ON public.profiles USING gist(((location)::geography));

NOTIFY pgrst, 'reload schema';

COMMIT;
```
