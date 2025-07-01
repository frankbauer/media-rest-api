# Containerized Media and DB REST API
The app introduces an example Database-Table `data_records` which stores a *name*, a *description* and arbitrary json-*data*. The data Endpoint (`/api/data`) will query/alter this table.

The app also hanbdles media uploads to a storage bucket (MinIO container) through the `/api/media` endpoint. Allowed file extensions are currently hard-coded and set to
`jpeg|jpg|png|gif|webp|mp4|avi|mov|wmv|flv|webm|mkv`.


## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    
│     MinIO       │    │   Application   │    │   PostgreSQL    │    
│  Blob Storage   │◄──►│   (Node.js)     │◄──►│   Database      │    
│   Port: 9000    │    │   Port: 3000    │    │   Port: 5432    │    
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Services
- **Application Container**: Node.js 18 (Alpine)
- **PostgreSQL Container**: PostgreSQL 15 (Alpine)
- **MinIO Container**: Blob Storage Bucket (S3 Compatible)

## Quick Start
### 1.  Setup
```bash
# Copy environment template and configure
cp .env.example .env
# Edit .env with your secure passwords and configuration
```

### 2. Start Services
```bash
npm run docker:up
```

### 3. Verify Services
```bash
# Check that all services are running and healthy
npm run docker:health

# Check application health
curl http://localhost:3000/health
```


## API Endpoints

### Health Check
- `GET /health` - Service health status

### Example Data Management
- `GET /api/data` - List all data records (with pagination)
- `GET /api/data/:id` - Get specific data record
- `POST /api/data` - Create new data record
- `PUT /api/data/:id` - Update data record
- `DELETE /api/data/:id` - Delete data record

### Media Management
- `GET /api/media` - List all media files (with pagination)
- `GET /api/media/:id` - Retrieve media file
- `POST /api/media/upload` - Upload image or video file
- `DELETE /api/media/:id` - Delete media file

## Usage Examples

### Create Data Record
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Record","description":"Sample data","data":{"key":"value"}}' \
  http://localhost:3000/api/data
```

### Upload a Video File
```bash
curl -X POST \
  -F "file=@video.mp4" \
  http://localhost:3000/api/media/upload
```

### List all stored media
```bash
curl http://localhost:3000/api/media
```

## Data Persistence
All persistent data is stored in the `./data` directory:
- `./data/postgres/` - PostgreSQL database files
- `./data/minio/` - MinIO object storage
- `./data/uploads/` - Temporary upload processing (optional)


## Development
### Local Development
```bash
# Install dependencies
npm install

# Start services only (without app)
npm run docker:dev

# Check that the db and minIO services are running and healthy
npm run docker:health

# Start in development mode
npm run dev
```

### Node Scripts
- `npm start` - Start production server
- `npm run docker:dev` - Start relevant containers for local development
- `npm run dev` - Start development server with nodemon 
- `npm run docker:up` - Start all containers
- `npm run docker:down` - Stop all containers
- `npm run docker:logs` - View container logs
- `npm run docker:build` - Build application container

## Environment Variables

Create a `.env` file from the template:
```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | production | Environment mode. Overwritten with `development` when a local development server is started |
| APP_PORT | 3000 | Application port |
| MAX_MEDIA_SIZE | 100 | Maximum allowed Filesize for Media Uploads (in MB) |
| DB_HOST | postgres | Database host. Overwritten with `localhost` when a local development server is started |
| DB_PORT | 5432 | Database port |
| DB_NAME | **CHANGE THIS** | Database name |
| DB_USER | **CHANGE THIS** | Database user |
| DB_PASSWORD | **CHANGE THIS** | Database password |
| MINIO_ENDPOINT | minio | MinIO endpoint. Overwritten with `localhost` when a local development server is started |
| MINIO_PORT | 9000 | MinIO API port |
| MINIO_CONSOLE_PORT | 9001 | MinIO web console port |
| MINIO_USER | **CHANGE THIS** | MinIO user |
| MINIO_SECRET_PASSWORD | **CHANGE THIS** | MinIO password |
| MINIO_BUCKET | media-files | MinIO bucket name |


## Reset Everything
```bash
docker-compose down -v
sudo rm -rf data/
mkdir -p data/{postgres,minio,uploads}
npm run docker:up
```