# Nanog Server

A Node.js Express server with environment-based configuration for development and production.

## Environment Configuration

The application now supports environment-based configuration using `.env` files. This allows you to easily switch between development and production settings.

### Environment Files

- `.env` - Default environment file (currently set to development)
- `.env.development` - Development environment configuration
- `.env.production` - Production environment configuration

### Environment Variables

| Variable | Description | Default | Production |
|----------|-------------|---------|------------|
| `NODE_ENV` | Environment mode | `development` | `production` |
| `DB_HOST` | Database host | `localhost` | `localhost` |
| `DB_PORT` | Database port | `5432` | `5432` |
| `DB_NAME` | Database name | `postgres` | `postgres` |
| `DB_USER` | Database user | `postgres` | `postgres` |
| `DB_PASSWORD` | Database password | `root` | `root` |
| `DB_MAX_CONNECTIONS` | Max DB connections | `100` | `100` |
| `PORT` | Server port | `3000` | `443` |
| `HTTPS_ENABLED` | Enable HTTPS | `false` | `true` |
| `SSL_KEY_PATH` | SSL private key path | SSL cert path | SSL cert path |
| `SSL_CERT_PATH` | SSL certificate path | SSL cert path | SSL cert path |
| `SSL_CHAIN_PATH` | SSL chain path | SSL cert path | SSL cert path |
| `SSL_FULLCHAIN_PATH` | SSL fullchain path | SSL cert path | SSL cert path |
| `FIREBASE_DATABASE_URL` | Firebase database URL | Firebase URL | Firebase URL |
| `AWS_BUCKET_NAME` | AWS S3 bucket name | `nanogbucket` | `nanogbucket` |
| `AWS_BUCKET_REGION` | AWS S3 region | `ap-southeast-1` | `ap-southeast-1` |
| `AWS_ACCESS_KEY` | AWS access key ID | `AKIA4FJWF7YCVSZJKLFE` | `AKIA4FJWF7YCVSZJKLFE` |
| `AWS_SECRET_KEY` | AWS secret access key | `[configured]` | `[configured]` |
| `CORS_ORIGIN` | CORS origin | `*` | `*` |
| `REQUEST_LIMIT` | Request size limit | `1024mb` | `1024mb` |

## Usage

### Development Mode

```bash
# Start in development mode (uses .env file)
npm run dev

# Or with explicit development settings
npm run start:dev
```

### Production Mode

```bash
# Start in production mode
npm run prod

# Or with explicit production settings
npm run start:prod
```

### Custom Configuration

You can also set environment variables directly:

```bash
# Custom port and environment
NODE_ENV=production PORT=8080 node index.js

# Custom database configuration
DB_HOST=your-db-host DB_PASSWORD=your-password npm run dev
```

## Features

### Environment Detection

The application automatically detects the environment and adjusts behavior:

- **Development**: HTTP server, port 3000, detailed logging
- **Production**: HTTPS server (if enabled), port 443, optimized settings

### SSL/HTTPS Support

- Automatically uses HTTPS in production when `HTTPS_ENABLED=true`
- Falls back to HTTP if SSL certificates are not found
- Configurable SSL certificate paths

### Database Configuration

- Environment-based database connection settings
- Configurable connection pool size
- Automatic type parsing for numeric fields

### AWS S3 Configuration

- Environment-based AWS credentials and configuration
- Configurable bucket name and region
- Secure credential management through environment variables
- Support for file uploads, PDFs, and image processing

### Security

- Environment variables for sensitive data
- CORS configuration
- Request size limits

## Configuration Examples

### Development Environment (.env)

```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=root
PORT=3000
HTTPS_ENABLED=false
```

### Production Environment (.env.production)

```env
NODE_ENV=production
DB_HOST=your-production-db-host
DB_PORT=5432
DB_NAME=your-production-db
DB_USER=your-production-user
DB_PASSWORD=your-secure-password
PORT=443
HTTPS_ENABLED=true
SSL_KEY_PATH=/path/to/your/privkey.pem
SSL_CERT_PATH=/path/to/your/cert.pem
AWS_BUCKET_NAME=nanogbucket
AWS_BUCKET_REGION=ap-southeast-1
AWS_ACCESS_KEY=AKIA4FJWF7YCVSZJKLFE
AWS_SECRET_KEY=vDCeKG0BG1SawYkngWg5l4ldLZtD1/1fUn6NCDhr
```

## Troubleshooting

### SSL Certificate Issues

If you get SSL certificate errors in production:

1. Check that the SSL certificate paths in your `.env` file are correct
2. Ensure the certificates exist and are readable
3. The application will automatically fall back to HTTP if certificates are not found

### Database Connection Issues

If you can't connect to the database:

1. Verify your database credentials in the `.env` file
2. Check that the database server is running
3. Ensure the database host and port are accessible

### Port Already in Use

If you get a "port already in use" error:

1. Change the `PORT` variable in your `.env` file
2. Or kill the existing process using that port
3. Use `lsof -i :3000` to find processes using a specific port

## API Endpoints

The server includes various API endpoints for:
- Subcontractor statistics
- Worker performance tracking
- File uploads
- Firebase messaging
- Favorite leads management
- And more...

### Favorite Leads API

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|-------------|----------|
| `/addLeadToFavorites` | POST | Add a lead to user's favorites | `{ "user_id": "string", "lead_id": number }` | `{ "success": boolean, "message": "string" }` |
| `/removeLeadFromFavorites` | POST | Remove a lead from user's favorites | `{ "user_id": "string", "lead_id": number }` | `{ "success": boolean, "message": "string" }` |
| `/getUserFavoriteLeads` | POST | Get all favorite leads for a user | `{ "user_id": "string" }` | `{ "success": boolean, "data": array }` |
| `/isLeadFavorite` | POST | Check if a lead is in user's favorites | `{ "user_id": "string", "lead_id": number }` | `{ "success": boolean, "isFavorite": boolean }` |

All endpoints are available in both development and production environments. 