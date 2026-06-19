// Module: records
// Auto-extracted from admin.html
(function() {
  'use strict';
// --- from admin.html lines 182-484 ---
    // ====== 考勤记录 ======
    window.resetRecords = function() {
      document.getElementById('filterStore').value = window._adminStoreId || '';
      var today = dateStr(new Date());
      document.getElementById('filterDateFrom').value = today;
      document.getElementById('filterDateTo').value = today;
      document.getElementById('filterName').value = '';
      loadRecords();
    };
    window.loadFilterNames = function() {
      var storeId = document.getElementById('filterStore').value;
      var sel = document.getElementById('filterName');
      sel.innerHTML = '<option value="">全部员工</option>';
      if (!storeId) return;
      db.from('roster').select('name').eq('store_id', storeId).order('name').then(function(r) {
        if (r.error || !r.data) return;
        var names = [...new Set(r.data.map(function(i) { return i.name; }))];
        names.forEach(function(n) {
          var opt = document.createElement('option');
          opt.value = n; opt.textContent = n;
          sel.appendChild(opt);
        });
      }).catch(function(){});
    };
    window.loadRecords = function() {
      document.getElementById('recordsContainer').innerHTML = '<div class="loading">加载中</div>';
      var filterStore = document.getElementById('filterStore').value;
      var dateFrom = document.getElementById('filterDateFrom').value;
      var dateTo = document.getElementById('filterDateTo').value;
      var filterName = document.getElementById('filterName').value;
      var query = db.from('check_record').select('*').order('check_in', { ascending: false }).limit(500);
      if (filterStore) query = query.eq('store_id', filterStore);
      if (filterName) query = query.eq('name', filterName);
      if (dateFrom) query = query.gte('date', dateFrom);
      if (dateTo) query = query.lte('date', dateTo);
      query.then(function(r) {
        if (r.error) throw r.error;
        var records = r.data || [];
        renderRecords(records);
        // 检查未打卡员工
        checkMissingCheckins(filterStore, dateFrom || dateTo, records);
      }).catch(function(err) {
        document.getElementById('recordsContainer').innerHTML =
          '<div class="empty-state">加载失败: ' + (err.message || '网络错误') + '</div>';
      });
    };

    window.exportCSV = function() {
      var filterStore = document.getElementById('filterStore').value;
      var dateFrom = document.getElementById('filterDateFrom').value;
      var dateTo = document.getElementById('filterDateTo').value;
      var filterName = document.getElementById('filterName').value;
      var query = db.from('check_record').select('*').order('check_in', { ascending: false }).limit(5000);
      if (filterStore) query = query.eq('store_id', filterStore);
      if (filterName) query = query.eq('name', filterName);
      if (dateFrom) query = query.gte('date', dateFrom);
      if (dateTo) query = query.lte('date', dateTo);
      query.then(function(r) {
        if (r.error) throw r.error;
        var records = r.data || [];
        if (records.length === 0) { alert('没有可导出的记录'); return; }
        // 按员工+日期分组计算工时
        var empMap = {}; // key: name|phone → { name, phone, dailyHours: {date: hours}, wage, totalH, provider }
        var daySet = {};
        records.forEach(function(rec) {
          if (!rec.check_out) return; // 跳过未签退
          var key = (rec.name||'') + '|' + (rec.phone||'') + '|' + (rec.location||'') + '|' + (rec.hourly_wage||'');
          if (!empMap[key]) {
            empMap[key] = { name: rec.name, phone: rec.phone, dailyHours: {}, wage: 0, totalH: 0, provider: '', location: rec.location || '' };
          }
          var ci = new Date(rec.check_in), co = new Date(rec.check_out);
          var hrs = Math.floor((co - ci) / 1800000) * 0.5;
          var d = rec.date;
          daySet[d] = true;
          empMap[key].dailyHours[d] = (empMap[key].dailyHours[d] || 0) + hrs;
          empMap[key].totalH += hrs;
          if (rec.hourly_wage && parseFloat(rec.hourly_wage) > 0) empMap[key].wage = parseFloat(rec.hourly_wage);
          if (!empMap[key].location || empMap[key].location === rec.location) empMap[key].location = rec.location;
          var re = window._rosterMap[rec.store_id + '|' + rec.name];
          if (re && re.provider_id && !empMap[key].provider) {
            empMap[key].provider = gPN(re.provider_id) || '';
            empMap[key].providerRate = gPR(re.provider_id) || 0;
          }
        });
        // 日期排序
        var days = Object.keys(daySet).sort();
        if (days.length === 0) { alert('没有可导出的已完成记录'); return; }
        var dayLabels = ['周一','周二','周三','周四','周五','周六','周日'];
        // 计算日期范围
        var dFrom = days[0], dTo = days[days.length-1];
        var storeName = gSN(filterStore) || '全部门店';
        var title = storeName.replace('店','') + '兼职工资核算表（' + dFrom.substring(5).replace('-','.') + '-' + dTo.substring(5).replace('-','.') + '）';
        // 构建CSV
        var csvRows = [];
        csvRows.push([title]); // Row 0
        var hdr = ['序号','姓名','身份证号','定岗点位'];
        days.forEach(function(d) { hdr.push(d.substring(5)); }); // MM-DD
        hdr.push('出勤合计/H','工资标准/元','出勤工资/元','餐补/元','工资合计/元','中介','服务费/H','中介费用','人工成本/元','备注');
        csvRows.push(hdr); // Row 1
        // Row 2-3: sub-headers
        var sub1 = ['','','',''];
        days.forEach(function(d) {
          var dow = new Date(d).getDay();
          sub1.push(dayLabels[dow === 0 ? 6 : dow - 1]);
        });
        csvRows.push(sub1); // Row 3
        // Data rows
        var seq = 1;
        var empList = Object.values(empMap).sort(function(a, b) {
          var pa = (a.provider || '直招'), pb = (b.provider || '直招');
          if (pa === '直招' && pb !== '直招') return 1;
          if (pa !== '直招' && pb === '直招') return -1;
          if (pa < pb) return -1;
          if (pa > pb) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });
        empList.forEach(function(emp) {
          var row = [seq++, emp.name, '', emp.location];
          days.forEach(function(d) {
            var h = emp.dailyHours[d] || 0;
            row.push(h > 0 ? h : '');
          });
          var totalH = Math.floor(emp.totalH * 2) / 2;
          row.push(totalH);
          row.push(emp.wage || '');
          var salary = emp.wage ? (totalH * emp.wage).toFixed(2) : '';
          row.push(salary);
          row.push(''); // 餐补
          row.push(salary); // 工资合计
          row.push(emp.provider || '人资');
          row.push(emp.providerRate || '');
          var fee = emp.providerRate ? (totalH * emp.providerRate).toFixed(2) : '0';
          row.push(fee); // 中介费用
          var cost = salary ? (parseFloat(salary) + parseFloat(fee || 0)).toFixed(2) : '';
          row.push(cost); // 人工成本
          row.push(emp.provider || '直招'); // 备注
          csvRows.push(row);
        });
        var csv = '﻿' + csvRows.map(function(r) { return r.map(function(v) { return '"' + String(v || '').replace(/"/g,'""') + '"'; }).join(','); }).join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = title + '.csv';
        a.click(); URL.revokeObjectURL(url);
      }).catch(function(err) {
        alert('导出失败: ' + (err.message || '网络错误'));
      });
    };

    window.exportDetailCSV = function() {
      var filterStore = document.getElementById('filterStore').value;
      var dateFrom = document.getElementById('filterDateFrom').value;
      var dateTo = document.getElementById('filterDateTo').value;
      var filterName = document.getElementById('filterName').value;
      var query = db.from('check_record').select('*').order('check_in', { ascending: false }).limit(5000);
      if (filterStore) query = query.eq('store_id', filterStore);
      if (filterName) query = query.eq('name', filterName);
      if (dateFrom) query = query.gte('date', dateFrom);
      if (dateTo) query = query.lte('date', dateTo);
      query.then(function(r) {
        if (r.error) { alert('查询失败: ' + r.error.message); return; }
        var records = r.data || [];
        if (records.length === 0) { alert('没有可导出的记录'); return; }
        var storeName = gSN(filterStore) || '全部门店';
        var title = storeName.replace('店','') + '工时明细表';
        var csvRows = [];
        csvRows.push([title]);
        csvRows.push(['序号','姓名','手机号','日期','门店','点位','排班到岗','实际到岗','认定到岗','排班离岗','实际离岗','认定离岗','工时(h)','认定逻辑']);
        var seq = 1;
        records.forEach(function(rec) {
          var ei = effCheckIn(rec);
          var eo = effCheckOut(rec);
          var ci = new Date(rec.check_in);
          var co = rec.check_out ? new Date(rec.check_out) : null;
          var si = rec.scheduled_check_in ? new Date(rec.scheduled_check_in) : null;
          var so = rec.scheduled_check_out ? new Date(rec.scheduled_check_out) : null;
          var hrs = eo ? ((eo.getTime() - ei.getTime()) / 3600000).toFixed(2) : '--';
          var logic = '';
          if (si) { logic += '到岗:' + (ci <= si ? '早到按排班' : '迟到按实际') + '; '; }
          else { logic += '到岗:无排班按实际; '; }
          if (eo && so) {
            var diffMin = (eo.getTime() - so.getTime()) / 60000;
            if (diffMin > 30) logic += '离岗:超30分算加班';
            else logic += '离岗:按实际';
          } else if (eo) { logic += '离岗:无排班按实际'; }
          else { logic += '离岗:未签退'; }
          csvRows.push([seq++, rec.name, rec.phone, rec.date, gSN(rec.store_id), rec.location || '',
            si ? ('0'+si.getHours()).slice(-2)+':'+('0'+si.getMinutes()).slice(-2) : '--',
            ('0'+ci.getHours()).slice(-2)+':'+('0'+ci.getMinutes()).slice(-2),
            ('0'+ei.getHours()).slice(-2)+':'+('0'+ei.getMinutes()).slice(-2),
            so ? ('0'+so.getHours()).slice(-2)+':'+('0'+so.getMinutes()).slice(-2) : '--',
            co ? ('0'+co.getHours()).slice(-2)+':'+('0'+co.getMinutes()).slice(-2) : '--',
            eo ? ('0'+eo.getHours()).slice(-2)+':'+('0'+eo.getMinutes()).slice(-2) : '--',
            hrs, logic]);
        });
        var csv = '\uFEFF' + csvRows.map(function(row) { return row.map(function(v) { return '"' + String(v || '').replace(/"/g,'""') + '"'; }).join(','); }).join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = title + '.csv';
        a.click(); URL.revokeObjectURL(url);
      }).catch(function(err) {
        alert('导出失败: ' + (err.message || '网络错误'));
      });
    };

    window.pushRecordsToProject = function() {
      var filterStore = document.getElementById('filterStore').value;
      var dateFrom = document.getElementById('filterDateFrom').value;
      var dateTo = document.getElementById('filterDateTo').value;
      if (!filterStore) { alert('请先选择门店'); return; }
      var store = (window._stores||[]).find(function(s){return s.store_id===filterStore;});
      var storeName = (store && (store.schedule_store_name||store.name)) || '';
      if (!storeName) { alert('门店未配置排班名'); return; }
      if (!confirm('将把当前筛选的考勤记录（含认定时间）推送到排班系统「' + storeName + '」，确认？')) return;

      var apiUrl = SCHEDULE_CONFIG.apiUrl || '';
      var apiKey = SCHEDULE_CONFIG.apiKey || '';
      if (!apiUrl) { alert('未配置排班API'); return; }

      var query = db.from('check_record').select('*').eq('store_id', filterStore).limit(5000);
      if (dateFrom) query = query.gte('date', dateFrom);
      if (dateTo) query = query.lte('date', dateTo);
      query.then(function(r) {
        if (r.error) { alert('查询失败: ' + r.error.message); return; }
        var records = r.data || [];
        if (records.length === 0) { alert('没有可推送的记录'); return; }
        
        var upserted = records.map(function(rec) {
          var ei = effCheckIn(rec);
          var eo = effCheckOut(rec);
          return {
            _sync_id: String(rec.id),
            storeName: storeName,
            name: rec.name,
            phone: rec.phone,
            date: rec.date,
            check_in: ei ? ei.toISOString() : rec.check_in,
            check_out: eo ? eo.toISOString() : rec.check_out,
            scheduled_check_in: rec.scheduled_check_in,
            scheduled_check_out: rec.scheduled_check_out,
            location: rec.location || '',
          };
        });

        fetch(apiUrl + '/api/public/sync/push?key=' + encodeURIComponent(apiKey), {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
          body: JSON.stringify({ source: 'system_B', tables: { attendance: { upserted: upserted, deleted: [] } } })
        }).then(function(rr){return rr.json();}).then(function(data) {
          if (data.success) {
            var added = (data.results && data.results.attendance) ? Object.keys(data.results.attendance).length : 0;
            alert('推送完成: ' + added + ' 条记录已同步');
          } else {
            alert('推送失败: ' + (data.message || ''));
          }
          loadRecords();
        }).catch(function(e) { alert('推送失败: ' + (e.message || '网络错误')); });
      }).catch(function(e) { alert('查询失败: ' + (e.message || '网络错误')); });
    };

    function effCheckIn(rec) {
      if (rec.scheduled_check_in) {
        var actual = new Date(rec.check_in).getTime();
        var scheduled = new Date(rec.scheduled_check_in).getTime();
        return new Date(Math.max(actual, scheduled)); // 早到按排班，迟到按实际
      }
      return new Date(rec.check_in);
    }
    function effCheckOut(rec) {
      if (rec.check_out && rec.scheduled_check_out) {
        var actual = new Date(rec.check_out).getTime();
        var scheduled = new Date(rec.scheduled_check_out).getTime();
        if (actual > scheduled + 30 * 60 * 1000) return new Date(actual); // 超30分钟算加班
        return new Date(Math.min(actual, scheduled));
      }
      return rec.check_out ? new Date(rec.check_out) : null;
    }

    function checkMissingCheckins(storeId, date, records) {
      if (!storeId || !date) return;
      var store = (window._stores||[]).find(function(s){return s.store_id===storeId;});
      if (!store) return;
      var storeName = store.schedule_store_name || store.name;
      var apiUrl = (SCHEDULE_CONFIG.apiUrl||'') + '/api/public/schedule?key=' + encodeURIComponent(SCHEDULE_CONFIG.apiKey||'schedule2026') + '&date=' + date + '&storeName=' + encodeURIComponent(storeName);
      fetch(apiUrl, { headers: { 'ngrok-skip-browser-warning': '1' } }).then(function(r){return r.json();}).then(function(data){
        var now = new Date();
        var missing = [];
        (data.stores||[]).forEach(function(st){(st.locations||[]).forEach(function(loc){(loc.staff||[]).forEach(function(stf){
          if (!stf.timeIn) return;
          if (stf.employmentType === '全职') return; // 只监控兼职
          var schedIn = new Date(date+'T'+stf.timeIn+':00+08:00');
          if (now <= schedIn) return; // 还没到排班时间
          // 检查是否有打卡记录
          var hasRecord = records.some(function(r){ return r.name===stf.name && r.phone===String(stf.phone); });
          if (!hasRecord) missing.push(stf.name + ' ' + stf.timeIn + ' ' + loc.location);
        });});});
        var el = document.getElementById('missingCheckinAlert');
        if (missing.length === 0) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.innerHTML = '<strong style="color:#e65100">⚠️ 以下员工排班到岗时间已过，未查到打卡记录，请确认是否到岗：</strong><br>' +
          missing.map(function(m){ return '<span style="color:#e65100;font-weight:600">'+m+'</span>'; }).join('、');
      }).catch(function(){});
    }

    function renderRecords(records) {
      if (records.length === 0) {
        document.getElementById('recordsContainer').innerHTML = '<div class="empty-state">暂无打卡记录</div>';
        document.getElementById('summaryCards').innerHTML = '';
        return;
      }
      var filterCount = records.length, filterTotalMin = 0, filterTotalFee = 0, filterTotalSalary = 0, filterOnDuty = 0;
      records.forEach(function(r) {
        if (!r.check_out) { filterOnDuty++; return; }
        var sci = effCheckIn(r), sco = effCheckOut(r);
        var mins = (sco.getTime() - sci.getTime()) / 60000;
        filterTotalMin += mins;
        var re = window._rosterMap[r.store_id + '|' + r.name];
        if (re && re.provider_id) {
          var rate2 = gPR(re.provider_id);
          filterTotalFee += (Math.floor(mins / 30) * 30 / 60) * rate2;
        }
        if (r.hourly_wage != null) {
          filterTotalSalary += (Math.floor(mins / 30) * 30 / 60) * parseFloat(r.hourly_wage);
        }
      });
      document.getElementById('summaryCards').innerHTML =
        '<div class="summary-card"><div class="num">' + filterCount + '</div><div class="label">筛选记录数</div></div>' +
        '<div class="summary-card"><div class="num">' + filterOnDuty + '</div><div class="label">在岗中</div></div>' +
        '<div class="summary-card"><div class="num">' + fmtHoursMin(filterTotalMin) + '</div><div class="label">在岗总时长</div></div>' +
        '<div class="summary-card"><div class="num">' + filterTotalSalary.toFixed(2) + '元</div><div class="label">工资合计</div></div>' +
        '<div class="summary-card"><div class="num">' + filterTotalFee.toFixed(2) + '元</div><div class="label">服务费合计</div></div>';
      document.getElementById('recordsContainer').innerHTML =
        '<table class="records-table"><thead><tr><th>姓名</th><th>门店</th><th>日期</th><th>排班到岗</th><th>实际到岗</th><th>排班离岗</th><th>实际离岗</th><th>排班点位</th><th>在岗时长</th><th>时薪</th><th>工资</th><th>第三方</th><th>服务费</th><th>操作</th></tr></thead><tbody>' +
        records.map(function(r) {
          var ei = effCheckIn(r), eo = effCheckOut(r);
          var ci = new Date(r.check_in), co = r.check_out ? new Date(r.check_out) : null;
          var sci = r.scheduled_check_in ? new Date(r.scheduled_check_in) : null;
          var sco = r.scheduled_check_out ? new Date(r.scheduled_check_out) : null;
          var adjusted = (r.scheduled_check_in || r.scheduled_check_out);
          var needsCheckout = !co;
          var hourCell;
          var isOvertime = false;
          if (eo) {
            var actualCo2 = r.check_out ? new Date(r.check_out) : null;
            var schedCo2 = r.scheduled_check_out ? new Date(r.scheduled_check_out) : null;
            if (schedCo2 && actualCo2 && actualCo2.getTime() > schedCo2.getTime() + 30 * 60 * 1000) {
              isOvertime = true;
            }
            hourCell = '<span' + (isOvertime ? ' style="color:#e65100;font-weight:800"' : (((eo.getTime() - ei.getTime()) / 3600000) > 12 ? ' style="color:#e65100;font-weight:800"' : '')) + '>' + calcHoursStr(ei, eo) + '</span>';
            if (isOvertime) {
              var schedOut2 = new Date(r.scheduled_check_out);
              var otMins = (eo.getTime() - schedOut2.getTime()) / 60000;
              var otH = Math.floor(otMins / 30) * 0.5;
              hourCell += ' <span style="font-size:10px;color:#e65100;font-weight:700">加班'+otH.toFixed(1)+'h</span>';
            } else if (adjusted) {
              hourCell += ' <span style="font-size:10px;color:#4caf50">(调整)</span>';
            }
          } else {
            var pastDue = false;
            var yesterdayStr = dateStr(new Date(Date.now() - 86400000));
            if (r.date < yesterdayStr) {
              pastDue = true;
            } else if (r.date === yesterdayStr) {
              var store = (window._stores || []).filter(function(s) { return s.store_id === r.store_id; })[0];
              var ch = (store && store.cutoff_hour != null) ? store.cutoff_hour : 2;
              var cm = (store && store.cutoff_minute != null) ? store.cutoff_minute : 0;
              var now = new Date();
              if (now.getHours() > ch || (now.getHours() === ch && now.getMinutes() >= cm)) {
                pastDue = true;
              }
            }
            hourCell = pastDue
              ? '<span style="color:#ef4440;font-weight:600">未签退</span>'
              : '<span style="color:#f59e0b">在岗中</span>';
          }
          var re = window._rosterMap[r.store_id + '|' + r.name];
          var pid = re ? re.provider_id : null;
          var pname = pid ? gPN(pid) : '--';
          var feeStr = '--';
          if (eo && pid) {
            var rate = gPR(pid);
            var mins = (eo.getTime() - ei.getTime()) / 60000;
            var roundedHrs = Math.floor(mins / 30) * 30 / 60;
            feeStr = (roundedHrs * rate).toFixed(2) + '元';
          }
          var wageVal = (r.hourly_wage != null) ? r.hourly_wage : '';
          var salaryStr = '--';
          if (eo && wageVal !== '') {
            var mins2 = (eo.getTime() - ei.getTime()) / 60000;
            var roundedHrs2 = Math.floor(mins2 / 30) * 30 / 60;
            var w2 = parseFloat(wageVal);
            if (!isNaN(w2)) salaryStr = (roundedHrs2 * w2).toFixed(2) + '元';
          }
          var actionHtml =
            '<button class="btn-sm" onclick="var a=document.getElementById(\'acts-' + r.id + '\');a.style.display=a.style.display===\'none\'?\'inline\':\'none\'" style="font-size:14px;padding:2px 8px;line-height:1;border:1px solid #d0d7e2;border-radius:4px;background:#fff;cursor:pointer">⋮</button>' +
            '<span id="acts-' + r.id + '" style="display:none">' +
            ' <button class="btn-danger" onclick="deleteRecord(\'' + r.id + '\')">删除</button>' +
            ' <button class="btn-success" onclick="setCheckIn(\'' + r.id + '\',\'' + r.check_in + '\'' + (r.check_out ? ',\'' + r.check_out + '\'' : '') + ')">编辑到岗</button>' +
            ' <button class="btn-success" onclick="setCheckOut(\'' + r.id + '\',\'' + r.check_in + '\'' + (r.check_out ? ',\'' + r.check_out + '\'' : '') + ')">编辑离岗</button>' +
            '</span>';
          var isOvertime = eo && ((eo.getTime() - ei.getTime()) / 3600000) > 12;
          return '<tr' + (isOvertime ? ' style="background:#fff3e0 !important"' : '') + '>' +
            '<td>' + escHtml(r.name) + '</td>' +
            '<td>' + escHtml(gSN(r.store_id)) + '</td>' +
            '<td>' + r.date + '</td>' +
            '<td>' + fmtTime(sci) + '</td>' +
            '<td>' + fmtTime(ci) + '</td>' +
            '<td>' + fmtTime(sco) + '</td>' +
            '<td>' + fmtTime(co) +
            (co && (co.getDate() !== ci.getDate() || co.getMonth() !== ci.getMonth() || co.getFullYear() !== ci.getFullYear())
              ? '<sup style="color:#e65100;font-weight:700;font-size:10px">+1</sup>' : '') + '</td>' +
            '<td>' + (r.prev_location ? escHtml(r.prev_location) + ' <span style="color:#e65100;font-weight:700">→</span> ' : '') + escHtml(r.location || '--') + '</td>' +
            '<td class="hours">' + hourCell + '</td>' +
            '<td><input type="number" id="wage-' + r.id + '" value="' + wageVal + '" placeholder="-" step="0.01" min="0" style="width:60px;padding:4px 6px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none;text-align:center" onchange="saveWage(\'' + r.id + '\')"></td>' +
            '<td class="hours">' + salaryStr + '</td>' +
            '<td>' + escHtml(pname) + '</td>' +
            '<td class="hours">' + feeStr + '</td>' +
            '<td>' + actionHtml + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table>';
    }
// --- from admin.html lines 1354-1562 ---
    var _addRecStaffList = [];
    window.loadAddRecStaff = function() {
      var sid = document.getElementById('addRecStore').value;
      var sel = document.getElementById('addRecStaff');
      if (!sid) { sel.innerHTML = '<option value="">选择员工</option>'; return; }
      db.from('roster').select('name,phone').eq('store_id',sid).order('name').then(function(r){
        _addRecStaffList = r.data || [];
        sel.innerHTML = '<option value="">选择员工</option>' + _addRecStaffList.map(function(s,i){ return '<option value="'+i+'">'+s.name+' ('+(s.phone||'').slice(-4)+')</option>'; }).join('');
      });
    };

    
    var _addRecSched = null; // 匹配到的排班信息 {loc, ti, to, shift}
    window.checkAddRecSchedule = function() {
      var sid = document.getElementById('addRecStore').value;
      var si = document.getElementById('addRecStaff').value;
      var date = document.getElementById('addRecDate').value;
      var msg = document.getElementById('addRecMsg');
      if (!sid || si === '' || !date) return;
      var s = _addRecStaffList[parseInt(si)];
      if (!s) return;
      var store = (window._stores||[]).find(function(x){return x.store_id===sid;});
      var storeName = store ? (store.schedule_store_name||store.name) : '';
      msg.textContent = '查询排班中...'; msg.style.color = '#888';
      _addRecSched = null;
      var apiUrl = (SCHEDULE_CONFIG.apiUrl||'') + '/api/public/schedule?key=' + encodeURIComponent(SCHEDULE_CONFIG.apiKey||'schedule2026') + '&date=' + date + '&storeName=' + encodeURIComponent(storeName);
      fetch(apiUrl, { headers: { 'ngrok-skip-browser-warning': '1' } }).then(function(r){return r.json();}).then(function(data){
        var found = null;
        (data.stores||[]).forEach(function(st){ (st.locations||[]).forEach(function(loc){ (loc.staff||[]).forEach(function(stf){
          if (String(stf.phone)===String(s.phone)) found = {loc:loc.location, ti:stf.timeIn, to:stf.timeOut, shift:stf.shiftType};
        });});});
        if (!found) { msg.textContent = '当日无排班，可手动填写'; msg.style.color = '#888'; _addRecSched = null; return; }
        // 有排班，检查是否已有打卡记录
        db.from('check_record').select('id').eq('store_id',sid).eq('name',s.name).eq('date',date).then(function(cr){
          if (cr.data && cr.data.length > 0) {
            msg.textContent = '该日期已有考勤记录，禁止重复新增'; msg.style.color = '#f44336';
            _addRecSched = null;
            document.getElementById('addRecIn').disabled = true;
            document.getElementById('addRecOut').disabled = true;
          } else {
            msg.textContent = '已匹配排班：'+found.loc+' '+found.ti+'~'+found.to; msg.style.color = '#4caf50';
            _addRecSched = found;
            document.getElementById('addRecLoc').value = found.loc;
            document.getElementById('addRecIn').value = found.ti;
            document.getElementById('addRecOut').value = found.to;
            document.getElementById('addRecIn').disabled = false;
            document.getElementById('addRecOut').disabled = false;
          }
        });
      }).catch(function(){ msg.textContent = '排班查询失败，可手动填写'; msg.style.color = '#888'; });
    };

    window.showAddRecord = function() {
      var sel = document.getElementById('addRecStore');
      sel.innerHTML = '<option value="">选择门店</option>' + (window._stores||[]).filter(function(s){return s.store_id!=='unassigned'&&hasStorePt(s.store_id)}).map(function(s){return '<option value="'+s.store_id+'">'+s.name+'</option>';}).join('');
      document.getElementById('addRecDate').value = new Date().toISOString().split('T')[0]; document.getElementById('addRecLoc').value=''; document.getElementById('addRecIn').value=''; document.getElementById('addRecOut').value=''; document.getElementById('addRecIn').disabled=false; document.getElementById('addRecOut').disabled=false; document.getElementById('addRecMsg').textContent=''; document.getElementById('addRecStaff').innerHTML='<option value="">选择员工</option>';
      document.getElementById('addRecordForm').style.display = '';
    };
    window.submitAddRecord = function() {
      var sid = document.getElementById('addRecStore').value;
      var si = document.getElementById('addRecStaff').value;
      if (si !== '') { var s = _addRecStaffList[parseInt(si)]; document.getElementById('addRecName').value = s.name; document.getElementById('addRecPhone').value = s.phone; }
      var name = document.getElementById('addRecName').value.trim();
      var phone = document.getElementById('addRecPhone').value.trim();
      var date = document.getElementById('addRecDate').value;
      var tin = document.getElementById('addRecIn').value;
      var tout = document.getElementById('addRecOut').value;
      var loc = document.getElementById('addRecLoc').value.trim();
      // 有匹配排班时，自动拉取排班时间和点位
      if (_addRecSched) {
        tin = _addRecSched.ti;
        tout = _addRecSched.to;
        if (!loc) loc = _addRecSched.loc;
        document.getElementById('addRecIn').value = tin;
        document.getElementById('addRecOut').value = tout;
        document.getElementById('addRecLoc').value = loc;
      }
      if (!sid||!name||!phone||!date||!tin||(!tout && !_addRecSched)) { document.getElementById('addRecMsg').textContent='请填写完整';return; }
      if (_addRecSched === null && document.getElementById('addRecMsg').textContent.indexOf('已有考勤') >= 0) { document.getElementById('addRecMsg').textContent='该日期已有考勤记录，禁止新增';return; }
      var ci = new Date(date + 'T' + tin + ':00+08:00');
      var co = tout ? new Date(date + 'T' + tout + ':00+08:00') : null;
      if (co && co <= ci) { document.getElementById('addRecMsg').textContent='离岗时间必须晚于到岗时间';return; }
      var now = new Date();
      // 当前时间未到排班离岗时间 → 仅签到，在岗中
      var hasCheckOut = tout && (!_addRecSched || co <= now);
      var insertData = {
        store_id: sid, name: name, phone: phone, date: date,
        check_in: ci.toISOString(), location: loc || null,
        scheduled_check_in: _addRecSched ? new Date(date + 'T' + _addRecSched.ti + ':00+08:00').toISOString() : null,
        scheduled_check_out: _addRecSched ? new Date(date + 'T' + _addRecSched.to + ':00+08:00').toISOString() : null,
        _sync_origin: 'local', _sync_ts: now.toISOString()
      };
      if (hasCheckOut) insertData.check_out = co.toISOString();
      db.from('check_record').insert(insertData).then(function(r) {
        if (r.error) throw r.error;
        // 同步到排班系统
        var store = (window._stores||[]).find(function(x){return x.store_id===sid;});
        var schedStoreName = store ? (store.schedule_store_name||store.name) : '';
        fetch((SCHEDULE_CONFIG.apiUrl||'') + '/api/public/schedule?key=' + encodeURIComponent(SCHEDULE_CONFIG.apiKey||'schedule2026'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
          body: JSON.stringify({ storeName: schedStoreName, name: name, phone: phone, date: date, timeIn: tin, timeOut: tout, location: loc||'', employmentType: '兼职' })
        }).catch(function(){});
        document.getElementById('addRecMsg').textContent = '添加成功'; document.getElementById('addRecMsg').style.color='#4caf50';
        document.getElementById('addRecordForm').style.display = 'none';
        loadRecords();
      }).catch(function(e) {
        document.getElementById('addRecMsg').textContent = '添加失败: '+(e.message||'网络错误'); document.getElementById('addRecMsg').style.color='#f44336';
      });
    };

    window.applyProviderRates = function() {
      if (!confirm("将按花名册当前第三方费率批量固化到打卡记录，确认？")) return;
      var filterStore = document.getElementById('filterStore').value;
      var q = db.from('check_record').select('id,name,store_id').not('check_out', 'is', null);
      if (filterStore) q = q.eq('store_id', filterStore);
      q.then(function(res) {
        if (res.error) throw res.error;
        var records = res.data || [];
        var updates = [];
        var promises = records.map(function(rec) {
          var re = window._rosterMap[rec.store_id + '|' + rec.name];
          if (!re || !re.provider_id) return Promise.resolve();
          var rate = gPR(re.provider_id);
          if (!rate) return Promise.resolve();
          return db.from('check_record').update({ provider_rate: rate, _sync_origin: 'local', _sync_ts: new Date().toISOString() }).eq('id', rec.id).then(function() { updates.push(rec.id); });
        });
        return Promise.all(promises).then(function() {
          alert('已固化 ' + updates.length + ' 条记录的服务费率');
          loadRecords();
        });
      }).catch(function(e) { alert('操作失败: ' + (e.message || '网络错误')); });
    };

    
    window.syncScheduleTimes = function() {
      if (!confirm('将从排班系统同步排班时间到考勤记录（scheduled_check_in/out），确认？')) return;
      var filterStore = document.getElementById('filterStore').value;
      var dateFrom = document.getElementById('filterDateFrom').value;
      var dateTo = document.getElementById('filterDateTo').value;
      if (!filterStore) { alert('请先选择门店'); return; }
      var store = (window._stores||[]).find(function(x){return x.store_id===filterStore;});
      var storeName = store ? (store.schedule_store_name||store.name) : '';
      if (!storeName) { alert('门店未配置排班门店名'); return; }
      var cq = db.from('check_record').select('id,name,phone,date,store_id').eq('store_id',filterStore).limit(1000);
      if (dateFrom) cq = cq.gte('date', dateFrom);
      if (dateTo) cq = cq.lte('date', dateTo);
      cq.then(function(res) {
        var records = res.data || [];
        if (records.length === 0) { alert('没有匹配的考勤记录'); return; }
        // 按日期分组查询排班
        var dateMap = {};
        records.forEach(function(rec) { if (!dateMap[rec.date]) dateMap[rec.date] = []; dateMap[rec.date].push(rec); });
        var dates = Object.keys(dateMap);
        var done = 0; var total = records.length;
        alert('开始同步 ' + dates.length + ' 天共 ' + total + ' 条记录，请稍候...');
        dates.reduce(function(chain, date) {
          return chain.then(function() {
            var apiUrl = (SCHEDULE_CONFIG.apiUrl||'') + '/api/public/schedule?key=' + encodeURIComponent(SCHEDULE_CONFIG.apiKey||'schedule2026') + '&date=' + date + '&storeName=' + encodeURIComponent(storeName);
            return fetch(apiUrl, { headers: { 'ngrok-skip-browser-warning': '1' } }).then(function(r){return r.json();}).then(function(data){
              var staffMap = {};
              (data.stores||[]).forEach(function(st){ (st.locations||[]).forEach(function(loc){ (loc.staff||[]).forEach(function(stf){
                staffMap[String(stf.phone)] = { ti: stf.timeIn, to: stf.timeOut, loc: loc.location, shift: stf.shiftType };
              });});});
              var updates = [];
              (dateMap[date]||[]).forEach(function(rec) {
                var sch = staffMap[String(rec.phone)];
                if (!sch) return;
                updates.push(db.from('check_record').update({
                  scheduled_check_in: new Date(date + 'T' + sch.ti + ':00+08:00').toISOString(),
                  scheduled_check_out: new Date(date + 'T' + sch.to + ':00+08:00').toISOString(),
                  location: sch.loc,
                  _sync_origin: 'local', _sync_ts: new Date().toISOString()
                }).eq('id', rec.id));
              });
              if (updates.length === 0) return Promise.resolve();
              return Promise.all(updates).then(function(){ done += (dateMap[date]||[]).length; });
            }).catch(function(){ done += (dateMap[date]||[]).length; });
          });
        }, Promise.resolve()).then(function() {
          alert('同步完成，已处理 ' + total + ' 条记录'); loadRecords();
        });
      }).catch(function(e) { alert('同步失败: '+(e.message||'网络错误')); });
    };

    window.fixOnDuty = function() {
      if (!confirm('将查找当前门店+日期内，排班离岗时间未到但已写入离岗的记录，清除其离岗时间改为在岗中。确认？')) return;
      var filterStore = document.getElementById('filterStore').value;
      var dateFrom = document.getElementById('filterDateFrom').value;
      var dateTo = document.getElementById('filterDateTo').value;
      if (!filterStore) { alert('请先选择门店'); return; }
      var now = new Date().toISOString();
      var cq = db.from('check_record').select('id,name,scheduled_check_out,check_out').eq('store_id',filterStore).not('check_out','is',null).not('scheduled_check_out','is',null).limit(1000);
      if (dateFrom) cq = cq.gte('date', dateFrom);
      if (dateTo) cq = cq.lte('date', dateTo);
      cq.then(function(res) {
        var records = res.data || [];
        var toFix = records.filter(function(r) { return r.scheduled_check_out > now; });
        if (toFix.length === 0) { alert('没有需要修复的在岗记录（共检查 '+records.length+' 条有离岗记录）'); return; }
        if (!confirm('找到 ' + toFix.length + ' 条记录离岗时间未到但已写入：\n' + toFix.map(function(r){ return r.name + ' ' + r.check_out; }).join('\n') + '\n\n确认清除这些记录的离岗时间？')) return;
        Promise.all(toFix.map(function(r) {
          return db.from('check_record').update({ check_out: null, _sync_origin: 'local', _sync_ts: new Date().toISOString() }).eq('id', r.id);
        })).then(function() {
          alert('已修复 ' + toFix.length + ' 条记录');
          loadRecords();
        });
      }).catch(function(e) { alert('修复失败: '+(e.message||'网络错误')); });
    };

    window.syncScheduleLocation = function() {
      if (!confirm('将从排班系统同步最新的点位信息到考勤记录，确认？')) return;
      var filterStore = document.getElementById('filterStore').value;
      var date = document.getElementById('filterDateFrom').value;
      if (!filterStore || !date) { alert('请先选择门店和日期'); return; }
      var store = (window._stores||[]).find(function(s){return s.store_id===filterStore;});
      if (!store) { alert('门店不存在'); return; }
      var storeName = store.schedule_store_name || store.name;
      var apiUrl = (SCHEDULE_CONFIG.apiUrl||'') + '/api/public/schedule?key=' + encodeURIComponent(SCHEDULE_CONFIG.apiKey||'schedule2026') + '&date=' + date + '&storeName=' + encodeURIComponent(storeName);
      fetch(apiUrl, { headers: { 'ngrok-skip-browser-warning': '1' } }).then(function(r){return r.json();}).then(function(data){
        var staffList = [];
        (data.stores||[]).forEach(function(st){(st.locations||[]).forEach(function(loc){(loc.staff||[]).forEach(function(stf){
          if (stf.phone) staffList.push({phone:String(stf.phone), location:loc.location});
        });});});
        if (staffList.length === 0) { alert('未找到排班数据'); return; }
        // 查询所有匹配的打卡记录
        var phones = staffList.map(function(s){return s.phone;});
        db.from('check_record').select('id,location,phone').eq('store_id',filterStore).eq('date',date).in('phone',phones).then(function(cr){
          var recs = cr.data || [];
          var updates = [];
          staffList.forEach(function(stf){
            var rec = recs.find(function(r){return r.phone===stf.phone;});
            if (rec && rec.location !== stf.location) {
              updates.push(db.from('check_record').update({ location: stf.location, prev_location: rec.location, _sync_origin: 'local', _sync_ts: new Date().toISOString() }).eq('id', rec.id));
            }
          });
          if (updates.length === 0) { alert('所有记录点位已是最新'); return; }
          Promise.all(updates).then(function(){ alert('已同步 ' + updates.length + ' 条记录的点位'); loadRecords(); });
        });
      }).catch(function(e){ alert('同步失败: ' + (e.message||'网络错误')); });
    };
window.applyLocationWages = function() {
      if (!confirm('将按最新时薪规则批量应用到当前筛选的考勤记录，确认？')) return;
      var filterStore = document.getElementById('filterStore').value;
      var dateFrom = document.getElementById('filterDateFrom').value;
      var dateTo = document.getElementById('filterDateTo').value;
      if (!filterStore) { alert('请先选择门店'); return; }
      db.from('store').select('wage_mode').eq('store_id',filterStore).single().then(function(sr) {
        var mode = (sr.data && sr.data.wage_mode) || 'location';
        if (mode === 'person') {
          return Promise.all([
            db.from('roster').select('name,phone,hourly_wage').eq('store_id',filterStore),
            db.from('location_wage').select('*').eq('store_id',filterStore)
          ]).then(function(_ref) {
            var rr = _ref[0];
            var lw = _ref[1];
            var wageMap = {};
            var locationWageMap = {};
            (rr.data||[]).forEach(function(r) { if (r.phone && r.hourly_wage != null) wageMap[filterStore+'|'+r.phone] = r.hourly_wage; });
            (lw.data||[]).forEach(function(w) { locationWageMap[w.store_id+'|'+w.location] = w.hourly_wage; });
            if (Object.keys(wageMap).length===0 && Object.keys(locationWageMap).length===0) { alert('花名册中暂无设置个人时薪的员工，也暂无点位时薪设置'); return; }
            var cq = db.from('check_record').select('id,store_id,phone,location').eq('store_id',filterStore).limit(1000);
            if (dateFrom) cq = cq.gte('date', dateFrom);
            if (dateTo) cq = cq.lte('date', dateTo);
            return cq.then(function(res) {
              var records = res.data || [];
              var updates = [];
              records.forEach(function(rec) {
                var personKey = rec.store_id+'|'+rec.phone;
                var locationKey = rec.store_id+'|'+rec.location;
                var wage = wageMap[personKey] != null ? wageMap[personKey] : locationWageMap[locationKey];
                if (wage!=null) updates.push(db.from('check_record').update({hourly_wage:wage,_sync_origin:'local',_sync_ts:new Date().toISOString()}).eq('id',rec.id));
              });
              if (updates.length===0) { alert('没有匹配到需要更新的记录（个人时薪:'+Object.keys(wageMap).length+'人，点位时薪:'+Object.keys(locationWageMap).length+'个，记录:'+records.length+'条）'); return; }
              return Promise.all(updates).then(function(){ alert('已更新 '+updates.length+' 条记录的时薪'); loadRecords(); });
            });
          });
        }
        // 点位模式
        return db.from('location_wage').select('*').eq('store_id',filterStore).then(function(r) {
          var wages = r.data || [];
          if (wages.length===0) { alert('暂无点位时薪设置'); return; }
          var wageMap = {};
          wages.forEach(function(w){ wageMap[w.store_id+'|'+w.location]=w.hourly_wage; });
          var cq2 = db.from('check_record').select('id,store_id,location').eq('store_id',filterStore).limit(1000);
            if (dateFrom) cq2 = cq2.gte('date', dateFrom);
            if (dateTo) cq2 = cq2.lte('date', dateTo);
            return cq2.then(function(res) {
            var records = res.data || [];
            var updates = [];
            records.forEach(function(rec) {
              var key = rec.store_id+'|'+rec.location;
              if (wageMap[key]!=null) updates.push(db.from('check_record').update({hourly_wage:wageMap[key],_sync_origin:'local',_sync_ts:new Date().toISOString()}).eq('id',rec.id));
            });
            if (updates.length===0) { alert('没有匹配到需要更新的记录（点位:'+Object.keys(wageMap).length+'个，考勤:'+records.length+'条，含location:'+records.filter(function(r){return !!r.location;}).length+'条）'); return; }
            return Promise.all(updates).then(function(){ alert('已更新 '+updates.length+' 条记录的点位时薪'); loadRecords(); });
          });
        });
      }).catch(function(e) { alert('操作失败: '+(e.message||'网络错误')); });
    };

    // ====== 删除 ======
    window.deleteRecord = function(id) {
      if (!confirm('确认删除？')) return;
      db.from('check_record').delete().eq('id', id)
        .then(function(r) { if (r.error) throw r.error; loadRecords(); })
        .catch(function(e) { alert('删除失败: ' + (e.message || '网络错误')); });
    };
// --- from admin.html lines 1564-1576 ---
    // ====== 时间编辑弹窗 ======
    window._timeModalCb = null;

    function openTimeModal(title, info, dateVal, timeVal, showDate, cb) {
      document.getElementById('timeModalTitle').textContent = title;
      document.getElementById('timeModalInfo').textContent = info;
      document.getElementById('timeModalDate').value = dateVal;
      document.getElementById('timeModalTime').value = timeVal;
      document.getElementById('timeModalDateRow').style.display = showDate ? '' : 'none';
      document.getElementById('timeModalError').style.display = 'none';
      document.getElementById('timeModal').style.display = '';
      window._timeModalCb = cb;
    }
// --- from admin.html lines 1602-1649 ---
    window.setCheckOut = function(id, checkIn, checkOut) {
      var ci = new Date(checkIn);
      var co = checkOut ? new Date(checkOut) : null;
      var defDate = co ? (co.getFullYear() + '-' + ('0'+(co.getMonth()+1)).slice(-2) + '-' + ('0'+co.getDate()).slice(-2)) : (ci.getFullYear() + '-' + ('0'+(ci.getMonth()+1)).slice(-2) + '-' + ('0'+ci.getDate()).slice(-2));
      var defTime = co ? ('0'+co.getHours()).slice(-2) + ':' + ('0'+co.getMinutes()).slice(-2) : '18:00';
      openTimeModal('编辑离岗时间', '到岗时间：' + fmtDateTime(ci), defDate, defTime, true, function(dateVal, timeVal) {
        if (!dateVal || !timeVal) { showTimeErr('请填写完整的日期和时间'); return; }
        var dp = dateVal.split('-'), tp = timeVal.split(':');
        var y = parseInt(dp[0], 10), mo = parseInt(dp[1], 10) - 1, d = parseInt(dp[2], 10);
        var h = parseInt(tp[0], 10), m = parseInt(tp[1], 10);
        if (isNaN(y) || isNaN(mo) || isNaN(d) || isNaN(h) || isNaN(m)) { showTimeErr('格式不正确'); return; }
        var co = new Date(y, mo, d, h, m, 0);
        if (isNaN(co.getTime())) { showTimeErr('日期无效'); return; }
        if (co <= ci) { showTimeErr('离岗时间不能早于到岗时间'); return; }
        var nextDay = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate() + 1);
        var store = (window._stores || []).filter(function(s) { return s.store_id === window._adminStoreId; })[0];
        var cutoffH = (store && store.cutoff_hour != null) ? store.cutoff_hour : 2;
        var cutoffM = (store && store.cutoff_minute != null) ? store.cutoff_minute : 0;
        var maxCo = new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), cutoffH, cutoffM, 0);
        if (co > maxCo) { showTimeErr('最晚为次日 ' + ('0'+cutoffH).slice(-2) + ':' + ('0'+cutoffM).slice(-2)); return; }
        closeTimeModal();
        db.from('check_record').update({ check_out: co.toISOString(), _sync_origin: 'local', _sync_ts: new Date().toISOString() }).eq('id', id)
          .then(function(r) { if (r.error) throw r.error; loadRecords(); })
          .catch(function(e) { alert('设置失败: ' + (e.message || '网络错误')); });
      });
    };

    window.setCheckIn = function(id, checkIn, checkOutStr) {
      var ci = new Date(checkIn);
      var defTime = ('0'+ci.getHours()).slice(-2) + ':' + ('0'+ci.getMinutes()).slice(-2);
      var dateStr2 = ci.getFullYear() + '-' + ('0'+(ci.getMonth()+1)).slice(-2) + '-' + ('0'+ci.getDate()).slice(-2);
      openTimeModal('编辑到岗时间', '到岗日期：' + dateStr2 + '（不可修改）', dateStr2, defTime, false, function(dateVal, timeVal) {
        if (!timeVal) { showTimeErr('请填写时间'); return; }
        var tp = timeVal.split(':');
        var h = parseInt(tp[0], 10), m = parseInt(tp[1], 10);
        if (isNaN(h) || isNaN(m)) { showTimeErr('格式不正确'); return; }
        var newCi = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate(), h, m, 0);
        if (isNaN(newCi.getTime())) { showTimeErr('时间无效'); return; }
        if (checkOutStr) {
          var co = new Date(checkOutStr);
          if (newCi >= co) { showTimeErr('到岗时间不能晚于离岗时间'); return; }
        }
        closeTimeModal();
        db.from('check_record').update({ check_in: newCi.toISOString(), _sync_origin: 'local', _sync_ts: new Date().toISOString() }).eq('id', id)
          .then(function(r) { if (r.error) throw r.error; loadRecords(); })
          .catch(function(e) { alert('设置失败: ' + (e.message || '网络错误')); });
      });
    };
})();
