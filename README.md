# 🎨 Artfolio 

<p align="center">
  <img src="docs/screenshots/homepage.png" alt="Artfolio Banner">
</p>

## 📖 Project Overview
A single-artist portfolio built with Next.js 16 and Three.js, with a virtual 3D exhibition and private commission requests.

## ✨ Features

### 🏛️ Virtual Exhibition
Explore artwork in a fully rendered Three.js/React Three Fiber gallery.
* **Optimized Rendering**: Smooth 60FPS experience utilizing `drei` utilities and optimized 3D models.
* **First-Person Controls**: Navigate the space as if you were walking in a physical gallery.
<p align="center">
  <img src="docs/screenshots/exhibition.png" alt="Virtual Exhibition">
</p>

### 💳 Commission System & Secure Checkout
An end-to-end custom art request flow coupled with integrated Razorpay processing.
* **Idempotency**: Prevents duplicate transactions and secures request integrity.
* **Automated Notifications**: Leverages Resend for real-time email updates between artists and collectors.
<p align="center">
  <img src="docs/screenshots/commission.png" alt="Commission System">
</p>

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
npm install
```

### Environment Variables
Copy the `.env.example` file to create your local `.env.local` file:
```bash
cp .env.example .env.local
```
Ensure you fill in your actual keys for Supabase, Razorpay, Cloudinary, and Resend.

### Local Development
Start the development server:
```bash
npm run dev
```
Navigate to `http://localhost:3000` to view the application.

---

## 🌐 Deployment
The project is optimized for deployment on Vercel. Connect your repository to Vercel and ensure all environment variables from `.env.local` are mirrored in the Vercel project settings.

## 🗺 Future Roadmap
* AR integration for native mobile browsers.
* Dynamic exhibition lighting based on real-world time of day.
* Expanded payment gateways (Stripe integration).

## 👨‍💻 Author
**krishna28004**

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
