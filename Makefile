.PHONY: docker-build-dev install e2e dev

docker-build-dev:
	docker build -t ark-escrow-dev -f Dockerfile.dev .

install:
	docker run --rm -it -v "$$PWD":/app -w /app node:22-alpine npm install

e2e:
	docker run --rm -it -v "$$PWD":/app -w /app node:22-alpine npm run test:e2e

up:
	docker compose -f docker-compose.dev.yml --profile dev up ark-escrow

down:
	docker compose -f docker-compose.dev.yml --profile dev down ark-escrow