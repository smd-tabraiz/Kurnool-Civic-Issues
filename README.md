# 🏛️ Kurnool Civic Issue Reporter

A full-stack MERN application for citizens of **Kurnool district, Andhra Pradesh** to report, track, and resolve civic issues such as road damage, power outages, water scarcity, and healthcare problems.

![Tech Stack](https://img.shields.io/badge/Stack-MERN-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### 👤 User Features
- **JWT Authentication** - Secure signup/login with role-based access (User/Admin)
- **Report Issues** - Submit civic issues with title, description, category, location, and photo evidence
- **Social Feed** - Browse issues like a social media feed with upvotes, comments, and sharing
- **GPS Auto-detect** - Automatically detect user location for accurate geo-tagging
- **AI Auto-classification** - Issues are automatically classified by category using NLP keywords
- **Search & Filter** - Filter by location, issue type, status, and search by keywords
- **Real-time Updates** - Socket.io powered live feed updates
- **Notifications** - Get notified when issue status changes or admin responds
- **Dark Mode** - Toggle between light and dark themes

### 🛡️ Admin Features
- **Analytics Dashboard** - Charts showing issues by category, location, and monthly trends
- **Issue Management** - Update status, delete spam, and respond officially
- **Priority Detection** - High-upvoted issues automatically marked as urgent
- **Status Timeline** - Full history of status changes with timestamps

### 🗺️ Map Integration
- **Leaflet Maps** - All geo-tagged issues displayed on an interactive map
- **Color-coded Markers** - Red (Pending), Blue (In Progress), Green (Resolved)

## 🏗️ Project Structure

```
├── server/                    # Backend (Node.js + Express)
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   └── cloudinary.js      # Image upload config
│   ├── controllers/
│   │   ├── authController.js  # Auth endpoints
│   │   ├── issueController.js # Issue CRUD + analytics
│   │   ├── commentController.js
│   │   └── notificationController.js
│   ├── middleware/
│   │   └── auth.js            # JWT & role-based auth
│   ├── models/
│   │   ├── User.js
│   │   ├── Issue.js
│   │   ├── Comment.js
│   │   └── Notification.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── issues.js
│   │   ├── comments.js
│   │   └── notifications.js
│   ├── socket/
│   │   └── index.js           # Socket.io handlers
│   └── server.js              # Entry point
│
├── client/                    # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── IssueCard.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   ├── ThemeContext.jsx
│   │   │   └── SocketContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Home.jsx
│   │   │   ├── ReportIssue.jsx
│   │   │   ├── IssueDetail.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   └── MapView.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── utils/
│   │   │   └── helpers.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   └── index.html
└── README.md
```

## 🚀 Setup Instructions

### Prerequisites
- **Node.js** v18+ 
- **MongoDB** (local or MongoDB Atlas)
- **Git**

### Step 1: Clone & Install

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies  
cd ../client
npm install
```

### Step 2: Configure Environment

Edit `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/kurnool-civic
JWT_SECRET=your_super_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name    # Optional
CLOUDINARY_API_KEY=your_api_key          # Optional
CLOUDINARY_API_SECRET=your_api_secret    # Optional
CLIENT_URL=http://localhost:5173
```

> **Note:** Cloudinary is optional. Images will be stored locally in `server/uploads/` if not configured.

### Step 3: Start MongoDB

```bash
# If using local MongoDB:
mongod

# Or use MongoDB Atlas connection string in .env
```

### Step 4: Run the Application

```bash
# Terminal 1 - Start Backend
cd server
npm run dev

# Terminal 2 - Start Frontend
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

### Step 5: Create Admin Account

Register a new user, then manually update the role in MongoDB:

```bash
# In MongoDB shell or GUI:
db.users.updateOne({ email: "admin@kurnool.gov" }, { $set: { role: "admin" } })
```

## 📡 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register user | Public |
| POST | `/api/auth/login` | Login user | Public |
| GET | `/api/auth/me` | Get profile | User |
| GET | `/api/issues` | List issues (with filters) | Public |
| POST | `/api/issues` | Create issue | User |
| GET | `/api/issues/:id` | Get issue details | Public |
| PUT | `/api/issues/:id/upvote` | Toggle upvote | User |
| PUT | `/api/issues/:id/status` | Update status | Admin |
| DELETE | `/api/issues/:id` | Delete issue | Owner/Admin |
| PUT | `/api/issues/:id/spam` | Mark as spam | Admin |
| GET | `/api/issues/analytics` | Get analytics | Public |
| GET | `/api/issues/map` | Get map data | Public |
| GET | `/api/comments/:issueId` | Get comments | Public |
| POST | `/api/comments/:issueId` | Add comment | User |
| GET | `/api/notifications` | Get notifications | User |

## 🗃️ Database Schema

### Users
| Field | Type | Description |
|-------|------|-------------|
| name | String | Full name |
| email | String | Unique email |
| password | String | Hashed password |
| role | String | user / admin |
| phone | String | Phone number |
| location | String | Default location |

### Issues
| Field | Type | Description |
|-------|------|-------------|
| title | String | Issue title |
| description | String | Detailed description |
| issueType | String | road/power/water/health/sanitation/other |
| location | Object | { area, district, state, coordinates } |
| image | String | Image URL |
| status | String | pending/in-progress/resolved |
| priority | String | low/medium/high/urgent (auto-calculated) |
| upvotes | Array | User IDs who upvoted |
| timeline | Array | Status change history |
| reportedBy | ObjectId | Reference to User |

### Comments
| Field | Type | Description |
|-------|------|-------------|
| issue | ObjectId | Reference to Issue |
| user | ObjectId | Reference to User |
| text | String | Comment text |
| isOfficial | Boolean | True if admin comment |

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router |
| Styling | Vanilla CSS (Glassmorphism + Dark Mode) |
| Charts | Chart.js + react-chartjs-2 |
| Maps | Leaflet + react-leaflet |
| Icons | Lucide React |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Auth | JWT, bcrypt.js |
| Real-time | Socket.io |
| Images | Cloudinary (with local fallback) |

## 📱 Responsive Design

The application is fully responsive and works on:
- 📱 Mobile phones
- 📱 Tablets  
- 💻 Laptops
- 🖥️ Desktops

---

Built with ❤️ for the people of Kurnool district, Andhra Pradesh
