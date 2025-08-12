const fs = require('fs-extra');
const path = require('path');
const { Converter } = require('./src/converter');

async function runTests() {
  console.log('🧪 Running md2web tests...\n');
  
  const converter = new Converter();
  
  // Test 1: HTML to Markdown conversion
  console.log('Test 1: HTML → Markdown');
  try {
    const htmlPath = './files/a.html';
    const mdPath = './files/test_output.md';
    
    await converter.htmlToMd(htmlPath, mdPath);
    
    const mdExists = await fs.pathExists(mdPath);
    console.log(`✅ MD file created: ${mdExists}`);
    
    const mdContent = await fs.readFile(mdPath, 'utf8');
    console.log(`✅ MD content length: ${mdContent.length} chars`);
    console.log(`✅ Contains metadata: ${mdContent.includes('---')}`);
    console.log(`✅ Contains tables: ${mdContent.includes('|')}`);
    
  } catch (error) {
    console.log(`❌ Test 1 failed: ${error.message}`);
  }
  
  // Test 2: Markdown to HTML conversion
  console.log('\nTest 2: Markdown → HTML');
  try {
    const mdPath = './files/test_output.md';
    const htmlPath = './files/test_output.html';
    
    await converter.mdToHtml(mdPath, htmlPath);
    
    const htmlExists = await fs.pathExists(htmlPath);
    console.log(`✅ HTML file created: ${htmlExists}`);
    
    const htmlContent = await fs.readFile(htmlPath, 'utf8');
    console.log(`✅ HTML content length: ${htmlContent.length} chars`);
    console.log(`✅ Contains DOCTYPE: ${htmlContent.includes('<!DOCTYPE html>')}`);
    console.log(`✅ Contains table: ${htmlContent.includes('<table')}`);
    
  } catch (error) {
    console.log(`❌ Test 2 failed: ${error.message}`);
  }
  
  // Test 3: Bidirectional sync
  console.log('\nTest 3: Bidirectional Sync');
  try {
    const htmlPath = './files/a.html';
    const mdPath = './files/sync_test.md';
    
    // First convert HTML to MD
    await converter.sync(htmlPath, mdPath);
    
    // Then convert MD back to HTML  
    const htmlPath2 = './files/sync_test.html';
    await converter.sync(mdPath, htmlPath2);
    
    const bothExist = await fs.pathExists(mdPath) && await fs.pathExists(htmlPath2);
    console.log(`✅ Both files created: ${bothExist}`);
    
  } catch (error) {
    console.log(`❌ Test 3 failed: ${error.message}`);
  }
  
  console.log('\n🎉 Tests completed!');
}

runTests().catch(console.error);