#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const { Converter } = require('./converter');
const { FileWatcher } = require('./watcher');

// ASCII Art Banner
const banner = `
███╗   ███╗██████╗ ██████╗ ██╗    ██╗███████╗██████╗ 
████╗ ████║██╔══██╗╚════██╗██║    ██║██╔════╝██╔══██╗
██╔████╔██║██║  ██║ █████╔╝██║ █╗ ██║█████╗  ██████╔╝
██║╚██╔╝██║██║  ██║██╔═══╝ ██║███╗██║██╔══╝  ██╔══██╗
██║ ╚═╝ ██║██████╔╝███████╗╚███╔███╔╝███████╗██████╔╝
╚═╝     ╚═╝╚═════╝ ╚══════╝ ╚══╝╚══╝ ╚══════╝╚═════╝ 
                                                     
Markdown to HTML Converter with Template Support
`;

console.log(chalk.cyan(banner));

program
  .name('md2web')
  .description('Markdown to HTML converter with template support')
  .version('1.0.0');

// Convert command
program
  .command('convert <input>')
  .description('Convert Markdown file to HTML using template')
  .option('-o, --output <file>', 'Output HTML file path')
  .option('-t, --template <file>', 'HTML template file to use')
  .option('-f, --force', 'Overwrite existing files')
  .option('--pdf', 'Output as PDF instead of HTML')
  .action(async (input, options) => {
    try {
      const converter = new Converter();
      const inputPath = path.resolve(input);
      
      if (!await fs.pathExists(inputPath)) {
        throw new Error(`Input file does not exist: ${inputPath}`);
      }

      const ext = path.extname(inputPath).toLowerCase();
      if (ext !== '.md') {
        throw new Error(`Input must be a Markdown file (.md), got: ${ext}`);
      }

      let outputPath = options.output;
      if (!outputPath) {
        const dir = path.dirname(inputPath);
        const name = path.basename(inputPath, '.md');
        const ext = options.pdf ? '.pdf' : '.html';
        outputPath = path.join(dir, `${name}${ext}`);
      }

      outputPath = path.resolve(outputPath);

      // Check if output exists and not forcing
      if (await fs.pathExists(outputPath) && !options.force) {
        throw new Error(`Output file exists: ${outputPath}. Use --force to overwrite.`);
      }

      let templatePath = options.template;
      if (templatePath) {
        templatePath = path.resolve(templatePath);
        if (!await fs.pathExists(templatePath)) {
          throw new Error(`Template file does not exist: ${templatePath}`);
        }
      }

      const outputType = options.pdf ? 'PDF' : 'HTML';
      console.log(chalk.blue(`🔄 Converting: ${path.basename(inputPath)} to ${outputType}`));
      if (templatePath) {
        console.log(chalk.blue(`📄 Using template: ${path.basename(templatePath)}`));
      } else {
        console.log(chalk.blue(`📄 Auto-detecting template...`));
      }
      
      const startTime = Date.now();
      if (options.pdf) {
        await converter.mdToPdf(inputPath, templatePath, outputPath);
      } else {
        await converter.mdToHtml(inputPath, templatePath, outputPath);
      }
      const duration = Date.now() - startTime;

      console.log(chalk.green(`✅ Conversion completed in ${duration}ms`));
      console.log(chalk.gray(`   Input:    ${inputPath}`));
      console.log(chalk.gray(`   Output:   ${outputPath}`));
      if (templatePath) {
        console.log(chalk.gray(`   Template: ${templatePath}`));
      }

    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

// Watch command
program
  .command('watch <input>')
  .description('Watch Markdown file for changes and auto-convert to HTML')
  .option('-o, --output <file>', 'Output HTML file path')
  .option('-t, --template <file>', 'HTML template file to use')
  .action(async (input, options) => {
    try {
      const converter = new Converter();
      const watcher = new FileWatcher(converter);
      const inputPath = path.resolve(input);
      
      if (!await fs.pathExists(inputPath)) {
        throw new Error(`Input file does not exist: ${inputPath}`);
      }

      const ext = path.extname(inputPath).toLowerCase();
      if (ext !== '.md') {
        throw new Error(`Input must be a Markdown file (.md), got: ${ext}`);
      }

      let outputPath = options.output;
      if (!outputPath) {
        const dir = path.dirname(inputPath);
        const name = path.basename(inputPath, '.md');
        outputPath = path.join(dir, `${name}.html`);
      } else {
        outputPath = path.resolve(outputPath);
      }

      let templatePath = options.template;
      if (templatePath) {
        templatePath = path.resolve(templatePath);
        if (!await fs.pathExists(templatePath)) {
          throw new Error(`Template file does not exist: ${templatePath}`);
        }
      }

      await watcher.watchMarkdown(inputPath, outputPath, templatePath);

    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

// Watch directory command
program
  .command('watch-dir <directory>')
  .description('Watch entire directory for HTML/MD file changes')
  .option('--convert-existing', 'Convert all existing files on startup')
  .option('--force', 'Force conversion even if target is newer')
  .action(async (directory, options) => {
    try {
      const converter = new Converter();
      const watcher = new FileWatcher(converter);
      const dirPath = path.resolve(directory);
      
      if (!await fs.pathExists(dirPath)) {
        throw new Error(`Directory does not exist: ${dirPath}`);
      }

      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        throw new Error(`Not a directory: ${dirPath}`);
      }

      await watcher.watchDirectory(dirPath, {
        convertExisting: options.convertExisting,
        force: options.force
      });

      // Keep process alive
      await new Promise((resolve) => {
        process.on('SIGINT', () => {
          console.log(chalk.yellow('\n🛑 Stopping directory watcher...'));
          watcher.stopAll();
          resolve();
        });
      });

    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

// List command
program
  .command('list <directory>')
  .description('List HTML and Markdown file pairs in directory')
  .option('--missing', 'Only show files missing their counterpart')
  .action(async (directory, options) => {
    try {
      const dirPath = path.resolve(directory);
      
      if (!await fs.pathExists(dirPath)) {
        throw new Error(`Directory does not exist: ${dirPath}`);
      }

      const files = await fs.readdir(dirPath);
      const htmlFiles = files.filter(f => f.endsWith('.html'));
      const mdFiles = files.filter(f => f.endsWith('.md'));

      console.log(chalk.blue(`\n📁 Files in ${dirPath}:\n`));

      const pairs = new Set();
      
      for (const htmlFile of htmlFiles) {
        const name = path.basename(htmlFile, '.html');
        const mdFile = `${name}.md`;
        const hasPair = mdFiles.includes(mdFile);
        
        if (!options.missing || !hasPair) {
          const status = hasPair ? chalk.green('✅') : chalk.red('❌');
          console.log(`${status} ${htmlFile} ${hasPair ? '↔' : '→'} ${mdFile}`);
        }
        
        pairs.add(name);
      }

      for (const mdFile of mdFiles) {
        const name = path.basename(mdFile, '.md');
        if (!pairs.has(name)) {
          const htmlFile = `${name}.html`;
          if (!options.missing) {
            console.log(`${chalk.red('❌')} ${htmlFile} ← ${mdFile}`);
          }
        }
      }

      console.log(chalk.gray(`\nTotal: ${htmlFiles.length} HTML, ${mdFiles.length} MD files`));

    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

// Info command
program
  .command('info <file>')
  .description('Show information about a file and its conversion counterpart')
  .action(async (file, options) => {
    try {
      const filePath = path.resolve(file);
      
      if (!await fs.pathExists(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const dir = path.dirname(filePath);
      const name = path.basename(filePath, ext);

      let counterpartPath;
      if (ext === '.html') {
        counterpartPath = path.join(dir, `${name}.md`);
      } else if (ext === '.md') {
        counterpartPath = path.join(dir, `${name}.html`);
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      const counterpartExists = await fs.pathExists(counterpartPath);
      const counterpartStats = counterpartExists ? await fs.stat(counterpartPath) : null;

      console.log(chalk.blue(`\n📄 File Information:\n`));
      console.log(`${chalk.cyan('Source:')} ${filePath}`);
      console.log(`${chalk.cyan('Size:')} ${stats.size} bytes`);
      console.log(`${chalk.cyan('Modified:')} ${stats.mtime.toLocaleString()}`);
      console.log(`${chalk.cyan('Type:')} ${ext === '.html' ? 'HTML' : 'Markdown'}`);
      
      console.log(chalk.blue(`\n🔄 Counterpart:\n`));
      console.log(`${chalk.cyan('Path:')} ${counterpartPath}`);
      console.log(`${chalk.cyan('Exists:')} ${counterpartExists ? chalk.green('Yes') : chalk.red('No')}`);
      
      if (counterpartExists) {
        console.log(`${chalk.cyan('Size:')} ${counterpartStats.size} bytes`);
        console.log(`${chalk.cyan('Modified:')} ${counterpartStats.mtime.toLocaleString()}`);
        
        const isNewer = stats.mtime > counterpartStats.mtime;
        const syncStatus = isNewer ? 
          chalk.yellow('Source is newer') : 
          chalk.green('Files are in sync');
        console.log(`${chalk.cyan('Sync Status:')} ${syncStatus}`);
      }

    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

// Parse command line arguments
if (process.argv.length === 2) {
  program.help();
}

program.parse();

module.exports = { program };