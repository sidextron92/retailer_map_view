# Retailer Map View - Field Agent App

A mobile-first web application built with Next.js that allows field agents to view retailers on an interactive map, filter them by various criteria, and navigate to their locations.

## Features

- **Interactive Map**: Powered by Mapbox GL JS with smooth WebGL rendering
- **Color-Coded Markers**: Priority-based color system (payment status > activity > scheduled visits > category)
- **Advanced Filtering**: Filter by category, status, payment, visit dates, and search
- **Retailer Details**: Click markers to view detailed information in a modal
- **Google Maps Integration**: One-click navigation to any retailer location
- **Mobile Optimized**: Touch-friendly UI with responsive design
- **Real-time Data**: Connected to Supabase for live data updates

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Map Library**: Mapbox GL JS v3 + react-map-gl
- **Database**: Supabase (PostgreSQL + PostGIS)
- **State Management**: Zustand
- **UI Components**: shadcn/ui + Tailwind CSS
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+ and npm/pnpm
- Supabase account ([sign up](https://supabase.com))
- Mapbox account ([sign up](https://account.mapbox.com/auth/signup/))

## Getting Started

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd retailer_map_view
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to your project's SQL Editor
3. Copy and run the SQL from `supabase/migrations/001_initial_schema.sql`
4. Get your credentials from Project Settings > API:
   - Project URL
   - Anon/public key

### 3. Set Up Mapbox

1. Sign up at [mapbox.com](https://account.mapbox.com/auth/signup/)
2. Go to Access Tokens
3. Copy your default public token (starts with `pk.`)

### 4. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# Mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 5. Add Sample Data

In your Supabase SQL Editor, run:

```sql
INSERT INTO retailers (name, address, latitude, longitude, category, payment_status, is_active) VALUES
  ('Joe''s Pizza', '123 Main St, San Francisco, CA', 37.7749, -122.4194, 'restaurant', 'paid', true),
  ('Corner Store', '456 Market St, San Francisco, CA', 37.7849, -122.4094, 'retail', 'pending', true),
  ('Wholesale Depot', '789 Mission St, San Francisco, CA', 37.7949, -122.3994, 'wholesale', 'overdue', false);
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main map page
│   └── globals.css        # Global styles
├── components/
│   ├── map/               # Map components
│   │   └── MapView.tsx
│   ├── modals/            # Modal components
│   │   └── RetailerDetailModal.tsx
│   └── ui/                # shadcn/ui components
├── hooks/                 # Custom React hooks
│   ├── useRetailers.ts
│   └── useGeolocation.ts
├── lib/
│   ├── supabase/          # Supabase client & types
│   ├── mapbox/            # Map configuration
│   └── utils/             # Utility functions
├── store/                 # Zustand stores
│   └── filterStore.ts
└── types/                 # TypeScript types
    ├── retailer.ts
    └── filter.ts
```

## Key Files

- **Database Schema**: `supabase/migrations/001_initial_schema.sql`
- **Map Component**: `src/components/map/MapView.tsx`
- **Retailer Modal**: `src/components/modals/RetailerDetailModal.tsx`
- **Filter Logic**: `src/lib/utils/filters.ts`
- **Marker Colors**: `src/lib/utils/markers.ts`

## Color-Coding System

Markers are colored based on priority:

1. **Red** - Overdue payment (highest priority)
2. **Gray** - Inactive retailer
3. **Orange** - Scheduled visit in next 2 days
4. **Category Colors** (default):
   - Restaurant: Red (#E74C3C)
   - Retail: Blue (#3498DB)
   - Wholesale: Green (#2ECC71)
   - Pharmacy: Purple (#9B59B6)
   - Other: Gray (#95A5A6)

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add environment variables in Project Settings
4. Deploy!

## Troubleshooting

### Map not loading

- Verify NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is set correctly
- Check browser console for errors
- Ensure token is a public token (starts with `pk.`)

### No retailers showing

- Run the database migration SQL
- Add sample data to the retailers table
- Check Supabase credentials in .env.local
- Verify network requests in browser DevTools

### Build errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

## Future Enhancements

- [ ] User authentication (Supabase Auth)
- [ ] Filter UI panel
- [ ] Route planning for multiple retailers
- [ ] Photo uploads for retailers
- [ ] Analytics dashboard
- [ ] Offline support (PWA)
- [ ] Export data (CSV/PDF)

## Cost Analysis

With <28,000 map loads/month, you'll stay within free tiers:

- **Mapbox**: Free (100k loads/month)
- **Supabase**: Free (500MB database)
- **Vercel**: Free (100GB bandwidth)

**Total Monthly Cost**: $0

## License

MIT

## Support

For issues or questions, please open an issue on GitHub or refer to the [implementation plan](/.claude/plans/memoized-booping-floyd.md).
