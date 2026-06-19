// Module: qrcode
// Auto-extracted from admin.html
(function() {
  'use strict';
// --- from admin.html lines 1718-1870 ---
    // ====== 二维码 & 每日密钥 ======
    function effectiveDate(ch, cm) {
      var now = new Date();
      if (now.getHours() < ch || (now.getHours() === ch && now.getMinutes() < cm)) {
        return dateStr(new Date(now.getTime() - 86400000));
      }
      return dateStr(now);
    }
    function computeDailyCode(secret, sid, ch, cm) {
      var today = effectiveDate(ch != null ? ch : 2, cm != null ? cm : 0);
      var input = secret + '|' + sid + '|' + today;
      var hash = 5381;
      for (var i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
      }
      return Math.abs(hash).toString(36).substring(0, 6).toUpperCase();
    }

    window.saveDailyCodeEnabled = function() {
      var enabled = document.getElementById('dailyCodeEnabledCheck').checked;
      db.from('app_config').select('*').limit(1).single().then(function(r) {
        if (r.data) {
          return db.from('app_config').update({ daily_code_enabled: enabled }).eq('id', r.data.id);
        } else {
          return db.from('app_config').insert({ admin_password: getDefaultPwd(), daily_code_enabled: enabled });
        }
      }).then(function() {
        document.getElementById('dailyCodeEnabledLabel').textContent = enabled ? '已开启' : '已关闭';
        loadQRCodes();
      }).catch(function(e) {
        document.getElementById('dailyCodeEnabledCheck').checked = !enabled;
      });
    };

    window.saveSecret = function() {
      var val = document.getElementById('secretInput').value.trim();
      if (!val) { document.getElementById('secretMsg').textContent = '请输入密钥'; document.getElementById('secretMsg').style.color = '#f44336'; return; }
      db.from('app_config').select('*').limit(1).single().then(function(r) {
        if (r.data) {
          return db.from('app_config').update({ daily_secret: val }).eq('id', r.data.id);
        } else {
          return db.from('app_config').insert({ admin_password: getDefaultPwd(), daily_secret: val });
        }
      }).then(function() {
        document.getElementById('secretMsg').textContent = '密钥已保存';
        document.getElementById('secretMsg').style.color = '#4caf50';
        loadQRCodes();
      }).catch(function(e) {
        document.getElementById('secretMsg').textContent = '保存失败: ' + (e.message || '网络错误');
        document.getElementById('secretMsg').style.color = '#f44336';
      });
    };

    window.saveCutoff = function() {
      var h = parseInt(document.getElementById('cutoffHour').value, 10);
      var m = parseInt(document.getElementById('cutoffMinute').value, 10);
      if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
        document.getElementById('cutoffMsg').textContent = '请输入合法时间（时: 0-23，分: 0-59）';
        document.getElementById('cutoffMsg').style.color = '#f44336'; return;
      }
      db.from('app_config').select('*').limit(1).single().then(function(r) {
        if (r.data) {
          return db.from('app_config').update({ cutoff_hour: h, cutoff_minute: m }).eq('id', r.data.id);
        } else {
          return db.from('app_config').insert({ admin_password: getDefaultPwd(), cutoff_hour: h, cutoff_minute: m });
        }
      }).then(function() {
        document.getElementById('cutoffMsg').textContent = '已保存，隔天 ' + pad2(h) + ':' + pad2(m) + ' 后未签退记录自动作废';
        document.getElementById('cutoffMsg').style.color = '#4caf50';
      }).catch(function(e) {
        document.getElementById('cutoffMsg').textContent = '保存失败: ' + (e.message || '网络错误');
        document.getElementById('cutoffMsg').style.color = '#f44336';
      });
    };
    window.saveScheduleApi = function() {
      var url = document.getElementById('scheduleApiUrl').value.trim();
      var key = document.getElementById('scheduleApiKey').value.trim();
      db.from('app_config').select('*').limit(1).single().then(function(r) {
        if (r.data) {
          return db.from('app_config').update({ schedule_api_url: url || null, schedule_api_key: key || null }).eq('id', r.data.id);
        } else {
          return db.from('app_config').insert({ admin_password: getDefaultPwd(), schedule_api_url: url || null, schedule_api_key: key || null });
        }
      }).then(function() {
        document.getElementById('scheduleApiMsg').textContent = '已保存';
        document.getElementById('scheduleApiMsg').style.color = '#4caf50';
      }).catch(function(e) {
        document.getElementById('scheduleApiMsg').textContent = '保存失败: ' + (e.message || '网络错误');
        document.getElementById('scheduleApiMsg').style.color = '#f44336';
      });
    };
    function pad2(n) { return ('0' + n).slice(-2); }

    window.loadQRCodes = function() {
      document.getElementById('qrContainer').innerHTML = '<div class="loading">加载中</div>';
      // 加载门店和密钥
      Promise.all([
        db.from('store').select('*').order('store_id'),
        db.from('app_config').select('*').limit(1).single()
      ]).then(function(_refA) {
        var stores = (_refA[0].data || []).filter(function(s) { return s.store_id !== 'unassigned'; });
        if (window._adminStoreId) {
          stores = stores.filter(function(s) { return s.store_id === window._adminStoreId; });
        }
        var configData = _refA[1].data;
        window._stores = window._stores || stores;

        var secret = (configData && configData.daily_secret) || '';
        var dailyCodeEnabled = configData && configData.daily_code_enabled !== false; // 默认开启
        var cutoffH = (configData && configData.cutoff_hour != null) ? configData.cutoff_hour : 2;
        var cutoffM = (configData && configData.cutoff_minute != null) ? configData.cutoff_minute : 0;
        document.getElementById('cutoffHour').value = cutoffH;
        document.getElementById('cutoffMinute').value = cutoffM;
        document.getElementById('scheduleApiUrl').value = (configData && configData.schedule_api_url) || '';
        document.getElementById('scheduleApiKey').value = (configData && configData.schedule_api_key) || '';
        // 每日变化开关状态
        document.getElementById('dailyCodeEnabledCheck').checked = dailyCodeEnabled;
        document.getElementById('dailyCodeEnabledLabel').textContent = dailyCodeEnabled ? '已开启' : '已关闭';
        // 每日变化开关关闭时，隐藏打卡链接和说明文字
        document.getElementById('dailyCodeInfo').style.display = dailyCodeEnabled ? '' : 'none';
        if (!secret) {
          document.getElementById('secretSetup').style.display = '';
        } else {
          document.getElementById('secretSetup').style.display = 'none';
          document.getElementById('secretInput').value = secret;
        }

        var baseUrl = location.origin + location.pathname.replace(/admin\.html$/, 'index.html');
        if (stores.length === 0) {
          document.getElementById('qrContainer').innerHTML = '<div class="empty-state">暂无门店</div>';
          return;
        }
        var html = stores.map(function(s) {
          var code = (dailyCodeEnabled && secret) ? computeDailyCode(secret, s.store_id, s.cutoff_hour, s.cutoff_minute) : '';
          var qrUrl = baseUrl + '?store=' + s.store_id + (code ? '&code=' + code : '');
          return '<div class="qr-card"><h4>' + escHtml(s.name) + '</h4>' +
            '<div id="qr-' + s.store_id + '"></div>' +
            '<button class="btn-outline" onclick="downloadQR(\'qr-' + s.store_id + '\',\'' + s.store_id + '.png\',\'' + escJs(s.name) + '\')" style="margin-top:8px;font-size:12px;padding:6px 14px">下载二维码</button>' +
            '</div>';
        }).join('');
        document.getElementById('qrContainer').innerHTML = html;
        setTimeout(function() {
          stores.forEach(function(s) {
            var code = secret ? computeDailyCode(secret, s.store_id, s.cutoff_hour, s.cutoff_minute) : '';
            var el = document.getElementById('qr-' + s.store_id);
            if (el) new QRCode(el, {
              text: baseUrl + '?store=' + s.store_id + (code ? '&code=' + code : ''),
              width: 180, height: 180, colorDark: '#000', colorLight: '#fff'
            });
          });
        }, 100);
      });
    }
// --- from admin.html lines 1905-1973 ---
    window.downloadQR = function(wrapperId, filename, title, subtitle) {
      var el = document.getElementById(wrapperId);
      if (!el) return;
      // 如果没传标题，尝试从父卡片读取
      if (!title) {
        var card = el.closest('.qr-card');
        if (card) { var h4 = card.querySelector('h4'); if (h4) title = h4.textContent.trim(); }
      }
      var srcCanvas = el.querySelector('canvas');
      var srcImg = el.querySelector('img');
      if (!srcCanvas && !srcImg) return;
      var srcW = srcCanvas ? srcCanvas.width : srcImg.naturalWidth;
      var srcH = srcCanvas ? srcCanvas.height : srcImg.naturalHeight;
      var hasTitle = !!title;
      var hasSub = !!subtitle;
      var topH = hasTitle ? 50 : 0;
      var bottomH = hasSub ? 32 : 0;
      var padding = 28;
      var cardW = srcW + padding * 2;
      var cardH = topH + srcH + bottomH + padding * 2;
      var resultCanvas = document.createElement('canvas');
      var ctx = resultCanvas.getContext('2d');
      resultCanvas.width = cardW;
      resultCanvas.height = cardH;
      // 白色卡片背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cardW, cardH);
      // 圆角边框效果
      ctx.strokeStyle = '#e8ecf1';
      ctx.lineWidth = 1;
      roundRect(ctx, 2, 2, cardW - 4, cardH - 4, 14);
      ctx.stroke();
      // 标题
      if (hasTitle) {
        ctx.fillStyle = '#222';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, cardW / 2, topH / 2);
      }
      if (srcCanvas) {
        ctx.drawImage(srcCanvas, padding, topH, srcW, srcH);
      } else {
        ctx.drawImage(srcImg, padding, topH, srcW, srcH);
      }
      if (hasSub) {
        ctx.fillStyle = '#999';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(subtitle, cardW / 2, topH + srcH + bottomH / 2);
      }
      var a = document.createElement('a');
      a.href = resultCanvas.toDataURL('image/png');
      a.download = filename; a.click();
    };
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }
})();
