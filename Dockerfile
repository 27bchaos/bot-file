# Use the official Bun image
FROM oven/bun:latest

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
