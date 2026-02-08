// Package tooling: Tool registry for AI (from kiko-api src/tooling).

package tooling

import "context"

// ToolDefinition is the schema for an AI tool (name, description, parameters).
type ToolDefinition struct {
	Name        string
	Description string
	Parameters  map[string]interface{}
	Required    []string
}

// ToolContext is passed to tool handlers (userId, chainId, etc.).
type ToolContext struct {
	UserID      string
	UserAddress string
	ChainID     int
}

// ToolHandler is the function type for executing a tool.
type ToolHandler func(ctx context.Context, args map[string]interface{}, tc *ToolContext) (interface{}, error)

// Tool is a registered tool with definition and handler.
type Tool struct {
	Definition ToolDefinition
	Handler    ToolHandler
}

// Registry holds tools by name.
type Registry struct {
	tools map[string]*Tool
}

// NewRegistry creates an empty registry.
func NewRegistry() *Registry {
	return &Registry{tools: make(map[string]*Tool)}
}

// Register adds a tool.
func (r *Registry) Register(tool *Tool) {
	if tool != nil {
		r.tools[tool.Definition.Name] = tool
	}
}

// GetTool returns the tool by name or nil.
func (r *Registry) GetTool(name string) *Tool {
	return r.tools[name]
}

// GetAllTools returns all registered tools.
func (r *Registry) GetAllTools() []*Tool {
	var out []*Tool
	for _, t := range r.tools {
		out = append(out, t)
	}
	return out
}

// GetDefinitions returns definitions for all tools.
func (r *Registry) GetDefinitions() []ToolDefinition {
	var out []ToolDefinition
	for _, t := range r.tools {
		out = append(out, t.Definition)
	}
	return out
}

// Execute runs a tool by name. Returns error if tool not found or handler errors.
func (r *Registry) Execute(ctx context.Context, name string, args map[string]interface{}, tc *ToolContext) (interface{}, error) {
	t := r.GetTool(name)
	if t == nil {
		return nil, ErrToolNotFound
	}
	return t.Handler(ctx, args, tc)
}

// ErrToolNotFound is returned when the tool name is not registered.
var ErrToolNotFound = &toolError{msg: "tool not found"}

type toolError struct{ msg string }

func (e *toolError) Error() string { return e.msg }
