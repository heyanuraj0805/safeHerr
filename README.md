# 🛡️ SAFEHER - Real-Time Personal Safety Application

**SAFEHER** is a comprehensive safety solution designed to provide real-time monitoring and emergency response capabilities. Developed during a hackathon, this project aims to empower users with tools for secure travel and instant SOS alerts.

---

## 🌟 Key Features

* **🚨 Instant SOS System:** Dedicated SOS route for emergency triggers and automated alerts.
* **📍 Live Journey Tracking:** Monitor active journeys in real-time using integrated map components.
* **🔐 Secure Authentication:** User registration and login protected by JWT (JSON Web Tokens).
* **📂 Journey History:** Securely log and store previous travel data for user review.
* **⚠️ Safety Alerts:** Automated notification system for potential safety risks.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React.js, CSS3, HTML5 |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB (Mongoose ODM) |
| **Security** | JWT, Bcrypt.js, Dotenv |

---

## 📂 Project Architecture

```text
SAFEHER/
├── BACKEND/
│   ├── backend/
│   │   ├── .env              # Environment Variables (DO NOT SHARE)
│   │   ├── config/           # Database configuration (db.js)
│   │   ├── middleware/       # Auth validation (auth.js)
│   │   ├── models/           # Mongoose schemas (User, Journey, safetyAlert)
│   │   ├── routes/           # API endpoints (sos, safety, auth, api)
│   │   └── server.js         # Backend Entry Point
│   └── package.json          # Dependencies
└── frontend/
    ├── app.js                # Frontend Logic
    ├── livemap.jsx           # Mapping Component
    ├── index.html            # Main Entry Page
    └── style.css             # Custom Styling
