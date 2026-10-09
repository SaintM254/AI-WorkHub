> **Email update:** [EMAIL_SETUP.md](EMAIL_SETUP.md) covers the second student login option and shared mail-provider configuration. The admin letter form now defaults to emailing immediately after the PDF is saved; uncheck its automatic-email option to inspect the PDF first.

# Activate admissions, administrator access and admission-letter email

The code is implemented, but **GitHub deployment does not update your Supabase database or install the email function**. Complete these steps before accepting submissions through the updated portal. Do not supply passwords or API secrets in chat.

## What changed

- Correct paid/balance calculations, database-backed progress, real assignment IDs, truthful upload status and one upload handler.
- Private assignment-file policies enforce ownership even if another student's file path is known.
- The home-page copyright text links discreetly to `admin.html`. It is not a security boundary: Google sign-in + a server-controlled allowlist protect all admin operations.
- Approving a student assigns `AIWH/ESS/0001/2026`-style admission numbers **in the database**, not in JavaScript. Numbering starts at 0001 each year (Africa/Nairobi time) and is not reused if admission is revoked. Repeat approval retains the same number. Concurrent approvals use a locked yearly counter. Previously approved students without a number can be approved once through the new admin page to assign one.
- Admins can record verified payments; choosing a payment plan never counts as payment.
- A4 PDFs use `assets/AI WorkHub Admission Letter.html` as the template, your logo, and administrator-entered cohort/signatory details. Dates, emails and admission numbers are filled automatically. The full content is fitted to one A4 page (210 × 297 mm); long content scales down. The PDF is image-rendered, not a digitally signed or searchable-text document.
- PDFs are uploaded to a private bucket and are visible to the assigned student while approved. Email can run automatically as part of the administrator's generate/save action, or manually after review when the automatic-email checkbox is cleared.

## 1. Update your existing Supabase database

1. Open your Supabase project.
2. Select **SQL Editor** in the sidebar → **New query**.
3. Open **[the full updated schema](https://github.com/SaintM254/AI-WorkHub/blob/arena/458767d4-ai-workhub/supabase/schema.sql)** in GitHub.
4. Click **Raw** above the code or the copy-file icon. Copy the **whole file**.
5. Paste it into Supabase's SQL Editor and click **Run**.
6. Wait for **Success. No rows returned.** If there is an error, stop and keep the error message; do not disable RLS.

Use the **full schema.sql**, not just the short migration, if you previously ran only the original four-table setup. It creates the newer assignments/progress tables as well as the admissions changes. It retains existing application/payment data. Take a database backup before any production schema change. Existing custom policies from other tools must be reviewed: permissive RLS policies combine with OR.

For an existing project that already has the full Antigravity assignments/progress schema, `supabase/migrations/20261009_admissions_and_portal_fixes.sql` contains only the upgrade. Do not run the migration by itself if those tables don't exist yet.

Check **Table Editor** for `app_admins`, `admission_letters`, `admission_counters`, `admin_audit`, `assignments`, `assignment_submissions`, and `course_progress`, alongside the existing student tables. Check **Storage** for a **private** `admission-letters` bucket.

Legacy local-storage progress/submissions were never proof of a server save. This version deliberately does not import those claims. Students should re-submit any work that was never actually received. Existing foreign/invalid assignment metadata does not confer file access under the new policies.

## 2. Make your Google account an administrator (one-time)

Your Supabase project password is an infrastructure credential. **Never type it into a website login form.** Instead:

1. Sign into the **student portal** once using the Google account you want to use as administrator. This creates its Supabase Auth user. You do not have to submit a student application.
2. In Supabase, open **Authentication → Users**.
3. Find that exact Google email. Open the user and copy its **User UID / ID** (a UUID).
4. Open **SQL Editor → New query** and paste:

```sql
insert into public.app_admins (user_id)
values ('PASTE-YOUR-AUTH-USER-UUID-HERE'::uuid)
on conflict (user_id) do nothing;
```

5. Replace only the placeholder between quotes with the actual copied UUID. Click **Run**.
6. Do **not** add students to this table. Do not use a Google Client ID, project reference, email string or database password in this UUID field.

To revoke an operator later, delete that user's row from `app_admins` in Supabase SQL Editor. Admin rights are checked again on every privileged database call and every email request. Changing browser storage or Google profile metadata cannot grant admin rights.

## 3. Allow the new admin callback

In **Supabase → Authentication → URL Configuration → Redirect URLs**, add:

```
https://saintm254.github.io/AI-WorkHub/admin.html
```

Keep the existing `student.html` redirect. Save.

Do not change Google's authorised redirect URI. It still points to your Supabase `/auth/v1/callback` URL, not either web page.

Open the homepage and click **© 2026 AI WorkHub. All rights reserved.** The year updates automatically. Alternatively, visit:

https://saintm254.github.io/AI-WorkHub/admin.html

Click **Continue with Google** using the allowlisted account. A different Google account must get **not an administrator**, not the application list.

## 4. Review and approve an application

1. Select a student from the list. Use name/email/admission-number search or the status filter.
2. Review the Google account email, phone and payment plan.
3. Click **Approve admission**, then confirm.
4. The database assigns and returns the admission number. Approval grants course access; it does not claim tuition has been paid.
5. If you have actually verified money received, use **Record a verified payment** with the amount and unique M-Pesa/bank reference. Duplicate references and overpayments are rejected.
6. Students click **Refresh** in their portal to see updates.

You can also decline or return an admission to pending. This blocks new student resource/letter access, but cannot retract a previously downloaded or emailed PDF or immediately invalidate a signed URL already issued (60-second expiry).

## 5. Generate and review the A4 admission PDF

1. Select an approved student with an admission number.
2. Under **Issue an admission letter**, enter the actual intake, start date, delivery mode, acceptance deadline, orientation date/time/timezone, authorised signatory and role.
3. Choose whether to leave **Email the letter automatically after saving** checked, then click the generate/save button.
4. The letter is generated in your browser, saved privately in Supabase, registered against the student and downloaded. A failed save does not show a success message.
5. Open the PDF and check all details. The student's Google email and admission number are filled from verified records.
6. Use **Open PDF** under **Issued letters** to review an existing copy. The student can also find it under **Resources & Certs → Admission letter** while approved.
7. **Email letter** remains available for manual sending when automatic email is disabled or fails. Neither sends until the server-side email service below has been configured.

## 6. Configure email delivery (server-side only)

This implementation uses **Resend** through a Supabase Edge Function. It sends the stored PDF as an attachment to the selected student's **verified Supabase Auth email**. It is not limited to Gmail recipients and the browser cannot substitute an arbitrary recipient.

### Prepare a sender

1. Create an account at https://resend.com/.
2. Add and verify a sending domain you control, using the DNS records Resend provides. Follow their current account limits and pricing. Do not assume a testing sender can send to all students.
3. Choose a sender address on that domain, e.g. `admissions@your-domain.example` (replace with your real verified domain).
4. Create an API key with the needed sending permission. Store it privately in Supabase **Edge Functions → Secrets**, not in GitHub or chat.

If you do not yet have a verified sending domain/provider, PDF generation and private student downloads still work. **Email is not active until you complete this setup.**

### Deploy the function in the Supabase dashboard

1. Open **Edge Functions** in Supabase.
2. Choose **Deploy a new function → Via Editor** (wording may vary).
3. Name it exactly **send-admission-letter**.
4. Open `supabase/functions/send-admission-letter/index.ts` in this repository and copy its full contents into the function's `index.ts` editor.
5. Deploy the function.
6. In its function settings, turn **Verify JWT / Enforce JWT verification** **off**. This is intentional: the function performs its own `auth.getUser(token)` verification and checks `app_admins` before doing anything. Do not remove these checks. `supabase/config.toml` applies the same setting for CLI deployments.
7. Under **Edge Functions → Secrets**, add:
   - `RESEND_API_KEY`: your private sending API key.
   - `ADMISSIONS_FROM`: e.g. `AI WorkHub Admissions <admissions@YOUR-VERIFIED-DOMAIN>`.
   - `SITE_ORIGIN`: `https://saintm254.github.io` (no `/AI-WorkHub/` path).
8. Supabase automatically supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` inside hosted functions. **Do not put those server credentials in the website or repository.**

Optional CLI deployment, from a trusted computer with Supabase CLI installed and authenticated:

```sh
supabase functions deploy send-admission-letter --project-ref YOUR_ACTUAL_PROJECT_REF --no-verify-jwt
```

No GitHub token is needed for any of these setup steps.

### Send and verify

1. Back in the admin page, open the desired student.
2. Generate/review their PDF.
3. Click **Email letter** and confirm the displayed student email address.
4. A successful result means **accepted by the email provider**, not guaranteed inbox delivery or a read receipt. Check provider logs for delivery/bounce status, and ask the student to check spam if necessary.
5. Sending is protected by a database claim plus a stable provider idempotency key. Repeated clicks do not intentionally send the same letter twice.
6. If status is **uncertain** or stays **sending** after a network/server failure, check Resend's dashboard before doing anything else. The UI deliberately blocks blind retry. An operator can reconcile the row in Supabase after verifying provider records. Do not set it back to `not_sent` without checking, or duplicate mail may result.

## Verification before real use

- Verify Google sign-in with your real account. Local tests do not exercise your Google credentials.
- Confirm a non-admin cannot list applications or call admin RPCs.
- Approve two test applications and check distinct numbers; approve one again and confirm its number stays unchanged.
- Check a student with zero payments shows KSh 0 paid and KSh 10,000 remaining; verify two 5,000 payments reduce the balance to zero.
- Refresh the dashboard several times, then upload one assignment: it must produce one server submission.
- Test a rejected/oversized file: no false “submitted” message.
- Confirm course progress survives sign-out and another device after a successful save.
- Confirm Student B cannot read Student A's uploaded file even if B knows the exact path or tries to add it as their own metadata.
- Generate one letter, inspect its single A4 page, then send to a test student and verify the actual received attachment.

## What has been tested in the repository

`npm test` covers financials, validation, Google callback diagnostics, schema/RLS in embedded Postgres, admin role denial, numbering/idempotence, payment uniqueness/limits, assignment ownership, progress persistence, letter access and the email function using a simulated provider. Browser smoke tests additionally exercised desktop/mobile admin layout, single-page A4 PDF generation, non-admin denial, failed-upload truthfulness and no duplicate upload after refresh. Real Supabase configuration, Google login and actual email delivery still require the live checks above.
