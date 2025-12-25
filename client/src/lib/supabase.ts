import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Log for debugging (remove in production)
if (import.meta.env.DEV) {
  console.log("Supabase Config:", {
    url: supabaseUrl ? "✓ Set" : "✗ Missing",
    key: supabasePublishableKey ? "✓ Set" : "✗ Missing",
  });
}

if (!supabaseUrl || !supabasePublishableKey) {
  const errorMsg = `Missing Supabase environment variables:
  - VITE_SUPABASE_URL: ${supabaseUrl ? "✓" : "✗ Missing"}
  - VITE_SUPABASE_PUBLISHABLE_KEY: ${supabasePublishableKey ? "✓" : "✗ Missing"}
  
  Please create a .env file in the client/ directory with:
  VITE_SUPABASE_URL=your_supabase_url
  VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key`;
  
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// Client-side client with publishable key (safe to expose, respects RLS)
// Publishable keys are safe to use in browsers and mobile apps
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

