# Notion-GitHub Sync Template

GitHub ↔ Notion 双向同步模板

## 功能

- GitHub → Notion: Push 时自动同步 Markdown 到 Notion
- Notion → GitHub: 定时同步 Notion 内容回 GitHub
- 保留 Markdown 标题、列表、代码块等格式

## 使用方法

### 1. 创建 Notion Integration

1. 访问 https://www.notion.so/my-integrations
2. 创建新的 Integration
3. 复制 Internal Integration Token

### 2. 配置 Notion 页面

1. 在 Notion 中创建一个项目页面
2. 点击页面右上角 "..." → "Connections" → 添加你的 Integration
3. 复制页面 URL 中的 ID（格式：`notion.so/页面名-{PAGE_ID}`）

### 3. 配置 GitHub Secrets

在仓库 Settings → Secrets → Actions 添加：

| Secret | 值 |
|--------|---|
| `NOTION_TOKEN` | 你的 Integration Token |
| `NOTION_PROJECT_PAGE_ID` | Notion 页面 ID |

### 4. 自定义同步文件

编辑 `.github/scripts/sync-to-notion.js` 中的 `SYNC_FILES` 数组：

```javascript
const SYNC_FILES = [
  'README.md',
  'docs/guide.md',
  // 添加更多文件...
];
```

编辑 `.github/scripts/sync-from-notion.js` 中的 `PAGE_FILE_MAP`：

```javascript
const PAGE_FILE_MAP = {
  'Readme': 'README.md',
  'Guide': 'docs/guide.md',
  // Notion页面名 -> 本地文件路径
};
```

### 5. 调整同步频率

编辑 `.github/workflows/sync-from-notion.yml` 中的 cron：

```yaml
schedule:
  - cron: '0 */2 * * *'  # 每2小时
  # - cron: '*/30 * * * *'  # 每30分钟
  # - cron: '0 * * * *'  # 每小时
```

## 触发方式

- **GitHub → Notion**: Push 到 main 分支时自动触发
- **Notion → GitHub**: 定时任务或手动触发
- **手动触发**: Actions 页面 → 选择 workflow → Run workflow

## License

MIT
