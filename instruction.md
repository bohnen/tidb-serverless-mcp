I want to build MCP (Model Context Protocol) which access TiDB Cloud Serverless and make it as a Desktop Extension, abbreviated as "DXT". Please follow these steps:

0. **Understand the requirements:**
   - The extension must be a valid DXT that can be loaded by the DXT host.
   - It should implement the MCP protocol to interact with TiDB Cloud Serverless.
   - The extension uses the TiDB Cloud Serverless JS SDK to perform database operations.
   - The extension is built in Node.js and TypeScript and should be structured according to the DXT specifications.
   - The extension has proper error handling, timeout management, log output and follows best practices for development.

1. **Read the specifications thoroughly:**
   - https://github.com/anthropics/dxt/blob/main/README.md - DXT architecture overview, capabilities, and integration patterns
   - https://github.com/anthropics/dxt/blob/main/MANIFEST.md - Complete extension manifest structure and field definitions
   - https://github.com/anthropics/dxt/tree/main/examples - Reference implementations including a "Hello World" example
   - https://github.com/tidbcloud/serverless-js/blob/main/README.md - TiDB Cloud Serverless JS SDK documentation for installation and usage
   - server.py - Example MCP server implementation for TiDB Cloud Serverless. This will help you understand how to implement the MCP server and tool definitions. 

2. **Create a proper extension structure:**
   - Generate a valid manifest.json following the MANIFEST.md spec
   - Implement an MCP server using @modelcontextprotocol/sdk with proper tool definitions
   - Include proper error handling and timeout management

3. **Follow best development practices:**
   - Implement proper MCP protocol communication via stdio transport
   - Structure tools with clear schemas, validation, and consistent JSON responses
   - Make use of the fact that this extension will be running locally
   - Add appropriate logging and debugging capabilities
   - Include proper documentation and setup instructions

4. **Test considerations:**
   - Validate that all tool calls return properly structured responses
   - Verify manifest loads correctly and host integration works

Generate complete, production-ready code that can be immediately tested. Focus on defensive programming, clear error messages, and following the exact
DXT specifications to ensure compatibility with the ecosystem.