// Package skills: AI skill registry (from kiko-api src/skills).

package skills

// Registry holds skills by id and supports intent lookup.
type Registry struct {
	byID     map[string]*Skill
	byIntent map[string][]*Skill
}

// NewRegistry creates an empty registry.
func NewRegistry() *Registry {
	return &Registry{
		byID:     make(map[string]*Skill),
		byIntent: make(map[string][]*Skill),
	}
}

// Register adds a skill by id; intents are used for GetSkillsByIntent.
func (r *Registry) Register(skill *Skill) {
	if skill == nil {
		return
	}
	id := skill.Metadata.ID
	if id == "" {
		return
	}
	r.byID[id] = skill
	for _, intent := range skill.Metadata.Intents {
		r.byIntent[intent] = append(r.byIntent[intent], skill)
	}
}

// GetSkill returns the skill by id or nil.
func (r *Registry) GetSkill(id string) *Skill {
	return r.byID[id]
}

// GetSkillsByIntent returns all skills that list the given intent.
func (r *Registry) GetSkillsByIntent(intent string) []*Skill {
	return r.byIntent[intent]
}

// GetAllSkills returns all registered skills.
func (r *Registry) GetAllSkills() []*Skill {
	var out []*Skill
	for _, s := range r.byID {
		out = append(out, s)
	}
	return out
}

// GetToolDefinitionsForSkills returns combined tool definitions for the given skill ids (stub: returns empty).
func (r *Registry) GetToolDefinitionsForSkills(skillIDs []string) string {
	_ = skillIDs
	return "[]"
}
