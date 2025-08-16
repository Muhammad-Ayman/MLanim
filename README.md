# MLanim - AI-Powered Mathematical Animations

MLanim is a full-stack web application that generates beautiful mathematical animations from natural language descriptions using Google Gemini AI and the Manim animation library.

## 🚀 Features

- **AI-Powered Generation**: Uses Google Gemini to understand natural language prompts and generate valid Manim code
- **Safe Execution**: All code runs in isolated Docker containers to prevent arbitrary code execution
- **Asynchronous Processing**: Job queue system for handling multiple animation requests
- **Real-time Updates**: Live status updates and progress tracking
- **High-Quality Output**: Professional-grade animations rendered with Manim
- **Modern UI**: Beautiful React frontend with Tailwind CSS styling

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │  Node.js Backend│    │   Redis Queue   │
│   (Port 3000)   │◄──►│   (Port 3001)   │◄──►│   (Port 6379)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Docker + Manim │
                       │   (Rendering)   │
                       └─────────────────┘
```

## 🛠️ Tech Stack

### Frontend

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Vite** for build tooling
- **Axios** for API communication

### Backend

- **Node.js** with TypeScript
- **Express.js** web framework
- **BullMQ** for job queue management
- **Redis** for queue persistence
- **Winston** for logging
- **Helmet** for security

### Animation Engine

- **Manim** (Python) for mathematical animations
- **Docker** for safe code execution
- **Google Gemini API** for AI code generation

## 📋 Prerequisites

Before running MLanim, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Docker** and Docker Compose
- **Redis** (or use the Docker container)
- **Google Gemini API Key**

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/mlanim.git
cd mlanim
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Environment Configuration

Create a `.env` file in the backend directory:

```bash
cd backend
cp env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Google Gemini API (Required)
GEMINI_API_KEY=your_actual_gemini_api_key_here

# Redis Configuration
REDIS_URL=redis://localhost:6379

# File Storage
OUTPUT_DIR=./outputs
MAX_FILE_SIZE=100mb

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

### 4. Start with Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 5. Start Manually (Alternative)

#### Start Redis

```bash
# Using Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Or install locally
# macOS: brew install redis
# Ubuntu: sudo apt-get install redis-server
```

#### Start Backend

```bash
cd backend
npm run dev
```

#### Start Frontend

```bash
cd frontend
npm run dev
```

### 6. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## 🔧 Development

### Available Scripts

#### Root Level

```bash
npm run dev              # Start both frontend and backend
npm run build            # Build both applications
npm run lint             # Lint all code
npm run format           # Format all code
npm run install:all      # Install all dependencies
```

#### Backend

```bash
cd backend
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Lint TypeScript code
npm run format           # Format code with Prettier
```

#### Frontend

```bash
cd frontend
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Lint TypeScript code
npm run format           # Format code with Prettier
```

### Code Structure

```
mlanim/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── config/         # Configuration management
│   │   ├── controllers/    # Express route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API route definitions
│   │   ├── services/       # Business logic services
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions
│   │   ├── app.ts          # Express app setup
│   │   └── index.ts        # Server entry point
│   ├── Dockerfile          # Backend container
│   └── package.json
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API service layer
│   │   ├── types/          # TypeScript types
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # App entry point
│   ├── Dockerfile          # Frontend container
│   └── package.json
├── docker-compose.yml       # Service orchestration
└── README.md
```

## 🔒 Security Features

- **Code Sandboxing**: All Manim code runs in isolated Docker containers
- **Input Validation**: Comprehensive validation of user inputs and generated code
- **Rate Limiting**: API rate limiting to prevent abuse
- **Security Headers**: Helmet.js for security headers
- **CORS Protection**: Configured CORS policies
- **Code Analysis**: Pattern-based detection of potentially dangerous code

## 📊 API Endpoints

### Animation Generation

- `POST /api/animations/generate` - Generate animation from prompt
- `GET /api/animations/status/:id` - Get job status
- `GET /api/animations/jobs` - Get all jobs (monitoring)

### Health & Monitoring

- `GET /health` - Health check
- `GET /` - API information

## 🐳 Docker Configuration

### Services

- **redis**: Redis database for job queue
- **backend**: Node.js API server
- **frontend**: React application with Nginx

### Volumes

- `outputs/`: Generated animation files
- `temp/`: Temporary files during rendering
- `logs/`: Application logs

### Networks

- `mlanim-network`: Isolated network for services

## 🔍 Monitoring & Logging

### Logs

- Backend logs: `backend/logs/`
- Frontend logs: Docker container logs
- Redis logs: Docker container logs

### Health Checks

- Backend: `http://localhost:3001/health`
- Frontend: `http://localhost:3000/health`
- Redis: Docker health check

## 🚨 Troubleshooting

### Common Issues

#### Docker Issues

```bash
# Check if Docker is running
docker --version
docker-compose --version

# Restart Docker services
docker-compose restart

# View service logs
docker-compose logs [service-name]
```

#### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping

# Check Redis container
docker ps | grep redis
```

#### Manim Rendering Issues

```bash
# Check Docker container logs
docker-compose logs backend

# Verify Manim image
docker pull manimcommunity/manim:latest
```

#### API Key Issues

```bash
# Verify environment variable
echo $GEMINI_API_KEY

# Check backend logs for API errors
docker-compose logs backend | grep "gemini"
```

### Performance Tuning

#### Backend

- Adjust `RATE_LIMIT_MAX_REQUESTS` in `.env`
- Modify `MAX_FILE_SIZE` for larger animations
- Tune Redis connection pool

#### Frontend

- Adjust polling interval in `App.tsx`
- Optimize bundle size with Vite
- Enable production optimizations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Use ESLint and Prettier for code formatting
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Manim Community](https://docs.manim.community/) for the animation engine
- [Google Gemini](https://ai.google.dev/) for AI capabilities
- [BullMQ](https://docs.bullmq.io/) for job queue management
- [Tailwind CSS](https://tailwindcss.com/) for styling

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/mlanim/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/mlanim/discussions)
- **Documentation**: [Wiki](https://github.com/yourusername/mlanim/wiki)

---

**Happy Animating! 🎬✨**
