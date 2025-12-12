# Frontend - פתיחת שער חניה

Frontend ב-Next.js (App Router) + TypeScript עבור אפליקציית פתיחת שער חניה בעברית מלאה ו-RTL.

## התקנה והרצה

```bash
npm install
npm run dev
```

האפליקציה תרוץ על `http://localhost:3000`

## מבנה הפרויקט

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout עם RTL, AuthProvider, Toaster
│   ├── page.tsx           # דף ראשי - פתיחת שער
│   ├── login/             # דף התחברות
│   ├── register/          # דף הרשמה
│   ├── pending/           # מסך המתנה לאישור
│   └── admin/             # מסך אדמין - לוגים
├── lib/
│   ├── api.ts             # Fetch wrapper עם Authorization header
│   └── auth.ts            # ניהול token ו-deviceId
├── context/
│   └── AuthContext.tsx    # Context לניהול authentication
├── components/
│   └── RequireAuth.tsx    # Guard component לדפים מוגנים
└── types/
    └── auth.ts            # TypeScript types

```

## תכונות

- **Mobile-first**: עיצוב מותאם למובייל עם כפתורים גדולים
- **RTL**: תמיכה מלאה בעברית וכיוון RTL
- **Authentication**: ניהול session עם JWT tokens
- **Device ID**: מזהה מכשיר ייחודי ב-localStorage
- **Toast Notifications**: הודעות הצלחה/שגיאה עם react-hot-toast
- **Admin Panel**: מסך ניהול לוגים למנהלים

## API Endpoints

האפליקציה מתחברת ל-Backend API על `http://localhost:3001/api`:

- `POST /auth/register` - הרשמה
- `POST /auth/login` - התחברות
- `POST /auth/logout` - התנתקות
- `GET /auth/me` - פרטי משתמש נוכחי
- `POST /gate/open` - פתיחת שער (דורש JWT + approved)
- `GET /gate/logs?limit=100` - לוגים (רק אדמין)

## Flow

1. משתמש חדש → `/register` → ממתין לאישור → `/pending`
2. משתמש מאושר → `/login` → `/` (דף ראשי)
3. משתמש לא מאושר → `/login` → `/pending`
4. אדמין → `/login` → `/` או `/admin`

## בדיקות ידניות

1. **הרשמה**: גש ל-`/register`, הירשם, בדוק שהודעת הצלחה מופיעה
2. **התחברות**: גש ל-`/login`, התחבר עם משתמש מאושר
3. **פתיחת שער**: לחץ על כפתור "פתח שער" בדף הראשי
4. **התנתקות**: לחץ על "התנתק" ובדוק שה-redirect ל-`/login`
5. **לוגים אדמין**: התחבר כמנהל וגש ל-`/admin` לבדיקת הלוגים

## טכנולוגיות

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- react-hot-toast
- uuid
