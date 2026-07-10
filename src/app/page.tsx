'use client';

import Link from 'next/link';
import { Wallet, Users, Tag, Receipt } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <span className="text-xl font-bold text-gray-900">SplitExpenses</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
              <span className="block">Split expenses</span>
              <span className="block text-indigo-600">effortlessly</span>
            </h1>
            <p className="mx-auto mt-3 max-w-md text-base text-gray-500 sm:text-lg md:mt-5 md:max-w-xl">
              Manage shared expenses with multiple profiles, real-time balances, and category-based splitting.
            </p>
            <div className="mx-auto mt-5 max-w-md sm:flex sm:justify-center md:mt-8">
              <div className="rounded-md shadow">
                <Link
                  href="/signup"
                  className="flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-8 py-3 text-base font-medium text-white hover:bg-indigo-700 md:py-4 md:px-10 md:text-lg"
                >
                  Get started
                </Link>
              </div>
              <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                <Link
                  href="/login"
                  className="flex items-center justify-center rounded-md border border-transparent bg-white px-8 py-3 text-base font-medium text-indigo-600 hover:bg-gray-50 md:py-4 md:px-10 md:text-lg"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-32 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-lg bg-white p-8 shadow">
              <Users className="mx-auto h-12 w-12 text-indigo-600" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Multiple profiles</h3>
              <p className="mt-2 text-gray-500">Create profiles for yourself, partner, roommates, or trips.</p>
            </div>
            <div className="rounded-lg bg-white p-8 shadow">
              <Tag className="mx-auto h-12 w-12 text-indigo-600" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Category splits</h3>
              <p className="mt-2 text-gray-500">Organize expenses by category with flexible split rules.</p>
            </div>
            <div className="rounded-lg bg-white p-8 shadow">
              <Receipt className="mx-auto h-12 w-12 text-indigo-600" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Real-time sync</h3>
              <p className="mt-2 text-gray-500">Balances update instantly across all devices.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
