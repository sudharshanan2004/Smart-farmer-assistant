const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

let supabase = null;

const url = (process.env.SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_ANON_KEY || "").trim();

// Only initialize Supabase if both URL and Key are explicitly provided.
// Otherwise, the backend runs completely in local mode (local files / local MongoDB).
if (url && key) {
  try {
    supabase = createClient(url, key);
  } catch (err) {
    console.warn("⚠️ Could not initialize Supabase, running in local mode:", err.message);
    supabase = null;
  }
}

module.exports = supabase;