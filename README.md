# NHTSA Vehicle Ingestion Service

Consumes public NHTSA data (vehicle makes and types) in XML, transforms it to JSON, stores it in Postgres, and serves it over GraphQL.

## What it does

Pulls raw XML from NHTSA, cleans it up, transforms it into a proper structure, and dumps it into the database. Then you query everything through GraphQL.

The pipeline:
- The flow begins with a raw XML fetch from NHTSA, which is parsed and normalized into usable JavaScript objects.
- Makes are merged with vehicle types, then the combined records are flushed to Postgres in batches via Prisma.
- Once the data is persisted, GraphQL exposes it for queries.

## Running locally

### With Docker (easiest)

```bash
cp .env.example .env
docker compose up --build
```

This spins up Postgres, applies migrations automatically via a dedicated `migrate` service, and then starts the app.

### Without Docker

If you prefer to run it manually:

```bash
npm install
npm run prisma:migrate:dev
npm run start:dev
```

You'll need Node and a local Postgres instance running.

### Running E2E tests locally

Copy the example test env file and start the test database:

```bash
cp .env.test.example .env.test
npm run test:e2e:db:up
```

Then prepare the schema and run the suite:

```bash
npm run test:e2e:ci
```

The `NODE_OPTIONS=--experimental-vm-modules` flag is required because the Prisma client engine uses dynamic `import()` for its WASM query compiler, which Jest's sandbox can't execute without this flag.

If you want to use a dedicated test database, set `DATABASE_URL` in `.env.test` to point to it.

## Environment variables

Everything is validated in `env.validation.ts` via Joi. Full list:

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `test` / `production` |
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | **required** | Postgres connection string |
| `LOG_LEVEL` | `info` | Pino level (`trace` through `fatal`) |
| `NHTSA_ALL_MAKES_URL` | Public NHTSA URL | All-makes endpoint |
| `NHTSA_VEHICLE_TYPES_BASE_URL` | **required** | Base endpoint per `makeId` |
| `NHTSA_REQUEST_TIMEOUT_MS` | `30000` | Request timeout |
| `NHTSA_MAX_RETRIES` | `3` | Retry attempts |
| `NHTSA_RETRY_BASE_DELAY_MS` | `1000` | Exponential backoff base |
| `NHTSA_BREAKER_FAILURE_THRESHOLD` | `5` | Failures before opening the circuit breaker |
| `NHTSA_BREAKER_RESET_MS` | `30000` | Time until half-open attempt |
| `INGESTION_CONCURRENCY` | `2` | Parallel requests |
| `INGESTION_BATCH_SIZE` | `25` | Database batch size |
| `INGESTION_REQUEST_DELAY_MS` | `500` | Delay between requests |
| `INGESTION_MAX_MAKES` | `0` (unlimited) | Cap for testing |
| `INGESTION_TRANSACTION_TIMEOUT_MS` | `10000` | Prisma transaction timeout |
| `INGEST_ON_STARTUP` | `false` | Run ingestion on startup |

## Configuration approach

Configuration is loaded with `@nestjs/config` from domain-specific modules for `app`, `nhtsa`, `database`, and `ingestion`. The environment is validated at startup via Joi in `env.validation.ts`, and any validation failure prevents the app from booting.

## Migrations

This project keeps its migration history intact instead of squashing it.

- `initial_schema` - initial schema with `Make` and a denormalized `VehicleType` model.
- `split_vehicle_types` - normalization of the vehicle type catalog into `VehicleType` plus a join table `MakeVehicleType`.

The split was introduced to avoid duplication of `typeName` across makes and to model vehicle types as a shared catalog.

## Build

```bash
npm run build
npm run start:prod
```

## Data model

From `prisma/schema.prisma`:

```prisma
model Make {
  makeId       Int               @id @map("make_id")
  makeName     String            @map("make_name")
  vehicleTypes MakeVehicleType[]
  createdAt    DateTime          @default(now()) @map("created_at")
  updatedAt    DateTime          @updatedAt @map("updated_at")

  @@map("makes")
}

model VehicleType {
  typeId    Int               @id @map("type_id")
  typeName  String            @map("type_name")
  makes     MakeVehicleType[]
  createdAt DateTime          @default(now()) @map("created_at")
  updatedAt DateTime          @updatedAt @map("updated_at")

  @@map("vehicle_types")
}

model MakeVehicleType {
  makeId      Int
  typeId      Int
  make        Make        @relation(fields: [makeId], references: [makeId])
  vehicleType VehicleType @relation(fields: [typeId], references: [typeId])
  createdAt   DateTime    @default(now()) @map("created_at")

  @@id([makeId, typeId])
  @@map("make_vehicle_types")
}
```

- **Make** - PK is `makeId`
- **VehicleType** - PK is `typeId`, representing the normalized vehicle type catalog
- **MakeVehicleType** - join table linking makes to types; composite PK `[makeId, typeId]`
- **Reason** - the normalization avoids duplication of `typeName` across makes by storing vehicle types once and associating them through a join table.

## GraphQL schema

```graphql
type Make {
  makeId: Int!
  makeName: String!
  vehicleTypes: [VehicleType!]!
}

type VehicleType {
  typeId: Int!
  typeName: String!
}

type IngestionResult {
  makesProcessed: Int!
  persisted: Int!
  vehicleTypeFetchFailures: Int!
  persistenceFailures: Int!
  stoppedEarly: Boolean
  stopReason: String
}

type Query {
  makes(first: Int, after: String): MakeConnection!
  make(makeId: Int!): Make
}

type Mutation {
  ingestNhtsaData: IngestionResult!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}

type MakeEdge {
  cursor: String!

  # The cursor is base64(makeId); the server decodes it as UTF-8 and uses the resulting makeId.
  node: Make!
}

type MakeConnection {
  edges: [MakeEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

## Query examples

### Paginated list of makes

```graphql
query {
  makes(first: 10) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges {
      cursor
      node { makeId makeName vehicleTypes { typeId typeName } }
    }
  }
}
```

The current cursor is generated as `base64(String(makeId))`. It is only used for pagination order and is not signed.

To fetch the next page, pass the `endCursor` from the previous response:

```graphql
query {
  makes(first: 10, after: "<endCursor from previous response>") {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges {
      cursor
      node { makeId makeName vehicleTypes { typeId typeName } }
    }
  }
}
```

**Cursor behavior:** passing an invalid cursor or a cursor that points to a non-existent `makeId` now throws an error with the message `Invalid pagination cursor.` instead of silently restarting pagination. This is enforced by the `decodeCursor` logic in `src/makes/makes.service.ts`.

### Get a specific make

```graphql
query {
  make(makeId: 440) {
    makeId
    makeName
    vehicleTypes {
      typeId
      typeName
    }
  }
}
```

### Trigger ingestion manually

```graphql
mutation {
  ingestNhtsaData {
    makesProcessed
    persisted
    stoppedEarly
    stopReason
  }
}
```

## Ingestion pipeline

The pipeline starts by pulling XML from NHTSA, turning that XML into JSON, and normalizing the fields into a consistent shape. Makes are merged with their vehicle types, and the combined payload is written to Postgres in transactional batches. When the import completes, GraphQL serves the same data for queries.

The ingestion process treats `typeId` as the canonical vehicle type key. If the NHTSA source later returns a different `typeName` for an existing `typeId`, the service logs `ingestion.vehicleType.conflict` and updates the stored value.

### Intermediate transformation format

`IngestionTransformer.merge()` (in `src/ingestion/transformers/ingestion.transformer.ts`) produces, per batch, an array in the exact shape the challenge expects:

```ts
{ makeId: number; makeName: string; vehicleTypes: { typeId: number; typeName: string }[] }[]
```

This array is **intermediate/ephemeral**. It only exists while each chunk is being processed, before it gets flattened into relational rows in Postgres (`Make`, `VehicleType`, and `MakeVehicleType`). The nested format is what the pipeline manipulates in memory, but it is never persisted as a single JSON document in the database.

### Why `makes` doesn't return a flat array

The `makes` query does not return a flat array directly because, with **12,314+ records** (and growing), serving everything at once without pagination would be a serious performance and scalability problem. It hits the server on memory allocation, serialization, and transfer, and it hits the client on rendering and bandwidth consumption.

That's why the API adds a **Relay-style pagination layer** (`edges`/`node`/`pageInfo`) on top of the same data. The exposed consumer schema lets clients consume the catalog in controlled pages (`first`/`after`), while the database continues to store and relate the data in normalized form. The nested structure `{ makeId, makeName, vehicleTypes: [...] }` only reappears inside each `node`, now as a paginated, typed response.

### Resilience

The service retries failed requests a few times with increasing delay, so transient issues do not derail the whole job. If failures persist, the circuit breaker pauses outgoing calls for a short recovery window. The traffic is also paced: only two requests are in flight at once, with a small wait between them.

## Error handling

Custom errors in `src/ingestion/errors/`:

- `NhtsaRequestError` - request to NHTSA failed
- `XmlParseError` - XML was malformed or couldn't be parsed
- `IngestionFailedError` - general pipeline failure
- `CircuitOpenError` - circuit breaker is open

The `IngestionExceptionFilter` is registered globally via `APP_FILTER` in `app.module.ts` (`@Catch(Error)`). It catches every unhandled error in the app, ingestion-related or not, and formats it cleanly for the GraphQL response.

On top of that, the GraphQL module is configured with `includeStacktraceInErrorResponses: false` and a custom `formatError` handler in `app.module.ts` to strip internal details from client-facing messages. A global `ValidationPipe` is also mounted in `main.ts` to enforce DTO contracts at the edge.

## Logging

Pino with structured JSON. Events you'll see:

- `ingestion.start` - started
- `ingestion.chunk.processed` - processed a chunk
- `ingestion.completed` - finished
- `ingestion.partial` - completed partially
- `ingestion.chunk.failure` - chunk failed
- `ingestion.vehicleTypeFetch.failure` - failed fetching vehicle types
- `ingestion.completelyFailed` - ingestion completely failed
- `ingestion.stoppedEarly` - stopped early

Control the level via `LOG_LEVEL`.

## Architecture note

Each module (`makes/`, `ingestion/`) is organized by feature, but internally it already separates concerns into resolver (presentation), service (domain), and repository / Prisma layer (infrastructure).