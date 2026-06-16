---
to: src/features/<%= feature %>/types.ts
inject: true
after: ^export class Actions \{$
skip_if: <%= pascalName %>
---
  static <%= pascalName %> = Action("<%= rawName %>");
