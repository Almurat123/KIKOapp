// Package tooling: Tool registry for AI (from kiko-api src/tooling).
// Stub: register and resolve tools by name.

package tooling

// Registry holds tool names and handlers.
type Registry struct {
	tools map[string]interface{}
}

// NewRegistry creates an empty registry.
func NewRegistry() *Registry {
	return &Registry{tools: make(map[string]interface{})}
}

// Register adds a tool by name.
func (r *Registry) Register(name string, impl interface{}) {
	r.tools[name] = impl
}

// Get returns the tool implementation or nil.
func (r *Registry) Get(name string) interface{} {
	return r.tools[name]
}
