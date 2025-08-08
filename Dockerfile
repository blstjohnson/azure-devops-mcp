# Use the official Node.js 20 slim image for better security
FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Set the working directory inside the container
WORKDIR /usr/src/app

# Create src directory explicitly for prebuild script
RUN mkdir -p src

# Copy all application source code, including package.json and tsconfig.json, before npm install
# This ensures tsconfig.json is present for the 'prebuild' script invoked by npm install
COPY . .

# Install dependencies
RUN npm install

# Build the TypeScript code (now src directory exists)
RUN npm run build

# Command to run the MCP server with configurable transport, and enable debugger for silent exits
CMD ["sh", "-c", "node dist/index.js \
  ${ADO_SERVER_URL:+--server-url \"$ADO_SERVER_URL\"} \
  ${ADO_ORGANIZATION:+ \"$ADO_ORGANIZATION\"} \
  --transport ${TRANSPORT:-stdio} \
  ${MCP_PORT:+--http-port \"$MCP_PORT\"} \
  "]
