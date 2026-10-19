# TrustVault demo guide (on your laptop)

A ready-made demo: **10 MCA students** with their documents, **2 faculty members** asking for documents, and **1 administrator** who sees everything. All data stays on this laptop (local MongoDB and the `server/storage` folder).

## 1. Prepare (once, before the demo)

```bash
cd D:\TrustVault
npm run demo
```

This **deletes everything in the local database** and creates the demo. It takes about a minute, because every document really goes through the automatic checks. When it finishes, it writes `DEMO-ACCOUNTS.md` with every login. That file stays on your laptop and is never uploaded to GitHub.

| Account | Password | Vault PIN |
|---|---|---|
| All 13 demo accounts | `TrustVault@2026` | `482915` |

## 2. Start

Double-click **Start TrustVault.bat** in `D:\TrustVault`. The site opens at http://localhost:5173.

Open two more things beside it:
- **Demo mailbox**: http://localhost:5173/mailbox. Every email lands here: sign-in codes, document requests, approvals.
- **Authenticator codes**: in a second terminal, run `npm run demo:codes`. It shows each account's current 6-digit code, so you don't have to scan 13 accounts into your phone.

Every sign-in has three steps: **password → email code (from the mailbox) → Authenticator code (from `demo:codes`)**.

## 3. What is already in the demo

| Student | Roll no. | What to show |
|---|---|---|
| Rahul Sharma | 23MX301 | Shared 10th, 12th and PAN with Dr. Priya. Prof. Arun's Aadhaar request is **waiting** |
| Ananya Iyer | 23MX302 | Dr. Priya asked for 3 documents, Ananya **shared only 2** (10th + 12th) |
| Karthik Raja | 23MX303 | Dr. Priya **already opened** his PAN and Aadhaar once; the request is closed |
| Divya Nair | 23MX304 | Dr. Priya's request (Aadhaar + certificate) is **waiting** |
| Vikram Singh | 23MX305 | **Denied** Dr. Priya's request |
| Meera Krishnan | 23MX306 | Dr. Priya asked for **5 documents** for a placement drive, **waiting** |
| Arjun Reddy | 24MX307 | Shared 12th + certificate with Prof. Arun |
| Sneha Patel | 24MX308 | Prof. Arun's request is **waiting** |
| Mohammed Faiz | 24MX309 | Prof. Arun **already opened** his 10th and 12th |
| Lakshmi Venkat | 24MX310 | Shared only the certificate with Prof. Arun (he asked for PAN too) |

Every student has a PAN, Aadhaar, 10th marksheet, 12th marksheet and a college bonafide certificate; some also have a driving licence. All are fake **SPECIMEN** cards. Seven students already have their PAN and Aadhaar verified by faculty, and one Aadhaar was rejected ("photo is blurry").

## 4. Demo script (about 10 minutes)

**Part A: the student (Meera Krishnan, 23MX306)**
1. Sign in with the **Student** tab.
2. **Home**: her documents in the wallet, document progress, and a notification that faculty are asking for documents.
3. **Vault → My Documents**:
   - Point out the groups: identity documents (checked), **school marksheets** (10th/12th, stored as they are, no checks) and college documents.
   - Open **Automatic checks** on her Aadhaar: it was compared with her other documents ("shares MEERA KRISHNAN … with your PAN Card"), never with her account name.
4. **Email me a ZIP**: choose **Size limit**, type `150` KB, send. Then open the demo mailbox to show the email with every file under 150 KB.
5. **Privacy → Access Requests**: Dr. Priya asked for 5 documents. **Untick** two of them and press **Share 3 of 5**.

**Part B: the faculty member (Dr. Priya Raman)**
1. Sign out, then sign in with the **Faculty** tab. The Student tab would refuse this account.
2. **Verify → Student Records**: all 10 students and Dr. Priya's access to each.
3. Open **Meera Krishnan**: only the 3 documents she shared are listed. Press **Open once** on one: it opens with Dr. Priya's email watermarked across it. Close it, and it now says **Already opened**.
4. Open **Lakshmi Venkat** (no access yet): tick **10th Marksheet** and **12th Marksheet**, add a reason, press **Send request**. The email appears in the mailbox for Lakshmi.
5. **Verify → Verification Queue**: approve or reject a pending document (for example Vikram's college certificate).

**Part C: the administrator (Admin Office)**
1. Sign in with the **Administrator** tab.
2. **Admin → Overview**: numbers and charts for the whole college.
3. **Admin → Requests**: every request from both faculty and every student's answer (waiting, shared, opened, denied). Filter by **Waiting**, or search a roll number.
4. **Admin → Users**: change someone's role, unlock an account. **Invitations**: invite a new faculty member by email.
5. **Admin → Ledger / Audit log**: every upload, approval and view is recorded and chained.

**Part D: the public check (no sign-in)**
1. As a student with a verified PAN (e.g. Rahul), open **QR code** on the PAN.
2. Open the link in a private window: anyone can confirm the document is genuine without an account.

## 5. Real email on your laptop (optional)

The demo mailbox is for showing the app without internet email. To send **real** emails from your laptop, use your Gmail:
1. Google Account → **Security** → turn on **2-Step Verification** → **App passwords** → create one named "TrustVault".
2. Open `server\.env`, set `SMTP_USER=` to your Gmail address and `SMTP_PASS=` to the 16-letter app password, and delete the line `DEMO_MAILBOX=1`.
3. Restart TrustVault. The demo accounts use made-up `@trustvault.demo` addresses, so real email only makes sense with real accounts.

## 6. Reset

Run `npm run demo` again at any time to wipe the laptop's data and start from the same demo.
