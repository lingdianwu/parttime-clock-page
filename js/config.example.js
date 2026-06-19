// ============================================
// Supabase 配置 — 替换为你的 Supabase 项目信息
// ============================================
var SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'sb_publishable_YOUR_ANON_KEY'
};

var db = supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);

// ============================================
// 排班 API 配置
// ============================================
var SCHEDULE_CONFIG = {
  apiUrl: 'https://YOUR_SERVER_URL',
  apiKey: 'YOUR_API_KEY'
};

// ============================================
// 同步引擎（Edge Function）
// ============================================
var EDGE_FUNCTION_URL = 'https://YOUR_PROJECT.supabase.co/functions/v1/sync-handler';
