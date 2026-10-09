> **Student email login is now supported:** Follow [EMAIL_SETUP.md](EMAIL_SETUP.md) to enable Email and configure SMTP. Keep Google enabled alongside it.

> **Admissions update:** For the current admin portal, database fixes, admission numbers and email setup, follow [ADMIN_SETUP.md](ADMIN_SETUP.md). The guide below also explains the original Google/Supabase connection.

# Google sign-in and student portal — setup guide

The code is ready to connect, but sign-in will not work until **you complete this setup**. No Supabase or Google project has been created by the agent. You can keep the site on GitHub Pages and the current branch; no merge is required.

## 1. Create a Supabase project

1. Open https://supabase.com/dashboard and create/sign into your account.
2. Create an organisation on the Free plan if prompted. Click **New project**.
3. Name it **AI WorkHub**. Save the generated database password privately. Choose an appropriate available region, then create the project.
4. Wait for project creation to finish.
5. Open **SQL Editor** in the project sidebar → **New query**.
6. Open `supabase/schema.sql` in this repository, copy its full contents into the editor, and click **Run**.
7. Check **Table Editor**: you should see `applications`, `payments`, `course_resources`, and `certificates`.
8. Open **Storage**: confirm `course-materials` and `certificates` exist and both are **private**.

Use a new project if possible. If using an existing project, review its storage policies: permissive policies combine with OR, so an older “allow everyone” policy could expose private files. Never disable Row Level Security to make an error disappear.

## 2. Set the website redirect addresses

In Supabase, open **Authentication → URL Configuration** (labels can change slightly):

- **Site URL:** `https://saintm254.github.io/AI-WorkHub/`
- Under **Redirect URLs**, click **Add URL** and enter:
  `https://saintm254.github.io/AI-WorkHub/student.html`
- Click **Save**.

Use exact production URLs, not a wildcard. If testing in Arena later, add that preview's exact `student.html` URL separately. Start and finish OAuth in the same browser because PKCE uses browser session storage.

## 3. Create a Google OAuth client

1. Open https://console.cloud.google.com/ and sign in with the account you want to own the institution's integration.
2. At the top, open the project selector → **New project**, name it **AI WorkHub**, then create/select it.
3. Open **Google Auth Platform**. If you see the older navigation, use **APIs & Services → OAuth consent screen**.
4. Complete **Branding** / **Get started**: app name **AI WorkHub**, your real support email, and your developer contact email.
5. Select an **External** audience so students outside your own organisation can sign in. While in **Testing**, add your own Google address and any pilot students under **Test users**.
6. Request only the basic identity scopes: `openid`, email, and profile. This app does not need Gmail, Drive or calendar access.
7. Open **Clients → Create client** (older UI: **Credentials → Create credentials → OAuth client ID**).
8. Choose **Web application** and name it **AI WorkHub website**.
9. Under **Authorised JavaScript origins**, add `https://saintm254.github.io` (no `/AI-WorkHub/` path).
10. Keep this page open. In Supabase, open **Authentication → Sign In / Providers → Google**. Copy the **Callback URL** displayed there. It will resemble `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` — use your actual value.
11. Add that exact Supabase callback under Google's **Authorised redirect URIs**. This is NOT your GitHub Pages student URL.
12. Click **Create**. Copy the **Client ID** and **Client secret** into Supabase's Google provider settings. Enable Google and save.
13. Do not put the Google client secret into GitHub, `portal-config.js`, or chat. It belongs only in Supabase's secure provider settings.

There are **two redirects**: Google → Supabase callback; Supabase → your `student.html` page.

Before enrolling the general public, change Google's audience from **Testing** to **In production / Publish app**, complete any branding/domain requirements Google displays, and test a Google account that isn't on your test-user list. Do not claim app verification until Google actually grants it. This Google-only flow does not use password-reset or verification emails from Supabase, so custom SMTP is not required for this first version. Add it before enabling email/password or magic-link login later.

## 4. Add the public website configuration

1. In Supabase, find the **Project URL** via **Connect** or the project's API settings.
2. Under **Settings → API Keys**, copy the **publishable key** (starts with `sb_publishable_`). Do not copy a secret key or `service_role` key.
3. On GitHub, open the repository **Code** tab and select branch `arena/458767d4-ai-workhub`.
4. Open `portal-config.js` → pencil icon (**Edit**).
5. Enter your Project URL and publishable key between the currently empty quotes. Leave the property names unchanged.
6. Click **Commit changes** and commit directly to this branch.
7. Open **Actions** and wait for the latest **Publish website to GitHub Pages** run to finish with a green check.
8. Visit `https://saintm254.github.io/AI-WorkHub/student.html` and test **Continue with Google**.

These two values are public configuration, not administrative credentials. Security comes from database grants and RLS policies. This starter intentionally accepts the current publishable-key format, not legacy JWT anon keys, to reduce the risk of accidentally pasting a privileged legacy key.

## 5. How to operate the first version

This release includes student and admin dashboards. Activate the admin dashboard using ADMIN_SETUP.md. Alternatively, trusted operators can manage records through the Supabase dashboard:

### Review an application

1. Open **Table Editor → applications**.
2. Each submitted application starts as `pending`.
3. Verify the student's details/payment through your agreed process.
4. Change only that student's `status` to `approved` to grant resource access, or `declined` if appropriate.
5. The student clicks **Refresh** in their dashboard to see the change.

An account alone does not grant course access. A browser request cannot approve a student or alter payment records. To find the verified Google email, look up the application's `user_id` under **Authentication → Users**.

### Record a verified payment

1. Open **payments → Insert row**.
2. Copy the student's exact `user_id` from `applications`.
3. Enter `amount_kes`: `5000` or `10000`, matching the payment actually received.
4. Add the unique M-Pesa/bank reference in `reference`.
5. Save. The dashboard calculates the balance from these verified records.

This does NOT collect M-Pesa payments. Never mark a payment received based solely on the student's selected plan or an unverified screenshot. Keep records accurate; don't record the same payment twice.

### Publish a resource

1. Open **Storage → course-materials** and upload a PDF, JPEG, PNG or text file (up to 10 MB).
2. Copy its **object path**, for example `week-1/introduction.pdf` — not a public URL.
3. Open **course_resources → Insert row**. Add title, optional description, exact `file_path`, and numeric `sort_order`.
4. Set `published` to true when ready.
5. Only approved students can read the resource metadata or obtain short-lived file links. All approved students share one programme's resource list in this first version.

Do not upload paid resources into the GitHub repository: it is public. Short-lived signed links expire after 60 seconds, but cannot stop an authorised student from saving or sharing a downloaded file.

### Release a certificate

1. Confirm course completion yourself; this version does not track attendance or completion automatically.
2. Ensure the student is approved and verified payments total at least KSh 10,000.
3. Upload their certificate to the private **certificates** bucket using a distinct path, for example `<student-user-id>/certificate.pdf`.
4. Add a row in **certificates** with their `user_id`, exact `file_path`, title, and `released = true`.
5. Only that student can access it, and only while the full-payment and approval checks pass.

## 6. Security tests before accepting real students

Use two different Google test accounts, Student A and Student B:

- Signed out: cannot read applications, payments, resources or certificates.
- A can submit an application and read A's status, but cannot read B's application or payments, including through direct API calls.
- Attempting to insert an application with another user's ID must fail.
- Attempting to set `status: approved`, update enrolment or insert a payment from a student browser must fail.
- Pending students cannot read course resources or obtain signed file URLs.
- Approved students can access published resources, not unpublished resources.
- Student A cannot access Student B's certificate, even with the file path.
- A released certificate is unavailable until approval and KSh 10,000 verified payments.
- Switching an enrolment back to pending blocks new resource URLs (already issued URLs can remain valid for up to 60 seconds).
- Sign out clears visible personal information. Refresh must not show the dashboard again without a session.

Repository tests check local validation, configuration, static paths and exercise the schema/RLS in embedded Postgres with simulated auth and storage tables. They do **not** prove live database policies or OAuth work. Perform the above live tests after running the SQL and configuring Google.

## 7. Privacy and reliability before launch

Review `privacy.html` with the institution's actual operating practices, including Kenyan data-protection obligations, international processing, record retention and access/deletion requests. Establish a retention schedule and backups. Enable MFA for your own Google/Supabase operator accounts; do not share admin credentials with students. Free tiers have limits and may pause on inactivity; check current provider terms before depending on them for live classes.

## Troubleshooting

- **“Student sign-in is being set up”**: public configuration is missing/invalid. Check `portal-config.js` and deployment status.
- **Google `redirect_uri_mismatch`**: Google's redirect URI must exactly match the Supabase callback URL, including `/auth/v1/callback`.
- **Only your account can sign in**: check Google's test-user list and External audience.
- **Returns to the wrong page**: check Supabase Site URL and exact allowed redirect URL.
- **Sign-in succeeds but dashboard fails to load**: run the schema SQL and check RLS/grants. Never solve this by disabling RLS or using a secret key in the browser.
- **Resource won't open**: check approval, published flag, exact path, private bucket and payment/release rules for certificates.
- **Changes not visible**: wait for a successful Pages workflow and refresh the portal. Rebuild with `npm run build` after changing `src/` files.
