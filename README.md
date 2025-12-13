# Sales Statement Management System
## SRINIVAS FLOUR INDUSTRIES

### Overview
A comprehensive web application for managing monthly sales statements, party details, and generating reports.

### Features
- **Dashboard**: Real-time summary of Total Sales, GST, Bags, and Bills.
- **Sales Entry**: Easy entry form with auto-calculation of GST (CGST/SGST) and HSN code support.
- **Party Master**: Manage customer/party details (Add, Edit, Delete).
- **Reports**: View monthly sales, filter by date, delete entries, and export to **Excel** or **PDF**.
- **Authentication**: Secure Login and Registration system.

### Tech Stack
- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express, Better-SQLite3
- **Database**: SQLite

### Setup & Running

1. **Backend Server**
   ```bash
   cd server
   npm install
   node index.js
   ```
   *Runs on port 5002*

2. **Frontend Client**
   ```bash
   cd client
   npm install
   npm run dev
   ```
   *Runs on port 3002*

3. **Access**
   Open [http://localhost:3002](http://localhost:3002) in your browser.

### Default Credentials
I have created an initial admin account for you:
- **Username**: `admin`
- **Password**: `password123`

*(You can create new accounts using the "Sign Up" link on the login page)*
