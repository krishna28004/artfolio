# 🎨 Artfolio 

## 📖 Project Overview
A single-artist portfolio built with Next.js 16 and Three.js, with a virtual 3D exhibition and private commission requests.

## ✨ Features

### 🏛️ Virtual Exhibition
Explore artwork in a fully rendered Three.js/React Three Fiber gallery.
* **Adaptive Rendering**: React Three Fiber adjusts rendering resolution to the device. Frame rate depends on the visitor's GPU and browser.
* **First-Person Controls**: Navigate the space as if you were walking in a physical gallery.
* **Accessible Alternative**: A motion-free 2D exhibition is available at `/exhibition/accessible`.

### 💳 Commission System & Secure Checkout
Commission intake and Razorpay payments are release-gated and currently disabled. Existing customers can still use their private tracking links.
* **Idempotency**: Prevents duplicate transactions and secures request integrity.
* **Automated Notifications**: Leverages Resend for real-time email updates between artists and collectors.

---

## 🛠 Technology Stack
* **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
* **3D Rendering:** Three.js, React Three Fiber, Drei
* **Backend & DB:** Supabase, Upstash Redis
* **Integrations:** Cloudinary (CDN), Resend (Emails), Razorpay (Payments)

## 🏗 Architecture Overview
The application follows a modern serverless architecture. The Next.js App Router handles server-side rendering and API routes. The database and authentication are managed securely via Supabase. State management and 3D rendering are isolated in the client components using React Three Fiber. Payment webhooks utilize cryptographic signatures to ensure transaction authenticity.

---

## 🚀 Getting Started

### Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/krishna28004/artfolio.git
cd artfolio
npm ci
```

### Environment Variables
Copy the `.env.example` file to create your local `.env.local` file:
```bash
cp .env.example .env.local
```
Fill in only the settings needed for the workflow you are testing. Keep `ARTFOLIO_COMMISSIONS_ENABLED=false` and `ARTFOLIO_PAYMENTS_ENABLED=false` until the release gates in `COMMISSION_RELEASE_CHECKLIST.md` pass. Do not commit local environment files.

### Local Development
Start the development server:
```bash
npm run dev
```
Navigate to `http://localhost:3000` to view the application.

---

## 🌐 Deployment
The project can be deployed on Vercel after the release checklist is complete. Configure secrets in the deployment provider rather than copying `.env.local`. Rehearse database changes using `SUPABASE_REHEARSAL_RUNBOOK.md` and `SUPABASE_RECOVERY_WORKFLOW.md`; neither document authorizes production migration execution.

## 🗺 Future Roadmap
* AR integration for native mobile browsers.
* Dynamic exhibition lighting based on real-world time of day.
* Expanded payment gateways (Stripe integration).

## 👨‍💻 Author
**krishna28004**

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
