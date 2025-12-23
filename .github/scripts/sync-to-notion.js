const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const projectPageId = process.env.NOTION_PROJECT_PAGE_ID;

// ========== 配置区域 ==========
// 修改这里来指定要同步的文件
const SYNC_FILES = [
  'README.md',
  // 'docs/guide.md',
  // 添加更多文件...
];
// =============================

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
    } else if (line.trim() !== '' && line.trim()) {
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

async function syncFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath, '.md');
  const pageTitle = fileName.charAt(0).toUpperCase() + fileName.slice(1);
  const blocks = markdownToNotionBlocks(content);

  console.log(`Syncing: ${filePath} -> ${pageTitle}`);

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

  console.log(`Syncing ${SYNC_FILES.length} files to Notion`);

  for (const filePath of SYNC_FILES) {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${filePath}, skipping...`);
      continue;
    }
    try {
      await syncFile(filePath);
    } catch (error) {
      console.error(`Error syncing ${filePath}:`, error.message);
    }
  }
  console.log('Sync completed!');
}

main();
