# 兼职打卡 GitHub Pages 版本

这个目录用于部署员工打卡页到 GitHub Pages。

## 已配置内容

- 员工打卡页：`index.html`
- GPS 定位校验：已恢复
- Supabase 数据库：沿用现有项目
- 排班 API：通过 Supabase Edge Function HTTPS 代理访问

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

员工门店二维码里的链接需要换成这个 GitHub Pages 地址，并保留原来的 `?store=门店ID&code=...` 参数。
