# The image can be built using this command, which will also log the progress:
#   docker build --progress plain -t sttdemo .

# To run:
#   docker run --publish 8000:3000 --detach --name sttdemo sttdemo

# To run interactively:
#   docker run -it sttdemo sh

## Step 1: Build the project
FROM node:14 AS build

# Set working directory
WORKDIR /builddir/

# Copy files from local computer to Docker image
COPY index.html package.json package-lock.json server.js styles.css /builddir/

RUN apt update && apt install -y ffmpeg

RUN mkdir -p uploads

# Install packages and run the build script
RUN npm install

EXPOSE 3000

CMD [ "npm", "start" ]