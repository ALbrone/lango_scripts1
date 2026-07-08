const fs = require("fs");

const input = process.argv[2];

if (!input) {
    console.error("No input file.");
    process.exit(1);
}

let code = fs.readFileSync(input, "utf8");

// Remove single-line comments
code = code.replace(/--.*$/gm, "");

// Collapse multiple blank lines
code = code.replace(/\n\s*\n/g, "\n");

// Output the transformed code
process.stdout.write(code);