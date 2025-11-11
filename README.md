## Links
### Mutinynet
- Swagger https://api.escrow.mutinynet.arkade.sh/api/v1/docs
- Wallet https://mutinynet.arkade.money/

### Mainnet
- ...coming soon...

# Introduction

Showcase a generic escrow system on top of [Arkade](https://arkadeos.com/).

This monorepo-like includes three apps:
- **API** - the API server (under `./server`) 
- **Client** - the static web app to be hosted in a wallet provider like https://arkade.money/ (under `./client`) 
- **Backoffice** - the static admin panel to manage escrows and arbitrations (under `./backoffice`) 

# Development

## Prepare your environment

Docker configuration expects [Nigiri](https://github.com/vulpemventures/nigiri/) to be running with `--ark` 
and the `ark` service to be running at `localhost:7070`.

The Docker compose command **will not work** otherwise!

### .env

Copy `.env.example` to `.env`. It will work with the default configuration but feel free to change it.

## With Docker

Start the server:

```
$ make up 
```

- The server runs by default on port `3002`.
- Swagger is available at `localhost:3002/api/v1/docs`.
- Client and Backoffice apps are served under `/client` and `/backoffice` respectively.
- The DB is under `data/db.sqlite`

Stop the server:
```
$ make down
```

## Local development

- I suggest using [asdf](https://github.com/asdf-vm) for managing your Node versions.
  There is a `.tool-versions` file in the root of the project.
- I used `npm` and is used in the CI as well. I recommend sticking to it for now.
- The main command is `npm run dev` but there are many others in the `package.json` file.
- Env variables are in `.env.example` file

I use WebStorm for development, but you can use whatever you want.
Please don't check in your local editor files.

## JWT for testing via Swagger

To generate a JTW you can use the utility under `scripts/signup.js`:
```bash
node scripts/signup.js
# ...some logs....
✅ SUCCESS! {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4NDAyMDcyZi0zMTYwLTQ0YTgtYWJhNi0zMmRjNzU0MGMxY2YiLCJwdWJsaWNLZXkiOiI5YTk5YzY2YTA2NGYxOGY5MzM3N2ZmNWMxOTQ1MDZkNDM5MjVkYTAyYWFkNzg5N2VjYjU2Y2U1ZTc0N2IwOGUzIiwiaWF0IjoxNzU2Mzc3MTI5LCJleHAiOjE3NTY5ODE5Mjl9.K1EHVxqmB7y4zaezgU-rqBCcGqcpdDtSZWAlQ2_SBXg',
  userId: '8402072f-3160-44a8-aba6-32dc7540c1cf',
  publicKey: '9a99c66a064f18f93377ff5c194506d43925da02aad7897ecb56ce5e747b08e3'
}
```


## TESTING

### E2E
Cover the happy paths of Request, Contract, Arbitration:

```bash
$ nigiri start --ark
$ npm install
$ npm run test:e2e
```


## Stack
- [NodeJS](https://nodejs.org/en/) latest stable (24)
- [TypeScript](https://www.typescriptlang.org/)
- [NestJS](https://docs.nestjs.com) - opinionated API framework with DI, for quick scaffolding and easy testing
- [SQLite](https://sqlite.org/) - for the POC, we may consider other options for production
- [Noble cryptography](https://paulmillr.com/noble/)
- [Biome.js](https://biomejs.dev/) instead of Prettier/ESLint, it's faster
- [Jest](https://jestjs.io/) test framework
- [TypeORM](https://typeorm.io/#/) - mostly because it has great NestJS integration
- [React](https://react.dev/) - UI framework
- [Tailwind](https://react.dev/) - CSS framework

