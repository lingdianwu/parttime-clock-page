// ============================================
// 数据源配置 — GitHub Pages 版
// ============================================
window.DATA_BACKEND = 'mysql';

// NAS PartTimeClock 后端公网地址
var PTC_BASE = 'https://csjy.site/checkin-new/';

// ============================================
// 排班 API（Project 系统）
// ============================================
var SCHEDULE_CONFIG = {
  apiUrl: 'https://csjy.site',
  apiKey: 'YOUR_API_KEY'
};

var CHECKIN_BASE_URL = 'https://YOUR_USERNAME.github.io/parttime-clock-page/index.html';
var SCHEDULE_PROXY_URL = 'https://csjy.site';

// ============================================
// 数据客户端
// ============================================
var db = new PTCClient(PTC_BASE);
