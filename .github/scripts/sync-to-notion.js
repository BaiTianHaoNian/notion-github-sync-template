const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
const https = require('https');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const projectPageId = process.env.NOTION_PROJECT_PAGE_ID;

// ========== 配置区域 ==========
const SYNC_DIRS = ['.'];

const EXCLUDE_PATTERNS = [
  'node_modules', '.git', '.github', '.kiro',
  'package.json', 'package-lock.json', '.gitignore', '.DS_Store',
  'dist', 'build', '.cache', 'coverage',
];

const BIDIRECTIONAL_EXTENSIONS = ['.md'];

const CODE_EXTENSIONS = {
  '.abap': 'abap', '.arduino': 'arduino', '.bash': 'bash', '.basic': 'basic',
  '.c': 'c', '.clj': 'clojure', '.clojure': 'clojure', '.coffee': 'coffeescript',
  '.cpp': 'c++', '.cc': 'c++', '.cxx': 'c++', '.cs': 'c#', '.css': 'css',
  '.dart': 'dart', '.diff': 'diff', '.docker': 'docker', '.dockerfile': 'docker',
  '.elixir': 'elixir', '.ex': 'elixir', '.elm': 'elm', '.erb': 'ruby',
  '.erl': 'erlang', '.flow': 'flow', '.f': 'fortran', '.f90': 'fortran',
  '.fs': 'f#', '.gherkin': 'gherkin', '.feature': 'gherkin',
  '.glsl': 'glsl', '.go': 'go', '.graphql': 'graphql', '.gql': 'graphql',
  '.groovy': 'groovy', '.haskell': 'haskell', '.hs': 'haskell',
  '.html': 'html', '.htm': 'html', '.java': 'java', '.js': 'javascript',
  '.mjs': 'javascript', '.cjs': 'javascript', '.json': 'json',
  '.jsonc': 'json', '.julia': 'julia', '.jl': 'julia',
  '.kt': 'kotlin', '.kts': 'kotlin', '.latex': 'latex', '.tex': 'latex',
  '.less': 'less', '.lisp': 'lisp', '.cl': 'lisp', '.livescript': 'livescript',
  '.ls': 'livescript', '.lua': 'lua', '.makefile': 'makefile', '.mk': 'makefile',
  '.md': 'markdown', '.markup': 'markup', '.matlab': 'm', '.m': 'matlab',
  '.mermaid': 'mermaid', '.nix': 'nix', '.objc': 'objective-c',
  '.ocaml': 'ocaml', '.ml': 'ocaml', '.pascal': 'pascal', '.pas': 'pascal',
  '.perl': 'perl', '.pl': 'perl', '.php': 'php', '.txt': 'plain text',
  '.text': 'plain text', '.ps1': 'powershell', '.psm1': 'powershell',
  '.proto': 'protobuf', '.py': 'python', '.pyw': 'python',
  '.r': 'r', '.R': 'r', '.reason': 'reason', '.re': 'reason',
  '.rb': 'ruby', '.rs': 'rust', '.sass': 'sass', '.scala': 'scala',
  '.sc': 'scala', '.scheme': 'scheme', '.scm': 'scheme', '.scss': 'scss',
  '.sh': 'shell', '.zsh': 'shell', '.fish': 'shell',
  '.sql': 'sql', '.swift': 'swift', '.ts': 'typescript', '.mts': 'typescript',
  '.cts': 'typescript', '.tsx': 'typescript', '.jsx': 'javascript',
  '.vb': 'vb.net', '.vbs': 'vb.net', '.verilog': 'verilog', '.v': 'verilog',
  '.vhdl': 'vhdl', '.vhd': 'vhdl', '.vue': 'vue',
  '.wasm': 'webassembly', '.xml': 'xml', '.xsl': 'xml', '.xslt': 'xml',
  '.yaml': 'yaml', '.yml': 'yaml', '.zig': 'zig',
  '.env': 'shell', '.gitattributes': 'shell', '.editorconfig': 'shell',
  '.prettierrc': 'json', '.eslintrc': 'json', '.babelrc': 'json',
  '.npmrc': 'shell', '.nvmrc': 'shell',
  '.toml': 'toml', '.ini': 'ini', '.cfg': 'ini', '.conf': 'shell',
  '.log': 'plain text', '.csv': 'plain text',
};

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'];
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.7z', '.tar', '.gz'];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const LANGUAGE_ALIAS_MAP = {
  'sh': 'shell', 'bash': 'shell', 'zsh': 'shell', 'fish': 'shell',
  'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
  'py': 'python', 'py3': 'python', 'python3': 'python',
  'htm': 'html', 'scss': 'scss', 'less': 'less',
  'yml': 'yaml', 'jsonc': 'json', 'json5': 'json',
  'c++': 'c++', 'cpp': 'c++', 'cc': 'c++', 'cxx': 'c++',
  'rb': 'ruby', 'rs': 'rust', 'kt': 'kotlin', 'cs': 'c#',
  'md': 'markdown', 'tex': 'latex', 'dockerfile': 'docker',
  'sql': 'sql', 'text': 'plain text', 'txt': 'plain text', '': 'plain text'
};

const NOTION_LANGUAGES = new Set([
  'abap', 'arduino', 'bash', 'basic', 'c', 'clojure', 'coffeescript', 'c++', 'c#',
  'css', 'dart', 'diff', 'docker', 'elixir', 'elm', 'erlang', 'flow', 'fortran',
  'f#', 'gherkin', 'glsl', 'go', 'graphql', 'groovy', 'haskell', 'html', 'java',
  'javascript', 'json', 'julia', 'kotlin', 'latex', 'less', 'lisp', 'livescript',
  'lua', 'makefile', 'markdown', 'markup', 'matlab', 'mermaid', 'nix', 'objective-c',
  'ocaml', 'pascal', 'perl', 'php', 'plain text', 'powershell', 'prolog', 'protobuf',
  'python', 'r', 'reason', 'ruby', 'rust', 'sass', 'scala', 'scheme', 'scss',
  'shell', 'sql', 'swift', 'typescript', 'vb.net', 'verilog', 'vhdl', 'visual basic',
  'webassembly', 'xml', 'yaml', 'toml', 'ini', 'vue'
]);

function normalizeLanguage(lang) {
  if (!lang || lang.trim() === '') return 'plain text';
  const normalized = lang.toLowerCase().trim();
  if (LANGUAGE_ALIAS_MAP[normalized]) return LANGUAGE_ALIAS_MAP[normalized];
  if (NOTION_LANGUAGES.has(normalized)) return normalized;
  return 'plain text';
}

const folderPageCache = {};

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

// ========== HTTP请求辅助函数 ==========
function httpsRequest(url, options, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: () => JSON.parse(data), text: () => data });
        } catch (e) {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: () => ({}), text: () => data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function createMultipartBody(filePath, fileName, boundary) {
  const fileContent = fs.readFileSync(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.bmp': 'image/bmp',
    '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip', '.rar': 'application/x-rar-compressed', '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar', '.gz': 'application/gzip'
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  return Buffer.concat([Buffer.from(header), fileContent, Buffer.from(footer)]);
}

// ========== 文件上传功能 ==========
async function uploadFileToNotion(filePath) {
  const fileName = path.basename(filePath);
  const stats = fs.statSync(filePath);
  
  if (stats.size > MAX_FILE_SIZE) {
    console.log(`  Skipping ${fileName}: File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB > 20MB)`);
    return null;
  }

  try {
    console.log(`  Creating upload for: ${fileName}`);
    const createResponse = await httpsRequest('https://api.notion.com/v1/file_uploads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({}));

    if (!createResponse.ok) {
      throw new Error(`Create upload failed: ${createResponse.status}`);
    }

    const uploadInfo = await createResponse.json();
    console.log(`  Upload ID: ${uploadInfo.id}`);

    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
    const body = createMultipartBody(filePath, fileName, boundary);

    const uploadResponse = await httpsRequest(uploadInfo.upload_url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, body);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log(`  Uploaded successfully: ${fileName}`);
    return uploadResult.id;

  } catch (error) {
    console.error(`  Error uploading ${fileName}:`, error.message);
    return null;
  }
}

async function createImageBlock(fileUploadId) {
  return [{ object: 'block', type: 'image', image: { type: 'file_upload', file_upload: { id: fileUploadId } } }];
}

async function createFileBlock(fileUploadId, fileName) {
  return [{ object: 'block', type: 'file', file: { type: 'file_upload', file_upload: { id: fileUploadId }, caption: [{ type: 'text', text: { content: fileName } }] } }];
}

function markdownToNotionBlocks(content) {
  const blocks = [];
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      blocks.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4) } }] } });
    } else if (line.startsWith('## ')) {
      blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3) } }] } });
    } else if (line.startsWith('# ')) {
      blocks.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } });
    } else if (line.startsWith('```')) {
      const lang = normalizeLanguage(line.slice(3).trim());
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      blocks.push({ object: 'block', type: 'code', code: { rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }], language: lang } });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } });
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push({ object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: [{ type: 'text', text: { content: line.replace(/^\d+\.\s/, '') } }] } });
    } else if (line.trim() !== '') {
      blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: line } }] } });
    }
    i++;
  }
  return blocks;
}

function codeFileToNotionBlocks(content, language) {
  const blocks = [];
  const maxChunkSize = 1900;
  const normalizedLang = normalizeLanguage(language);
  for (let i = 0; i < content.length; i += maxChunkSize) {
    blocks.push({ object: 'block', type: 'code', code: { rich_text: [{ type: 'text', text: { content: content.slice(i, i + maxChunkSize) } }], language: normalizedLang } });
  }
  return blocks;
}

async function findChildPage(parentId, title) {
  const blocks = await notion.blocks.children.list({ block_id: parentId });
  for (const block of blocks.results) {
    if (block.type === 'child_page' && block.child_page.title === title) return block.id;
  }
  return null;
}

async function getOrCreateFolderPage(parentId, folderName) {
  const cacheKey = `${parentId}:${folderName}`;
  if (folderPageCache[cacheKey]) return folderPageCache[cacheKey];
  let pageId = await findChildPage(parentId, `📁 ${folderName}`);
  if (!pageId) {
    const page = await notion.pages.create({ parent: { page_id: parentId }, icon: { emoji: '📁' }, properties: { title: { title: [{ text: { content: `📁 ${folderName}` } }] } } });
    pageId = page.id;
    console.log(`  Created folder: ${folderName}`);
  }
  folderPageCache[cacheKey] = pageId;
  return pageId;
}

async function clearPageContent(pageId) {
  const blocks = await notion.blocks.children.list({ block_id: pageId });
  for (const block of blocks.results) {
    if (block.type !== 'child_page') await notion.blocks.delete({ block_id: block.id });
  }
}

async function syncFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  const dirPath = path.dirname(filePath);
  const folders = dirPath === '.' ? [] : dirPath.split(path.sep);

  let parentId = projectPageId;
  for (const folder of folders) { parentId = await getOrCreateFolderPage(parentId, folder); }

  let blocks = [];
  let syncType = '';
  let icon = '📄';

  if (BIDIRECTIONAL_EXTENSIONS.includes(ext)) {
    blocks = markdownToNotionBlocks(fs.readFileSync(filePath, 'utf-8'));
    syncType = 'markdown';
    icon = '📝';
  } else if (CODE_EXTENSIONS[ext]) {
    blocks = codeFileToNotionBlocks(fs.readFileSync(filePath, 'utf-8'), CODE_EXTENSIONS[ext]);
    syncType = 'code';
    icon = '💻';
  } else if (IMAGE_EXTENSIONS.includes(ext)) {
    const fileUploadId = await uploadFileToNotion(filePath);
    if (fileUploadId) { blocks = await createImageBlock(fileUploadId); syncType = 'image'; icon = '🖼️'; }
    else { console.log(`  Skipped image: ${fileName}`); return; }
  } else if (DOCUMENT_EXTENSIONS.includes(ext)) {
    const fileUploadId = await uploadFileToNotion(filePath);
    if (fileUploadId) { blocks = await createFileBlock(fileUploadId, fileName); syncType = 'document'; icon = '📎'; }
    else { console.log(`  Skipped document: ${fileName}`); return; }
  } else {
    blocks = [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: `文件: ${fileName} (${ext} 格式暂不支持预览)` } }] } }];
    syncType = 'other';
  }

  console.log(`Syncing [${syncType}]: ${filePath}`);

  const existingPageId = await findChildPage(parentId, fileName);
  if (existingPageId) {
    await clearPageContent(existingPageId);
    for (let i = 0; i < blocks.length; i += 100) { await notion.blocks.children.append({ block_id: existingPageId, children: blocks.slice(i, i + 100) }); }
    console.log(`  Updated: ${fileName}`);
  } else {
    const page = await notion.pages.create({ parent: { page_id: parentId }, icon: { emoji: icon }, properties: { title: { title: [{ text: { content: fileName } }] } } });
    for (let i = 0; i < blocks.length; i += 100) { await notion.blocks.children.append({ block_id: page.id, children: blocks.slice(i, i + 100) }); }
    console.log(`  Created: ${fileName}`);
  }
}

async function main() {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_PROJECT_PAGE_ID) { console.error('Missing NOTION_TOKEN or NOTION_PROJECT_PAGE_ID'); process.exit(1); }

  let allFiles = [];
  for (const dir of SYNC_DIRS) { allFiles = allFiles.concat(getAllFiles(dir)); }
  allFiles = [...new Set(allFiles)];

  console.log(`Found ${allFiles.length} files to sync`);
  for (const filePath of allFiles) {
    try { await syncFile(filePath); }
    catch (error) { console.error(`Error syncing ${filePath}:`, error.message); }
  }
  console.log('Sync completed!');
}

main();