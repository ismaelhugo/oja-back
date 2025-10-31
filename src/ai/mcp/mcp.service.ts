import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { mcpTools, MCPTool } from './mcp-tools';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * MCP Service
 * Handles Model Context Protocol tool execution
 */
@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Get all available MCP tools as JSON schema for OpenAI function calling
   */
  getToolsSchema() {
    return mcpTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.inputSchema as any, { 
          target: 'openApi3',
          $refStrategy: 'none' 
        }),
      },
    }));
  }

  /**
   * Execute an MCP tool by name with given parameters
   */
  async executeTool(toolName: string, params: any): Promise<any> {
    const tool = mcpTools.find(t => t.name === toolName);
    
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    this.logger.log(`[MCP] Executing tool: ${toolName}`);
    this.logger.log(`[MCP] Parameters: ${JSON.stringify(params)}`);

    try {
      // Validate parameters using Zod schema
      const validatedParams = tool.inputSchema.parse(params);
      
      // Execute tool handler
      const result = await tool.handler(validatedParams, this.dataSource);
      
      this.logger.log(`[MCP] Tool ${toolName} returned ${Array.isArray(result) ? result.length : 1} results`);
      
      return result;
    } catch (error) {
      this.logger.error(`[MCP] Error executing tool ${toolName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get description of all available tools for the LLM prompt
   */
  getToolsDescription(): string {
    return mcpTools.map(tool => 
      `- ${tool.name}: ${tool.description}`
    ).join('\n');
  }
}
