# AI WorkHub

A responsive, academic-style website for a Kenyan AI education institution. Built with plain HTML, CSS and JavaScript — no build step, subscriptions, external fonts or runtime dependencies.

## Programme

- Duration: **1 week**
- Fee: **KSh 10,000**
- Working programme name: AI Essentials & Automation

The requested services screenshot was not available in this conversation. Curriculum topics are explicitly marked as provisional. Dates, venue, contact details and delivery format must be confirmed before opening enrolment. The planner downloads a personal checklist; it does **not** collect data, reserve a seat, process payments or submit applications.

## Publish on GitHub Pages — beginner instructions

Automatic Pages activation was blocked by GitHub's integration permissions (HTTP 403). The repository owner must activate it in the browser. You do not need a paid hosting account or a domain name.

1. Sign in to GitHub and open **https://github.com/SaintM254/AI-WorkHub**.
2. Near the top of the repository, click **Settings**. On smaller screens, it may be under the **…** menu. This is the repository's Settings tab, not your profile settings.
3. In the left sidebar, under **Code and automation**, click **Pages**.
4. Find **Build and deployment**. Under **Source**, choose **GitHub Actions**. You do not need to choose a framework or click Configure on a suggested template; this repository already has a workflow.
5. Click the **Actions** tab at the top of the repository. If asked whether to enable workflows, enable them.
6. Look for **Publish website to GitHub Pages**. The initial automatic run may have failed because Pages was not yet enabled. Open that run, click **Re-run all jobs**, and confirm. If the menu says **Re-run jobs**, open it and choose **Re-run all jobs**.
7. Wait for a green check mark (normally a few minutes). Open **Settings → Pages** again and click **Visit site**.
8. Your expected public address is **https://saintm254.github.io/AI-WorkHub/**. This address is only live after a successful deployment.

### If the workflow is not visible

The site lives on the `arena/458767d4-ai-workhub` branch, not `main`. In the **Code** tab, use the branch dropdown (normally labelled `main`) to select `arena/458767d4-ai-workhub`. The workflow runs whenever that branch receives a new commit. In **Actions**, select **All workflows** to find its push-triggered run. A manual **Run workflow** button may not appear because the workflow is not on the default branch; rerun the existing push-triggered run instead.

### If publishing is blocked

- **Actions disabled:** Go to **Settings → Actions → General**. Under **Actions permissions**, allow GitHub-owned actions (the workflow uses only official `actions/*` actions), then click **Save**. If an organisation enforces these settings, its administrator must allow the actions.
- **Deployment branch not allowed:** Go to **Settings → Environments → github-pages**. Under **Deployment branches and tags**, allow the branch `arena/458767d4-ai-workhub` (add a branch rule for that exact name). Do not select only `main`.
- **Environment approval required:** In the workflow run, click **Review deployments** and approve the `github-pages` deployment if you are an authorised reviewer.
- **404 page:** First confirm that the workflow is green and the URL includes `/AI-WorkHub/`. Allow a few minutes and refresh.
- **No Settings tab:** Ensure you are signed into the repository owner's account or an account with administrator access.

The workflow already grants the narrowly required `pages: write` and `id-token: write` permissions. You do **not** need to enable broad repository write access, supply a token, or turn on “Allow GitHub Actions to create and approve pull requests.”

## Editing the website

From the repository **Code** tab, select the `arena/458767d4-ai-workhub` branch first. Open a file, click the pencil icon (**Edit this file**), make your changes, then click **Commit changes** and commit directly to this branch. Each change triggers a fresh deployment once Pages is enabled.

- **Course descriptions, price, duration, FAQs:** `index.html`
- **Colours, fonts, mobile layout:** `styles.css`
- **Planner checklist and interactions:** `script.js` (update the price/duration here too if they change)
- **Custom logo:** `assets/logo.svg` contains the supplied full stacked brain-and-chip logo. `assets/logo-horizontal.svg` arranges the same artwork and wordmark horizontally for the header and footer. `assets/favicon.svg` uses the brain-and-chip symbol alone for legibility in the browser tab. Poppins lettering has been converted to vector paths so it renders consistently without installed fonts. Update all three variants for future brand changes.
- **Hero photo:** replace `assets/students.jpg`. The current image is AI-generated, depicting young Kenyan adult learners; it does not depict actual enrolled students. Update the image alt text and the footer disclosure if you replace it with a real authorised photo.

Before taking applications, add your real enrolment contact, cohort dates, delivery format, final service list and payment process. If collecting personal information later, add a suitable privacy policy and secure form service/backend. GitHub Pages itself only hosts static files.

## Local preview

With Python installed, open a terminal in this folder and run:

```sh
python3 -m http.server 3000 --bind 0.0.0.0
```

Open `http://localhost:3000` on the same computer. Stop the server with Ctrl+C. In Arena, use the live preview instead.

## Technical notes and checks

- Relative asset links support GitHub Pages project URLs.
- System Georgia serif and Arial/Helvetica sans-serif keep the site fast and avoid external font dependencies.
- Responsive breakpoints at 1100, 800 and 580 pixels; reduced-motion support; keyboard focus indicators; native modal dialog and FAQ disclosures.
- Node JavaScript syntax check: `node --check script.js`.
- Automated real-browser testing could not run in the sandbox because the browser download host was blocked. Check the deployed site on a phone and desktop before opening enrolment.
- Only `index.html`, `styles.css`, `script.js` and `assets/` are published. Documentation and repository files are excluded from the deployment artifact.
