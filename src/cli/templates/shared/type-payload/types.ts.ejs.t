---
to: src/shared/types/index.ts
inject: true
after: ^export namespace Payload \{$
skip_if: <%= pascalName %>
---
  export type <%= pascalName %> = {
    id: string;
  };
