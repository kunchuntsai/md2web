const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const cheerio = require('cheerio');
const chalk = require('chalk');
const puppeteer = require('puppeteer');

class Converter {
  constructor() {
    this.setupMarked();
    this.templateCache = new Map();
  }


  setupMarked() {
    marked.setOptions({
      gfm: true,
      breaks: true,
      sanitize: false
    });

    // Custom renderer for styled output
    this.renderer = new marked.Renderer();
    
    // Enhanced table rendering
    this.renderer.table = (header, body) => {
      return `<table>
        <thead>${header}</thead>
        <tbody>${body}</tbody>
      </table>`;
    };

    // Enhanced blockquote rendering for special sections
    this.renderer.blockquote = (quote) => {
      if (quote.includes('**Example**:')) {
        const content = quote.replace('**Example**: ', '').replace(/<\/?p>/g, '');
        return `<div class="example">${content}</div>`;
      }
      if (quote.includes('**Note**:')) {
        const content = quote.replace('**Note**: ', '').replace(/<\/?p>/g, '');
        return `<div class="note">${content}</div>`;
      }
      if (quote.includes('**Grammar**:')) {
        const content = quote.replace('**Grammar**: ', '').replace(/<\/?p>/g, '');
        return `<div class="grammar-point">${content}</div>`;
      }
      return `<blockquote>${quote}</blockquote>`;
    };

    // Enhanced text rendering for Japanese content
    this.renderer.strong = (text) => {
      return `<span class="japanese">${text}</span>`;
    };

    this.renderer.em = (text) => {
      return `<span class="chinese">${text}</span>`;
    };
  }

  async extractTemplate(htmlPath) {
    try {
      const html = await fs.readFile(htmlPath, 'utf8');
      const $ = cheerio.load(html);
      
      // Extract head content but remove title tag to avoid duplication
      const headClone = $('head').clone();
      headClone.find('title').remove();
      
      // Extract template structure
      const template = {
        head: headClone.html() || '',
        title: $('title').text() || 'Generated Document',
        styles: $('style').html() || '',
        externalStyles: [],
        bodyClass: $('body').attr('class') || '',
        containerClass: $('.container').attr('class') || 'container'
      };

      // Extract external stylesheets
      $('link[rel="stylesheet"]').each((i, link) => {
        template.externalStyles.push($(link).attr('href'));
      });

      // Cache the template
      this.templateCache.set(htmlPath, template);
      
      console.log(chalk.green(`✓ Template extracted from ${path.basename(htmlPath)}`));
      return template;
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not extract template from ${htmlPath}`));
      return await this.getDefaultTemplate();
    }
  }

  async getDefaultTemplate() {
    try {
      const srcTemplatePath = path.join(__dirname, 'template.html');
      if (await fs.pathExists(srcTemplatePath)) {
        return await this.extractTemplate(srcTemplatePath);
      }
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not load src/template.html, using fallback'));
    }
    
    return {
      head: '<meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      title: 'Generated Document',
      styles: `
        body {
          font-family: 'Microsoft JhengHei', '微軟正黑體', Arial, sans-serif;
          line-height: 1.6;
          margin: 20px;
          background-color: #f8f9fa;
        }
        .container {
          max-width: 1400px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          padding: 12px 8px;
          border: 1px solid #ddd;
          text-align: left;
        }
        th {
          background: #34495e;
          color: white;
        }
        .japanese { color: #e74c3c; font-weight: bold; }
        .chinese { color: #27ae60; }
        .example { 
          background-color: #fff3cd;
          padding: 6px;
          border-radius: 4px;
          margin: 3px 0;
          border-left: 4px solid #ffc107;
        }
        .note {
          background-color: #d1ecf1;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
          border-left: 4px solid #17a2b8;
        }
        .grammar-point {
          background-color: #e8f5e8;
          padding: 8px;
          border-radius: 4px;
          margin: 5px 0;
          border-left: 4px solid #28a745;
        }
        .toc-dropdown {
          position: relative;
          display: inline-block;
          margin: 20px 0 30px 0;
        }
        .toc-toggle {
          background: linear-gradient(135deg, #4a90e2, #357abd);
          color: white;
          border: none;
          padding: 12px 20px;
          font-size: 16px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 2px 10px rgba(74, 144, 226, 0.3);
          transition: all 0.3s ease;
          font-family: inherit;
        }
        .toc-toggle:hover {
          background: linear-gradient(135deg, #357abd, #2968a3);
          box-shadow: 0 4px 15px rgba(74, 144, 226, 0.4);
          transform: translateY(-1px);
        }
        .toc-toggle:active {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
        }
        .toc-icon {
          font-size: 18px;
          font-weight: bold;
        }
        .toc-arrow {
          margin-left: auto;
          transition: transform 0.3s ease;
        }
        .toc-content {
          display: none;
          position: absolute;
          background-color: white;
          min-width: 350px;
          max-width: 500px;
          max-height: 400px;
          overflow-y: auto;
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
          z-index: 1000;
          border-radius: 8px;
          border: 1px solid #e1e5e9;
          margin-top: 5px;
        }
        .toc-content ul {
          list-style-type: none;
          padding: 10px 0;
          margin: 0;
        }
        .toc-content ul ul {
          padding-left: 20px;
        }
        .toc-content li {
          margin: 0;
        }
        .toc-content a {
          text-decoration: none;
          color: #495057;
          font-size: 14px;
          line-height: 1.4;
          display: block;
          padding: 8px 20px;
          transition: all 0.2s ease;
          border-left: 3px solid transparent;
        }
        .toc-content a:hover {
          background-color: #f8f9fa;
          color: #007bff;
          border-left-color: #007bff;
        }
        .toc-content ul ul a {
          padding-left: 40px;
          font-size: 13px;
          color: #6c757d;
        }
        @media (max-width: 768px) {
          .toc-content {
            min-width: 300px;
            max-width: calc(100vw - 40px);
          }
        }
        .back-to-top {
          text-align: right;
          margin: 10px 0 20px 0;
          font-size: 12px;
        }
        .back-to-top a {
          color: #6c757d;
          text-decoration: none;
          padding: 5px 10px;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          background-color: #f8f9fa;
          transition: all 0.3s ease;
        }
        .back-to-top a:hover {
          color: #495057;
          background-color: #e9ecef;
          border-color: #adb5bd;
          text-decoration: none;
        }
      `,
      externalStyles: [],
      bodyClass: '',
      containerClass: 'container'
    };
  }

  async mdToHtml(mdPath, templatePath = null, outputPath = null) {
    try {
      // Generate output path if not provided
      if (!outputPath) {
        const dir = path.dirname(mdPath);
        const name = path.basename(mdPath, '.md');
        outputPath = path.join(dir, `${name}.html`);
      }

      // Read markdown content
      let markdownContent = await fs.readFile(mdPath, 'utf8');

      // Extract metadata if present
      let metadata = {};
      if (markdownContent.startsWith('---')) {
        const metadataEnd = markdownContent.indexOf('---', 3);
        if (metadataEnd > 0) {
          const metadataText = markdownContent.substring(3, metadataEnd);
          metadataText.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
              metadata[key.trim()] = valueParts.join(':').trim();
            }
          });
          markdownContent = markdownContent.substring(metadataEnd + 3).trim();
        }
      }

      // Get template
      let template;
      if (templatePath && await fs.pathExists(templatePath)) {
        template = await this.extractTemplate(templatePath);
      } else if (templatePath) {
        // Look for template by name in same directory
        const dir = path.dirname(mdPath);
        const possibleTemplate = path.join(dir, `${templatePath}.html`);
        if (await fs.pathExists(possibleTemplate)) {
          template = await this.extractTemplate(possibleTemplate);
        } else {
          console.warn(chalk.yellow(`Template ${templatePath} not found, using default`));
          template = await this.getDefaultTemplate();
        }
      } else {
        // Try to find a template in the same directory
        template = await this.findTemplate(mdPath) || await this.getDefaultTemplate();
      }

      // Convert markdown to HTML content
      const htmlContent = marked(markdownContent, { renderer: this.renderer });

      // Apply template
      const finalHtml = this.applyTemplate(htmlContent, template, metadata);

      // Write HTML file
      await fs.writeFile(outputPath, finalHtml);
      
      console.log(chalk.green(`✓ Converted ${path.basename(mdPath)} → ${path.basename(outputPath)}`));
      return outputPath;
    } catch (error) {
      throw new Error(`MD to HTML conversion failed: ${error.message}`);
    }
  }

  async findTemplate(mdPath) {
    try {
      // First check src/template.html as primary default
      const srcTemplatePath = path.join(__dirname, 'template.html');
      if (await fs.pathExists(srcTemplatePath)) {
        return await this.extractTemplate(srcTemplatePath);
      }
      
      // Then look in the same directory as the markdown file
      const dir = path.dirname(mdPath);
      const files = await fs.readdir(dir);
      
      // Look for HTML files that could serve as templates
      const htmlFiles = files.filter(f => f.endsWith('.html'));
      
      if (htmlFiles.length > 0) {
        // Prefer 'template.html' if it exists
        const templateFile = htmlFiles.find(f => f.toLowerCase().includes('template'));
        if (templateFile) {
          return await this.extractTemplate(path.join(dir, templateFile));
        }
        
        // Otherwise use the first HTML file
        return await this.extractTemplate(path.join(dir, htmlFiles[0]));
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  generateTOC(content) {
    const headings = [];
    const headingRegex = /<h([2-6])[^>]*>(.*?)<\/h[2-6]>/g;
    let match;
    let counter = 0;

    // Extract headings and add IDs with back-to-top links
    let processedContent = content.replace(headingRegex, (match, level, text) => {
      const cleanText = text.replace(/<[^>]*>/g, '');
      const id = `heading-${counter++}`;
      const levelNum = parseInt(level);
      
      // Only include H2 and H3 in TOC
      if (levelNum <= 3) {
        headings.push({ level: levelNum, text: cleanText, id });
      }
      
      // Add back-to-top link for H2 headings (main sections)
      const backToTop = levelNum === 2 ? 
        `<div class="back-to-top"><a href="javascript:void(0)" onclick="document.querySelector('.toc-toggle').scrollIntoView(); toggleTOC();">↑ 返回目錄 / Back to TOC</a></div>` : '';
      
      return match.replace(/^<h(\d)/, `<h$1 id="${id}"`) + backToTop;
    });

    if (headings.length === 0) {
      return { toc: '', content: processedContent };
    }

    // Generate TOC HTML as dropdown menu
    let tocHtml = `
    <div class="toc-dropdown">
      <button class="toc-toggle" onclick="toggleTOC()">
        <span class="toc-icon">☰</span>
        目錄 / Table of Contents
        <span class="toc-arrow">▼</span>
      </button>
      <div class="toc-content" id="toc-content">
        <ul>`;
    
    let currentLevel = 2;

    headings.forEach(heading => {
      if (heading.level > currentLevel) {
        // Open nested lists
        for (let i = currentLevel; i < heading.level; i++) {
          tocHtml += '<ul>';
        }
      } else if (heading.level < currentLevel) {
        // Close nested lists
        for (let i = heading.level; i < currentLevel; i++) {
          tocHtml += '</ul>';
        }
      }
      
      tocHtml += `<li><a href="#${heading.id}" onclick="closeTOC()">${heading.text}</a></li>`;
      currentLevel = heading.level;
    });

    // Close remaining lists
    for (let i = 2; i <= currentLevel; i++) {
      tocHtml += '</ul>';
    }
    
    tocHtml += `
        </ul>
      </div>
    </div>
    <script>
      function toggleTOC() {
        const content = document.getElementById('toc-content');
        const arrow = document.querySelector('.toc-arrow');
        const isOpen = content.style.display === 'block';
        content.style.display = isOpen ? 'none' : 'block';
        arrow.textContent = isOpen ? '▼' : '▲';
      }
      
      function closeTOC() {
        const content = document.getElementById('toc-content');
        const arrow = document.querySelector('.toc-arrow');
        content.style.display = 'none';
        arrow.textContent = '▼';
      }
      
      // Close TOC when clicking outside
      document.addEventListener('click', function(event) {
        const toc = document.querySelector('.toc-dropdown');
        if (!toc.contains(event.target)) {
          closeTOC();
        }
      });
    </script>`;

    return { toc: tocHtml, content: processedContent };
  }

  applyTemplate(content, template, metadata = {}) {
    // Generate TOC and process content
    const { toc, content: processedContent } = this.generateTOC(content);
    
    // Extract title from first H1 heading if not in metadata
    let title = metadata.title;
    if (!title) {
      const h1Match = processedContent.match(/<h1[^>]*>(.*?)<\/h1>/);
      if (h1Match) {
        // Remove any HTML tags from the title
        title = h1Match[1].replace(/<[^>]*>/g, '');
      } else {
        title = template.title || 'Generated Document';
      }
    }
    
    const externalLinks = template.externalStyles.map(href => 
      `<link rel="stylesheet" href="${href}">`
    ).join('\n    ');

    const tocStyles = `
        .toc-dropdown {
            position: relative;
            display: inline-block;
            margin: 20px 0 30px 0;
        }
        .toc-toggle {
            background: linear-gradient(135deg, #4a90e2, #357abd);
            color: white;
            border: none;
            padding: 12px 20px;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 2px 10px rgba(74, 144, 226, 0.3);
            transition: all 0.3s ease;
            font-family: inherit;
        }
        .toc-toggle:hover {
            background: linear-gradient(135deg, #357abd, #2968a3);
            box-shadow: 0 4px 15px rgba(74, 144, 226, 0.4);
            transform: translateY(-1px);
        }
        .toc-toggle:active {
            transform: translateY(0);
            box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
        }
        .toc-icon {
            font-size: 18px;
            font-weight: bold;
        }
        .toc-arrow {
            margin-left: auto;
            transition: transform 0.3s ease;
        }
        .toc-content {
            display: none;
            position: absolute;
            background-color: white;
            min-width: 350px;
            max-width: 500px;
            max-height: 400px;
            overflow-y: auto;
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            z-index: 1000;
            border-radius: 8px;
            border: 1px solid #e1e5e9;
            margin-top: 5px;
        }
        .toc-content ul {
            list-style-type: none;
            padding: 10px 0;
            margin: 0;
        }
        .toc-content ul ul {
            padding-left: 20px;
        }
        .toc-content li {
            margin: 0;
        }
        .toc-content a {
            text-decoration: none;
            color: #495057;
            font-size: 14px;
            line-height: 1.4;
            display: block;
            padding: 8px 20px;
            transition: all 0.2s ease;
            border-left: 3px solid transparent;
        }
        .toc-content a:hover {
            background-color: #f8f9fa;
            color: #007bff;
            border-left-color: #007bff;
        }
        .toc-content ul ul a {
            padding-left: 40px;
            font-size: 13px;
            color: #6c757d;
        }
        @media (max-width: 768px) {
            .toc-content {
                min-width: 300px;
                max-width: calc(100vw - 40px);
            }
        }
        .back-to-top {
            text-align: right;
            margin: 10px 0 20px 0;
            font-size: 12px;
        }
        .back-to-top a {
            color: #6c757d;
            text-decoration: none;
            padding: 5px 10px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            background-color: #f8f9fa;
            transition: all 0.3s ease;
        }
        .back-to-top a:hover {
            color: #495057;
            background-color: #e9ecef;
            border-color: #adb5bd;
            text-decoration: none;
        }`;

    const allStyles = template.styles + tocStyles;
    const styles = allStyles ? `<style>\n${allStyles}\n    </style>` : '';

    // Insert TOC after the first H1 heading
    const contentWithToc = toc ? processedContent.replace(/(<h1[^>]*>.*?<\/h1>)/, `$1\n${toc}`) : processedContent;

    return `<!DOCTYPE html>
<html lang="${metadata.lang || 'zh-TW'}">
<head>
    ${template.head}
    <title>${title}</title>
    ${externalLinks}
    ${styles}
</head>
<body${template.bodyClass ? ` class="${template.bodyClass}"` : ''}>
    <div class="${template.containerClass}">
        ${contentWithToc}
    </div>
</body>
</html>`;
  }

  async convertWithTemplate(mdPath, templatePath = null, outputPath = null) {
    return await this.mdToHtml(mdPath, templatePath, outputPath);
  }

  async mdToPdf(mdPath, templatePath = null, outputPath = null) {
    try {
      // Generate temporary HTML file
      const dir = path.dirname(mdPath);
      const name = path.basename(mdPath, '.md');
      const tempHtmlPath = path.join(dir, `${name}-temp.html`);
      
      // Generate output path if not provided
      if (!outputPath) {
        outputPath = path.join(dir, `${name}.pdf`);
      }

      // First convert MD to HTML
      await this.mdToHtml(mdPath, templatePath, tempHtmlPath);
      
      // Launch puppeteer
      console.log(chalk.blue('🚀 Launching browser for PDF generation...'));
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Load the HTML file
      const htmlContent = await fs.readFile(tempHtmlPath, 'utf8');
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Generate PDF with good options for documents
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm'
        }
      });
      
      await browser.close();
      
      // Clean up temp HTML file
      await fs.remove(tempHtmlPath);
      
      console.log(chalk.green(`✓ PDF generated: ${path.basename(outputPath)}`));
      return outputPath;
    } catch (error) {
      throw new Error(`MD to PDF conversion failed: ${error.message}`);
    }
  }

  // Legacy method for compatibility
  async sync(sourcePath, targetPath, templatePath = null) {
    const sourceExt = path.extname(sourcePath).toLowerCase();

    if (sourceExt === '.md') {
      return await this.mdToHtml(sourcePath, templatePath, targetPath);
    } else {
      throw new Error(`Only Markdown to HTML conversion is supported. Input: ${sourceExt}`);
    }
  }
}

module.exports = { Converter };