# SplitExpenses

A personal expense-sharing app built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Multi-profile management**: Create profiles for yourself, partner, roommates, or trips
- **Category-based splitting**: Organize expenses by category with custom split rules
- **Real-time synchronization**: Balances and summaries update instantly across all devices
- **Flexible split rules**: Equal, percentage, fixed amount, and custom per-person shares
- **Activity audit trail**: Full history of all changes
- **Responsive design**: Works on desktop and mobile

## Tech Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Realtime + Auth)
- **Hosting**: Vercel (frontend), Supabase Cloud (backend)

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free at https://supabase.com)

## Setup Instructions

### 1. Create a Supabase Project

1. Go to https://supabase.com and sign up
2. Create a new project
3. Wait for the project to be ready

### 2. Run the Database Migration

1. In the Supabase dashboard, go to **SQL Editor**
2. Copy the contents of `supabase/schema.sql`
3. Paste into the SQL editor and click **Run**
4. This creates all tables, indexes, RLS policies, and triggers

### 3. Configure Environment Variables

1. In Supabase dashboard, go to **Settings** > **API**
2. Copy your **Project URL** and **anon public** key
3. Create a `.env.local` file in the project root:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. Install Dependencies and Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

### 5. Create Your Account

- Click **Sign up** to create an account
- The first user is automatically the account owner

### 6. Start Using the App

1. Go to **Profiles** and create profiles (e.g., "Me", "Partner")
2. Go to **Categories** and create expense categories
3. Go to **Expenses** to add expenses with split rules
4. View real-time balances on the **Dashboard**

## Deployment

### Deploy Frontend to Vercel

1. Push your code to GitHub
2. Go to https://vercel.com and import your repository
3. Add your Supabase environment variables in Vercel project settings
4. Deploy

### Database

Your Supabase project is already hosted. No additional deployment needed.

## Project Structure

```
src/
  app/
    layout.tsx          - Root layout
    page.tsx           - Home (redirects to dashboard)
    login/page.tsx     - Login page
    signup/page.tsx    - Signup page
    dashboard/page.tsx - Dashboard with balances
    profiles/page.tsx  - Profile management
    categories/page.tsx - Category management
    expenses/page.tsx  - Expense creation/editing
    activity/page.tsx  - Activity log
  components/
    Navbar.tsx         - Navigation bar
  lib/
    supabase.ts        - Supabase client
    utils.ts           - Utility functions
  types/
    index.ts           - TypeScript interfaces
supabase/
  schema.sql          - Database schema and RLS policies
```

## License

MIT
