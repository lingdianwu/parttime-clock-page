// Module: roster
// Auto-extracted from admin.html
(function() {
  'use strict';
// --- from admin.html lines 486-839 ---
    // ====== 花名册 ======
    window.addRoster = function() {
      var storeId = document.getElementById('rosterStore').value;
      var name = document.getElementById('rosterName').value.trim();
      var phone = document.getElementById('rosterPhone').value.trim();
      var providerId = document.getElementById('rosterProvider').value;
      if (!storeId) { alert('请选择门店'); return; }
      if (window._adminStoreId && storeId !== window._adminStoreId) { alert('无权限'); return; }
      if (!name) { alert('请输入姓名'); return; }
      if (phone && !/^1\d{10}$/.test(phone)) { alert('手机号格式不正确'); return; }

      // 检查手机号是否已存在于该门店（手机号是唯一标识）
      var phoneCheck = phone ? db.from('roster').select('id,name').eq('store_id', storeId).eq('phone', phone).limit(1) : Promise.resolve({ data: [] });
      phoneCheck.then(function(pr) {
        if (pr.data && pr.data.length > 0) {
          alert('该手机号已存在（员工：' + pr.data[0].name + '），不能重复添加');
          return Promise.reject('dup-phone');
        }
        // 同时检查排班系统是否已有该手机号
        return checkPhoneInSchedule(storeId, phone).then(function(existsInSchedule) {
          if (existsInSchedule) {
            alert('该手机号已在排班系统中存在，不能重复添加');
            return Promise.reject('dup-phone-schedule');
          }
          return db.from('roster').insert({ store_id: storeId, name: name, phone: phone || null, provider_id: providerId || null, _sync_origin: 'local', _sync_ts: new Date().toISOString() }).select('id,store_id,name,phone,employment_type').single();
        });
      }).then(function(res) {
        if (!res || res === 'dup-phone' || res === 'dup-phone-schedule') return;
        if (res.error) throw res.error;
        document.getElementById('rosterName').value = '';
        document.getElementById('rosterPhone').value = '';
        document.getElementById('rosterProvider').value = '';
        loadRosterList();
        return sendRosterRowsToSchedule([res.data], false);
      }).catch(function(e) {
        if (typeof e === 'string' && e.indexOf('dup') === 0) return;
        alert('添加失败: ' + (e.message || '网络错误'));
      });
    };

    // 检查排班系统是否已存在该手机号
    function checkPhoneInSchedule(storeId, phone) {
      if (!phone) return Promise.resolve(false);
      var storeEl = document.getElementById('rosterStore');
      var storeName = storeEl ? storeEl.options[storeEl.selectedIndex].text : '';
      return db.from('store').select('schedule_store_name').eq('store_id', storeId).single()
        .then(function(r) {
          var scheduleName = (r.data && r.data.schedule_store_name) || storeName;
          var configUrl = (window._scheduleApiUrl) || SCHEDULE_CONFIG.apiUrl;
          var configKey = (window._scheduleApiKey) || SCHEDULE_CONFIG.apiKey;
          if (!configUrl || !scheduleName) return false;
          var url = configUrl + '/api/public/roster/check-phone?key=' + encodeURIComponent(configKey) +
            '&storeName=' + encodeURIComponent(scheduleName) + '&phone=' + encodeURIComponent(phone);
          return fetch(url)
            .then(function(r) { return r.json(); })
            .then(function(d) { return d && d.exists; })
            .catch(function() { return false; });
        }).catch(function() { return false; });
    }

    function getScheduleSyncConfig() {
      return db.from('app_config').select('schedule_api_url,schedule_api_key').limit(1).single()
        .then(function(r) {
          var config = r.data || {};
          return {
            apiUrl: (config && config.schedule_api_url) || SCHEDULE_CONFIG.apiUrl,
            apiKey: (config && config.schedule_api_key) || SCHEDULE_CONFIG.apiKey
          };
        }).catch(function() {
          return { apiUrl: SCHEDULE_CONFIG.apiUrl, apiKey: SCHEDULE_CONFIG.apiKey };
        });
    }

    function sendRosterRowsToSchedule(rows, deleted) {
      rows = (rows || []).filter(function(row) { return row && row.id; });
      if (rows.length === 0) return Promise.resolve({ success: true, skipped: true });
      return Promise.all([
        getScheduleSyncConfig(),
        db.from('store').select('store_id,name,schedule_store_name').in('store_id', rows.map(function(r) { return r.store_id; }))
      ]).then(function(_ref) {
        var config = _ref[0];
        var storeRows = (_ref[1].data || []);
        var storeMap = {};
        storeRows.forEach(function(s) {
          storeMap[s.store_id] = (s.schedule_store_name || s.name || '').trim();
        });
        if (!config.apiUrl) throw new Error('未配置排班 API 地址');

        var upserted = [];
        var deletedRows = [];
        rows.forEach(function(row) {
          var scheduleName = storeMap[row.store_id] || row.store_id;
          var payloadRow = {
            _sync_id: String(row.id),
            storeName: scheduleName,
            name: row.name || '',
            phone: row.phone ? String(row.phone) : '',
            employmentType: row.employment_type || '兼职'
          };
          if (deleted) {
            deletedRows.push(payloadRow);
          } else if (payloadRow.name && payloadRow.phone) {
            upserted.push(payloadRow);
          }
        });
        if (upserted.length === 0 && deletedRows.length === 0) {
          return { success: true, skipped: true };
        }

        var url = config.apiUrl + '/api/public/sync/push?key=' + encodeURIComponent(config.apiKey || '');
        return fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'system_B',
            tables: { roster: { upserted: upserted, deleted: deletedRows } }
          })
        }).then(function(resp) {
          return resp.text().then(function(text) {
            var data = {};
            try { data = text ? JSON.parse(text) : {}; }
            catch (e) { throw new Error(text ? text.slice(0, 160) : '排班系统返回异常'); }
            if (!resp.ok || !data.success) throw new Error(data.message || '排班系统同步失败');
            return data;
          });
        }).then(function(data) {
          if (!deleted && upserted.length > 0) {
            var ids = upserted.map(function(r) { return r._sync_id; });
            db.from('roster').update({ _sync_origin: 'sent', _sync_ts: new Date().toISOString() }).in('id', ids).then(function(){});
          }
          return data;
        });
      });
    }

    window.batchImportExcel = function() {
      var storeId = document.getElementById('batchStore').value;
      var providerId = document.getElementById('batchProvider').value;
      var fileEl = document.getElementById('excelFile');
      var msgEl = document.getElementById('batchMsg');
      if (!storeId) { msgEl.textContent = '请选择门店'; msgEl.style.color = '#f44336'; return; }
      if (window._adminStoreId && storeId !== window._adminStoreId) { msgEl.textContent = '无权限'; msgEl.style.color = '#f44336'; return; }
      var file = fileEl.files[0];
      if (!file) { msgEl.textContent = '请选择 Excel 文件'; msgEl.style.color = '#f44336'; return; }
      msgEl.textContent = '正在解析...'; msgEl.style.color = '#888';
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var wb = XLSX.read(e.target.result, { type: 'array' });
          var sheet = wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          if (rows.length < 2) { msgEl.textContent = 'Excel 至少需要表头行+1行数据'; msgEl.style.color = '#f44336'; return; }
          var items = [];
          var errors = [];
          for (var r = 1; r < rows.length; r++) {
            var row = rows[r];
            var name = (row[0] !== undefined ? String(row[0]).trim() : '');
            var phone = (row[1] !== undefined ? String(row[1]).trim() : '');
            if (!name) continue;
            if (phone && !/^1\d{10}$/.test(phone)) { errors.push('第' + (r + 1) + '行手机号格式错误: ' + phone); continue; }
            items.push({ store_id: storeId, name: name, phone: phone || null, max_checkins: 3, provider_id: providerId || null, _sync_origin: 'local', _sync_ts: new Date().toISOString() });
          }
          if (errors.length) { msgEl.textContent = errors.join('; '); msgEl.style.color = '#f44336'; return; }
          if (items.length === 0) { msgEl.textContent = '没有可导入的数据'; msgEl.style.color = '#f44336'; return; }
          msgEl.textContent = '正在导入 ' + items.length + ' 人...'; msgEl.style.color = '#888';
          var skipped = [];
          var insertedCount = 0;
          db.from('roster').select('name').eq('store_id', storeId).then(function(r) {
            var existNames = {};
            (r.data || []).forEach(function(e) { existNames[e.name] = true; });
            var toInsert = [];
            items.forEach(function(it) {
              if (existNames[it.name]) { skipped.push(it.name); return; }
              toInsert.push(it);
            });
            if (skipped.length) { msgEl.textContent = '跳过重复: ' + skipped.slice(0, 5).join(', ') + (skipped.length > 5 ? '...等' + skipped.length + '人，' : '，') + '其余导入中...'; msgEl.style.color = '#e65100'; }
            if (toInsert.length === 0) { if (!skipped.length) msgEl.textContent = '没有可导入的数据'; return; }
            insertedCount = toInsert.length;
            return db.from('roster').insert(toInsert).select('id,store_id,name,phone,employment_type');
          }).then(function(res) {
            if (res && res.error) throw res.error;
            var insertedRows = (res && res.data) || [];
            if (insertedRows.length > 0) {
              msgEl.textContent = '已导入，正在同步到排班系统...';
              msgEl.style.color = '#e65100';
              return sendRosterRowsToSchedule(insertedRows, false);
            }
          }).then(function() {
            fileEl.value = '';
            document.getElementById('batchProvider').value = '';
            msgEl.textContent = '成功导入 ' + insertedCount + ' 人，跳过 ' + skipped.length + ' 人';
            msgEl.style.color = '#4caf50';
            loadRosterList();
          }).catch(function(err) {
            msgEl.textContent = '导入失败: ' + (err.message || '网络错误'); msgEl.style.color = '#f44336';
          });
        } catch(ex) {
          msgEl.textContent = '解析 Excel 失败: ' + ex.message; msgEl.style.color = '#f44336';
        }
      };
      reader.readAsArrayBuffer(file);
    };

    // ====== 同步状态管理 ======
    window.forceFullSync = function() {
      var msgEl = document.getElementById('syncMsg');
      var iconEl = document.getElementById('syncStatusIcon');
      msgEl.textContent = '正在从排班系统拉取...';
      msgEl.style.color = '#e65100';
      iconEl.textContent = '🔄';
      // 先从排班系统拉取
      syncRosterFromSchedule(false);
      // 延迟 2 秒后再推送到排班系统
      setTimeout(function() {
        msgEl.textContent = '正在推送到排班系统...';
        pushRosterToSchedule();
      }, 2000);
    };

    window.checkSyncStatus = function() {
      var msgEl = document.getElementById('syncMsg');
      var iconEl = document.getElementById('syncStatusIcon');
      msgEl.textContent = '检查中...';
      msgEl.style.color = '#666';
      // 查询最近同步记录时间
      Promise.all([
        db.from('roster').select('_sync_ts').order('_sync_ts', { ascending: false }).limit(1),
        db.from('store').select('_sync_ts').order('_sync_ts', { ascending: false }).limit(1)
      ]).then(function(_ref) {
        var rosterLast = (_ref[0].data && _ref[0].data.length) ? _ref[0].data[0]._sync_ts : null;
        var storeLast = (_ref[1].data && _ref[1].data.length) ? _ref[1].data[0]._sync_ts : null;
        var parts = [];
        if (rosterLast) parts.push('花名册: ' + new Date(rosterLast).toLocaleString());
        if (storeLast) parts.push('门店: ' + new Date(storeLast).toLocaleString());
        if (parts.length) {
          msgEl.textContent = '最后同步 — ' + parts.join(' | ');
          msgEl.style.color = '#4caf50';
          iconEl.textContent = '✅';
        } else {
          msgEl.textContent = '暂无同步记录';
          msgEl.style.color = '#999';
          iconEl.textContent = '⚠️';
        }
      }).catch(function() {
        msgEl.textContent = '检查失败';
        msgEl.style.color = '#f44336';
        iconEl.textContent = '❌';
      });
    };

    // 旧同步函数（保留，供 forceFullSync 和手动调用）
    function autoSyncRoster() { /* 已废弃，改为 webhook 实时同步 */ }

    window.syncRosterFromSchedule = function(silent) {
      var msgEl = document.getElementById('syncMsg');
      var iconEl = document.getElementById('syncStatusIcon');
      if (!silent) {
        msgEl.textContent = '正在连接排班系统...';
        msgEl.style.color = '#666';
      }
      Promise.all([
        db.from('store').select('store_id,name,schedule_store_name'),
        db.from('app_config').select('schedule_api_url,schedule_api_key').limit(1).single()
      ]).then(function(_ref) {
        var stores = (_ref[0].data || []).map(function(s) {
          return { store_id: s.store_id, schedule_store_name: (s.schedule_store_name || s.name || '').trim() };
        }).filter(function(s) { return s.schedule_store_name; });
        var config = _ref[1].data || {};
        var apiUrl = (config && config.schedule_api_url) || SCHEDULE_CONFIG.apiUrl;
        var apiKey = (config && config.schedule_api_key) || SCHEDULE_CONFIG.apiKey;
        if (stores.length === 0) {
          msgEl.textContent = '没有已绑定排班门店的门店';
          msgEl.style.color = '#f44336';
          return Promise.reject('no stores');
        }
        if (!apiUrl) {
          msgEl.textContent = '未配置排班 API 地址';
          msgEl.style.color = '#f44336';
          return Promise.reject('no api');
        }
        var fetches = stores.map(function(s) {
          var url = apiUrl + '/api/public/roster?key=' + encodeURIComponent(apiKey);
          return fetch(url).then(function(r) { return r.json(); }).then(function(data) {
            return { storeId: s.store_id, scheduleName: s.schedule_store_name, data: data };
          }).catch(function() { return { storeId: s.store_id, error: true }; });
        });
        return Promise.all(fetches).then(function(results) {
          var added = 0, skipped = 0, errors = 0;
          var inserts = [];
          return Promise.all(results.map(function(result) {
            if (result.error) { errors++; return Promise.resolve(); }
            var stores = (result.data && result.data.stores) || [];
            var targetStore = null;
            for (var si = 0; si < stores.length; si++) {
              if (stores[si].storeName === result.scheduleName) { targetStore = stores[si]; break; }
            }
            if (!targetStore) return Promise.resolve();
            var partTimers = (targetStore.staff || []).filter(function(s) { return s.employmentType === '兼职'; });
            return db.from('roster').select('name,phone').eq('store_id', result.storeId).then(function(r) {
              var existingPhones = {};
              (r.data || []).forEach(function(row) { if (row.phone) existingPhones[row.phone] = row.name; });
              partTimers.forEach(function(st) {
                var phone = String(st.phone);
                if (existingPhones[phone]) { skipped++; }
                else {
                  added++;
                  inserts.push({ store_id: result.storeId, name: st.name, phone: phone, max_checkins: 3, _sync_origin: 'system_A', _sync_ts: new Date().toISOString() });
                }
              });
            });
          })).then(function() {
            if (inserts.length > 0) return db.from('roster').insert(inserts);
          }).then(function() {
            var parts = [];
            if (added > 0) parts.push('新增 ' + added + ' 人');
            if (skipped > 0) parts.push('跳过 ' + skipped + ' 人（已存在）');
            if (errors > 0) parts.push(errors + ' 个门店请求失败');
            msgEl.textContent = parts.join('，') || '数据已是最新';
            msgEl.style.color = added > 0 ? '#4caf50' : '#666';
            if (iconEl) iconEl.textContent = '✅';
            loadRosterList();
          });
        });
      }).catch(function(e) {
        if (e === 'no stores' || e === 'no api') return;
        if (!silent) { msgEl.textContent = '同步失败: ' + (e.message || '网络错误'); msgEl.style.color = '#f44336'; }
      });
    };

    window.pushRosterToSchedule = function() {
      var msgEl = document.getElementById('syncMsg');
      msgEl.textContent = '正在推送到排班系统...';
      msgEl.style.color = '#e65100';
      db.from('roster').select('id,store_id,name,phone,employment_type').then(function(r) {
        if (r.error) throw r.error;
        var rows = (r.data || []).filter(function(x) { return x.phone; });
        if (rows.length === 0) {
          msgEl.textContent = '没有需要同步的数据';
          msgEl.style.color = '#666';
          return null;
        }
        return sendRosterRowsToSchedule(rows, false).then(function(data) {
          var resultMap = (data && data.results && data.results.roster) || {};
          var upserted = 0, skipped = 0, errors = 0;
          Object.keys(resultMap).forEach(function(k) {
            var v = resultMap[k] || '';
            if (v === 'upserted') upserted++;
            else if (String(v).indexOf('skipped') === 0) skipped++;
            else if (String(v).indexOf('error') === 0) errors++;
          });
          var parts = [];
          if (upserted > 0) parts.push('已同步 ' + upserted + ' 人');
          if (skipped > 0) parts.push('跳过 ' + skipped + ' 人');
          if (errors > 0) parts.push(errors + ' 人失败');
          msgEl.textContent = parts.length ? parts.join('，') : '没有需要同步的数据';
          msgEl.style.color = errors > 0 ? '#e65100' : '#4caf50';
        });
      }).catch(function(e) {
        msgEl.textContent = '推送失败: ' + (e.message || '网络错误');
        msgEl.style.color = '#f44336';
      });
    };

    window.loadRosterList = function() {
      document.getElementById('rosterListContainer').innerHTML = '<div class="loading">加载中</div>';
      var query = db.from('roster').select('*').order('store_id').order('name');
      if (window._adminStoreId) query = query.eq('store_id', window._adminStoreId);
      // 非超管只加载有权限的门店数据
      if (!window._isSuper && window._adminStoreIds && window._adminStoreIds.length > 0) {
        query = db.from('roster').select('*').order('store_id').order('name').in('store_id', window._adminStoreIds);
      }
      return query.then(function(r) {
          if (r.error) throw r.error;
          var list = r.data || [];
          window._rosterMap = {};
          list.forEach(function(x) { window._rosterMap[x.store_id + '|' + x.name] = x; });
          window._rosterListAll = list;
          var stores = window._stores || [];
          var filterOpts = '<option value="">全部门店</option>';
          var visibleStores = window._isSuper ? stores : stores.filter(function(s){return hasStorePt(s.store_id)});
          visibleStores.forEach(function(s) {
            filterOpts += '<option value="' + s.store_id + '">' + escHtml(s.name) + '</option>';
          });
          document.getElementById('rosterFilterStore').innerHTML = filterOpts;
          filterRosterList();
        });
    }

    window.filterRosterList = function() {
      var list = window._rosterListAll || [];
      var filterStore = document.getElementById('rosterFilterStore').value;
      var search = (document.getElementById('rosterFilterSearch').value || '').trim().toLowerCase();
      var filtered = list.filter(function(i) {
        if (filterStore && i.store_id !== filterStore) return false;
        if (search) {
          var nameMatch = (i.name || '').toLowerCase().indexOf(search) !== -1;
          var phoneMatch = (i.phone || '').toLowerCase().indexOf(search) !== -1;
          if (!nameMatch && !phoneMatch) return false;
        }
        return true;
      });
      if (filtered.length === 0) {
        document.getElementById('rosterListContainer').innerHTML = '<div class="empty-state">暂无匹配员工</div>';
        return;
      }
      // 检查门店时薪模式
      var showPersonWage = false;
      if (filterStore) {
        var fs2 = (window._stores||[]).find(function(s){return s.store_id===filterStore;});
        showPersonWage = fs2 && fs2.wage_mode === 'person';
      }
      document.getElementById('rosterListContainer').innerHTML =
        '<table class="roster-table"><thead><tr><th>门店</th><th>姓名</th><th>手机号</th><th>每日次数</th><th>第三方</th>' + (showPersonWage ? '<th>时薪</th>' : '') + '<th>操作</th></tr></thead><tbody>' +
        filtered.map(function(i) {
          var mc = (i.max_checkins != null) ? i.max_checkins : 3;
          var provOpts = '<option value="">无</option>' +
            (window._providers || []).map(function(p) {
              return '<option value="' + p.id + '"' + (i.provider_id === p.id ? ' selected' : '') + '>' + escHtml(p.name) + '</option>';
            }).join('');
          var storeOpts = (window._stores || []).map(function(s) {
            return '<option value="' + s.store_id + '"' + (i.store_id === s.store_id ? ' selected' : '') + '>' + escHtml(s.name) + '</option>';
          }).join('');
          return '<tr>' +
            '<td><select id="store-' + i.id + '" style="min-width:130px">' + storeOpts + '</select></td>' +
            '<td><input type="text" id="name-' + i.id + '" value="' + escHtml(i.name) + '" style="width:90px"></td>' +
            '<td><input type="tel" id="phone-' + i.id + '" value="' + (i.phone || '') + '" placeholder="未录入" style="width:140px"></td>' +
            '<td><input type="number" id="mc-' + i.id + '" value="' + mc + '" min="1" max="99" style="width:65px;text-align:center"></td>' +
            '<td><select id="prov-' + i.id + '" style="min-width:120px">' + provOpts + '</select></td>' +
            (showPersonWage ? '<td><input type="number" id="hw-' + i.id + '" value="' + (i.hourly_wage||'') + '" placeholder="-" step="0.01" min="0" style="width:70px;padding:4px 6px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none;text-align:center" onchange="saveRosterWage(" + i.id + ")\"></td>' : '') +
            '<td><button class="btn-success" onclick="savePhone(\'' + i.id + '\')" style="margin-right:4px">保存</button>' +
            '<button class="btn-danger" onclick="delRoster(\'' + i.id + '\')">删除</button></td>' +
            '</tr>';
        }).join('') + '</tbody></table>';
    }
// --- from admin.html lines 1650-1687 ---
    window.saveRosterWage = function(id) {
      var val = document.getElementById('hw-' + id).value;
      var wage = val === '' ? null : parseFloat(val);
      if (val !== '' && (isNaN(wage) || wage < 0)) { alert('请输入有效时薪'); loadRosterList(); return; }
      db.from('roster').update({ hourly_wage: wage }).eq('id', id)
        .then(function(r) { if (r.error) throw r.error; })
        .catch(function(e) { alert('保存失败: ' + (e.message || '网络错误')); });
      loadRosterList();
    };

    window.savePhone = function(id) {
      // 同时保存个人时薪
      var hwEl = document.getElementById('hw-' + id);
      if (hwEl) {
        var val = hwEl.value;
        var wage = val === '' ? null : parseFloat(val);
        if (val !== '' && (isNaN(wage) || wage < 0)) { alert('请输入有效时薪'); return; }
        db.from('roster').update({ hourly_wage: wage }).eq('id', id).then(function(){});
      }
      var storeId = document.getElementById('store-' + id).value;
      var name = document.getElementById('name-' + id).value.trim();
      var phone = document.getElementById('phone-' + id).value.trim();
      var mc = parseInt(document.getElementById('mc-' + id).value, 10);
      var providerEl = document.getElementById('prov-' + id);
      var providerId = providerEl ? providerEl.value : null;
      if (!name) { alert('姓名不能为空'); return; }
      if (phone && !/^1\d{10}$/.test(phone)) { alert('手机号格式不正确'); return; }
      if (isNaN(mc) || mc < 1) { alert('每日次数至少为1'); return; }
      db.from('roster').update({ store_id: storeId, name: name, phone: phone || null, max_checkins: mc, provider_id: providerId || null, _sync_origin: 'local', _sync_ts: new Date().toISOString() }).eq('id', id).select('id,store_id,name,phone,employment_type').single()
        .then(function(r) {
          if (r.error) throw r.error;
          return sendRosterRowsToSchedule([r.data], false);
        }).then(function() {
          loadRosterList();
        })
        .catch(function(e) { alert('保存失败: ' + (e.message || '网络错误')); });
    };
    window.delRoster = function(id) {
      if (!confirm('确认删除？')) return;
      var deletedRow = null;
      db.from('roster').select('id,store_id,name,phone,employment_type').eq('id', id).single()
        .then(function(r) {
          if (r.error) throw r.error;
          deletedRow = r.data;
          return db.from('roster').delete().eq('id', id);
        }).then(function(r) {
          if (r.error) throw r.error;
          return sendRosterRowsToSchedule([deletedRow], true);
        }).then(function() {
          loadRosterList();
        })
        .catch(function(e) { alert('删除失败: ' + (e.message || '网络错误')); });
    };
})();
