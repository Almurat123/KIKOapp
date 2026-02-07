// Package skills: AI skill registry (from kiko-api src/skills).
// Stub: register and resolve skills by name.

package skills

// Registry holds skill names and executors.
type Registry struct {
	skills map[string]interface{}
}

// NewRegistry creates an empty registry.
func NewRegistry() *Registry {
	return &Registry{skills: make(map[string]interface{})}
}

// Register adds a skill by name.
func (r *Registry) Register(name string, impl interface{}) {
	r.skills[name] = impl
}

// Get returns the skill implementation or nil.
func (r *Registry) Get(name string) interface{} {
	return r.skills[name]
}
