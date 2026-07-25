# 🚀 Deploying Hi Quality Silencers Backend on Namecheap Shared Hosting (cPanel)

This backend is a standalone **Node.js + Express** server designed to run smoothly on Namecheap shared hosting via cPanel's **Setup Node.js App** feature.

---

## 📁 File Structure Created
```
c:\projects\HITECH\
├── backend/
│   ├── data/
│   │   └── db.json            # JSON Database file
│   ├── server.js              # Express API Server (Main entry point)
│   ├── package.json           # Dependencies (express, cors, body-parser)
│   ├── .htaccess              # Namecheap Passenger rewrite configuration
│   └── README_NAMECHEAP.md    # Deployment guide
```

---

## 🛠️ Step-by-Step Namecheap cPanel Deployment Guide

### 1️⃣ Step 1: Upload Backend Files to cPanel
1. Log into your **Namecheap cPanel**.
2. Open **File Manager**.
3. Create a folder in your root directory named `backend` (outside `public_html` or inside a subdomain directory).
4. Upload all files from `c:\projects\HITECH\backend\` (`server.js`, `package.json`, `data/db.json`).

### 2️⃣ Step 2: Set Up Node.js App in cPanel
1. In cPanel, search for **Setup Node.js App** under the *Software* section.
2. Click **Create Application**.
3. Fill in the parameters:
   - **Node.js version**: Select `18.x` or `20.x` (or latest available).
   - **Application mode**: `Production`.
   - **Application root**: `backend` (or your folder name).
   - **Application URL**: `api` (or domain/subdomain).
   - **Application startup file**: `server.js`.
4. Click **Create**.

### 3️⃣ Step 3: Install Dependencies
1. After creating the app, click the **Run npm install** button inside the cPanel Node.js App interface.
2. Alternatively, copy the virtualenv command shown at the top of the cPanel page, enter **Terminal** in cPanel, paste the command, and run:
   ```bash
   npm install
   ```

### 4️⃣ Step 4: Restart the Application
Click **Restart Application** in the Node.js App page in cPanel.

---

## 🌐 API Endpoints Created

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` or `/api/health` | Health Check (Returns `ONLINE` status) |
| `GET` | `/api/products` | Returns all silencers & DPF products |
| `POST` | `/api/products` | Adds a new product dynamically |
| `GET` | `/api/enquiries` | Returns customer contact form enquiries |
| `POST` | `/api/enquiries` | Saves a new customer enquiry form |
| `GET` | `/api/bookings` | Returns DPF cleaning service appointments |
| `POST` | `/api/bookings` | Creates a new DPF service booking |

---

## 🔗 Connecting Frontend to Namecheap Backend
In your frontend `.env.local` or API configuration, update the backend URL to point to your live Namecheap API URL:
```env
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
```
