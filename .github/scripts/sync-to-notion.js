const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const projectPageId = process.env.NOTION_PROJECT_PAGE_ID;

// ========== 配置区域 ==========
// 要同步的目录（会递归扫描）
const SYNC_DIRS = [
  '.',           // 根目录
  // 'docs',     // docs 目录
  // 'src',      // src 目录
];

// 排除的文件/目录
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.github',
  '.kiro',
  'package.json',
  'package-lock.json',
  '.gitignore',
  '.DS_Store',
];

// 支持双向同步的扩展名（Markdown）
const BIDIRECTIONAL_EXTENSIONS = ['.md'];

// 支持单向同步的代码文件扩展名
const CODE_EXTENSIONS = {
  '.js': 'javascript',
  '.ts': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.cpp': 'cpp',
  '.c': 'c',
  '.css': 'css',
  '.html': 'html',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.sql': 'sql',
  '.sh': 'bash',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.vue': 'javascript',
  '.jsx': 'javascript',
  '.tsx': 'typescript',
};

// 图片扩展名
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
// =============================

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (shouldExclude(filePath)) continue;
    
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function markdownToNotionBlocks(content) {
  const blocks = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4) } }] }
      });
    } else if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3) } }] }
      });
    } else if (line.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] }
      });
    } else if (line.startsWith('```')) {
      const lang = line.slice(3) || 'plain text';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }],
          language: lang.toLowerCase() === '' ? 'plain text' : lang.toLowerCase()
        }
      });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] }
      });
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: [{ type: 'text', text: { content: line.replace(/^\d+\.\s/, '') } }] }
      });
    } else if (line.trim() !== '') {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: line } }] }
      });
    }
    i++;
  }
  return blocks;
}

function codeFileToNotionBlocks(content, language, filePath) {
  const blocks = [];
  
  // 文件路径标题
  blocks.push({
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [{ type: 'text', text: { content: `📄 ${filePath}` } }],
      icon: { emoji: '📄' }
    }
  });
  
  // 代码内容（Notion 限制每个 block 2000 字符）
  const maxChunkSize = 1900;
  for (let i = 0; i < content.length; i += maxChunkSize) {
    blocks.push({
      object: 'block',
      type: 'code',
      code: {
        rich_text: [{ type: 'text', text: { content: content.slice(i, i + maxChunkSize) } }],
        language: language
      }
    });
  }
  
  return blocks;
}

function imageFileToNotionBlocks(filePath, repoUrl) {
  const rawUrl = `${repoUrl}/raw/main/${filePath}`;
  return [{
    object: 'block',
    type: 'image',
    image: {
      type: 'external',
      external: { url: rawUrl }
    }
  }];
}

function otherFileToNotionBlocks(filePath, repoUrl) {
  const fileUrl = `${repoUrl}/blob/main/${filePath}`;
  return [{
    object: 'block',
    type: 'bookmark',
    bookmark: { url: fileUrl }
  }];
}

async function findPageByTitle(parentId, title) {
  const blocks = await notion.blocks.children.list({ block_id: parentId });
  for (const block of blocks.results) {
    if (block.type === 'child_page' && block.child_page.title === title) {
      return block.id;
    }
  }
  return null;
}

async function clearPageContent(pageId) {
  const blocks = await notion.blocks.children.list({ block_id: pageId });
  for (const block of blocks.results) {
    await notion.blocks.delete({ block_id: block.id });
  }
}

async function syncFile(filePath, repoUrl) {
  const ext = path.extname(filePath).toLowerCase();
  const pageTitle = filePath.replace(/\//g, ' - ').replace(ext, '');
  
  let blocks = [];
  let syncType = '';
  
  if (BIDIRECTIONAL_EXTENSIONS.includes(ext)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    blocks = markdownToNotionBlocks(content);
    syncType = 'markdown';
  } else if (CODE_EXTENSIONS[ext]) {
    const content = fs.readFileSync(filePath, 'utf-8');
    blocks = codeFileToNotionBlocks(content, CODE_EXTENSIONS[ext], filePath);
    syncType = 'code';
  } else if (IMAGE_EXTENSIONS.includes(ext)) {
    blocks = imageFileToNotionBlocks(filePath, repoUrl);
    syncType = 'image';
  } else {
    blocks = otherFileToNotionBlocks(filePath, repoUrl);
    syncType = 'other';
  }

  console.log(`Syncing [${syncType}]: ${filePath}`);

  const existingPageId = await findPageByTitle(projectPageId, pageTitle);

  if (existingPageId) {
    await clearPageContent(existingPageId);
    for (let i = 0; i < blocks.length; i += 100) {
      await notion.blocks.children.append({
        block_id: existingPageId,
        children: blocks.slice(i, i + 100)
      });
    }
    console.log(`  Updated: ${pageTitle}`);
  } else {
    const page = await notion.pages.create({
      parent: { page_id: projectPageId },
      properties: { title: { title: [{ text: { content: pageTitle } }] } }
    });
    for (let i = 0; i < blocks.length; i += 100) {
      await notion.blocks.children.append({
        block_id: page.id,
        children: blocks.slice(i, i + 100)
      });
    }
    console.log(`  Created: ${pageTitle}`);
  }
}

async function main() {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_PROJECT_PAGE_ID) {
    console.error('Missing NOTION_TOKEN or NOTION_PROJECT_PAGE_ID');
    process.exit(1);
  }

  const repoUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
    : 'https://github.com/your-repo';

  let allFiles = [];
  for (const dir of SYNC_DIRS) {
    allFiles = allFiles.concat(getAllFiles(dir));
  }
  allFiles = [...new Set(allFiles)];
  
  console.log(`Found ${allFiles.length} files to sync`);

  for (const filePath of allFiles) {
    try {
      await syncFile(filePath, repoUrl);
    } catch (error) {
      console.error(`Error syncing ${filePath}:`, error.message);
    }
  }
  console.log('Sync completed!');
}

main();
