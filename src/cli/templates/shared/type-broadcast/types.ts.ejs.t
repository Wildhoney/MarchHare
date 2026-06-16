---
to: src/shared/types/index.ts
inject: true
after: ^export namespace Broadcast \{$
skip_if: <%= pascalName %>
---
  export const <%= pascalName %> = Action<unknown>("<%= pascalName %>", Distribution.Broadcast);
