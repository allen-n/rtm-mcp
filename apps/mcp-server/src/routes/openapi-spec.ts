type ToolSchemaDoc = {
  description: string;
};

export function buildApiOpenApiSpec(
  tools: Record<string, ToolSchemaDoc>,
  opts: { title?: string; version?: string } = {}
) {
  const toolNames = Object.keys(tools);
  const invokeExamples = Object.fromEntries(
    toolNames.map((toolName) => [toolName, { value: { tool: toolName, input: {} } }])
  );

  return {
    openapi: "3.0.3",
    info: {
      title: opts.title ?? "RTM MCP REST API",
      version: opts.version ?? "1.0.0",
      description:
        "REST wrapper around the RTM MCP toolset. Authenticate with x-api-key.",
    },
    tags: [
      { name: "docs", description: "Machine and human-readable docs" },
      { name: "tools", description: "Tool discovery and invocation" },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "API key from the dashboard settings page",
        },
      },
      schemas: {
        ToolInfo: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            parameters: { type: "object" },
          },
          required: ["name", "description", "parameters"],
        },
        InvokeRequest: {
          type: "object",
          properties: {
            tool: {
              type: "string",
              enum: toolNames,
              description: "Tool name to invoke",
            },
            input: {
              type: "object",
              additionalProperties: true,
              description: "Tool input payload",
            },
          },
          required: ["tool"],
        },
        InvokeSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", enum: [true] },
            result: {
              description: "Tool-specific result payload",
              type: "object",
              additionalProperties: true,
            },
          },
          required: ["success", "result"],
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
          required: ["error"],
        },
      },
    },
    paths: {
      "/api/v1/tools": {
        get: {
          tags: ["tools"],
          summary: "List available tools",
          description: "Returns all tool names, descriptions, and parameter schemas.",
          responses: {
            "200": {
              description: "Tools list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      version: { type: "string" },
                      tools: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ToolInfo" },
                      },
                    },
                    required: ["version", "tools"],
                  },
                },
              },
            },
          },
        },
      },
      "/api/v1/invoke": {
        post: {
          tags: ["tools"],
          summary: "Invoke a tool",
          description: "Calls a tool with the provided input payload.",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InvokeRequest" },
                examples: invokeExamples,
              },
            },
          },
          responses: {
            "200": {
              description: "Tool invocation result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/InvokeSuccess" },
                },
              },
            },
            "400": {
              description: "Invalid request or unknown tool",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Missing or invalid authentication",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/v1/skills.md": {
        get: {
          tags: ["docs"],
          summary: "Detailed AI usage guide",
          responses: {
            "200": {
              description: "Markdown guide",
              content: {
                "text/markdown": {
                  schema: { type: "string" },
                },
              },
            },
          },
        },
      },
      "/api/v1/openapi.json": {
        get: {
          tags: ["docs"],
          summary: "OpenAPI specification",
          responses: {
            "200": {
              description: "OpenAPI JSON",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
      "/api/v1/docs": {
        get: {
          tags: ["docs"],
          summary: "Interactive Swagger UI",
          responses: {
            "200": {
              description: "Swagger UI HTML",
              content: {
                "text/html": {
                  schema: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}
