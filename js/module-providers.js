// Module: providers
// Auto-extracted from admin.html
(function() {
  'use strict';
// --- from admin.html lines 855-922 ---
    window.addProvider = function() {
      var name = document.getElementById('providerName').value.trim();
      var rate = parseFloat(document.getElementById('providerRate').value);
      if (!name) { alert('请输入第三方名称'); return; }
      if (isNaN(rate) || rate < 0) { alert('请输入有效的服务费（元/小时）'); return; }
      db.from('service_provider').insert({ name: name, hourly_rate: rate })
        .then(function(res) {
          if (res.error) throw res.error;
          document.getElementById('providerName').value = '';
          document.getElementById('providerRate').value = '';
          loadProviders().then(function() { loadProviderList(); });
        }).catch(function(e) { alert('添加失败: ' + (e.message || '网络错误')); });
    };

    window.loadProviderList = function() {
      var provs = window._providers || [];
      if (provs.length === 0) {
        document.getElementById('providerListContainer').innerHTML = '<div class="empty-state">暂无第三方</div>';
        return;
      }
      var canEdit = hasModulePt('edit_provider');
      var canDelete = hasModulePt('delete_provider');
      document.getElementById('providerListContainer').innerHTML =
        '<table class="roster-table"><thead><tr><th>名称</th><th>服务费(元/小时)</th><th>注册码</th><th>操作</th></tr></thead><tbody>' +
        provs.map(function(p) {
          var regUrl = location.origin + location.pathname.replace(/admin\.html$/, 'register.html') + '?provider=' + p.id;
          return '<tr>' +
            (canEdit
              ? '<td><input type="text" id="pname-' + p.id + '" value="' + escHtml(p.name) + '" style="width:140px;padding:4px 8px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none"></td>'
              : '<td>' + escHtml(p.name) + '</td>') +
            (canEdit
              ? '<td><input type="number" id="prate-' + p.id + '" value="' + p.hourly_rate + '" step="0.01" min="0" style="width:90px;padding:4px 8px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none"></td>'
              : '<td>' + p.hourly_rate + '元/小时</td>') +
            '<td><button class="btn-success" onclick="showRegQr(\'' + p.id + '\',\'' + escJs(p.name) + '\')" style="font-size:12px;padding:4px 8px">注册二维码</button></td>' +
            '<td>' + (canEdit ? '<button class="btn-success" onclick="saveProvider(\'' + p.id + '\')" style="margin-right:4px">保存</button>' : '') +
            (canDelete ? '<button class="btn-danger" onclick="delProvider(\'' + p.id + '\')">删除</button>' : '') + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table>';
    }

    window.saveProvider = function(id) {
      var name = document.getElementById('pname-' + id).value.trim();
      var rate = parseFloat(document.getElementById('prate-' + id).value);
      if (!name) { alert('名称不能为空'); return; }
      if (isNaN(rate) || rate < 0) { alert('请输入有效的服务费'); return; }
      db.from('service_provider').update({ name: name, hourly_rate: rate }).eq('id', id)
        .then(function(r) { if (r.error) throw r.error; loadProviders().then(function() { loadProviderList(); }); })
        .catch(function(e) { alert('保存失败: ' + (e.message || '网络错误')); });
    };

    window.delProvider = function(id) {
      if (!confirm('确认删除？')) return;
      db.from('service_provider').delete().eq('id', id)
        .then(function(r) { if (r.error) throw r.error; loadProviders().then(function() { loadProviderList(); }); })
        .catch(function(e) { alert('删除失败: ' + (e.message || '网络错误')); });
    };

    window.showRegQr = function(id, name) {
      var url = location.origin + location.pathname.replace(/admin\.html$/, 'register.html') + '?provider=' + id;
      document.getElementById('regQrTitle').textContent = name + ' - 注册二维码';
      document.getElementById('regQrUrl').textContent = url;
      document.getElementById('regQrContainer').innerHTML = '';
      document.getElementById('regQrModal').style.display = '';
      document.getElementById('regQrContainer').setAttribute('data-name', name);
      new QRCode(document.getElementById('regQrContainer'), {
        text: url, width: 200, height: 200, colorDark: '#000', colorLight: '#fff'
      });
    };
})();
