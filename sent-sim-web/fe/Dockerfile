# The image can be build using this command, which will also log the progress:
#   docker build --progress plain -t sentsimdemo .
# Run with:
#   docker run -d -p 80:3000 sentsimdemo

## Step 1: Build the project. Using Alpine-based docker for smaller image size
FROM node:15.9.0-alpine3.10 AS build
RUN apk add dumb-init

# Set working directory
WORKDIR /builddir

# Copy files from local computer to Docker image
COPY ./assets /builddir/assets/
COPY package.json package-lock.json index.html index.js /builddir/

# Install packages and run the build script
RUN  npm ci --only=production

## Step 2: Export port and start service
EXPOSE 3000
CMD ["dumb-init", "node","index.js"]
