# Hostinger Migration Setup Guide

## Step 1: Create MySQL Database on Hostinger

1. Log into **hPanel** at https://hpanel.hostinger.com
2. Go to **Databases** → **MySQL Databases**
3. Create a new database:
   - Database name: `medical_practice`
   - Username: `your_db_user`
   - Password: (generate a strong password)
4. Note down the credentials and hostname (usually `localhost` or provided by Hostinger)

## Step 2: Import the Database Schema

1. Go to **Databases** → **phpMyAdmin**
2. Select your new database
3. Click **Import** tab
4. Upload the `schema.sql` file from this folder
5. Click **Go** to execute

## Step 3: Set Up Node.js Hosting

Hostinger requires **VPS** or **Cloud** hosting for Node.js. Shared hosting won't work.

### Option A: Hostinger VPS

1. Purchase a VPS plan
2. SSH into your server
3. Install Node.js:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
4. Upload the `api/` folder to `/var/www/medical-api/`
5. Install dependencies:
   ```bash
   cd /var/www/medical-api
   npm install
   ```

### Option B: Use a Different Host for API

Consider using Railway, Render, or Fly.io for the Node.js API (free tiers available).

## Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env`
2. Fill in your actual values:
   ```
   DB_HOST=your-hostinger-mysql-host
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=medical_practice
   
   JWT_SECRET=generate-a-long-random-string-here
   
   INFOBIP_API_KEY=your-infobip-key
   INFOBIP_BASE_URL=https://api.infobip.com
   
   FRONTEND_URL=https://your-frontend-domain.com
   ```

## Step 5: Set Up Process Manager (PM2)

```bash
npm install -g pm2
pm2 start server.js --name medical-api
pm2 save
pm2 startup
```

## Step 6: Set Up Nginx Reverse Proxy

Create `/etc/nginx/sites-available/medical-api`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/medical-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 7: Set Up SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## Step 8: Update Frontend

You'll need to update the frontend to use your new API instead of Supabase. This involves:

1. Creating a new API client to replace Supabase client
2. Updating all database calls to use fetch/axios
3. Implementing JWT token management
4. Updating authentication flow

---

## API Endpoints Reference

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Patients
- `GET /api/patients` - List all (staff only)
- `GET /api/patients/:id` - Get one (staff only)
- `POST /api/patients` - Create (public for booking)
- `PUT /api/patients/:id` - Update (staff only)
- `DELETE /api/patients/:id` - Delete (staff only)
- `GET /api/patients/lookup/phone/:phone` - Find by phone (public)

### Appointments
- `GET /api/appointments` - List all (staff only)
- `GET /api/appointments/availability/:date` - Check slots (public)
- `GET /api/appointments/:id` - Get one (staff only)
- `POST /api/appointments` - Create (public)
- `PUT /api/appointments/:id` - Update (staff only)
- `DELETE /api/appointments/:id` - Delete (staff only)
- `PATCH /api/appointments/:id/status` - Quick status update

### Settings
- `GET /api/settings/public` - Public settings
- `GET /api/settings` - Full settings (staff only)
- `PUT /api/settings` - Update (staff only)

### Verification
- `POST /api/verification/send-code` - Send SMS code
- `POST /api/verification/verify-code` - Verify code

### Notifications
- `POST /api/notifications/booking-confirmation` - Send booking SMS
- `POST /api/notifications/appointment-reminder` - Send reminder (staff)
- `POST /api/notifications/reschedule` - Send reschedule notice (staff)

---

## Important Notes

1. **No Row Level Security**: You must validate all access in your API routes
2. **No Realtime**: You'd need to implement WebSockets separately if needed
3. **File Storage**: You'll need to set up file uploads separately (multer + disk/S3)
4. **Backup**: Set up automated MySQL backups
5. **Monitoring**: Set up error logging and monitoring

## Estimated Total Time

- Database setup: 30 minutes
- VPS setup: 1-2 hours
- API deployment: 1-2 hours
- Frontend updates: 20-40 hours (major rewrite)
- Testing: 10-20 hours

**Total: 35-65 hours of work**
