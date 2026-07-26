import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const root = process.cwd();
const sourcePath = path.join(root, "contracts", "CompliantRwaToken.sol");
const outputPath = path.join(root, "src", "lib", "evm", "generated", "CompliantRwaToken.json");

function findImports(importPath) {
  const resolved = importPath.startsWith("@")
    ? path.join(root, "node_modules", importPath)
    : path.join(path.dirname(sourcePath), importPath);
  try {
    return { contents: fs.readFileSync(resolved, "utf8") };
  } catch (error) {
    return { error: `Unable to read ${importPath}: ${error.message}` };
  }
}

const input = {
  language: "Solidity",
  sources: {
    "CompliantRwaToken.sol": { content: fs.readFileSync(sourcePath, "utf8") },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object"] },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (output.errors ?? []).filter((entry) => entry.severity === "error");
if (errors.length) {
  throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
}

const contract = output.contracts["CompliantRwaToken.sol"].CompliantRwaToken;
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify({ abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` }, null, 2)}\n`,
);
console.log(`Compiled CompliantRwaToken -> ${path.relative(root, outputPath)}`);
