# Kindred

A private space for the people, memories, and moments that matter.

Built with Next.js, TypeScript, Supabase, PostgreSQL, and modern web APIs, Kindred connects memories to the people and relationships behind them — with privacy and controlled sharing at its core.

## Live Website

https://thekindredapp.vercel.app/

## Repository

https://github.com/SHAHENDA78/Kindred

## Overview

Kindred started from a simple question:

**What if memories could preserve more than just photos or short notes?**

Many of the memories we keep are reduced to photos or journal entries, while conversations, stories, personal details, and other meaningful moments can easily be forgotten.

There are already products in the journaling and family-story space, such as Day One and Storyworth. Instead of building another traditional journaling app, Kindred approaches memories as something connected to **people, relationships, and private circles**.

The core concept is:

**People → Memories → Relationships → Private Circles**

This makes a memory more than an isolated entry. It becomes part of a personal archive connected to the people behind it.

## Features

* Create memories and connect them to specific people
* Organize people into private Family Circles
* Share memories with selected people and circles
* Friend requests and private invitations
* Track joined and created circles
* Challenges and Ask Them features to encourage meaningful conversations
* Reminders to encourage creating new memories over time
* Scheduled and event-based push notifications
* Web Push notifications using VAPID
* WebAuthn biometric unlock with Face ID / Touch ID where supported
* Authentication with protected application routes
* PostgreSQL Row Level Security for database-level access control
* Installable PWA
* Offline-ready experience
* Responsive design for desktop and mobile
* Data export
* Real-time data synchronization

## Privacy & Security

Privacy is a core part of Kindred rather than something handled only in the frontend.

Kindred uses **PostgreSQL Row Level Security (RLS)** through Supabase to enforce data access at the database level.

Instead of relying only on frontend checks such as:

```text
if (userCanAccessMemory) {
  showMemory()
}
```

access policies are enforced by the database itself.

This helps ensure that users can only access records they are authorized to access, even if requests are made outside the normal UI flow.

Authentication and protected routes are handled through **Supabase Auth**, while relationship-based access is handled through database relationships and RLS policies.

## Notifications

Kindred uses the **Web Push API** with **VAPID** for browser push notifications.

Push subscriptions are stored securely and associated with the authenticated user.

Scheduled and event-based notifications are handled using **Supabase Edge Functions**.

The notification system is designed to support reminders such as encouraging users to create new memories or interact with people in their circles.

## WebAuthn

Kindred supports **WebAuthn-based biometric unlock** for supported devices and browsers.

This allows users to protect access to the application using platform authentication methods such as:

* Face ID
* Touch ID
* Windows Hello
* Other supported device biometrics

WebAuthn is used as an additional security layer for accessing the private archive.

## Progressive Web App

Kindred is built as an installable **Progressive Web App (PWA)**.

Users can install it directly from a supported browser and use it with an app-like experience on mobile and desktop devices.

The project also includes offline-ready behavior for supported parts of the application.

## Core Data Model

The application uses Supabase PostgreSQL with relational data connecting users, profiles, memories, people, circles, memberships, invitations, and push subscriptions.

Key areas include:

* **Profiles** — user identity, role, and account status
* **Memories** — private memories connected to their creator and related people
* **Circles** — private groups for sharing memories
* **Circle Members** — relationships between users and circles
* **Circle Invitations** — private invitations and membership requests
* **Push Subscriptions** — browser push subscription data associated with users

Access to private data is protected using PostgreSQL Row Level Security policies.

## Tech Stack

* Next.js
* React
* TypeScript
* Tailwind CSS
* Supabase
* PostgreSQL
* Supabase Auth
* PostgreSQL Row Level Security (RLS)
* Supabase Edge Functions
* Web Push API
* VAPID
* WebAuthn
* Progressive Web App (PWA)

## Getting Started

Clone the repository:

```bash
git clone https://github.com/SHAHENDA78/Kindred.git
```

Navigate to the project:

```bash
cd Kindred
```

Install dependencies:

```bash
npm install
```

Add the required environment variables to `.env.local`.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Run the development server:

```bash
npm run dev
```

Open the application:

```text
http://localhost:3000
```

## Supabase

Kindred uses Supabase for:

* Authentication
* PostgreSQL database
* Row Level Security
* Database relationships
* Edge Functions
* Push notification infrastructure

The notification Edge Function is located at:

```text
supabase/functions/send-nudge-notifications
```

The project also uses scheduled database jobs for notification processing.

## Project Structure

```text
Kindred/
├── src/
│   └── app/
├── supabase/
│   └── functions/
│       └── send-nudge-notifications/
├── public/
├── .env.local
├── package.json
└── README.md
```

## Product Approach

Kindred is built around a simple idea:

**Memories are not only things we write down. They are connected to people, relationships, conversations, and details we want to preserve.**

Instead of treating every memory as an isolated journal entry, Kindred creates a private space where memories can exist within the context of the people they belong to.

This approach influenced the product architecture, especially the relationship between:

**People → Memories → Circles → Permissions**

## What I Learned

Building Kindred went beyond building interfaces.

The project gave me hands-on experience with:

* Authentication and protected routes
* Relational database design
* PostgreSQL Row Level Security
* Privacy-focused application architecture
* User-to-user relationships
* Database permissions
* Push notification systems
* Supabase Edge Functions
* WebAuthn and biometric authentication
* Progressive Web Apps
* Offline-ready application behavior
* Product thinking and feature design
* Building a complete full-stack web application with Next.js and Supabase

## Contact

LinkedIn: https://www.linkedin.com/in/shahenda-shaheen-6a907423b

GitHub: https://github.com/SHAHENDA78

Email: [shahendashaheen1@gmail.com](mailto:shahendashaheen1@gmail.com)

