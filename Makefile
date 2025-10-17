.PHONY: docker-build-dev install e2e

docker-build-dev:
	docker build -t ark-escrow-dev -f Dockerfile.dev .

install:
	docker run --rm -it -v "$$PWD":/app -w /app node:22-alpine npm install

e2e:
	docker run --rm -it -v "$$PWD":/app -w /app node:22-alpine npm run test:e2e
