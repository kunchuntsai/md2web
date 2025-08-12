#!/usr/bin/env node

const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const { Converter } = require('./converter');
const { FileWatcher } = require('./watcher');

program
  .name('md2web')
  .description('Bidirectional HTML to Markdown converter with live sync')
  .version('1.0.0');

program
  .command('convert')
  .description('Convert HTML file to Markdown')
  .argument('<input>', 'Input HTML file')
  .option('-o, --output <file>', 'Output Markdown file')
  .option('--no-sync', 'Disable bidirectional sync')
  .action(async (input, options) => {
    try {
      const converter = new Converter();
      const inputPath = path.resolve(input);
      const outputPath = options.output ? path.resolve(options.output) : null;
      
      console.log(chalk.blue(`Converting ${inputPath}...`));
      await converter.htmlToMd(inputPath, outputPath);
      console.log(chalk.green('Conversion completed!'));
      
      if (options.sync !== false) {
        console.log(chalk.yellow('Starting file watcher for bidirectional sync...'));
        const watcher = new FileWatcher(converter);
        await watcher.watch(inputPath, outputPath);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Watch HTML file and sync with Markdown')
  .argument('<input>', 'Input HTML file')
  .option('-o, --output <file>', 'Output Markdown file')
  .action(async (input, options) => {
    try {
      const converter = new Converter();
      const watcher = new FileWatcher(converter);
      const inputPath = path.resolve(input);
      const outputPath = options.output ? path.resolve(options.output) : null;
      
      console.log(chalk.blue(`Watching ${inputPath} for changes...`));
      await watcher.watch(inputPath, outputPath);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse();
}

module.exports = { Converter, FileWatcher };