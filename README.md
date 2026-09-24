# Ladies Fitness

Sessions, plans and attendance for a ladies-only fitness group. This first version is the **organiser side**:
timetable, register, members, plans and payments. It runs on Next.js and Supabase.

## How it works

- Every payment is a **plan for one calendar month**: 1, 3 or 4 sessions a week (editable in Settings).
- Weeks run Monday to Sunday. A lady can come to any session, up to her weekly allowance.
- Her allowance is used when the organiser taps **Here**, never when she says she's coming.
  Missing a session for an appointment costs nothing, and she can make it up any day that same week.
  Unused sessions do not carry over to the next week.
- If a lady with no plan taps in, or has used her week, the register asks the organiser what to do:
  allow it, take cash, or pay later. "Pay later" is remembered and cleared when she next pays.
- Prices are copied onto each payment, so changing a price never rewrites what someone already paid.

## Set up

1. Create a project at supabase.com.
2. In the SQL editor, paste and run `supabase/schema.sql`.
3. In Authentication > Users, add the organiser (email and password). Then run this in the SQL editor,
   with her email:
   ```sql
   insert into staff (user_id, name, role)
   select id, 'Organiser', 'organiser' from auth.users where email = 'her@email.com';
   ```
   Use `'helper'` as the role for anyone who only helps at the door.
4. Copy `.env.example` to `.env.local` and fill in the Supabase URL and key (Project Settings > API).
5. `npm install`, then `npm run dev`, and open http://localhost:3000.
6. To go live, import the repo into Vercel and add the same three environment variables.

## First use

1. **Settings**: check the plans and prices, then add each weekly session (day and time).
2. **Sessions**: tap "Create the next 4 weeks".
3. **Members**: add the ladies with their WhatsApp numbers.
4. **Payments**: record who has paid for the month.
5. On the day, open the session and tap **Here** as each lady arrives.

UK numbers can start with 0. For any other country, enter the number with its code, like +94 77 123 4567,
so the Message buttons open the right WhatsApp chat.

## Not built yet

- The ladies' side: join link, "I'm coming / Can't make it", her plan and receipt upload.
- Share to group and automatic reminders.
- QR code check-in.

## Where things are

- `supabase/schema.sql`: tables, security rules and starting plans.
- `src/app/actions.ts`: everything that changes data.
- `src/lib/coverage.ts`: the plan and weekly allowance rules.
- `src/app/(app)/`: the screens (sessions, register, members, payments, settings).
