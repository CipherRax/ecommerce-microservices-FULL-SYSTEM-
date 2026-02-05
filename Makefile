.PHONY: dev build test docker-up docker-down docker-logs

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

clean:
	rm -rf node_modules services/*/node_modules
