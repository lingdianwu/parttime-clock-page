// Module: admins
// Auto-extracted from admin.html
(function() {
  'use strict';
// --- from admin.html lines 1025-1194 ---

    function getSelectedPermissionsPt() {
      var modules = []; var storeIds = [];
      document.querySelectorAll('#moduleCheckboxesPt input:checked').forEach(function(cb) { modules.push(cb.value); });
      document.querySelectorAll('#storeCheckboxesPt input:checked').forEach(function(cb) { storeIds.push(cb.value); });
      return { modules: modules, storeIds: storeIds };
    }

    window.renderPermCheckboxesPt = function(selectedModules, selectedStoreIds) {
      var mcDiv = document.getElementById('moduleCheckboxesPt');
      mcDiv.innerHTML = ALL_MODULES_PT.map(function(m) {
        return '<label class="perm-checkbox"><input type="checkbox" value="' + m.key + '"' +
          (selectedModules.indexOf(m.key) !== -1 ? ' checked' : '') + '> ' + m.label + '</label>';
      }).join('');
      var scDiv = document.getElementById('storeCheckboxesPt');
      var selIds = (selectedStoreIds || []).map(String);
      scDiv.innerHTML = (window._stores || []).map(function(s) {
        return '<label class="perm-checkbox"><input type="checkbox" value="' + s.store_id + '"' +
          (selIds.indexOf(String(s.store_id)) !== -1 ? ' checked' : '') + '> ' + escHtml(s.name) + '</label>';
      }).join('');
    }

    window.resetAdminFormPt = function() {
      document.getElementById('editingAdminIdPt').value = '';
      document.getElementById('adminUsername').value = '';
      document.getElementById('adminName').value = '';
      document.getElementById('adminPhone').value = '';
      document.getElementById('adminPwd').value = '';
      document.getElementById('adminRoleSelectPt').value = '管理员';
      document.getElementById('adminRoleSelectPt').disabled = false;
      document.getElementById('adminSubmitBtnPt').textContent = '添加';
      document.getElementById('adminCancelEditBtnPt').style.display = 'none';
      renderPermCheckboxesPt([], []);
      document.querySelectorAll('#moduleCheckboxesPt input, #storeCheckboxesPt input').forEach(function(cb) { cb.disabled = false; });
    };

    // 角色切换：超管自动全选
    document.getElementById('adminRoleSelectPt').addEventListener('change', function() {
      var isSuper = this.value === '超级管理员';
      document.querySelectorAll('#moduleCheckboxesPt input, #storeCheckboxesPt input').forEach(function(cb) {
        if (isSuper) { cb.checked = true; cb.disabled = true; } else { cb.disabled = false; }
      });
    });

    window.addAdminUser = function() {
      var editingId = document.getElementById('editingAdminIdPt').value;
      var sid = document.getElementById('adminStore').value;
      var username = document.getElementById('adminUsername').value.trim();
      var name = document.getElementById('adminName').value.trim();
      var phone = document.getElementById('adminPhone').value.trim();
      var pwd = document.getElementById('adminPwd').value.trim();
      var role = document.getElementById('adminRoleSelectPt').value;
      var perms = getSelectedPermissionsPt();
      if (!sid) { alert('请选择门店'); return; }
      if (!username) { alert('请输入登录账号'); return; }
      if (!name) { alert('请输入姓名'); return; }

      if (editingId) {
        // 编辑模式：更新权限
        var updateData = { username: username, name: name, phone: phone || '', store_id: sid };
        if (pwd && pwd.length >= 4) updateData.password = pwd;
        if (role === '超级管理员') {
          updateData['模块权限'] = null; updateData['门店权限'] = null;
        } else {
          updateData['模块权限'] = perms.modules.length ? JSON.stringify(perms.modules) : null;
          updateData['门店权限'] = perms.storeIds.length ? JSON.stringify(perms.storeIds) : null;
        }
        db.from('admin_user').update(updateData).eq('id', editingId)
          .then(function(r) { if (r.error) throw r.error; resetAdminFormPt(); loadAdminList(); })
          .catch(function(e) { alert('保存失败: ' + (e.message || '网络错误')); });
      } else {
        // 新建模式
        if (!pwd || pwd.length < 4) { alert('密码至少4位'); return; }
        var insertData = { store_id: sid, username: username, name: name, phone: phone || '', password: pwd };
        if (role === '超级管理员') {
          insertData['模块权限'] = null; insertData['门店权限'] = null;
        } else {
          insertData['模块权限'] = perms.modules.length ? JSON.stringify(perms.modules) : null;
          insertData['门店权限'] = perms.storeIds.length ? JSON.stringify(perms.storeIds) : null;
        }
        db.from('admin_user').select('id').eq('username', username).single()
          .then(function(r) { if (r.data) { alert('该账号已存在'); return Promise.reject('dup'); }
            return db.from('admin_user').insert(insertData);
          }).then(function(res) {
            if (res && res.error) throw res.error;
            resetAdminFormPt(); loadAdminList();
          }).catch(function(e) { if (e !== 'dup') alert('添加失败: ' + (e.message || '网络错误')); });
      }
    };
    window.delAdminUser = function(id) {
      if (!confirm('确认删除？')) return;
      db.from('admin_user').delete().eq('id', id)
        .then(function(r) { if (r.error) throw r.error; loadAdminList(); })
        .catch(function(e) { alert('删除失败: ' + (e.message || '网络错误')); });
    };

    window.saveAdminUser = function(id) {
      var disabled = document.getElementById('ad-' + id).value === '1';
      db.from('admin_user').update({ disabled: disabled }).eq('id', id)
        .then(function(r) { if (r.error) throw r.error; loadAdminList(); })
        .catch(function(e) { alert('保存失败: ' + (e.message || '网络错误')); });
    };
    window.loadAdminList = function() {
      db.from('admin_user').select('*').order('store_id').order('name')
        .then(function(r) {
          if (r.error) throw r.error;
          var list = r.data || [];
          if (list.length === 0) {
            document.getElementById('adminListContainer').innerHTML = '<div class="empty-state">暂无管理员账号</div>';
            return;
          }
          document.getElementById('adminListContainer').innerHTML =
            '<table class="roster-table"><thead><tr><th>门店</th><th>登录账号</th><th>姓名</th><th>手机号</th><th>权限</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
            list.map(function(a) {
              var mods = parseJsonField(a['模块权限']);
              var stores = parseJsonField(a['门店权限']);
              var permSummary;
              if (!a['模块权限'] && !a['门店权限']) {
                permSummary = '<span style="color:#999">全部</span>';
              } else {
                permSummary = (mods.length || '全部') + '模块 / ' + (stores.length || '1') + '门店';
              }
              return '<tr>' +
                '<td>' + escHtml(gSN(a.store_id)) + '</td>' +
                '<td style="font-weight:600">' + escHtml(a.username || a.name) + '</td>' +
                '<td>' + escHtml(a.name) + '</td>' +
                '<td>' + (a.phone||'--') + '</td>' +
                '<td style="font-size:12px">' + permSummary + '</td>' +
                '<td><select id="ad-' + a.id + '" style="padding:4px 6px;font-size:13px;border:1px solid #d0d7e2;border-radius:6px;outline:none;background:#fff">' +
                '<option value="0"' + (!a.disabled ? ' selected' : '') + '>启用</option>' +
                '<option value="1"' + (a.disabled ? ' selected' : '') + '>禁用</option></select></td>' +
                '<td style="white-space:nowrap">' +
                '<button class="btn-success" onclick="editAdminUserPt(\'' + a.id + '\')" style="margin-right:4px">权限</button>' +
                '<button class="btn-success" onclick="saveAdminUser(\'' + a.id + '\')" style="margin-right:4px">保存</button>' +
                '<button class="btn-danger" onclick="delAdminUser(\'' + a.id + '\')">删除</button></td>' +
                '</tr>';
            }).join('') + '</tbody></table>';
        });
    }

    window.editAdminUserPt = function(id) {
      db.from('admin_user').select('*').eq('id', id).single()
        .then(function(r) {
          if (r.error || !r.data) { alert('未找到该管理员'); return; }
          var a = r.data;
          document.getElementById('editingAdminIdPt').value = a.id;
          document.getElementById('adminStore').value = a.store_id;
          document.getElementById('adminUsername').value = a.username || '';
          document.getElementById('adminName').value = a.name;
          document.getElementById('adminPhone').value = a.phone || '';
          document.getElementById('adminPwd').value = '';
          document.getElementById('adminRoleSelectPt').value = '管理员';
          document.getElementById('adminRoleSelectPt').disabled = true;
          document.getElementById('adminSubmitBtnPt').textContent = '保存权限';
          document.getElementById('adminCancelEditBtnPt').style.display = '';
          var mods = parseJsonField(a['模块权限']);
          var stores = parseJsonField(a['门店权限']);
          if (!a['模块权限'] && !a['门店权限']) {
            // 未配置 = 全部
            mods = ALL_MODULES_PT.map(function(m) { return m.key; });
            stores = (window._stores || []).map(function(s) { return s.store_id; });
            document.getElementById('adminRoleSelectPt').value = '超级管理员';
          }
          renderPermCheckboxesPt(mods, stores);
          if (document.getElementById('adminRoleSelectPt').value === '超级管理员') {
            document.querySelectorAll('#moduleCheckboxesPt input, #storeCheckboxesPt input').forEach(function(cb) { cb.checked = true; cb.disabled = true; });
          }
          document.getElementById('tab-admins').scrollIntoView();
        });
    };
})();
