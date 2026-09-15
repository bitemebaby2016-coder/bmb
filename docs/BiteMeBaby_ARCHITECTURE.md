# System Architecture

## Overview

Bite Me Baby เป็นระบบ Cloud Kitchen Operating Platform ที่สร้างด้วยเทคโนโลยีสมัยใหม่ แบ่งออกเป็นหลายเลเยอร์:

1. **Presentation Layer** (React + Vite)
2. **State Management Layer** (Zustand)
3. **Data Access Layer** (localStorage wrapper + Supabase client)
4. **Service Layer** (AI, Utilities, SEO)
5. **Routing Layer** (React Router)

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | React 18 + TypeScript | UI และ Logic |
| Build Tool | Vite | Dev server และ bundling |
| Styling | Tailwind CSS | Utility-first CSS |
| State Management | Zustand | Global state (cart, auth, rewards, inventory) |
| Routing | React Router DOM v7 | Client-side routing |
| AI Service | OpenRouter API (Gemini 2.0 Flash Lite) | Conversational AI |
| Storage | localStorage (wrapped) + Supabase (planned) | Data persistence |
| Icons | SVG + WebP | UI assets |
| Fonts | Nunito, Quicksand (Google Fonts) | Typography |

## Directory Structure

```
src/
├── components/        # UI Components (reuse)
│   ├── ai/            # AI-related components (Avatar, Floating button)
│   ├── layout/        # Layout components (Header, Footer, Nav)
│   ├── ui/            # Shared UI (Toast, Placeholder)
│   ├── FoodMenuCard.tsx # 3D Floating product card (PLANNED)
│   ├── ...            # domain-specific components (menu, order, etc.)
├── pages/             # Page components (mapped to routes)
├── lib/               # Service modules and API wrappers
│   ├── bmbAdminApi_*.ts  # Admin API wrappers (localStorage based)
│   ├── aiService.ts      # OpenRouter integration
│   ├── seo.ts            # SEO meta tags generator
│   ├── storage.ts        # localStorage wrapper
│   ├── supabase.ts       # Supabase client (not fully used yet)
│   ├── utils.ts          # Helper functions
│   └── bmbStorage.ts     # Core storage layer
├── store/             # Zustand stores
│   ├── authStore.ts      # Authentication & loyalty
│   ├── cartStore.ts      # Shopping cart
│   ├── inventoryStore.ts # Inventory management (admin)
│   └── rewardsStore.ts   # Loyalty & gamification
├── services/           # Domain services (PLANNED)
├── types/             # TypeScript interfaces
│   └── index.ts        # All type definitions
├── App.tsx            # Root router and layout
├── main.tsx           # Entry point
└── vite-env.d.ts      # Vite type definitions
```

## Data Flow

### 1. User Interaction → State Update → Persistence

```
User Action (UI)
        ↓
Component Event Handler
        ↓
Zustand Store Action (e.g., addItem in cartStore)
        ↓
Store Updates State
        ↓
Middleware: store subscribes to changes → persists to localStorage
        ↓
UI Re-renders from updated state (via useStore selector)
```

### 2. Data Retrieval on App Start

```
App Initialization
        ↓
Store's `checkAuth` or init effects
        ↓
Read from localStorage via storageGet
        ↓
Populate store state
        ↓
UI renders with hydrated data
```

### 3. API Calls (Admin Operations)

```
Admin Action (UI)
        ↓
Component calls bmbAdminApi_* function
        ↓
Function reads/writes via storageGet/storageSet
        ↓
Data persisted in localStorage under bmb_* keys
        ↓
Related stores may re-fetch if subscribed (via useEffect in components)
```

### 4. AI Conversation Flow

```
User Types Message
        ↓
Input → chatWithAI(userMessage)
        ↓
Function builds message history + system prompt
        ↓
POST to OpenRouter API
        ↓
Stream/response received
        ↓
Update conversation history in module-level variable
        ↓
Return response to UI
        ↓
UI displays AI message
```

## Key Architectural Decisions

### 1. localStorage as Primary Data Store (Dev Phase)
- Reason: Simplify development, avoid Supabase setup early
- Trade-off: Not persistent across browsers/devices, cleared on cache clear
- Migration path: Replace storageGet/storageSet with Supabase calls

### 2. Zustand for State Management
- Chosen for simplicity, minimal boilerplate
- Persisted via store subscription
- Each store handles its own persistence logic

### 3. Component-Based Architecture
- Reusable UI components in `components/ui` and domain-specific
- Pages compose components and fetch data via stores
- Layout provides consistent header/footer/navigation

### 4. Separation of Concerns
- lib/: Service integrations and API wrappers
- store/: Application state
- types/: Shared TypeScript interfaces
- pages/: Route components
- components/: Reusable UI

## Security Considerations

- Passwords hashed via simple hash (NOT for production - should use bcrypt)
- API keys currently hardcoded in aiService.ts (🔴 P0 — ต้องย้ายเข้า `.env` ตาม GAP_ANALYSIS SEC-01)
- No CSRF protection (SPA context)

## References

- Source code: `src/` directory
- Storage layer: `src/lib/bmbStorage.ts`
- State stores: `src/store/`
- API wrappers: `src/lib/bmbAdminApi_*.ts`