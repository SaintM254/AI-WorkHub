# Email sign-in + free-tier email delivery

## What is implemented

The student portal now supports **Google OR email/password**. Email includes sign-up, sign-in, confirmation resend and password reset. Passwords are handled by Supabase Auth, not your public database tables. No new SQL migration is required for this change if your previous admissions setup is already complete.

The admin admission-letter form now has **Email the letter automatically after saving**, selected by default. When the administrator submits the completed letter form, the page generates the A4 PDF, stores/registers it privately, then calls the existing server-side email function. Uncheck the box for download/review only; the existing manual **Email letter** button remains available. Approval alone does not send a letter: the cohort, dates and signatory must first be supplied. This is an immediate post-save action, not a background job queue: keep the page open until the result appears. If the browser closes or sending fails, the saved PDF remains available for manual sending.

**This code update does not change settings in your Supabase or mail-provider accounts.** Follow the steps below to activate delivery. Do not put private keys in the website or chat.

## Recommended provider: Resend

This works with the admission-letter function already in the repository. Its Free transactional plan currently includes **3,000 emails per month, at most 100 per day**. Authentication and admission-letter emails share that sending allowance when using the same account. Check the current provider limits before launch:

- [Official Resend pricing](https://resend.com/docs/knowledge-base/what-is-resend-pricing)
- [Official Supabase SMTP setup with Resend](https://resend.com/docs/send-with-supabase-smtp)

**You need a domain you control to send to real students through Resend.** A free email-sending plan does not include free domain registration. You cannot verify `gmail.com` or `saintm254.github.io` as your own sending domain. Your website may remain on GitHub Pages; the email sending domain can be separate. You don't need paid Supabase custom-domain hosting or a paid website host for this.

If you do not own a domain, stop at the domain step and ask for help choosing a domain or an alternative provider. Resend's test sender is not a production workaround for arbitrary recipients.

## 1. Create/verify your Resend sender

If you already configured Resend for admission letters, **reuse your verified domain and account**; you do not need another provider.

1. Visit https://resend.com/ and create/sign into your account.
2. Open **Domains** in the sidebar → **Add domain**.
3. Enter a domain you own, or a dedicated sending subdomain such as `mail.your-domain.example` (replace this with your actual domain).
4. Resend will display DNS records. Open the website where you manage the domain → its **DNS / Manage DNS** page.
5. Copy the record types, names/hosts and values exactly as Resend displays them. Record names and values are specific to your domain—do not copy someone else's example.
6. Do not delete existing mail records. Ask for help if you already receive mail on this domain; duplicate SPF records can cause problems.
7. Return to Resend and click **Verify** or **I've added the records**. Wait until the sending domain is verified. DNS changes can take time.
8. Choose a sender on that exact verified domain, e.g. `accounts@mail.your-domain.example`. This is an example, not a real sender for your site.
9. Open **API Keys → Create API key**. Use a sending-permission key restricted to the verified domain where supported. Keep it private. Separate keys for authentication SMTP and admission API are preferable for easier rotation, but both can use the same Resend account/domain.

Do not use a personal Gmail password as an SMTP password. For Resend, the SMTP password is a Resend API key.

## 2. Connect Resend to Supabase authentication emails

In Supabase:

1. Open your project.
2. Click **Authentication**.
3. Under **Notifications**, choose **Email** (some versions label it **Emails**).
4. Open **SMTP Settings** → turn on **Enable custom SMTP**.
5. Enter:

| Setting | Value |
| --- | --- |
| Sender name | `AI WorkHub` |
| Sender email | Your real address on the verified Resend domain |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your private Resend API key |

6. If encryption is explicitly requested, choose SSL/TLS for port 465.
7. Click **Save**.

[Official credentials and screen walkthrough](https://resend.com/docs/send-with-supabase-smtp).

The password in this screen is **not** your Supabase password, Google Client Secret or student login password. It is never added to GitHub.

Supabase's built-in SMTP is testing-only and normally restricts mail to project-team addresses. Configuring custom SMTP is what removes that default recipient restriction. This is separate from Google's OAuth test-user list. See [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

## 3. Enable email accounts and confirmation

1. In Supabase, open **Authentication → Sign In / Providers** (sometimes **Providers**).
2. Select **Email**.
3. Enable the **Email** provider.
4. Keep **Confirm email** **ON**. Students should verify their mailbox before a new account can sign in.
5. Set the minimum password length to **8 or greater**. If you choose stronger requirements, tell students what those requirements are.
6. Under the sign-up settings, ensure **Allow new users to sign up** is enabled if you want public enrolment.
7. Save. Leave the Google provider enabled too.

Do not turn off confirmation to solve a delivery error. Fix SMTP/domain verification instead.

### Google accounts vs email accounts

- **Continue with Google** is still subject to Google's test-user list while your OAuth app is in Testing.
- **Email/password** signup is a separate Supabase login method. A student can use a Gmail address in the email form without being on Google's OAuth test-user list, once custom SMTP and email signup are working.
- Students should consistently use the same email address. Returning Google students should avoid creating a second account under another address. If a Google-only student wants a password, use **Forgot password** with the same verified address and verify that the same student profile is retained; Supabase controls identity linking. Do not manually merge accounts based only on an unverified email.
- Administrators remain on the existing Google + admin-allowlist login. Email sign-up never grants administrative rights.

## 4. Add the exact redirect URLs

Open **Authentication → URL Configuration**.

**Site URL:**

```
https://saintm254.github.io/AI-WorkHub/
```

Under **Redirect URLs**, keep/add each of these as a separate entry:

```
https://saintm254.github.io/AI-WorkHub/student.html
https://saintm254.github.io/AI-WorkHub/student.html?flow=recovery
https://saintm254.github.io/AI-WorkHub/admin.html
```

Click **Save**. The `?flow=recovery` entry is important: it tells the website to show the new-password form after the reset callback. Keep the existing Google callback in Google Cloud unchanged; it points to Supabase's `/auth/v1/callback` endpoint.

## 5. Set your authentication email templates

Under **Authentication → Email / Emails → Templates**:

1. Open **Confirm signup**. Use a subject such as `Confirm your AI WorkHub account`.
2. You can leave Supabase's default template, or replace the body with the file `supabase/email-templates/confirm-signup.html` in this repository.
3. Open **Reset password**. Use a subject such as `Reset your AI WorkHub password`.
4. You can use `supabase/email-templates/reset-password.html` for its body.
5. Save each template.

**Keep the `{{ .ConfirmationURL }}` placeholder exactly as written.** Do not replace it with the homepage or manually construct a Google URL. Supabase generates the secure, expiring link and includes the allowed redirect.

This app uses PKCE. Start the email request and open its link in the same browser/device without clearing site data. On a phone, an email app may open a different in-app browser: choose your normal browser or copy the link privately into that browser. Do not share links in chat, and use only the newest link. If you require cross-device email confirmation/reset, ask for a dedicated token-verification flow before changing the templates.

Disable mail-provider click tracking on authentication links if enabled, because rewriting links or email security scanners may interfere with one-time links. Do not disable security controls such as email confirmation.

## 6. Connect the same provider to admission letters

SMTP settings above send **authentication emails only**. Admission PDF attachments use the separate `send-admission-letter` Edge Function already implemented.

If it already sends letters successfully, you can leave that function configuration as-is. Otherwise:

1. Open **Supabase → Edge Functions → Secrets**.
2. Add/update:
   - `RESEND_API_KEY`: the sending API key for admission emails.
   - `ADMISSIONS_FROM`: e.g. `AI WorkHub Admissions <admissions@mail.YOUR-VERIFIED-DOMAIN>`.
   - `SITE_ORIGIN`: `https://saintm254.github.io`.
3. Confirm the **send-admission-letter** function is deployed. If not, follow section 6 of `ADMIN_SETUP.md` using `supabase/functions/send-admission-letter/index.ts`.
4. Keep the function's platform **Verify JWT** setting as documented: off, because the function itself verifies the user's token and the admin allowlist. Never remove those checks.
5. You do not need to redeploy its source solely for this UI update; the same function now gets called automatically after a successful letter save.

The recipient is always taken server-side from the selected student's **verified Supabase Auth email**, whether they signed in with Google or email/password. A browser cannot substitute another recipient.

### Everyday admission workflow

1. Open the admin page through the homepage copyright link.
2. Select and approve the student.
3. Fill in the cohort, orientation and signatory details in the letter form.
4. Leave **Email the letter automatically after saving** checked.
5. Click **Generate, save & email PDF** and keep the page open until a result appears.
6. The PDF is saved/downloaded first, then emailed. A failed email does not delete the student's saved letter.
7. Success means **accepted by the provider**, not guaranteed delivery. Check Resend's logs for bounce/delivery status.

Uncheck automatic email to inspect the PDF before using **Email letter** manually. If a send shows **uncertain** or **sending**, check Resend before retrying. Do not reset statuses blindly or generate duplicate letters merely to bypass the send lock.

## 7. Test in this order

1. Use a real address you control that has **not** already registered. Open the student portal → **Create account**.
2. Check the inbox/spam folder for the confirmation email. Before confirmation, sign-in should be rejected.
3. Open the newest confirmation link in the original browser. The portal should open your account/application.
4. Sign out, then sign in with **email + password**. No verification email should be needed on every normal login.
5. Sign out, select **Forgot password**, and request a reset. Open its newest link in the same browser. You should see **Choose a new password**, not the dashboard.
6. Save a new password. Sign out and confirm the new password works and the old one no longer works.
7. Test **Resend confirmation** on an unconfirmed test account. The page throttles repeats; provider/server limits also apply.
8. As an admin, approve a test application, complete its letter details, leave auto-email checked and generate. Confirm that the inbox receives the PDF and its admission number matches the portal.
9. Verify a normal email student cannot open admin records or another student's data.

## Free-tier limits, security and troubleshooting

- Resend's daily/monthly allowance is shared by verification, resets, admission emails and other traffic on the account. Monitor it; there is no promise of unlimited free delivery.
- Supabase also has its own **Authentication → Rate Limits**. Start conservatively and adjust to your provider allowance, not unlimited values. The UI's one-minute resend delay is convenience, not an anti-abuse security boundary.
- Before a wide public launch, add CAPTCHA to the forms and configure it in Supabase. The current forms do not send CAPTCHA tokens; do not enable mandatory CAPTCHA until the matching widget/token handling is added.
- If only your own address receives mail, check **both** custom SMTP setup and verified Resend sender, not only Google's testing settings.
- `Email address not authorized`: usually the default testing SMTP is still in use; recheck custom SMTP.
- `email_not_confirmed`: open the verification email or request a new one.
- Rate-limit errors: wait and inspect both Supabase and Resend limits. Do not repeatedly click resend.
- Link expired / missing PKCE verifier: request a fresh link from the portal and keep the same browser's site data.
- Reset opens the homepage: check the exact `student.html?flow=recovery` redirect entry and restore `{{ .ConfirmationURL }}` in the template.
- Admission mail fails but password resets work: SMTP and Edge Function secrets are separate; configure both.
- PDFs save but email is not configured: PDF generation is independent of provider setup. Do not interpret it as a successful email.

## Opening Google login to other students (independent)

In Google Cloud → **Google Auth Platform → Audience**, keep the audience **External** for students outside your organisation. While **Testing**, add pilot students as test users. For general availability, use **Publish app / In production** and complete any branding, domain or verification requirements Google displays. Publishing in Google does not configure Supabase SMTP, and SMTP configuration does not publish the Google app.

## Secrets

Only Project URL and `sb_publishable_…` are public website settings. Resend API keys, SMTP passwords, Supabase service-role keys, database passwords and Google client secrets belong only in provider/server settings. Do not send them in chat or commit them to GitHub.
