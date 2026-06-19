// ============================================
// Supabase 配置
// ============================================
var SUPABASE_CONFIG = {
  url: 'https://ciaddvqgcvpunemxoqmf.supabase.co',
  anonKey: 'sb_publishable_l2RM-Kf61YzSI65npYcnWg_ITK5Yf1U'
};

var db = supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);

// ============================================
// 排班 API 配置（从 app_config 加载）
// ============================================
var SCHEDULE_CONFIG = {
  apiUrl: 'https://ciaddvqgcvpunemxoqmf.supabase.co/functions/v1/schedule-proxy',
  apiKey: 'schedule2026'
};

// ============================================
// 同步引擎（Edge Function）
// ============================================
var EDGE_FUNCTION_URL = 'https://ciaddvqgcvpunemxoqmf.supabase.co/functions/v1/sync-handler';
