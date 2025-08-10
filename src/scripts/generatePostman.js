/* eslint-disable */
const fs = require('fs');
const path = require('path');

function resolveRef(ref, swagger) {
  if (!ref || typeof ref !== 'string') return null;
  const parts = ref.replace(/^#\//, '').split('/');
  let cur = swagger;
  for (const p of parts) {
    if (cur && typeof cur === 'object') cur = cur[p];
  }
  return cur || null;
}

function sampleForType(type, prop = {}) {
  if (prop.example !== undefined) return prop.example;
  if (prop.enum && prop.enum.length) return prop.enum[0];
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 1;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}

function generateExampleFromSchema(schema, swagger) {
  if (!schema) return {};
  if (schema.example !== undefined) return schema.example;
  if (schema.$ref) {
    const def = resolveRef(schema.$ref, swagger);
    // if definitions hold example-like objects, return them directly
    if (def && !def.type) return def;
    return generateExampleFromSchema(def, swagger);
  }
  if (schema.type === 'array' && schema.items) {
    return [generateExampleFromSchema(schema.items, swagger)];
  }
  if (schema.type === 'object') {
    const obj = {};
    if (schema.properties) {
      for (const [k, v] of Object.entries(schema.properties)) {
        if (v.$ref) {
          obj[k] = generateExampleFromSchema(v, swagger);
        } else if (v.type === 'array') {
          obj[k] = [generateExampleFromSchema(v.items || {}, swagger)];
        } else if (v.type) {
          obj[k] = sampleForType(v.type, v);
        } else {
          obj[k] = null;
        }
      }
    }
    return obj;
  }
  if (schema.type) return sampleForType(schema.type, schema);
  return {};
}

function buildUrlObject(route, queryParams) {
  const raw = `{{baseUrl}}${route}`;
  const url = { raw };
  if (queryParams && queryParams.length) {
    url.query = queryParams.map((p) => ({ key: p.name, value: '' }));
  }
  return url;
}

function toPostmanCollection(swagger) {
  const collection = {
    info: {
      name: 'Biofuel Management System API',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [],
    variable: [
      { key: 'baseUrl', value: 'http://localhost:3000' },
      { key: 'authToken', value: '' },
    ],
  };

  const paths = swagger.paths || {};
  for (const [route, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const name = (op.summary || `${method.toUpperCase()} ${route}`).trim();
      const params = Array.isArray(op.parameters) ? op.parameters : [];
      const queryParams = params.filter((p) => p.in === 'query');
      const url = buildUrlObject(route, queryParams);

      const headers = [];
      headers.push({ key: 'Content-Type', value: 'application/json' });
      headers.push({ key: 'Authorization', value: 'Bearer {{authToken}}' });

      const request = {
        name,
        request: {
          method: method.toUpperCase(),
          header: headers,
          url,
        },
      };

      // OpenAPI 3 style
      if (op.requestBody && op.requestBody.content && op.requestBody.content['application/json']) {
        const content = op.requestBody.content['application/json'];
        const example = content.example || generateExampleFromSchema(content.schema, swagger);
        request.request.body = {
          mode: 'raw',
          raw: JSON.stringify(example || {}, null, 2),
          options: { raw: { language: 'json' } },
        };
      } else {
        // Swagger 2 style: body parameter
        const bodyParam = params.find((p) => p.in === 'body' && p.schema);
        if (bodyParam) {
          const example = generateExampleFromSchema(bodyParam.schema, swagger);
          request.request.body = {
            mode: 'raw',
            raw: JSON.stringify(example || {}, null, 2),
            options: { raw: { language: 'json' } },
          };
        }
      }

      collection.item.push(request);
    }
  }

  return collection;
}

function main() {
  const swaggerPath = path.join(process.cwd(), 'docs', 'swagger-output.json');
  const postmanOutDir = path.join(process.cwd(), 'postman');
  const postmanOutPath = path.join(postmanOutDir, 'collection.json');

  if (!fs.existsSync(swaggerPath)) {
    console.error('swagger-output.json not found at', swaggerPath);
    process.exit(1);
  }

  if (!fs.existsSync(postmanOutDir)) {
    fs.mkdirSync(postmanOutDir, { recursive: true });
  }

  const swagger = JSON.parse(fs.readFileSync(swaggerPath, 'utf-8'));
  const collection = toPostmanCollection(swagger);
  fs.writeFileSync(postmanOutPath, JSON.stringify(collection, null, 2));
  console.log('Postman collection generated at', postmanOutPath);
}

main();


