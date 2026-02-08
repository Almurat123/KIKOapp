package skills

// SkillMetadata describes a skill (id, name, description, intents, tools).
type SkillMetadata struct {
	ID          string
	Name        string
	Description string
	Intents     []string
	Tools       []string
	Examples    map[string][]string
}

// Skill is a single skill with metadata and prompt.
type Skill struct {
	Metadata SkillMetadata
	Prompt   string
}

// ToolDefinition is the JSON schema / definition for a tool (for AI).
type ToolDefinition struct {
	Name        string
	Description string
	Parameters  string
}
