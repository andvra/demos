# The image can be build using this command, which will also log the progress:
#   docker build --progress plain -t sentsimdemo .
# Run with:
#   docker run -d -p 80:3000 sentsimdemo

## Step 1: Build the project. Using Alpine-based docker for smaller image size
FROM node:15.9.0-alpine3.10 AS build

# Set working directory
WORKDIR /builddir

# Install Python/pip and make
ENV PYTHONUNBUFFERED=1
RUN apk add --update --no-cache python3 make cmake build-base && ln -sf python3 /usr/bin/python
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools

# Copy files from local computer to Docker image
COPY ./assets /builddir/assets/
COPY package.json package-lock.json index.html index.js /builddir/

# Install packages and run the build script
RUN  npm ci --only=production

## Step 2: Export port and start service
EXPOSE 3000
CMD ["node","index.js"]
