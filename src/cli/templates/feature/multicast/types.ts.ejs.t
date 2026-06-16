---
to: src/features/<%= feature %>/types.ts
inject: true
after: ^export class Multicast \{$
skip_if: <%= pascalName %>
---
  static <%= pascalName %> = Action<unknown>("<%= rawName %>", Distribution.Multicast);
