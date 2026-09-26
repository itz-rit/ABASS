-- ============================================================
-- ABASS (Abhath Bhanthavan Ayyappa Seva Sangham)
-- Complete Supabase Schema, RLS Policies, Storage, and Seed Data
-- ============================================================

-- 1. Enable required extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- 2. CREATE TABLES
-- ============================================================

-- A. ADMIN USERS TABLE (Authorization)
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- B. EVENTS TABLE
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_en text not null,
  title_ta text not null,
  description_en text,
  description_ta text,
  start_date date,
  end_date date,
  date_display_en text,
  date_display_ta text,
  location_en text,
  location_ta text,
  is_recurring boolean not null default false,
  recurrence_rule text,
  published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- C. GALLERY ITEMS TABLE
create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_ta text not null,
  description_en text,
  description_ta text,
  category text not null,
  badge_en text,
  badge_ta text,
  image_path text,
  image_url text not null,
  published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- D. MEMBERS (TRUSTEES & COMMITTEE) TABLE
create table if not exists public.members (
  id text primary key,
  name_en text not null,
  name_ta text,
  role_en text not null,
  role_ta text,
  group_type text not null check (group_type in ('apex', 'present')),
  initials text not null,
  featured boolean not null default false,
  active boolean not null default true,
  display_order integer not null default 0,
  family_members text,
  gothram text,
  nakshatram_star text,
  rasi text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. HELPER FUNCTION & ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Function to check if the authenticated user is an authorized admin
-- (security definer avoids recursive RLS lookups)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

-- Enable RLS on all tables
alter table public.admin_users enable row level security;
alter table public.events enable row level security;
alter table public.gallery_items enable row level security;
alter table public.members enable row level security;

-- Admin Users Policies
drop policy if exists "Admin users can view admins" on public.admin_users;
create policy "Admin users can view admins"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Only superadmin can manage admin_users" on public.admin_users;
create policy "Only superadmin can manage admin_users"
  on public.admin_users for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Events Policies
drop policy if exists "Public can view published events" on public.events;
create policy "Public can view published events"
  on public.events for select
  to anon, authenticated
  using (published = true or public.is_admin());

drop policy if exists "Admins can manage events" on public.events;
create policy "Admins can manage events"
  on public.events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Gallery Policies
drop policy if exists "Public can view published gallery" on public.gallery_items;
create policy "Public can view published gallery"
  on public.gallery_items for select
  to anon, authenticated
  using (published = true or public.is_admin());

drop policy if exists "Admins can manage gallery" on public.gallery_items;
create policy "Admins can manage gallery"
  on public.gallery_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Members Policies
drop policy if exists "Public can view active members" on public.members;
create policy "Public can view active members"
  on public.members for select
  to anon, authenticated
  using (active = true or public.is_admin());

drop policy if exists "Admins can manage members" on public.members;
create policy "Admins can manage members"
  on public.members for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 4. STORAGE BUCKET: gallery
-- ============================================================
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do update set public = true;

-- Storage policies
drop policy if exists "Public can read gallery bucket" on storage.objects;
create policy "Public can read gallery bucket"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'gallery');

drop policy if exists "Admins can upload to gallery bucket" on storage.objects;
create policy "Admins can upload to gallery bucket"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'gallery' and public.is_admin());

drop policy if exists "Admins can update gallery bucket" on storage.objects;
create policy "Admins can update gallery bucket"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'gallery' and public.is_admin());

drop policy if exists "Admins can delete from gallery bucket" on storage.objects;
create policy "Admins can delete from gallery bucket"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'gallery' and public.is_admin());

-- ============================================================
-- 5. SEED DATA MIGRATION
-- ============================================================

-- Seed Events (4 existing events)
insert into public.events (slug, title_en, title_ta, description_en, description_ta, start_date, end_date, date_display_en, date_display_ta, location_en, location_ta, is_recurring, recurrence_rule, published, display_order)
values ('annadhaanam', 'Monthly Annadhaanam', 'மாதாந்திர அன்னதானம்', 'Free meal offering for a minimum of 250 persons, held every Second Saturday of the month.', 'ஒவ்வொரு மாத இரண்டாவது சனிக்கிழமையும் குறைந்தது 250 பேருக்கு இலவச அன்னதானம்.', NULL, NULL, 'Every 2nd Saturday', 'ஒவ்வொரு மாத 2வது சனி', 'Pallavaram, Chennai', 'பல்லாவரம், சென்னை', true, 'Every 2nd Saturday', true, 1)
on conflict (slug) do update set
  title_en = excluded.title_en,
  title_ta = excluded.title_ta,
  description_en = excluded.description_en,
  description_ta = excluded.description_ta,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  date_display_en = excluded.date_display_en,
  date_display_ta = excluded.date_display_ta,
  location_en = excluded.location_en,
  location_ta = excluded.location_ta,
  is_recurring = excluded.is_recurring,
  recurrence_rule = excluded.recurrence_rule,
  published = excluded.published,
  display_order = excluded.display_order;

insert into public.events (slug, title_en, title_ta, description_en, description_ta, start_date, end_date, date_display_en, date_display_ta, location_en, location_ta, is_recurring, recurrence_rule, published, display_order)
values ('kumbabhishekam', 'Pallavaram Bharathi Nagar Pillayar Koil Kumbabhishekam Annadhaanam', 'பல்லாவரம் பாரதி நகர் பிள்ளையார் கோவில் கும்பாபிஷேகம் அன்னதானம்', 'Annadhaanam in connection with the Kumbabhishekam at Bharathi Nagar Pillayar Koil, Pallavaram, from 27th to 30th October 2026.', '27 முதல் 30 அக்டோபர் 2026 வரை பல்லாவரம் பாரதி நகர் பிள்ளையார் கோவில் கும்பாபிஷேகத்தின் போது அன்னதானம்.', '2026-10-27', '2026-10-30', '27–30 Oct 2026', '27–30 அக் 2026', 'Bharathi Nagar Pillayar Koil, Pallavaram, Chennai', 'பாரதி நகர் பிள்ளையார் கோவில், பல்லாவரம், சென்னை', false, NULL, true, 2)
on conflict (slug) do update set
  title_en = excluded.title_en,
  title_ta = excluded.title_ta,
  description_en = excluded.description_en,
  description_ta = excluded.description_ta,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  date_display_en = excluded.date_display_en,
  date_display_ta = excluded.date_display_ta,
  location_en = excluded.location_en,
  location_ta = excluded.location_ta,
  is_recurring = excluded.is_recurring,
  recurrence_rule = excluded.recurrence_rule,
  published = excluded.published,
  display_order = excluded.display_order;

insert into public.events (slug, title_en, title_ta, description_en, description_ta, start_date, end_date, date_display_en, date_display_ta, location_en, location_ta, is_recurring, recurrence_rule, published, display_order)
values ('padi', 'Yearly Padi Pooja', 'ஆண்டு படி பூஜை', 'Annual 18 Padi Pooja observed on 12th December 2026.', '12 டிசம்பர் 2026 அன்று ஆண்டு 18 படி பூஜை நடைபெறும்.', '2026-12-12', '2026-12-12', '12 Dec 2026', '12 டிச 2026', 'Zamin Pallavaram, Chennai', 'ஜமீன் பல்லாவரம், சென்னை', false, NULL, true, 3)
on conflict (slug) do update set
  title_en = excluded.title_en,
  title_ta = excluded.title_ta,
  description_en = excluded.description_en,
  description_ta = excluded.description_ta,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  date_display_en = excluded.date_display_en,
  date_display_ta = excluded.date_display_ta,
  location_en = excluded.location_en,
  location_ta = excluded.location_ta,
  is_recurring = excluded.is_recurring,
  recurrence_rule = excluded.recurrence_rule,
  published = excluded.published,
  display_order = excluded.display_order;

insert into public.events (slug, title_en, title_ta, description_en, description_ta, start_date, end_date, date_display_en, date_display_ta, location_en, location_ta, is_recurring, recurrence_rule, published, display_order)
values ('vilakku', 'Yearly Vilakku Pooja', 'ஆண்டு விளக்கு பூஜை', 'Annual Thiru Vilakku Pooja observed on 19th December 2026.', '19 டிசம்பர் 2026 அன்று ஆண்டு திருவிளக்கு பூஜை நடைபெறும்.', '2026-12-19', '2026-12-19', '19 Dec 2026', '19 டிச 2026', 'Zamin Pallavaram, Chennai', 'ஜமீன் பல்லாவரம், சென்னை', false, NULL, true, 4)
on conflict (slug) do update set
  title_en = excluded.title_en,
  title_ta = excluded.title_ta,
  description_en = excluded.description_en,
  description_ta = excluded.description_ta,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  date_display_en = excluded.date_display_en,
  date_display_ta = excluded.date_display_ta,
  location_en = excluded.location_en,
  location_ta = excluded.location_ta,
  is_recurring = excluded.is_recurring,
  recurrence_rule = excluded.recurrence_rule,
  published = excluded.published,
  display_order = excluded.display_order;

-- Seed Gallery Items (16 existing photos)
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Grand 18 Padi Altar & Deepam Row', 'புனித 18 படிகள் பீடம் & தீப வரிசை', 'Sacred 18 Padi Pooja altar adorned with glowing brass deepams, flowers and revered Guruswamys in prayer.', 'ஒளிரும் பித்தளை தீபங்கள், மலர்கள் மற்றும் பிரார்த்தனையில் இருக்கும் குருசுவாமிகளால் அலங்கரிக்கப்பட்ட புனித 18 படி பூஜை பீடம்.', 'padi-pooja', '18 Padi Pooja', '18 படி பூஜை', NULL, 'assets/images/gallery-1.jpg', true, 1);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Sri Dharma Sastha Sanctum Sanctorum', 'ஸ்ரீ தர்ம சாஸ்தா கருவறை & 18 படிகள்', 'Majestic view of Sri Ayyappa Swami sanctum with 18 golden sacred steps and ornate floral decoration.', '18 பொற்படிகள் மற்றும் அலங்கரிக்கப்பட்ட மலர் அலங்காரத்துடன் கூடிய ஸ்ரீ ஐயப்ப சுவாமி கருவறையின் கம்பீரமான காட்சி.', 'padi-pooja', '18 Padi Pooja', '18 படி பூஜை', NULL, 'assets/images/gallery-2.jpg', true, 2);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Traditional Thiru Vilakku Pooja', 'மங்களகரமான திருவிளக்கு பூஜை', 'Women devotees participating in sacred Vilakku Pooja with lighted lamps, chanting Lalitha Sahasranamam.', 'லலிதா சஹஸ்ரநாமம் பாராயணம் செய்து நெய் தீபங்கள் ஏற்றி விளக்கு பூஜையில் பங்கேற்கும் பெண் பக்தர்கள்.', 'vilakku-pooja', 'Thiru Vilakku Pooja', 'திருவிளக்கு பூஜை', NULL, 'assets/images/gallery-3.jpg', true, 3);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Devotees in Sannidhanam Prayer', 'சன்னிதானத்தில் பக்தி பரவசம்', 'Ayyappa devotees gathered inside the mandapam with deep devotion during special Pooja chants.', 'சிறப்பு பூஜை மந்திரங்களின் போது ஆழ்ந்த பக்தியுடன் மண்டபத்தில் கூடியுள்ள ஐயப்ப பக்தர்கள்.', 'utsavam', 'Mandala Pooja & Utsavam', 'மண்டல பூஜை & உற்சவம்', NULL, 'assets/images/gallery-4.jpg', true, 4);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Grand Utsavam Moorthi Alankaram', 'உற்சவ மூர்த்தி மகா அலங்காரம்', 'Divine darshan of Lord Ayyappa decorated with fragrant jasmine, marigold and sacred jewels.', 'மல்லிகை, செவ்வந்தி மற்றும் ஆபரணங்களால் அலங்கரிக்கப்பட்ட ஐயப்ப சுவாமியின் அற்புத தரிசனம்.', 'utsavam', 'Mandala Pooja & Utsavam', 'மண்டல பூஜை & உற்சவம்', NULL, 'assets/images/gallery-5.jpg', true, 5);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Sacred 18 Steps Floral Radiance', '18 படிகள் மலர் அலங்கார ஒளி', 'Detailed view of the 18 steps adorned with rose petals, marigolds and lighted coconut lamps.', 'ரோஜா இதழ்கள், சாமந்தி மற்றும் ஏற்றிய தேங்காய் நெய் தீபங்களால் அலங்கரிக்கப்பட்ட 18 படிகள்.', 'padi-pooja', '18 Padi Pooja', '18 படி பூஜை', NULL, 'assets/images/gallery-6.jpg', true, 6);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Bhajan & Namasankeerthanam', 'பஜனை & நாமசங்கீர்த்தனம்', 'Soulful devotional singing by Guruswamys and devotees with traditional cymbals and percussion.', 'பாரம்பரிய தாள வாத்தியங்களுடன் குருசுவாமிகள் மற்றும் பக்தர்களின் பக்தி பரவச நாமசங்கீர்த்தனம்.', 'utsavam', 'Mandala Pooja & Utsavam', 'மண்டல பூஜை & உற்சவம்', NULL, 'assets/images/gallery-7.jpg', true, 7);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Utsavam Procession & Darshan', 'உற்சவ ஊர்வலம் & தரிசனம்', 'Majestic procession darshan of Lord Ayyappa with silver kavacham and royal umbrella.', 'வெள்ளி கவசம் மற்றும் ராஜ குடையுடன் ஐயப்ப சுவாமியின் ஊர்வல தரிசனம்.', 'utsavam', 'Mandala Pooja & Utsavam', 'மண்டல பூஜை & உற்சவம்', NULL, 'assets/images/gallery-8.jpg', true, 8);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Pushpanjali & Deeparadhana', 'புஷ்பாஞ்சலி & தீபாராதனை', 'Sacred floral offerings and camphor Aarti offered to Lord Ayyappa during Mahapooja.', 'மகாபூஜையின் போது ஐயப்ப சுவாமிக்கு அர்ப்பணிக்கப்படும் மலர் புஷ்பாஞ்சலி மற்றும் கற்பூர ஆரத்தி.', 'padi-pooja', '18 Padi Pooja', '18 படி பூஜை', NULL, 'assets/images/gallery-9.jpg', true, 9);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Annadhaanam & Seva Gathering', 'அன்னதானம் & சேவை ஒன்றுகூடல்', 'Trust members and volunteers coordinating food distribution and seva arrangements.', 'உணவு வழங்கல் மற்றும் சேவை ஏற்பாடுகளை ஒருங்கிணைக்கும் அறக்கட்டளை உறுப்பினர்கள் மற்றும் தொண்டர்கள்.', 'annadhaanam', 'Annadhaanam', 'அன்னதானம்', NULL, 'assets/images/gallery-10.jpg', true, 10);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Maha Abhishekam Darshan', 'மகா அபிஷேக தரிசனம்', 'Holy abhishekam with milk, sandal paste, honey, vibhuti and sacred theertham.', 'பால், சந்தனம், தேன், விபூதி மற்றும் புனித தீர்த்தத்துடன் கூடிய புனித அபிஷேகம்.', 'abhishekam', 'Maha Abhishekam', 'மகா அபிஷேகம்', NULL, 'assets/images/gallery-11.jpg', true, 11);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Thulasi & Vana Mala Alankaram', 'துளசி & வனமாலை அலங்காரம்', 'Intricate close-up darshan of Lord Ayyappa draped in sacred Thulasi, Lotus and Bilva garlands.', 'புனித துளசி, தாமரை மற்றும் வில்வ மாலைகளால் அலங்கரிக்கப்பட்ட சுவாமியின் திவ்ய தரிசனம்.', 'utsavam', 'Mandala Pooja & Utsavam', 'மண்டல பூஜை & உற்சவம்', NULL, 'assets/images/gallery-12.jpg', true, 12);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Community Devotional Singing', 'கூட்டு பக்தி பாடல் வழிபாடு', 'Congregation of Swamis and families participating in Harivarasanam and Mangala Aarti.', 'ஹரிவராசனம் மற்றும் மங்கள ஆரத்தியில் பங்கேற்கும் சுவாமிகள் மற்றும் குடும்பத்தினர்.', 'utsavam', 'Mandala Pooja & Utsavam', 'மண்டல பூஜை & உற்சவம்', NULL, 'assets/images/gallery-13.jpg', true, 13);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Seva Planning & Community Meet', 'சேவை திட்டமிடல் & பொதுக்குழு', 'Trustees and community volunteers coordinating pilgrimage assistance and welfare drives.', 'யாத்திரை உதவி மற்றும் நலத்திட்டங்களை ஒருங்கிணைக்கும் அறங்காவலர்கள் மற்றும் தொண்டர்கள்.', 'padi-pooja', '18 Padi Pooja', '18 படி பூஜை', NULL, 'assets/images/gallery-14.jpg', true, 14);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Annual Padi & Vilakku Pooja Notice', 'ஆண்டு படி பூஜை & விளக்கு பூஜை அறிவிப்பு', 'Official ABASS Trust invitation poster detailing the programme schedule, Guruswamy honors and Annadhaanam.', 'நிகழ்ச்சி நிரல், குருசுவாமி கௌரவிப்பு மற்றும் அன்னதானம் குறித்த அதிகாரப்பூர்வ ABASS அழைப்பிதழ்.', 'padi-pooja vilakku-pooja', 'Padi & Vilakku Pooja', 'படி & விளக்கு பூஜை', NULL, 'assets/images/gallery-15.jpg', true, 15);
insert into public.gallery_items (title_en, title_ta, description_en, description_ta, category, badge_en, badge_ta, image_path, image_url, published, display_order)
values ('Grand Congregation & Prasadam', 'மகா சங்கமம் & பிரசாதம் வழங்குதல்', 'Hundreds of devotees receiving sacred prasadam and Annadhaanam after completion of Mahapooja.', 'மகாபூஜை நிறைவடைந்த பின் புனித பிரசாதம் மற்றும் அன்னதானம் பெறும் நூற்றுக்கணக்கான பக்தர்கள்.', 'annadhaanam', 'Annadhaanam', 'அன்னதானம்', NULL, 'assets/images/gallery-16.jpg', true, 16);

-- Seed Members (54 existing trustees & committee members)
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-s-chandrasekaran', 'Shri S Chandrasekaran', NULL, 'Founder and President / Life Member', NULL, 'apex', 'SC', true, true, 1)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-p-dharmaraj', 'Shri P Dharmaraj', NULL, 'Vice President / Life Member', NULL, 'apex', 'PD', true, true, 2)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-k-jayaramakrishnan', 'Shri K Jayaramakrishnan', NULL, 'Secretary / Life Member', NULL, 'apex', 'KJ', true, true, 3)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-c-v-manikandan', 'Shri C V Manikandan', NULL, 'Joint Secretary / Life Member', NULL, 'apex', 'CV', true, true, 4)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-t-l-arun-prasath', 'Shri T L Arun Prasath', NULL, 'Treasurer / Life Member', NULL, 'apex', 'TL', true, true, 5)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-late-v-h-shankaran', 'Shri (Late) V H Shankaran', NULL, 'Emeritus Member', NULL, 'apex', 'VH', false, true, 6)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-c-g-vasanthakumar', 'Shri C G Vasanthakumar', NULL, 'Life Member', NULL, 'apex', 'CG', false, true, 7)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-k-jayamohan', 'Shri K Jayamohan', NULL, 'Life Member', NULL, 'apex', 'KJ', false, true, 8)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-k-jayakumar', 'Shri K Jayakumar', NULL, 'Legal Advisor / Life Member', NULL, 'apex', 'KJ', false, true, 9)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-a-srinivasan', 'Shri A Srinivasan', NULL, 'Electoral Member / Life Member', NULL, 'apex', 'AS', false, true, 10)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-t-l-hariharan', 'Shri T L Hariharan', NULL, 'Life Member', NULL, 'apex', 'TL', false, true, 11)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-j-harihara-prasad', 'Shri J Harihara Prasad', NULL, 'Life Member', NULL, 'apex', 'JH', false, true, 12)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-muralidharan', 'Shri Muralidharan', NULL, 'Life Member', NULL, 'apex', 'M', false, true, 13)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-p-radhakrishnan', 'Shri P Radhakrishnan', NULL, 'Life Member', NULL, 'apex', 'PR', false, true, 14)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-manikandan-sathya', 'Shri Manikandan (Sathya)', NULL, 'Life Member', NULL, 'apex', 'MS', false, true, 15)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-e-ganesh-kumar', 'Shri E Ganesh Kumar', NULL, 'Life Member', NULL, 'apex', 'EG', false, true, 16)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-t-g-narayanaswamy', 'Shri T G Narayanaswamy', NULL, 'Life Member', NULL, 'apex', 'TG', false, true, 17)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-r-arunkumar', 'Shri R Arunkumar', NULL, 'Life Member', NULL, 'apex', 'RA', false, true, 18)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-s-rajesh', 'Shri S Rajesh', NULL, 'Life Member', NULL, 'apex', 'SR', false, true, 19)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-sivasakthi', 'Shri Sivasakthi', NULL, 'Member', NULL, 'present', 'S', false, true, 20)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-murugan-mestri', 'Shri Murugan (Mestri)', NULL, 'Member', NULL, 'present', 'MM', false, true, 21)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-j-rahul', 'Shri J Rahul', NULL, 'Member', NULL, 'present', 'JR', false, true, 22)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-sreekumar', 'Shri Sreekumar', NULL, 'Member', NULL, 'present', 'S', false, true, 23)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-e-baskaran', 'Shri E Baskaran', NULL, 'Member', NULL, 'present', 'EB', false, true, 24)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-hemanth-c-sekar', 'Shri Hemanth C Sekar', NULL, 'Member', NULL, 'present', 'HC', false, true, 25)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-sumanth-c-sekar', 'Shri Sumanth C Sekar', NULL, 'Member', NULL, 'present', 'SC', false, true, 26)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-murali', 'Shri Murali', NULL, 'Member', NULL, 'present', 'M', false, true, 27)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-srinath', 'Shri Srinath', NULL, 'Member', NULL, 'present', 'S', false, true, 28)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-subramani', 'Shri Subramani', NULL, 'Member', NULL, 'present', 'S', false, true, 29)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-elangovan', 'Shri Elangovan', NULL, 'Member', NULL, 'present', 'E', false, true, 30)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-s-vadivel', 'Shri S Vadivel', NULL, 'Member', NULL, 'present', 'SV', false, true, 31)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-srinivasan', 'Shri Srinivasan', NULL, 'Member', NULL, 'present', 'S', false, true, 32)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-senthil-kumar', 'Shri Senthil kumar', NULL, 'Member', NULL, 'present', 'SK', false, true, 33)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-ramesh-krishna-store', 'Shri Ramesh (Krishna store)', NULL, 'Member', NULL, 'present', 'RK', false, true, 34)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-rameshkumar', 'Shri Rameshkumar', NULL, 'Member', NULL, 'present', 'R', false, true, 35)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-nithiyanandam', 'Shri Nithiyanandam', NULL, 'Member', NULL, 'present', 'N', false, true, 36)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-c-r-balaji', 'Shri C R Balaji', NULL, 'Member', NULL, 'present', 'CR', false, true, 37)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-venkadesh', 'Shri Venkadesh', NULL, 'Member', NULL, 'present', 'V', false, true, 38)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-arun', 'Shri Arun', NULL, 'Member', NULL, 'present', 'A', false, true, 39)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-t-prakashkumar', 'Shri T Prakashkumar', NULL, 'Member', NULL, 'present', 'TP', false, true, 40)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-g-suresh-kumar', 'Shri G Suresh Kumar', NULL, 'Member', NULL, 'present', 'GS', false, true, 41)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-l-venkatensan', 'Shri L Venkatensan', NULL, 'Member', NULL, 'present', 'LV', false, true, 42)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-m-ganesan', 'Shri M Ganesan', NULL, 'Member', NULL, 'present', 'MG', false, true, 43)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-k-r-narayanan', 'Shri K R Narayanan', NULL, 'Member', NULL, 'present', 'KR', false, true, 44)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-punithavel', 'Shri Punithavel', NULL, 'Member', NULL, 'present', 'P', false, true, 45)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-satiyaseelan', 'Shri Satiyaseelan', NULL, 'Member', NULL, 'present', 'S', false, true, 46)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-mohanakrishnan', 'Shri Mohanakrishnan', NULL, 'Member', NULL, 'present', 'M', false, true, 47)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-c-vijaykumar', 'Shri C Vijaykumar', NULL, 'Member', NULL, 'present', 'CV', false, true, 48)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-padmini', 'Shri Padmini', NULL, 'Member', NULL, 'present', 'P', false, true, 49)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-praveen-kumar', 'Shri Praveen Kumar', NULL, 'Member', NULL, 'present', 'PK', false, true, 50)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-mahindran', 'Shri Mahindran', NULL, 'Member', NULL, 'present', 'M', false, true, 51)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-a-r-sharavanan', 'Shri A R.Sharavanan', NULL, 'Member', NULL, 'present', 'AR', false, true, 52)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-sharath', 'Shri Sharath', NULL, 'Member', NULL, 'present', 'S', false, true, 53)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;
insert into public.members (id, name_en, name_ta, role_en, role_ta, group_type, initials, featured, active, display_order)
values ('shri-parthasarathy-bobby', 'Shri Parthasarathy (Bobby)', NULL, 'Member', NULL, 'present', 'PB', false, true, 54)
on conflict (id) do update set
  name_en = excluded.name_en,
  role_en = excluded.role_en,
  group_type = excluded.group_type,
  initials = excluded.initials,
  featured = excluded.featured,
  active = excluded.active,
  display_order = excluded.display_order;

-- ============================================================
-- 6. HOW TO REGISTER FIRST ADMIN USER:
-- After creating a user in Supabase Authentication (Dashboard -> Authentication -> Add User),
-- run the following query with their user UID:
--
-- INSERT INTO public.admin_users (user_id, email)
-- VALUES ('<YOUR_USER_UUID>', 'admin@abasspvm.com')
-- ON CONFLICT (user_id) DO NOTHING;
-- ============================================================
