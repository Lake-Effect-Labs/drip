# Quick Fix Guide - Resolving Build Errors

## Problem
Next.js build fails with error:
```
You're importing a component that needs "next/headers". That only works in a Server Component...
```

## Root Cause
Client components ("use client") are importing `@drip/core/database/server`, which uses `next/headers`.

## Solution

### Step 1: Find Problematic Files
```bash
cd apps/matte

# Find all "use client" components importing server code
grep -l "\"use client\"" src/**/*.tsx | while read file; do
  if grep -q "@drip/core/database/server" "$file"; then
    echo "$file"
  fi
done
```

### Step 2: Fix Each File

For each file found, update the imports:

**BEFORE:**
```typescript
"use client";
import { createClient } from "@drip/core/database/server";
```

**AFTER:**
```typescript
"use client";
import { createClient } from "@drip/core/database/client";
```

### Step 3: Handle Edge Cases

#### Case 1: Component Needs Both Client and Server
If a component needs server data but has "use client":

**Option A: Split the Component**
```typescript
// app/jobs/[id]/page.tsx (Server Component - no "use client")
import { createClient } from "@drip/core/database/server";
import { JobDetail } from "@/components/app/jobs/job-detail-client";

export default async function JobPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", params.id).single();

  return <JobDetail job={job} />;
}

// components/app/jobs/job-detail-client.tsx
"use client";
export function JobDetail({ job }: { job: Job }) {
  // Client-side logic here
  return <div>{job.title}</div>;
}
```

**Option B: Use Server Actions**
```typescript
// app/jobs/actions.ts (Server Action)
"use server";
import { createClient } from "@drip/core/database/server";

export async function getJob(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
  return data;
}

// components/job-detail.tsx
"use client";
import { useEffect, useState } from "react";
import { getJob } from "@/app/jobs/actions";

export function JobDetail({ id }: { id: string }) {
  const [job, setJob] = useState(null);

  useEffect(() => {
    getJob(id).then(setJob);
  }, [id]);

  return <div>{job?.title}</div>;
}
```

#### Case 2: Auth Pages
Auth pages (login, signup, etc.) should use client:

```typescript
"use client";
import { createClient } from "@drip/core/database/client";
import { useState } from "react";

export default function LoginPage() {
  const supabase = createClient();

  const handleLogin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    // Handle response
  };

  return <form>...</form>;
}
```

### Step 4: Test Build
```bash
cd /home/user/drip
npm run build --workspace=apps/matte
```

If successful, you should see:
```
✓ Compiled successfully
```

### Step 5: Test Locally
```bash
npm run dev --workspace=apps/matte
```

Visit http://localhost:3000 and test:
- Login/logout
- Creating a job
- Viewing estimates
- Any other critical paths

## Common Files to Check

Based on the error messages, these files likely need fixing:

1. `apps/matte/src/app/app/jobs/new/page.tsx` ✅ (Already fixed)
2. `apps/matte/src/app/(auth)/login/page.tsx` ✅ (Already fixed)
3. `apps/matte/src/app/(auth)/signup/page.tsx` ✅ (Already fixed)
4. `apps/matte/src/app/(auth)/forgot-password/page.tsx` ✅ (Already fixed)
5. `apps/matte/src/app/(auth)/reset-password/page.tsx` ✅ (Already fixed)

Look for more with:
```bash
# From apps/matte directory
find src/app -name "*.tsx" -exec sh -c 'grep -q "\"use client\"" "$1" && grep -q "@drip/core/database/server" "$1" && echo "$1"' _ {} \;
```

## Automated Fix Script

Create a script to fix all at once:

```bash
#!/bin/bash
# fix-imports.sh

cd apps/matte

# Find and fix all "use client" files importing server code
find src -name "*.tsx" -o -name "*.ts" | while read file; do
  if grep -q "\"use client\"" "$file" && grep -q "@drip/core/database/server" "$file"; then
    echo "Fixing: $file"
    sed -i 's|@drip/core/database/server|@drip/core/database/client|g' "$file"
  fi
done

echo "Done! Now run: npm run build --workspace=apps/matte"
```

Run it:
```bash
chmod +x fix-imports.sh
./fix-imports.sh
```

## Verification Checklist

After fixing:
- [ ] Build succeeds (`npm run build --workspace=apps/matte`)
- [ ] No TypeScript errors
- [ ] Dev server starts (`npm run dev --workspace=apps/matte`)
- [ ] Can login
- [ ] Can view jobs board
- [ ] Can create a new job
- [ ] Can view customer list
- [ ] Matte AI assistant works (if using OpenAI)

## If Still Failing

### Check for Hidden Imports
Some imports might be indirect (through other files):

```bash
# Find all files importing server code
cd apps/matte
grep -r "@drip/core/database/server" src/
```

Check each result to see if it's:
1. A server component (pages without "use client") ✅ OK
2. An API route (`src/app/api/**/*.ts`) ✅ OK
3. A client component ("use client") ❌ NEEDS FIX

### Check Component Composition
Sometimes a server component imports a client component that imports server code:

```
page.tsx (server)
  → imports component-a.tsx (client)
    → imports component-b.tsx (also client, uses server code) ❌
```

Fix component-b.tsx to use client code or move data fetching up to page.tsx.

## Need More Help?

1. Check `IMPLEMENTATION_STATUS.md` for overall status
2. Review `ARCHITECTURE.md` for design decisions
3. Search for similar issues in Next.js discussions
4. Ask team for review

## Pro Tips

1. **Use Type Imports**: Importing only types never causes issues:
   ```typescript
   import type { Database } from "@drip/core/types";  // Always safe
   ```

2. **Prefer Server Components**: Keep "use client" minimal. Only add it when you need:
   - useState, useEffect, or other React hooks
   - Event handlers (onClick, onChange, etc.)
   - Browser APIs (window, localStorage, etc.)

3. **Data Fetching Pattern**:
   - Fetch in Server Component (page.tsx)
   - Pass as props to Client Component
   - Client Component handles interactivity

4. **Mutations**:
   - Use Server Actions for mutations
   - Call them from Client Components
   - Revalidate server data after mutations

---

Good luck! The fix should be straightforward once you identify all the problematic files.
