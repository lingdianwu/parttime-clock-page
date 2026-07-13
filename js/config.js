// ============================================
// 数据源配置
// GitHub Pages 静态页 → NAS PartTimeClock MySQL API
// ============================================
window.DATA_BACKEND = 'mysql';

// NAS 打卡后端（Caddy 反代 /checkin-new → PartTimeClock Node.js）
var PTC_BASE = 'https://csjy.site/checkin-new/';

// ============================================
// 排班 API（对接 Project）
// ============================================
var SCHEDULE_CONFIG = {
  apiUrl: 'https://csjy.site',
  apiKey: 'schedule2026'
};

var CHECKIN_BASE_URL = 'https://lingdianwu.github.io/parttime-clock-page/index.html';
var SCHEDULE_PROXY_URL = 'https://csjy.site';

// ============================================
// 数据客户端（PTCClient 替代 Supabase SDK）
// ============================================
if (typeof PTCClient === 'undefined') {
  console.error('[config] DATA_BACKEND=mysql 但未加载 api.js');
}
var db = new PTCClient(PTC_BASE);
