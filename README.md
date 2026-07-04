# صالون بيوتي — نظام حجوزات خدمات منزلية

موقع حجوزات لصالون نسائي يقدّم خدمات منزلية في الرياض.  
**Next.js 14** · **TypeScript** · **Tailwind** · **Supabase** · **Moyasar**

---

## الميزات

- صفحة رئيسية + صفحة حجز كاملة (عربي RTL)
- حساب **الوقت المتاح** تلقائياً حسب الحجوزات السابقة + جدول المسافات بين المناطق
- رفع **صورة الباب** إلى Supabase Storage
- دفع إلكتروني عبر **Moyasar** (مدى / Apple Pay / فيزا)
- لوحة **إدارة الحجوزات** للصالون

---

## التشغيل المحلي

### 1. المتطلبات

- Node.js 18+
- حساب [Supabase](https://supabase.com)
- حساب [Moyasar](https://moyasar.com) (للدفع)

### 2. إعداد Supabase

1. أنشئ مشروعاً جديداً في Supabase.
2. من **SQL Editor** نفّذ الملف:
   ```
   supabase/schema.sql
   ```
3. من **Settings → API** انسخ:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (سري — للسيرفر فقط)

### 3. متغيرات البيئة

```bash
cp .env.example .env.local
```

عدّل القيم في `.env.local`.

### 4. التشغيل

```bash
cd salon-booking
npm install
npm run dev
```

افتح: [http://localhost:3000](http://localhost:3000)

---

## النشر على Vercel

1. ارفع المشروع إلى GitHub.
2. من [vercel.com](https://vercel.com) → **Import Project**.
3. **Root Directory**: `salon-booking` (إن كان داخل مجلد فرعي).
4. أضف كل متغيرات `.env.example` في **Settings → Environment Variables**.
5. **Deploy**.

> `SUPABASE_SERVICE_ROLE_KEY` و `MOYASAR_SECRET_KEY` لا تُعرض أبداً في المتصفح — تبقى في Vercel فقط.

---

## ربط Moyasar

1. سجّلي في [moyasar.com](https://moyasar.com) واحصلي على مفاتيح الاختبار/الإنتاج.
2. ضعي في `.env.local`:
   ```
   NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY=pk_test_...
   MOYASAR_SECRET_KEY=sk_test_...
   ```
3. في لوحة Moyasar، اضبطي **Callback URL**:
   ```
   https://your-domain.vercel.app/payment/callback
   ```

---

## هيكل المشروع

```
salon-booking/
├── app/
│   ├── page.tsx              # الرئيسية
│   ├── book/page.tsx         # الحجز
│   ├── admin/page.tsx        # الإدارة
│   ├── payment/callback/     # رجوع Moyasar
│   └── api/                  # API routes
├── components/
│   ├── BookingForm.tsx
│   ├── AdminTable.tsx
│   └── MoyasarPayment.tsx
├── lib/
│   ├── scheduling.ts         # محرك حساب الوقت ★
│   ├── travel-matrix.ts      # جدول المسافات
│   ├── moyasar.ts
│   └── supabase/
├── supabase/schema.sql       # الجداول + البذور
└── .env.example
```

---

## محرك الحساب (`lib/scheduling.ts`)

```
وقت انتهاء الحجز السابق = بداية + مجموع مدد الخدمات (× عدد الأشخاص)
الوقت المتاح = انتهاء آخر حجز + وقت الطريق (من travel-matrix.ts)
```

- `SEQUENTIAL_BY_PEOPLE = true` — أخصائية واحدة، الخدمة بالتسلسل.
- غيّريه إلى `false` عند إضافة أخصائيات متعددة.
- لاحقاً: استبدلي `travel-matrix.ts` بـ Google Maps Distance Matrix API.

---

## صفحة الإدارة

`/admin` — تعرض كل الحجوزات.  
إن ضبطتِ `ADMIN_PASSWORD` في البيئة، أرسليها في حقل كلمة المرور قبل تغيير الحالة.

---

## تعديل الخدمات والأسعار

من Supabase → **Table Editor** → `services`  
أو عدّلي `supabase/schema.sql` وأعدي تنفيذ البذور.

---

## تعديل جدول المسافات

عدّلي القيم في `lib/travel-matrix.ts` فقط.
