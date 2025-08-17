#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get input file from command line
const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile) {
  console.log('Usage: node json-to-markdown.js <input.json> [output.md]');
  console.log('Example: node json-to-markdown.js TME_speed.json TME_report.md');
  process.exit(1);
}

// Read the JSON file
try {
  const jsonContent = fs.readFileSync(inputFile, 'utf-8');
  const data = JSON.parse(jsonContent);
  
  // Extract message and convert escaped newlines to actual newlines
  let markdownContent = data.message.replace(/\\n/g, '\n');
  
  // Add sources section if present
  if (data.sources && data.sources.length > 0) {
    markdownContent += '\n\n---\n\n## Sources\n\n';
    data.sources.forEach((source, index) => {
      markdownContent += `${index + 1}. [${source.metadata.title}](${source.metadata.url})\n`;
      markdownContent += `   > ${source.pageContent.substring(0, 150)}...\n\n`;
    });
  }
  
  // Determine output file name
  const outputPath = outputFile || inputFile.replace('.json', '.md');
  
  // Write markdown file
  fs.writeFileSync(outputPath, markdownContent, 'utf-8');
  
  console.log(`✅ Markdown file created: ${outputPath}`);
  console.log(`📄 ${markdownContent.split('\n').length} lines written`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}