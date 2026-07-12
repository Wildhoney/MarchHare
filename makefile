unit:
	npx vitest run

integration:
	npx playwright install chromium && npx playwright test

circular:
	npx madge --circular src/library/index.ts

browser:
	npx playwright test --headed

typecheck:
	npx tsc --noEmit
	npx tsc -p tsconfig.test.json --noEmit
	npx tsc -p tsconfig.cli.json --noEmit

dev:
	npx vite

build:
	npm run build

fslint:
	npx fslint --files=dist/**/*.js --limit-kb=32

checks:
	make fmt
	make lint
	make typecheck
	make circular
	make build
	make unit
	make integration
	make fslint

preview:
	npx vite preview

fmt:
	npx prettier --write .

lint:
	npx eslint --fix src/

test:
	make unit

deploy:
	yarn --force
	make build
	npx commit-and-tag-version
	npm publish
	git push
	git push --tags
