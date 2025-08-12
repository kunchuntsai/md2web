const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

class FileWatcher {
  constructor(converter) {
    this.converter = converter;
    this.watchers = new Map();
    this.syncing = false;
    this.syncPairs = new Map(); // Track HTML <-> MD pairs
  }

  async watchMarkdown(mdPath, htmlPath = null, templatePath = null) {
    // Generate HTML path if not provided
    if (!htmlPath) {
      const dir = path.dirname(mdPath);
      const name = path.basename(mdPath, '.md');
      htmlPath = path.join(dir, `${name}.html`);
    }

    // Ensure markdown file exists
    if (!await fs.pathExists(mdPath)) {
      throw new Error(`Markdown file does not exist: ${mdPath}`);
    }

    // Perform initial conversion
    console.log(chalk.blue('📄 Initial conversion: MD → HTML'));
    await this.converter.mdToHtml(mdPath, templatePath, htmlPath);

    // Watch the markdown file
    await this.watchFile(mdPath, htmlPath, 'md', templatePath);

    console.log(chalk.blue(`👁️  Watching:`));
    console.log(chalk.gray(`   Markdown: ${mdPath}`));
    console.log(chalk.gray(`   HTML:     ${htmlPath}`));
    if (templatePath) {
      console.log(chalk.gray(`   Template: ${templatePath}`));
    }
    console.log(chalk.yellow('Press Ctrl+C to stop watching'));

    // Keep the process alive
    return new Promise((resolve, reject) => {
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n🛑 Stopping file watcher...'));
        this.stopAll();
        resolve();
      });

      process.on('SIGTERM', () => {
        this.stopAll();
        resolve();
      });
    });
  }

  async initializeFiles(htmlPath, mdPath) {
    const htmlExists = await fs.pathExists(htmlPath);
    const mdExists = await fs.pathExists(mdPath);

    if (htmlExists && !mdExists) {
      // Convert HTML to MD
      console.log(chalk.blue('📄 Initial conversion: HTML → MD'));
      await this.converter.htmlToMd(htmlPath, mdPath);
    } else if (!htmlExists && mdExists) {
      // Convert MD to HTML
      console.log(chalk.blue('📄 Initial conversion: MD → HTML'));
      await this.converter.mdToHtml(mdPath, htmlPath);
    } else if (!htmlExists && !mdExists) {
      throw new Error(`Neither ${htmlPath} nor ${mdPath} exists`);
    }
    // If both exist, assume they're in sync (user's responsibility)
  }

  async watchFile(sourcePath, targetPath, sourceType, templatePath = null) {
    if (this.watchers.has(sourcePath)) {
      return; // Already watching this file
    }

    const watcher = chokidar.watch(sourcePath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    watcher.on('change', async (filePath) => {
      if (this.syncing) {
        return; // Prevent infinite loop
      }

      try {
        this.syncing = true;
        
        console.log(chalk.cyan(`\n🔄 Markdown changed: ${path.basename(filePath)}`));
        console.log(chalk.gray(`   Converting → HTML...`));
        
        const startTime = Date.now();
        await this.converter.mdToHtml(sourcePath, templatePath, targetPath);
        const duration = Date.now() - startTime;
        
        console.log(chalk.green(`✅ Conversion completed in ${duration}ms`));
        
      } catch (error) {
        console.error(chalk.red(`❌ Conversion failed: ${error.message}`));
      } finally {
        this.syncing = false;
      }
    });

    watcher.on('error', (error) => {
      console.error(chalk.red(`👁️  Watcher error for ${sourcePath}: ${error.message}`));
    });

    this.watchers.set(sourcePath, watcher);
  }

  async watchDirectory(dirPath, options = {}) {
    const htmlPattern = path.join(dirPath, '**/*.html');
    const mdPattern = path.join(dirPath, '**/*.md');

    console.log(chalk.blue(`👁️  Watching directory: ${dirPath}`));

    const watcher = chokidar.watch([htmlPattern, mdPattern], {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: !options.convertExisting,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    watcher.on('change', async (filePath) => {
      if (this.syncing) return;

      try {
        this.syncing = true;
        await this.handleFileChange(filePath, options);
      } catch (error) {
        console.error(chalk.red(`❌ Error processing ${filePath}: ${error.message}`));
      } finally {
        this.syncing = false;
      }
    });

    if (options.convertExisting) {
      watcher.on('add', async (filePath) => {
        if (this.syncing) return;
        
        try {
          this.syncing = true;
          await this.handleFileChange(filePath, options);
        } catch (error) {
          console.error(chalk.red(`❌ Error processing new file ${filePath}: ${error.message}`));
        } finally {
          this.syncing = false;
        }
      });
    }

    this.watchers.set(dirPath, watcher);
    return watcher;
  }

  async handleFileChange(filePath, options = {}) {
    const ext = path.extname(filePath).toLowerCase();
    const dir = path.dirname(filePath);
    const name = path.basename(filePath, ext);

    let targetPath;
    let sourceType;

    if (ext === '.html') {
      targetPath = path.join(dir, `${name}.md`);
      sourceType = 'html';
    } else if (ext === '.md') {
      targetPath = path.join(dir, `${name}.html`);
      sourceType = 'md';
    } else {
      return; // Not a file we care about
    }

    // Check if target should be updated
    const sourceStats = await fs.stat(filePath);
    const targetExists = await fs.pathExists(targetPath);
    
    if (targetExists && !options.force) {
      const targetStats = await fs.stat(targetPath);
      if (targetStats.mtime >= sourceStats.mtime) {
        return; // Target is newer or same age
      }
    }

    const fileType = sourceType === 'html' ? 'HTML' : 'Markdown';
    const direction = sourceType === 'html' ? '→ MD' : '→ HTML';
    
    console.log(chalk.cyan(`🔄 ${fileType}: ${path.basename(filePath)} ${direction}`));
    
    const startTime = Date.now();
    await this.converter.sync(filePath, targetPath);
    const duration = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Converted in ${duration}ms`));
  }

  stop(filePath) {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
      console.log(chalk.yellow(`🛑 Stopped watching: ${filePath}`));
    }
  }

  stopAll() {
    for (const [filePath, watcher] of this.watchers) {
      watcher.close();
      console.log(chalk.gray(`   Stopped: ${path.basename(filePath)}`));
    }
    this.watchers.clear();
    this.syncPairs.clear();
    console.log(chalk.green('✅ All watchers stopped'));
  }

  getWatchedFiles() {
    return Array.from(this.watchers.keys());
  }

  isWatching(filePath) {
    return this.watchers.has(filePath);
  }
}

module.exports = { FileWatcher };