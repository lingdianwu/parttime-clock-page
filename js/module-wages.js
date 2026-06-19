// Module: wages
// Auto-extracted from admin.html
(function() {
  'use strict';
// --- from admin.html lines 1283-1351 ---
    // ====== 时薪 ======
    window.saveWage = function(id) {
      var wage = document.getElementById('wage-' + id).value;
      if (wage === '') {
        db.from('check_record').update({ hourly_wage: null, _sync_origin: 'local', _sync_ts: new Date().toISOString() }).eq('id', id)
          .then(function() { loadRecords(); }).catch(function(e) { alert('保存失败: ' + e.message); });
      } else {
        var val = parseFloat(wage);
        if (isNaN(val) || val < 0) { alert('请输入有效时薪'); return; }
        db.from('check_record').update({ hourly_wage: val, _sync_origin: 'local', _sync_ts: new Date().toISOString() }).eq('id', id)
          .then(function() { loadRecords(); }).catch(function(e) { alert('保存失败: ' + e.message); });
      }
    };

    // ====== 点位时薪 ======
    window.populateWageStores = function() {
      var s = document.getElementById("wageStore"); if (!s) return;
      s.innerHTML = '<option value="">选择门店</option>' + (window._stores || []).filter(function(x) { return x.store_id !== "unassigned" && hasStorePt(x.store_id); }).map(function(x) { return '<option value="' + x.store_id + '">' + x.name + '</option>'; }).join('');
    }
    window.loadLocationWages = function() {
      var sid = document.getElementById("wageStore").value;
      var sel = document.getElementById("wageLocation");
      var list = document.getElementById("locationWageList");
      if (!sid) { sel.innerHTML = '<option value="">选择点位</option>'; list.innerHTML = '<div style="color:#999;text-align:center;padding:20px">选择门店查看</div>'; return; }
      var store = (window._stores || []).find(function(s) { return s.store_id === sid; });
      var storeName = store ? (store.schedule_store_name || store.name) : '';
      if (!storeName) { sel.innerHTML = '<option value="">选择点位</option>'; list.innerHTML = '<div style="color:#d94e4e">门店未配置排班门店名</div>'; return; }
      list.innerHTML = '<div style="color:#999;text-align:center;padding:20px">加载中</div>';

      var locApi = (SCHEDULE_CONFIG.apiUrl || '') + '/api/public/location?key=' + encodeURIComponent(SCHEDULE_CONFIG.apiKey || 'schedule2026') + '&storeName=' + encodeURIComponent(storeName);
      Promise.all([
        fetch(locApi, { headers: { 'ngrok-skip-browser-warning': '1' } }).then(function(r) { return r.json(); }),
        db.from("location_wage").select("*").eq("store_id", sid).order("location")
      ]).then(function(results) {
        var locData = results[0] || {};
        var wageRows = (results[1].data || []);
        var locs = {};
        (locData.locations || []).forEach(function(l) { if (l) locs[l] = true; });
        wageRows.forEach(function(w) { if (w.location) locs[w.location] = true; });
        var allLocs = Object.keys(locs).sort();
        sel.innerHTML = '<option value="">选择点位</option>' + allLocs.map(function(l) { return '<option value="' + escHtml(l) + '">' + escHtml(l) + '</option>'; }).join('');

        var wageMap = {};
        wageRows.forEach(function(w) { wageMap[w.location] = w; });
        if (allLocs.length === 0) { list.innerHTML = '<div style="color:#999;text-align:center;padding:20px">暂无点位，请先在门店管理中新增点位</div>'; return; }
        list.innerHTML = '<table class="roster-table"><thead><tr><th>点位</th><th>时薪(元/小时)</th><th>操作</th></tr></thead><tbody>' + allLocs.map(function(loc) {
          var w = wageMap[loc];
          return '<tr><td>' + escHtml(loc) + '</td><td>' + (w ? escHtml(w.hourly_wage) : '<span style="color:#999">未设置</span>') + '</td><td>' + (w ? '<button class="btn-danger" onclick="delLocationWage(\'' + w.id + '\')">删除</button>' : '-') + '</td></tr>';
        }).join('') + '</tbody></table>';
      }).catch(function() {
        sel.innerHTML = '<option value="">选择点位</option>';
        list.innerHTML = '<div style="color:#d94e4e">加载失败，请检查排班系统点位接口</div>';
      });
    };
    window.saveLocationWage = function() {
      var sid = document.getElementById("wageStore").value;
      var locSel = document.getElementById("wageLocation");
      var locs = Array.from(locSel.selectedOptions).filter(function(o) { return o.value; }).map(function(o) { return o.value; });
      var rate = parseFloat(document.getElementById("wageRate").value);
      if (!sid || locs.length === 0) { alert("请选择门店和点位"); return; }
      if (isNaN(rate) || rate < 0) { alert("请输入有效时薪"); return; }
      var promises = locs.map(function(loc) {
        return db.from("location_wage").upsert({ store_id: sid, location: loc, hourly_wage: rate }, { onConflict: "store_id,location" });
      });
      Promise.all(promises).then(function(results) {
        var err = results.find(function(r) { return r.error; });
        if (err) throw err.error;
        document.getElementById("wageRate").value = "";
        loadLocationWages();
      }).catch(function(e) { alert("保存失败: " + (e.message || "网络错误")); });
    };
    window.delLocationWage = function(id) {
      if (!confirm("确认删除？")) return;
      db.from("location_wage").delete().eq("id", id).then(function(r) {
        if (r.error) throw r.error;
        loadLocationWages();
      }).catch(function(e) { alert("删除失败: " + (e.message || "网络错误")); });
    };
})();
