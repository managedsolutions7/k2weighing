/* eslint-disable */
import swaggerAutogen from 'swagger-autogen';

const doc = {
  info: {
    title: 'Biofuel Management System API',
    description: 'Production-ready Swagger docs',
    version: '1.0.0',
  },
  host: 'localhost:3000',
  schemes: ['http'],
  securityDefinitions: {
    bearerAuth: {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header',
      description: 'Bearer token for authentication',
    },
  },
};

const outputFile = './docs/swagger-output.json';
const endpointsFiles = ['./src/app.ts'];

swaggerAutogen()(outputFile, endpointsFiles, doc).then(() => {
  console.log('Swagger regenerated at', outputFile);
});


