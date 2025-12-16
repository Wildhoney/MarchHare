unit:
	npx jest

integration:
	npx vite dev --port 5999 & echo $$! > .vite.pid
	npx wait-on http://localhost:5999
	BASE_URL=http://localhost:5999 npx playwright test || (kill `cat .vite.pid` 2>/dev/null; rm -f .vite.pid; exit 1)
	kill `cat .vite.pid` 2>/dev/null; rm -f .vite.pid

circular:
	npx madge --circular src/library/index.ts

browser:
	$(eval port := $(shell npx get-port-cli --port 50000-59999))
	npx vite dev --port $(port)	&
	npx wait-on http://localhost:$(port)
	npx playwright test

typecheck:
	npx tsc --noEmit

dev:
	npx vite

build:
	npx vite build

checks:
	make fmt
	make lint
	make typecheck
	make circular
	make unit
	make integration

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
