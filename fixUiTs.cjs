const fs = require('fs');
let content = fs.readFileSync('./src/i18n/ui.ts', 'utf8');

// The file currently has literal "\n" characters because of `entries.join('\\n')`
// Let's replace the literal string "\n" with an actual newline when followed by spaces and a quote
content = content.replace(/\\n\s+'/g, '\n    \'');

fs.writeFileSync('./src/i18n/ui.ts', content);
console.log("Fixed newlines in ui.ts");
