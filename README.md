# Ladies Fitness

Sessions, plans and attendance for a ladies-only fitness group. It runs on Next.js and Supabase.

- **Organiser side:** timetable, register, members, plans and payments.
- **Ladies' side (in progress):** ask to join, personal login link, and their own page.

It is a PWA: open the link on a phone and add it to the home screen. It then opens full screen with its own icon, like an app. No app store is involved. It needs to be served over HTTPS, which Vercel does for you.

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
   **Already set up from an earlier version?** Run `supabase/migrations/002_member_access.sql` instead. It only adds what's new.
3. In Authentication > Users, add the organiser (email and password). Then run this in the SQL editor,
   with her email:
   ```sql
   insert into staff (user_id, name, role)
   select id, 'Organiser', 'organiser' from auth.users where email = 'her@email.com';
   ```
   Use `'helper'` as the role for anyone who only helps at the door.
4. Copy `.env.example` to `.env.local` and fill it in. The service role key (Project Settings > API) is secret:
   keep it on the server only, and never share it or put it in a `NEXT_PUBLIC_` variable.
5. `npm install`, then `npm run dev`, and open http://localhost:3000.
6. To go live, import the repo into Vercel and add the same environment variables.
   Set `NEXT_PUBLIC_SITE_URL` to the live address so the links sent on WhatsApp are right.

## First use

1. **Settings**: check the plans and prices, then add each weekly session (day and time).
2. **Sessions**: tap "Create the next 4 weeks".
3. **Members**: add the ladies with their WhatsApp numbers.
4. **Payments**: record who has paid for the month.
5. On the day, open the session and tap **Here** as each lady arrives.

UK numbers can start with 0. For any other country, enter the number with its code, like +94 77 123 4567,
so the Message buttons open the right WhatsApp chat.

## Bringing the ladies in

1. **Settings > Invite the ladies:** tap Share in WhatsApp and post the join link in the group.
   `JOIN_CODE` is added to that link so only people from the group can ask to join.
2. Each lady enters her name and WhatsApp number. Her request appears at the top of **Members**.
3. Tap **Approve**. The app makes her a personal link and opens WhatsApp with the message ready to send.
4. She taps the link once and is signed in on her phone. No password. She can then add it to her home screen.
   If she loses it, open her page under Members and send a new one. A new link stops the old one working.

On iPhone, the home-screen app doesn't share sign-in with Safari, so each lady's installed app reopens through her
personal link (`/m/...`). That is why she stays signed in.

## Not built yet

- "I'm coming / Can't make it" on her page.
- Paying and uploading a receipt, and the organiser confirming it.
- Share to group and reminders.
- QR code check-in.

## Where things are

- `supabase/schema.sql`: tables, security rules and starting plans.
- `src/app/actions.ts`: everything that changes data.
- `src/lib/coverage.ts`: the plan and weekly allowance rules.
- `src/app/(app)/`: the organiser screens (sessions, register, members, payments, settings).
- `src/app/join`, `src/app/m`, `src/app/me`: the ladies' side (join form, personal link, her page).
- `src/lib/supabase/admin.ts`: the full-access client. Used only for the ladies' side, and always limited to the lady signed in.
