// ============================================
// PartTimeClock API 适配层
// 替代 Supabase JS SDK，将方法链调用转为后端 API 请求
// 用法：与原来完全一致，只需将 supabase.min.js 替换为本文件
// ============================================

var PTCClient = (function() {
  'use strict';

  function PTCClient(baseUrl) {
    this._baseUrl = baseUrl || '';
    this._token = null;
    this._endpoint = 'api/public/query'; // 默认使用公开端点
  }

  // 设置认证 token（管理员登录后调用）
  PTCClient.prototype.setToken = function(token) {
    this._token = token;
    // 有 token 时使用需认证的端点
    this._endpoint = 'api/query';
  };

  // 清除认证
  PTCClient.prototype.clearToken = function() {
    this._token = null;
    this._endpoint = 'api/public/query';
  };

  PTCClient.prototype.from = function(table) {
    return new QueryBuilder(this, table);
  };

  // ---- QueryBuilder ----

  function QueryBuilder(client, table) {
    this._client = client;
    this._table = table;
    this._operation = 'select';
    this._selectCols = ['*'];
    this._filters = [];
    this._orders = [];
    this._limitVal = null;
    this._isSingle = false;
    this._isMaybeSingle = false;
    this._dataObj = null;
    this._upsertOpts = null;
    this._returning = null;
  }

  // ---- 查询设置 ----

  QueryBuilder.prototype.select = function(columns, options) {
    // insert/update 后的 .select() 表示 returning 列，不改变操作类型
    if (this._operation === 'insert' || this._operation === 'update' ||
        this._operation === 'upsert' || this._operation === 'delete') {
      if (typeof columns === 'string') {
        this._returning = columns.split(',').map(function(c) { return c.trim(); });
      } else if (Array.isArray(columns)) {
        this._returning = columns;
      } else {
        this._returning = ['*'];
      }
      return this;
    }
    this._operation = 'select';
    if (typeof columns === 'string') {
      this._selectCols = columns.split(',').map(function(c) { return c.trim(); });
    } else if (Array.isArray(columns)) {
      this._selectCols = columns;
    }
    return this;
  };

  // ---- 过滤条件 ----

  QueryBuilder.prototype.eq = function(column, value) {
    this._filters.push({ column: column, op: 'eq', value: value });
    return this;
  };

  QueryBuilder.prototype.neq = function(column, value) {
    this._filters.push({ column: column, op: 'neq', value: value });
    return this;
  };

  QueryBuilder.prototype.gt = function(column, value) {
    this._filters.push({ column: column, op: 'gt', value: value });
    return this;
  };

  QueryBuilder.prototype.gte = function(column, value) {
    this._filters.push({ column: column, op: 'gte', value: value });
    return this;
  };

  QueryBuilder.prototype.lt = function(column, value) {
    this._filters.push({ column: column, op: 'lt', value: value });
    return this;
  };

  QueryBuilder.prototype.lte = function(column, value) {
    this._filters.push({ column: column, op: 'lte', value: value });
    return this;
  };

  QueryBuilder.prototype.in = function(column, values) {
    this._filters.push({ column: column, op: 'in', value: values });
    return this;
  };

  QueryBuilder.prototype.is = function(column, value) {
    this._filters.push({ column: column, op: 'is', value: value });
    return this;
  };

  QueryBuilder.prototype.not = function(column, op, value) {
    this._filters.push({ column: column, op: 'not', subOp: op, value: value });
    return this;
  };

  // ---- 排序/限制 ----

  QueryBuilder.prototype.order = function(column, options) {
    this._orders.push({
      column: column,
      ascending: !(options && options.ascending === false)
    });
    return this;
  };

  QueryBuilder.prototype.limit = function(n) {
    this._limitVal = n;
    return this;
  };

  // ---- 单条结果 ----

  QueryBuilder.prototype.single = function() {
    this._isSingle = true;
    return this;
  };

  QueryBuilder.prototype.maybeSingle = function() {
    this._isMaybeSingle = true;
    return this;
  };

  // ---- 写操作 ----

  QueryBuilder.prototype.insert = function(data) {
    this._operation = 'insert';
    this._dataObj = data;
    this._returning = ['*'];
    return this;
  };

  QueryBuilder.prototype.update = function(data) {
    this._operation = 'update';
    this._dataObj = data;
    this._returning = ['*'];
    return this;
  };

  QueryBuilder.prototype.delete = function() {
    this._operation = 'delete';
    this._returning = ['*'];
    return this;
  };

  QueryBuilder.prototype.upsert = function(data, options) {
    this._operation = 'upsert';
    this._dataObj = data;
    this._upsertOpts = options || {};
    this._returning = ['*'];
    return this;
  };

  // ---- 执行 ----

  QueryBuilder.prototype.then = function(resolve, reject) {
    return this._execute().then(resolve).catch(reject);
  };

  QueryBuilder.prototype._execute = function() {
    var self = this;
    var body = {
      table: self._table,
      operation: self._operation,
      select: self._selectCols,
      filters: self._filters,
      order: self._orders,
      limit: self._limitVal,
      single: self._isSingle || self._isMaybeSingle,
      data: self._dataObj,
      upsert: self._upsertOpts,
      returning: self._returning
    };

    var headers = { 'Content-Type': 'application/json' };
    if (self._client._token) {
      headers['Authorization'] = 'Bearer ' + self._client._token;
    }

    return Promise.race([
      fetch(self._client._baseUrl + self._client._endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      }),
      new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('请求超时，请检查网络')); }, 12000);
      })
    ]).then(function(res) {
      return res.json().then(function(result) {
        if (!res.ok) {
          var msg = (result && (result.message || (result.error && result.error.message))) || ('HTTP ' + res.status);
          return { data: null, error: { message: msg, code: String(res.status) } };
        }
        if (result && result.success === false && !result.data && !result.error) {
          return { data: null, error: { message: result.message || '请求失败' } };
        }
        // maybeSingle: 未找到时不报错
        if (self._isMaybeSingle && result.error && result.error.code === 'PGRST116') {
          return { data: null, error: null };
        }
        return result;
      });
    }).catch(function(err) {
      return { data: null, error: { message: err.message || '网络错误' } };
    });
  };

  // ---- 导出 ----
  return PTCClient;
})();
