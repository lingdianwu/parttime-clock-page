// Module: stores
// Auto-extracted from admin.html
(function() {
  'use strict';
// --- from admin.html lines 924-1020 ---
    // ====== 门店管理 ======
    window.addStore = function() {
      var sid = document.getElementById('newStoreId').value.trim();
      var sname = document.getElementById('newStoreName').value.trim();
      var lat = parseFloat(document.getElementById('newStoreLat').value.trim());
      var lng = parseFloat(document.getElementById('newStoreLng').value.trim());
      if (!sid) { alert('请输入门店ID'); return; }
      if (!/^[a-z][a-z0-9_]*$/.test(sid)) { alert('门店ID只能用小写字母、数字、下划线'); return; }
      if (!sname) { alert('请输入门店名称'); return; }
      db.from('store').select('*').eq('store_id', sid).single()
        .then(function(r) {
          if (r.data) { alert('该门店ID已存在'); return Promise.reject('dup'); }
          var scheduleName = document.getElementById('newStoreSchedule').value.trim();
          return db.from('store').insert({
            store_id: sid, name: sname,
            lat: isNaN(lat) ? null : lat,
            lng: isNaN(lng) ? null : lng,
            cutoff_hour: parseInt(document.getElementById('newStoreCutoffH').value),
            cutoff_minute: parseInt(document.getElementById('newStoreCutoffM').value),
            schedule_store_name: scheduleName || null,
            gps_radius: parseInt(document.getElementById('newStoreRadius').value) || 200,
            _sync_origin: 'local', _sync_ts: new Date().toISOString()
          });
        }).then(function(res) {
          if (res && res.error) throw res.error;
          document.getElementById('newStoreId').value = '';
          document.getElementById('newStoreName').value = '';
          document.getElementById('newStoreLat').value = '';
          document.getElementById('newStoreLng').value = '';
          document.getElementById('newStoreSchedule').value = '';
          loadStores();
          // 同步门店到排班系统
          var schedName = sname;
          try {
            var schedInput = document.getElementById('newStoreSchedule');
            if (schedInput && schedInput.value.trim()) schedName = schedInput.value.trim();
          } catch(e) {}
          syncStoreToSchedule(schedName);
        }).catch(function(e) { if (e !== 'dup') alert('添加失败: ' + (e.message || '网络错误')); });
    };

    function syncStoreToSchedule(storeName) {
      var apiUrl = SCHEDULE_CONFIG.apiUrl;
      // 从数据库加载最新配置
      db.from('app_config').select('schedule_api_url,schedule_api_key').limit(1).single()
        .then(function(r) {
          if (r.data && r.data.schedule_api_url) apiUrl = r.data.schedule_api_url;
          var apiKey = (r.data && r.data.schedule_api_key) || SCHEDULE_CONFIG.apiKey;
          var url = apiUrl + '/api/public/stores?key=' + encodeURIComponent(apiKey);
          return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
            body: JSON.stringify({ name: storeName })
          });
        }).then(function(r) { return r && r.json(); })
        .then(function(data) {
          if (data && data.success) {
            // 门店已同步（data.storeId 可能是已有的或新建的）
          }
        }).catch(function() {
          // 静默失败，不影响主流程
        });
    }

    window.loadStoreList = function() {
      var stores = window._stores || [];
      if (stores.length === 0) {
        document.getElementById('storeListContainer').innerHTML = '<div class="empty-state">暂无门店</div>';
        return;
      }
      document.getElementById('storeListContainer').innerHTML =
        '<table class="store-table"><thead><tr><th>门店ID</th><th>名称</th><th>坐标</th><th>排班门店</th><th>打卡截止</th><th>GPS半径</th><th>时薪模式</th><th>操作</th></tr></thead><tbody>' +
        stores.map(function(s) {
          var ch = s.cutoff_hour != null ? ('0'+s.cutoff_hour).slice(-2) : '02';
          var cm = s.cutoff_minute != null ? ('0'+s.cutoff_minute).slice(-2) : '00';
          return '<tr>' +
            '<td>' + escHtml(s.store_id) + '</td>' +
            '<td><input type="text" id="sname-' + s.store_id + '" value="' + escHtml(s.name) + '" style="width:100px;padding:4px 8px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none"></td>' +
            '<td><input type="text" id="slat-' + s.store_id + '" value="' + (s.lat ? s.lat.toFixed(6) : '') + '" placeholder="纬度" style="width:80px;padding:4px 8px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none">' +
            '<input type="text" id="slng-' + s.store_id + '" value="' + (s.lng ? s.lng.toFixed(6) : '') + '" placeholder="经度" style="width:80px;padding:4px 8px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none"></td>' +
            '<td><input type="text" id="ssched-' + s.store_id + '" value="' + escHtml(s.schedule_store_name || '') + '" placeholder="排班门店名" style="width:120px;padding:4px 8px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none"></td>' +
            '<td>' +
            '<select id="sch-' + s.store_id + '" style="padding:4px 6px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none;background:#fff">' +
            [0,1,2,3,4,5,6,7,8].map(function(h) { return '<option value="' + h + '"' + (h === (s.cutoff_hour||2) ? ' selected' : '') + '>' + ('0'+h).slice(-2) + '</option>'; }).join('') +
            '</select> : ' +
            '<select id="scm-' + s.store_id + '" style="padding:4px 6px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none;background:#fff">' +
            ['00','30'].map(function(m) { return '<option value="' + m + '"' + (parseInt(m) === (s.cutoff_minute||0) ? ' selected' : '') + '>' + m + '</option>'; }).join('') +
            '</select></td>' +
            '<td><input type="number" id="sradius-' + s.store_id + '" value="' + (s.gps_radius || 200) + '" placeholder="米" style="width:60px;padding:4px 8px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none"></td>' +
            '<td><select id="swmode-' + s.store_id + '" style="padding:4px 6px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none;background:#fff"><option value="location"' + ((s.wage_mode||'location')==='location'?' selected':'') + '>点位时薪</option><option value="person"' + (s.wage_mode==='person'?' selected':'') + '>个人时薪</option></select></td>' +
            '<td>' +
            '<button class="btn-success" onclick="saveStore(\'' + s.store_id + '\')" style="margin-right:4px">保存</button>' +
            '<button class="btn-danger" onclick="delStore(\'' + s.store_id + '\')">删除</button></td>' +
            '</tr>';
        }).join('') + '</tbody></table>';
    }

// --- from admin.html lines 1196-1247 ---
    // ====== 点位管理 ======
    window.populateLocStores = function() {
      var s = document.getElementById('locStore');
      if (!s) return;
      s.innerHTML = '<option value="">选择门店</option>' + (window._stores||[]).filter(function(x){return x.store_id!=='unassigned' && hasStorePt(x.store_id)}).map(function(x){return '<option value="'+x.store_id+'">'+x.name+'</option>';}).join('');
    }
    window.loadLocationList = function() {
      var sid = document.getElementById('locStore').value;
      var list = document.getElementById('locationListContainer');
      if (!sid) { list.innerHTML = '<div style="color:#999;text-align:center;padding:12px">选择门店查看点位</div>'; return; }
      list.innerHTML = '<div class="loading">加载中</div>';
      db.from('store').select('schedule_store_name,name').eq('store_id',sid).single().then(function(sr){
        var storeName = (sr.data && sr.data.schedule_store_name) || (sr.data && sr.data.name) || '';
        if (!storeName) { list.innerHTML = '<div style="color:#999">门店不存在</div>'; return; }
        var apiUrl = (SCHEDULE_CONFIG.apiUrl||'')+'/api/public/location?key='+encodeURIComponent(SCHEDULE_CONFIG.apiKey||'schedule2026')+'&storeName='+encodeURIComponent(storeName);
        return fetch(apiUrl,{headers:{'ngrok-skip-browser-warning':'1'}}).then(function(r){return r.json();}).then(function(data){
          var locs = data.locations || [];
          if (locs.length === 0) { list.innerHTML = '<div style="color:#999;padding:12px">暂无点位，请在下方添加</div>'; return; }
          list.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + locs.map(function(l){
            return '<span style="background:#f0f4ff;color:#1a3e6f;padding:4px 10px;border-radius:6px;font-size:13px;display:inline-flex;align-items:center;gap:4px">'+escHtml(l)+' <a href="#" data-delstore="'+sid+'" data-delloc="'+l.replace(/"/g,'&quot;')+'" class="delloc-btn" style="color:#d94e4e;text-decoration:none;font-weight:700">x</a></span>';
          }).join('') + '</div>';
          if (!list._dellocBound) {
            list._dellocBound = true;
            list.addEventListener('click', function(e) {
              var a = e.target.closest('.delloc-btn');
              if (a) { e.preventDefault(); delLocationPt(a.dataset.delstore, a.dataset.delloc); }
            });
          }
        });
      }).catch(function(){ list.innerHTML = '<div style="color:#999">加载失败</div>'; });
    };
    window.addLocation = function() {
      var sid = document.getElementById('locStore').value;
      var name = document.getElementById('newLocName').value.trim();
      if (!sid||!name) { alert('请选择门店并输入点位名称'); return; }
      var store = (window._stores||[]).find(function(s){return s.store_id===sid;});
      if (!store) { alert('门店不存在'); return; }
      Promise.all([
        fetch((SCHEDULE_CONFIG.apiUrl||'')+'/api/public/location?key='+encodeURIComponent(SCHEDULE_CONFIG.apiKey||'schedule2026'),{
          method:'POST',headers:{'Content-Type':'application/json','ngrok-skip-browser-warning':'1'},
          body:JSON.stringify({storeName:store.schedule_store_name||store.name, location:name})
        }).then(function(r){return r.json();}),
        db.from('location_wage').upsert({store_id:sid, location:name, hourly_wage:18}, {onConflict:'store_id,location'})
      ]).then(function(results){
        if (results[0].success) { document.getElementById('newLocName').value=''; loadLocationList(); }
        else { alert('添加失败: '+(results[0].message||'')); }
      }).catch(function(){ alert('网络错误'); });
    };
    window.delLocationPt = function(sid, loc) {
      if (!confirm('确定删除点位 '+loc+' ？')) return;
      var store = (window._stores||[]).find(function(s){return s.store_id===sid;});
      if (!store) return;
      Promise.all([
        fetch((SCHEDULE_CONFIG.apiUrl||'')+'/api/public/location?key='+encodeURIComponent(SCHEDULE_CONFIG.apiKey||'schedule2026'),{
          method:'DELETE',headers:{'Content-Type':'application/json','ngrok-skip-browser-warning':'1'},
          body:JSON.stringify({storeName:store.schedule_store_name||store.name, location:loc})
        }).then(function(r){return r.json();}),
        db.from('location_wage').delete().eq('store_id',sid).eq('location',loc)
      ]).then(function(results){
        if (results[0].success) loadLocationList();
        else alert('删除失败: '+(results[0].message||''));
      }).catch(function(){ alert('网络错误'); });
    };
// --- from admin.html lines 1250-1281 ---
    window.saveStore = function(sid) {
      var name = document.getElementById('sname-' + sid).value.trim();
      var lat = parseFloat(document.getElementById('slat-' + sid).value);
      var lng = parseFloat(document.getElementById('slng-' + sid).value);
      var scheduled = document.getElementById('ssched-' + sid).value.trim();
      var h = parseInt(document.getElementById('sch-' + sid).value);
      var m = parseInt(document.getElementById('scm-' + sid).value);
      var radius = parseInt(document.getElementById('sradius-' + sid).value) || 200;
      if (!name) { alert('门店名称不能为空'); return; }
      db.from('store').update({
        name: name,
        lat: isNaN(lat) ? null : lat,
        lng: isNaN(lng) ? null : lng,
        cutoff_hour: h, cutoff_minute: m,
        schedule_store_name: scheduled || null,
        gps_radius: radius,
        wage_mode: document.getElementById('swmode-' + sid).value,
        _sync_origin: 'local', _sync_ts: new Date().toISOString()
      }).eq('store_id', sid)
        .then(function(r) { if (r.error) throw r.error; loadStores(); })
        .catch(function(e) { alert('保存失败: ' + (e.message || '网络错误')); });
    };
        window.delStore = function(sid) {
      if (sid === 'unassigned') { alert('「未分配」门店不可删除'); return; }
      if (!confirm('删除门店后，员工将移至「未分配」，排班和打卡数据保留。确认？')) return;
      // 先迁移员工到未分配，保留打卡数据，再删除门店
      db.from('roster').update({ store_id: 'unassigned', _sync_origin: 'local', _sync_ts: new Date().toISOString() }).eq('store_id', sid)
        .then(function() {
          return db.from('store').delete().eq('store_id', sid);
        }).then(function() { loadStores(); })
        .catch(function(e) { alert('删除失败: ' + (e.message || '网络错误')); });
    };

})();