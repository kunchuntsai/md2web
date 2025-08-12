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
      
      // Extract template structure
      const template = {
        head: $('head').html() || '',
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
      head: '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">',
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

  applyTemplate(content, template, metadata = {}) {
    const title = metadata.title || template.title || 'Generated Document';
    
    const externalLinks = template.externalStyles.map(href => 
      `<link rel="stylesheet" href="${href}">`
    ).join('\n    ');

    const styles = template.styles ? `<style>\n${template.styles}\n    </style>` : '';

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
        ${content}
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