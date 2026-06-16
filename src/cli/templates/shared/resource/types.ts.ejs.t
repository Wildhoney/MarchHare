---
to: src/shared/resources/<%= name %>/types.ts
---
export namespace <%= pascalName %> {
  export type Item = {
    id: string;
  };

  export type Response = Item[];
}
