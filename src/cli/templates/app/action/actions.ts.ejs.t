---
to: src/app/pages/<%= page %>/actions.ts
inject: true
before: ^\s*return actions;
skip_if: Actions\.<%= pascalName %>
---
  actions.useAction(Actions.<%= pascalName %>, (_context) => {
    // TODO: handle the <%= pascalName %> action
  });

