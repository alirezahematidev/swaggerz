import { definePlugin } from 'swaggerz';

/**
 * Names operations after an `x-sdk-name` vendor extension when the specification provides one,
 * e.g. `Users_List` → `listUsers`. Other operations keep swaggerz's default name.
 */
export function sdkNames(extension = 'x-sdk-name') {
  return definePlugin({
    name: 'sdk-names',
    operationName(operation) {
      const name = operation.extensions[extension];
      return typeof name === 'string' && /^[A-Za-z_$][\w$]*$/.test(name) ? name : undefined;
    },
  });
}
