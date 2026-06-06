# 时间本位网站

这是一个纯静态阅读网站，包含：

- `index.html`
- `styles.css`
- `script.js`
- `book.md`

部署时把本目录中的所有文件放到任意静态托管平台即可。

## 本地预览

在工作区根目录运行：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

然后访问：

```text
http://127.0.0.1:8765/time-site/
```

## GitHub Pages 部署

1. 新建一个公开仓库，例如 `time-ledger-site`。
2. 上传本目录里的全部文件到仓库根目录。
3. 打开仓库 `Settings -> Pages`。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择 `main`，目录选择 `/root`。
6. 保存后等待 GitHub Pages 生成公开网址。

## Vercel / Netlify / Cloudflare Pages

把本目录作为静态站点根目录部署即可，不需要构建命令。

```text
Build command: 留空
Output directory: .
```
