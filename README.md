# Aaramtola–Bhimodi Safari

The public website keeps its existing layout, photographs, video, mobile navigation, and WhatsApp enquiry flow. The content studio is at `/admin/`. Its source and deployment configuration live in this GitHub repository; content updates live in Netlify Database and uploaded photographs in Netlify Blobs. This is a small custom CMS, without an external CMS subscription or GitHub access token in the browser. Publishing content does not create Git commits or require a new deployment.

## One-time administrator setup

Netlify Identity enablement is included with this deployment. After deployment, open [Identity settings](https://app.netlify.com/projects/aaramtola-bhimodi-safari/identity), set registration to **Invite only**, and invite the administrator's email under Users. Assign the **admin** role to that account using the user's role settings. Never grant this role to ordinary visitors. There is no signup form and all content-changing API requests require a server-verified Identity account with the server-managed `app_metadata.roles` containing `admin`.

The invitation email leads to a password setup screen. Choose a unique password of at least 12 characters. Invitation, email confirmation and password recovery links that land on the homepage redirect to the admin panel. To reset a password, use Send reset password email on the user's Identity page. A role change takes effect in Identity sessions on the next login or token refresh; sign out and back in after assigning a role. The content API additionally checks the current user record through Identity on each request.

Use HTTPS. The existing Netlify HTTPS domain supports secure session cookies. Never put a password, API token, or service credential in source code. No application secrets need to be entered for this CMS.

## Editing and publishing

Sign in at `/admin/`. Website text includes navigation, headings, paragraphs, statistics, labels, safari charges, session names and descriptions, footer text, image descriptions, and page metadata. Use the search box or section filter to find a field. Line breaks in the existing hero heading are retained; each line is editable individually. Contact & booking manages both calling links and the WhatsApp enquiry destination. Use the contact tab to change phone numbers.

The current site advertises morning and evening sessions without fixed clock times. Enter confirmed timings in the booking descriptions or slot labels when available. The existing enquiry form continues to open WhatsApp and does not collect payments or confirm reservations.

Gallery supports multiple uploads, replacement, removal, captions, accessibility descriptions, and reordering. JPEG, PNG and WebP uploads are limited to 5 MB each and 100 gallery entries. Save draft stores all changes privately in the database. Publish atomically saves the current draft and makes it visible to visitors on their next page load. Both actions work from Android and desktop browsers. A draft saved in one browser can be reopened on another. Unsaved changes prompt before leaving; conflicting saves from another session are rejected to avoid overwriting newer work.

Removing or replacing an image removes it from the gallery when published. Stored binary originals are retained so an existing published gallery remains intact while drafts are edited. Image removal does not erase the original file from storage or GitHub. Uploaded image URLs are public; do not upload confidential files.

## Deployment and storage

Netlify runs the configured browser bundle step automatically, publishes `public/`, and detects `netlify/server/index.mjs` for `/api/*`. Use Node.js 24. The generated migration in `netlify/database/migrations/` creates the draft/published content table. Netlify provisions the managed Postgres database and applies migrations at deployment. Netlify Blobs stores uploaded images persistently across deployments. Automatic database branch isolation protects production content in Deploy Previews; uploaded media uses a shared site-level store with unguessable image names.

The public HTML contains the updated tagline, “Discover the Wild. Feel the Wonder.”, and remains usable with its original content if the content service cannot be reached. Never edit database connection values in the repository. Source changes deploy through the connected GitHub repository as usual; content is managed through the studio.

## Verification

Run `npm test` to verify initial content, safe image references, upload signatures, required field validation, rejection of unauthorized draft reads and writes, cross-origin write rejection, and preservation of public markup and features. Syntax checks cover the browser and server entrypoints. Netlify validates the deployment build automatically.

Identity does not run under local Netlify development. After deployment, test invitation acceptance, password login, recovery, admin role authorization, draft privacy, image upload, and publication from a separate signed-out browser. These real Identity and persistent-storage flows need the deployed service and an invited administrator; they cannot be confirmed by local unit checks.

## Authentication fix and preview review

The installed Identity SDK's invitation and password-recovery helpers did not write the session cookie that the content API requires. Its refresh helper skips fresh sessions, so calling refresh immediately did not repair that missing cookie. Invitation completion now signs in through the SDK's cookie-writing login method. Recovery verifies the email callback first, updates the password in that verified session, and signs in to synchronize the API session. Password setup requires matching passwords of at least 12 characters; existing password login keeps its existing password requirements. Email tokens remain in memory and are removed from the address bar; failed callbacks cannot fall through to password login. The editor also provides a password-reset email request and sign-out access when a signed-in account lacks the admin role.

Before merging, use the generated Netlify Deploy Preview over HTTPS. Identity cannot be tested with `netlify dev`. Existing users and database migrations were preserved. No new credentials or environment variables are required. In [Identity settings](https://app.netlify.com/projects/aaramtola-bhimodi-safari/identity), verify Invite only registration and the existing user's `admin` role in app metadata. Roles take effect on the next login or token refresh. If a previous invitation/reset was consumed or expired, resend the appropriate email; do not delete the user. Default emails may open the production homepage: to review an unused invitation/recovery link on the preview, change only its origin to the preview origin, retaining `/admin/` and the hash fragment. Treat the full email URL as a credential and never paste it into logs, issues, or screenshots. Custom templates, if used, must preserve the `invite_token` or `recovery_token` fragment.

Review on Android Chrome and a desktop browser: accept an unused invite, enter and confirm a password, sign out, sign in, request a reset email, set a different password, then confirm that the old password fails and the new one works. Check invalid/expired links, reload after login, and a user without the admin role. Finally upload a test photograph, save a draft, reopen it, and publish on the preview; verify draft privacy and the resulting public content. The automated suite covers auth state transitions and server authorization; real email delivery, Android behavior, and deployed storage operations require this preview review and were not verified locally.
