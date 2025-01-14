# Use the official Bun image
FROM oven/bun:latest

# Install Node.js (and npm) and FFmpeg
RUN apt-get update && \
    apt-get install -y curl ffmpeg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies using npm
RUN npm install

# Copy source code
COPY . .

# Create downloads directory
RUN mkdir -p downloads

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application with Bun
CMD ["bun", "run", "index.ts"]
