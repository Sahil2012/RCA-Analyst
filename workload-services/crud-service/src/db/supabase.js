const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");
const logger = require("../utils/logger");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error("SUPABASE_URL and SUPABASE_KEY must be set in environment");
  process.exit(1);
}

logger.info("Initializing Supabase client", { url: supabaseUrl?.substring(0, 20) + "..." });

// Node 20 lacks native WebSocket — pass the "ws" package as transport
const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: ws,
  },
});

logger.info("Supabase client initialized successfully");

module.exports = supabase;
