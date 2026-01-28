unit:
	npx vitest run

integration:
	npx playwright test

circular:
	npx madge --circular src/library/index.ts

browser:
	npx playwright test --headed

typecheck:
	npx tsc --noEmit

dev:
	npx vite

build:
	npx vite build

fslint:
	npx fslint --files=dist/**/*.js --limit-kb=20

checks:
	make fmt
	make lint
	make typecheck
	make circular
	make unit
	make integration
	make build
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
