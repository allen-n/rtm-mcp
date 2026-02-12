import { describe, expect, it } from "vitest";
import { buildApiOpenApiSpec } from "../apps/mcp-server/src/routes/openapi-spec";

describe("buildApiOpenApiSpec", () => {
  it("includes invoke and docs routes", () => {
    const spec = buildApiOpenApiSpec({
      get_tasks: { description: "Get tasks" },
      add_task: { description: "Add task" },
    });

    const paths = spec.paths as Record<string, unknown>;
    expect(paths["/api/v1/invoke"]).toBeDefined();
    expect(paths["/api/v1/docs"]).toBeDefined();
    expect(paths["/api/v1/openapi.json"]).toBeDefined();
  });

  it("exports tool enum values for invoke request", () => {
    const spec = buildApiOpenApiSpec({
      get_tasks: { description: "Get tasks" },
      add_task: { description: "Add task" },
    });

    const invokeRequest = (
      spec.components as {
        schemas: { InvokeRequest: { properties: { tool: { enum: string[] } } } };
      }
    ).schemas.InvokeRequest;

    expect(invokeRequest.properties.tool.enum).toEqual(["get_tasks", "add_task"]);
  });
});
