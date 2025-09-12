## Introduction

Showcase a generic escrow system on top of [Arkade](https://arkadeos.com/).

Includes the API ~~and the companion webapp~~ (not yet)...

## Technologies

### Stack
- [NodeJS](https://nodejs.org/en/) latest stable (24)
- [TypeScript](https://www.typescriptlang.org/)
- [NestJS](https://docs.nestjs.com) - opinionated API framework with DI, for quick scaffolding and easy testing
- [SQLite](https://sqlite.org/) - for the POC, we may consider other options for production
- [Noble cryptography](https://paulmillr.com/noble/)
- [Biome.js](https://biomejs.dev/) instead of Prettier/ESLint, just because I can
- [Jest](https://jestjs.io/)
- [TypeORM](https://typeorm.io/#/) - mostly because it has great NestJS integration but I prefer [Kysely](https://www.kysely.dev/) for type-safety and performances

## Development Workflow

To signup you can use the utility under `scripts/signup.js`:
```bash
node scripts/signup.js
# ...some logs....
✅ SUCCESS! {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4NDAyMDcyZi0zMTYwLTQ0YTgtYWJhNi0zMmRjNzU0MGMxY2YiLCJwdWJsaWNLZXkiOiI5YTk5YzY2YTA2NGYxOGY5MzM3N2ZmNWMxOTQ1MDZkNDM5MjVkYTAyYWFkNzg5N2VjYjU2Y2U1ZTc0N2IwOGUzIiwiaWF0IjoxNzU2Mzc3MTI5LCJleHAiOjE3NTY5ODE5Mjl9.K1EHVxqmB7y4zaezgU-rqBCcGqcpdDtSZWAlQ2_SBXg',
  userId: '8402072f-3160-44a8-aba6-32dc7540c1cf',
  publicKey: '9a99c66a064f18f93377ff5c194506d43925da02aad7897ecb56ce5e747b08e3'
}
```

The you grab the `accessToken` and use for authentication via Swagger UI, 
which is available at `http://localhost:3000/api/v1/docs`

### Docker

1. **Start development environment:**
   ```bash
   docker compose --profile dev up api-dev
   ```

2. **Make changes to your code** - changes will be automatically reflected due to volume mounting and hot reload

3. **View logs:**
   ```bash
   docker compose logs -f api-dev
   ```

4. **Stop development environment:**
   ```bash
   docker compose down
   ```

### Local

- I suggest using [asdf](https://github.com/asdf-vm) for managing your Node versions.
There is a `.tool-versions` file in the root of the project.
- I used `npm` and is used in the CI as well. I recommend sticking to it for now.
- The main command is `npm run dev` but there are many others in the `package.json` file.
- Env variables are in `.env.example` file

I use WebStorm for development, but you can use whatever you want.
Please don't check in your local editor's files.
