# 兼职打卡 GitHub Pages 版本

这个目录用于部署员工打卡页到 GitHub Pages（旧二维码仍指向此地址）。

## 架构

```
GitHub Pages 静态页
    ↓ POST /api/public/query
csjy.site/checkin-new → NAS PartTimeClock → MySQL（兼职打卡库）
    ↓ GET /api/public/schedule
csjy.site → NAS Project → 排班数据
```

旧二维码 URL 无需更换，打卡数据已写入 NAS MySQL，与新系统共用同一数据库。

## 已配置内容

- 员工打卡页：`index.html`
- GPS 定位校验：已恢复
- 数据库：NAS MySQL（通过 PartTimeClock API）
- 排班 API：Project 系统公网接口

## GitHub Pages 设置

1. 新建一个 GitHub 仓库，例如 `parttime-clock-page`
2. 上传本目录内所有文件到仓库根目录
3. 进入仓库 `Settings` → `Pages`
4. Source 选择 `Deploy from a branch`
5. Branch 选择 `main`，目录选择 `/root`
6. 保存后等待 GitHub 生成 HTTPS 地址

生成后的地址类似：

```text
https://你的GitHub用户名.github.io/parttime-clock-page/
```

员工门店二维码里的链接可继续使用此地址，并保留原来的 `?store=门店ID&code=...` 参数。

## 部署更新

修改代码后推送到 GitHub 仓库即可，无需改 NAS 配置。

```bash
cd github-pages-clock
git add -A && git commit -m "..." && git push
```
