# SplitExpenses

A modern expense-sharing app built with Next.js 14, TypeScript, Tailwind CSS, and Supabase. Split expenses across groups with real users, real-time balances, and a refined mobile-first experience.

## Features

- **Real users, real groups**: Every participant is an actual logged-in account. Create a group, invite by email, and everyone sees their own balances from their own login.
- **Category-based splitting**: Organize expenses by category with equal, percentage, or fixed split rules.
- **Settle up**: Record a payment between two users and it nets against the balance immediately.
- **Real-time synchronization**: Balances and summaries update instantly across all devices via Supabase Realtime.
- **Debt simplification**: Balances are reduced to the minimum number of "who pays whom" transactions.
- **Inline quick edit**: Edit groups, categories, and expenses directly from their cards without navigating away.
- **Settlement details**: Settlement history and activity log show the related expense name when a payment is linked to a specific expense.
- **Clickable group cards**: Group items on the dashboard and groups list are fully clickable, with an edit button revealed on hover.
- **Activity audit trail**: Full history of all changes across groups.
- **Responsive design**: Bottom tab navigation on mobile, horizontal nav on desktop.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Realtime + Auth + Storage)
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

- Click **Sign up** to create an account. Every participant needs their own login — there's no "owner adds fake profiles" model.

### 6. Start Using the App

1. Go to **Groups**, create a group, and invite the other real people by email
2. Once they sign up and accept the invite, they'll see the group and its balances from their own login
3. Go to **Categories** and create expense categories for the group
4. Go to **Expenses** to add expenses with split rules
5. Use **Settle Up** on a group page to record a payment and net it against the balance
6. View real-time balances on the **Dashboard**

## Project Structure

```
src/
  app/
    layout.tsx             - Root layout with theme providers
    page.tsx                - Landing page
    login/page.tsx          - Login page
    signup/page.tsx         - Signup page
    forgot-password/page.tsx - Password reset request
    reset-password/page.tsx  - Set new password
    dashboard/page.tsx      - Cross-group balance overview
    groups/page.tsx         - Group list, creation, invite acceptance
    groups/[id]/page.tsx    - Group detail: members, balances, settle up
    categories/page.tsx     - Category management (per group)
    expenses/page.tsx       - Expense creation/editing (per group)
    activity/page.tsx       - Activity audit log
    settings/page.tsx       - User profile and avatar
    invite/[id]/page.tsx    - Accept invite by link
  components/
    Navbar.tsx              - Sticky navigation (desktop + mobile)
    LedgerCard.tsx          - Card container and Money component
    Avatar.tsx              - User avatar with initials fallback
    SettleUpModal.tsx       - Record a settlement payment
    ThemeProvider.tsx       - Light/dark mode context
    Toast.tsx               - Toast notifications
  lib/
    supabase.ts             - Supabase client
    balances.ts             - Net balance + debt-simplification math
    utils.ts                - Utility functions (currency, formatting)
  types/
    index.ts                - TypeScript interfaces
supabase/
  schema.sql               - Database schema and RLS policies
  MIGRATION_NOTES.md        - Migration notes
```

## License

MIT
