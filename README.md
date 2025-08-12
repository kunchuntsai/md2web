# md2web - Markdown to HTML/PDF Converter with Template Support

A powerful tool for converting Markdown files to styled HTML or PDF using customizable templates. The project maintains a clear separation between input/output files and template sources.

## Features

- 📝 **Markdown to HTML**: Convert MD files to beautifully styled HTML
- 📄 **PDF Export**: Generate professional PDF documents from Markdown
- 🎨 **Template System**: Use existing HTML files as styling templates  
- 🔄 **Auto-detection**: Automatically find templates with intelligent prioritization
- 👁️ **Live Watching**: Automatic conversion when files change
- 📊 **Enhanced Tables**: Rich table support with styling
- 🌏 **Unicode Support**: Perfect for multi-language content (Japanese, Chinese, etc.)
- 🚀 **Fast Processing**: Optimized performance with headless Chrome for PDF generation
- 🔧 **CLI Interface**: Easy command-line usage
- 📁 **Organized Structure**: Clean separation of templates and content files

## Installation

```bash
npm install
```

**Note**: PDF conversion requires Chromium to be downloaded by Puppeteer (happens automatically during installation).

## Usage

### Basic Conversion

Convert Markdown to HTML (auto-detects template):
```bash
node src/cli.js convert document.md
```

Convert Markdown to PDF:
```bash
node src/cli.js convert document.md --pdf
```

Convert with specific template:
```bash
node src/cli.js convert document.md -t template.html
node src/cli.js convert document.md -t template.html --pdf
```

Convert with custom output path:
```bash
node src/cli.js convert document.md -o output.html -t template.html
node src/cli.js convert document.md -o mydoc.pdf -t template.html --pdf
```

### Live Watching

Watch Markdown file for changes:
```bash
node src/cli.js watch document.md
```

Watch with specific template:
```bash
node src/cli.js watch document.md -t template.html
```

### Template System

The converter uses an intelligent template priority system:

1. **Default Template**: Uses `src/template.html` as the primary default template
2. **Specified Template**: Use `-t template.html` to specify a custom template
3. **Auto-detection**: Looks for `template.html` in the same directory as the markdown file
4. **Fallback**: Uses any `.html` file in the same directory if no template is found
5. **Built-in Fallback**: Uses hardcoded styles if no templates are available

**Template Features:**
- Extracts CSS styling from existing HTML files
- Preserves fonts, layouts, and visual formatting
- Supports custom classes for Japanese/Chinese text
- Maintains responsive design and modern styling

## Examples

### Using Default Template
```bash
# Converts to HTML using src/template.html automatically
node src/cli.js convert files/a.md

# Convert to PDF using src/template.html
node src/cli.js convert files/a.md --pdf

# Watch with default template
node src/cli.js watch files/a.md
```

### Using Custom Template
```bash
# Convert with specific template file
node src/cli.js convert files/a.md -t files/template.html

# Convert to PDF with custom template
node src/cli.js convert files/a.md -t files/template.html --pdf

# Watch with custom template
node src/cli.js watch files/a.md -t files/template.html
```

### Auto-detection Example
```bash
# Place template.html in files/ directory along with your .md files
# The converter will automatically find and use it
node src/cli.js convert files/content.md

# Generate PDF with auto-detected template
node src/cli.js convert files/content.md --pdf
```

## File Structure

```
md2web/
├── src/
│   ├── index.js         # Main entry point
│   ├── cli.js           # Command-line interface
│   ├── converter.js     # Core conversion logic
│   ├── watcher.js       # File watching functionality
│   └── template.html    # Default HTML template (primary)
├── files/
│   ├── document.md      # Input Markdown files
│   ├── document.html    # Output HTML files
│   └── template.html    # Optional local templates
├── test/
│   ├── test-simple.md   # Test markdown files
│   ├── test-simple.html # Generated test HTML
│   └── test.js          # Test scripts
└── package.json         # Project configuration
```

**Directory Purpose:**
- `src/` - Core application code and default template
- `files/` - Input/output files only (Markdown and generated HTML)
- `test/` - Test files and generated test outputs
- `src/template.html` - Primary default template used by all conversions
- `files/template.html` - Optional local template for specific projects

## How It Works

1. **Template Selection**: Uses intelligent priority system to select the best template:
   - First checks for explicitly specified template (`-t option`)
   - Falls back to `src/template.html` as primary default
   - Auto-detects templates in the same directory as the markdown file
   - Uses built-in fallback template if no templates are found

2. **Template Extraction**: Reads HTML template files and extracts:
   - CSS styling and classes
   - HTML structure and layout
   - Font families and responsive design
   - Special styling for Japanese/Chinese content

3. **Markdown Processing**: Enhanced conversion with:
   - GitHub-flavored markdown support
   - Custom rendering for tables and code blocks
   - Special block support (`> **Note**:`, `> **Example**:`, `> **Grammar**:`)
   - Japanese text styling (**bold** → `.japanese` class)
   - Chinese text styling (*italic* → `.chinese` class)

4. **HTML Generation**: Combines markdown content with template styling
5. **PDF Generation**: Uses Puppeteer with headless Chrome to convert HTML to high-quality PDF with:
   - A4 page format with proper margins
   - Print-optimized styling 
   - Background colors and images preserved
   - Vector fonts and graphics for sharp text
6. **File Watching**: Monitors files and automatically regenerates on changes

## Supported Markdown Features

- **Tables**: Full GitHub-flavored markdown table support
- **Code blocks**: Syntax highlighting support
- **Special blocks**: `> **Note**:`, `> **Example**:`, `> **Grammar**:` for styled sections
- **Text formatting**: **Bold** for Japanese text, *italic* for Chinese text
- **Unicode content**: Perfect for Japanese, Chinese, Korean, etc.
- **Metadata**: Front-matter support for page configuration

## License

MIT License - feel free to use and modify as needed.