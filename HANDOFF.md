# PromptIt — Handoff Document
**Session date:** 30 April 2026  
**Prepared for:** Mac session (share extension day)

---

## What was done this session

### Auth flow — fixed
- `app/_layout.tsx` was the bare Expo template with no auth logic
- `app/login.tsx` had the auth code but no UI — files were effectively swapped
- **Fixed:** `_layout.tsx` now handles auth with session listener + proper cleanup
- **Fixed:** `login.tsx` is now a real login/signup screen matching the design system
- **Fixed:** `app/(tabs)/_layout.tsx` had a redundant manual auth check — removed

### Database schema — migrated
Ran `supabase/migrations/001_missing_schema.sql` successfully. Added:

| What | Why |
|---|---|
| `extraction_cache` table | Edge function was failing silently — no table to cache results in |
| `collection_prompts` table | "+ Save" on Discover feed was broken — no table to write to |
| `profiles.display_name`, `.bio`, `.avatar_url` columns | Profile screen was reading/writing non-existent columns |
| `prompts.save_count` column + trigger | Trending sort now tracks real saves |
| Auto-create profile on signup trigger | New users were getting stuck on username screen — UPDATE hit 0 rows |
| Profiles RLS policies | Read all, write own |

---

## Current app state

### What's working
- Auth: login → username picker → onboarding → tabs
- All 5 tabs fully built with real Supabase data
- AI extraction: paste URL → edge function → Whisper/GPT → extracted prompt (TikTok via RapidAPI, Reddit audio, YouTube captions)
- My Prompts: search, filter, edit, delete, copy, public/private toggle
- Collections: create, delete, save prompts to collections
- Discover feed: For You / Trending / New tabs, platform filters, search
- Profile: avatar upload, edit display name/bio/username, stats

### Known limitations
- **Instagram**: no video transcription (no free API) — falls back to page metadata only. Works but extraction quality is lower.
- **Share extension**: not built yet — this is tomorrow's work

### Tech stack
- React Native + Expo Router (file-based routing)
- Supabase (project: `mfiqwintxbfuyaysqupu`)
- Edge function: `supabase/functions/extract-prompt/index.ts` (deployed)
- TypeScript throughout
- Ionicons for tab bar icons
- Design: dark navy `#08080F`, purple `#7C6FFF`

---

## Mac session plan

### 1. Set up git + GitHub (do this first)
The project has no git repo yet. On the Mac:
```bash
cd /path/to/PromptIt
git init
git add .
git commit -m "Initial commit"
# Create a private repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/promptit.git
git push -u origin main
```

### 2. Share extension (the main work)
The iOS share extension lets users tap Share in TikTok/Instagram → PromptIt → extraction happens automatically. No copy/paste needed.

**What it needs:**
- A native iOS app extension target (Swift)
- App Groups entitlement so the extension can pass the URL to the main app
- Expo config plugin to wire it into the managed workflow
- EAS Build to compile (can't use Expo Go for extensions)

**The flow:**
1. User taps Share on any video → taps PromptIt in share sheet
2. Extension captures the URL
3. Writes URL to shared App Group storage
4. Opens main app which reads the URL and auto-triggers extraction

**Ask Claude Code on the Mac to build the share extension** — it can write the Swift code, config plugin, and App Groups config. Give it this handoff doc for context.

### 3. EAS Build → TestFlight
After share extension is built:
```bash
eas build --platform ios --profile production
eas submit --platform ios
```

Requires Apple credentials filled into `eas.json` (see below).

---

## Outstanding non-code tasks (you need to do these)

### Apple credentials — fill into `eas.json`
Three placeholders need real values:
- `appleId` — your Apple Developer account email
- `ascAppId` — numeric ID from App Store Connect (create the app first at appstoreconnect.apple.com → My Apps → + New App)
- `appleTeamId` — 10-char string at developer.apple.com → Account → Membership Details

### App icon
A 1024×1024 PNG icon has been designed (purple folder/chat/sparkle). 
- Save it as `assets/images/icon.png` (replace the current placeholder)
- Confirm no transparency/alpha channel (Apple rejects icons with alpha)

### Privacy policy URL
The in-app privacy screen exists at `app/privacy.tsx`. Apple also needs a public URL:
1. Create a Notion page, paste the privacy policy text, publish publicly
2. Copy the URL — add it to your App Store Connect listing

---

## Key files reference

```
app/
  _layout.tsx          — root layout, auth gate, session listener
  login.tsx            — login/signup screen
  username.tsx         — username picker (new users)
  onboarding.tsx       — 3-slide intro (new users)
  privacy.tsx          — privacy policy screen
  (tabs)/
    _layout.tsx        — tab bar with Ionicons
    index.tsx          — Discover feed
    myprompts.tsx      — personal library
    save.tsx           — URL paste + AI extraction
    collections.tsx    — folders
    profile.tsx        — user profile
  components/
    design.ts          — colour tokens
    OpenInAI.tsx       — "Open in ChatGPT/Claude" button
    SaveToCollection   — bottom sheet for saving to collections
  lib/
    supabase.js        — Supabase client

supabase/
  functions/
    extract-prompt/index.ts   — edge function (deployed)
  migrations/
    001_missing_schema.sql    — ran today, all good

app.json              — bundle ID: com.promptit.app, EAS project ID set
eas.json              — build config, needs Apple credentials
```

---

## Supabase
- Project URL: `https://mfiqwintxbfuyaysqupu.supabase.co`
- Edge function `extract-prompt` is deployed and live
- All migrations ran successfully as of 30 April 2026
