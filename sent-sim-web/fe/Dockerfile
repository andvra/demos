# The image can be build using this command, which will also log the progress:
#   docker build --progress plain -t sentsimdemo .

## Step 1: Build the project
FROM node:15.9.0-alpine3.10 AS build

# Set working directory
WORKDIR /builddir

# Copy files from local computer to Docker image
COPY ./assets /builddir/assets/
COPY package.json package-lock.json index.html index.js /builddir/

# Install packages and run the build script
RUN  npm ci --only=production

## Step 2: Build a deployment image with the static content
EXPOSE 3000
CMD ["node","index.js"]
