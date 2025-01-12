# Use the official Bun image
FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lockb ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Create downloads directory
RUN mkdir -p downloads

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["bun", "run", "index.ts"]