---
to: tsconfig.json
---
{
  "compilerOptions": {
    "target": "es2020",
    "module": "esnext",
    "lib": ["es2024", "esnext.temporal", "dom", "dom.iterable"],
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "useDefineForClassFields": true,
    "paths": {
      "@app/*": ["./src/app/*"],
      "@features/*": ["./src/features/*"],
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src", "tests"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx", "**/*.integration.ts", "**/*.integration.tsx"]
}
