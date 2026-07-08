import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const schemaFiles = {
  "intent.schema.json": path.join(root, "packages/schemas/intent.schema.json"),
  "resource-plan.schema.json": path.join(root, "packages/schemas/resource-plan.schema.json"),
  "install-action.schema.json": path.join(root, "packages/schemas/install-action.schema.json"),
  "instance-lock.schema.json": path.join(root, "packages/schemas/instance-lock.schema.json")
};

const exampleSets = [
  {
    schema: "intent.schema.json",
    directory: path.join(root, "examples/intents"),
    suffix: ".intent.json"
  },
  {
    schema: "resource-plan.schema.json",
    directory: path.join(root, "examples/plans"),
    suffix: ".resource-plan.json"
  },
  {
    schema: "install-action.schema.json",
    directory: path.join(root, "examples/actions"),
    suffix: ".install-action.json"
  },
  {
    schema: "instance-lock.schema.json",
    directory: path.join(root, "examples/locks"),
    suffix: ".instance-lock.json"
  }
];

const schemas = new Map();

for (const [name, file] of Object.entries(schemaFiles)) {
  schemas.set(name, await readJson(file));
}

const errors = [];
let checked = 0;

for (const set of exampleSets) {
  const schema = schemas.get(set.schema);
  const files = (await listJsonFiles(set.directory)).filter((file) => file.endsWith(set.suffix));

  if (files.length === 0) {
    errors.push(`${relative(set.directory)}: no ${set.suffix} examples found`);
    continue;
  }

  for (const file of files) {
    const data = await readJson(file);
    const result = validate(schema, data, {
      schemaRoot: schema,
      dataPath: "$",
      schemaPath: "#"
    });

    checked += 1;
    if (result.length > 0) {
      for (const error of result) {
        errors.push(`${relative(file)} ${error}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Schema validation failed with ${errors.length} error(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Schema validation passed for ${checked} example file(s).`);

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function listJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function validate(schema, value, context) {
  const resolved = resolveRef(schema, context);
  if (resolved !== schema) {
    return validate(resolved, value, {
      ...context,
      schemaPath: resolved.__schemaPath ?? context.schemaPath
    });
  }

  const errors = [];

  if (schema.type !== undefined && !matchesType(schema.type, value)) {
    errors.push(`${context.dataPath}: expected type ${JSON.stringify(schema.type)}, got ${typeOf(value)}`);
    return errors;
  }

  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.push(`${context.dataPath}: expected const ${JSON.stringify(schema.const)}`);
  }

  if (schema.enum !== undefined && !schema.enum.some((item) => deepEqual(value, item))) {
    errors.push(`${context.dataPath}: value ${JSON.stringify(value)} is not in enum`);
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const properties = schema.properties ?? {};

    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          errors.push(`${context.dataPath}.${key}: required property is missing`);
        }
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          errors.push(`${context.dataPath}.${key}: additional property is not allowed`);
        }
      }
    }

    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(
          ...validate(childSchema, value[key], {
            schemaRoot: context.schemaRoot,
            dataPath: `${context.dataPath}.${key}`,
            schemaPath: `${context.schemaPath}/properties/${key}`
          })
        );
      }
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${context.dataPath}: expected at least ${schema.minItems} item(s)`);
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) {
          errors.push(`${context.dataPath}: duplicate array item ${key}`);
          break;
        }
        seen.add(key);
      }
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) => {
        errors.push(
          ...validate(schema.items, item, {
            schemaRoot: context.schemaRoot,
            dataPath: `${context.dataPath}[${index}]`,
            schemaPath: `${context.schemaPath}/items`
          })
        );
      });
    }
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${context.dataPath}: string is shorter than ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${context.dataPath}: string is longer than ${schema.maxLength}`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${context.dataPath}: string does not match pattern ${schema.pattern}`);
    }
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
      errors.push(`${context.dataPath}: string is not a valid date-time`);
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${context.dataPath}: number is less than ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${context.dataPath}: number is greater than ${schema.maximum}`);
    }
  }

  return errors;
}

function resolveRef(schema, context) {
  if (schema.$ref === undefined) {
    return schema;
  }

  if (!schema.$ref.startsWith("#/")) {
    throw new Error(`Only local refs are supported by this validator: ${schema.$ref}`);
  }

  const parts = schema.$ref.slice(2).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current = context.schemaRoot;
  for (const part of parts) {
    current = current?.[part];
  }

  if (current === undefined) {
    throw new Error(`Unresolved schema ref: ${schema.$ref}`);
  }

  return current;
}

function matchesType(expected, value) {
  const options = Array.isArray(expected) ? expected : [expected];
  return options.some((type) => {
    if (type === "array") {
      return Array.isArray(value);
    }
    if (type === "integer") {
      return Number.isInteger(value);
    }
    if (type === "null") {
      return value === null;
    }
    return typeof value === type && !Array.isArray(value) && value !== null;
  });
}

function typeOf(value) {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (Number.isInteger(value)) {
    return "integer";
  }
  return typeof value;
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}
