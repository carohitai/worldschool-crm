# The World School CRM

Parent Connect CRM for The World School — daily parent-call targets for teachers, call disposition logging, and leadership dashboards. Built with Next.js (App Router) and Supabase (PostgreSQL, Auth, RLS).

## Features (Phase 1: Parent Connect)

- **Today's Calls** — each teacher gets a daily call list built from their class, priority students first, then least-recently-contacted families.
- **Call logging** — outcome (reached / not reached / callback), topics discussed, parent sentiment, duration, summary, and follow-up action items.
- **Dashboard** (coordinator/admin) — target completion by teacher, families contacted, open action items, negative-sentiment alerts, recent call feed.
- **Families** — searchable family records with students, parents, and a full communication timeline.
- Schema is ready for the next phases: Linkus (Yeastar) call recordings/transcripts and WhatsApp Business API messaging.

## Setup

1. Create a Supabase project and apply the `parent_connect_core_schema` migration (see the project's Supabase migration history).
2. Copy `.env.example` to `.env.local` and fill in your Supabase URL and publishable key.
3. `npm install && npm run dev`

## Staff accounts

Create users in Supabase Auth with the same email as their row in the `staff` table — the account links automatically on first login. Roles: `admin`, `coordinator`, `teacher`, `front_office`.

## Data safety

Never commit `.env.local`, database exports, or any parent/student data to this repository.
