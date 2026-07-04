-- ============================================================
-- صالون منزلي — جداول Supabase
-- نفّذ هذا الملف من: Supabase Dashboard → SQL Editor
-- ============================================================

-- المناطق
CREATE TYPE region_type AS ENUM ('north', 'south', 'east', 'west');

-- حالة الحجز
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled');

-- حالة الدفع
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed');

-- ── الخدمات ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── الحجوزات ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT NOT NULL,
  location_url TEXT NOT NULL,
  region region_type NOT NULL,
  door_image_url TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  total_duration INTEGER NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  people_count INTEGER NOT NULL DEFAULT 1 CHECK (people_count >= 1),
  status booking_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  moyasar_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings (start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

-- ── ربط الحجز بالخدمات ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
  UNIQUE (booking_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_services_booking ON booking_services (booking_id);

-- ── بذور الخدمات ─────────────────────────────────────────────
-- احذف البذور القديمة عند إعادة التشغيل (اختياري)
TRUNCATE services CASCADE;
INSERT INTO services (name, price, duration_minutes) VALUES
  ('بديكير منيكير', 150, 60),
  ('بديكير', 90, 30),
  ('منيكير', 80, 30),
  ('لون عادي', 60, 20),
  ('لون أمبريه', 200, 30),
  ('مساج سويدي', 250, 60),
  ('مساج استرخاء', 250, 60);

-- ── Supabase Storage: bucket لصور الأبواب ───────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('door-images', 'door-images', true)
ON CONFLICT (id) DO NOTHING;

-- سياسات التخزين: رفع للجميع، قراءة للجميع
CREATE POLICY "door_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'door-images');

CREATE POLICY "door_images_anon_upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'door-images');

-- سياسات RLS للجداول (قراءة/كتابة عبر anon key للتطبيق)
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_read_all" ON services FOR SELECT USING (true);
CREATE POLICY "bookings_read_all" ON bookings FOR SELECT USING (true);
CREATE POLICY "bookings_insert" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "bookings_update" ON bookings FOR UPDATE USING (true);
CREATE POLICY "booking_services_read" ON booking_services FOR SELECT USING (true);
CREATE POLICY "booking_services_insert" ON booking_services FOR INSERT WITH CHECK (true);
