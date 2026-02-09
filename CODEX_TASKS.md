# Mini-Social — Likusios užduotys Codex'ui

## Projekto info
- **Vieta**: `C:\Users\setov\OneDrive\Documents\gemini projekty\mini-social`
- **Tech stack**: Next.js 14, React 18, Supabase (Postgres + Auth + Storage + Realtime), Tailwind CSS, TypeScript
- **Deploy**: Vercel (https://mini-social-mvp.vercel.app)
- **DB**: Supabase PostgreSQL su RLS (Row Level Security)
- **Stilius**: rounded-2xl/3xl kortelės, blue-600 primary, dark: klasės (jau implementuotos)

## Kas jau padaryta ✅
1. ✅ Responsive design (mobile hamburger, touch targets, admin card layouts)
2. ✅ Light/Dark tema (ThemeProvider, ThemeToggle, dark: klasės visuose failuose)
3. ✅ Profile settings puslapis (/settings — avatar upload, username, bio, display name, password reset)
4. ✅ Postai su likes, comments, share, delete
5. ✅ Follow sistema
6. ✅ Privačios žinutės (realtime)
7. ✅ Diskusijų forumas
8. ✅ Admin panelė (dashboard, users, reports, content, audit-log)
9. ✅ Paieška (users + posts)
10. ✅ Autentifikacija (register, login, reset password)

## Likusios 6 užduotys 🔧

### UŽDUOTIS 1: Avatar Upload UI patobulinimas
**Prioritetas**: Aukštas
**Aprašymas**: Settings puslapyje avatar upload jau veikia, bet reikia užtikrinti kad avatariai rodosi VISUR aplikacijoje:
- PostCard komentaruose (dabar rodo tik pirmą raidę)
- Navbar'e (pridėti mažą avatar paveikslėlį vietoj "Profile" teksto)
- Messages sąraše ir chat bubble'uose
- Discussion replies
- Search rezultatuose
**Failai**:
- `components/PostCard.tsx` — komentarų avatariai
- `components/Navbar.tsx` — navbar avatar
- `components/MessageBubble.tsx`
- `app/messages/page.tsx`
- `app/discussions/[id]/page.tsx`
- `app/search/page.tsx`

### UŽDUOTIS 2: Live Notifikacijų sistema
**Prioritetas**: Aukštas
**Aprašymas**: Sukurti pilną notifikacijų sistemą su Supabase Realtime.

**DB migracija** (naujas SQL):
```sql
-- notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'new_post')),
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_id UUID, -- post_id, comment_id, etc.
  target_type TEXT CHECK (target_type IN ('post', 'comment', 'user')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users mark own as read" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

**Komponentai**:
- `components/NotificationBell.tsx` — varpelis navbar'e su unread count badge, dropdown su notifikacijų sąrašu
- `app/notifications/page.tsx` — pilnas notifikacijų puslapis
- Triggeriuoti notifikacijas kai: like'ina postą, komentuoja postą, pradeda sekti, followed user sukuria naują postą

**Integracija**:
- `components/PostCard.tsx` — handleLike ir handleComment turi insertuoti notification
- `components/ProfileActions.tsx` — follow turi insertuoti notification
- `components/Navbar.tsx` — pridėti NotificationBell šalia messages

### UŽDUOTIS 3: User Blocking/Muting
**Prioritetas**: Vidutinis
**Aprašymas**: Leisti vartotojams blokuoti kitus.

**DB migracija**:
```sql
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own blocks" ON blocks FOR ALL USING (auth.uid() = blocker_id);
CREATE POLICY "Users see if blocked" ON blocks FOR SELECT USING (auth.uid() = blocked_id);
```

**Komponentai**:
- Block mygtukas profilio puslapyje (`app/u/[username]/page.tsx`)
- Blocked users sąrašas settings puslapyje (`app/settings/page.tsx`)
- Filtruoti blocked vartotojų postus iš feed'o (`app/page.tsx`)
- Neleisti siųsti žinučių blocked vartotojams

### UŽDUOTIS 4: Discussion Pin/Lock UI
**Prioritetas**: Vidutinis
**Aprašymas**: DB jau turi `is_pinned` ir `is_locked` laukus `discussions` lentelėje. Reikia UI.

**Failai**:
- `app/discussions/[id]/page.tsx` — pridėti Pin/Lock mygtukus admin/mod vartotojams
- `components/DiscussionCard.tsx` — rodyti pin/lock ikonėles
- `app/discussions/[id]/page.tsx` — kai locked, nerodyti reply formos, rodyti "Discussion locked" pranešimą

### UŽDUOTIS 5: Hashtag/Mention sistema
**Prioritetas**: Žemas
**Aprašymas**: Parse #hashtag ir @mention postų ir komentarų tekste.

**Implementacija**:
- Utility funkcija `lib/parseContent.ts` — parse tekstą ir grąžinti React elementus su nuorodomis
- `#hashtag` → nuoroda į `/search?q=%23hashtag`
- `@username` → nuoroda į `/u/username`
- Naudoti `components/PostCard.tsx` ir komentaruose
- Auto-complete @mentions PostComposer'yje (optional)

### UŽDUOTIS 6: Feed algoritmas
**Prioritetas**: Žemas
**Aprašymas**: Protingesnis home feed su tabs.

**Implementacija** (`app/page.tsx`):
- 3 tabs: "For You" | "Following" | "Latest"
- **Latest**: dabartinis chronologinis feed (jau veikia)
- **Following**: tik postai iš vartotojų kuriuos seki
- **For You**: postai surikiuoti pagal populiarumą (likes + comments count) per pastarąsias 48h
- Client-side tab switching su URL params (?tab=following)

---

## Workflow tvarka
1. **Avatar Upload UI** (greitai, patobulinimas)
2. **Live Notifikacijos** (reikia DB migracijos + daug komponentų)
3. **User Blocking** (reikia DB migracijos + filtravimo)
4. **Discussion Pin/Lock** (greitai, UI only)
5. **Hashtag/Mention** (utility + UI)
6. **Feed algoritmas** (query + tabs)

## Svarbi info
- Supabase client (browser): `import { createClient } from '@/lib/supabase'`
- Supabase client (server): `import { createClient } from '@/lib/server-supabase'`
- Visos spalvos turi turėti `dark:` variantą (pvz. `bg-white dark:bg-gray-900`)
- Responsive: naudoti `sm:`, `md:`, `lg:` prefixus
- Touch targets: min 44px
- Ikonėlės: lucide-react
- Stilius: rounded-2xl kortelės, blue-600 primary, font-bold headings
