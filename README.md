# Sales Manager Application

A comprehensive Sales & Purchase Management System built with **React** (Vite) and **Node.js** (Express + SQLite).

## Features
- **Sales Management**: Create, edit, and delete sales entries.
- **Purchase Management**: Track inventory purchases.
- **Stock Ledger**: Automated stock tracking (FIFO/LIFO/Average logic as per configuration).
- **Reports**: Generate detailed Sales and Purchase reports with dynamic year filtering.
- **Secure Authentication**: JWT-based user login.

## Prerequisites
- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/jaivishnukumar/GOOGLE-ANTIGRAVITY-PROJECTS.git
    cd GOOGLE-ANTIGRAVITY-PROJECTS
    ```

2.  **Install Dependencies:**
    This project is set up to install dependencies for both Client and Server automatically.
    ```bash
    npm install
    # or manually:
    # npm run install-server
    # npm run install-client
    ```

3.  **Environment Variables:**
    Create a `.env` file in the `server` directory (optional for local dev, uses defaults if missing).
    ```env
    PORT=5002
    JWT_SECRET=your_super_secret_key
    ```

## Running the Application

### Development Mode
To run client and server separately for development:
1.  **Backend:**
    ```bash
    cd server
    npm start
    ```
2.  **Frontend:**
    ```bash
    cd client
    npm run dev
    ```

### Production / Deployment
To run the full stack app (Server serving Client):
1.  **Build the Frontend:**
    ```bash
    npm run build-client
    ```
2.  **Start the Server:**
    ```bash
    npm start
    ```
    The application will be available at `http://localhost:5002` (or your configured PORT).

## Deployment Notes
- **Database Persistence**: This app uses **SQLite** (`server/sales_app.db`). 
  - **Warning**: On ephemeral cloud hosting (like Render Free Tier, Vercel), the filesystem is wiped on every restart. You will lose your data if you deploy there without using a persistent disk service or migrating to PostgreSQL.
  - **Recommended for Data Safety**: Run on a VPS (DigitalOcean, EC2) or use a persistent storage volume if supported by your cloud provider.
